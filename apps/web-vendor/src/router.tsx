/**
 * Vendor panel router.
 *
 * Public routes:   /auth/login, /accept-invite
 * Protected routes (vendor session required):
 *   /dashboard, /products, /products/new (CreateProductWizard),
 *   /inventory, /orders, /returns, /finance, /analytics, /coupons
 *   /earnings → redirects to /finance (backward compat)
 * Owner-only routes (requiredRole="owner"):
 *   /team, /store-profile, /settings
 *
 * Index (/) redirects to /dashboard.
 */

import React from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedVendorRoute } from './components/layout/ProtectedVendorRoute.js';

// Lazy page imports (code-split)
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage.js'));
const AcceptInvitePage = React.lazy(() => import('./pages/auth/AcceptInvitePage.js'));
const DashboardPage = React.lazy(() => import('./pages/DashboardPage.js'));
const ProductsPage = React.lazy(() => import('./pages/ProductsPage.js'));
const CreateProductWizard = React.lazy(() => import('./components/products/CreateProductWizard.js'));
const InventoryPage = React.lazy(() => import('./pages/InventoryPage.js'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.js'));
const ReturnsPage = React.lazy(() => import('./pages/ReturnsPage.js'));
const FinancePage = React.lazy(() => import('./pages/FinancePage.js'));
const AnalyticsPage = React.lazy(() => import('./pages/AnalyticsPage.js'));
const EarningsPage = React.lazy(() => import('./pages/EarningsPage.js'));
const CouponsPage = React.lazy(() => import('./pages/CouponsPage.js'));
const TeamPage = React.lazy(() => import('./pages/TeamPage.js'));
const StoreProfilePage = React.lazy(() => import('./pages/StoreProfilePage.js'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage.js'));

// Minimal loading spinner used as Suspense fallback during lazy chunk loading
const spinner = (
  <div className="flex min-h-64 items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
  </div>
);

export const router = createBrowserRouter([
  // ── Public routes ──────────────────────────────────────────────────────────
  {
    path: '/auth/login',
    element: (
      <React.Suspense fallback={spinner}>
        <LoginPage />
      </React.Suspense>
    ),
  },
  {
    path: '/accept-invite',
    element: (
      <React.Suspense fallback={spinner}>
        <AcceptInvitePage />
      </React.Suspense>
    ),
  },

  // ── Protected panel routes ─────────────────────────────────────────────────
  {
    path: '/',
    element: <ProtectedVendorRoute />,
    children: [
      {
        element: <PanelLayout />,
        children: [
          // Root → redirect to dashboard
          { index: true, element: <Navigate to="/dashboard" replace /> },

          // All-role sections
          {
            path: 'dashboard',
            element: (
              <React.Suspense fallback={spinner}>
                <DashboardPage />
              </React.Suspense>
            ),
          },
          {
            path: 'products',
            element: (
              <React.Suspense fallback={spinner}>
                <ProductsPage />
              </React.Suspense>
            ),
          },
          {
            // New product wizard — /products/new (Plan 11-03, T3)
            path: 'products/new',
            element: (
              <React.Suspense fallback={spinner}>
                <CreateProductWizard />
              </React.Suspense>
            ),
          },
          {
            path: 'inventory',
            element: (
              <React.Suspense fallback={spinner}>
                <InventoryPage />
              </React.Suspense>
            ),
          },
          {
            path: 'orders',
            element: (
              <React.Suspense fallback={spinner}>
                <OrdersPage />
              </React.Suspense>
            ),
          },
          {
            path: 'returns',
            element: (
              <React.Suspense fallback={spinner}>
                <ReturnsPage />
              </React.Suspense>
            ),
          },
          {
            // Finance center (Plan 11-03, T5)
            path: 'finance',
            element: (
              <React.Suspense fallback={spinner}>
                <FinancePage />
              </React.Suspense>
            ),
          },
          {
            // Analytics page (Plan 11-03, T6)
            path: 'analytics',
            element: (
              <React.Suspense fallback={spinner}>
                <AnalyticsPage />
              </React.Suspense>
            ),
          },
          {
            // Legacy /earnings → /finance redirect (backward compat)
            path: 'earnings',
            element: <Navigate to="/finance" replace />,
          },
          {
            path: 'coupons',
            element: (
              <React.Suspense fallback={spinner}>
                <CouponsPage />
              </React.Suspense>
            ),
          },

          // Owner-only sections — wrapped in a ProtectedVendorRoute role guard
          {
            element: <ProtectedVendorRoute requiredRole="owner" />,
            children: [
              {
                path: 'team',
                element: (
                  <React.Suspense fallback={spinner}>
                    <TeamPage />
                  </React.Suspense>
                ),
              },
              {
                path: 'store-profile',
                element: (
                  <React.Suspense fallback={spinner}>
                    <StoreProfilePage />
                  </React.Suspense>
                ),
              },
              {
                path: 'settings',
                element: (
                  <React.Suspense fallback={spinner}>
                    <SettingsPage />
                  </React.Suspense>
                ),
              },
            ],
          },
        ],
      },
    ],
  },

  // ── Catch-all ──────────────────────────────────────────────────────────────
  {
    path: '*',
    element: <Navigate to="/dashboard" replace />,
  },
]);
