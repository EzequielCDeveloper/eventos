import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiGet, apiPut } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import type { NotificationPayload, UnreadCountResponse } from '@/types/api';

/**
 * Notification queries (FR-008.1–FR-008.5). The unread badge is mirrored
 * to the sockets of auth; the query keys are shared by the center and the
 * layout badge.
 */
export const notificationsKeys = {
  all: ['notifications'] as const,
  list: (status?: string) => ['notifications', 'list', status ?? 'all'] as const,
  unread: ['notifications', 'unread'] as const,
};

/** List the inbox (optionally filtered by status). */
export function useNotifications(status?: 'pendiente' | 'enviada' | 'leida') {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: notificationsKeys.list(status),
    queryFn: () =>
      apiGet<NotificationPayload[]>(
        `/notifications${status ? `?status=${status}` : ''}`,
        // Don't throw immediately for guests: the hook is only used inside
        // protected pages, but keep it defensible.
      ),
    enabled: Boolean(token),
  });
}

/** Unread count used by the badge on navigation (FR-008.3). */
export function useUnreadNotifications() {
  const token = useAuthStore((s) => s.accessToken);
  const query = useQuery({
    queryKey: notificationsKeys.unread,
    queryFn: async () => {
      const data = await apiGet<UnreadCountResponse>('/notifications/unread');
      return data.unread;
    },
    enabled: Boolean(token),
    refetchInterval: 60_000,
  });
  return query.data ?? 0;
}

export function useMarkNotificationRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (id: number) => apiPut<NotificationPayload>(`/notifications/${id}/read`),
    onSuccess: (_, id) => {
      queryClient.setQueryData<NotificationPayload[]>(notificationsKeys.list(), (current) =>
        (current ?? []).map((n) => (n.id === id ? { ...n, status: 'leida' as const, read_at: new Date().toISOString() } : n)),
      );
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.unread });
    },
  });
}

/** Mark every notification read (client-side loop over the inbox). */
export function useMarkAllNotificationsRead() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (ids: number[]) => {
      await Promise.all(ids.map((id) => apiPut(`/notifications/${id}/read`)));
      return true;
    },
    onSuccess: () => {
      queryClient.setQueryData<NotificationPayload[]>(notificationsKeys.list(), (current) =>
        (current ?? []).map((n) => ({ ...n, status: 'leida' as const, read_at: new Date().toISOString() })),
      );
      void queryClient.invalidateQueries({ queryKey: notificationsKeys.unread });
    },
  });
}
