import type { RequestHandler } from 'express';
import jwt from 'jsonwebtoken';
import type { users_role, users_segment } from '@prisma/client';
import { prisma } from '../config/database';
import { env } from '../config/env';
import { AppError, type AuthUser } from '../types/api';

export interface JwtPayload {
  /** User id (sub) */
  sub: string;
  role: users_role;
  segment: users_segment;
}

/**
 * JWT verification middleware (BR-002.1–BR-002.3, BR-002.6).
 *
 * Reads `Authorization: Bearer <token>`, verifies signature and expiry,
 * loads the user from the database, and rejects soft-deleted users
 * (`deleted_at` set — BR-002.6). On success `req.user = { id, role,
 * segment }` (BR-002.2). Returns 401 otherwise.
 */
export function requireAuth(): RequestHandler {
  return async (req, _res, next) => {
    try {
      const header = req.headers.authorization;
      if (!header?.startsWith('Bearer ')) {
        throw AppError.unauthorized('Missing Bearer token');
      }

      const token = header.slice('Bearer '.length).trim();
      let payload: JwtPayload;
      try {
        payload = jwt.verify(token, env.JWT_SECRET) as JwtPayload;
      } catch {
        throw AppError.unauthorized('Invalid or expired token');
      }

      const userId = Number(payload.sub);
      if (!Number.isInteger(userId) || userId <= 0) {
        throw AppError.unauthorized('Invalid token subject');
      }

      const user = await prisma.users.findUnique({
        where: { id: userId },
        select: { id: true, role: true, segment: true, deleted_at: true },
      });

      // Soft-deleted users must not authenticate (BR-002.6, ARCO).
      if (!user || user.deleted_at) {
        throw AppError.unauthorized('Account is inactive');
      }

      req.user = {
        id: user.id,
        role: user.role,
        segment: user.segment,
      } satisfies AuthUser;

      next();
    } catch (error) {
      next(error);
    }
  };
}