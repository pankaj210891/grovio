import { AnimatePresence, motion } from 'framer-motion';
import { Outlet, useLocation } from 'react-router-dom';
import { CommandBar } from './CommandBar.js';
import { Sidebar } from './Sidebar.js';

export function PanelLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen flex-col overflow-hidden bg-[#080c17] text-[#e8edff]">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-[100] focus:rounded-md focus:bg-[#0f1629] focus:px-4 focus:py-2 focus:text-sm focus:font-medium focus:ring-2 focus:ring-[#4f7ef8] focus:outline-none"
      >
        Skip to main content
      </a>

      <CommandBar />

      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <main id="main-content" className="flex-1 overflow-y-auto" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <motion.div
              key={location.pathname}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -8 }}
              transition={{ duration: 0.25, ease: [0.23, 1, 0.32, 1] }}
              className="min-h-full p-6"
            >
              <Outlet />
            </motion.div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
