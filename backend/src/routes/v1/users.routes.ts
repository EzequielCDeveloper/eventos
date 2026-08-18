import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as authService from '../../services/auth.service';
import { runKycVerification } from '../../services/verification.service';
import * as servicesService from '../../services/services.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { toDateString, toISOStringOrNull } from '../../utils/datetime';

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
  // Placeholder payload for the INE-presencial request (physical delivery
  // + contract signing, BR-010.3). The row is created with result
  // `pendiente`; completion is an offline/admin action.
  document_url: z.string().url().max(500).optional(),
  notes: z.string().max(500).optional(),
});

// KYC submits the INE data that Verificamex checks against the Lista
// Nominal (BR-010.4/BR-010.5). The values are used in-flight only and are
// NEVER persisted or logged (BR-010.6).
const kycSchema = z
  .object({
    curp: z.string().min(15).max(18),
    clave_elector: z.string().min(5).max(20),
    nombre_completo: z.string().min(2).max(255),
    ocr: z.string().max(100).optional(),
  })
  .strict();

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
  validate({ body: kycSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof kycSchema>;
    // Full KYC flow (BR-010): consent gate → Verificamex (stub outside
    // production, 10s timeout) → metadata-only result row → verified flag.
    const verification = await runKycVerification(req.user!.id, body);
    res.status(201).json({ data: { verification } });
  }),
);

// ---- ARCO data rights (BR-012, FR-016.2) ------------------------------------

const createArcoRequestSchema = z
  .object({
    tipo: z.enum(['acceso', 'rectificacion', 'cancelacion', 'oposicion']),
  })
  .strict();

/**
 * POST /users/arco-requests — submit an ARCO request (LFPDPPP, BR-012).
 * `deadline_at` is now + 20 business days; `status` starts `pendiente` and
 * resolution is an offline/admin action.
 */
usersRouter.post(
  '/arco-requests',
  validate({ body: createArcoRequestSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createArcoRequestSchema>;
    const request = await authService.createArcoRequest(req.user!.id, body.tipo);
    res.status(201).json({
      data: {
        id: request.id,
        tipo: request.tipo,
        status: request.status,
        requested_at: request.requested_at.toISOString(),
        deadline_at: request.deadline_at ? toDateString(request.deadline_at) : null,
      },
    });
  }),
);

/** GET /users/arco-requests — the current user's ARCO requests, newest first. */
usersRouter.get(
  '/arco-requests',
  asyncHandler(async (req, res) => {
    const requests = await authService.listArcoRequests(req.user!.id);
    res.json({
      data: requests.map((r) => ({
        id: r.id,
        tipo: r.tipo,
        status: r.status,
        requested_at: r.requested_at.toISOString(),
        deadline_at: r.deadline_at ? toDateString(r.deadline_at) : null,
        resolved_at: toISOStringOrNull(r.resolved_at),
        response_notes: r.response_notes,
      })),
    });
  }),
);

// ---- Provider cancellation policy (FR-011.7) --------------------------------

const cancellationPolicySchema = z
  .object({
    retention_percent: z.number().int().min(0).max(100).optional(),
    penalty_free_window_days: z.number().int().min(1).max(90).optional(), // DB CHECK 1..90
    deposit_refundable: z.boolean().optional(),
  })
  .strict();

function serializeCancellationPolicy(p: {
  id: number;
  retention_percent: number;
  penalty_free_window_days: number;
  deposit_refundable: boolean;
  created_at: Date;
  updated_at: Date;
}) {
  return {
    id: p.id,
    retention_percent: p.retention_percent,
    penalty_free_window_days: p.penalty_free_window_days,
    deposit_refundable: p.deposit_refundable,
    created_at: p.created_at.toISOString(),
    updated_at: p.updated_at.toISOString(),
  };
}

/**
 * GET /users/me/cancellation-policy — the provider's cancellation policy
 * (FR-011.7). Auto-created with defaults (50% retention, 30d window, deposit
 * refundable) on first read via the same upsert used at service creation.
 */
usersRouter.get(
  '/me/cancellation-policy',
  requireRole('prestador'),
  asyncHandler(async (req, res) => {
    const policy = await servicesService.getProviderCancellationPolicy(req.user!.id);
    res.json({ data: serializeCancellationPolicy(policy) });
  }),
);

/**
 * PUT /users/me/cancellation-policy — the provider updates its own policy
 * (FR-011.7). Partial PATCH semantics; `updated_at` always bumps.
 */
usersRouter.put(
  '/me/cancellation-policy',
  requireRole('prestador'),
  validate({ body: cancellationPolicySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof cancellationPolicySchema>;
    const policy = await servicesService.updateProviderCancellationPolicy(req.user!.id, body);
    res.json({ data: serializeCancellationPolicy(policy) });
  }),
);
