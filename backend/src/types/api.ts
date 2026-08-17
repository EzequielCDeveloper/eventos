import type { users_role, users_segment } from '@prisma/client';

/**
 * Shared API contract types (BR-001.4, BR-003.3, UR-001.1).
 */

/** Machine-readable error codes exposed to clients (BR-003.3). */
export type ErrorCode =
  | 'VALIDATION_ERROR'
  | 'RESERVATION_SLOT_CONFLICT'
  | 'PROVIDER_NOT_VERIFIED'
  | 'PAYMENT_FAILED'
  | 'STATE_TRANSITION_INVALID'
  | 'UNAUTHORIZED'
  | 'FORBIDDEN'
  | 'NOT_FOUND'
  | 'CONFLICT'
  | 'UNPROCESSABLE_ENTITY'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ErrorBody {
  code: ErrorCode;
  message: string;
  details?: unknown;
}

/** Error envelope: `{ error: { code, message, details? } }` (BR-003.1). */
export interface ErrorResponse {
  error: ErrorBody;
}

/** Success envelope: `{ data, meta?, errors? }` (BR-001.4, UR-001.1). */
export interface ApiResponse<T> {
  data: T;
  meta?: PaginationMeta;
  errors?: Array<ErrorBody>;
}

/** Pagination metadata for list endpoints (UR-001.1). */
export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  pages: number;
}

/** Pagination query parameters. */
export interface PaginationParams {
  page: number;
  limit: number;
}

/** Default pagination bounds (UR-001.1). */
export const DEFAULT_PAGE = 1;
export const DEFAULT_LIMIT = 20;
export const MAX_LIMIT = 100;

/** Parse and clamp `page`/`limit` query params. */
export function parsePagination(query: unknown): PaginationParams {
  const q = (query ?? {}) as Record<string, unknown>;
  const page = Number(q.page);
  const limit = Number(q.limit);
  return {
    page: Number.isInteger(page) && page > 0 ? page : DEFAULT_PAGE,
    limit:
      Number.isInteger(limit) && limit > 0
        ? Math.min(limit, MAX_LIMIT)
        : DEFAULT_LIMIT,
  };
}

/** Compute pages given a total and the effective limit. */
export function buildPaginationMeta(
  total: number,
  params: PaginationParams,
): PaginationMeta {
  return {
    total,
    page: params.page,
    limit: params.limit,
    pages: total === 0 ? 0 : Math.ceil(total / params.limit),
  };
}

/** Authenticated principal attached to `req.user` (BR-002.2). */
export interface AuthUser {
  id: number;
  role: users_role;
  segment: users_segment;
}

/**
 * Application-level error carrying an HTTP status and a machine-readable
 * code. Thrown by services and route handlers; normalized into the
 * `{ error: { code, message, details? } }` envelope by the error handler
 * (BR-003.1–BR-003.3).
 *
 * Also carries an optional `expose` flag: internal errors never leak
 * details to clients.
 */
export class AppError extends Error {
  readonly statusCode: number;
  readonly code: ErrorCode;
  readonly details?: unknown;
  readonly expose: boolean;

  constructor(params: {
    statusCode: number;
    code: ErrorCode;
    message: string;
    details?: unknown;
    expose?: boolean;
  }) {
    super(params.message);
    this.name = 'AppError';
    this.statusCode = params.statusCode;
    this.code = params.code;
    this.details = params.details;
    this.expose = params.expose ?? true;
  }

  static unauthorized(message = 'Authentication required'): AppError {
    return new AppError({ statusCode: 401, code: 'UNAUTHORIZED', message });
  }

  static forbidden(message = 'Insufficient permissions'): AppError {
    return new AppError({ statusCode: 403, code: 'FORBIDDEN', message });
  }

  static notFound(message = 'Resource not found'): AppError {
    return new AppError({ statusCode: 404, code: 'NOT_FOUND', message });
  }

  static conflict(message: string, details?: unknown): AppError {
    return new AppError({ statusCode: 409, code: 'CONFLICT', message, details });
  }

  static reservationSlotConflict(message: string, details?: unknown): AppError {
    return new AppError({
      statusCode: 409,
      code: 'RESERVATION_SLOT_CONFLICT',
      message,
      details,
    });
  }

  static providerNotVerified(message = 'Provider identity is not verified'): AppError {
    return new AppError({ statusCode: 422, code: 'PROVIDER_NOT_VERIFIED', message });
  }

  static paymentFailed(message: string, details?: unknown): AppError {
    return new AppError({ statusCode: 402, code: 'PAYMENT_FAILED', message, details });
  }

  static stateTransitionInvalid(message: string, details?: unknown): AppError {
    return new AppError({
      statusCode: 409,
      code: 'STATE_TRANSITION_INVALID',
      message,
      details,
    });
  }
}