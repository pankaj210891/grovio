/**
 * Vendor authentication hook.
 *
 * Security principle: auth state is detected via the session query / 401
 * responses — NEVER by reading document.cookie. httpOnly cookies are
 * intentionally unreadable by JavaScript (XSS protection, D-09).
 *
 * Session probe: GET /vendor/auth/me — 200 = authenticated, 401 = unauthenticated.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/apiClient.js';
import { useVendorAuthStore, type VendorUser } from '../stores/vendorAuthStore.js';
import type { VendorRole } from '@grovio/contracts';

interface LoginInput {
  email: string;
  password: string;
}

interface MeResponse {
  success: boolean;
  data: VendorUser;
}

/**
 * Role hierarchy: owner > manager > staff.
 * Returns true if `userRole` meets or exceeds `requiredRole`.
 */
export function hasRole(
  userRole: VendorRole | null,
  requiredRole: VendorRole,
): boolean {
  if (!userRole) return false;
  const hierarchy: Record<VendorRole, number> = {
    owner: 3,
    manager: 2,
    staff: 1,
  };
  return hierarchy[userRole] >= hierarchy[requiredRole];
}

export function useVendorAuth() {
  const qc = useQueryClient();
  const { setVendorUser } = useVendorAuthStore();

  // Session probe — 200 = authenticated, 401 = unauthenticated.
  const {
    data: sessionData,
    isLoading,
    isError,
  } = useQuery<VendorUser | null>({
    queryKey: ['vendorSession'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<MeResponse>('/vendor/auth/me');
        const user = res.data;
        setVendorUser(user);
        return user;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          setVendorUser(null);
          return null;
        }
        throw err;
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const isAuthenticated =
    !isLoading && !isError && sessionData !== null && sessionData !== undefined;
  const user = isAuthenticated ? sessionData : null;

  // ── Login ────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      apiClient.post<{ success: boolean; data: { expiresIn: number } }>(
        '/vendor/auth/login',
        input,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['vendorSession'] });
    },
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: () =>
      apiClient.post<{ success: boolean }>('/vendor/auth/logout'),
    onSuccess: () => {
      setVendorUser(null);
      qc.removeQueries({ queryKey: ['vendorSession'] });
    },
  });

  return {
    isAuthenticated,
    isLoading,
    user,
    role: user?.role ?? null,

    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,

    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,
  };
}
