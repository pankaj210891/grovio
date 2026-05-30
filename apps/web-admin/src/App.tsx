import { motion } from 'framer-motion';
import { Navigate, Route, Routes } from 'react-router-dom';
import CategoryDetailPage from './pages/categories/CategoryDetailPage.js';
import CategoryListPage from './pages/categories/CategoryListPage.js';

export default function App() {
  return (
    <div className="min-h-screen bg-grovio-surface text-grovio-text">
      {/* Top navigation bar */}
      <header className="border-b border-grovio-border bg-grovio-surface-raised px-6 py-4">
        <motion.div
          className="flex items-center gap-3"
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.35 }}
        >
          <span className="rounded-md bg-grovio-primary px-3 py-1 text-lg font-bold text-white">
            Grovio
          </span>
          <span className="text-sm font-medium text-grovio-text-muted">Admin Panel</span>
        </motion.div>
      </header>

      {/* Page content */}
      <main className="mx-auto max-w-6xl px-6 py-8">
        <Routes>
          {/* Redirect root to categories */}
          <Route path="/" element={<Navigate to="/categories" replace />} />

          {/* Category list / tree view */}
          <Route path="/categories" element={<CategoryListPage />} />

          {/* Category detail / edit */}
          <Route path="/categories/:id" element={<CategoryDetailPage />} />

          {/* Catch-all redirect */}
          <Route path="*" element={<Navigate to="/categories" replace />} />
        </Routes>
      </main>
    </div>
  );
}
