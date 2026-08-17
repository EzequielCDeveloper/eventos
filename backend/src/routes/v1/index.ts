import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { servicesRouter } from './services.routes';
import { pricingRouter } from './pricing.routes';
import { inventoryRouter } from './inventory.routes';

/**
 * Version 1 router (BR-001, UR-011). Mounted under `/api/v1` in app.ts.
 *
 * Routers define paths relative to their mount prefix (health-style):
 *   - `/auth/*`    → authRouter  (rate-limited — authLimiter is scoped here)
 *   - `/users/*`   → usersRouter (requireAuth is scoped here)
 *   - `/services*` → services/pricing/inventory routers (public reads,
 *                    provider-gated writes)
 */
export const v1Router: Router = Router();

v1Router.use(healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use(servicesRouter);
v1Router.use(pricingRouter);
v1Router.use(inventoryRouter);

v1Router.get('/version', (_req, res) => {
  res.json({ data: { version: 'v1' } });
});