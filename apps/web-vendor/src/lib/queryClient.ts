/**
 * React Query client for the Grovio vendor panel.
 *
 * Default retry behaviour: do NOT retry on 401/403/404 (definitive errors);
 * retry up to 2 times on all other failures (transient network issues).
 */

import { QueryClient } from '@tanstack/react-query';
import { ApiError } from './apiClient.js';

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 2,
      retry: (failureCount, error) => {
        if (
          error instanceof ApiError &&
          [401, 403, 404].includes(error.status)
        ) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});
