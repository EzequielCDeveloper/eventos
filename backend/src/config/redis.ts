import Redis from 'ioredis';
import { env } from './env';

/**
 * Redis connection for BullMQ (D-011).
 *
 * The connection is LAZY: it is only created when a caller actually asks
 * for it (queues/workers in src/jobs/, realtime slice). Creating it here
 * would block boot when Redis is down, which the API must not do — Redis
 * is required only for scheduled jobs, not for serving HTTP traffic.
 */
let redisClient: Redis | null = null;

export function getRedis(): Redis {
  if (!redisClient) {
    redisClient = new Redis(env.REDIS_URL, {
      maxRetriesPerRequest: null, // BullMQ requires this
      lazyConnect: true,
    });
  }
  return redisClient;
}

export async function closeRedis(): Promise<void> {
  if (redisClient) {
    await redisClient.quit();
    redisClient = null;
  }
}