import { Router } from 'express';
import { checkDatabaseConnection } from '../../config/database';

/**
 * Health check endpoint (BR-014.1, UR-010.1, D-010).
 *
 * GET /api/v1/health → 200 `{ status: "ok", db: "connected" }` when the
 * database answers; 503 `{ status: "degraded", db: "disconnected" }`
 * otherwise — used by the Docker healthcheck and uptime probes.
 */
export const healthRouter: Router = Router();

healthRouter.get('/health', async (_req, res) => {
  const dbConnected = await checkDatabaseConnection();
  if (!dbConnected) {
    res.status(503).json({ status: 'degraded', db: 'disconnected' });
    return;
  }
  res.status(200).json({ status: 'ok', db: 'connected' });
});