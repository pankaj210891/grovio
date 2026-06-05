/**
 * useAdminAuth — session probe, login, and logout for the admin panel.
 *
 * Session probe: GET /admin/auth/me — 200 = authenticated (populates store),
 *   401 = unauthenticated (clears store). Does NOT redirect — ProtectedAdminRoute handles that.
 *
 * login: POST /admin/auth/login → sets cookie; invalidates the session query.
 * logout: POST /admin/auth/logout → clears cookie; invalidates the session query.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useNavigate } from 'react-router-dom';
import { ApiError, get, post } from '../lib/apiClient.js';
import { useAdminAuthStore } from '../stores/adminAuthStore.js';
import type { AdminProfile } from '@grovio/contracts';

interface LoginInput {
  email: string;
  password: string;
}

const SESSION_QUERY_KEY = ['adminSession'] as const;

export function useAdminAuth() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const { admin, setAdmin } = useAdminAuthStore();

  // ── Session probe ──────────────────────────────────────────────────────────
  const { isLoading } = useQuery<AdminProfile | null>({
    queryKey: SESSION_QUERY_KEY,
    queryFn: async () => {
      try {
        const profile = await get<AdminProfile>('/admin/auth/me');
        setAdmin(profile);
        return profile;
      } catch (err) {
        if (err instanceof ApiError && err.status === 401) {
          setAdmin(null);
          return null;
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5, // 5 min — re-probe after page idle
    retry: false,
  });

  // ── Login ──────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      post<{ expiresIn: number }>('/admin/auth/login', input),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      navigate('/dashboard', { replace: true });
    },
  });

  // ── Logout ─────────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: () => post<void>('/admin/auth/logout'),
    onSuccess: async () => {
      setAdmin(null);
      await queryClient.invalidateQueries({ queryKey: SESSION_QUERY_KEY });
      navigate('/auth/login', { replace: true });
    },
    onError: () => {
      // Force local state clear even if logout request fails
      setAdmin(null);
      navigate('/auth/login', { replace: true });
    },
  });

  return {
    admin,
    isAuthenticated: admin !== null,
    isLoading,
    login: loginMutation.mutate,
    loginAsync: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,
    logout: logoutMutation.mutate,
    isLoggingOut: logoutMutation.isPending,
  };
}
