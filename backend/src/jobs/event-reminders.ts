import { prisma } from '../config/database';
import { dispatch } from '../services/notification.service';
import { reservationStartDate, alreadyNotified } from './queue';

/**
 * Event reminders worker (BR-009.6, D-011).
 *
 * Dispatches the H-48 (push + email) and H-2 (push) reminders to BOTH
 * parties of every upcoming confirmed reservation (client via
 * `reservations.client_id`, provider via the reservation items' service
 * provider) exactly inside the ±1h window around each target:
 *
 *   - H-48 window: reservation starts within (now+47h, now+49h]
 *   - H-2  window: reservation starts within (now+1h,  now+3h]
 *
 * A per-reservation dedupe guard inside the notifications payload
 * (`reservation_id`) prevents double-firing across restarts or overlapping
 * ticks. Runs DB-driven on a BullMQ tick and is exported for direct
 * invocation (smoke runs without Redis).
 */

export interface EventRemindersRunResult {
  candidate_reservations: number;
  h48_dispatched: number;
  h2_dispatched: number;
  skipped_duplicates: number;
}

const WINDOW_MS = 3600 * 1000; // ±1h around the exact H-48 / H-2 moment

export async function processEventReminders(options: { now?: Date } = {}): Promise<EventRemindersRunResult> {
  const now = options.now ?? new Date();
  const candidates = await prisma.reservations.findMany({
    where: { status: { in: ['confirmada', 'en_curso'] } },
    take: 500,
    include: {
      reservation_items: {
        include: { services: { select: { provider_id: true } } },
        take: 1,
      },
    },
  });

  let h48 = 0;
  let h2 = 0;
  let skippedDuplicates = 0;

  for (const reservation of candidates) {
    const start = reservationStartDate(reservation.event_date, reservation.start_time);
    const distanceMs = start.getTime() - now.getTime();

    const isH48 = Math.abs(distanceMs - 48 * 3600 * 1000) <= WINDOW_MS;
    const isH2 = Math.abs(distanceMs - 2 * 3600 * 1000) <= WINDOW_MS;
    if (!isH48 && !isH2) continue;

    const type = isH48 ? 'recordatorio_evento_h48' : 'recordatorio_evento_h2';
    const providerId = reservation.reservation_items[0]?.services.provider_id;
    const payload = {
      reservation_id: reservation.id,
      event_date: reservation.event_date.toISOString().slice(0, 10),
      start_time: reservation.start_time.toISOString().slice(11, 19),
    };
    const recipients = [
      { id: reservation.client_id },
      ...(providerId ? [{ id: providerId }] : []),
    ];

    for (const recipient of recipients) {
      if (await alreadyNotified(recipient.id, type, reservation.id, now)) {
        skippedDuplicates += 1;
        continue;
      }
      await dispatch({
        userId: recipient.id,
        type,
        title: isH48 ? 'Tu evento es en 48 horas' : 'Tu evento es en 2 horas',
        body: isH48
          ? `Recordatorio: tu evento del ${payload.event_date} comienza en 48 horas.`
          : `Tu evento del ${payload.event_date} comienza en 2 horas.`,
        payload,
      });
      if (isH48) h48 += 1;
      else h2 += 1;
    }
  }

  return {
    candidate_reservations: candidates.length,
    h48_dispatched: h48,
    h2_dispatched: h2,
    skipped_duplicates: skippedDuplicates,
  };
}