/**
 * CheckoutReviewPage — /checkout/review (step 4 of 4, D-05)
 *
 * Shows the server-authoritative CheckoutSummary breakdown + address + items
 * grouped by vendor. All amounts come from GET /checkout/summary (CHK-04).
 *
 * Note: In this wizard the "review" step shows the order summary AFTER the
 * payment has been initiated. The customer lands here to confirm their payment
 * method and finalize. The actual "confirm" action navigates to order-confirmation.
 */

import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { CheckoutProgress } from '../../components/checkout/CheckoutProgress.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { useCheckoutSummary, useCheckoutStore } from '../../hooks/useCheckout.js';
import { useBasket } from '../../hooks/useBasket.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutReviewPage() {
  const navigate = useNavigate();
  const { data: summary, isLoading: summaryLoading } = useCheckoutSummary();
  const { basket, isLoading: basketLoading } = useBasket();
  const { paymentResult } = useCheckoutStore();

  const isLoading = summaryLoading || basketLoading;

  function handleConfirm() {
    if (paymentResult?.orderId) {
      void navigate(`/order-confirmation/${paymentResult.orderId}`);
    }
  }

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Progress indicator */}
        <div className="mb-8">
          <CheckoutProgress currentStep="review" />
        </div>

        <h1 className="text-xl font-semibold text-grovio-text mb-6">Review your order</h1>

        {/* Loading skeleton */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading order summary…" className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {/* Content */}
        {!isLoading && (
          <div className="flex flex-col gap-6">
            {/* Items grouped by vendor from basket */}
            {basket?.groupedByVendor && basket.groupedByVendor.length > 0 && (
              <div>
                <h2 className="text-sm font-semibold text-grovio-text mb-3">Items</h2>
                <div className="flex flex-col gap-4">
                  {basket.groupedByVendor.map((vendorGroup) => (
                    <div
                      key={vendorGroup.vendorId}
                      className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4"
                    >
                      <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide mb-3">
                        {vendorGroup.vendorName}
                      </p>
                      <div className="flex flex-col gap-2">
                        {vendorGroup.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between gap-4">
                            <div className="flex-1 min-w-0">
                              <p className="text-sm text-grovio-text truncate">{item.productName}</p>
                              <p className="text-xs text-grovio-text-muted">
                                Qty: {item.quantity}
                              </p>
                            </div>
                            <p className="text-sm font-medium text-grovio-text flex-shrink-0">
                              {formatMinor(item.lineSubtotalMinor)}
                            </p>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Order totals — from server (CHK-04, T-05-04) */}
            {summary && (
              <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-5">
                <h2 className="text-sm font-semibold text-grovio-text mb-4">Order total</h2>
                <div className="flex flex-col gap-2 text-sm">
                  <div className="flex justify-between">
                    <span className="text-grovio-text-muted">Subtotal</span>
                    <span className="text-grovio-text">{formatMinor(summary.subtotalMinor)}</span>
                  </div>
                  {summary.shippingMinor > 0 && (
                    <div className="flex justify-between">
                      <span className="text-grovio-text-muted">Shipping</span>
                      <span className="text-grovio-text">{formatMinor(summary.shippingMinor)}</span>
                    </div>
                  )}
                  {summary.discountMinor > 0 && (
                    <div className="flex justify-between">
                      <span className="text-grovio-text-muted">Discount</span>
                      <span className="text-green-600">-{formatMinor(summary.discountMinor)}</span>
                    </div>
                  )}
                  {summary.walletAppliedMinor > 0 && (
                    <div className="flex justify-between">
                      <span className="text-grovio-text-muted">Wallet credit</span>
                      <span className="text-green-600">-{formatMinor(summary.walletAppliedMinor)}</span>
                    </div>
                  )}
                  <div className="pt-2 border-t border-grovio-border flex justify-between font-semibold">
                    <span className="text-grovio-text">Total charged</span>
                    <span className="text-grovio-text">{formatMinor(summary.grandTotalMinor)}</span>
                  </div>
                </div>
              </div>
            )}

            {/* Payment method info */}
            {paymentResult && (
              <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
                <p className="text-sm text-grovio-text-muted">
                  Payment via{' '}
                  <span className="font-medium text-grovio-text capitalize">
                    {paymentResult.provider}
                  </span>{' '}
                  · Order <span className="font-medium">{paymentResult.displayId}</span>
                </p>
              </div>
            )}

            {/* Confirm button */}
            <Button
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={handleConfirm}
              disabled={!paymentResult}
            >
              Confirm Order
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
