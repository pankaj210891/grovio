/**
 * Vendor panel top header bar.
 *
 * Search bar, help button, notification bell, user profile.
 */

import { useNavigate } from 'react-router-dom';
import { useVendorAuth } from '../../hooks/useVendorAuth.js';
import { useUiStore } from '../../stores/uiStore.js';

// ── Icons ─────────────────────────────────────────────────────────────────────

function HamburgerIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6.75h16.5M3.75 12h16.5m-16.5 5.25h16.5" />
    </svg>
  );
}

function SearchIcon() {
  return (
    <svg className="h-4 w-4 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m21 21-5.197-5.197m0 0A7.5 7.5 0 1 0 5.196 5.196a7.5 7.5 0 0 0 10.607 10.607Z" />
    </svg>
  );
}

function HelpIcon() {
  return (
    <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 5.25h.008v.008H12v-.008Z" />
    </svg>
  );
}

function BellIcon() {
  return (
    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M14.857 17.082a23.848 23.848 0 0 0 5.454-1.31A8.967 8.967 0 0 1 18 9.75V9A6 6 0 0 0 6 9v.75a8.967 8.967 0 0 1-2.312 6.022c1.733.64 3.56 1.085 5.455 1.31m5.714 0a24.255 24.255 0 0 1-5.714 0m5.714 0a3 3 0 1 1-5.714 0" />
    </svg>
  );
}

function ChevronDownIcon() {
  return (
    <svg className="h-4 w-4 text-[#6B7280]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
    </svg>
  );
}

// ── Helpers ───────────────────────────────────────────────────────────────────

function getInitials(email: string): string {
  const parts = email.split('@')[0]?.replace(/[._-]/g, ' ').split(' ') ?? [];
  if (parts.length >= 2) {
    return (parts[0]![0]! + parts[1]![0]!).toUpperCase();
  }
  return parts[0]?.slice(0, 2).toUpperCase() ?? 'V';
}

function getDisplayName(email: string): string {
  const local = email.split('@')[0] ?? '';
  return local
    .replace(/[._-]/g, ' ')
    .split(' ')
    .map((w) => (w ? w.charAt(0).toUpperCase() + w.slice(1) : ''))
    .join(' ');
}

// ── Component ─────────────────────────────────────────────────────────────────

export function Header() {
  const { user, role, logout, isLoggingOut } = useVendorAuth();
  const { addToast, toggleSidebar } = useUiStore();
  const navigate = useNavigate();

  const email = user?.email ?? '';
  const initials = getInitials(email);
  const displayName = getDisplayName(email);
  const displayRole = role ? role.charAt(0).toUpperCase() + role.slice(1) : 'Vendor';

  async function handleLogout() {
    try {
      await logout();
      navigate('/auth/login', { replace: true });
    } catch {
      addToast({ id: Date.now().toString(), message: 'Logout failed', variant: 'error' });
    }
  }

  return (
    <header className="flex h-14 items-center gap-3 border-b border-[#D1FAE5] bg-white px-4">
      {/* Mobile hamburger */}
      <button
        type="button"
        onClick={toggleSidebar}
        className="flex h-8 w-8 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F8FFFD] hover:text-[#134E4A] lg:hidden"
        aria-label="Toggle sidebar"
      >
        <HamburgerIcon />
      </button>

      {/* Search bar */}
      <div className="flex flex-1 items-center gap-2 rounded-lg border border-[#D1FAE5] bg-[#F8FFFD] px-3 py-2 text-[#6B7280] transition-colors focus-within:border-[#14B8A6] focus-within:ring-1 focus-within:ring-[#14B8A6]/30 max-w-xl">
        <SearchIcon />
        <input
          type="text"
          placeholder="Search anything (orders, products, customers...)"
          className="flex-1 bg-transparent text-sm text-[#134E4A] outline-none placeholder:text-[#6B7280]"
          readOnly
          aria-label="Search"
        />
        <kbd className="hidden shrink-0 rounded border border-[#D1FAE5] bg-white px-1.5 py-0.5 text-[10px] font-medium text-[#6B7280] sm:block">
          ⌘ K
        </kbd>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-1 ml-auto">
        {/* Help */}
        <button
          type="button"
          className="hidden items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium text-[#6B7280] transition-colors hover:bg-[#F8FFFD] hover:text-[#134E4A] sm:flex"
          aria-label="Help"
        >
          <HelpIcon />
          Help
        </button>

        {/* Notifications */}
        <button
          type="button"
          className="relative flex h-9 w-9 items-center justify-center rounded-lg text-[#6B7280] transition-colors hover:bg-[#F8FFFD] hover:text-[#134E4A]"
          aria-label="Notifications"
        >
          <BellIcon />
        </button>

        {/* Divider */}
        <div className="mx-1 h-6 w-px bg-[#D1FAE5]" />

        {/* User profile */}
        <button
          type="button"
          onClick={() => void handleLogout()}
          disabled={isLoggingOut}
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 transition-colors hover:bg-[#F8FFFD] disabled:opacity-50"
          title={isLoggingOut ? 'Signing out…' : 'Sign out'}
          aria-label="User menu"
        >
          <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#14B8A6] text-xs font-bold text-white">
            {initials}
          </div>
          <div className="hidden text-left sm:block">
            <p className="text-sm font-semibold leading-tight text-[#134E4A]">
              {displayName || email}
            </p>
            <p className="text-[11px] leading-tight text-[#6B7280]">{displayRole}</p>
          </div>
          <ChevronDownIcon />
        </button>
      </div>
    </header>
  );
}
