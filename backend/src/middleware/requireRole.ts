import type { RequestHandler } from 'express';
import type { users_role } from '@prisma/client';
import { AppError } from '../types/api';

export type AllowedRole = users_role;

/**
 * Role-based access control factory (BR-002.3, BR-002.4).
 *
 * `requireRole('prestador')` / `requireRole('administrador')` guard a
 * route to exactly those roles. Non-matching authenticated users receive
 * 403 FORBIDDEN. Must run AFTER `requireAuth()`.
 */
export function requireRole(...roles: AllowedRole[]): RequestHandler {
  return (req, _res, next) => {
    const user = req.user;
    if (!user) {
      return next(AppError.unauthorized());
    }
    if (!roles.includes(user.role)) {
      return next(
        AppError.forbidden(`Role '${user.role}' is not allowed on this endpoint`),
      );
    }
    return next();
  };
}