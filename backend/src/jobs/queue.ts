import { Queue, Worker } from 'bullmq';
import type IORedis from 'ioredis';
import type { notifications_type } from '@prisma/client';
import { getRedis, closeRedis } from '../config/redis';
import { prisma } from '../config/database';
import { processScheduledMessages } from './scheduled-messages';
import { processEventReminders } from './event-reminders';
import { processAlcoholH5 } from './alcohol-h5';

/**
 * BullMQ job scheduler (D-011).
 *
 * Each automation is a DB-driven `processX()` function (durable state in
 * MariaDB — surviving restarts natively) plus a BullMQ repeatable job that
 * ticks it every minute when Redis is available:
 *
 *   - `scheduled-messages` → processScheduledMessages() (BR-008.5)
 *   - `event-reminders`    → processEventReminders()  (BR-009.6, H-48/H-2)
 *   - `alcohol-h5`         → processAlcoholH5()       (BR-005.8)
 *
 * ### Redis-absent graceful disable
 *
 * Redis is required for BullMQ only. When it is unreachable at boot, the
 * scheduler logs a clear warning and returns `{ enabled: false }` WITHOUT
 * starting workers — the API keeps serving (Redis is never on the HTTP
 * path, see config/redis.ts) and each `processX()` stays callable
 * directly for maintenance/smoke runs. If Redis dies AFTER start, workers
 * log errors and ioredis auto-reconnects; no partial work is lost because
 * the DB is the source of truth and every job re-scans due state.
 */

export const JOB_NAMES = {
  scheduledMessages: 'scheduled-messages',
  eventReminders: 'event-reminders',
  alcoholH5: 'alcohol-h5',
} as const;

const TICK_MS = 60_000; // every minute

/** Compute the wall-clock event start from event_date (DATE) + start_time (TIME). */
export function reservationStartDate(eventDate: Date, startTime: Date): Date {
  const date = eventDate.toISOString().slice(0, 10);
  const time = startTime.toISOString().slice(11, 19);
  const parsed = new Date(`${date}T${time}Z`);
  return Number.isNaN(parsed.getTime()) ? eventDate : parsed;
}

/** Dedupe guard: was this kind of notification already issued for the
 *  reservation within the last `windowMs`? (JSON payload check, 3h window). */
export async function alreadyNotified(
  userId: number,
  type: notifications_type,
  reservationId: number,
  now: Date,
  windowMs = 3 * 3600 * 1000,
): Promise<boolean> {
  const since = new Date(now.getTime() - windowMs);
  const rows = await prisma.notifications.findMany({
    where: { user_id: userId, type, created_at: { gte: since } },
    select: { payload: true },
  });
  return rows.some((row) => {
    const payload = row.payload as Record<string, unknown> | null;
    return payload?.reservation_id === reservationId;
  });
}

/** Quick connectivity probe that never blocks boot for long. */
async function redisReachable(): Promise<boolean> {
  try {
    const redis = getRedis();
    await Promise.race([
      redis.ping(),
      new Promise((_resolve, reject) => setTimeout(() => reject(new Error('redis ping timeout')), 3000)),
    ]);
    return true;
  } catch (error) {
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'jobs_redis_unreachable',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    return false;
  }
}

let schedulerState: 'idle' | 'enabled' | 'disabled' = 'idle';

function logDisabled(): void {
  // eslint-disable-next-line no-console
  console.log(
    '[jobs] scheduled jobs DISABLED: Redis unavailable (D-011) — BullMQ workers not started; the API keeps serving',
  );
}

/**
 * Start the BullMQ workers when Redis is reachable; otherwise disable them
 * gracefully. Idempotent — safe to call at every boot and from tests.
 */
export async function ensureScheduledJobs(): Promise<{ enabled: boolean }> {
  if (schedulerState === 'enabled') return { enabled: true };
  if (schedulerState === 'disabled') return { enabled: false };
  if (!(await redisReachable())) {
    schedulerState = 'disabled';
    logDisabled();
    return { enabled: false };
  }

  const redis = getRedis();
  const connection = redis as unknown as IORedis; // BullMQ accepts an IORedis instance
  const queues: Queue[] = [];
  const workers: Worker[] = [];

  try {
    const jobs: Array<{ name: string; run: () => Promise<unknown> }> = [
      { name: JOB_NAMES.scheduledMessages, run: () => processScheduledMessages() },
      { name: JOB_NAMES.eventReminders, run: () => processEventReminders() },
      { name: JOB_NAMES.alcoholH5, run: () => processAlcoholH5() },
    ];

    for (const job of jobs) {
      const queue = new Queue(job.name, { connection });
      await queue.add(job.name, {}, { repeat: { every: TICK_MS }, jobId: `${job.name}-tick` });
      queues.push(queue);

      const worker = new Worker(
        job.name,
        async () => {
          try {
            await job.run();
          } catch (error) {
            // eslint-disable-next-line no-console
            console.error(`[jobs] ${job.name} tick failed`, error);
          }
        },
        { connection, concurrency: 1 },
      );
      worker.on('error', (error) => {
        // eslint-disable-next-line no-console
        console.error(`[jobs] ${job.name} worker error`, error);
      });
      workers.push(worker);
    }

    schedulerState = 'enabled';
    // eslint-disable-next-line no-console
    console.log(`[jobs] BullMQ workers started (D-011): ${jobs.map((j) => j.name).join(', ')}`);
    return { enabled: true };
  } catch (error) {
    // Roll back whatever started — boot must never die because of jobs.
    await Promise.all([...workers.map((worker) => worker.close()), ...queues.map((queue) => queue.close())]);
    await closeRedis();
    schedulerState = 'disabled';
    // eslint-disable-next-line no-console
    console.warn(
      JSON.stringify({
        level: 'warn',
        msg: 'jobs_init_failed',
        error: error instanceof Error ? error.message : 'unknown',
      }),
    );
    logDisabled();
    return { enabled: false };
  }
}