import rateLimit from 'express-rate-limit';
import { env } from '../config/env';

/**
 * Rate limiting (BR-014.3, UR-008.3).
 *
 *   - authLimiter: 10 requests/minute per IP on auth endpoints
 *   - apiLimiter:  100 requests/minute per IP on the general API
 *
 * Both honor the `X-Forwarded-For` header behind an Nginx reverse proxy
 * (trust proxy is set in app.ts) and return 429 with the standard
 * Retry-After header when exhausted.
 */
export const authLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 10,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    },
  },
  // Skip limiting in tests; keep it always-on otherwise.
  skip: () => env.NODE_ENV === 'test',
});

export const apiLimiter = rateLimit({
  windowMs: 60 * 1000,
  limit: 100,
  standardHeaders: 'draft-7',
  legacyHeaders: false,
  message: {
    error: {
      code: 'RATE_LIMITED',
      message: 'Too many requests, please try again later',
    },
  },
  skip: () => env.NODE_ENV === 'test',
});