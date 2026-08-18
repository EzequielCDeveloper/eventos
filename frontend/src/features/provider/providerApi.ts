import { apiDelete, apiGet, apiPost } from '@/lib/api';
import type {
  AvailabilityBlock,
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
