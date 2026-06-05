/**
 * LoginPage — admin panel login.
 *
 * POST /admin/auth/login → sets httpOnly cookie → redirects to /dashboard.
 * Uses framer-motion (web-admin convention per PATTERNS.md).
 */

import { motion } from 'framer-motion';
import React, { useState } from 'react';
import { useAdminAuth } from '../../hooks/useAdminAuth.js';
import { ApiError } from '../../lib/apiClient.js';

export function LoginPage() {
  const { login, isLoggingIn, loginError } = useAdminAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    login({ email: email.trim(), password });
  }

  const errorMessage =
    loginError instanceof ApiError
      ? loginError.message
      : loginError instanceof Error
        ? loginError.message
        : null;

  return (
    <div className="flex min-h-screen items-center justify-center bg-grovio-surface px-4">
      <motion.div
        className="w-full max-w-sm"
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
      >
        {/* Logo */}
        <div className="mb-8 flex flex-col items-center gap-2">
          <span className="rounded-lg bg-grovio-primary px-4 py-2 text-xl font-bold text-white">
            Grovio
          </span>
          <p className="text-sm text-grovio-text-muted">Admin Panel — Sign in</p>
        </div>

        {/* Card */}
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-8 shadow-sm">
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label
                htmlFor="login-email"
                className="mb-1.5 block text-sm font-medium text-grovio-text"
              >
                Email
              </label>
              <input
                id="login-email"
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="admin@example.com"
                required
                autoComplete="email"
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
              />
            </div>

            <div>
              <label
                htmlFor="login-password"
                className="mb-1.5 block text-sm font-medium text-grovio-text"
              >
                Password
              </label>
              <input
                id="login-password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                required
                autoComplete="current-password"
                className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
              />
            </div>

            {/* Error */}
            {errorMessage && (
              <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                {errorMessage}
              </div>
            )}

            <button
              type="submit"
              disabled={isLoggingIn || !email || !password}
              className="w-full rounded-lg bg-grovio-primary px-4 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {isLoggingIn ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
        </div>

        <p className="mt-6 text-center text-xs text-grovio-text-muted">
          Grovio Marketplace Admin &mdash; Authorized Personnel Only
        </p>
      </motion.div>
    </div>
  );
}
