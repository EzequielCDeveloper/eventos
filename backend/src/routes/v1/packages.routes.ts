import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as packageService from '../../services/package.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Package endpoints (UR-002.6, BR-011) mounted under `/api/v1/packages`.
 *
 * Only salons create packages and invite members (BR-011.1); invited
 * providers respond; availability is verified cross-slot before the package
 * becomes bookable (BR-011.3).
 */
export const packagesRouter: Router = Router();

const packageParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const memberParamsSchema = packageParamsSchema.extend({
  memberId: z.coerce.number().int().positive(),
});

const memberSchema = z
  .object({
    provider_id: z.number().int().positive(),
    service_type: z.enum(['sonido', 'servicio_persona']),
    member_price: z.number().nonnegative().optional(),
  })
  .strict();

const createPackageSchema = z
  .object({
    members: z.array(memberSchema).min(1).max(20),
  })
  .strict();

const respondSchema = z
  .object({
    accept: z.boolean(),
    member_price: z.number().nonnegative().optional(),
  })
  .strict();

const availabilityQuerySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
});

const verifyBodySchema = z
  .object({
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
  })
  .strict();

/** POST /packages — a salon creates a package with its first members. */
packagesRouter.post(
  '/',
  requireAuth(),
  requireRole('prestador'),
  validate({ body: createPackageSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createPackageSchema>;
    const pkg = await packageService.createPackage(req.user!.id, body.members);
    res.status(201).json({ data: pkg });
  }),
);

/** GET /packages/:id — package detail (leader or member view). */
packagesRouter.get(
  '/:id',
  requireAuth(),
  validate({ params: packageParamsSchema }),
  asyncHandler(async (req, res) => {
    const pkg = await packageService.getPackage(Number(req.params.id), req.user!.id);
    res.json({ data: pkg });
  }),
);

/** POST /packages/:id/invite — leader invites a provider (BR-011.5). */
packagesRouter.post(
  '/:id/invite',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: packageParamsSchema, body: memberSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof memberSchema>;
    const result = await packageService.inviteMember(Number(req.params.id), req.user!.id, body);
    res.status(201).json({ data: result });
  }),
);

/** PUT /packages/:id/members/:memberId/respond — accept/reject invitation. */
packagesRouter.put(
  '/:id/members/:memberId/respond',
  requireAuth(),
  validate({ params: memberParamsSchema, body: respondSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof respondSchema>;
    const result = await packageService.respondToInvitation(
      Number(req.params.id),
      Number(req.params.memberId),
      req.user!.id,
      { accept: body.accept, member_price: body.member_price },
    );
    res.json({ data: result });
  }),
);

/** GET /packages/:id/availability — cross-slot verification report (read-only). */
packagesRouter.get(
  '/:id/availability',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: packageParamsSchema, query: availabilityQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof availabilityQuerySchema>;
    const report = await packageService.checkPackageAvailability(Number(req.params.id), {
      date: q.date,
      start_time: q.start_time,
      end_time: q.end_time,
    });
    res.json({ data: report });
  }),
);

/**
 * POST /packages/:id/availability — leader runs the atomic cross-slot check
 * and advances the package state (BR-011.3). Extra endpoint beyond UR-002.6
 * (GET read-only) needed to drive the state machine; documented deviation.
 */
packagesRouter.post(
  '/:id/availability',
  requireAuth(),
  requireRole('prestador'),
  validate({ params: packageParamsSchema, body: verifyBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof verifyBodySchema>;
    const result = await packageService.verifyAndAdvanceAvailability(
      Number(req.params.id),
      req.user!.id,
      { date: body.date, start_time: body.start_time, end_time: body.end_time },
    );
    res.json({ data: result });
  }),
);