import { apiGet, apiPost, apiPut } from '@/lib/api';
import type {
  AdminCommission,
  AdminCommissionUpdate,
  AdminProvider,
  AdminStats,
  BlockProviderBody,
  CreateDisputeBody,
  Dispute,
  ModerationActionBody,
  ModerationReport,
  PaginationMeta,
  ResolveDisputeBody,
  SetCommissionBody,
} from '@/types/api';

/**
 * Admin API helpers (FR-003, BR-002.4) — strictly the real `/admin/*` routes
 * from backend admin.routes.ts. Every call carries the `administrador` role
 * (enforced server-side with requireRole).
 */
export const adminKeys = {
  stats: ['admin', 'stats'] as const,
  moderation: (status?: string, page?: number) =>
    ['admin', 'moderation', status ?? 'all', page ?? 1] as const,
  providers: (verified?: string, page?: number) =>
    ['admin', 'providers', verified ?? 'all', page ?? 1] as const,
  disputes: (status?: string, page?: number) =>
    ['admin', 'disputes', status ?? 'all', page ?? 1] as const,
  commission: ['admin', 'commission'] as const,
};

export interface ListResult<T> {
  items: T[];
  meta: PaginationMeta | undefined;
}

export function fetchAdminStats(): Promise<AdminStats> {
  return apiGet<AdminStats>('/admin/stats');
}

export function fetchModeration(
  params: { status?: 'pendiente' | 'resuelto'; page?: number; limit?: number } = {},
): Promise<ListResult<ModerationReport>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<ListResult<ModerationReport>>(`/admin/moderation${q ? `?${q}` : ''}`);
}

export function moderationAction(
  reportId: number,
  body: ModerationActionBody,
): Promise<unknown> {
  return apiPost(`/admin/moderation/${reportId}/action`, body);
}

export function fetchAdminProviders(
  params: { verified?: 'true' | 'false'; page?: number; limit?: number } = {},
): Promise<ListResult<AdminProvider>> {
  const qs = new URLSearchParams();
  if (params.verified) qs.set('verified', params.verified);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<ListResult<AdminProvider>>(`/admin/providers${q ? `?${q}` : ''}`);
}

export function blockProvider(providerId: number, body: BlockProviderBody): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/admin/providers/${providerId}/block`, body);
}

export function unblockProvider(providerId: number): Promise<{ id: number; unblocked_at: string | null }> {
  return apiPost<{ id: number; unblocked_at: string | null }>(`/admin/providers/${providerId}/unblock`);
}

export function fetchDisputes(
  params: { status?: 'abierta' | 'resuelta'; page?: number; limit?: number } = {},
): Promise<ListResult<Dispute>> {
  const qs = new URLSearchParams();
  if (params.status) qs.set('status', params.status);
  if (params.page) qs.set('page', String(params.page));
  if (params.limit) qs.set('limit', String(params.limit));
  const q = qs.toString();
  return apiGet<ListResult<Dispute>>(`/admin/disputes${q ? `?${q}` : ''}`);
}

export function openDispute(body: CreateDisputeBody): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/admin/disputes', body);
}

export function resolveDispute(disputeId: number, body: ResolveDisputeBody): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/admin/disputes/${disputeId}/resolve`, body);
}

/** Current global commission rate (GET /admin/commission — latest row, seed 10%). */
export function fetchCommission(): Promise<AdminCommission> {
  return apiGet<AdminCommission>('/admin/commission');
}

export function setCommission(body: SetCommissionBody): Promise<AdminCommissionUpdate> {
  return apiPut<AdminCommissionUpdate>('/admin/commission', body);
}
