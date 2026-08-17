import { Router } from 'express';
import { healthRouter } from './health.routes';
import { authRouter } from './auth.routes';
import { usersRouter } from './users.routes';
import { servicesRouter } from './services.routes';
import { pricingRouter } from './pricing.routes';
import { inventoryRouter } from './inventory.routes';
import { reservationsRouter } from './reservations.routes';
import { packagesRouter } from './packages.routes';
import { contractsRouter } from './contracts.routes';
import { paymentsRouter } from './payments.routes';
import { webhooksRouter } from './webhooks.routes';

/**
 * Version 1 router (BR-001, UR-011). Mounted under `/api/v1` in app.ts.
 *
 * Routers define paths relative to their mount prefix (health-style):
 *   - `/auth/*`         → authRouter  (rate-limited — authLimiter is scoped here)
 *   - `/users/*`        → usersRouter (requireAuth is scoped here)
 *   - `/services*`      → services/pricing/inventory routers (public reads,
 *                         provider-gated writes)
 *   - `/reservations/*` → reservationsRouter (13-state lifecycle, UR-002.7)
 *   - `/packages/*`     → packagesRouter (collaborative packages, UR-002.6)
 *   - `/contracts/*`    → contractsRouter (bilateral confirmation, UR-002.8)
 *   - `/payments/*`     → paymentsRouter (Conekta charges/refunds, UR-002.9)
 *   - `/webhooks/*`     → webhooksRouter (PUBLIC, signature-verified, BR-013.1)
 */
export const v1Router: Router = Router();

v1Router.use(healthRouter);
v1Router.use('/auth', authRouter);
v1Router.use('/users', usersRouter);
v1Router.use(servicesRouter);
v1Router.use(pricingRouter);
v1Router.use(inventoryRouter);
v1Router.use('/reservations', reservationsRouter);
v1Router.use('/packages', packagesRouter);
v1Router.use('/contracts', contractsRouter);
v1Router.use('/payments', paymentsRouter);
v1Router.use('/webhooks', webhooksRouter);

v1Router.get('/version', (_req, res) => {
  res.json({ data: { version: 'v1' } });
});