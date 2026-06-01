import { useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useUiStore } from '../../store/ui-store.js';
import { ApiError } from '../../lib/api-client.js';

/**
 * Signup page — AUTH-01
 *
 * POST /auth/signup with email + password (min 8) + name.
 * On success: redirect to / with a success toast.
 * On 409: "An account with this email already exists. Sign in instead."
 * On weak password: "Password must be at least 8 characters."
 * Field errors are inline (no toast for field validation errors).
 */
export default function SignupPage() {
  const navigate = useNavigate();
  const { signup, isSigningUp } = useAuth();
  const addToast = useUiStore((s) => s.addToast);

  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errors, setErrors] = useState<{
    name?: string;
    email?: string;
    password?: string;
    general?: string;
  }>({});

  function validate() {
    const next: typeof errors = {};
    if (!name.trim()) next.name = 'Name is required.';
    if (!email.trim()) next.email = 'Email is required.';
    if (!password) next.password = 'Password must be at least 8 characters.';
    else if (password.length < 8) next.password = 'Password must be at least 8 characters.';
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
      await signup({ email: email.trim(), password, name: name.trim() });
      addToast({
        id: crypto.randomUUID(),
        message: 'Account created! Welcome to Grovio.',
        variant: 'success',
      });
      void navigate('/');
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        if (err.status === 409) {
          setErrors({
            email:
              'An account with this email already exists. Sign in instead.',
          });
        } else if (err.status === 400) {
          // Server-side weak password rejection
          setErrors({ password: 'Password must be at least 8 characters.' });
        } else {
          setErrors({
            general:
              "We're having trouble connecting. Check your connection and try again.",
          });
        }
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
            Create Account
          </h1>

          <form onSubmit={(e) => { void handleSubmit(e); }} noValidate className="flex flex-col gap-5">
            <Input
              label="Full name"
              id="signup-name"
              type="text"
              autoComplete="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              error={errors.name}
              disabled={isSigningUp}
            />

            <Input
              label="Email address"
              id="signup-email"
              type="email"
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              error={errors.email}
              disabled={isSigningUp}
            />

            <Input
              label="Password"
              id="signup-password"
              type="password"
              autoComplete="new-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              error={errors.password}
              disabled={isSigningUp}
            />

            {errors.general && (
              <p className="text-sm text-grovio-error" role="alert">
                {errors.general}
              </p>
            )}

            <Button
              type="submit"
              variant="primary"
              loading={isSigningUp}
              className="w-full mt-1"
            >
              {isSigningUp ? 'Please wait…' : 'Create Account'}
            </Button>
          </form>

          <p className="mt-6 text-sm text-grovio-text-muted text-center">
            Already have an account?{' '}
            <Link
              to="/auth/login"
              className="text-grovio-primary font-medium hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
            >
              Sign in
            </Link>
          </p>
        </div>
      </div>
    </PageTransition>
  );
}
