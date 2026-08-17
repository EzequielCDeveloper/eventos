import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import type { AuthResult } from '@/types/api';
import type { SafeUser, UserRole } from '@/types/models';

/**
 * Auth store (FR-013.1–FR-013.3, D-013).
 *
 * Persists the JWT access token, refresh token and user profile to
 * localStorage (`fiestaexpert-auth`). The booking flow and server state are
 * explicitly NOT persisted here (they live in React Query), per D-013.
 */
interface AuthState {
  accessToken: string | null;
  refreshToken: string | null;
  user: SafeUser | null;

  setSession: (result: AuthResult) => void;
  setUser: (user: SafeUser) => void;
  updateUser: (patch: Partial<SafeUser>) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set) => ({
      accessToken: null,
      refreshToken: null,
      user: null,

      setSession: (result) =>
        set({
          accessToken: result.tokens.accessToken,
          refreshToken: result.tokens.refreshToken,
          user: result.user,
        }),

      setUser: (user) => set({ user }),

      updateUser: (patch) =>
        set((state) => (state.user ? { user: { ...state.user, ...patch } } : state)),

      logout: () =>
        set({
          accessToken: null,
          refreshToken: null,
          user: null,
        }),
    }),
    {
      name: 'fiestaexpert-auth',
      partialize: (state) => ({
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        user: state.user,
      }),
    },
  ),
);

/** Convenience flags used by guards and layouts. */
export function useIsAuthenticated(): boolean {
  return Boolean(useAuthStore((s) => s.accessToken));
}

export function useRole(): UserRole | null {
  return useAuthStore((s) => s.user?.role ?? null);
}

export function getAccessToken(): string | null {
  return useAuthStore.getState().accessToken;
}
