import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as pricingService from '../../services/pricing.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Pricing endpoints (UR-002.4) mounted under `/api/v1/services/:serviceId/…`.
 *
 * Public reads (price breakdown shown pre-booking — BR-012 Ley Consumer);
 * writes require the owning provider (`prestador` + ownership check).
 */
export const pricingRouter: Router = Router();

const serviceParamsSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
});

const extraParamsSchema = serviceParamsSchema.extend({
  extraId: z.coerce.number().int().positive(),
});

const ruleParamsSchema = serviceParamsSchema.extend({
  ruleId: z.coerce.number().int().positive(),
});

const pricingBodySchema = z
  .object({
    salon: z
      .object({
        base_block_hours: z.number().int().min(1).max(24),
        base_block_price: z.number().nonnegative(),
        extra_hour_price: z.number().nonnegative(),
      })
      .optional(),
    sound_package: z
      .object({
        name: z.string().min(1).max(150),
        description: z.string().min(1),
        base_price: z.number().nonnegative(),
        base_hours: z.number().int().min(1).max(24),
        extra_hour_price: z.number().nonnegative(),
      })
      .optional(),
    persona: z
      .object({ price_per_person_per_hour: z.number().nonnegative() })
      .optional(),
  })
  .strict();

const createExtraSchema = z.object({
  name: z.string().min(1).max(150),
  description: z.string().min(1),
  price: z.number().nonnegative(),
  sound_package_id: z.number().int().positive().optional(),
});

const createRuleSchema = z.object({
  adjustment_type: z.enum(['temporada', 'demanda', 'dia_semana', 'bloque_turno']),
  adjustment_value: z.number().nonnegative(),
  scope: z.record(z.unknown()),
  sound_package_id: z.number().int().positive().optional(),
});

const writer = [requireAuth(), requireRole('prestador')];

// ---- Pricing (polymorphic by service_type) ------------------------------

pricingRouter.get(
  '/services/:serviceId/pricing',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const pricing = await pricingService.getServicePricing(Number(req.params.serviceId));
    res.json({ data: pricing });
  }),
);

pricingRouter.post(
  '/services/:serviceId/pricing',
  ...writer,
  validate({ params: serviceParamsSchema, body: pricingBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await pricingService.createServicePricing(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: result });
  }),
);

pricingRouter.put(
  '/services/:serviceId/pricing',
  ...writer,
  validate({ params: serviceParamsSchema, body: pricingBodySchema }),
  asyncHandler(async (req, res) => {
    const result = await pricingService.updateServicePricing(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.json({ data: result });
  }),
);

// ---- Extras -----------------------------------------------------------------

pricingRouter.get(
  '/services/:serviceId/extras',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const extras = await pricingService.listExtras(Number(req.params.serviceId));
    res.json({ data: extras });
  }),
);

pricingRouter.post(
  '/services/:serviceId/extras',
  ...writer,
  validate({ params: serviceParamsSchema, body: createExtraSchema }),
  asyncHandler(async (req, res) => {
    const extra = await pricingService.createExtra(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: extra });
  }),
);

pricingRouter.delete(
  '/services/:serviceId/extras/:extraId',
  ...writer,
  validate({ params: extraParamsSchema }),
  asyncHandler(async (req, res) => {
    await pricingService.deleteExtra(Number(req.params.serviceId), req.user!.id, Number(req.params.extraId));
    res.json({ data: { deleted: true } });
  }),
);

// ---- Dynamic pricing rules (D-007) -------------------------------------------

pricingRouter.get(
  '/services/:serviceId/dynamic-rules',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const rules = await pricingService.listDynamicRules(Number(req.params.serviceId));
    res.json({ data: rules });
  }),
);

pricingRouter.post(
  '/services/:serviceId/dynamic-rules',
  ...writer,
  validate({ params: serviceParamsSchema, body: createRuleSchema }),
  asyncHandler(async (req, res) => {
    const rule = await pricingService.createDynamicRule(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: rule });
  }),
);

pricingRouter.delete(
  '/services/:serviceId/dynamic-rules/:ruleId',
  ...writer,
  validate({ params: ruleParamsSchema }),
  asyncHandler(async (req, res) => {
    await pricingService.deleteDynamicRule(Number(req.params.serviceId), req.user!.id, Number(req.params.ruleId));
    res.json({ data: { deleted: true } });
  }),
);