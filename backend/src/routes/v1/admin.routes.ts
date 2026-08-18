import { Router } from 'express';
import { Prisma } from '@prisma/client';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import { prisma } from '../../config/database';
import { AppError } from '../../types/api';
import { toISOStringOrNull } from '../../utils/datetime';
import { toMoney } from '../../services/reservation.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Admin endpoints (BR-002.4, UR-002.14) mounted under `/api/v1/admin`.
 *
 * Gated to exactly the 5 admin functions:
 *   1. Stats            — GET  /admin/stats
 *   2. Commission       — GET/PUT /admin/commission
 *   3. Technical disputes — GET/POST /admin/disputes, POST /admin/disputes/:id/resolve
 *   4. Moderation       — GET /admin/moderation, POST /admin/moderation/:id/action
 *   5. Provider mgmt    — GET /admin/providers, POST /admin/providers/:id/block,
 *                         POST /admin/providers/:id/unblock (documented extras
 *                         completing the BR-002.4 function set)
 *
 * Every route is gated with `requireAuth()` + `requireRole('administrador')`
 * (BR-002.4: non-admins receive 403; admins cannot reach non-admin routes —
 * those live on other routers).
 */
export const adminRouter: Router = Router();

adminRouter.use(requireAuth(), requireRole('administrador'));

/**
 * Fallback commission rate when no `commission_settings` row exists yet.
 * Mirrors the seed default (10.00% — BR-006.2, `prisma/seed.ts`); the latest
 * row governs new reservations (D-007).
 */
const DEFAULT_COMMISSION_RATE = 10;

const idParamsSchema = z.object({ id: z.coerce.number().int().positive() });

const commissionSchema = z
  .object({ commission_rate: z.number().min(0.01).max(100) })
  .strict();

const disputeQuerySchema = z.object({
  status: z.enum(['abierta', 'resuelta']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const createDisputeSchema = z
  .object({
    reservation_id: z.number().int().positive(),
    type: z.enum(['tecnica']).default('tecnica'),
  })
  .strict();

const resolveDisputeSchema = z
  .object({ resolution: z.string().min(1).max(2000) })
  .strict();

const moderationQuerySchema = z.object({
  status: z.enum(['pendiente', 'resuelto']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const moderationActionSchema = z
  .object({ action: z.enum(['aprobar', 'advertir', 'eliminar']) })
  .strict();

const providerQuerySchema = z.object({
  verified: z.enum(['true', 'false']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const blockProviderSchema = z
  .object({ reason: z.string().min(1).max(500) })
  .strict();

function paginate(query: unknown) {
  const q = (query ?? {}) as Record<string, unknown>;
  const page = Number(q.page);
  const limit = Number(q.limit);
  return {
    page: Number.isInteger(page) && page > 0 ? page : 1,
    limit: Number.isInteger(limit) && limit > 0 ? Math.min(limit, 100) : 20,
  };
}

/** Read `_count`._all from a Prisma groupBy row (typing workaround). */
function countAll(row: { _count: unknown }): number {
  const count = row._count as { _all?: number } | number;
  return typeof count === 'number' ? count : (count._all ?? 0);
}

/** GET /admin/stats — aggregate counters across the platform (BR-002.4 #3). */
adminRouter.get(
  '/stats',
  asyncHandler(async (_req, res) => {
    const [
      userCount,
      providersVerified,
      servicesByStatus,
      reservationsByStatus,
      paymentAggregate,
      openDisputes,
      pendingModeration,
      activeProviders,
    ] = await prisma.$transaction([
      prisma.users.count(),
      prisma.users.count({ where: { role: 'prestador', verified: true } }),
      prisma.services.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.reservations.groupBy({ by: ['status'], _count: { _all: true }, orderBy: { status: 'asc' } }),
      prisma.payments.aggregate({
        where: { status: { in: ['procesado', 'retenido', 'reembolsado'] } },
        _count: { _all: true },
        _sum: { amount: true },
      }),
      prisma.technical_disputes.count({ where: { status: 'abierta' } }),
      prisma.content_reports.count({ where: { status: 'pendiente' } }),
      prisma.users.count({ where: { role: 'prestador' } }),
    ]);

    const serviceStatus = Object.fromEntries(
      servicesByStatus.map((row) => [row.status, countAll(row)]),
    );
    const reservationStatus = Object.fromEntries(
      reservationsByStatus.map((row) => [row.status, countAll(row)]),
    );

    res.json({
      data: {
        users: { total: userCount, providers: activeProviders, providers_verified: providersVerified },
        services: { total: servicesByStatus.reduce((sum, row) => sum + countAll(row), 0), by_status: serviceStatus },
        reservations: {
          total: reservationsByStatus.reduce((sum, row) => sum + countAll(row), 0),
          by_status: reservationStatus,
        },
        payments: {
          processed: paymentAggregate._count._all,
          total_amount: toMoney(paymentAggregate._sum.amount),
        },
        moderation: { pending_reports: pendingModeration },
        disputes: { open: openDisputes },
      },
    });
  }),
);

/**
 * GET /admin/commission — read the current global commission rate (BR-002.4
 * #5). The latest `commission_settings` row governs new reservations
 * (D-007); when none exists yet the seed default (10.00%) is returned.
 * `commission_rate` is returned as a number (the PUT response keeps the
 * two-decimal money string it always returned).
 */
adminRouter.get(
  '/commission',
  asyncHandler(async (_req, res) => {
    const settings = await prisma.commission_settings.findFirst({
      orderBy: [{ changed_at: 'desc' }, { id: 'desc' }],
    });
    res.json({
      data: settings
        ? {
            // `commission_settings` timestamps rows with `changed_at`.
            commission_rate: Number(settings.commission_rate),
            changed_by: settings.changed_by,
            created_at: settings.changed_at.toISOString(),
          }
        : { commission_rate: DEFAULT_COMMISSION_RATE },
    });
  }),
);

/**
 * PUT /admin/commission — update the global commission rate (BR-002.4 #5).
 * A new `commission_settings` row is inserted with the admin as `changed_by`;
 * the latest row governs NEW reservations (D-007 — existing prices frozen).
 */
adminRouter.put(
  '/commission',
  validate({ body: commissionSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof commissionSchema>;
    const settings = await prisma.commission_settings.create({
      data: {
        commission_rate: new Prisma.Decimal(body.commission_rate),
        changed_by: req.user!.id,
      },
    });
    res.json({
      data: {
        id: settings.id,
        commission_rate: toMoney(settings.commission_rate),
        changed_by: settings.changed_by,
        changed_at: settings.changed_at.toISOString(),
      },
    });
  }),
);

// ---- Technical disputes (BR-002.4 #4) ---------------------------------------

/** GET /admin/disputes — list technical disputes (?status=abierta|resuelta). */
adminRouter.get(
  '/disputes',
  validate({ query: disputeQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof disputeQuerySchema>;
    const p = paginate(req.query);
    const where = { ...(q.status ? { status: q.status } : {}) };
    const [rows, total] = await prisma.$transaction([
      prisma.technical_disputes.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
        include: {
          users: { select: { id: true, full_name: true } },
          reservations: { select: { id: true, event_date: true, status: true, total_price: true } },
        },
      }),
      prisma.technical_disputes.count({ where }),
    ]);
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        reservation_id: row.reservation_id,
        type: row.type,
        status: row.status,
        resolution: row.resolution,
        reported_by: row.reported_by,
        reporter: row.users,
        reservation: {
          ...row.reservations,
          total_price: toMoney(row.reservations.total_price),
          event_date: toISOStringOrNull(row.reservations.event_date)?.slice(0, 10),
        },
        created_at: row.created_at.toISOString(),
        resolved_at: toISOStringOrNull(row.resolved_at),
      })),
      meta: { total, page: p.page, limit: p.limit, pages: total === 0 ? 0 : Math.ceil(total / p.limit) },
    });
  }),
);

/** POST /admin/disputes — open a technical dispute for a reservation (admin-entered). */
adminRouter.post(
  '/disputes',
  validate({ body: createDisputeSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createDisputeSchema>;
    const reservation = await prisma.reservations.findUnique({
      where: { id: body.reservation_id },
      select: { id: true },
    });
    if (!reservation) throw AppError.notFound('Reservation not found');
    const dispute = await prisma.technical_disputes.create({
      data: {
        reservation_id: body.reservation_id,
        reported_by: req.user!.id,
        type: body.type,
      },
    });
    res.status(201).json({
      data: {
        id: dispute.id,
        reservation_id: dispute.reservation_id,
        type: dispute.type,
        status: dispute.status,
        created_at: dispute.created_at.toISOString(),
      },
    });
  }),
);

/** POST /admin/disputes/:id/resolve — resolve a dispute (documented extra). */
adminRouter.post(
  '/disputes/:id/resolve',
  validate({ params: idParamsSchema, body: resolveDisputeSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof resolveDisputeSchema>;
    const dispute = await prisma.technical_disputes.findUnique({ where: { id: Number(req.params.id) } });
    if (!dispute) throw AppError.notFound('Dispute not found');
    const updated = await prisma.technical_disputes.update({
      where: { id: dispute.id },
      data: { status: 'resuelta', resolution: body.resolution, resolved_at: new Date() },
    });
    res.json({
      data: {
        id: updated.id,
        status: updated.status,
        resolution: updated.resolution,
        resolved_at: toISOStringOrNull(updated.resolved_at),
      },
    });
  }),
);

// ---- Moderation (BR-002.4 #1) ----------------------------------------------

/** GET /admin/moderation — pending/handled content reports (?status=). */
adminRouter.get(
  '/moderation',
  validate({ query: moderationQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof moderationQuerySchema>;
    const p = paginate(req.query);
    const where = { ...(q.status ? { status: q.status } : {}) };
    const [rows, total] = await prisma.$transaction([
      prisma.content_reports.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
        include: {
          users_content_reports_reported_byTousers: { select: { id: true, full_name: true } },
          services: { select: { id: true, title: true, service_type: true, status: true } },
        },
      }),
      prisma.content_reports.count({ where }),
    ]);
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        service_id: row.service_id,
        reported_by: row.reported_by,
        reporter: row.users_content_reports_reported_byTousers,
        service: row.services,
        reason: row.reason,
        status: row.status,
        action: row.action,
        handled_by: row.handled_by,
        handled_at: toISOStringOrNull(row.handled_at),
        created_at: row.created_at.toISOString(),
      })),
      meta: { total, page: p.page, limit: p.limit, pages: total === 0 ? 0 : Math.ceil(total / p.limit) },
    });
  }),
);

/**
 * POST /admin/moderation/:id/action — handle a content report (BR-002.4 #1).
 * `eliminar` soft-deletes the reported service so it stops being listed;
 * `aprobar`/`advertir` only record the decision on the report.
 */
adminRouter.post(
  '/moderation/:id/action',
  validate({ params: idParamsSchema, body: moderationActionSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof moderationActionSchema>;
    const report = await prisma.content_reports.findUnique({ where: { id: Number(req.params.id) } });
    if (!report) throw AppError.notFound('Content report not found');
    if (body.action === 'eliminar') {
      await prisma.services.update({
        where: { id: report.service_id },
        data: { deleted_at: new Date(), updated_at: new Date() },
      });
    }
    const updated = await prisma.content_reports.update({
      where: { id: report.id },
      data: {
        status: 'resuelto',
        action: body.action,
        handled_by: req.user!.id,
        handled_at: new Date(),
      },
    });
    res.json({
      data: {
        id: updated.id,
        service_id: updated.service_id,
        status: updated.status,
        action: updated.action,
        handled_by: updated.handled_by,
        handled_at: toISOStringOrNull(updated.handled_at),
      },
    });
  }),
);

// ---- Provider management (BR-002.4 #2, documented extras) -------------------

/** GET /admin/providers — providers with verification + block state. */
adminRouter.get(
  '/providers',
  validate({ query: providerQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof providerQuerySchema>;
    const p = paginate(req.query);
    const where = {
      role: 'prestador' as const,
      ...(q.verified ? { verified: q.verified === 'true' } : {}),
    };
    const [rows, total] = await prisma.$transaction([
      prisma.users.findMany({
        where,
        orderBy: { created_at: 'desc' },
        skip: (p.page - 1) * p.limit,
        take: p.limit,
        select: {
          id: true,
          full_name: true,
          email: true,
          phone: true,
          verified: true,
          segment: true,
          created_at: true,
          deleted_at: true,
          provider_blocks_provider_blocks_provider_idTousers: {
            where: { unblocked_at: null },
            select: { id: true, reason: true, blocked_at: true },
            take: 1,
          },
          _count: { select: { services: true, reviews_reviews_provider_idTousers: true } },
        },
      }),
      prisma.users.count({ where }),
    ]);
    res.json({
      data: rows.map((row) => ({
        id: row.id,
        full_name: row.full_name,
        email: row.email,
        phone: row.phone,
        verified: row.verified,
        segment: row.segment,
        deleted_at: toISOStringOrNull(row.deleted_at),
        created_at: row.created_at.toISOString(),
        active_block: row.provider_blocks_provider_blocks_provider_idTousers[0] ?? null,
        stats: { services: row._count.services, reviews: row._count.reviews_reviews_provider_idTousers },
      })),
      meta: { total, page: p.page, limit: p.limit, pages: total === 0 ? 0 : Math.ceil(total / p.limit) },
    });
  }),
);

/** POST /admin/providers/:id/block — block a provider (moderation power). */
adminRouter.post(
  '/providers/:id/block',
  validate({ params: idParamsSchema, body: blockProviderSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof blockProviderSchema>;
    const provider = await prisma.users.findUnique({ where: { id: Number(req.params.id) } });
    if (!provider || provider.role !== 'prestador') {
      throw AppError.notFound('Provider not found');
    }
    const activeBlock = await prisma.provider_blocks.findFirst({
      where: { provider_id: provider.id, unblocked_at: null },
    });
    if (activeBlock) throw AppError.conflict('Provider is already blocked');
    const block = await prisma.provider_blocks.create({
      data: { provider_id: provider.id, reason: body.reason, handled_by: req.user!.id },
    });
    res.status(201).json({
      data: {
        id: block.id,
        provider_id: block.provider_id,
        reason: block.reason,
        blocked_at: block.blocked_at.toISOString(),
      },
    });
  }),
);

/** POST /admin/providers/:id/unblock — lift the active block. */
adminRouter.post(
  '/providers/:id/unblock',
  validate({ params: idParamsSchema }),
  asyncHandler(async (req, res) => {
    const activeBlock = await prisma.provider_blocks.findFirst({
      where: { provider_id: Number(req.params.id), unblocked_at: null },
    });
    if (!activeBlock) throw AppError.notFound('Provider is not currently blocked');
    const updated = await prisma.provider_blocks.update({
      where: { id: activeBlock.id },
      data: { unblocked_at: new Date() },
    });
    res.json({
      data: {
        id: updated.id,
        provider_id: updated.provider_id,
        unblocked_at: toISOStringOrNull(updated.unblocked_at),
      },
    });
  }),
);