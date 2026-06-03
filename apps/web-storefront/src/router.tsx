import { createBrowserRouter } from 'react-router-dom';
import { AppLayout } from './components/layout/AppLayout.js';
import { ProtectedRoute } from './components/layout/ProtectedRoute.js';
import HomePage from './pages/HomePage.js';
import CategoryPage from './pages/CategoryPage.js';
import SearchPage from './pages/SearchPage.js';
import ProductDetailPage from './pages/ProductDetailPage.js';
import CartPage from './pages/CartPage.js';
import SignupPage from './pages/auth/SignupPage.js';
import LoginPage from './pages/auth/LoginPage.js';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage.js';
import ResetPasswordPage from './pages/auth/ResetPasswordPage.js';
import ProfilePage from './pages/account/ProfilePage.js';
import AddressesPage from './pages/account/AddressesPage.js';

/**
 * Phase 5 route tree — React Router v7 createBrowserRouter.
 *
 * Root route: AppLayout (Header + AnimatePresence Outlet + Footer + Toast)
 *   ├── /                     → HomePage
 *   ├── /category/:slug       → CategoryPage
 *   ├── /search               → SearchPage (+ /search?q=...)
 *   ├── /products/:slug       → ProductDetailPage
 *   ├── /cart                 → CartPage (Phase 5 — D-24/D-25 basket)
 *   ├── /auth/signup          → SignupPage
 *   ├── /auth/login           → LoginPage
 *   ├── /auth/forgot-password → ForgotPasswordPage
 *   ├── /auth/reset-password  → ResetPasswordPage
 *   └── /account              → ProtectedRoute
 *         ├── /account/profile   → ProfilePage
 *         └── /account/addresses → AddressesPage
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
      { path: 'auth/signup', element: <SignupPage /> },
      { path: 'auth/login', element: <LoginPage /> },
      { path: 'auth/forgot-password', element: <ForgotPasswordPage /> },
      { path: 'auth/reset-password', element: <ResetPasswordPage /> },
      {
        path: 'account',
        element: <ProtectedRoute />,
        children: [
          { path: 'profile', element: <ProfilePage /> },
          { path: 'addresses', element: <AddressesPage /> },
        ],
      },
    ],
  },
]);
