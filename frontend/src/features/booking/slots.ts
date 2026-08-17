import { useQuery } from '@tanstack/react-query';
import { api, apiGet, apiPost } from '@/lib/api';
import type { ApiResponse, SlotAvailabilityRow } from '@/types/api';

/**
 * Slot availability (FR-005.6). Default window: from today to +60 days.
 */
export function useServiceSlots(serviceId: number | string | undefined, from?: string) {
  return useQuery({
    queryKey: ['services', 'slots', String(serviceId), from ?? 'default'],
    queryFn: async () => {
      const windowStart = from ?? new Date().toISOString().slice(0, 10);
      const windowEnd = new Date(new Date(`${windowStart}T12:00:00`).getTime() + 60 * 24 * 3600 * 1000)
        .toISOString()
        .slice(0, 10);
      const response = await api.get<ApiResponse<SlotAvailabilityRow[]>>(`/services/${serviceId}/slots`, {
        params: { from: windowStart, to: windowEnd },
      });
      return response.data.data.filter((slot) => slot.status_indicator !== 'lleno');
    },
    enabled: Boolean(serviceId),
    staleTime: 30_000,
  });
}

/** Reviews of a service (public, GET /services/:id/reviews). */
export interface ServiceReview extends Record<string, unknown> {
  id: number;
  rating: number;
  comment: string | null;
  created_at: string;
  client?: { id: number; full_name: string };
}

export function useServiceReviews(serviceId: number | string | undefined) {
  return useQuery({
    queryKey: ['services', 'reviews', String(serviceId)],
    queryFn: () => apiGet<ServiceReview[]>(`/services/${serviceId}/reviews`),
    enabled: Boolean(serviceId),
  });
}

/** Open a conversation with the service provider (BR-008.3). */
export async function openConversation(input: {
  clientId: number;
  providerId: number;
  serviceId: number;
}): Promise<{ id: number }> {
  return apiPost<{ id: number }>('/conversations', {
    client_id: input.clientId,
    provider_id: input.providerId,
    service_id: input.serviceId,
  });
}
