import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { mkdir, writeFile, stat } from 'node:fs/promises';
import path from 'node:path';
import type { RequestHandler } from 'express';
import { env } from '../config/env';
import { AppError } from '../types/api';

/**
 * Local disk storage + signed URLs (D-004, D-012, BR-013.6, UR-012).
 *
 * Files are stored at `{UPLOAD_DIR}/{entity}/{entityId}/{uuid}.{ext}` and
 * served by Nginx under `/uploads/` in production (secure_link-module
 * validation, configured in the S8 deployment slice — D-004 reference:
 *
 *   location /uploads/ {
 *       alias /data/uploads/;
 *       # secure_link $arg_token,$arg_expires;   # HMAC validation
 *       # secure_link_md5 "$secure_link_expires$uri <SIGNED_URL_SECRET>";
 *   }
 *
 * Until Nginx ships, an Express guard middleware (`createUploadsGuard`)
 * validates the same signed URLs in development so private files behave
 * identically (BR-013.6: access without a valid signed token → 403).
 *
 * Signed URL flow (D-004):
 *   `signUrl('/services/42/photo.jpg', ttl)` →
 *   `/uploads/services/42/photo.jpg?token=<hmac-hex>&expires=<epoch-seconds>`
 *   token = HMAC-SHA256(SIGNED_URL_SECRET, `${path}.${expires}`)
 *
 * Allowed types (D-012): images jpeg/png/webp ≤5MB, voice audio mpeg/ogg/webm
 * ≤10MB (120s of audio; webm is the MediaRecorder default in Chromium).
 */

export const ENTITY_ALLOWLIST = new Set(['services', 'conversations', 'contracts']);

const ALLOWED_MIME: Record<string, { ext: string; maxBytes: number; kind: string }> = {
  'image/jpeg': { ext: 'jpg', maxBytes: 5 * 1024 * 1024, kind: 'photo' },
  'image/png': { ext: 'png', maxBytes: 5 * 1024 * 1024, kind: 'photo' },
  'image/webp': { ext: 'webp', maxBytes: 5 * 1024 * 1024, kind: 'photo' },
  'audio/mpeg': { ext: 'mp3', maxBytes: 10 * 1024 * 1024, kind: 'voice_note' },
  'audio/ogg': { ext: 'ogg', maxBytes: 10 * 1024 * 1024, kind: 'voice_note' },
  // MediaRecorder's default output in Chromium; without it the voice-note
  // upload route (UR-009.4) rejects every real recording (D-012 extension).
  'audio/webm': { ext: 'webm', maxBytes: 10 * 1024 * 1024, kind: 'voice_note' },
};

export interface SavedUpload {
  diskPath: string;
  urlPath: string; // e.g. /services/42/<uuid>.jpg — used inside /uploads/
  size: number;
  mimeType: string;
  kind: string;
}

export interface SaveUploadInput {
  entity: string;
  entityId: number;
  mimeType: string;
  data: Buffer;
}

/**
 * Validate + store an upload on local disk (D-012). Returns the absolute
 * disk path and the public URL path (signed via `signUrl` by the caller).
 */
export async function saveUpload(input: SaveUploadInput): Promise<SavedUpload> {
  if (!ENTITY_ALLOWLIST.has(input.entity)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Upload entity must be one of: ${[...ENTITY_ALLOWLIST].join(', ')}`,
    });
  }
  const rule = ALLOWED_MIME[input.mimeType];
  if (!rule) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Unsupported content type '${input.mimeType}' (D-012)`,
      details: { allowed: Object.keys(ALLOWED_MIME) },
    });
  }
  if (input.data.length === 0) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Uploaded file is empty',
    });
  }
  if (input.data.length > rule.maxBytes) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `File exceeds the ${Math.round(rule.maxBytes / 1024 / 1024)}MB limit for ${rule.kind}s (D-012)`,
    });
  }

  // Random name — user-supplied filenames are never used verbatim, which
  // removes path traversal and collision risk.
  const fileName = `${randomUUID()}.${rule.ext}`;
  const urlPath = `/${input.entity}/${input.entityId}/${fileName}`;
  const diskPath = path.join(env.UPLOAD_DIR, input.entity, String(input.entityId), fileName);

  await mkdir(path.dirname(diskPath), { recursive: true });
  await writeFile(diskPath, input.data, { flag: 'wx' });

  return {
    diskPath,
    urlPath,
    size: input.data.length,
    mimeType: input.mimeType,
    kind: rule.kind,
  };
}

// ---- Signed URLs (D-004) ----------------------------------------------------

function signToken(urlPath: string, expires: number): string {
  return createHmac('sha256', env.SIGNED_URL_SECRET)
    .update(`${urlPath}.${expires}`)
    .digest('hex');
}

/** Build a signed URL for a stored file with `ttlSeconds` validity (default 1h). */
export function signUrl(urlPath: string, ttlSeconds = 3600): { url: string; expires: number } {
  const expires = Math.floor(Date.now() / 1000) + ttlSeconds;
  const token = signToken(urlPath, expires);
  return { url: `/uploads${urlPath}?token=${token}&expires=${expires}`, expires };
}

/** Validate a signed URL: expiry not passed + HMAC token matches (constant-time). */
export function verifySignedUrl(currentUrl: string): boolean {
  let parsed: URL;
  try {
    parsed = new URL(currentUrl, 'http://local');
  } catch {
    return false;
  }
  // `signUrl` signs the storage path WITHOUT the `/uploads` serving prefix;
  // strip it here so the token recomputation matches byte-for-byte.
  const urlPath = parsed.pathname.startsWith('/uploads')
    ? parsed.pathname.slice('/uploads'.length)
    : parsed.pathname;
  const token = parsed.searchParams.get('token') ?? '';
  const expires = Number(parsed.searchParams.get('expires') ?? 0);
  if (!Number.isFinite(expires) || expires < Math.floor(Date.now() / 1000)) return false;
  const expected = signToken(urlPath, expires);
  const a = Buffer.from(expected);
  const b = Buffer.from(token);
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

/** Resolve a `/uploads/...` request path to disk, staying inside UPLOAD_DIR. */
export function resolveUploadDiskPath(urlPath: string): string | null {
  const root = path.resolve(env.UPLOAD_DIR);
  const target = path.resolve(root, urlPath.replace(/^\/+/, ''));
  if (target !== root && !target.startsWith(`${root}${path.sep}`)) return null;
  return target;
}

/**
 * Express guard for `/uploads/*` in development: validates the signed URL
 * before serving the file from disk (BR-013.6 — no token → 403). In
 * production Nginx performs the equivalent check (D-004 reference above).
 */
export function createUploadsGuard(): RequestHandler {
  return async (req, res) => {
    try {
      if (!verifySignedUrl(req.originalUrl)) {
        res.status(403).json({
          error: {
            code: 'FORBIDDEN',
            message: 'Signed URL is missing, expired or invalid (BR-013.6)',
          },
        });
        return;
      }
      const diskPath = resolveUploadDiskPath(req.path);
      if (!diskPath) {
        res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
        return;
      }
      // 404 when the file does not exist on disk.
      await stat(diskPath);
      res.sendFile(diskPath);
    } catch {
      res.status(404).json({ error: { code: 'NOT_FOUND', message: 'File not found' } });
    }
  };
}