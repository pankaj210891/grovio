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
 * REMOVED routes (Phase 11):
 *   /commission-rules        — moved into /finance (Finance tab: Commissions)
 *   /payout-management       — moved into /finance (Finance tab: Payouts)
 */

import { createBrowserRouter, Navigate, RouterProvider } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedAdminRoute } from './components/layout/ProtectedAdminRoute.js';
import { LoginPage } from './pages/auth/LoginPage.js';
import CategoryDetailPage from './pages/categories/CategoryDetailPage.js';
import CategoryListPage from './pages/categories/CategoryListPage.js';
import { DashboardPage } from './pages/DashboardPage.js';
import { VendorsPage } from './pages/VendorsPage.js';
import { VendorProfilePage } from './pages/VendorProfilePage.js';
import { CatalogModerationPage } from './pages/CatalogModerationPage.js';
import { FinancePage } from './pages/FinancePage.js';
import { OrdersPage } from './pages/OrdersPage.js';
import { InsightsPage } from './pages/InsightsPage.js';
import { SupportPage } from './pages/SupportPage.js';
import { SupportTicketPage } from './pages/SupportTicketPage.js';
import { CmsPage } from './pages/CmsPage.js';
import { FeatureFlagsPage } from './pages/FeatureFlagsPage.js';
import { SettingsPage } from './pages/SettingsPage.js';
import { AuditLogPage } from './pages/AuditLogPage.js';
import { BulkImportPage } from './pages/BulkImportPage.js';

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

          // Core admin pages
          { path: 'dashboard', element: <DashboardPage /> },
          { path: 'vendors', element: <VendorsPage /> },
          { path: 'vendors/:id', element: <VendorProfilePage /> },
          { path: 'catalog-moderation', element: <CatalogModerationPage /> },
          { path: 'catalog-moderation/import', element: <BulkImportPage /> },
          { path: 'finance', element: <FinancePage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'insights', element: <InsightsPage /> },
          { path: 'support', element: <SupportPage /> },
          { path: 'support/:id', element: <SupportTicketPage /> },
          { path: 'cms', element: <CmsPage /> },
          { path: 'feature-flags', element: <FeatureFlagsPage /> },
          { path: 'settings', element: <SettingsPage /> },
          { path: 'audit-log', element: <AuditLogPage /> },

          // Phase 2 category routes — PRESERVED (must not be deleted)
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
