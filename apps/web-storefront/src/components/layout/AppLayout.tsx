import { AnimatePresence } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header.js';
import { Footer } from './Footer.js';
import { BottomNav } from './BottomNav.js';
import { ComparisonTray } from '../ui/ComparisonTray.js';
import { ToastContainer } from '../ui/Toast.js';

/**
 * Application shell layout.
 *
 * Renders the semantic <header>, <main>, and <footer> landmarks.
 * AnimatePresence mode="wait" wraps the Outlet — keyed by location.pathname
 * so route changes trigger the exit animation of the outgoing page before
 * mounting the incoming one (RESEARCH.md Pattern 5).
 *
 * Each page renders <PageTransition> as its root element so the exit motion
 * is detectable by AnimatePresence (Pitfall 3 guard).
 *
 * Toast container is rendered here (reads from 04-06 ui-store).
 */
export function AppLayout() {
  const location = useLocation();

  return (
    <div className="flex min-h-screen flex-col bg-grovio-surface">
      {/* Skip to main content — visible on focus for keyboard/screen-reader users (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:ring-2 focus:ring-grovio-primary focus:outline-none"
      >
        Skip to main content
      </a>

      <Header />

      {/* pb-16 on mobile provides clearance above the 56px BottomNav; md:pb-0 removes it on desktop */}
      <main id="main-content" className="flex-1 pb-16 md:pb-0" tabIndex={-1}>
        <AnimatePresence mode="wait">
          {/* key= forces AnimatePresence to unmount/remount on route change */}
          <div key={location.pathname}>
            <Outlet />
          </div>
        </AnimatePresence>
      </main>

      <Footer />

      {/* Mobile bottom navigation (hidden md+) */}
      <BottomNav />

      {/* Comparison tray — always mounted, visible when products selected */}
      <ComparisonTray />

      {/* Toast notifications — fixed position, top-right */}
      <ToastContainer />
    </div>
  );
}
