import React, { Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { CheckoutRootGuard } from './components/checkout/CheckoutGuard.js';

// Lazy page imports (code-split — T8 performance optimization)
const HomePage = React.lazy(() => import('./pages/HomePage.js'));
const CategoryPage = React.lazy(() => import('./pages/CategoryPage.js'));
const SearchPage = React.lazy(() => import('./pages/SearchPage.js'));
const ProductDetailPage = React.lazy(() => import('./pages/ProductDetailPage.js'));
const CartPage = React.lazy(() => import('./pages/CartPage.js'));
const CheckoutPage = React.lazy(() => import('./pages/checkout/CheckoutPage.js'));
const OrderConfirmationPage = React.lazy(() => import('./pages/OrderConfirmationPage.js'));
const SignupPage = React.lazy(() => import('./pages/auth/SignupPage.js'));
const LoginPage = React.lazy(() => import('./pages/auth/LoginPage.js'));
const ForgotPasswordPage = React.lazy(() => import('./pages/auth/ForgotPasswordPage.js'));
const ResetPasswordPage = React.lazy(() => import('./pages/auth/ResetPasswordPage.js'));
const ProfilePage = React.lazy(() => import('./pages/account/ProfilePage.js'));
const AddressesPage = React.lazy(() => import('./pages/account/AddressesPage.js'));
const OrdersPage = React.lazy(() => import('./pages/account/OrdersPage.js'));
const OrderDetailPage = React.lazy(() => import('./pages/account/OrderDetailPage.js'));
const WalletPage = React.lazy(() => import('./pages/account/WalletPage.js'));
const WishlistPage = React.lazy(() => import('./pages/account/WishlistPage.js'));
const NotificationsPage = React.lazy(() => import('./pages/account/NotificationsPage.js'));

// Minimal page skeleton as Suspense fallback
const PageSkeleton = () => (
  <div className="flex min-h-screen items-center justify-center">
    <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" aria-label="Loading" />
  </div>
);

function LazyPage({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<PageSkeleton />}>{children}</Suspense>;
}

/**
 * Phase 11 route tree — React Router v7 createBrowserRouter.
 *
 * Root route: AppLayout (BottomNav + Header + AnimatePresence Outlet + Footer + Toast)
 * All pages are React.lazy for code splitting (T8 performance).
 *
 *   ├── /                       → HomePage
 *   ├── /category/:slug         → CategoryPage
 *   ├── /categories             → redirect to /search (browse all)
 *   ├── /search                 → SearchPage (+ /search?q=...)
 *   ├── /products/:slug         → ProductDetailPage
 *   ├── /cart                   → CartPage
 *   ├── /checkout               → CheckoutRootGuard (auth + non-empty basket)
 *   │     └── (index)           → CheckoutPage (one-page accordion)
 *   ├── /checkout/address       → redirect to /checkout (legacy)
 *   ├── /checkout/delivery      → redirect to /checkout (legacy)
 *   ├── /checkout/payment       → redirect to /checkout (legacy)
 *   ├── /checkout/review        → redirect to /checkout (legacy)
 *   ├── /order-confirmation/:orderId → OrderConfirmationPage
 *   ├── /auth/signup            → SignupPage
 *   ├── /auth/login             → LoginPage
 *   ├── /auth/forgot-password   → ForgotPasswordPage
 *   ├── /auth/reset-password    → ResetPasswordPage
 *   └── /account                → ProtectedRoute
 *         ├── /account/profile   → ProfilePage
 *         ├── /account/addresses → AddressesPage
 *         ├── /account/orders    → OrdersPage
 *         ├── /account/orders/:id → OrderDetailPage
 *         ├── /account/wallet   → WalletPage
 *         ├── /account/wishlist → WishlistPage
 *         └── /account/notifications → NotificationsPage
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <LazyPage><HomePage /></LazyPage> },
      { path: 'category/:slug', element: <LazyPage><CategoryPage /></LazyPage> },
      // /categories is a BottomNav tab — redirect to search for browsing
      { path: 'categories', element: <Navigate to="/search" replace /> },
      { path: 'search', element: <LazyPage><SearchPage /></LazyPage> },
      { path: 'products/:slug', element: <LazyPage><ProductDetailPage /></LazyPage> },
      { path: 'cart', element: <LazyPage><CartPage /></LazyPage> },

      // ── Checkout (Phase 11: single-page accordion) ──────────────────────
      {
        path: 'checkout',
        element: <CheckoutRootGuard />,
        children: [
          { index: true, element: <LazyPage><CheckoutPage /></LazyPage> },
        ],
      },

      // ── Legacy checkout URL redirects ─────────────────────────────────
      { path: 'checkout/address', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/delivery', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/payment', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/review', element: <Navigate to="/checkout" replace /> },

      // ── Order confirmation ──────────────────────────────────────────────
      { path: 'order-confirmation/:orderId', element: <LazyPage><OrderConfirmationPage /></LazyPage> },

      // ── Auth pages ──────────────────────────────────────────────────────
      { path: 'auth/signup', element: <LazyPage><SignupPage /></LazyPage> },
      { path: 'auth/login', element: <LazyPage><LoginPage /></LazyPage> },
      { path: 'auth/forgot-password', element: <LazyPage><ForgotPasswordPage /></LazyPage> },
      { path: 'auth/reset-password', element: <LazyPage><ResetPasswordPage /></LazyPage> },

      // ── Account (authenticated) ─────────────────────────────────────────
      {
        path: 'account',
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <LazyPage><ProfilePage /></LazyPage> },
          { path: 'addresses', element: <LazyPage><AddressesPage /></LazyPage> },
          { path: 'orders', element: <LazyPage><OrdersPage /></LazyPage> },
          { path: 'orders/:id', element: <LazyPage><OrderDetailPage /></LazyPage> },
          { path: 'wallet', element: <LazyPage><WalletPage /></LazyPage> },
          { path: 'wishlist', element: <LazyPage><WishlistPage /></LazyPage> },
          { path: 'notifications', element: <LazyPage><NotificationsPage /></LazyPage> },
        ],
      },
    ],
  },
]);
