/**
 * Vendor panel router.
 *
 * Public routes:   /auth/login, /accept-invite
 * Protected routes (vendor session required):
 *   /dashboard, /products, /inventory, /orders, /returns, /earnings, /coupons
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
const InventoryPage = React.lazy(() => import('./pages/InventoryPage.js'));
const OrdersPage = React.lazy(() => import('./pages/OrdersPage.js'));
const ReturnsPage = React.lazy(() => import('./pages/ReturnsPage.js'));
const EarningsPage = React.lazy(() => import('./pages/EarningsPage.js'));
const CouponsPage = React.lazy(() => import('./pages/CouponsPage.js'));
const TeamPage = React.lazy(() => import('./pages/TeamPage.js'));
const StoreProfilePage = React.lazy(() => import('./pages/StoreProfilePage.js'));
const SettingsPage = React.lazy(() => import('./pages/SettingsPage.js'));

function PageFallback() {
  return (
    <div className="flex min-h-64 items-center justify-center">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
    </div>
  );
}

export const router = createBrowserRouter([
  // ── Public routes ──────────────────────────────────────────────────────────
  {
    path: '/auth/login',
    element: (
      <React.Suspense fallback={<PageFallback />}>
        <LoginPage />
      </React.Suspense>
    ),
  },
  {
    path: '/accept-invite',
    element: (
      <React.Suspense fallback={<PageFallback />}>
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
              <React.Suspense fallback={<PageFallback />}>
                <DashboardPage />
              </React.Suspense>
            ),
          },
          {
            path: 'products',
            element: (
              <React.Suspense fallback={<PageFallback />}>
                <ProductsPage />
              </React.Suspense>
            ),
          },
          {
            path: 'inventory',
            element: (
              <React.Suspense fallback={<PageFallback />}>
                <InventoryPage />
              </React.Suspense>
            ),
          },
          {
            path: 'orders',
            element: (
              <React.Suspense fallback={<PageFallback />}>
                <OrdersPage />
              </React.Suspense>
            ),
          },
          {
            path: 'returns',
            element: (
              <React.Suspense fallback={<PageFallback />}>
                <ReturnsPage />
              </React.Suspense>
            ),
          },
          {
            path: 'earnings',
            element: (
              <React.Suspense fallback={<PageFallback />}>
                <EarningsPage />
              </React.Suspense>
            ),
          },
          {
            path: 'coupons',
            element: (
              <React.Suspense fallback={<PageFallback />}>
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
                  <React.Suspense fallback={<PageFallback />}>
                    <TeamPage />
                  </React.Suspense>
                ),
              },
              {
                path: 'store-profile',
                element: (
                  <React.Suspense fallback={<PageFallback />}>
                    <StoreProfilePage />
                  </React.Suspense>
                ),
              },
              {
                path: 'settings',
                element: (
                  <React.Suspense fallback={<PageFallback />}>
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
