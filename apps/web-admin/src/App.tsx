/**
 * App — admin panel router.
 *
 * Migrated from Phase 2 <Routes> pattern to createBrowserRouter + RouterProvider.
 * Preserves Phase 2 category routes (/categories and /categories/:id) under PanelLayout.
 *
 * Route structure:
 *   /auth/login          — public login page
 *   /                    — ProtectedAdminRoute → PanelLayout
 *     index              → redirect to /dashboard
 *     /dashboard         — DashboardPage (ADM-01)
 *     /vendors           — VendorsPage (ADM-02)
 *     /catalog-moderation — CatalogModerationPage (ADM-07)
 *     /commission-rules  — CommissionRulesPage (ADM-03)
 *     /payout-management — PayoutManagementPage (MKT-04)
 *     /cms               — CmsPage (ADM-04)
 *     /feature-flags     — FeatureFlagsPage (ADM-06)
 *     /settings          — SettingsPage (ADM-05)
 *     /audit-log         — AuditLogPage (ADM-07)
 *     /categories        — CategoryListPage (Phase 2 — preserved)
 *     /categories/:id    — CategoryDetailPage (Phase 2 — preserved)
 */

import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedAdminRoute } from './components/layout/ProtectedAdminRoute.js';
import CategoryDetailPage from './pages/categories/CategoryDetailPage.js';
import CategoryListPage from './pages/categories/CategoryListPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { CatalogModerationPage } from './pages/CatalogModerationPage.js';
import { CmsPage } from './pages/CmsPage.js';
import { CommissionRulesPage } from './pages/CommissionRulesPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage.js';
import { PayoutManagementPage } from './pages/PayoutManagementPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { VendorsPage } from './pages/VendorsPage.js';
import { LoginPage } from './pages/auth/LoginPage.js';

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

          // Admin control-plane pages (ADM-01 through ADM-07 + MKT-04)
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'vendors', element: <VendorsPage /> },
          { path: 'catalog-moderation', element: <CatalogModerationPage /> },
          { path: 'commission-rules', element: <CommissionRulesPage /> },
          { path: 'payout-management', element: <PayoutManagementPage /> },
          { path: 'cms', element: <CmsPage /> },
          { path: 'feature-flags', element: <FeatureFlagsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'audit-log', element: <AuditLogPage /> },

          // Phase 2 category routes — preserved under PanelLayout (MUST NOT be deleted)
          { path: 'categories', element: <CategoryListPage /> },
          { path: 'categories/:id', element: <CategoryDetailPage /> },

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
