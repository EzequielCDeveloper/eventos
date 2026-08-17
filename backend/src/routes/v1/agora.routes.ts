import { Router } from 'express';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { generateRtcToken } from '../../integrations/agora';
import { asyncHandler } from '../../utils/asyncHandler';

/**
 * Agora voice/video token endpoint (UR-009.2, D-005, task 9.5).
 *
 *   GET /api/v1/agora/token?channel=<conversationId>&uid=<optional>&role=<publisher|subscriber>
 *
 * Mounted under `/api/v1` with `requireAuth` scoped here (every caller is an
 * authenticated user). Returns `{ data: { appId, token, channel, uid,
 * expiry } }` so the frontend can join the channel with `agora-rtc-sdk-ng`.
 *
 * Token generation is local and never starts a call — it does not bill
 * minutes and never touches the Agora network.
 */
export const agoraRouter: Router = Router();

agoraRouter.use(requireAuth());

const agoraQuerySchema = z
  .object({
    channel: z
      .string()
      .min(1, 'channel is required')
      .max(64, 'channel must be at most 64 characters'),
    uid: z.coerce
      .number()
      .int()
      .min(0)
      .max(2 ** 32 - 1)
      .optional(),
    role: z.enum(['publisher', 'subscriber']).optional().default('publisher'),
  })
  .strict();

/** GET /agora/token — mint an RTC token for a channel (UR-009.2). */
agoraRouter.get(
  '/agora/token',
  validate({ query: agoraQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof agoraQuerySchema>;
    const token = generateRtcToken({
      channel: query.channel,
      uid: query.uid,
      role: query.role,
    });
    res.json({ data: token });
  }),
);
