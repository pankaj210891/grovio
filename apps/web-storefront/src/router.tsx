import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import { CheckoutRootGuard, CheckoutGuard } from './components/checkout/CheckoutGuard.js';
import HomePage from './pages/HomePage.js';
import CategoryPage from './pages/CategoryPage.js';
import SearchPage from './pages/SearchPage.js';
import ProductDetailPage from './pages/ProductDetailPage.js';
import CartPage from './pages/CartPage.js';
// Checkout step pages
import CheckoutAddressPage from './pages/checkout/CheckoutAddressPage.js';
import CheckoutDeliveryPage from './pages/checkout/CheckoutDeliveryPage.js';
import CheckoutPaymentPage from './pages/checkout/CheckoutPaymentPage.js';
import CheckoutReviewPage from './pages/checkout/CheckoutReviewPage.js';
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

/**
 * Phase 5 route tree — React Router v7 createBrowserRouter.
 *
 * Root route: AppLayout (Header + AnimatePresence Outlet + Footer + Toast)
 *   ├── /                       → HomePage
 *   ├── /category/:slug         → CategoryPage
 *   ├── /search                 → SearchPage (+ /search?q=...)
 *   ├── /products/:slug         → ProductDetailPage
 *   ├── /cart                   → CartPage (Phase 5 — D-24/D-25 basket)
 *   ├── /checkout               → CheckoutRootGuard (auth + non-empty basket)
 *   │     ├── /checkout/address → CheckoutAddressPage  (step 1, D-05)
 *   │     ├── /checkout/delivery → CheckoutDeliveryPage (step 2, D-05)
 *   │     ├── /checkout/payment → CheckoutPaymentPage  (step 3, PAY-04)
 *   │     └── /checkout/review  → CheckoutReviewPage   (step 4, D-05)
 *   ├── /order-confirmation/:orderId → OrderConfirmationPage (ORD-01)
 *   ├── /auth/signup            → SignupPage
 *   ├── /auth/login             → LoginPage
 *   ├── /auth/forgot-password   → ForgotPasswordPage
 *   ├── /auth/reset-password    → ResetPasswordPage
 *   └── /account                → ProtectedRoute
 *         ├── /account/profile   → ProfilePage
 *         ├── /account/addresses → AddressesPage
 *         ├── /account/orders    → OrdersPage (ORD-03)
 *         ├── /account/orders/:id → OrderDetailPage (ORD-04)
 *         └── /account/wallet   → WalletPage (WAL-01/02)
 */
export const router = createBrowserRouter([
  {
    path: '/',
    element: <AppLayout />,
    children: [
      { index: true, element: <HomePage /> },
      { path: 'category/:slug', element: <CategoryPage /> },
      { path: 'search', element: <SearchPage /> },
      { path: 'products/:slug', element: <ProductDetailPage /> },
      { path: 'cart', element: <CartPage /> },

      // ── Checkout wizard (4 URL-addressable steps with step-skip guard, D-05) ───
      {
        path: 'checkout',
        element: <CheckoutRootGuard />,
        children: [
          {
            path: 'address',
            element: <CheckoutGuard step="address" />,
            children: [{ index: true, element: <CheckoutAddressPage /> }],
          },
          {
            path: 'delivery',
            element: <CheckoutGuard step="delivery" />,
            children: [{ index: true, element: <CheckoutDeliveryPage /> }],
          },
          {
            path: 'payment',
            element: <CheckoutGuard step="payment" />,
            children: [{ index: true, element: <CheckoutPaymentPage /> }],
          },
          {
            path: 'review',
            element: <CheckoutGuard step="review" />,
            children: [{ index: true, element: <CheckoutReviewPage /> }],
          },
        ],
      },

      // ── Order confirmation (ORD-01) ──────────────────────────────────────────
      { path: 'order-confirmation/:orderId', element: <OrderConfirmationPage /> },

      // ── Auth pages ───────────────────────────────────────────────────────────
      { path: 'auth/signup', element: <SignupPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: 'auth/reset-password', element: <ResetPasswordPage /> },

      // ── Account (authenticated) ──────────────────────────────────────────────
      {
        path: 'account',
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
          { path: 'orders', element: <OrdersPage /> },
          { path: 'orders/:id', element: <OrderDetailPage /> },
          { path: 'wallet', element: <WalletPage /> },
        ],
      },
    ],
  },
]);
