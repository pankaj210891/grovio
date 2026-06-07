import { useReducedMotion, motion, AnimatePresence } from 'motion/react';
import { X, ArrowRight } from 'lucide-react';
import { useState } from 'react';
import { useComparisonStore } from '../../stores/useComparisonStore.js';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import type { Product } from '@grovio/contracts';

/**
 * ComparisonTray — fixed bottom slide-up tray showing selected products for comparison.
 *
 * - Fixed above BottomNav on mobile (bottom-14), at bottom on desktop (bottom-0)
 * - z-40 (below modals at z-50)
 * - Slide-in from bottom with Motion 12.x (respects prefers-reduced-motion)
 * - "Compare Now" opens a Dialog with side-by-side attribute comparison table
 * - Only rendered when selectedProductIds.length > 0
 *
 * Mount in AppLayout (always rendered, conditionally visible).
 */

interface ProductMiniResponse {
  success: boolean;
  data: { product: Product & { images?: Array<{ url: string; altText?: string }> } };
}

function useProductMini(productId: string | undefined) {
  return useQuery<Product & { images?: Array<{ url: string; altText?: string }> } | null>({
    queryKey: ['product-mini', productId],
    queryFn: async () => {
      if (!productId) return null;
      const res = await apiClient.get<ProductMiniResponse>(`/products/${productId}`);
      return res.data.product;
    },
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
}

interface ProductThumbProps {
  productId: string;
  onRemove: (id: string) => void;
}

function ProductThumb({ productId, onRemove }: ProductThumbProps) {
  const { data: product } = useProductMini(productId);
  const imageUrl = product?.images?.[0]?.url;
  const name = product?.name ?? 'Loading…';

  return (
    <div className="relative flex flex-col items-center gap-1 w-20">
      {/* Thumbnail */}
      <div className="relative w-14 h-14 rounded-md overflow-hidden bg-grovio-surface border border-grovio-border flex-shrink-0">
        {imageUrl ? (
          <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
        ) : (
          <div className="w-full h-full bg-grovio-border" aria-hidden="true" />
        )}

        {/* Remove button */}
        <button
          type="button"
          onClick={() => onRemove(productId)}
          aria-label={`Remove ${name} from comparison`}
          className="absolute top-0.5 right-0.5 flex items-center justify-center w-4 h-4 rounded-full bg-grovio-text text-white hover:bg-grovio-error transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-grovio-primary"
        >
          <X className="w-2.5 h-2.5" aria-hidden="true" />
        </button>
      </div>

      {/* Product name */}
      <p className="text-[10px] text-grovio-text-muted leading-tight text-center line-clamp-2 w-full">
        {name}
      </p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Comparison dialog
// ---------------------------------------------------------------------------

interface ComparisonDialogProps {
  productIds: string[];
  onClose: () => void;
}

function CompareProductData({ productId }: { productId: string }) {
  const { data: product } = useProductMini(productId);
  return (
    <div className="flex flex-col gap-2">
      <div className="w-full aspect-square rounded-lg overflow-hidden bg-grovio-surface border border-grovio-border">
        {product?.images?.[0]?.url ? (
          <img
            src={product.images[0].url}
            alt={product?.name}
            className="w-full h-full object-cover"
          />
        ) : (
          <div className="w-full h-full bg-grovio-border" aria-hidden="true" />
        )}
      </div>
      <p className="text-sm font-semibold text-grovio-text text-center line-clamp-2">
        {product?.name ?? 'Loading…'}
      </p>
      <p className="text-sm font-semibold text-grovio-primary text-center">
        {product
          ? new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(product.basePriceMinor / 100)
          : '—'}
      </p>
    </div>
  );
}

function ComparisonDialog({ productIds, onClose }: ComparisonDialogProps) {
  return (
    <div
      className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/50 px-4 pb-4 sm:pb-0"
      role="dialog"
      aria-modal="true"
      aria-label="Compare products"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <motion.div
        initial={{ opacity: 0, y: 40, scale: 0.97 }}
        animate={{ opacity: 1, y: 0, scale: 1 }}
        exit={{ opacity: 0, y: 40, scale: 0.97 }}
        transition={{ duration: 0.2, ease: 'easeOut' }}
        className="w-full max-w-2xl rounded-xl bg-grovio-surface-raised border border-grovio-border shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-grovio-border">
          <h2 className="text-base font-semibold text-grovio-text">Compare Products</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close comparison"
            className="p-1.5 rounded-md text-grovio-text-muted hover:text-grovio-text hover:bg-grovio-surface transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>

        {/* Product columns */}
        <div className="p-6 overflow-x-auto">
          <div
            className="grid gap-4"
            style={{ gridTemplateColumns: `repeat(${productIds.length}, minmax(0, 1fr))` }}
          >
            {productIds.map((id) => (
              <CompareProductData key={id} productId={id} />
            ))}
          </div>

          {/* Attributes comparison table placeholder */}
          <div className="mt-6 rounded-lg border border-grovio-border overflow-hidden">
            <table className="w-full text-sm">
              <tbody>
                <tr className="border-b border-grovio-border bg-grovio-surface">
                  <td className="px-4 py-2 font-medium text-grovio-text-muted w-24">Price</td>
                  {productIds.map((id) => (
                    <CompareCell key={id} productId={id} field="price" />
                  ))}
                </tr>
                <tr className="border-b border-grovio-border">
                  <td className="px-4 py-2 font-medium text-grovio-text-muted">Vendor</td>
                  {productIds.map((id) => (
                    <CompareCell key={id} productId={id} field="vendor" />
                  ))}
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </motion.div>
    </div>
  );
}

function CompareCell({ productId, field }: { productId: string; field: 'price' | 'vendor' }) {
  const { data: product } = useProductMini(productId);
  let value = '—';
  if (product) {
    if (field === 'price') {
      value = new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(product.basePriceMinor / 100);
    } else if (field === 'vendor') {
      value = (product as Product & { vendorName?: string }).vendorName ?? '—';
    }
  }
  return <td className="px-4 py-2 text-grovio-text text-center">{value}</td>;
}

// ---------------------------------------------------------------------------
// Main ComparisonTray
// ---------------------------------------------------------------------------

export function ComparisonTray() {
  const { selectedProductIds, removeProduct, clear } = useComparisonStore();
  const [dialogOpen, setDialogOpen] = useState(false);
  const prefersReducedMotion = useReducedMotion();

  const count = selectedProductIds.length;

  return (
    <>
      <AnimatePresence>
        {count > 0 && (
          <motion.div
            key="comparison-tray"
            initial={prefersReducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
            animate={prefersReducedMotion ? { opacity: 1 } : { y: 0, opacity: 1 }}
            exit={prefersReducedMotion ? { opacity: 0 } : { y: 80, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeOut' }}
            className="fixed bottom-14 md:bottom-0 left-0 right-0 z-40 bg-grovio-surface-raised border-t border-grovio-border shadow-lg"
            role="region"
            aria-label="Product comparison tray"
            aria-live="polite"
          >
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-3">
              <div className="flex items-center gap-4 overflow-x-auto">
                {/* Product thumbnails */}
                <div className="flex items-end gap-3 flex-shrink-0">
                  {selectedProductIds.map((id) => (
                    <ProductThumb key={id} productId={id} onRemove={removeProduct} />
                  ))}
                  {/* Placeholder slots for remaining slots */}
                  {Array.from({ length: 3 - count }).map((_, i) => (
                    <div
                      key={`empty-${i}`}
                      className="w-14 h-14 rounded-md border-2 border-dashed border-grovio-border flex items-center justify-center flex-shrink-0"
                      aria-hidden="true"
                    >
                      <span className="text-grovio-text-muted text-lg font-light">+</span>
                    </div>
                  ))}
                </div>

                {/* Actions */}
                <div className="ml-auto flex items-center gap-2 flex-shrink-0">
                  <button
                    type="button"
                    onClick={clear}
                    className="text-sm text-grovio-text-muted hover:text-grovio-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
                  >
                    Clear
                  </button>
                  <button
                    type="button"
                    onClick={() => setDialogOpen(true)}
                    disabled={count < 2}
                    className="inline-flex items-center gap-1.5 bg-grovio-primary text-white text-sm font-semibold px-4 py-2 rounded-md hover:bg-grovio-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
                  >
                    Compare Now
                    <ArrowRight className="h-3.5 w-3.5" aria-hidden="true" />
                  </button>
                </div>
              </div>
              {count < 2 && (
                <p className="text-xs text-grovio-text-muted mt-1">
                  Select at least 2 products to compare
                </p>
              )}
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Comparison dialog */}
      <AnimatePresence>
        {dialogOpen && (
          <ComparisonDialog
            key="compare-dialog"
            productIds={selectedProductIds}
            onClose={() => setDialogOpen(false)}
          />
        )}
      </AnimatePresence>
    </>
  );
}
