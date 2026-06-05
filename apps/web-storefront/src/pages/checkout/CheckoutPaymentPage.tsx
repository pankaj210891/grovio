/**
 * CheckoutPaymentPage — /checkout/payment (step 3 of 4, D-05)
 *
 * Renders the payment step with:
 *   - WalletCreditToggle (WAL-05, D-13)
 *   - StripePaymentForm (when Stripe is enabled)
 *   - RazorpayButton (when Razorpay is enabled)
 *
 * Provider visibility is driven by GET /checkout/providers (D-09).
 * All amounts sourced from GET /checkout/summary (CHK-04, T-05-04).
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { CheckoutProgress } from '../../components/checkout/CheckoutProgress.js';
import { Button } from '../../components/ui/Button.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { WalletCreditToggle } from '../../components/wallet/WalletCreditToggle.js';
import { StripePaymentForm } from '../../components/checkout/StripePaymentForm.js';
import { RazorpayButton } from '../../components/checkout/RazorpayButton.js';
import {
  useCheckoutSummary,
  useCheckoutProviders,
  usePlaceOrder,
  useCheckoutStore,
} from '../../hooks/useCheckout.js';
import { useWallet } from '../../hooks/useWallet.js';
import { useUiStore } from '../../store/ui-store.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import type { PaymentProviderId } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutPaymentPage() {
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);

  const { data: summary, isLoading: summaryLoading } = useCheckoutSummary();
  const { data: providers, isLoading: providersLoading } = useCheckoutProviders();
  const { data: wallet } = useWallet();

  // CR-02: single useCheckoutStore subscription — both paymentResult and setters
  const {
    selectedAddressId,
    walletCreditRequested,
    appliedCouponCode,
    paymentResult,
    setWalletCreditRequested,
    setPaymentResult,
  } = useCheckoutStore();

  const placeOrder = usePlaceOrder();

  // Selected provider — default to first available
  const [selectedProvider, setSelectedProvider] = useState<PaymentProviderId | null>(null);

  const isLoading = summaryLoading || providersLoading;

  // Effective provider: if only one is enabled, auto-select it
  const effectiveProvider: PaymentProviderId | null = (() => {
    if (!providers) return null;
    if (selectedProvider) return selectedProvider;
    if (providers.stripe && !providers.razorpay) return 'stripe';
    if (providers.razorpay && !providers.stripe) return 'razorpay';
    return null; // Both enabled — customer must choose
  })();

  // The charge amount after wallet credit (from server summary)
  const chargeMinor = summary?.grandTotalMinor ?? 0;
  const balanceMinor = wallet?.balanceMinor ?? 0;

  // Initiate payment — calls POST /checkout/place-order, stores result
  async function handlePlaceOrder(provider: PaymentProviderId) {
    if (!selectedAddressId) {
      addToast({ id: crypto.randomUUID(), message: 'Please select a delivery address.', variant: 'error' });
      return;
    }

    try {
      const res = await placeOrder.mutateAsync({
        addressId: selectedAddressId,
        paymentProvider: provider,
        walletAppliedMinor: walletCreditRequested,
        couponCode: appliedCouponCode,
      });
      setPaymentResult(res.data);
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        addToast({
          id: crypto.randomUUID(),
          message: 'Some items are no longer available. Please update your basket.',
          variant: 'error',
        });
      } else {
        addToast({
          id: crypto.randomUUID(),
          message: 'Payment could not be initiated. Please try again.',
          variant: 'error',
        });
      }
    }
  }

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Progress */}
        <div className="mb-8">
          <CheckoutProgress currentStep="payment" />
        </div>

        <h1 className="text-xl font-semibold text-grovio-text mb-6">Payment</h1>

        {isLoading && (
          <div aria-busy="true" aria-label="Loading payment options…" className="flex flex-col gap-4">
            {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
          </div>
        )}

        {!isLoading && summary && providers && (
          <div className="flex flex-col gap-6 max-w-lg">
            {/* Order total from server (CHK-04, T-05-04) */}
            <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
              <div className="flex justify-between text-sm">
                <span className="text-grovio-text-muted">Basket total</span>
                <span className="text-grovio-text">{formatMinor(summary.subtotalMinor)}</span>
              </div>
              {summary.shippingMinor > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-grovio-text-muted">Shipping</span>
                  <span className="text-grovio-text">{formatMinor(summary.shippingMinor)}</span>
                </div>
              )}
              {summary.discountMinor > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-grovio-text-muted">Discount</span>
                  <span className="text-green-600">-{formatMinor(summary.discountMinor)}</span>
                </div>
              )}
              {summary.walletAppliedMinor > 0 && (
                <div className="flex justify-between text-sm mt-1">
                  <span className="text-grovio-text-muted">Wallet credit</span>
                  <span className="text-green-600">-{formatMinor(summary.walletAppliedMinor)}</span>
                </div>
              )}
              <div className="flex justify-between text-sm font-semibold mt-2 pt-2 border-t border-grovio-border">
                <span className="text-grovio-text">Amount to pay</span>
                <span className="text-grovio-text">{formatMinor(chargeMinor)}</span>
              </div>
            </div>

            {/* Wallet credit toggle (WAL-05, D-13) */}
            {balanceMinor > 0 && (
              <WalletCreditToggle
                balanceMinor={balanceMinor}
                orderTotalMinor={summary.grandTotalMinor + summary.walletAppliedMinor}
                appliedMinor={walletCreditRequested}
                onAppliedChange={setWalletCreditRequested}
              />
            )}

            {/* Provider selection (D-09) — show both when both enabled */}
            {providers.stripe && providers.razorpay && !paymentResult && (
              <div>
                <p className="text-sm font-medium text-grovio-text mb-3">Choose payment method</p>
                <div className="flex flex-col gap-2">
                  {(['stripe', 'razorpay'] as PaymentProviderId[]).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setSelectedProvider(p)}
                      className={[
                        'w-full text-left rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary',
                        effectiveProvider === p
                          ? 'border-grovio-primary bg-grovio-primary/5'
                          : 'border-grovio-border bg-grovio-surface-raised hover:border-grovio-text-muted',
                      ].join(' ')}
                      aria-pressed={effectiveProvider === p}
                    >
                      <span className="text-sm font-medium capitalize">
                        {p === 'stripe' ? 'Card / Stripe' : 'Razorpay'}
                      </span>
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Stripe — CTA before order placed */}
            {effectiveProvider === 'stripe' && !paymentResult && (
              <Button
                type="button"
                variant="primary"
                className="w-full"
                loading={placeOrder.isPending}
                onClick={() => { void handlePlaceOrder('stripe'); }}
              >
                Continue with Stripe
              </Button>
            )}

            {/* Stripe Elements form — shown after placeOrder returns clientSecret */}
            {paymentResult !== null && paymentResult.provider === 'stripe' && paymentResult.providerOrder.clientSecret && (
              <StripePaymentForm
                clientSecret={paymentResult.providerOrder.clientSecret}
                orderId={paymentResult.orderId}
              />
            )}

            {/* Razorpay — CTA before order placed */}
            {effectiveProvider === 'razorpay' && !paymentResult && (
              <Button
                type="button"
                variant="primary"
                className="w-full"
                loading={placeOrder.isPending}
                onClick={() => { void handlePlaceOrder('razorpay'); }}
              >
                Continue with Razorpay
              </Button>
            )}

            {/* Razorpay modal trigger — shown after placeOrder returns order_id */}
            {paymentResult !== null && paymentResult.provider === 'razorpay' &&
              paymentResult.providerOrder.providerKey &&
              paymentResult.providerOrder.providerOrderRef && (
                <RazorpayButton
                  providerKey={paymentResult.providerOrder.providerKey}
                  providerOrderRef={paymentResult.providerOrder.providerOrderRef}
                  amountMinor={paymentResult.amountMinor}
                  orderId={paymentResult.orderId}
                  onSuccess={async (response) => {
                    // CR-03: verify HMAC signature server-side before navigating.
                    // The Razorpay modal is client-controlled — without this POST
                    // a caller could skip payment and navigate directly.
                    try {
                      await apiClient.post('/checkout/razorpay/verify', {
                        razorpayPaymentId: response.razorpay_payment_id,
                        razorpayOrderId: response.razorpay_order_id,
                        razorpaySignature: response.razorpay_signature,
                        orderId: paymentResult.orderId,
                      });
                      void navigate(`/order-confirmation/${paymentResult.orderId}`);
                    } catch {
                      addToast({
                        id: crypto.randomUUID(),
                        message: 'Payment verification failed. Please contact support.',
                        variant: 'error',
                      });
                    }
                  }}
                />
              )}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
