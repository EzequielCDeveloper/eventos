import { createHmac, timingSafeEqual, randomUUID } from 'node:crypto';
import { copyFile, mkdir, rename, stat, unlink, writeFile } from 'node:fs/promises';
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

// ---- Long-lived photo URLs (Work Unit C: TTL follow-up) ---------------------
//
// service_photos.url stores the RAW storage path (no signed query) so the
// backend can re-sign a FRESH URL on every read with a long TTL. Persisting an
// expiring signed URL (the upload response default 1h) would make listing
// photos 403 after expiry; re-signing at read/serve time removes that class of
// bug entirely (onboarding used the pre-creation `services/0` bucket, see
// `POST /uploads/relocate`).

/** How long a handed-out signed photo URL stays valid (refreshed on every read). */
export const PHOTO_URL_TTL_SECONDS = 30 * 24 * 3600; // 30 days

/**
 * Reduce a possibly-signed `/uploads/...` (or bare `/...`) URL to the raw
 * storage path that `signUrl` signs (`/services/42/<uuid>.jpg`). Safe for
 * rows written before this fix (which stored the full signed URL).
 */
export function rawPathOf(url: string): string {
  try {
    const pathname = new URL(url, 'http://local').pathname;
    return pathname.startsWith('/uploads') ? pathname.slice('/uploads'.length) : pathname;
  } catch {
    return url;
  }
}

/**
 * Re-sign a photo's stored raw path with a long-lived URL for the current
 * read. Accepts either a raw path or a (possibly expired) signed URL.
 */
export function signedPhotoUrl(url: string): string {
  return signUrl(rawPathOf(url), PHOTO_URL_TTL_SECONDS).url;
}

/**
 * Relocate a file from the pre-creation bucket (`/<entity>/0/<file>`) into its
 * final owned path (`/<entity>/<toId>/<file>`) and return both the raw path
 * (to persist) and a fresh signed URL (to render immediately).
 *
 * Guards: the source must be a currently-valid signed URL, and its path must
 * live under `/<entity>/0/` — this endpoint is only for the onboarding
 * "upload before the row exists" flow, never arbitrary file moves.
 */
export async function relocateUpload(input: {
  fromUrl: string;
  toEntity: 'services' | 'conversations' | 'contracts';
  toId: number;
}): Promise<{ path: string; url: string; expires: number }> {
  if (!ENTITY_ALLOWLIST.has(input.toEntity)) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Upload entity must be one of: ${[...ENTITY_ALLOWLIST].join(', ')}`,
    });
  }
  if (!verifySignedUrl(input.fromUrl)) {
    throw new AppError({
      statusCode: 403,
      code: 'FORBIDDEN',
      message: 'Source signed URL is missing, expired or invalid (BR-013.6)',
    });
  }
  const fromPath = rawPathOf(input.fromUrl);
  const fileMatch = /^\/([^/]+)\/0\/([^/]+)$/.exec(fromPath);
  if (!fileMatch) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: 'Only files in the pre-creation bucket (<entity>/0/<file>) can be relocated',
    });
  }
  const [, fromEntity, fileName] = fileMatch;
  if (fromEntity !== input.toEntity) {
    throw new AppError({
      statusCode: 400,
      code: 'VALIDATION_ERROR',
      message: `Relocation must stay within the same entity (got ${fromEntity})`,
    });
  }
  const toPath = `/${input.toEntity}/${input.toId}/${fileName}`;
  const fromDisk = path.join(env.UPLOAD_DIR, fromPath.replace(/^\/+/, ''));
  const toDisk = path.join(env.UPLOAD_DIR, input.toEntity, String(input.toId), fileName);

  await mkdir(path.dirname(toDisk), { recursive: true });
  let moved = false;
  try {
    await rename(fromDisk, toDisk);
    moved = true;
  } catch {
    // Cross-device move (`rename` fails across mounts) → copy + unlink.
    try {
      await copyFile(fromDisk, toDisk);
      await unlink(fromDisk);
      moved = true;
    } catch {
      moved = false;
    }
  }
  if (!moved) {
    throw new AppError({
      statusCode: 404,
      code: 'NOT_FOUND',
      message: 'Source upload file not found',
    });
  }
  const { url, expires } = signUrl(toPath);
  return { path: toPath, url, expires };
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