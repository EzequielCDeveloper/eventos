import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as reservationService from '../../services/reservation.service';
import * as cancellationService from '../../services/cancellation.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Reservation endpoints (UR-002.7, BR-005) mounted under `/api/v1/reservations`.
 *
 * POST /reservations opens a booking (simple single-slot or package) with
 * transactional slot locking; PUT /:id/status drives the 13-state machine;
 * GET /:id/timeline returns the full `reservation_status_history` audit trail.
 */
export const reservationsRouter: Router = Router();

const reservationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createReservationSchema = z
  .object({
    slot_id: z.number().int().positive().optional(),
    package_id: z.number().int().positive().optional(),
    slot_ids: z.array(z.number().int().positive()).max(20).optional(),
    items: z
      .array(
        z
          .object({
            sound_package_id: z.number().int().positive().optional(),
            person_count: z.number().int().positive().optional(),
          })
          .strict(),
      )
      .max(20)
      .optional(),
    extras: z
      .array(
        z
          .object({
            extra_id: z.number().int().positive(),
            quantity: z.number().int().positive(),
          })
          .strict(),
      )
      .max(50)
      .optional(),
    alcohol_requested: z.boolean().optional(),
  })
  .strict();

const listQuerySchema = z.object({
  status: z
    .enum([
      'creado',
      'invitaciones_pendientes',
      'invitaciones_aceptadas',
      'disponibilidad_verificada',
      'disponible_para_reserva',
      'pendiente_firma',
      'contrato_confirmado',
      'permiso_alcohol',
      'pago_anticipo',
      'confirmada',
      'en_curso',
      'completada',
      'cancelada',
    ])
    .optional(),
  event_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const statusChangeSchema = z
  .object({
    status: z.enum([
      'creado',
      'invitaciones_pendientes',
      'invitaciones_aceptadas',
      'disponibilidad_verificada',
      'disponible_para_reserva',
      'pendiente_firma',
      'contrato_confirmado',
      'permiso_alcohol',
      'pago_anticipo',
      'confirmada',
      'en_curso',
      'completada',
      'cancelada',
    ]),
    alcohol_resolution: z.enum(['continuar_sin_alcohol', 'cancelar']).optional(),
    alcohol_status: z.enum(['confirmado', 'no_confirmado']).optional(),
    cancel_reason: z.string().max(500).optional(),
    retention_accepted: z.boolean().optional(),
  })
  .strict();

const cancelReservationSchema = z
  .object({
    reason: z.string().max(500).optional(),
    /** Client acceptance of the provider retention policy (BR-007.3). */
    retention_accepted: z.boolean().optional(),
    /** Explicit canceller side; only honored for admins, else derived. */
    cancelled_by: z.enum(['cliente', 'proveedor']).optional(),
  })
  .strict();

/** POST /reservations — open a booking (slot locked transactionally, D-007). */
reservationsRouter.post(
  '/',
  requireAuth(),
  validate({ body: createReservationSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createReservationSchema>;
    const created = await reservationService.createReservation({
      clientId: req.user!.id,
      slotId: body.slot_id,
      packageId: body.package_id,
      slotIds: body.slot_ids,
      items: body.items,
      extras: body.extras,
      alcohol_requested: body.alcohol_requested,
    });
    res.status(201).json({ data: created });
  }),
);

/** GET /reservations — actor-scoped list with status/date filters (UR-002.7). */
reservationsRouter.get(
  '/',
  requireAuth(),
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const result = await reservationService.listReservations(
      req.user!,
      { status: q.status, event_date: q.event_date },
      { page: q.page ?? 1, limit: q.limit ?? 20 },
    );
    res.json({ data: result.items, meta: result.meta });
  }),
);

/** PUT /reservations/:id/status — move through the 13-state machine. */
reservationsRouter.put(
  '/:id/status',
  requireAuth(),
  validate({ params: reservationParamsSchema, body: statusChangeSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof statusChangeSchema>;
    const updated = await reservationService.transitionStatus(Number(req.params.id), req.user!, {
      status: body.status,
      alcohol_resolution: body.alcohol_resolution,
      alcohol_status: body.alcohol_status,
      cancel_reason: body.cancel_reason,
      retention_accepted: body.retention_accepted,
    });
    res.json({ data: updated });
  }),
);

/** GET /reservations/:id/timeline — full status audit trail (BR-005.4). */
reservationsRouter.get(
  '/:id/timeline',
  requireAuth(),
  validate({ params: reservationParamsSchema }),
  asyncHandler(async (req, res) => {
    const timeline = await reservationService.getReservationTimeline(
      Number(req.params.id),
      req.user!,
    );
    res.json({ data: timeline });
  }),
);

/**
 * POST /reservations/:id/cancel — cancel + refund per BR-007 (client near/
 * far policy, provider full refund, retention acceptance, Conekta refunds).
 * Documented deviation: UR-002.7 lists only create/list/status/timeline, but
 * the cancellation + refund flow (BR-007) needs its own entry point instead
 * of overloading the raw status transition (which does not process refunds).
 */
reservationsRouter.post(
  '/:id/cancel',
  requireAuth(),
  validate({ params: reservationParamsSchema, body: cancelReservationSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof cancelReservationSchema>;
    const result = await cancellationService.cancelReservation(Number(req.params.id), req.user!, {
      reason: body.reason,
      retention_accepted: body.retention_accepted,
      cancelled_by: body.cancelled_by,
    });
    res.json({ data: result });
  }),
);