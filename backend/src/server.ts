import { createServer } from 'node:http';
import { createApp } from './app';
import { initSocket } from './socket';
import { env } from './config/env';
import { prisma } from './config/database';
import { closeRedis } from './config/redis';
import { ensureScheduledJobs } from './jobs';

/**
 * HTTP server entrypoint (BR-014.5, D-010).
 *
 * Attaches Socket.IO to the same HTTP server, starts listening, and
 * performs graceful shutdown on SIGTERM/SIGINT: stops accepting new
 * connections, closes Socket.IO, disconnects Prisma and Redis, then
 * exits. A hard timeout force-exits if shutdown hangs.
 */
const app = createApp();
const httpServer = createServer(app);
const io = initSocket(httpServer);

const SHUTDOWN_TIMEOUT_MS = 10_000;

async function shutdown(signal: string): Promise<void> {
  console.log(`[server] received ${signal}, shutting down gracefully...`);

  const forceExit = setTimeout(() => {
    console.error('[server] shutdown timed out, forcing exit');
    process.exit(1);
  }, SHUTDOWN_TIMEOUT_MS);
  forceExit.unref();

  try {
    io.close();
    httpServer.close(async () => {
      try {
        await prisma.$disconnect();
        await closeRedis();
        console.log('[server] shutdown complete');
        process.exit(0);
      } catch (error) {
        console.error('[server] error during shutdown', error);
        process.exit(1);
      }
    });
  } catch (error) {
    console.error('[server] error during shutdown', error);
    process.exit(1);
  }
}

process.on('SIGTERM', () => void shutdown('SIGTERM'));
process.on('SIGINT', () => void shutdown('SIGINT'));

httpServer.listen(env.PORT, () => {
  console.log(`[server] API listening on http://0.0.0.0:${env.PORT} (env=${env.NODE_ENV})`);
});

// BullMQ scheduled jobs (D-011). Redis-absent environments disable the
// workers gracefully — boot and HTTP serving never depend on Redis.
void ensureScheduledJobs()
  .then(({ enabled }) => {
    console.log(`[server] scheduled jobs ${enabled ? 'enabled' : 'disabled (Redis unavailable)'}`);
  })
  .catch((error) => {
    console.warn('[server] failed to initialize scheduled jobs', error);
  });