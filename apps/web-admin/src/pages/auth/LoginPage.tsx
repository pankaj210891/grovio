/**
 * LoginPage — admin panel login (Phase 11).
 *
 * Submits credentials to POST /admin/auth/login which sets the httpOnly
 * admin_token cookie. On success, navigates to the dashboard.
 */

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';

export function LoginPage() {
  const navigate = useNavigate();
  const { login, isLoggingIn, loginError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login(
      { email, password },
      {
        onSuccess: () => navigate('/dashboard', { replace: true }),
      }
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grovio-surface px-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-3">
          <span className="rounded-xl bg-grovio-primary px-4 py-2 text-2xl font-bold text-white">
            Grovio
          </span>
          <h1 className="text-xl font-bold text-grovio-text">Admin Portal</h1>
          <p className="text-sm text-grovio-text-muted">Sign in to your admin account</p>
        </div>

        <form onSubmit={handleSubmit} className="rounded-2xl border border-grovio-border bg-grovio-surface-raised p-6 shadow-sm">
          <div className="space-y-4">
            <div>
              <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-grovio-text">
                Email address
              </label>
              <input
                id="email"
                type="email"
                autoComplete="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2.5 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
                placeholder="admin@example.com"
              />
            </div>

            <div>
              <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-grovio-text">
                Password
              </label>
              <input
                id="password"
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2.5 text-sm text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
                placeholder="Enter your password"
              />
            </div>

            {loginError && (
              <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                {loginError instanceof Error ? loginError.message : 'Login failed. Please try again.'}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn}
              className="w-full rounded-lg bg-grovio-primary px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
