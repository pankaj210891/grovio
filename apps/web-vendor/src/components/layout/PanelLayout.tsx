/**
 * Vendor panel shell layout.
 *
 * Renders the persistent Sidebar, top Header, and the animated content Outlet.
 * AnimatePresence mode="wait" wraps the Outlet keyed on location.pathname so
 * route changes play the exit animation before mounting the incoming page.
 *
 * Also renders the Toast notification queue from uiStore.
 */

import { AnimatePresence, motion } from 'motion/react';
import { Outlet, useLocation } from 'react-router-dom';
import { Sidebar } from './Sidebar.js';
import { Header } from './Header.js';
import { useUiStore } from '../../stores/uiStore.js';

function ToastContainer() {
  const { toasts, removeToast } = useUiStore();
  return (
    <div className="fixed right-4 top-4 z-50 flex flex-col gap-2">
      <AnimatePresence>
        {toasts.map((toast) => (
          <motion.div
            key={toast.id}
            initial={{ opacity: 0, x: 32 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 32 }}
            transition={{ type: 'spring', damping: 24, stiffness: 300 }}
            className={[
              'flex items-start gap-3 rounded-xl border px-4 py-3 text-sm shadow-lg',
              toast.variant === 'error'
                ? 'border-grovio-error/30 bg-grovio-error/10 text-grovio-error'
                : toast.variant === 'success'
                  ? 'border-green-300/50 bg-green-50 text-green-800'
                  : 'border-grovio-border bg-grovio-surface-raised text-grovio-text',
            ].join(' ')}
          >
            <span className="flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => removeToast(toast.id)}
              className="shrink-0 text-grovio-text-muted transition-colors hover:text-grovio-text"
              aria-label="Dismiss"
            >
              ✕
            </button>
          </motion.div>
        ))}
      </AnimatePresence>
    </div>
  );
}

export function PanelLayout() {
  const location = useLocation();

  return (
    <div className="flex h-screen overflow-hidden bg-grovio-surface">
      {/* Skip to main content (WCAG 2.4.1) */}
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:bg-background focus:px-4 focus:py-2 focus:rounded-md focus:text-sm focus:font-medium focus:ring-2 focus:ring-grovio-primary focus:outline-none"
      >
        Skip to main content
      </a>

      <Sidebar />

      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />

        <main id="main-content" className="flex-1 overflow-auto p-6" tabIndex={-1}>
          <AnimatePresence mode="wait">
            <div key={location.pathname}>
              <Outlet />
            </div>
          </AnimatePresence>
        </main>
      </div>

      <ToastContainer />
    </div>
  );
}
