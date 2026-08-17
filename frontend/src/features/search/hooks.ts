import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServiceType } from '@/types/models';
import type { SearchSort } from '@/types/api';

/**
 * Search filter store (FR-004.2) — filters persist across navigation via
 * localStorage (D-013: only light UI/feature prefs are persisted; queries
 * themselves still run server-side).
 */
export interface SearchFiltersState {
  serviceType: ServiceType | '';
  date: string; // YYYY-MM-DD or ''
  capacity: number | '';
  zone: string;
  minPrice: number | '';
  maxPrice: number | '';
  eventTypeName: string;
  pool: boolean;
  internet: boolean;
  rating: number | '';
  sort: SearchSort;
}

const EMPTY_FILTERS: SearchFiltersState = {
  serviceType: '',
  date: '',
  capacity: '',
  zone: '',
  minPrice: '',
  maxPrice: '',
  eventTypeName: '',
  pool: false,
  internet: false,
  rating: '',
  sort: 'created:desc',
};

interface SearchFilterState {
  filters: SearchFiltersState;
  setFilter: <K extends keyof SearchFiltersState>(key: K, value: SearchFiltersState[K]) => void;
  setMany: (patch: Partial<SearchFiltersState>) => void;
  reset: () => void;
}

export const useFiltersStore = create<SearchFilterState>()(
  persist(
    (set) => ({
      filters: EMPTY_FILTERS,
      setFilter: (key, value) =>
        set((state) => ({ filters: { ...state.filters, [key]: value } })),
      setMany: (patch) => set((state) => ({ filters: { ...state.filters, ...patch } })),
      reset: () => set({ filters: EMPTY_FILTERS }),
    }),
    { name: 'fiestaexpert-search' },
  ),
);

/** True when any filter beyond the default is active (drives UI chips). */
export function anyActiveFilter(f: SearchFiltersState): boolean {
  return (
    f.serviceType !== '' ||
    f.date !== '' ||
    f.capacity !== '' ||
    f.zone.trim() !== '' ||
    f.minPrice !== '' ||
    f.maxPrice !== '' ||
    f.eventTypeName !== '' ||
    f.pool ||
    f.internet ||
    f.rating !== '' ||
    f.sort !== 'created:desc'
  );
}

/** Recommended event types for the filter (backend matches event_type_name). */
export const EVENT_TYPE_SUGGESTIONS = [
  'Boda',
  'XV Años',
  'Cumpleaños',
  'Aniversario',
  'Bautizo',
  'Empresarial',
  'Concierto',
  'Fiesta Infantil',
];
