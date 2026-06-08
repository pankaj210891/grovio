import { useState, type FormEvent } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { Search, ShoppingCart, User, Heart, Bell } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth.js';
import { useBasket } from '../../hooks/useBasket.js';
import { useDarkMode } from '../../hooks/useDarkMode.js';

/**
 * Site header — semantic <header> landmark.
 *
 * Layout: logo left | search bar center (md+) | icons right
 * Mobile: search bar collapses to icon button; tap expands full-width search bar.
 *
 * Accessibility:
 *   - Search icon button: aria-label="Search"
 *   - Account icon button: aria-label="Account"
 *   - Cart icon button: aria-label="View cart"
 *   - All touch targets: min-h-[48px] (WCAG touch target)
 *
 * Container: max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8
 */
export function Header() {
  const { isAuthenticated } = useAuth();
  const { itemCount } = useBasket();
  const navigate = useNavigate();
  const [mobileSearchOpen, setMobileSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const { toggle: toggleDarkMode, isDark } = useDarkMode();

  function handleSearchSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const q = searchQuery.trim();
    if (q) {
      void navigate(`/search?q=${encodeURIComponent(q)}`);
      setMobileSearchOpen(false);
      setSearchQuery('');
    }
  }

  return (
    <header className="hidden md:block sticky top-0 z-40 bg-grovio-surface-raised border-b border-grovio-border">
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center gap-4 min-h-[64px]">
          {/* Logo */}
          <Link
            to="/"
            className="flex-shrink-0 text-xl font-bold text-grovio-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
          >
            Grovio
          </Link>

          {/* Desktop search bar — hidden on mobile */}
          <form
            onSubmit={handleSearchSubmit}
            className="hidden md:flex flex-1 max-w-xl mx-auto"
          >
            <div className="relative w-full">
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, brands, and more…"
                aria-label="Search for products"
                className="w-full h-12 pl-4 pr-10 rounded-md border border-grovio-border bg-grovio-surface text-grovio-text text-sm focus:outline-none focus:ring-2 focus:ring-grovio-primary"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grovio-text-muted hover:text-grovio-text focus-visible:outline-none"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </form>

          {/* Right icon group */}
          <nav className="ml-auto flex items-center gap-1" aria-label="Site navigation">
            {/* Mobile search icon button — hidden on md+ */}
            <button
              type="button"
              onClick={() => setMobileSearchOpen((prev) => !prev)}
              aria-label="Search"
              aria-expanded={mobileSearchOpen}
              className="md:hidden flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
            >
              <Search className="h-5 w-5" aria-hidden="true" />
            </button>

            {/* Wishlist icon (authenticated only) */}
            {isAuthenticated && (
              <Link
                to="/account/wishlist"
                aria-label="My wishlist"
                className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
              >
                <Heart className="h-5 w-5" aria-hidden="true" />
              </Link>
            )}

            {/* Notifications bell (authenticated only) */}
            {isAuthenticated && (
              <Link
                to="/account/notifications"
                aria-label="Notifications"
                className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
              >
                <Bell className="h-5 w-5" aria-hidden="true" />
              </Link>
            )}

            {/* Dark mode toggle */}
            <button
              type="button"
              onClick={toggleDarkMode}
              aria-label={isDark ? 'Switch to light mode' : 'Switch to dark mode'}
              aria-pressed={isDark}
              className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
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

            {/* Account icon button */}
            <Link
              to={isAuthenticated ? '/account/profile' : '/auth/login'}
              aria-label="Account"
              className="flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
            >
              <User className="h-5 w-5" aria-hidden="true" />
            </Link>

            {/* Cart link with live item count badge (Phase 5 — D-04) */}
            <Link
              to="/cart"
              aria-label={itemCount > 0 ? `View cart (${itemCount} items)` : 'View cart'}
              className="relative flex items-center justify-center min-h-[48px] min-w-[48px] rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
            >
              <ShoppingCart className="h-5 w-5" aria-hidden="true" />
              {itemCount > 0 && (
                <span
                  aria-hidden="true"
                  className="absolute top-1.5 right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-grovio-primary px-1 text-[10px] font-bold text-white leading-none tabular-nums"
                >
                  {itemCount > 99 ? '99+' : itemCount}
                </span>
              )}
            </Link>
          </nav>
        </div>

        {/* Mobile search bar — expands below header row */}
        {mobileSearchOpen && (
          <div className="md:hidden pb-3">
            <form onSubmit={handleSearchSubmit} className="relative">
              <input
                type="search"
                autoFocus
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Search for products, brands, and more…"
                aria-label="Search for products"
                className="w-full h-10 pl-4 pr-10 rounded-md border border-grovio-border bg-grovio-surface text-grovio-text text-sm focus:outline-none focus:ring-2 focus:ring-grovio-primary"
              />
              <button
                type="submit"
                aria-label="Submit search"
                className="absolute inset-y-0 right-0 flex items-center px-3 text-grovio-text-muted hover:text-grovio-text focus-visible:outline-none"
              >
                <Search className="h-4 w-4" aria-hidden="true" />
              </button>
            </form>
          </div>
        )}
      </div>
    </header>
  );
}
