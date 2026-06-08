import { createBrowserRouter, Navigate } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { CheckoutRootGuard } from './components/checkout/CheckoutGuard.js';
import HomePage from './pages/HomePage.js';
import CategoryPage from './pages/CategoryPage.js';
import SearchPage from './pages/SearchPage.js';
import ProductDetailPage from './pages/ProductDetailPage.js';
import CartPage from './pages/CartPage.js';
// Phase 11 one-page checkout
import CheckoutPage from './pages/checkout/CheckoutPage.js';
// Post-checkout
import OrderConfirmationPage from './pages/OrderConfirmationPage.js';
// Account pages
import SignupPage from './pages/auth/SignupPage.js';
import LoginPage from './pages/auth/LoginPage.js';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.js';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.js';
import ProfilePage from './pages/account/ProfilePage.js';
import AddressesPage from './pages/account/AddressesPage.js';
import OrdersPage from './pages/account/OrdersPage.js';
import OrderDetailPage from './pages/account/OrderDetailPage.js';
import WalletPage from './pages/account/WalletPage.js';
import WishlistPage from './pages/account/WishlistPage.js';
import NotificationsPage from './pages/account/NotificationsPage.js';

/**
 * Phase 11 route tree — React Router v7 createBrowserRouter.
 *
 * Root route: AppLayout (BottomNav + Header + AnimatePresence Outlet + Footer + Toast)
 *   ├── /                       → HomePage
 *   ├── /category/:slug         → CategoryPage
 *   ├── /categories             → redirect to /search (browse all)
 *   ├── /search                 → SearchPage (+ /search?q=...)
 *   ├── /products/:slug         → ProductDetailPage
 *   ├── /cart                   → CartPage
 *   ├── /checkout               → CheckoutRootGuard (auth + non-empty basket)
 *   │     └── (index)           → CheckoutPage (one-page accordion — Phase 11 T7)
 *   ├── /checkout/address       → redirect to /checkout (legacy Phase 5 URL)
 *   ├── /checkout/delivery      → redirect to /checkout (legacy Phase 5 URL)
 *   ├── /checkout/payment       → redirect to /checkout (legacy Phase 5 URL)
 *   ├── /checkout/review        → redirect to /checkout (legacy Phase 5 URL)
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
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      // /categories is a BottomNav tab — redirect to search for browsing
      { path: 'categories', element: <Navigate to="/search" replace /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      { path: 'cart', element: <CartPage /> },

      // ── Checkout (Phase 11: single-page accordion — T7) ──────────────────
      {
        path: 'checkout',
        element: <CheckoutRootGuard />,
        children: [
          { index: true, element: <CheckoutPage /> },
        ],
      },

      // ── Legacy checkout URL redirects (Phase 5 bookmarks / links) ────────
      { path: 'checkout/address', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/delivery', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/payment', element: <Navigate to="/checkout" replace /> },
      { path: 'checkout/review', element: <Navigate to="/checkout" replace /> },

      // ── Order confirmation ───────────────────────────────────────────────
      { path: 'order-confirmation/:orderId', element: <OrderConfirmationPage /> },

      // ── Auth pages ───────────────────────────────────────────────────────
      { path: 'auth/signup', element: <SignupPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: 'auth/reset-password', element: <ResetPasswordPage /> },

      // ── Account (authenticated) ──────────────────────────────────────────
      {
        path: 'account',
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'wallet', element: <WalletPage /> },
          { path: 'wishlist', element: <WishlistPage /> },
          { path: 'notifications', element: <NotificationsPage /> },
        ],
      },
    ],
  },
]);
