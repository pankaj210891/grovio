/**
 * CmsPage — homepage / CMS content management (Phase 11).
 *
 * Manages: hero banners, featured categories, promotional sections.
 * Stub implementation — content management fully operational in a future phase.
 */

import { motion } from 'framer-motion';

export function CmsPage() {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      <div>
        <h1 className="text-2xl font-bold text-grovio-text">CMS / Homepage</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">Manage homepage banners, featured sections, and promotional content</p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {['Hero Banners', 'Featured Categories', 'Promotional Sections'].map((section) => (
          <div
            key={section}
            className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5"
          >
            <h2 className="text-sm font-semibold text-grovio-text">{section}</h2>
            <p className="mt-2 text-xs text-grovio-text-muted">
              No items configured. CMS editor available in a future update.
            </p>
            <button
              type="button"
              disabled
              className="mt-4 rounded-lg border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted opacity-50 cursor-not-allowed"
            >
              + Add Item
            </button>
          </div>
        ))}
      </div>

      <div className="rounded-xl border border-amber-200 bg-amber-50 p-4 text-sm text-amber-700">
        Full CMS editor with drag-and-drop ordering, image upload, and live preview is planned for Phase 12.
      </div>
    </motion.div>
  );
}
