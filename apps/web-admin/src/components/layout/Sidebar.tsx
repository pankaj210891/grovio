/**
 * Sidebar — admin panel navigation.
 *
 * Nav items per D-20: Dashboard, Vendors, Catalog Moderation, Commission Rules,
 * Payout Management, CMS / Homepage, Feature Flags, Settings & Branding, Audit Log.
 * Plus a Categories divider linking to existing Phase 2 /categories routes.
 *
 * Uses framer-motion (web-admin convention per PATTERNS.md, not motion/react).
 */

import { motion } from 'framer-motion';
import { NavLink, useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';

interface NavItem {
  to: string;
  label: string;
  icon: string;
}

const mainNavItems: NavItem[] = [
  { to: '/dashboard', label: 'Dashboard', icon: '▣' },
  { to: '/vendors', label: 'Vendors', icon: '🏪' },
  { to: '/catalog-moderation', label: 'Catalog Moderation', icon: '📋' },
  { to: '/commission-rules', label: 'Commission Rules', icon: '💰' },
  { to: '/payout-management', label: 'Payout Management', icon: '💳' },
  { to: '/cms', label: 'CMS / Homepage', icon: '🗂' },
  { to: '/feature-flags', label: 'Feature Flags', icon: '🚩' },
  { to: '/settings', label: 'Settings & Branding', icon: '⚙' },
  { to: '/audit-log', label: 'Audit Log', icon: '📜' },
];

const categoryNavItems: NavItem[] = [
  { to: '/categories', label: 'Categories', icon: '🗂' },
];

function NavItem({ item }: { item: NavItem }) {
  return (
    <NavLink
      to={item.to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium transition-colors',
          isActive
            ? 'bg-grovio-primary/10 text-grovio-primary'
            : 'text-grovio-text-muted hover:bg-grovio-surface hover:text-grovio-text',
        ].join(' ')
      }
    >
      <span className="text-base leading-none" aria-hidden="true">
        {item.icon}
      </span>
      <span>{item.label}</span>
    </NavLink>
  );
}

export function Sidebar() {
  const { logout, isLoggingOut } = useAdminAuth();
  const navigate = useNavigate();

  function handleLogout() {
    logout(undefined, {
      onSettled: () => {
        navigate('/auth/login', { replace: true });
      },
    });
  }

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
          {mainNavItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>

        {/* Divider — Phase 2 routes */}
        <div className="my-4 border-t border-grovio-border" />
        <p className="mb-1 px-3 text-[10px] font-semibold uppercase tracking-wider text-grovio-text-muted">
          Catalog Structure
        </p>
        <div className="space-y-0.5">
          {categoryNavItems.map((item) => (
            <NavItem key={item.to} item={item} />
          ))}
        </div>
      </nav>

      {/* Logout */}
      <div className="border-t border-grovio-border px-3 py-4">
        <button
          type="button"
          onClick={handleLogout}
          disabled={isLoggingOut}
          className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm font-medium text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-error disabled:opacity-60"
        >
          <span className="text-base leading-none" aria-hidden="true">
            ⎋
          </span>
          <span>{isLoggingOut ? 'Logging out…' : 'Log out'}</span>
        </button>
      </div>
    </motion.aside>
  );
}
