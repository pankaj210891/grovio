/**
 * BasketItem — renders a single cart line item.
 *
 * Displays: product image, name, variant label, unit price, quantity stepper,
 * and a remove button. Wraps in a motion.div with exit collapse animation
 * so removal is visually smooth (PATTERNS AnimatePresence pattern).
 *
 * Uses the Button + Skeleton UI kit components.
 */

import { motion } from 'motion/react';
import { Minus, Plus, Trash2 } from 'lucide-react';
import { Button } from '../ui/Button.js';
import type { BasketItem as BasketItemType } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface BasketItemProps {
  item: BasketItemType;
  /** Called when the user changes the quantity via +/- stepper. */
  onQuantityChange: (itemId: string, newQuantity: number) => void;
  /** Called when the user clicks the remove button. */
  onRemove: (itemId: string) => void;
  isUpdating?: boolean;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function BasketItemRow({
  item,
  onQuantityChange,
  onRemove,
  isUpdating = false,
}: BasketItemProps) {
  return (
    <motion.div
      layout
      initial={{ opacity: 1, height: 'auto' }}
      exit={{ opacity: 0, height: 0, marginBottom: 0 }}
      transition={{ duration: 0.2, ease: 'easeInOut' }}
      className="overflow-hidden"
    >
      <div className="flex gap-3 py-4 border-b border-grovio-border last:border-b-0">
        {/* Product image */}
        <div className="flex-shrink-0 w-16 h-16 rounded-md overflow-hidden bg-grovio-border">
          {item.imageUrl ? (
            <img
              src={item.imageUrl}
              alt={item.productName}
              className="w-full h-full object-cover"
              loading="lazy"
            />
          ) : (
            <div
              className="w-full h-full flex items-center justify-center text-grovio-text-muted text-xs"
              aria-hidden="true"
            >
              No img
            </div>
          )}
        </div>

        {/* Item details */}
        <div className="flex-1 min-w-0">
          {/* Product name */}
          <a
            href={`/products/${item.productSlug}`}
            className="text-sm font-semibold text-grovio-text hover:text-grovio-primary line-clamp-2 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-1 rounded"
          >
            {item.productName}
          </a>

          {/* Unit price */}
          <p className="text-sm text-grovio-text-muted mt-0.5">
            {formatPrice(item.unitPriceMinor)} each
          </p>

          {/* Quantity stepper + remove */}
          <div className="flex items-center gap-3 mt-2">
            <div className="flex items-center gap-1 rounded-md border border-grovio-border">
              <button
                type="button"
                aria-label="Decrease quantity"
                disabled={isUpdating || item.quantity <= 1}
                onClick={() => onQuantityChange(item.id, item.quantity - 1)}
                className="flex items-center justify-center w-8 h-8 text-grovio-text-muted hover:text-grovio-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded-l"
              >
                <Minus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>

              <span
                aria-live="polite"
                className="w-8 text-center text-sm font-semibold text-grovio-text tabular-nums"
              >
                {item.quantity}
              </span>

              <button
                type="button"
                aria-label="Increase quantity"
                disabled={isUpdating || item.quantity >= 100}
                onClick={() => onQuantityChange(item.id, item.quantity + 1)}
                className="flex items-center justify-center w-8 h-8 text-grovio-text-muted hover:text-grovio-text disabled:opacity-40 disabled:cursor-not-allowed transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded-r"
              >
                <Plus className="h-3.5 w-3.5" aria-hidden="true" />
              </button>
            </div>

            <Button
              type="button"
              variant="secondary"
              disabled={isUpdating}
              onClick={() => onRemove(item.id)}
              aria-label={`Remove ${item.productName} from cart`}
              className="px-2 py-1.5 text-grovio-error hover:text-grovio-error hover:border-grovio-error"
            >
              <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
            </Button>
          </div>
        </div>

        {/* Line subtotal */}
        <div className="flex-shrink-0 text-right">
          <p className="text-sm font-semibold text-grovio-text tabular-nums">
            {formatPrice(item.lineSubtotalMinor)}
          </p>
        </div>
      </div>
    </motion.div>
  );
}
