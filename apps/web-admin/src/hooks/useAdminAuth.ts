import { useMutation, useQuery } from '@tanstack/react-query';
import { useAdminAuthStore } from '../stores/adminAuthStore.js';
import { get, post } from '../lib/apiClient.js';

/**
 * useAdminAuth — provides admin authentication state and actions.
 *
 * Uses React Query to probe the session on mount (GET /admin/auth/me)
 * and manages login/logout mutations with cookie-based JWT auth.
 *
 * The underlying JWT is stored in an httpOnly cookie set by the server —
 * this hook does NOT read or store the raw token.
 */

interface AdminMeResponse {
  id: string;
  email: string;
  role: string;
}

export function useAdminAuth() {
  const { admin, isAuthenticated, setAdmin, clearAdmin } = useAdminAuthStore();

  // Probe session on mount — resolves the loading state
  const { isLoading } = useQuery({
    queryKey: ['admin', 'me'],
    queryFn: async () => {
      const data = await get<AdminMeResponse>('/admin/auth/me');
      setAdmin({
        id: data.id,
        email: data.email,
        role: data.role as 'super_admin' | 'moderator' | 'finance_admin',
      });
      return data;
    },
    retry: false,
    staleTime: 5 * 60 * 1000,
    // If request fails (401), clear auth state
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    throwOnError: false,
  });

  const loginMutation = useMutation({
    mutationFn: async (credentials: { email: string; password: string }) => {
      const data = await post<AdminMeResponse>('/admin/auth/login', credentials);
      setAdmin({
        id: data.id,
        email: data.email,
        role: data.role as 'super_admin' | 'moderator' | 'finance_admin',
      });
      return data;
    },
  });

  const logoutMutation = useMutation({
    mutationFn: async () => {
      await post<void>('/admin/auth/logout', {});
      clearAdmin();
    },
  });

  return {
    admin,
    isAuthenticated,
    isLoading,
    login: loginMutation.mutate,
    isLoggingIn: loginMutation.isPending,
    loginError: loginMutation.error,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
