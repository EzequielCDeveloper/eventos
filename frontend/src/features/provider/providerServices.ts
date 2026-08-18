import { create } from 'zustand';
import { persist } from 'zustand/middleware';

/**
 * Registry of services created by the logged-in provider (FR-011.7).
 *
 * The backend has no "GET /services?provider=me" endpoint yet (S7 gap noted
 * for S8), so the provider dashboard derives its own services from:
 *   1. IDs persisted here right after a successful POST /services
 *      (the onboarding wizard), and
 *   2. detail fetches of those IDs via the public GET /services/:id.
 *
 * This keeps every wire call on real routes without inventing endpoints.
 */
interface ProviderServicesState {
  ids: number[];
  add: (id: number) => void;
  remove: (id: number) => void;
  clear: () => void;
}

export const useProviderServicesStore = create<ProviderServicesState>()(
  persist(
    (set) => ({
      ids: [],
      add: (id) =>
        set((state) => (state.ids.includes(id) ? state : { ids: [...state.ids, id] })),
      remove: (id) => set((state) => ({ ids: state.ids.filter((x) => x !== id) })),
      clear: () => set({ ids: [] }),
    }),
    {
      name: 'fiestaexpert-provider-services',
      partialize: (state) => ({ ids: state.ids }),
    },
  ),
);
