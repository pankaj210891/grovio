/**
 * Customer authentication hook.
 *
 * Security principle (T-04-18): auth state is detected via the session query
 * / 401 responses — NEVER by reading document.cookie. httpOnly cookies are
 * intentionally unreadable by JavaScript; that is the XSS protection (D-09).
 *
 * Session probe: GET /account/profile — a 200 means authenticated; a 401
 * means unauthenticated. React Query's retry config (see query-client.ts)
 * does not retry 401 errors, so this is a single cheap request.
 *
 * Mutations (login, logout, signup) call the corresponding /auth/* endpoints.
 * The backend sets/clears httpOnly cookies; the frontend just observes state.
 */

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api-client.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface CustomerProfile {
  id: string;
  email: string;
  name: string;
  createdAt: string;
}

interface LoginInput {
  email: string;
  password: string;
}

interface SignupInput {
  email: string;
  password: string;
  name: string;
}

interface ProfileResponse {
  success: boolean;
  data: CustomerProfile;
}

// ---------------------------------------------------------------------------
// Hook
// ---------------------------------------------------------------------------

export function useAuth() {
  const qc = useQueryClient();

  // Session probe — 200 = authenticated, 401 = unauthenticated.
  // React Query retry config skips retries on 401 (see query-client.ts).
  const {
    data: sessionData,
    isLoading,
    isError,
  } = useQuery<CustomerProfile | null>({
    queryKey: ['session'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<ProfileResponse>('/account/profile');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) {
          // 401 = unauthenticated — not an error, return null
          return null;
        }
        throw err;
      }
    },
    // Do not re-run on every window focus — session checks are already implicit
    // on every credentialed API call that returns 401.
    staleTime: 1000 * 60 * 5,
    retry: false,
  });

  const isAuthenticated =
    !isLoading && !isError && sessionData !== null && sessionData !== undefined;
  const customer = isAuthenticated ? sessionData : null;

  // ── Login ────────────────────────────────────────────────────────────────
  const loginMutation = useMutation({
    mutationFn: (input: LoginInput) =>
      apiClient.post<{ success: boolean; data: { expiresIn: number } }>(
        '/auth/login',
        input,
      ),
    onSuccess: () => {
      // Invalidate session query so useAuth re-fetches the profile
      void qc.invalidateQueries({ queryKey: ['session'] });
    },
  });

  // ── Logout ───────────────────────────────────────────────────────────────
  const logoutMutation = useMutation({
    mutationFn: () => apiClient.post<{ success: boolean }>('/auth/logout'),
    onSuccess: () => {
      // Clear session + all user-specific cached data
      void qc.invalidateQueries({ queryKey: ['session'] });
      qc.removeQueries({ queryKey: ['session'] });
    },
  });

  // ── Signup ───────────────────────────────────────────────────────────────
  const signupMutation = useMutation({
    mutationFn: (input: SignupInput) =>
      apiClient.post<{ success: boolean; data: CustomerProfile }>(
        '/auth/signup',
        input,
      ),
    // After signup the user is NOT automatically logged in; they must login separately.
  });

  return {
    isAuthenticated,
    customer,
    isLoading,

    login: loginMutation.mutateAsync,
    loginError: loginMutation.error,
    isLoggingIn: loginMutation.isPending,

    logout: logoutMutation.mutateAsync,
    isLoggingOut: logoutMutation.isPending,

    signup: signupMutation.mutateAsync,
    signupError: signupMutation.error,
    isSigningUp: signupMutation.isPending,
  };
}
