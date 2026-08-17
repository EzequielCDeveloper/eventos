import express, { type Express, type NextFunction, type Request, type Response } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import { env } from './config/env';
import { v1Router } from './routes/v1';
import { apiLimiter } from './middleware/rateLimiter';
import { errorHandler, notFoundHandler } from './middleware/errorHandler';

/**
 * Express application factory (D-008).
 *
 * Middleware order:
 *   helmet → cors → express.json → request logging → apiLimiter →
 *   /api/v1 routes → 404 → global error handler.
 *
 * Auth (`requireAuth`) and role guards (`requireRole`) apply per-route in
 * the routers, after this stack.
 */
export function createApp(): Express {
  const app = express();

  app.disable('x-powered-by');

  // Security headers (UR-008.2)
  app.use(helmet());

  // CORS: dev allows any origin; production is same-origin via Nginx
  // (design D-006) so CORS headers are not needed.
  app.use(
    cors({
      origin: env.NODE_ENV === 'production' ? false : true,
    }),
  );

  app.use(express.json({ limit: '1mb' }));

  // Structured request logging (BR-014.2): method, path, status, duration,
  // user_id when authenticated.
  app.use((req: Request, res: Response, next: NextFunction) => {
    const start = Date.now();
    res.on('finish', () => {
      const durationMs = Date.now() - start;
      console.log(
        JSON.stringify({
          level: 'info',
          msg: 'http_request',
          method: req.method,
          path: req.originalUrl,
          status: res.statusCode,
          duration_ms: durationMs,
          user_id: req.user?.id ?? null,
        }),
      );
    });
    next();
  });

  // Global API rate limit (BR-014.3, UR-008.3)
  app.use('/api', apiLimiter);

  // Versioned routes (BR-001.8, UR-011.1)
  app.use('/api/v1', v1Router);

  // Everything else → 404 (keeps /api/v2 and non-API paths clean)
  app.use(notFoundHandler());

  // Global error handler (BR-003)
  app.use(errorHandler());

  return app;
}