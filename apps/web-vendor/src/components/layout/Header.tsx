/**
 * Vendor panel top header bar.
 *
 * Displays: breadcrumb (derived from pathname), logged-in user email, logout button.
 */

import { useLocation, useNavigate } from 'react-router-dom';
import { useVendorAuth } from '../../hooks/useVendorAuth.js';
import { useUiStore } from '../../stores/uiStore.js';

const ROUTE_LABELS: Record<string, string> = {
  dashboard: 'Dashboard',
  products: 'Products',
  inventory: 'Inventory & Pricing',
  orders: 'Orders',
  returns: 'Returns',
  earnings: 'Earnings & Payouts',
  coupons: 'Coupons',
  team: 'Team',
  'store-profile': 'Store Profile',
  settings: 'Settings',
};

function useBreadcrumb(): string {
  const location = useLocation();
  const segments = location.pathname.split('/').filter(Boolean);
  const last = segments[segments.length - 1];
  return ROUTE_LABELS[last ?? ''] ?? 'Dashboard';
}

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

export function Header() {
  const breadcrumb = useBreadcrumb();
  const { user, logout, isLoggingOut } = useVendorAuth();
  const { addToast } = useUiStore();
  const { toggleSidebar } = useUiStore();
  const navigate = useNavigate();

  async function handleLogout() {
    try {
      await logout();
      navigate('/auth/login', { replace: true });
    } catch {
      addToast({ id: Date.now().toString(), message: 'Logout failed', variant: 'error' });
    }
  }

  return (
    <header className="flex h-14 items-center justify-between border-b border-grovio-border bg-grovio-surface-raised px-4">
      <div className="flex items-center gap-3">
        {/* Mobile hamburger */}
        <button
          type="button"
          onClick={toggleSidebar}
          className="flex items-center justify-center rounded-md p-1 text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text lg:hidden"
          aria-label="Toggle sidebar"
        >
          <HamburgerIcon />
        </button>

        {/* Breadcrumb */}
        <h2 className="text-sm font-semibold text-grovio-text">{breadcrumb}</h2>
      </div>

      <div className="flex items-center gap-4">
        {/* User email */}
        {user?.email && (
          <span className="hidden text-xs text-grovio-text-muted sm:block">
            {user.email}
          </span>
        )}

        {/* Logout */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="rounded-lg border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted transition-colors hover:border-grovio-primary hover:text-grovio-primary disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isLoggingOut ? 'Signing out…' : 'Sign out'}
        </button>
      </div>
    </header>
  );
}
