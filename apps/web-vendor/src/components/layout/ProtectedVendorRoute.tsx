/**
 * Protected route for vendor panel.
 *
 * Waits for session probe to resolve, then redirects to /auth/login if
 * unauthenticated. If `requiredRole` is set, redirects to /dashboard
 * if the authenticated user's role is insufficient.
 *
 * Threat model note (T-06-30): This is a UX redirect only. The API enforces
 * role guards server-side on every /vendor/* request.
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useVendorAuth, hasRole } from '../../hooks/useVendorAuth.js';
import type { VendorRole } from '@grovio/contracts';

interface ProtectedVendorRouteProps {
  requiredRole?: VendorRole;
}

export function ProtectedVendorRoute({ requiredRole }: ProtectedVendorRouteProps) {
  const { isAuthenticated, isLoading, role } = useVendorAuth();
  const location = useLocation();

  // Wait for session probe to resolve before deciding
  if (isLoading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-grovio-surface">
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

  if (requiredRole && !hasRole(role, requiredRole)) {
    return <Navigate to="/dashboard" replace />;
  }

  return <Outlet />;
}
