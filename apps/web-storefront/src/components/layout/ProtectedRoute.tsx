import { Navigate, Outlet, useLocation } from 'react-router-dom';
import { useAuth } from '../../hooks/useAuth.js';

/**
 * Protected route — wraps account-level routes.
 *
 * If the user is not authenticated, redirects to /auth/login with the
 * intended path preserved in location state so the login page can redirect
 * back after a successful sign-in.
 *
 * Threat model note (T-04-26): This is a UX redirect only. The API enforces
 * the customer role guard server-side on every /account/* request — the
 * client gate is not the security authority.
 *
 * While the session probe is loading (isLoading === true), render nothing
 * to avoid a flash of the protected content before auth resolves.
 */
export function ProtectedRoute() {
  const { isAuthenticated, isLoading } = useAuth();
  const location = useLocation();

  // Wait for the session probe to resolve before deciding
  if (isLoading) {
    return null;
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
