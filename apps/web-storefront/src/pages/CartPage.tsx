/**
 * Cart page — /cart (D-24, D-25, CHK-01)
 *
 * Groups basket items by vendor (D-24) with per-vendor section headers and
 * delivery estimate labels. Shows an OrderSummary sidebar on desktop and
 * below items on mobile (D-25).
 *
 * Loading: skeletons (analog: AddressesPage skeleton pattern)
 * Empty: "Your cart is empty" with a link back to search
 * Error: "We're having trouble loading your cart…" (analog: AddressesPage)
 * Loaded: vendor-grouped items (BasketItemRow + AnimatePresence) + OrderSummary
 *
 * Security note (T-05-UI): prices here are informational displays from the
 * server basket response. All totals are recomputed server-side at checkout.
 */

import { Link } from 'react-router-dom';
import { AnimatePresence } from 'motion/react';
import { ShoppingCart } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { BasketItemRow } from '../components/basket/BasketItem.js';
import { OrderSummary } from '../components/basket/OrderSummary.js';
import { useBasket, useUpdateBasketItem, useRemoveBasketItem } from '../hooks/useBasket.js';
import { useUiStore } from '../store/ui-store.js';

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
// CartPage
// ---------------------------------------------------------------------------

export default function CartPage() {
  const addToast = useUiStore((s) => s.addToast);

  const { basket, isLoading, isError } = useBasket();
  const updateItemMutation = useUpdateBasketItem();
  const removeItemMutation = useRemoveBasketItem();

  const isActing =
    updateItemMutation.isPending || removeItemMutation.isPending;

  function handleQuantityChange(itemId: string, newQuantity: number) {
    updateItemMutation.mutate(
      { itemId, quantity: newQuantity },
      {
        onError: () => {
          addToast({
            id: crypto.randomUUID(),
            message: 'Could not update quantity. Please try again.',
            variant: 'error',
          });
        },
      },
    );
  }

  function handleRemove(itemId: string) {
    removeItemMutation.mutate(itemId, {
      onSuccess: () => {
        addToast({
          id: crypto.randomUUID(),
          message: 'Item removed from cart.',
          variant: 'info',
        });
      },
      onError: () => {
        addToast({
          id: crypto.randomUUID(),
          message: 'Could not remove item. Please try again.',
          variant: 'error',
        });
      },
    });
  }

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-xl font-semibold text-grovio-text mb-8">Your Cart</h1>

        {/* ── Loading skeleton ────────────────────────────────────────────── */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading cart…" className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your cart. Please refresh and try again.
          </p>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && !isError && (!basket || basket.itemCount === 0) && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-grovio-surface border border-grovio-border">
              <ShoppingCart
                className="h-7 w-7 text-grovio-text-muted"
                aria-hidden="true"
              />
            </div>
            <p className="text-base font-semibold text-grovio-text">
              Your cart is empty
            </p>
            <p className="text-sm text-grovio-text-muted">
              Browse our products and add something you like.
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-1 text-sm text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
            >
              Continue shopping
            </Link>
          </div>
        )}

        {/* ── Loaded: vendor-grouped items + order summary ─────────────────── */}
        {!isLoading && !isError && basket && basket.itemCount > 0 && (
          <div className="flex flex-col lg:flex-row gap-8">
            {/* Items column */}
            <div className="flex-1 min-w-0">
              {basket.groupedByVendor.map((vendorGroup) => (
                <section
                  key={vendorGroup.vendorId}
                  aria-label={`Items from ${vendorGroup.vendorName}`}
                  className="mb-8"
                >
                  {/* Vendor section header (D-24) */}
                  <div className="flex items-center justify-between mb-3 pb-2 border-b border-grovio-border">
                    <div>
                      <h2 className="text-sm font-semibold text-grovio-text">
                        {vendorGroup.vendorName}
                      </h2>
                      <p className="text-xs text-grovio-text-muted mt-0.5">
                        Estimated delivery: 3–5 business days
                      </p>
                    </div>
                    <span className="text-sm font-semibold text-grovio-text tabular-nums">
                      {formatPrice(vendorGroup.vendorSubtotalMinor)}
                    </span>
                  </div>

                  {/* Item rows with AnimatePresence for exit collapse */}
                  <AnimatePresence initial={false}>
                    {vendorGroup.items.map((item) => (
                      <BasketItemRow
                        key={item.id}
                        item={item}
                        onQuantityChange={handleQuantityChange}
                        onRemove={handleRemove}
                        isUpdating={isActing}
                      />
                    ))}
                  </AnimatePresence>
                </section>
              ))}
            </div>

            {/* Order summary sidebar (D-25) — sticky on desktop, below items on mobile */}
            <div className="lg:w-80 xl:w-96 flex-shrink-0">
              <div className="lg:sticky lg:top-24">
                <OrderSummary basket={basket} />
              </div>
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
