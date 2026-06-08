/**
 * PanelLayout — root shell for the admin panel (Phase 11, T4).
 *
 * Structure:
 *   CommandBar (56px fixed top bar, z-50)
 *   └─ flex-row: Sidebar (left, fixed width) + animated Outlet (main content)
 *
 * The CommandBar is placed ABOVE the sidebar+content layout.
 * Content height accounts for the 56px CommandBar via flex-col.
 */

import { AnimatePresence } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { CommandBar } from './CommandBar.js';
import { Sidebar } from './Sidebar.js';

export function PanelLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-grovio-surface text-grovio-text">
      {/* Skip to main content (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:ring-2 focus:ring-grovio-primary focus:outline-none"
      >
        Skip to main content
      </a>

      {/* Command bar — fixed top row (56px height accounted for via flex) */}
      <CommandBar />

      {/* Sidebar + content row — fills remaining height */}
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <div key={location.pathname} className="h-full p-6">
              <Outlet />
            </div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
