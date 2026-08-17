import type { ErrorRequestHandler, RequestHandler } from 'express';
import { ZodError } from 'zod';
import { AppError, type ErrorBody, type ErrorResponse } from '../types/api';

/** 404 handler for unknown paths (BR-001 versioning: non-/api/v1 → 404). */
export function notFoundHandler(): RequestHandler {
  return (_req, res) => {
    const body: ErrorResponse = {
      error: {
        code: 'NOT_FOUND',
        message: 'Route not found',
      },
    };
    res.status(404).json(body);
  };
}

/**
 * Global error handler (BR-003.1–BR-003.3).
 *
 * Normalizes every thrown error into the `{ error: { code, message,
 * details? } }` envelope with the correct HTTP status:
 *   - AppError   → its own status/code
 *   - ZodError   → 400 VALIDATION_ERROR (from validate middleware)
 *   - anything   → 500 INTERNAL_ERROR (leaks no internals)
 */
export function errorHandler(): ErrorRequestHandler {
  return (err: unknown, _req, res, _next) => {
    const body = toErrorBody(err);
    if (body.code === 'INTERNAL_ERROR') {
      // eslint-disable-next-line no-console
      console.error('[error] unhandled error', err);
    }
    const status = err instanceof AppError ? err.statusCode : 500;
    res.status(status).json({ error: body } satisfies ErrorResponse);
  };
}

function toErrorBody(err: unknown): ErrorBody {
  if (err instanceof AppError) {
    return {
      code: err.code,
      message: err.message,
      ...(err.details !== undefined ? { details: err.details } : {}),
    };
  }
  if (err instanceof ZodError) {
    return {
      code: 'VALIDATION_ERROR',
      message: 'Request validation failed',
      details: err.issues.map((issue) => ({
        path: issue.path.join('.'),
        message: issue.message,
      })),
    };
  }
  return {
    code: 'INTERNAL_ERROR',
    message: 'An unexpected error occurred',
  };
}