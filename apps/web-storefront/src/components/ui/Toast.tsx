import { AnimatePresence, motion } from 'motion/react';
import { X } from 'lucide-react';
import { useUiStore, type Toast as ToastItem } from '../../store/ui-store.js';

/**
 * Toast notification container.
 *
 * Reads the toast list from the Zustand ui-store (04-06). Renders each toast
 * as a motion.div with slide-in animation from the right.
 *
 * Accessibility:
 *   - info toasts: role="status" aria-live="polite"
 *   - error toasts: role="alert" aria-live="assertive"
 *
 * Animation (UI-SPEC Contract):
 *   initial: opacity 0, x 16
 *   animate: opacity 1, x 0
 *   exit:    opacity 0, x 16
 *   transition: duration 0.2
 */

interface SingleToastProps {
  toast: ToastItem;
  onRemove: (id: string) => void;
}

function SingleToast({ toast, onRemove }: SingleToastProps) {
  const isError = toast.variant === 'error';
  const role = isError ? 'alert' : 'status';
  const ariaLive = isError ? 'assertive' : 'polite';

  const variantClasses: Record<ToastItem['variant'], string> = {
    info: 'bg-grovio-surface-raised border-grovio-border text-grovio-text',
    success: 'bg-grovio-surface-raised border-grovio-success text-grovio-text',
    error: 'bg-grovio-surface-raised border-grovio-error text-grovio-text',
  };

  return (
    <motion.div
      layout
      role={role}
      aria-live={ariaLive}
      initial={{ opacity: 0, x: 16 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 16 }}
      transition={{ duration: 0.2 }}
      className={`flex items-start gap-3 rounded-lg border px-4 py-3 shadow-md min-w-[280px] max-w-[380px] ${variantClasses[toast.variant]}`}
    >
      <p className="flex-1 text-sm">{toast.message}</p>
      <button
        type="button"
        onClick={() => onRemove(toast.id)}
        aria-label="Dismiss notification"
        className="flex-shrink-0 text-grovio-text-muted hover:text-grovio-text focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-grovio-primary rounded"
      >
        <X className="h-4 w-4" />
      </button>
    </motion.div>
  );
}

/**
 * Toast container — mount once in AppLayout.
 * Positioned fixed at top-right, stacks vertically.
 */
export function ToastContainer() {
  const toasts = useUiStore((s) => s.toasts);
  const removeToast = useUiStore((s) => s.removeToast);

  return (
    <div
      className="fixed top-4 right-4 z-50 flex flex-col gap-2 items-end"
      aria-label="Notifications"
    >
      <AnimatePresence mode="popLayout">
        {toasts.map((toast) => (
          <SingleToast key={toast.id} toast={toast} onRemove={removeToast} />
        ))}
      </AnimatePresence>
    </div>
  );
}
