/**
 * App — admin panel router (Phase 11, T4).
 *
 * Route structure:
 *   /auth/login              — public login page
 *   /                        — ProtectedAdminRoute → PanelLayout
 *     index                  → redirect to /dashboard
 *     /dashboard             — DashboardPage (redesigned, Phase 11 T5)
 *     /vendors               — VendorsPage (redesigned, Phase 11 T7)
 *     /vendors/:id           — VendorProfilePage (new, Phase 11 T7)
 *     /catalog-moderation    — CatalogModerationPage
 *     /catalog-moderation/import — Bulk import page (Phase 11 T12)
 *     /finance               — FinancePage (new, Phase 11 T8, replaces commission-rules + payout-management)
 *     /orders                — OrdersPage (Phase 11 T9)
 *     /insights              — InsightsPage (new, Phase 11 T6)
 *     /support               — SupportPage (new, Phase 11 T10)
 *     /support/:id           — SupportTicketPage (new, Phase 11 T10)
 *     /cms                   — CmsPage
 *     /feature-flags         — FeatureFlagsPage
 *     /settings              — SettingsPage
 *     /audit-log             — AuditLogPage (renamed from Audit Log)
 *     /categories            — CategoryListPage (Phase 2 — PRESERVED)
 *     /categories/:id        — CategoryDetailPage (Phase 2 — PRESERVED)
 *
 * All page routes use React.lazy for code splitting (T8 performance).
 */

import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedAdminRoute } from './components/layout/ProtectedAdminRoute.js';

// Eager: auth page (small, needed immediately)
import { LoginPage } from './pages/auth/LoginPage.js';

// Lazy: all admin panel pages (code-split)
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.js').then(m => ({ default: m.DashboardPage })));
const VendorsPage = React.lazy(() => import('./pages/VendorsPage.js').then(m => ({ default: m.VendorsPage })));
const VendorProfilePage = React.lazy(() => import('./pages/VendorProfilePage.js').then(m => ({ default: m.VendorProfilePage })));
const CatalogModerationPage = React.lazy(() => import('./pages/CatalogModerationPage.js').then(m => ({ default: m.CatalogModerationPage })));
const BulkImportPage = React.lazy(() => import('./pages/BulkImportPage.js').then(m => ({ default: m.BulkImportPage })));
const FinancePage = React.lazy(() => import('./pages/FinancePage.js').then(m => ({ default: m.FinancePage })));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.js').then(m => ({ default: m.OrdersPage })));
const InsightsPage = React.lazy(() => import('./pages/InsightsPage.js').then(m => ({ default: m.InsightsPage })));
const SupportPage = React.lazy(() => import('./pages/SupportPage.js').then(m => ({ default: m.SupportPage })));
const SupportTicketPage = React.lazy(() => import('./pages/SupportTicketPage.js').then(m => ({ default: m.SupportTicketPage })));
const CmsPage = React.lazy(() => import('./pages/CmsPage.js').then(m => ({ default: m.CmsPage })));
const FeatureFlagsPage = React.lazy(() => import('./pages/FeatureFlagsPage.js').then(m => ({ default: m.FeatureFlagsPage })));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage.js').then(m => ({ default: m.SettingsPage })));
const AuditLogPage = React.lazy(() => import('./pages/AuditLogPage.js').then(m => ({ default: m.AuditLogPage })));
const CategoryListPage = React.lazy(() => import('./pages/categories/CategoryListPage.js'));
const CategoryDetailPage = React.lazy(() => import('./pages/categories/CategoryDetailPage.js'));

// Minimal loading spinner used as Suspense fallback
const PageSkeleton = () => (
  <div className="flex min-h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" aria-label="Loading page" />
  </div>
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  // Public — login
  {
    path: '/auth/login',
    element: <LoginPage />,
  },

  // Protected — full admin panel shell
  {
    path: '/',
    element: <ProtectedAdminRoute />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          // Root redirect to dashboard
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // Core admin pages (all lazy)
          { path: 'dashboard', element: <LazyPage><DashboardPage /></LazyPage> },
          { path: 'vendors', element: <LazyPage><VendorsPage /></LazyPage> },
          { path: 'vendors/:id', element: <LazyPage><VendorProfilePage /></LazyPage> },
          { path: 'catalog-moderation', element: <LazyPage><CatalogModerationPage /></LazyPage> },
          { path: 'catalog-moderation/import', element: <LazyPage><BulkImportPage /></LazyPage> },
          { path: 'finance', element: <LazyPage><FinancePage /></LazyPage> },
          { path: 'orders', element: <LazyPage><OrdersPage /></LazyPage> },
          { path: 'insights', element: <LazyPage><InsightsPage /></LazyPage> },
          { path: 'support', element: <LazyPage><SupportPage /></LazyPage> },
          { path: 'support/:id', element: <LazyPage><SupportTicketPage /></LazyPage> },
          { path: 'cms', element: <LazyPage><CmsPage /></LazyPage> },
          { path: 'feature-flags', element: <LazyPage><FeatureFlagsPage /></LazyPage> },
          { path: 'settings', element: <LazyPage><SettingsPage /></LazyPage> },
          { path: 'audit-log', element: <LazyPage><AuditLogPage /></LazyPage> },

          // Phase 2 category routes — PRESERVED (must not be deleted)
          { path: 'categories', element: <LazyPage><CategoryListPage /></LazyPage> },
          { path: 'categories/:id', element: <LazyPage><CategoryDetailPage /></LazyPage> },

          // Catch-all inside panel — redirect to dashboard
          { path: '*', element: <Navigate to="/dashboard" replace /> },
        ],
      },
    ],
  },
]);

export default function App() {
  return <RouterProvider router={router} />;
}
