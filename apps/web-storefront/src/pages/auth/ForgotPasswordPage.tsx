import { useState } from 'react';
import { Link } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { apiClient } from '../../lib/api-client.js';

/**
 * Forgot password page — AUTH-03
 *
 * POST /auth/forgot-password with email.
 * On submit: always shows "Check your email" (no enumeration — T-04-20).
 * The response is always treated as success so registered/unregistered
 * emails are indistinguishable to the client.
 */
export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('');
  const [emailError, setEmailError] = useState('');
  const [generalError, setGeneralError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [submittedEmail, setSubmittedEmail] = useState('');

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setEmailError('');
    setGeneralError('');

    if (!email.trim()) {
      setEmailError('Email is required.');
      return;
    }

    setIsSubmitting(true);
    try {
      await apiClient.post('/auth/forgot-password', { email: email.trim() });
    } catch {
      // Even on error, show the success state — no enumeration (T-04-20).
      // Network-level errors are silently swallowed; the user still sees the
      // "check your email" message to avoid disclosing registration status.
    } finally {
      setIsSubmitting(false);
      setSubmittedEmail(email.trim());
      setSubmitted(true);
    }
  }

  return (
    <PageTransition>
      <div className="flex min-h-[calc(100vh-128px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg bg-grovio-surface-raised border border-grovio-border p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-grovio-text mb-2">
            Forgot Password
          </h1>

          {submitted ? (
            <div className="mt-4">
              <p className="text-sm text-grovio-text" role="status" aria-live="polite">
                Check your email — we&apos;ve sent a reset link to{' '}
                <strong className="font-medium">{submittedEmail}</strong>.
              </p>
              <p className="mt-4 text-sm text-grovio-text-muted">
                Didn&apos;t receive it?{' '}
                <button
                  type="button"
                  onClick={() => {
                    setSubmitted(false);
                    setEmail('');
                  }}
                  className="text-grovio-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
                >
                  Try again
                </button>
              </p>
            </div>
          ) : (
            <>
              <p className="text-sm text-grovio-text-muted mb-6">
                Enter your email address and we&apos;ll send you a link to reset your password.
              </p>

              <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex flex-col gap-5">
                <Input
                  label="Email address"
                  id="forgot-email"
                  type="email"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  error={emailError}
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
                  {isSubmitting ? 'Please wait…' : 'Send Reset Link'}
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
