/**
 * Accept vendor staff invite page.
 *
 * Reads ?token= from URL query params.
 * Presents a password form → POST /vendor/team/accept-invite { token, password }.
 * On success, redirects to /auth/login with a success banner.
 */

import React, { useState } from 'react';
import { motion } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { apiClient, ApiError } from '../../lib/apiClient.js';

export default function AcceptInvitePage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);

    if (!token) {
      setError('Invalid or missing invite token.');
      return;
    }
    if (password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    if (password !== confirm) {
      setError('Passwords do not match.');
      return;
    }

    setSubmitting(true);
    try {
      await apiClient.post('/vendor/team/accept-invite', { token, password });
      navigate('/auth/login', {
        replace: true,
        state: { successMessage: 'Account created. Please sign in.' },
      });
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 404 || err.status === 410) {
          setError('This invite link is invalid or has expired.');
        } else if (err.status === 409) {
          setError('This invite has already been accepted.');
        } else {
          setError('Something went wrong. Please try again.');
        }
      } else {
        setError('Something went wrong. Please try again.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-grovio-surface px-4">
      <motion.div
        initial={{ opacity: 0, y: 16 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4 }}
        className="w-full max-w-sm"
      >
        {/* Brand */}
        <div className="mb-8 text-center">
          <span className="text-2xl font-bold text-grovio-primary">Grovio</span>
          <p className="mt-1 text-sm text-grovio-text-muted">Vendor Invite</p>
        </div>

        {/* Card */}
        <div className="rounded-2xl border border-grovio-border bg-grovio-surface-raised p-8 shadow-sm">
          <h1 className="mb-2 text-lg font-semibold text-grovio-text">
            Set up your account
          </h1>
          <p className="mb-6 text-sm text-grovio-text-muted">
            You've been invited to join a store on Grovio. Choose a password to
            complete your account setup.
          </p>

          {!token && (
            <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
              Missing invite token. Please use the link from your invitation email.
            </div>
          )}

          {token && (
            <form onSubmit={(e) => void handleSubmit(e)} className="flex flex-col gap-4">
              <div>
                <label
                  htmlFor="password"
                  className="mb-1 block text-sm font-medium text-grovio-text"
                >
                  Password <span className="text-grovio-error">*</span>
                </label>
                <input
                  id="password"
                  type="password"
                  autoComplete="new-password"
                  required
                  minLength={8}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                />
              </div>

              <div>
                <label
                  htmlFor="confirm"
                  className="mb-1 block text-sm font-medium text-grovio-text"
                >
                  Confirm password <span className="text-grovio-error">*</span>
                </label>
                <input
                  id="confirm"
                  type="password"
                  autoComplete="new-password"
                  required
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  placeholder="Repeat password"
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
                />
              </div>

              {error && (
                <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 px-3 py-2 text-sm text-grovio-error">
                  {error}
                </div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="mt-2 rounded-lg bg-grovio-primary px-4 py-2.5 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
              >
                {submitting ? 'Creating account…' : 'Create account'}
              </button>
            </form>
          )}
        </div>
      </motion.div>
    </div>
  );
}
