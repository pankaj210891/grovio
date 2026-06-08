/**
 * Sidebar — admin panel navigation (Phase 11, T4).
 *
 * Nav items per plan D-21:
 *   Dashboard, Vendors (+ pending badge), Catalog Moderation (+ flagged badge),
 *   Finance, Orders, CMS/Homepage, Feature Flags, Insights, Support (+ open tickets badge),
 *   Settings & Branding, Audit & Security, Categories (Phase 2 — preserved).
 *
 * Items conditionally rendered based on admin.role:
 *   - moderator: no Finance, no Settings
 *   - finance_admin: only Finance + Dashboard
 */

import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';
import { get } from '../../lib/apiClient.js';

interface NavItem {
  to: string;
  label: string;
  icon: string;
  roles?: string[]; // if defined, only these roles see this item
}

// Badge counts for sidebar items
function useSidebarBadges() {
  const { data: ticketData } = useQuery<{ items: unknown[]; total: number }>({
    queryKey: ['admin', 'support-tickets', 'open-count'],
    queryFn: () => get('/admin/support-tickets?status=open&limit=1'),
    staleTime: 30_000,
  });

  return {
    openTickets: ticketData?.total ?? 0,
  };
}

const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/vendors', label: 'Vendors', icon: '🏪', roles: ['super_admin', 'moderator'] },
  { to: '/catalog-moderation', label: 'Catalog Moderation', icon: '📋', roles: ['super_admin', 'moderator'] },
  { to: '/finance', label: 'Finance', icon: '💰', roles: ['super_admin', 'finance_admin'] },
  { to: '/orders', label: 'Orders', icon: '📦', roles: ['super_admin', 'moderator'] },
  { to: '/insights', label: 'Insights', icon: '📊', roles: ['super_admin', 'finance_admin'] },
  { to: '/support', label: 'Support', icon: '🎧', roles: ['super_admin', 'moderator'] },
  { to: '/cms', label: 'CMS / Homepage', icon: '🗂', roles: ['super_admin', 'moderator'] },
  { to: '/feature-flags', label: 'Feature Flags', icon: '🚩', roles: ['super_admin', 'moderator'] },
  { to: '/settings', label: 'Settings & Branding', icon: '⚙', roles: ['super_admin'] },
  { to: '/audit-log', label: 'Audit & Security', icon: '📜', roles: ['super_admin'] },
];

const categoryNavItems: NavItem[] = [
  { to: '/categories', label: 'Categories', icon: '🗂' },
];

function NavItemComponent({
  item,
  badge,
}: {
  item: NavItem;
  badge?: number;
}) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'flex items-center justify-between rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-grovio-primary/10 text-grovio-primary'
            : 'text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text',
        ].join(' ')
      }
    >
      <span className="flex items-center gap-3">
        <span className="text-base leading-none" aria-hidden="true">
          {item.icon}
        </span>
        <span>{item.label}</span>
      </span>
      {badge != null && badge > 0 && (
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-grovio-error/20 px-1.5 text-[10px] font-bold text-grovio-error">
          {badge > 99 ? '99+' : badge}
        </span>
      )}
    </NavLink>
  );
}

export function Sidebar() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const { openTickets } = useSidebarBadges();

  const role = admin?.role ?? 'moderator';

  function handleLogout() {
    logout(undefined, {
      onSettled: () => navigate('/auth/login', { replace: true }),
    });
  }

  // Filter items by role
  const visibleNavItems = mainNavItems.filter(
    (item) => !item.roles || item.roles.includes(role)
  );

  return (
    <motion.aside
      className="flex h-screen w-60 flex-shrink-0 flex-col border-r border-grovio-border bg-grovio-surface-raised"
      initial={{ x: -16, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ duration: 0.3 }}
    >
      {/* Logo */}
      <div className="flex items-center gap-3 border-b border-grovio-border px-5 py-4">
        <span className="rounded-md bg-grovio-primary px-2.5 py-1 text-base font-bold text-white">
          G
        </span>
        <span className="text-sm font-semibold text-grovio-text">Admin Panel</span>
      </div>

      {/* Main nav */}
      <nav className="flex-1 overflow-y-auto px-3 py-4">
        <div className="space-y-0.5">
          {visibleNavItems.map((item) => (
            <NavItemComponent
              key={item.to}
              item={item}
              {...(item.to === '/support' && openTickets != null ? { badge: openTickets } : {})}
            />
          ))}
        </div>

        {/* Divider — Phase 2 category routes (MUST NOT be removed) */}
        <div className="my-4 border-t border-grovio-border" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-grovio-text-muted">
          Catalog Structure
        </p>
        <div className="space-y-0.5">
          {categoryNavItems.map((item) => (
            <NavItemComponent key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="border-t border-grovio-border px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-error"
        >
          <span className="text-base leading-none" aria-hidden="true">&#x23CE;</span>
          <span>Log out</span>
        </button>
      </div>
    </motion.aside>
  );
}
