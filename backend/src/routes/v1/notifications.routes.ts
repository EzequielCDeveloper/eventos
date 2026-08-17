import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import * as notificationService from '../../services/notification.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Notification inbox endpoints (UR-002.11, BR-009.3) mounted under
 * `/api/v1/notifications`.
 *
 *   GET /notifications            — inbox list (?status=pendiente|enviada|leida)
 *   GET /notifications/unread     — unread count (documented extra, badge)
 *   PUT /notifications/:id/read   — mark one notification as read
 */
export const notificationsRouter: Router = Router();

notificationsRouter.use(requireAuth());

const notificationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const listQuerySchema = z.object({
  status: z.enum(['pendiente', 'enviada', 'leida']).optional(),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

/** GET /notifications — the user's inbox (UR-002.11). */
notificationsRouter.get(
  '/',
  validate({ query: listQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof listQuerySchema>;
    const result = await notificationService.listNotifications(req.user!.id, {
      status: q.status,
      page: q.page,
      limit: q.limit,
    });
    res.json({ data: result.items, meta: result.meta });
  }),
);

/**
 * GET /notifications/unread — unread count (documented extra; FR-008 badge).
 * Registered BEFORE `/:id/read` so the literal `unread` is not captured
 * as a notification id.
 */
notificationsRouter.get(
  '/unread',
  asyncHandler(async (req, res) => {
    const count = await notificationService.countUnread(req.user!.id);
    res.json({ data: { unread: count } });
  }),
);

/** PUT /notifications/:id/read — mark as read (UR-002.11). */
notificationsRouter.put(
  '/:id/read',
  validate({ params: notificationParamsSchema }),
  asyncHandler(async (req, res) => {
    const notification = await notificationService.markNotificationRead(
      Number(req.params.id),
      req.user!.id,
    );
    res.json({ data: notification });
  }),
);