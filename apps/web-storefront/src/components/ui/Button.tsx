import { Loader2 } from 'lucide-react';
import type { ButtonHTMLAttributes, ReactNode } from 'react';

export type ButtonVariant = 'primary' | 'secondary' | 'destructive';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  loading?: boolean;
  children: ReactNode;
}

/**
 * Primary / secondary / destructive button component.
 *
 * Design tokens (no hardcoded hex):
 *   primary   — bg-grovio-primary, hover:bg-grovio-primary-hover
 *   secondary — bg-grovio-surface-raised, border border-grovio-border
 *   destructive — bg-grovio-error text-white
 *
 * Accessibility:
 *   - focus-visible ring (WCAG AA, 2px solid grovio-primary)
 *   - disabled: opacity-60 cursor-not-allowed
 *   - loading: shows lucide Loader2 spinner; button is visually disabled
 */
export function Button({
  variant = 'primary',
  loading = false,
  disabled,
  children,
  className = '',
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;

  const base =
    'inline-flex items-center justify-center gap-2 rounded-md font-semibold text-base px-6 py-3 transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2';

  const variants: Record<ButtonVariant, string> = {
    primary:
      'bg-grovio-primary text-white hover:bg-grovio-primary-hover',
    secondary:
      'bg-grovio-surface-raised text-grovio-text border border-grovio-border hover:bg-grovio-surface',
    destructive:
      'bg-grovio-error text-white hover:opacity-90',
  };

  const disabledClasses = isDisabled ? 'opacity-60 cursor-not-allowed' : '';

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={`${base} ${variants[variant]} ${disabledClasses} ${className}`.trim()}
    >
      {loading && <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />}
      {children}
    </button>
  );
}
