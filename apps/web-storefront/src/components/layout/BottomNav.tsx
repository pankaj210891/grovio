import { Link, useLocation } from 'react-router-dom';
import { Home, Grid3X3, Search, ShoppingCart, User } from 'lucide-react';
import { motion } from 'motion/react';
import { useBasket } from '../../hooks/useBasket.js';

/**
 * Mobile bottom navigation bar — visible only on <md breakpoints.
 *
 * Design:
 * - Fixed bottom bar, height 56px, z-40 (below modals/drawers at z-50)
 * - 5 tabs: Home, Categories, Search, Cart, Account
 * - Active tab: filled icon + label in grovio-primary
 * - Cart badge: live item count from Zustand basket
 * - Notification badge on Account: placeholder 0 (Wave 5b wires real count)
 * - Thumb-friendly touch targets: min-h-[56px]
 */

interface NavTab {
  to: string;
  icon: React.ComponentType<{ className?: string; 'aria-hidden'?: boolean | 'true' | 'false' }>;
  label: string;
}

const TABS: NavTab[] = [
  { to: '/', icon: Home, label: 'Home' },
  { to: '/categories', icon: Grid3X3, label: 'Categories' },
  { to: '/search', icon: Search, label: 'Search' },
  { to: '/cart', icon: ShoppingCart, label: 'Cart' },
  { to: '/account', icon: User, label: 'Account' },
];

export function BottomNav() {
  const location = useLocation();
  const { itemCount } = useBasket();

  function isActive(to: string): boolean {
    if (to === '/') return location.pathname === '/';
    return location.pathname.startsWith(to);
  }

  return (
    <nav
      className="md:hidden fixed bottom-0 left-0 right-0 z-40 bg-grovio-surface-raised border-t border-grovio-border h-14"
      aria-label="Mobile navigation"
    >
      <div className="flex h-full">
        {TABS.map((tab) => {
          const active = isActive(tab.to);
          const Icon = tab.icon;
          const isCart = tab.to === '/cart';
          const isAccount = tab.to === '/account';

          return (
            <Link
              key={tab.to}
              to={tab.to}
              aria-label={tab.label}
              aria-current={active ? 'page' : undefined}
              className="flex-1 flex flex-col items-center justify-center gap-0.5 min-h-[56px] relative focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-inset"
            >
              <motion.div
                whileTap={{ scale: 0.85 }}
                transition={{ duration: 0.1 }}
                className="relative"
              >
                <Icon
                  className={`h-5 w-5 transition-colors duration-150 ${
                    active ? 'text-grovio-primary' : 'text-grovio-text-muted'
                  }`}
                  aria-hidden="true"
                />

                {/* Cart item count badge */}
                {isCart && itemCount > 0 && (
                  <span
                    aria-label={`${itemCount} items in cart`}
                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-grovio-primary px-1 text-[9px] font-bold text-white leading-none tabular-nums"
                  >
                    {itemCount > 99 ? '99+' : itemCount}
                  </span>
                )}

                {/* Account notification badge (placeholder — Wave 5b wires real count) */}
                {isAccount && 0 > 0 && (
                  <span
                    aria-label="unread notifications"
                    className="absolute -top-1.5 -right-1.5 flex h-4 min-w-[16px] items-center justify-center rounded-full bg-grovio-error px-1 text-[9px] font-bold text-white leading-none tabular-nums"
                  >
                    0
                  </span>
                )}
              </motion.div>

              <span
                className={`text-[10px] font-medium leading-none transition-colors duration-150 ${
                  active ? 'text-grovio-primary' : 'text-grovio-text-muted'
                }`}
              >
                {tab.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
