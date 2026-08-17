import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as paymentService from '../../services/payment.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Payment endpoints (UR-002.9, BR-006) mounted under `/api/v1/payments`.
 *
 * POST /payments            — charge via Conekta (anticipo/saldo/deposito_garantia)
 * GET  /payments/:id        — participant-scoped payment detail with refunds
 * POST /payments/:id/refund — refund (part of) a processed payment
 *
 * Documented extra (BR-006.8): GET /payments/reports/monthly — per-provider
 * monthly tax report (transactions, gross, taxes, commission, net).
 */
export const paymentsRouter: Router = Router();

const paymentParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createPaymentSchema = z
  .object({
    reservation_id: z.number().int().positive(),
    payment_type: z.enum(['anticipo', 'saldo', 'deposito_garantia']),
    amount: z.coerce.number().positive(),
    currency: z.string().length(3).default('MXN'),
    billing_model: z.enum(['anticipo', 'completo', 'post_servicio']).default('anticipo'),
    description: z.string().max(500).optional(),
  })
  .strict();

const refundPaymentSchema = z
  .object({
    amount: z.coerce.number().positive().optional(),
    reason: z.enum([
      'cancelacion_proveedor',
      'cancelacion_cliente',
      'deposito_devolucion',
      'politica_proveedor',
      'permiso_alcohol_no_confirmado',
    ]),
  })
  .strict();

const monthlyReportQuerySchema = z
  .object({
    year: z.coerce.number().int().min(2000).max(2100),
    month: z.coerce.number().int().min(1).max(12),
  })
  .strict();

/** POST /payments — charge via Conekta (stub in dev), MXN enforced (BR-006.5). */
paymentsRouter.post(
  '/',
  requireAuth(),
  validate({ body: createPaymentSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createPaymentSchema>;
    const payment = await paymentService.processPayment({
      reservationId: body.reservation_id,
      actor: req.user!,
      paymentType: body.payment_type,
      amount: body.amount,
      currency: body.currency,
      billingModel: body.billing_model,
      description: body.description,
    });
    res.status(201).json({ data: payment });
  }),
);

/**
 * GET /payments/reports/monthly?year=&month= — per-provider monthly tax
 * report (BR-006.8). Providers see their own report (their `req.user.id` is
 * their provider id). Registered BEFORE `/:id` so the literal `reports`
 * segment is not captured as a payment id.
 */
paymentsRouter.get(
  '/reports/monthly',
  requireAuth(),
  requireRole('prestador', 'administrador'),
  validate({ query: monthlyReportQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof monthlyReportQuerySchema>;
    const report = await paymentService.providerMonthlyReport(
      req.user!.id,
      q.year,
      q.month,
    );
    res.json({ data: report });
  }),
);

/** GET /payments/:id — detail with refunds (UR-002.9). */
paymentsRouter.get(
  '/:id',
  requireAuth(),
  validate({ params: paymentParamsSchema }),
  asyncHandler(async (req, res) => {
    const payment = await paymentService.getPayment(Number(req.params.id), req.user!);
    res.json({ data: payment });
  }),
);

/** POST /payments/:id/refund — refund (part of) a processed payment (UR-002.9). */
paymentsRouter.post(
  '/:id/refund',
  requireAuth(),
  validate({ params: paymentParamsSchema, body: refundPaymentSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof refundPaymentSchema>;
    const payment = await paymentService.refundPayment({
      paymentId: Number(req.params.id),
      actor: req.user!,
      amount: body.amount,
      reason: body.reason,
    });
    res.json({ data: payment });
  }),
);