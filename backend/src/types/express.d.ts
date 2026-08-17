import type { AuthUser } from './api';

/**
 * Express ambient augmentation (BR-002.2).
 *
 * `req.user` is populated by the JWT auth middleware on protected routes.
 * It is optional at the type level because public routes do not set it.
 * `req.rawBody` is captured by the global JSON parser (app.ts) so webhook
 * handlers can verify provider signatures byte-for-byte (BR-013.1).
 */
declare global {
  // eslint-disable-next-line @typescript-eslint/no-namespace
  namespace Express {
    interface Request {
      user?: AuthUser;
      rawBody?: Buffer;
    }
  }
}

export {};