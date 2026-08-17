import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { ServiceType } from '@/types/models';

/**
 * UI store (FR-013.1, D-013).
 *
 * Keeps light, non-server UI preferences + ephemeral connection/badge
 * state. Persisted subset: category filter + desktop sidebar collapse.
 * The rest (notification badge count, connection state) is in-memory only.
 */
type CategoryFilter = ServiceType | 'todos';

interface UiState {
  /** Secondary nav category on Inicio (Salones/Sonidos/Servicios). */
  activeCategory: CategoryFilter;
  /** Desktop admin/provider sidebar collapsed state. */
  sidebarCollapsed: boolean;
  /** Unread in-app notification count (badge on navigation). */
  unreadNotifications: number;
  /** Socket connection status exposed to a banner/toast. */
  socketConnected: boolean;

  setCategory: (category: CategoryFilter) => void;
  toggleSidebar: () => void;
  setSidebarCollapsed: (collapsed: boolean) => void;
  setUnreadNotifications: (count: number) => void;
  incrementUnread: () => void;
  decrementUnread: (n?: number) => void;
  clearUnread: () => void;
  setSocketConnected: (connected: boolean) => void;
}

export const useUiStore = create<UiState>()(
  persist(
    (set) => ({
      activeCategory: 'todos',
      sidebarCollapsed: false,
      unreadNotifications: 0,
      socketConnected: false,

      setCategory: (activeCategory) => set({ activeCategory }),
      toggleSidebar: () => set((s) => ({ sidebarCollapsed: !s.sidebarCollapsed })),
      setSidebarCollapsed: (sidebarCollapsed) => set({ sidebarCollapsed }),
      setUnreadNotifications: (unreadNotifications) => set({ unreadNotifications }),
      incrementUnread: () => set((s) => ({ unreadNotifications: s.unreadNotifications + 1 })),
      decrementUnread: (n = 1) =>
        set((s) => ({ unreadNotifications: Math.max(0, s.unreadNotifications - n) })),
      clearUnread: () => set({ unreadNotifications: 0 }),
      setSocketConnected: (socketConnected) => set({ socketConnected }),
    }),
    {
      name: 'fiestaexpert-ui',
      partialize: (state) => ({
        activeCategory: state.activeCategory,
        sidebarCollapsed: state.sidebarCollapsed,
      }),
    },
  ),
);
