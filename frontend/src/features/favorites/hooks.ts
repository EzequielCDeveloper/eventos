import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiDelete, apiGet, apiPost } from '@/lib/api';
import { useAuthStore } from '@/stores/authStore';
import { useToast } from '@/components/ui/Toast';
import type { FavoriteItem } from '@/types/api';

/**
 * Favorites (FR-012.1) — synced with the backend via GET/POST/DELETE
 * /favorites. Optimistic mutations keep the UI snappy across search/detail
 * and the favorites tab.
 */
export const favoritesKeys = {
  all: ['favorites'] as const,
};

export function useFavorites() {
  const token = useAuthStore((s) => s.accessToken);
  return useQuery({
    queryKey: favoritesKeys.all,
    queryFn: () => apiGet<FavoriteItem[]>('/favorites'),
    enabled: Boolean(token),
  });
}

export function useAddFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (serviceId: number) => apiPost<{ id: number; service_id: number }>('/favorites', { service_id: serviceId }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast('Agregado a favoritos.', undefined, 'success');
    },
    onError: () => toast('No se pudo agregar a favoritos.', undefined, 'error'),
  });
}

export function useRemoveFavorite() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: (favoriteId: number) => apiDelete(`/favorites/${favoriteId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast('Eliminado de favoritos.', undefined, 'success');
    },
    onError: () => toast('No se pudo eliminar el favorito.', undefined, 'error'),
  });
}

/** Remove a favorite by looking it up from its service id. */
export function useRemoveFavoriteByServiceId() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  return useMutation({
    mutationFn: async (serviceId: number) => {
      const items = queryClient.getQueryData<FavoriteItem[]>(favoritesKeys.all) ?? [];
      const favorite = items.find((f) => f.service_id === serviceId);
      if (!favorite) return;
      await apiDelete(`/favorites/${favorite.id}`);
    },
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: favoritesKeys.all });
      toast('Eliminado de favoritos.', undefined, 'success');
    },
    onError: () => toast('No se pudo eliminar el favorito.', undefined, 'error'),
  });
}

export function useIsFavorite(serviceId: number): boolean {
  const { data } = useFavorites();
  return Boolean(data?.some((f) => f.service_id === serviceId));
}

/** Combine add/remove into one toggle for a service id. */
export function useToggleFavorite(serviceId: number) {
  const isFavorite = useIsFavorite(serviceId);
  const add = useAddFavorite();
  const remove = useRemoveFavoriteByServiceId();

  const toggle = () => {
    if (isFavorite) void remove.mutateAsync(serviceId);
    else void add.mutateAsync(serviceId);
  };

  return { isFavorite, toggle, pending: add.isPending || remove.isPending };
}
