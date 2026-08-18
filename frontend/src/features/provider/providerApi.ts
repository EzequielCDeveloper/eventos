import { apiDelete, apiGet, apiPost, apiPut } from '@/lib/api';
import type {
  AvailabilityBlock,
  CancellationPolicy,
  CancellationPolicyPatch,
  CreateBlockBody,
  CreateDynamicRuleBody,
  DynamicPriceRule,
  MonthlyReport,
  ProviderServiceSummary,
  ReservationDetail,
  ServiceDetail,
  SlotAvailabilityRow,
} from '@/types/api';
import type { AvailabilityBlockType } from '@/types/models';

/**
 * Provider-facing API helpers (FR-002, FR-011).
 *
 * Wired strictly to endpoints that exist in backend/src/routes/v1/* — we
 * never invent endpoints:
 *   - GET  /services/me              (own services, all statuses — FR-011.7)
 *   - GET  /services/:id             (public detail — includes drafts, owner-only intent)
 *   - GET  /services/:id/slots       (availability via v_slot_availability)
 *   - GET  /services/:id/blocks + POST/DELETE
 *   - GET  /services/:id/dynamic-rules + POST/DELETE
 *   - POST/DELETE /services/:id/photos + PUT /services/:id/photos/reorder
 *   - GET/PUT /users/me/cancellation-policy (FR-011.7)
 *   - GET  /reservations?status=     (actor-scoped — provider sees their own)
 *   - GET  /payments/reports/monthly (per-provider tax report, BR-006.8)
 */
export const providerKeys = {
  detail: (id: number | string) => ['services', 'detail', String(id)] as const,
  slots: (id: number | string, from?: string, to?: string) =>
    ['services', 'slots', String(id), from ?? '', to ?? ''] as const,
  blocks: (id: number | string) => ['services', 'blocks', String(id)] as const,
  rules: (id: number | string) => ['services', 'dynamic-rules', String(id)] as const,
  myServices: () => ['services', 'me'] as const,
  photos: (id: number | string) => ['services', 'photos', String(id)] as const,
  cancellationPolicy: () => ['users', 'me', 'cancellation-policy'] as const,
  reservations: (status?: ReservationDetail['status']) =>
    ['reservations', 'provider', status ?? 'all'] as const,
  report: (year: number, month: number) => ['provider', 'report', year, month] as const,
};

/**
 * The provider's own services (GET /services/me) — primary source for the
 * provider dashboard. All statuses incl. drafts, newest first.
 */
export function fetchMyServices(): Promise<ProviderServiceSummary[]> {
  return apiGet<ProviderServiceSummary[]>('/services/me');
}

export function fetchService(id: number | string): Promise<ServiceDetail> {
  return apiGet<ServiceDetail>(`/services/${String(id)}`);
}

export function fetchSlots(
  id: number | string,
  range?: { from?: string; to?: string },
): Promise<SlotAvailabilityRow[]> {
  const params = new URLSearchParams();
  if (range?.from) params.set('from', range.from);
  if (range?.to) params.set('to', range.to);
  const qs = params.toString();
  return apiGet<SlotAvailabilityRow[]>(`/services/${String(id)}/slots${qs ? `?${qs}` : ''}`);
}

export function fetchBlocks(id: number | string): Promise<AvailabilityBlock[]> {
  return apiGet<AvailabilityBlock[]>(`/services/${String(id)}/blocks`);
}

export function createBlock(id: number | string, body: CreateBlockBody): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/services/${String(id)}/blocks`, body);
}

export function deleteBlock(id: number | string, blockId: number): Promise<{ deleted: true }> {
  return apiDelete<{ deleted: true }>(`/services/${String(id)}/blocks/${blockId}`);
}

export function fetchDynamicRules(id: number | string): Promise<DynamicPriceRule[]> {
  return apiGet<DynamicPriceRule[]>(`/services/${String(id)}/dynamic-rules`);
}

export function createDynamicRule(
  id: number | string,
  body: CreateDynamicRuleBody,
): Promise<{ id: number }> {
  return apiPost<{ id: number }>(`/services/${String(id)}/dynamic-rules`, body);
}

export function deleteDynamicRule(
  id: number | string,
  ruleId: number,
): Promise<{ deleted: true }> {
  return apiDelete<{ deleted: true }>(`/services/${String(id)}/dynamic-rules/${ruleId}`);
}

// ---- Service photos (FR-011.7) ----------------------------------------------
// `addServicePhoto` stores the RAW storage path (work-unit C TTL fix): the
// caller uploads via uploadFile → relocateUpload, then passes `path` here.

export interface ServicePhoto {
  id: number;
  url: string;
  position: number;
  status: string;
  created_at: string;
}

export interface ServicePhotoAddResult extends ServicePhoto {}

/** All photos of the provider's own service (any moderation status, FR-011.7). */
export function fetchServicePhotos(id: number | string): Promise<ServicePhoto[]> {
  return apiGet<ServicePhoto[]>(`/services/${String(id)}/photos`);
}

export function addServicePhoto(
  id: number | string,
  url: string,
  position?: number,
): Promise<ServicePhotoAddResult> {
  return apiPost<ServicePhotoAddResult>(`/services/${String(id)}/photos`, {
    url,
    ...(position !== undefined ? { position } : {}),
  });
}

export function deleteServicePhoto(
  id: number | string,
  photoId: number,
): Promise<{ deleted: true }> {
  return apiDelete<{ deleted: true }>(`/services/${String(id)}/photos/${photoId}`);
}

/** `positions` lists photo ids in the desired order (array index = position). */
export function reorderServicePhotos(
  id: number | string,
  positions: number[],
): Promise<Array<{ id: number; position: number }>> {
  return apiPut<Array<{ id: number; position: number }>>(`/services/${String(id)}/photos/reorder`, {
    positions,
  });
}

// ---- Provider cancellation policy (FR-011.7) --------------------------------

export function fetchCancellationPolicy(): Promise<CancellationPolicy> {
  return apiGet<CancellationPolicy>('/users/me/cancellation-policy');
}

export function updateCancellationPolicy(
  patch: CancellationPolicyPatch,
): Promise<CancellationPolicy> {
  return apiPut<CancellationPolicy>('/users/me/cancellation-policy', patch);
}

/**
 * Provider reservations (backend scopes by actor: provider sees reservations
 * whose items belong to them). Status filter optional.
 */
export function fetchProviderReservations(
  status?: ReservationDetail['status'],
): Promise<ReservationDetail[]> {
  return apiGet<ReservationDetail[]>(
    `/reservations${status ? `?status=${status}` : ''}`,
  );
}

/** Per-provider monthly tax report (BR-006.8). */
export function fetchMonthlyReport(year: number, month: number): Promise<MonthlyReport> {
  return apiGet<MonthlyReport>(`/payments/reports/monthly?year=${year}&month=${month}`);
}

export type { AvailabilityBlockType };
