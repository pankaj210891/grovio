/**
 * PanelLayout — root shell for the admin panel.
 *
 * Renders: Sidebar (left) + Header (top) + animated Outlet (main content).
 *
 * IMPORTANT: Uses framer-motion (not motion/react) per PATTERNS.md — web-admin convention.
 */

import { AnimatePresence } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { Header } from './Header.js';
import { Sidebar } from './Sidebar.js';

export function PanelLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-grovio-surface text-grovio-text">
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto">
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
