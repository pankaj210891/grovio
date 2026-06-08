/**
 * ProtectedAdminRoute — guards all admin panel routes.
 *
 * Waits for the session probe (isLoading) before redirecting to prevent
 * flash of the login page when the cookie is valid.
 *
 * Optional requiredRole prop for RBAC enforcement (Phase 11):
 *   - moderator trying to access /finance or /settings → redirect to /dashboard
 *   - finance_admin trying to access /vendors, /catalog-moderation, /cms, etc. → redirect to /finance
 */

import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';

interface ProtectedAdminRouteProps {
  requiredRole?: 'super_admin' | 'moderator' | 'finance_admin';
}

const FINANCE_ONLY_PATHS = ['/finance'];
const FINANCE_BLOCKED_ROLES = ['moderator'];
const MODERATOR_BLOCKED_PATHS = ['/finance', '/settings'];
const FINANCE_ALLOWED_PATHS = ['/finance'];

function getRoleRedirect(role: string, pathname: string): string | null {
  if (role === 'moderator' && MODERATOR_BLOCKED_PATHS.some(p => pathname.startsWith(p))) {
    return '/dashboard';
  }
  if (role === 'finance_admin' && !FINANCE_ALLOWED_PATHS.some(p => pathname.startsWith(p)) && pathname !== '/') {
    // finance_admin can only access /finance and certain read-only views
    const allowed = ['/finance', '/dashboard', '/auth'];
    if (!allowed.some(p => pathname.startsWith(p))) {
      return '/finance';
    }
  }
  return null;
}

export function ProtectedAdminRoute({ requiredRole }: ProtectedAdminRouteProps) {
  const { isAuthenticated, isLoading, admin } = useAdminAuth();
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

  // RBAC enforcement — redirect based on role
  if (admin) {
    // Check specific required role
    if (requiredRole && admin.role !== 'super_admin') {
      if (requiredRole === 'super_admin') {
        return <Navigate to="/dashboard" replace />;
      }
    }

    // Check path-based RBAC
    const redirect = getRoleRedirect(admin.role, location.pathname);
    if (redirect) {
      return <Navigate to={redirect} replace />;
    }
  }

  return <Outlet />;
}
