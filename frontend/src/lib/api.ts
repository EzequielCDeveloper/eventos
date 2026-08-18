import axios, {
  AxiosError,
  type AxiosInstance,
  type AxiosRequestConfig,
  type AxiosResponse,
} from 'axios';
import { useAuthStore } from '@/stores/authStore';
import { API_BASE_URL } from './constants';
import type { ApiResponse, ErrorCode, ErrorResponse } from '@/types/api';

/**
 * Centralized API client (FR-014, D-009).
 *
 * - JWT attachment: `Authorization: Bearer <token>` on every request
 *   (FR-014.1) — read from the Zustand authStore on each request so the
 *   token is always fresh.
 * - 401 → clear session and redirect to /login (FR-014.2), except for the
 *   auth endpoints themselves (avoid redirect loops on bad credentials).
 * - 5xx → transparent retry with exponential backoff for idempotent GETs
 *   (FR-014.4).
 * - Every error is normalized to an `ApiError` with the backend
 *   `{ error: { code, message, details? } }` envelope when present.
 */

const BACKOFF_MS = 700;
const MAX_RETRIES = 2;

declare module 'axios' {
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  export interface AxiosRequestConfig {
    _retryCount?: number;
  }
}

/** Normalized application error surfaced to UI (BR-003.3). */
export class ApiError extends Error {
  readonly status: number;
  readonly code: ErrorCode;
  readonly details?: unknown;

  constructor(status: number, code: ErrorCode, message: string, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
  }

  get isUnauthorized(): boolean {
    return this.status === 401;
  }
  get isForbidden(): boolean {
    return this.status === 403;
  }
  get isNotFound(): boolean {
    return this.status === 404;
  }
  get isConflict(): boolean {
    return this.status === 409;
  }
}

function errorFromResponse(status: number, body: ErrorResponse | unknown, fallback: string): ApiError {
  const err = (body as ErrorResponse | undefined)?.error;
  return new ApiError(status, err?.code ?? 'INTERNAL_ERROR', err?.message ?? fallback, err?.details);
}

function redirect(givenPath?: string): void {
  const current = typeof window !== 'undefined' ? window.location.pathname + window.location.search : '';
  const target = givenPath ?? '/login';
  const redirect = givenPath ? '' : `?redirect=${encodeURIComponent(current)}`;
  if (typeof window !== 'undefined' && window.location.pathname !== '/login') {
    const href = `${target}${redirect}`;
    window.location.assign(href);
  }
}

let redirecting = false;

export const api: AxiosInstance = axios.create({
  baseURL: API_BASE_URL || '/api/v1',
  timeout: 20_000,
  headers: { Accept: 'application/json' },
});

// --- Request interceptor: JWT attachment (FR-014.1) -------------------------
api.interceptors.request.use((config) => {
  const token = useAuthStore.getState().accessToken;
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  config._retryCount = config._retryCount ?? 0;
  return config;
});

// --- Response interceptor: 401 redirect + 5xx backoff retry -----------------
const isAuthPath = (url?: string): boolean =>
  Boolean(url && url.includes('/auth/login'));

async function retryWithBackoff(error: AxiosError): Promise<AxiosResponse | undefined> {
  const config = error.config as AxiosRequestConfig & { _retryCount?: number } | undefined;
  if (!config) return undefined;
  const retryCount = config._retryCount ?? 0;
  const method = (config.method ?? 'get').toLowerCase();

  // Only transparently retry idempotent reads; never retry writes (a
  // payment POST must never be duplicated by the client).
  if (method !== 'get') return undefined;
  if (retryCount >= MAX_RETRIES) return undefined;
  const status = error.response?.status ?? 0;
  if (status < 500) return undefined;

  const backoff = BACKOFF_MS * 2 ** retryCount;
  config._retryCount = retryCount + 1;
  await new Promise((resolve) => setTimeout(resolve, backoff));
  return api(config);
}

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ErrorResponse>) => {
    const status = error.response?.status ?? 0;
    const url = error.config?.url;

    // Retry transient 5xx reads before giving up (FR-014.4).
    if (status >= 500 && error.config) {
      const retried = await retryWithBackoff(error);
      if (retried) return retried;
    }

    // 401 → clear session + redirect (except auth/login itself).
    if (status === 401 && !isAuthPath(url)) {
      useAuthStore.getState().logout();
      if (!redirecting) {
        redirecting = true;
        redirect();
        // redirecting resets on next navigation; harmless if stale.
        setTimeout(() => {
          redirecting = false;
        }, 4000);
      }
      return Promise.reject(
        errorFromResponse(401, error.response?.data, 'Tu sesión expiró. Inicia sesión de nuevo.'),
      );
    }

    return Promise.reject(
      errorFromResponse(
        status,
        error.response?.data,
        error.message || 'Error de red. Intenta de nuevo.',
      ),
    );
  },
);

// ---------------------------------------------------------------------------
// Typed helpers
// ---------------------------------------------------------------------------

async function unwrap<T>(request: Promise<AxiosResponse<ApiResponse<T> | T>>): Promise<T> {
  const response = await request;
  const payload = response.data as ApiResponse<T> | T;
  const hasEnvelope = typeof payload === 'object' && payload !== null && 'data' in payload;
  return (hasEnvelope ? (payload as ApiResponse<T>).data : payload) as T;
}

export function apiGet<T>(url: string, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.get<ApiResponse<T>>(url, config));
}

export function apiPost<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.post<ApiResponse<T>>(url, body, config));
}

export function apiPut<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.put<ApiResponse<T>>(url, body, config));
}

export function apiPatch<T>(url: string, body?: unknown, config?: AxiosRequestConfig): Promise<T> {
  return unwrap<T>(api.patch<ApiResponse<T>>(url, body, config));
}

export function apiDelete<T = { deleted: true }>(
  url: string,
  config?: AxiosRequestConfig,
): Promise<T> {
  return unwrap<T>(api.delete<ApiResponse<T>>(url, config));
}

/**
 * File upload helper (D-012, BR-013.6). Sends the raw file bytes with their
 * Content-Type to `POST /uploads?entity=...&entityId=...` (resolves to
 * `/api/v1/uploads` through the axios baseURL). The backend validates
 * entity/MIME/size via `saveUpload` and returns a short-lived signed URL the
 * caller embeds in messages or service photo lists.
 *
 * `entityId` is the numeric id of the owning conversation/service/contract.
 * Pass `0` when uploading provider photos before the service row exists
 * (pre-creation bucket — see OnboardingWizard step 2 vs step 3).
 */
export async function uploadFile(
  file: File,
  entity: 'conversations' | 'services' | 'contracts',
  entityId: number,
): Promise<{ url: string; expires: number }> {
  const response = await api.post<{ data: { url: string; expires: number } }>('/uploads', file, {
    headers: { 'Content-Type': file.type || 'application/octet-stream' },
    params: { entity, entityId },
    timeout: 60_000,
  });
  return response.data.data;
}

/**
 * Relocate a pre-creation upload into its final owned path, returning the
 * RAW storage path to persist (photos stored raw; the backend re-signs
 * long-lived URLs at read time) plus a fresh signed URL to render now.
 * Used after POST /services returns the real id (onboarding) and when
 * adding a photo to an existing service (ListingsTab).
 */
export async function relocateUpload(
  fromUrl: string,
  toEntity: 'services' | 'conversations' | 'contracts',
  toId: number,
): Promise<{ path: string; url: string; expires: number }> {
  return apiPost<{ path: string; url: string; expires: number }>('/uploads/relocate', {
    from_url: fromUrl,
    to_entity: toEntity,
    to_id: toId,
  });
}

// Expose the raw client for webhook-free advanced cases.
export { redirect };
export type { AxiosResponse };
