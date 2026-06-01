import { useState } from 'react';
import { Link, useNavigate, useSearchParams } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';

/**
 * Reset password page — AUTH-03
 *
 * Reads `token` from URL search params (D-10: /reset-password?token=xxx).
 * T-04-21: Token is single-use and server-validated; client only forwards it.
 * POST /auth/reset-password { token, password }.
 * On success: redirect to /auth/login with a success toast.
 * On 400/expired: show expired-link copy + link back to /forgot-password.
 */
export default function ResetPasswordPage() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const addToast = useUiStore((s) => s.addToast);

  // D-10: token is read from the URL search param — never generated client-side
  const token = searchParams.get('token') ?? '';

  const [password, setPassword] = useState('');
  const [passwordError, setPasswordError] = useState('');
  const [isExpired, setIsExpired] = useState(false);
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // If there's no token in the URL, treat it as an expired/invalid link
  const hasToken = token.length > 0;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setPasswordError('');
    setGeneralError('');
    setIsExpired(false);

    if (!password) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }
    if (password.length < 8) {
      setPasswordError('Password must be at least 8 characters.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/reset-password', { token, password });
      addToast({
        id: crypto.randomUUID(),
        message: 'Password updated. You can now sign in.',
        variant: 'success',
      });
      void navigate('/auth/login', { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && (err.status === 400 || err.status === 410)) {
        setIsExpired(true);
      } else {
        setGeneralError(
          "We're having trouble connecting. Check your connection and try again.",
        );
      }
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <PageTransition>
      <div className="flex min-h-[calc(100vh-128px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg bg-grovio-surface-raised border border-grovio-border p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-grovio-text mb-2">
            Update Password
          </h1>

          {(!hasToken || isExpired) ? (
            <div className="mt-4">
              <p className="text-sm text-grovio-error mb-4" role="alert">
                This link has expired or has already been used. Request a new reset link.
              </p>
              <Link
                to="/auth/forgot-password"
                className="text-sm text-grovio-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
              >
                Request a new reset link
              </Link>
            </div>
          ) : (
            <>
              <p className="text-sm text-grovio-text-muted mb-6">
                Enter your new password below.
              </p>

              <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex flex-col gap-5">
                <Input
                  label="New password"
                  id="reset-password"
                  type="password"
                  autoComplete="new-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  error={passwordError}
                  disabled={isSubmitting}
                />

                {generalError && (
                  <p className="text-sm text-grovio-error" role="alert">
                    {generalError}
                  </p>
                )}

                <Button
                  type="submit"
                  variant="primary"
                  loading={isSubmitting}
                  className="w-full"
                >
                  {isSubmitting ? 'Please wait…' : 'Update Password'}
                </Button>
              </form>
            </>
          )}

          <p className="mt-6 text-sm text-grovio-text-muted text-center">
            <Link
              to="/auth/login"
              className="text-grovio-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
            >
              Back to Sign In
            </Link>
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
