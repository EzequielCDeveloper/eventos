import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { authLimiter } from '../../middleware/rateLimiter';
import { validate } from '../../middleware/validate';
import * as authService from '../../services/auth.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Authentication endpoints (BR-002.7, UR-002.1, UR-003) mounted under
 * `/api/v1/auth`. Rate-limited at 10 req/min per IP (BR-014.3, UR-008.3).
 *
 * Registered roles are constrained to `usuario`/`prestador`: the
 * `administrador` role is bootstrap-only (seed) and never self-assignable.
 */
export const authRouter: Router = Router();

authRouter.use(authLimiter);

const registerSchema = z.object({
  full_name: z.string().min(2).max(255),
  email: z.string().email().max(255),
  phone: z.string().min(7).max(20),
  password: z.string().min(8).max(128),
  role: z.enum(['usuario', 'prestador']).optional(),
  segment: z.enum(['particular', 'empresa']).optional(),
  // LFPDPPP consent captured at data collection (BR-012).
  accept_privacy_policy: z.boolean().optional(),
});

const loginSchema = z.object({
  email: z.string().email().max(255),
  password: z.string().min(1).max(128),
});

const refreshSchema = z.object({
  refresh_token: z.string().min(1),
});

const logoutSchema = z.object({
  refresh_token: z.string().optional(),
});

authRouter.post(
  '/register',
  validate({ body: registerSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.register(req.body);
    res.status(201).json({ data: result });
  }),
);

authRouter.post(
  '/login',
  validate({ body: loginSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.login(req.body);
    res.json({ data: result });
  }),
);

authRouter.post(
  '/refresh',
  validate({ body: refreshSchema }),
  asyncHandler(async (req, res) => {
    const result = await authService.refresh(req.body.refresh_token);
    res.json({ data: result });
  }),
);

authRouter.post(
  '/logout',
  validate({ body: logoutSchema }),
  asyncHandler(async (req, res) => {
    await authService.logout(req.body.refresh_token);
    res.json({ data: { revoked: true } });
  }),
);

authRouter.get(
  '/me',
  requireAuth(),
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ data: { user } });
  }),
);