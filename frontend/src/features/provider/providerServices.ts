import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { fetchMyServices } from './providerApi';

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
