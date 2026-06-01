import type { InputHTMLAttributes, ReactNode } from 'react';

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
  /** If provided, overrides the auto-generated id for label association */
  id?: string;
  /** Trailing icon or element rendered inside the input wrapper */
  rightElement?: ReactNode;
}

/**
 * Form input with label association and inline error display.
 *
 * Design tokens (no hardcoded hex):
 *   border-grovio-border, bg-grovio-surface-raised, text-grovio-text
 *   focus:ring-grovio-primary, border-grovio-error (error variant)
 *
 * Accessibility:
 *   - <label> associated via htmlFor / id
 *   - error message rendered below input in text-grovio-error
 *   - focus ring: focus:ring-2 focus:ring-grovio-primary
 */
export function Input({
  label,
  error,
  id,
  className = '',
  rightElement,
  ...rest
}: InputProps) {
  // Derive an id from the label if not explicitly provided
  const inputId = id ?? (label ? label.toLowerCase().replace(/\s+/g, '-') : undefined);

  const base =
    'block w-full rounded-md border bg-grovio-surface-raised text-grovio-text text-sm h-10 px-3 focus:outline-none focus:ring-2 focus:ring-grovio-primary transition-colors duration-150';
  const borderClass = error ? 'border-grovio-error' : 'border-grovio-border';

  return (
    <div className="flex flex-col gap-1">
      {label && (
        <label
          htmlFor={inputId}
          className="text-sm font-medium text-grovio-text"
        >
          {label}
        </label>
      )}
      <div className="relative">
        <input
          {...rest}
          id={inputId}
          className={`${base} ${borderClass} ${rightElement ? 'pr-10' : ''} ${className}`.trim()}
          aria-invalid={error ? 'true' : undefined}
          aria-describedby={error && inputId ? `${inputId}-error` : undefined}
        />
        {rightElement && (
          <div className="absolute inset-y-0 right-0 flex items-center pr-3">
            {rightElement}
          </div>
        )}
      </div>
      {error && (
        <p
          id={inputId ? `${inputId}-error` : undefined}
          className="text-sm text-grovio-error"
          role="alert"
        >
          {error}
        </p>
      )}
    </div>
  );
}
