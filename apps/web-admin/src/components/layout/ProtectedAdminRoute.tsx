/**
 * ProtectedAdminRoute — guards all admin panel routes.
 *
 * Waits for the session probe (isLoading) before redirecting to prevent
 * flash of the login page when the cookie is valid. Mirrors storefront
 * ProtectedRoute pattern per PATTERNS.md.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';

export function ProtectedAdminRoute() {
  const { isAuthenticated, isLoading } = useAdminAuth();
  const location = useLocation();

  // Wait for session probe to resolve — prevents login flash on valid sessions
  if (isLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-grovio-surface">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
      </div>
    );
  }

  if (!isAuthenticated) {
    return (
      <Navigate
        to="/auth/login"
        replace
        state={{ from: location.pathname }}
      />
    );
  }

  return <Outlet />;
}
