import { useQuery } from '@tanstack/react-query';
import { api, apiGet } from '@/lib/api';
import type {
  ApiResponse,
  PaginationMeta,
  ServiceDetail,
  ServiceQueryParams,
  ServiceSummary,
} from '@/types/api';
import type { SearchFiltersState } from './hooks';

export { useFiltersStore, anyActiveFilter, EVENT_TYPE_SUGGESTIONS } from './hooks';
export type { SearchFiltersState } from './hooks';

/** Build actual backend query params from the persisted filter state. */
export function buildQueryParams(filters: SearchFiltersState): ServiceQueryParams {
  const params: ServiceQueryParams = {};
  if (filters.serviceType) params.service_type = filters.serviceType;
  if (filters.date) params.date = filters.date;
  if (filters.capacity !== '') params.capacity = Number(filters.capacity);
  if (filters.zone.trim()) params.zone = filters.zone.trim();
  if (filters.minPrice !== '') params.min_price = Number(filters.minPrice);
  if (filters.maxPrice !== '') params.max_price = Number(filters.maxPrice);
  if (filters.eventTypeName) params.event_type_name = filters.eventTypeName;
  if (filters.pool) params.pool = 'true';
  if (filters.internet) params.internet = 'true';
  if (filters.rating !== '') params.rating = Number(filters.rating);
  params.sort = filters.sort;
  params.page = 1;
  params.limit = 20;
  return params;
}

export interface SearchQueryResult {
  items: ServiceSummary[];
  meta?: PaginationMeta;
}

/**
 * useSearch (FR-004.1, FR-013.4): server-side search via GET /services with
 * the 8+ filter dimensions; the free-text query is applied client-side over
 * title/description (mirrors the mockup, which has no q= endpoint).
 */
export function useSearch(filters: SearchFiltersState, freeText: string) {
  return useQuery({
    queryKey: ['services', 'search', filters, freeText.trim()],
    queryFn: async (): Promise<SearchQueryResult> => {
      const response = await api.get<ApiResponse<ServiceSummary[]>>('/services', {
        params: buildQueryParams(filters),
      });
      let items = response.data.data;
      const q = freeText.trim().toLowerCase();
      if (q) {
        items = items.filter((s) =>
          `${s.title} ${s.description ?? ''}`.toLowerCase().includes(q),
        );
      }
      return { items, meta: response.data.meta };
    },
  });
}

/** Fetch a single service detail (FR-005). */
export function useServiceDetail(serviceId: number | string | undefined) {
  const enabled = serviceId !== undefined && String(serviceId).trim() !== '';
  return useQuery({
    queryKey: ['services', 'detail', String(serviceId)],
    queryFn: () => apiGet<ServiceDetail>(`/services/${String(serviceId)}`),
    enabled,
  });
}
