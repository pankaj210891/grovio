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

const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super Admin',
  moderator: 'Moderator',
  finance_admin: 'Finance Admin',
};

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
        aria-label="Notifications"
        className="relative flex h-8 w-8 items-center justify-center rounded-lg text-[#3a4a6a] transition-colors hover:bg-[#0f1629] hover:text-[#8a9bbf]"
      >
        <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
        </svg>
        {count > 0 && (
          <span className="absolute -right-0.5 -top-0.5 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-[#4f7ef8] font-['DM_Mono'] text-[8px] font-bold text-white">
            {count > 9 ? '9+' : count}
          </span>
        )}
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15, ease: [0.23, 1, 0.32, 1] }}
              className="absolute right-0 top-full z-50 mt-2 w-72 overflow-hidden rounded-xl border border-[#1e2847] bg-[#0d1426] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
            >
              <div className="border-b border-[#1e2847] px-4 py-3">
                <h3 className="font-['Syne'] text-xs font-semibold uppercase tracking-widest text-[#5b6b9a]">
                  Activity
                </h3>
              </div>
              {notifications.length === 0 ? (
                <div className="flex flex-col items-center py-8">
                  <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1e2847]">
                    <svg className="h-5 w-5 text-[#3a4a6a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 005.454-1.31A8.967 8.967 0 0118 9.75v-.7V9A6 6 0 006 9v.75a8.967 8.967 0 01-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 01-5.714 0m5.714 0a3 3 0 11-5.714 0" />
                    </svg>
                  </div>
                  <p className="mt-2 text-xs text-[#3a4a6a]">No recent activity</p>
                </div>
              ) : (
                <ul className="max-h-64 overflow-y-auto">
                  {notifications.map((n) => (
                    <li key={n.id} className="border-b border-[#111827] px-4 py-3 last:border-0 hover:bg-[#111827]">
                      <p className="text-xs font-medium text-[#c8d4f5]">{n.title}</p>
                      <p className="mt-0.5 font-['DM_Mono'] text-[10px] text-[#3a4a6a]">
                        {new Date(n.createdAt).toLocaleTimeString()}
                      </p>
                    </li>
                  ))}
                </ul>
              )}
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

function AdminDropdown() {
  const { admin, logout } = useAdminAuth();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);

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
        className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#0f1629]"
      >
        <div className="flex h-6 w-6 items-center justify-center rounded-full bg-[#4f7ef8]/20 font-['DM_Mono'] text-[10px] font-bold text-[#4f7ef8]">
          {admin?.email?.[0]?.toUpperCase() ?? 'A'}
        </div>
        <div className="hidden flex-col items-start sm:flex">
          <span className="max-w-[100px] truncate font-['Syne'] text-[11px] font-medium text-[#6a7fa8]">
            {admin?.email ?? 'Admin'}
          </span>
          <span className="font-['Syne'] text-[9px] font-semibold uppercase tracking-widest text-[#2a3a5a]">
            {ROLE_LABELS[admin?.role ?? ''] ?? admin?.role ?? 'admin'}
          </span>
        </div>
        <svg className="h-3 w-3 text-[#2a3a5a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
        </svg>
      </button>

      <AnimatePresence>
        {open && (
          <>
            <div className="fixed inset-0 z-40" onClick={() => setOpen(false)} />
            <motion.div
              initial={{ opacity: 0, y: -6, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -6, scale: 0.97 }}
              transition={{ duration: 0.15 }}
              className="absolute right-0 top-full z-50 mt-2 w-44 overflow-hidden rounded-xl border border-[#1e2847] bg-[#0d1426] shadow-[0_16px_48px_rgba(0,0,0,0.5)]"
            >
              <div className="p-1">
                <button
                  type="button"
                  onClick={handleLogout}
                  className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-xs text-[#f87171] hover:bg-[#f87171]/10"
                >
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15M12 9l-3 3m0 0l3 3m-3-3h12.75" />
                  </svg>
                  <span className="font-['Syne'] font-medium">Sign out</span>
                </button>
              </div>
            </motion.div>
          </>
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
    <div className="flex h-12 flex-shrink-0 items-center justify-between gap-4 border-b border-[#111827] bg-[#060a14] px-4">
      {/* Search */}
      <div className="relative max-w-sm flex-1">
        <div className="pointer-events-none absolute inset-y-0 left-3 flex items-center">
          <svg className="h-3.5 w-3.5 text-[#2a3a5a]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
          </svg>
        </div>
        <input
          ref={searchRef}
          type="search"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search anything…"
          aria-label="Search admin panel"
          role="searchbox"
          className="h-8 w-full rounded-lg border border-[#111827] bg-[#0a0e1a] pl-8 pr-10 font-['Syne'] text-xs text-[#8a9bbf] placeholder-[#2a3a5a] outline-none transition-all focus:border-[#1e2847] focus:ring-0"
        />
        <div className="pointer-events-none absolute inset-y-0 right-2.5 flex items-center gap-0.5">
          <kbd className="rounded border border-[#1e2847] bg-[#111827] px-1 font-['DM_Mono'] text-[9px] text-[#2a3a5a]">⌘K</kbd>
        </div>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1">
        <NotificationBell />

        {/* Dark/light toggle */}
        <button
          type="button"
          onClick={toggleDarkMode}
          aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
          aria-pressed={isDark}
          className="flex h-8 w-8 items-center justify-center rounded-lg text-[#3a4a6a] transition-colors hover:bg-[#0f1629] hover:text-[#8a9bbf]"
        >
          {isDark ? (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386-1.591 1.591M21 12h-2.25m-.386 6.364-1.591-1.591M12 18.75V21m-4.773-4.227-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0Z" />
            </svg>
          ) : (
            <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.75} aria-hidden="true">
              <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.72 9.72 0 0 1 18 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 0 0 3 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 0 0 9.002-5.998Z" />
            </svg>
          )}
        </button>

        <div className="mx-1 h-4 w-px bg-[#111827]" />

        <AdminDropdown />
      </div>
    </div>
  );
}
