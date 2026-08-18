import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { useEffect, useMemo } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useAuthStore } from '@/stores/authStore';
import { fetchMyServices, providerKeys } from './providerApi';

/**
 * Registry of services created by the logged-in provider (FR-011.7).
 *
 * The backend now exposes GET /services/me (backend/src/routes/v1/
 * services.routes.ts), so this store is a CACHE of the provider's service
 * ids, not the source of truth:
 *   1. `refreshFromBackend()` hydrates the ids from GET /services/me
 *      (primary source — includes all statuses incl. drafts).
 *   2. `add`/`remove` keep the cache warm right after POST /services
 *      (onboarding) and DELETE /services/:id so the dashboard is instant
 *      even before the backend query returns.
 *   3. Detail rows are fetched per id via the public GET /services/:id.
 */
interface ProviderServicesState {
  ids: number[];
  add: (id: number) => void;
  remove: (id: number) => void;
  setIds: (ids: number[]) => void;
  clear: () => void;
  /** Hydrate the cache from GET /services/me (backend source of truth). */
  refreshFromBackend: () => Promise<void>;
}

export const useProviderServicesStore = create<ProviderServicesState>()(
  persist(
    (set) => ({
      ids: [],
      add: (id) =>
        set((state) => (state.ids.includes(id) ? state : { ids: [...state.ids, id] })),
      remove: (id) => set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
      setIds: (ids) => set({ ids: [...new Set(ids)] }),
      clear: () => set({ ids: [] }),
      refreshFromBackend: async () => {
        const services = await fetchMyServices();
        set({ ids: services.map((s) => s.id) });
      },
    }),
    {
      name: 'fiestaexpert-provider-services',
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);

/**
 * Authoritative provider service-id list (FR-011.7): the backend
 * GET /services/me is the primary source; the persisted registry keeps the
 * dashboard instant while the backend query is in flight (and survives
 * offline/reload). Union keeps both — the registry never hides a backend row.
 *
 * `refreshFromBackend` is invoked here to keep the persisted cache warm, so
 * the dashboard reflects new listings right after onboarding publishes.
 */
export function useProviderServiceIds(): { ids: number[]; isLoading: boolean } {
  const localIds = useProviderServicesStore((s) => s.ids);
  const setIds = useProviderServicesStore((s) => s.setIds);
  const token = useAuthStore((s) => s.accessToken);

  const query = useQuery({
    queryKey: providerKeys.myServices(),
    queryFn: fetchMyServices,
    enabled: Boolean(token),
  });

  useEffect(() => {
    if (query.data) setIds(query.data.map((s) => s.id));
  }, [query.data, setIds]);

  const ids = useMemo(() => {
    const backend = (query.data ?? []).map((s) => s.id);
    return Array.from(new Set([...backend, ...localIds]));
  }, [query.data, localIds]);

  return { ids, isLoading: query.isLoading && ids.length === 0 };
}
