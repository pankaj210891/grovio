/**
 * CommandBar — fixed top bar for the admin command center (Phase 11, T4).
 *
 * Height: 56px, z-50, above the sidebar+content layout.
 * Contains:
 *   - Global search input (navigates to entity on selection)
 *   - Quick actions: Quick Approve Vendor
 *   - Notification bell with badge count
 *   - Dark mode toggle (placeholder for Wave 6)
 *   - Admin avatar + role badge + logout dropdown
 */

import { AnimatePresence, motion } from 'framer-motion';
import { useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';
import { useDarkMode } from '../../hooks/useDarkMode.js';
import { get } from '../../lib/apiClient.js';

interface Notification {
  id: string;
  type: string;
  title: string;
  entityId: string;
  createdAt: string;
}

function NotificationBell() {
  const [open, setOpen] = useState(false);
  const { data: notifications = [] } = useQuery<Notification[]>({
    queryKey: ['admin', 'notifications'],
    queryFn: () => get<Notification[]>('/admin/notifications/recent'),
    staleTime: 30_000,
  });

  const count = notifications.length;

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="relative flex h-9 w-9 items-center justify-center rounded-lg text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text"
        aria-label="Notifications"
      >
        <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15 17h5l-1.405-1.405A2.032 2.032 0 0118 14.158V11a6.002 6.002 0 00-4-5.659V5a2 2 0 10-4 0v.341C7.67 6.165 6 8.388 6 11v3.159c0 .538-.214 1.055-.595 1.436L4 17h5m6 0v1a3 3 0 11-6 0v-1m6 0H9" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-4 w-4 items-center justify-center rounded-full bg-grovio-error text-[9px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-80 rounded-xl border border-grovio-border bg-grovio-surface-raised shadow-lg"
          >
            <div className="border-b border-grovio-border px-4 py-3">
              <h3 className="text-sm font-semibold text-grovio-text">Recent Activity</h3>
            </div>
            {notifications.length === 0 ? (
              <p className="px-4 py-6 text-center text-xs text-grovio-text-muted">No recent activity</p>
            ) : (
              <ul className="max-h-64 overflow-y-auto py-1">
                {notifications.map((n) => (
                  <li key={n.id} className="px-4 py-2.5 text-xs hover:bg-grovio-surface">
                    <p className="font-medium text-grovio-text">{n.title}</p>
                    <p className="mt-0.5 text-grovio-text-muted">
                      {new Date(n.createdAt).toLocaleTimeString()}
                    </p>
                  </li>
                ))}
              </ul>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminDropdown() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

  const ROLE_LABELS: Record<string, string> = {
    super_admin: 'Super Admin',
    moderator: 'Moderator',
    finance_admin: 'Finance Admin',
  };

  function handleLogout() {
    logout(undefined, {
      onSettled: () => navigate('/auth/login', { replace: true }),
    });
  }

  return (
    <div className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 text-sm transition-colors hover:bg-grovio-surface"
      >
        <div className="flex h-7 w-7 items-center justify-center rounded-full bg-grovio-primary/20 text-xs font-bold text-grovio-primary">
          {admin?.email?.[0]?.toUpperCase() ?? 'A'}
        </div>
        <div className="hidden flex-col items-start sm:flex">
          <span className="max-w-[120px] truncate text-xs font-medium text-grovio-text">
            {admin?.email ?? 'Admin'}
          </span>
          <span className="text-[10px] text-grovio-text-muted">
            {ROLE_LABELS[admin?.role ?? ''] ?? admin?.role ?? 'admin'}
          </span>
        </div>
        <svg className="h-3.5 w-3.5 text-grovio-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0, y: -4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.15 }}
            className="absolute right-0 top-full z-50 mt-2 w-48 rounded-xl border border-grovio-border bg-grovio-surface-raised shadow-lg"
          >
            <div className="p-1">
              <button
                type="button"
                onClick={handleLogout}
                className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-grovio-error hover:bg-grovio-error/10"
              >
                <span aria-hidden="true">&#x23CE;</span>
                Sign out
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

export function CommandBar() {
  const [searchQuery, setSearchQuery] = useState('');
  const searchRef = useRef<HTMLInputElement>(null);
  const { isDark, toggle: toggleDarkMode } = useDarkMode();

  return (
    <div className="flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b border-grovio-border bg-grovio-surface-raised px-4 shadow-sm">
      {/* Search input */}
      <div className="relative flex-1 max-w-md">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-4 w-4 text-grovio-text-muted" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search vendors, products, orders... (⌘K)"
          className="h-9 w-full rounded-lg border border-grovio-border bg-grovio-surface pl-9 pr-3 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
        />
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        {/* Notification bell */}
        <NotificationBell />

        {/* Dark mode toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-grovio-text-muted transition-colors hover:bg-grovio-surface hover:text-grovio-text focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-1"
        >
          {isDark ? (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
        </button>

        {/* Admin dropdown */}
        <AdminDropdown />
      </div>
    </div>
  );
}
