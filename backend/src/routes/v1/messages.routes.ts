import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { requireRole } from '../../middleware/requireRole';
import { validate } from '../../middleware/validate';
import * as messageService from '../../services/message.service';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Messaging endpoints (UR-002.10, BR-008) mounted under `/api/v1`.
 *
 *   GET  /conversations                  — the user's threads + unread counts
 *   POST /conversations                  — get-or-create a thread (documented
 *                                          extra: chat is started from the
 *                                          service detail, BR-008 flow)
 *   GET  /conversations/:id/messages     — thread history (?after=<id>,
 *                                          ?page=&limit=, D-006 catch-up)
 *   POST /conversations/:id/messages     — send a text/voice-note message
 *   PUT  /conversations/:id/read         — mark incoming messages read
 *   GET  /messages/search?q=             — full-text search (BR-008.6)
 *   GET/POST /quick-replies              — provider quick replies (BR-008.4)
 *   PUT/DELETE /quick-replies/:id        — edit/remove a quick reply
 */
export const messagesRouter: Router = Router();

messagesRouter.use(requireAuth());

const conversationParamsSchema = z.object({
  id: z.coerce.number().int().positive(),
});

const createConversationSchema = z
  .object({
    client_id: z.number().int().positive(),
    provider_id: z.number().int().positive(),
    service_id: z.number().int().positive().nullable().optional(),
  })
  .strict();

const sendMessageSchema = z
  .object({
    type: z.enum(['texto', 'nota_voz']).default('texto'),
    content: z.string().max(5000).optional(),
    audio_url: z.string().url().max(500).optional(),
    duration_seconds: z.number().int().min(1).max(120).optional(),
  })
  .strict();

const searchQuerySchema = z.object({
  q: z.string().min(1).max(200),
  page: z.coerce.number().int().positive().optional(),
  limit: z.coerce.number().int().positive().max(100).optional(),
});

const quickReplySchema = z
  .object({ name: z.string().min(1).max(100), content: z.string().min(1).max(2000) })
  .strict();

const quickReplyPatchSchema = z
  .object({
    name: z.string().min(1).max(100).optional(),
    content: z.string().min(1).max(2000).optional(),
  })
  .strict();

/** GET /conversations — the user's threads (UR-002.10). */
messagesRouter.get(
  '/conversations',
  asyncHandler(async (req, res) => {
    const result = await messageService.listConversations(req.user!, {
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
    });
    res.json({ data: result.items, meta: result.meta });
  }),
);

/** POST /conversations — get-or-create the unique thread (BR-008.3). */
messagesRouter.post(
  '/conversations',
  validate({ body: createConversationSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof createConversationSchema>;
    const conversation = await messageService.getOrCreateConversation({
      actor: req.user!,
      clientId: body.client_id,
      providerId: body.provider_id,
      serviceId: body.service_id ?? null,
    });
    res.status(201).json({ data: conversation });
  }),
);

/** GET /conversations/:id/messages — thread history with optional `after` cursor. */
messagesRouter.get(
  '/conversations/:id/messages',
  validate({ params: conversationParamsSchema }),
  asyncHandler(async (req, res) => {
    const result = await messageService.listMessages(Number(req.params.id), req.user!, {
      after: req.query.after ? Number(req.query.after) : undefined,
      page: Number(req.query.page) || undefined,
      limit: Number(req.query.limit) || undefined,
    });
    res.json({ data: result.items, meta: result.meta });
  }),
);

/** POST /conversations/:id/messages — send a message (voice notes ≤120s enforced). */
messagesRouter.post(
  '/conversations/:id/messages',
  validate({ params: conversationParamsSchema, body: sendMessageSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof sendMessageSchema>;
    const message = await messageService.sendMessage({
      conversationId: Number(req.params.id),
      sender: req.user!,
      type: body.type,
      content: body.content ?? null,
      audioUrl: body.audio_url ?? null,
      durationSeconds: body.duration_seconds ?? null,
    });
    res.status(201).json({ data: message });
  }),
);

/** PUT /conversations/:id/read — mark incoming messages as read (BR-008.1). */
messagesRouter.put(
  '/conversations/:id/read',
  validate({ params: conversationParamsSchema }),
  asyncHandler(async (req, res) => {
    const result = await messageService.markConversationRead(Number(req.params.id), req.user!);
    res.json({ data: result });
  }),
);

/** GET /messages/search?q= — search inside the user's conversations (BR-008.6). */
messagesRouter.get(
  '/messages/search',
  validate({ query: searchQuerySchema }),
  asyncHandler(async (req, res) => {
    const q = req.query as unknown as z.infer<typeof searchQuerySchema>;
    const result = await messageService.searchMessages(req.user!, {
      q: q.q,
      page: q.page,
      limit: q.limit,
    });
    res.json({ data: result.items, meta: result.meta });
  }),
);

// ---- Quick replies (provider only, BR-008.4) -------------------------------

messagesRouter.get(
  '/quick-replies',
  requireRole('prestador'),
  asyncHandler(async (req, res) => {
    const items = await messageService.listQuickReplies(req.user!.id);
    res.json({ data: items });
  }),
);

messagesRouter.post(
  '/quick-replies',
  requireRole('prestador'),
  validate({ body: quickReplySchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof quickReplySchema>;
    const item = await messageService.createQuickReply(req.user!.id, body);
    res.status(201).json({ data: item });
  }),
);

messagesRouter.put(
  '/quick-replies/:id',
  requireRole('prestador'),
  validate({ params: conversationParamsSchema, body: quickReplyPatchSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof quickReplyPatchSchema>;
    const item = await messageService.updateQuickReply(req.user!.id, Number(req.params.id), body);
    res.json({ data: item });
  }),
);

messagesRouter.delete(
  '/quick-replies/:id',
  requireRole('prestador'),
  validate({ params: conversationParamsSchema }),
  asyncHandler(async (req, res) => {
    await messageService.deleteQuickReply(req.user!.id, Number(req.params.id));
    res.status(204).send();
  }),
);