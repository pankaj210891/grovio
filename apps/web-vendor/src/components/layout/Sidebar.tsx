/**
 * Vendor panel persistent sidebar.
 *
 * Navigation items per D-20:
 *   Dashboard, Products, Inventory & Pricing, Orders, Returns,
 *   Earnings & Payouts, Coupons (hidden when COUPONS_ENABLED off),
 *   Team (owner only), Store Profile (owner only), Settings (owner only).
 *
 * Collapses to icon bar on tablet via uiStore.sidebarCollapsed.
 *
 * Feature flag check: GET /feature-flags/COUPONS_ENABLED to decide whether
 * to show the Coupons nav item.
 */

import { AnimatePresence, motion } from 'motion/react';
import { NavLink, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../../lib/apiClient.js';
import { useUiStore } from '../../stores/uiStore.js';
import { useVendorAuthStore } from '../../stores/vendorAuthStore.js';

interface FeatureFlagResponse {
  success: boolean;
  data: { key: string; enabled: boolean };
}

function useCouponsEnabled(): boolean {
  const { data } = useQuery<boolean>({
    queryKey: ['featureFlag', 'COUPONS_ENABLED'],
    queryFn: async () => {
      try {
        const res = await apiClient.get<FeatureFlagResponse>(
          '/feature-flags/COUPONS_ENABLED',
        );
        return res.data.enabled;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 404) return false;
        return false;
      }
    },
    staleTime: 1000 * 60 * 5,
    retry: false,
  });
  return data ?? true; // default to visible until flag resolves
}

const iconSize = 'h-5 w-5';

// SVG icon components (inline, no extra dependency)
function DashboardIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 0 1 6 3.75h2.25A2.25 2.25 0 0 1 10.5 6v2.25a2.25 2.25 0 0 1-2.25 2.25H6a2.25 2.25 0 0 1-2.25-2.25V6ZM3.75 15.75A2.25 2.25 0 0 1 6 13.5h2.25a2.25 2.25 0 0 1 2.25 2.25V18a2.25 2.25 0 0 1-2.25 2.25H6A2.25 2.25 0 0 1 3.75 18v-2.25ZM13.5 6a2.25 2.25 0 0 1 2.25-2.25H18A2.25 2.25 0 0 1 20.25 6v2.25A2.25 2.25 0 0 1 18 10.5h-2.25a2.25 2.25 0 0 1-2.25-2.25V6ZM13.5 15.75a2.25 2.25 0 0 1 2.25-2.25H18a2.25 2.25 0 0 1 2.25 2.25V18A2.25 2.25 0 0 1 18 20.25h-2.25A2.25 2.25 0 0 1 13.5 18v-2.25Z" />
    </svg>
  );
}
function ProductsIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m20.25 7.5-.625 10.632a2.25 2.25 0 0 1-2.247 2.118H6.622a2.25 2.25 0 0 1-2.247-2.118L3.75 7.5M10 11.25h4M3.375 7.5h17.25c.621 0 1.125-.504 1.125-1.125v-1.5c0-.621-.504-1.125-1.125-1.125H3.375c-.621 0-1.125.504-1.125 1.125v1.5c0 .621.504 1.125 1.125 1.125Z" />
    </svg>
  );
}
function InventoryIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h12M8.25 12h12m-12 5.25h12M3.75 6.75h.007v.008H3.75V6.75Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0ZM3.75 12h.007v.008H3.75V12Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Zm-.375 5.25h.007v.008H3.75v-.008Zm.375 0a.375.375 0 1 1-.75 0 .375.375 0 0 1 .75 0Z" />
    </svg>
  );
}
function OrdersIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12h3.75M9 15h3.75M9 18h3.75m3 .75H18a2.25 2.25 0 0 0 2.25-2.25V6.108c0-1.135-.845-2.098-1.976-2.192a48.424 48.424 0 0 0-1.123-.08m-5.801 0c-.065.21-.1.433-.1.664 0 .414.336.75.75.75h4.5a.75.75 0 0 0 .75-.75 2.25 2.25 0 0 0-.1-.664m-5.8 0A2.251 2.251 0 0 1 13.5 2.25H15c1.012 0 1.867.668 2.15 1.586m-5.8 0c-.376.023-.75.05-1.124.08C9.095 4.01 8.25 4.973 8.25 6.108V8.25m0 0H4.875c-.621 0-1.125.504-1.125 1.125v11.25c0 .621.504 1.125 1.125 1.125h9.75c.621 0 1.125-.504 1.125-1.125V9.375c0-.621-.504-1.125-1.125-1.125H8.25ZM6.75 12h.008v.008H6.75V12Zm0 3h.008v.008H6.75V15Zm0 3h.008v.008H6.75V18Z" />
    </svg>
  );
}
function ReturnsIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 15 3 9m0 0 6-6M3 9h12a6 6 0 0 1 0 12h-3" />
    </svg>
  );
}
function EarningsIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 18.75a60.07 60.07 0 0 1 15.797 2.101c.727.198 1.453-.342 1.453-1.096V18.75M3.75 4.5v.75A.75.75 0 0 1 3 6h-.75m0 0v-.375c0-.621.504-1.125 1.125-1.125H20.25M2.25 6v9m18-10.5v.75c0 .414.336.75.75.75h.75m-1.5-1.5h.375c.621 0 1.125.504 1.125 1.125v9.75c0 .621-.504 1.125-1.125 1.125h-.375m1.5-1.5H21a.75.75 0 0 0-.75.75v.75m0 0H3.75m0 0h-.375a1.125 1.125 0 0 1-1.125-1.125V15m1.5 1.5v-.75A.75.75 0 0 0 3 15h-.75M15 10.5a3 3 0 1 1-6 0 3 3 0 0 1 6 0Zm3 0h.008v.008H18V10.5Zm-12 0h.008v.008H6V10.5Z" />
    </svg>
  );
}
function CouponsIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9 9V4.5M9 9H4.5M9 9 3.75 3.75M9 15v4.5M9 15H4.5M9 15l-5.25 5.25M15 9h4.5M15 9V4.5M15 9l5.25-5.25M15 15h4.5M15 15v4.5m0-4.5 5.25 5.25" />
    </svg>
  );
}
function TeamIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}
function StoreIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 21v-7.5a.75.75 0 0 1 .75-.75h3a.75.75 0 0 1 .75.75V21m-4.5 0H2.36m11.14 0H18m0 0h3.64m-1.39 0V9.349M3.75 21V9.349m0 0a3.001 3.001 0 0 0 3.75-.615A2.993 2.993 0 0 0 9.75 9.75c.896 0 1.7-.393 2.25-1.016a2.993 2.993 0 0 0 2.25 1.016c.896 0 1.7-.393 2.25-1.015a3.001 3.001 0 0 0 3.75.614m-16.5 0a3.004 3.004 0 0 1-.621-4.72l1.189-1.19A1.5 1.5 0 0 1 5.378 3h13.243a1.5 1.5 0 0 1 1.06.44l1.19 1.189a3 3 0 0 1-.621 4.72M6.75 18h3.75a.75.75 0 0 0 .75-.75V13.5a.75.75 0 0 0-.75-.75H6.75a.75.75 0 0 0-.75.75v3.75c0 .414.336.75.75.75Z" />
    </svg>
  );
}
function SettingsIcon() {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}
function CollapseIcon({ collapsed }: { collapsed: boolean }) {
  return (
    <svg className={iconSize} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}
      style={{ transform: collapsed ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s' }}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
    </svg>
  );
}

interface NavItem {
  to: string;
  label: string;
  icon: React.ReactNode;
  ownerOnly?: boolean;
}

function buildNavItems(couponsEnabled: boolean): NavItem[] {
  const items: NavItem[] = [
    { to: '/dashboard', label: 'Dashboard', icon: <DashboardIcon /> },
    { to: '/products', label: 'Products', icon: <ProductsIcon /> },
    { to: '/inventory', label: 'Inventory & Pricing', icon: <InventoryIcon /> },
    { to: '/orders', label: 'Orders', icon: <OrdersIcon /> },
    { to: '/returns', label: 'Returns', icon: <ReturnsIcon /> },
    { to: '/earnings', label: 'Earnings & Payouts', icon: <EarningsIcon /> },
  ];

  if (couponsEnabled) {
    items.push({ to: '/coupons', label: 'Coupons', icon: <CouponsIcon /> });
  }

  items.push(
    { to: '/team', label: 'Team', icon: <TeamIcon />, ownerOnly: true },
    { to: '/store-profile', label: 'Store Profile', icon: <StoreIcon />, ownerOnly: true },
    { to: '/settings', label: 'Settings', icon: <SettingsIcon />, ownerOnly: true },
  );

  return items;
}

export function Sidebar() {
  const { sidebarCollapsed, toggleSidebar } = useUiStore();
  const { role } = useVendorAuthStore();
  const couponsEnabled = useCouponsEnabled();
  const location = useLocation();

  const navItems = buildNavItems(couponsEnabled);
  const isOwner = role === 'owner';

  return (
    <motion.aside
      animate={{ width: sidebarCollapsed ? 64 : 240 }}
      transition={{ type: 'spring', damping: 28, stiffness: 300 }}
      className="relative flex h-screen flex-col overflow-hidden border-r border-grovio-border bg-grovio-surface-raised"
    >
      {/* Logo / Brand */}
      <div className="flex h-14 items-center justify-between border-b border-grovio-border px-4">
        <AnimatePresence mode="wait">
          {!sidebarCollapsed && (
            <motion.span
              key="brand"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              className="text-base font-bold text-grovio-primary"
            >
              Grovio
            </motion.span>
          )}
        </AnimatePresence>
        <button
          type="button"
          onClick={toggleSidebar}
          className="ml-auto flex h-8 w-8 items-center justify-center rounded-md text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text"
          aria-label={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
        >
          <CollapseIcon collapsed={sidebarCollapsed} />
        </button>
      </div>

      {/* Navigation */}
      <nav className="flex-1 overflow-y-auto py-3">
        <ul className="space-y-0.5 px-2">
          {navItems.map((item) => {
            if (item.ownerOnly && !isOwner) return null;
            const isActive =
              location.pathname === item.to ||
              location.pathname.startsWith(item.to + '/');
            return (
              <li key={item.to}>
                <NavLink
                  to={item.to}
                  title={sidebarCollapsed ? item.label : undefined}
                  className={[
                    'flex items-center gap-3 rounded-lg px-2.5 py-2 text-sm font-medium transition-colors',
                    isActive
                      ? 'bg-grovio-primary/10 text-grovio-primary'
                      : 'text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text',
                  ].join(' ')}
                >
                  <span className="shrink-0">{item.icon}</span>
                  <AnimatePresence mode="wait">
                    {!sidebarCollapsed && (
                      <motion.span
                        key={`label-${item.to}`}
                        initial={{ opacity: 0, width: 0 }}
                        animate={{ opacity: 1, width: 'auto' }}
                        exit={{ opacity: 0, width: 0 }}
                        transition={{ duration: 0.15 }}
                        className="overflow-hidden whitespace-nowrap"
                      >
                        {item.label}
                      </motion.span>
                    )}
                  </AnimatePresence>
                </NavLink>
              </li>
            );
          })}
        </ul>
      </nav>
    </motion.aside>
  );
}
