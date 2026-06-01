import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClientProvider } from '@tanstack/react-query';
import { RouterProvider } from 'react-router-dom';
import { queryClient } from './lib/query-client.js';
import { router } from './router.js';
import './app.css';

/**
 * Application entry point.
 *
 * Provider hierarchy:
 *   React.StrictMode
 *     └── QueryClientProvider (React Query — 2min staleTime, smart retry)
 *           └── RouterProvider (React Router v7 createBrowserRouter)
 *
 * App component (App.tsx) is replaced by the RouterProvider + route tree.
 * The router mounts AppLayout which renders Header, AnimatePresence Outlet,
 * Footer, and ToastContainer.
 */
ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <RouterProvider router={router} />
    </QueryClientProvider>
  </React.StrictMode>,
);
