import { Router, raw } from 'express';
import type { IncomingMessage } from 'node:http';
import { z } from 'zod';
import { requireAuth } from '../../middleware/auth';
import { validate } from '../../middleware/validate';
import { asyncHandler } from '../../utils/asyncHandler';
import {
  ENTITY_ALLOWLIST,
  relocateUpload,
  saveUpload,
  signUrl,
} from '../../services/storage.service';
import { AppError } from '../../types/api';

/**
 * Signed file upload endpoint (BR-013.6, D-012, UR-009.4).
 *
 *   POST /api/v1/uploads?entity=<services|conversations|contracts>&entityId=<n>
 *   Content-Type: image/jpeg | image/png | image/webp | audio/mpeg | audio/ogg | audio/webm
 *   Body: the raw file bytes directly (no multipart). `entity` + `entityId`
 *   travel as query params because the body is the file itself.
 *
 * `requireAuth` is scoped here — every uploader is an authenticated user.
 * The file bytes are buffered in memory with `express.raw`, then `saveUpload`
 * validates entity/MIME/size (D-012) and writes the file to `UPLOAD_DIR`.
 * The response carries a short-lived signed URL (BR-013.6) that the client
 * embeds in chat messages or service photo lists.
 *
 * `entityId` is a non-negative integer. `0` is the documented pre-creation
 * bucket used by the provider onboarding wizard, which uploads service photos
 * in step 2 before the service row exists (it is created on step 3). Chat
 * voice notes pass the real conversation id.
 *
 * The request body is capped at 12MB by the parser; `saveUpload` enforces the
 * authoritative per-type limits (5MB images / 10MB voice) and rejects
 * oversized files with a 400 VALIDATION_ERROR.
 */
export const uploadsRouter: Router = Router();

uploadsRouter.use(requireAuth());

const uploadQuerySchema = z
  .object({
    entity: z.enum([...ENTITY_ALLOWLIST] as [string, ...string[]], {
      errorMap: () => ({ message: `entity must be one of: ${[...ENTITY_ALLOWLIST].join(', ')}` }),
    }),
    entityId: z.coerce.number().int().min(0, 'entityId must be a non-negative integer'),
  })
  .strict();

const relocateSchema = z
  .object({
    from_url: z.string().min(1).max(800),
    to_entity: z.enum([...ENTITY_ALLOWLIST] as [string, ...string[]], {
      errorMap: () => ({ message: `to_entity must be one of: ${[...ENTITY_ALLOWLIST].join(', ')}` }),
    }),
    to_id: z.number().int().positive(),
  })
  .strict();

const UPLOAD_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/webp',
  'audio/mpeg',
  'audio/ogg',
  'audio/webm',
]);

/** Content-Type with any `; charset=...` / `; codecs=...` parameters stripped. */
function requestMimeType(req: IncomingMessage): string {
  return String(req.headers['content-type'] ?? '').split(';')[0].trim().toLowerCase();
}

/** POST /uploads — store a file and return its short-lived signed URL. */
uploadsRouter.post(
  '/uploads',
  raw({
    // Only buffer known upload MIME types as raw bytes; anything else (e.g.
    // multipart, JSON) falls through to the handler and is rejected there.
    type: (req: IncomingMessage): boolean => UPLOAD_MIME_TYPES.has(requestMimeType(req)),
    limit: '12mb',
  }),
  validate({ query: uploadQuerySchema }),
  asyncHandler(async (req, res) => {
    const query = req.query as unknown as z.infer<typeof uploadQuerySchema>;
    const mimeType = requestMimeType(req);

    if (!Buffer.isBuffer(req.body)) {
      throw new AppError({
        statusCode: 400,
        code: 'VALIDATION_ERROR',
        message: `Request body must be the raw file bytes (received: ${mimeType || 'no Content-Type'})`,
      });
    }

    const saved = await saveUpload({
      entity: query.entity,
      entityId: query.entityId,
      mimeType,
      data: req.body,
    });

    const { url, expires } = signUrl(saved.urlPath);
    res.status(201).json({ data: { url, expires } });
  }),
);

/**
 * POST /uploads/relocate — move a pre-creation upload (`<entity>/0/<file>`)
 * into its final owned path and re-sign it (work-unit C: onboarding photo
 * TTL). The onboarding wizard uploads service photos before the service row
 * exists (`entityId=0`); once `POST /services` returns the real id this route
 * migrates each file to `/services/<id>/<file>` and returns the raw storage
 * path to persist plus a fresh signed URL to render. The persisted photos pay
 * NO query string — the backend re-signs long-lived URLs on every read.
 */
uploadsRouter.post(
  '/uploads/relocate',
  validate({ body: relocateSchema }),
  asyncHandler(async (req, res) => {
    const body = req.body as z.infer<typeof relocateSchema>;
    const relocated = await relocateUpload({
      fromUrl: body.from_url,
      toEntity: body.to_entity as 'services' | 'conversations' | 'contracts',
      toId: body.to_id,
    });
    res.json({ data: relocated });
  }),
);
