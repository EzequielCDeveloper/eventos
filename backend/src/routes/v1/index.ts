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
import { messagesRouter } from './messages.routes';
import { notificationsRouter } from './notifications.routes';
import { adminRouter } from './admin.routes';
import { reviewsRouter } from './reviews.routes';
import { favoritesRouter } from './favorites.routes';
import { agoraRouter } from './agora.routes';
import { uploadsRouter } from './uploads.routes';

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
 *   - `/conversations*` → messagesRouter (chat threads + messages, UR-002.10)
 *   - `/notifications/*`→ notificationsRouter (inbox + read, UR-002.11)
 *   - `/admin/*`        → adminRouter (5 admin functions, BR-002.4)
 *   - `/reviews/*`      → reviewsRouter (post-payment review, UR-002.12)
 *   - `/favorites/*`    → favoritesRouter (add/remove, UR-002.13)
 *   - `/agora/*`        → agoraRouter (RTC token for voice/video, UR-009.2, task 9.5)
 *   - `/uploads`        → uploadsRouter (signed file upload, BR-013.6/D-012, task 9.5 follow-up)
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
v1Router.use(messagesRouter);
v1Router.use('/notifications', notificationsRouter);
v1Router.use('/admin', adminRouter);
v1Router.use(reviewsRouter);
v1Router.use(favoritesRouter);
v1Router.use(agoraRouter);
v1Router.use(uploadsRouter);

v1Router.get('/version', (_req, res) => {
  res.json({ data: { version: 'v1' } });
});