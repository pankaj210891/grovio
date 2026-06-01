import { useState } from 'react';
import { Link, useNavigate, useLocation } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../hooks/useAuth.js';
import { ApiError } from '../../lib/api-client.js';

/**
 * Login page — AUTH-01, AUTH-02
 *
 * POST /auth/login. The backend sets httpOnly cookies (D-09).
 * On success: redirect to the intended path or /.
 * On 401: "Incorrect email or password. Please try again."
 * Field errors are inline (no toast for field validation errors).
 */
export default function LoginPage() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isLoggingIn } = useAuth();

  // Respect the `from` state set by ProtectedRoute redirect
  const from =
    (location.state as { from?: string } | null)?.from ?? '/';

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    email?: string;
    password?: string;
    general?: string;
  }>({});

  function validate() {
    const next: typeof errors = {};
    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password is required.';
    return next;
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const fieldErrors = validate();
    if (Object.keys(fieldErrors).length > 0) {
      setErrors(fieldErrors);
      return;
    }
    setErrors({});

    try {
      await login({ email: email.trim(), password });
      void navigate(from, { replace: true });
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 401) {
        // T-04-20: single generic message — no enumeration of which field was wrong
        setErrors({
          general: 'Incorrect email or password. Please try again.',
        });
      } else {
        setErrors({
          general:
            "We're having trouble connecting. Check your connection and try again.",
        });
      }
    }
  }

  return (
    <PageTransition>
      <div className="flex min-h-[calc(100vh-128px)] items-center justify-center px-4 py-12">
        <div className="w-full max-w-md rounded-lg bg-grovio-surface-raised border border-grovio-border p-8 shadow-sm">
          <h1 className="text-xl font-semibold text-grovio-text mb-6">
            Sign In
          </h1>

          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex flex-col gap-5">
            <Input
              label="Email address"
              id="login-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={isLoggingIn}
            />

            <Input
              label="Password"
              id="login-password"
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isLoggingIn}
            />

            {errors.general && (
              <p className="text-sm text-grovio-error" role="alert">
                {errors.general}
              </p>
            )}

            <div className="flex items-center justify-end">
              <Link
                to="/auth/forgot-password"
                className="text-sm text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
              >
                Forgot password?
              </Link>
            </div>

            <Button
              type="submit"
              variant="primary"
              loading={isLoggingIn}
              className="w-full"
            >
              {isLoggingIn ? 'Please wait…' : 'Sign In'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-grovio-text-muted text-center">
            Don&apos;t have an account?{' '}
            <Link
              to="/auth/signup"
              className="text-grovio-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
            >
              Create one
            </Link>
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
