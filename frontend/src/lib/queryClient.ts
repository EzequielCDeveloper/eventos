import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './api';

/**
 * TanStack Query client (D-009, FR-013.4).
 *
 * - Default `staleTime` avoids redundant refetches for the active feature.
 * - `retry` policy: server/network errors are retried twice with the
 *   client's backoff for reads; 4xx are never retried (they are real
 *   errors, e.g. 404/422).
 */
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 60_000,
      gcTime: 5 * 60_000,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && error.status < 500 && error.status >= 400) {
          return false;
        }
        return failureCount < 2;
      },
      refetchOnWindowFocus: false,
    },
    mutations: {
      retry: 0,
    },
  },
});
