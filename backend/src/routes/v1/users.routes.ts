import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as authService from '../../services/auth.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Current-user endpoints (UR-002.2) mounted under `/api/v1/users`.
 * Every route requires an authenticated principal (`requireAuth`).
 */
export const usersRouter: Router = Router();

usersRouter.use(requireAuth());

const updateProfileSchema = z.object({
  full_name: z.string().min(2).max(255).optional(),
  phone: z.string().min(7).max(20).optional(),
  avatar_url: z.string().url().max(500).nullable().optional(),
  notification_prefs: z.record(z.unknown()).optional(),
});

const verifyDocumentSchema = z.object({
  // Placeholder payload for the identity-verification request. The actual
  // INE document / KYC capture executes server-side in the S5 slice.
  document_url: z.string().url().max(500).optional(),
  notes: z.string().max(500).optional(),
});

usersRouter.get(
  '/me',
  asyncHandler(async (req, res) => {
    const user = await authService.getMe(req.user!.id);
    res.json({ data: { user } });
  }),
);

usersRouter.put(
  '/me',
  validate({ body: updateProfileSchema }),
  asyncHandler(async (req, res) => {
    const user = await authService.updateProfile(req.user!.id, req.body);
    res.json({ data: { user } });
  }),
);

usersRouter.post(
  '/verify-ine',
  validate({ body: verifyDocumentSchema }),
  asyncHandler(async (req, res) => {
    const verification = await authService.requestIdentityVerification(req.user!.id, 'ine_presencial');
    res.status(201).json({ data: { verification } });
  }),
);

usersRouter.post(
  '/verify-kyc',
  validate({ body: verifyDocumentSchema }),
  asyncHandler(async (req, res) => {
    const verification = await authService.requestIdentityVerification(req.user!.id, 'kyc');
    res.status(201).json({ data: { verification } });
  }),
);