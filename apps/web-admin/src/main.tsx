import React from 'react';
import ReactDOM from 'react-dom/client';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';

import App from './App.js';
import './lib/i18n.js'; // Initialize i18n
import './app.css';

if (import.meta.env.DEV) {
  void import('@axe-core/react').then(({ default: axe }) => {
    void axe(React, ReactDOM, 1000);
  });
}

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Stale time of 30 seconds — category tree is cached on the server via Redis
      staleTime: 30_000,
      // Retry failed requests once before showing an error
      retry: 1,
    },
  },
});

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
    </QueryClientProvider>
  </React.StrictMode>,
);
