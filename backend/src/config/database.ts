import { PrismaClient } from '@prisma/client';
import { env } from './env';

/**
 * PrismaClient singleton (BR-014.4 — connection pooling, D-001).
 *
 * A single instance is shared across the process and reused on hot-reload
 * in development via the global object. Connection logging is enabled in
 * development only; production logs errors only.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    datasources: { db: { url: env.DATABASE_URL } },
    log: env.NODE_ENV === 'development' ? ['query', 'warn', 'error'] : ['error'],
  });

if (env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma;
}

/**
 * Cheap connectivity probe used by the health endpoint (BR-014.1).
 * Returns true when the database answers `SELECT 1`.
 */
export async function checkDatabaseConnection(): Promise<boolean> {
  try {
    await prisma.$queryRaw`SELECT 1`;
    return true;
  } catch (error) {
    console.error('[database] health check failed', error);
    return false;
  }
}