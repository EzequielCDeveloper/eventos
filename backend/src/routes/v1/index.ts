import { Router } from 'express';
import { healthRouter } from './health.routes';

/**
 * Version 1 router (BR-001, UR-011). Mounted under `/api/v1` in app.ts.
 *
 * New endpoint groups (auth, users, services, reservations, payments,
 * messages, notifications, admin...) mount here as they land; the
 * `/api/v1` prefix guarantees versioning and makes future `/api/v2`
 * coexistence trivial (UR-011.1).
 */
export const v1Router: Router = Router();

v1Router.use(healthRouter);