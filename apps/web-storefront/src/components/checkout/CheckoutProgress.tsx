/**
 * CheckoutProgress — 4-step wizard progress indicator.
 *
 * Steps: address → delivery → payment → review (D-05)
 * Current step is highlighted with a motion animation.
 * Completed steps show a checkmark; upcoming steps are muted.
 */

import { motion } from 'motion/react';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type CheckoutStepKey = 'address' | 'delivery' | 'payment' | 'review';

interface CheckoutProgressProps {
  currentStep: CheckoutStepKey;
}

// ---------------------------------------------------------------------------
// Step metadata
// ---------------------------------------------------------------------------

const STEPS: Array<{ key: CheckoutStepKey; label: string }> = [
  { key: 'address', label: 'Address' },
  { key: 'delivery', label: 'Delivery' },
  { key: 'payment', label: 'Payment' },
  { key: 'review', label: 'Review' },
];

const STEP_ORDER: Record<CheckoutStepKey, number> = {
  address: 0,
  delivery: 1,
  payment: 2,
  review: 3,
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

/**
 * Horizontal step indicator for the checkout wizard.
 * Shows step number / checkmark, label, and connecting lines.
 */
export function CheckoutProgress({ currentStep }: CheckoutProgressProps) {
  const currentIndex = STEP_ORDER[currentStep];

  return (
    <nav aria-label="Checkout steps" className="w-full">
      <ol className="flex items-center justify-between w-full max-w-xl mx-auto">
        {STEPS.map((step, index) => {
          const isCompleted = index < currentIndex;
          const isCurrent = index === currentIndex;
          const isPending = index > currentIndex;

          return (
            <li key={step.key} className="flex items-center flex-1 last:flex-none">
              {/* Step circle */}
              <div className="flex flex-col items-center">
                <motion.div
                  key={`${step.key}-${isCurrent}`}
                  initial={isCurrent ? { scale: 0.8, opacity: 0 } : false}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.2, ease: 'easeOut' }}
                  className={[
                    'w-8 h-8 rounded-full flex items-center justify-center text-sm font-semibold transition-colors',
                    isCompleted
                      ? 'bg-grovio-primary text-white'
                      : isCurrent
                        ? 'bg-grovio-primary text-white ring-4 ring-grovio-primary/20'
                        : 'bg-grovio-surface-raised text-grovio-text-muted border border-grovio-border',
                  ].join(' ')}
                  aria-current={isCurrent ? 'step' : undefined}
                >
                  {isCompleted ? (
                    <svg
                      className="w-4 h-4"
                      viewBox="0 0 16 16"
                      fill="none"
                      aria-hidden="true"
                    >
                      <path
                        d="M3 8l3.5 3.5L13 5"
                        stroke="currentColor"
                        strokeWidth="2"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  ) : (
                    <span>{index + 1}</span>
                  )}
                </motion.div>
                <span
                  className={[
                    'mt-1.5 text-xs font-medium whitespace-nowrap',
                    isCurrent
                      ? 'text-grovio-primary'
                      : isCompleted
                        ? 'text-grovio-text'
                        : 'text-grovio-text-muted',
                  ].join(' ')}
                >
                  {step.label}
                </span>
              </div>

              {/* Connector line — not after last step */}
              {index < STEPS.length - 1 && (
                <div
                  className={[
                    'flex-1 h-0.5 mx-2 mb-5 rounded',
                    index < currentIndex ? 'bg-grovio-primary' : 'bg-grovio-border',
                  ].join(' ')}
                  aria-hidden="true"
                />
              )}

              {/* Suppress unused variable warning */}
              {isPending && null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
