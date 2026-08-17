import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as inventoryService from '../../services/inventory.service';
import { asyncHandler } from '../../utils/asyncHandler';
import { parseISODate } from '../../utils/datetime';

/**
 * Inventory endpoints (UR-002.5) mounted under `/api/v1/services/:serviceId/…`.
 *
 * Public reads (availability/hours are booking input); writes require the
 * owning provider (`prestador` + ownership).
 */
export const inventoryRouter: Router = Router();

const serviceParamsSchema = z.object({
  serviceId: z.coerce.number().int().positive(),
});

const slotParamsSchema = serviceParamsSchema.extend({
  slotId: z.coerce.number().int().positive(),
});

const blockParamsSchema = serviceParamsSchema.extend({
  blockId: z.coerce.number().int().positive(),
});

const slotsQuerySchema = z.object({
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
});

const createSlotSchema = z
  .object({
    slot_date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
    capacity: z.number().int().positive(),
  })
  .strict();

const updateSlotSchema = z
  .object({
    start_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    end_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/).optional(),
    capacity: z.number().int().positive().optional(),
  })
  .strict();

const createBlockSchema = z
  .object({
    start_datetime: z.string().datetime({ offset: true }),
    end_datetime: z.string().datetime({ offset: true }),
    type: z.enum(['mantenimiento', 'inoperacion', 'evento_privado']),
  })
  .strict();

const hoursBodySchema = z
  .object({
    hours: z
      .array(
        z.object({
          day_of_week: z.number().int().min(1).max(7),
          open_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
          close_time: z.string().regex(/^\d{2}:\d{2}(:\d{2})?$/),
          base_block_duration_hours: z.number().int().min(1).max(24).optional(),
          extra_hours_allowed: z.number().int().min(0).max(48).optional(),
        }),
      )
      .max(7),
  })
  .strict();

const writer = [requireAuth(), requireRole('prestador')];

// ---- Slots -----------------------------------------------------------------

inventoryRouter.get(
  '/services/:serviceId/slots',
  validate({ params: serviceParamsSchema, query: slotsQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof slotsQuerySchema>;
    const slots = await inventoryService.listServiceSlots(Number(req.params.serviceId), {
      from: q.from ? (parseISODate(q.from) ?? undefined) : undefined,
      to: q.to ? (parseISODate(q.to) ?? undefined) : undefined,
    });
    res.json({ data: slots });
  }),
);

inventoryRouter.post(
  '/services/:serviceId/slots',
  ...writer,
  validate({ params: serviceParamsSchema, body: createSlotSchema }),
  asyncHandler(async (req, res) => {
    const slot = await inventoryService.createSlot(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: slot });
  }),
);

inventoryRouter.put(
  '/services/:serviceId/slots/:slotId',
  ...writer,
  validate({ params: slotParamsSchema, body: updateSlotSchema }),
  asyncHandler(async (req, res) => {
    const slot = await inventoryService.updateSlot(
      Number(req.params.serviceId),
      req.user!.id,
      Number(req.params.slotId),
      req.body,
    );
    res.json({ data: slot });
  }),
);

inventoryRouter.delete(
  '/services/:serviceId/slots/:slotId',
  ...writer,
  validate({ params: slotParamsSchema }),
  asyncHandler(async (req, res) => {
    await inventoryService.deleteSlot(Number(req.params.serviceId), req.user!.id, Number(req.params.slotId));
    res.json({ data: { deleted: true } });
  }),
);

// ---- Availability blocks -------------------------------------------------------

inventoryRouter.get(
  '/services/:serviceId/blocks',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const blocks = await inventoryService.listBlocks(Number(req.params.serviceId));
    res.json({ data: blocks });
  }),
);

inventoryRouter.post(
  '/services/:serviceId/blocks',
  ...writer,
  validate({ params: serviceParamsSchema, body: createBlockSchema }),
  asyncHandler(async (req, res) => {
    const block = await inventoryService.createBlock(
      Number(req.params.serviceId),
      req.user!.id,
      req.body,
    );
    res.status(201).json({ data: block });
  }),
);

inventoryRouter.delete(
  '/services/:serviceId/blocks/:blockId',
  ...writer,
  validate({ params: blockParamsSchema }),
  asyncHandler(async (req, res) => {
    await inventoryService.deleteBlock(Number(req.params.serviceId), req.user!.id, Number(req.params.blockId));
    res.json({ data: { deleted: true } });
  }),
);

// ---- Operating hours ------------------------------------------------------------

inventoryRouter.get(
  '/services/:serviceId/hours',
  validate({ params: serviceParamsSchema }),
  asyncHandler(async (req, res) => {
    const hours = await inventoryService.getHours(Number(req.params.serviceId));
    res.json({ data: hours });
  }),
);

inventoryRouter.put(
  '/services/:serviceId/hours',
  ...writer,
  validate({ params: serviceParamsSchema, body: hoursBodySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof hoursBodySchema>;
    const result = await inventoryService.replaceHours(
      Number(req.params.serviceId),
      req.user!.id,
      body.hours,
    );
    res.json({ data: result });
  }),
);