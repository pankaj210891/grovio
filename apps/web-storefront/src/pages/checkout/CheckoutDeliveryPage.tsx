/**
 * CheckoutDeliveryPage — /checkout/delivery (step 2 of 4, D-05)
 *
 * Customer chooses a delivery option. On "Proceed to Payment":
 *   1. Calls useInitiateCheckout (POST /checkout/initiate) → reserves inventory (CHK-05, D-06)
 *   2. Navigates to /checkout/payment on success.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { CheckoutProgress } from '../../components/checkout/CheckoutProgress.js';
import { Button } from '../../components/ui/Button.js';
import { useCheckoutStore, useInitiateCheckout } from '../../hooks/useCheckout.js';
import { useUiStore } from '../../store/ui-store.js';
import { ApiError } from '../../lib/api-client.js';

// ---------------------------------------------------------------------------
// Delivery options (STUB — WR-04)
//
// In production these must come from GET /checkout/delivery-options (or be
// returned from POST /checkout/initiate) so the price labels shown here match
// the authoritative shippingMinor from GET /checkout/summary. The current
// static list (Free / ₹99) does NOT match what the server charges — buyers
// MUST replace this with a real API-driven fetch before going live to avoid
// misleading customers with incorrect delivery costs.
// ---------------------------------------------------------------------------

interface DeliveryOption {
  id: string;
  label: string;
  description: string;
  priceLabel: string;
  estimatedDays: string;
}

const DELIVERY_OPTIONS: DeliveryOption[] = [
  {
    id: 'standard',
    label: 'Standard Delivery',
    description: 'Delivered by your local carrier',
    priceLabel: 'Free',
    estimatedDays: '5–7 business days',
  },
  {
    id: 'express',
    label: 'Express Delivery',
    description: 'Priority handling and delivery',
    priceLabel: '₹99',
    estimatedDays: '1–2 business days',
  },
];

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutDeliveryPage() {
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const {
    selectedAddressId,
    selectedDeliveryOption,
    setSelectedDeliveryOption,
  } = useCheckoutStore();

  const [localOption, setLocalOption] = useState<string>(
    selectedDeliveryOption ?? DELIVERY_OPTIONS[0]!.id,
  );

  const initiateCheckout = useInitiateCheckout();

  async function handleProceed() {
    if (!selectedAddressId || !localOption) return;

    try {
      await initiateCheckout.mutateAsync({
        addressId: selectedAddressId,
        deliveryOption: localOption,
      });
      setSelectedDeliveryOption(localOption);
      void navigate('/checkout/payment');
    } catch (err: unknown) {
      if (err instanceof ApiError && err.status === 409) {
        const serverMsg =
          (err.body as { error?: { message?: string } } | null)?.error?.message;
        addToast({
          id: crypto.randomUUID(),
          message: serverMsg ?? 'Some items in your basket are out of stock. Please update your cart.',
          variant: 'error',
        });
      } else {
        addToast({
          id: crypto.randomUUID(),
          message: "We couldn't reserve your items. Please try again.",
          variant: 'error',
        });
      }
    }
  }

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Progress indicator */}
        <div className="mb-8">
          <CheckoutProgress currentStep="delivery" />
        </div>

        <h1 className="text-xl font-semibold text-grovio-text mb-6">Delivery options</h1>

        {/* Delivery option list */}
        <div className="flex flex-col gap-3 max-w-lg">
          {DELIVERY_OPTIONS.map((option) => {
            const isSelected = localOption === option.id;
            return (
              <button
                key={option.id}
                type="button"
                onClick={() => setLocalOption(option.id)}
                className={[
                  'w-full text-left rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary',
                  isSelected
                    ? 'border-grovio-primary bg-grovio-primary/5'
                    : 'border-grovio-border bg-grovio-surface-raised hover:border-grovio-text-muted',
                ].join(' ')}
                aria-pressed={isSelected}
              >
                <div className="flex items-start gap-3">
                  <div
                    className={[
                      'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0',
                      isSelected ? 'border-grovio-primary bg-grovio-primary' : 'border-grovio-border',
                    ].join(' ')}
                    aria-hidden="true"
                  />
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center justify-between gap-2">
                      <p className="text-sm font-semibold text-grovio-text">{option.label}</p>
                      <p className="text-sm font-semibold text-grovio-text flex-shrink-0">
                        {option.priceLabel}
                      </p>
                    </div>
                    <p className="text-sm text-grovio-text-muted mt-0.5">{option.description}</p>
                    <p className="text-xs text-grovio-text-muted mt-0.5">{option.estimatedDays}</p>
                  </div>
                </div>
              </button>
            );
          })}
        </div>

        {/* CTA */}
        <div className="mt-8">
          <Button
            type="button"
            variant="primary"
            className="w-full sm:w-auto"
            onClick={() => { void handleProceed(); }}
            loading={initiateCheckout.isPending}
            disabled={!localOption || !selectedAddressId}
          >
            {initiateCheckout.isPending ? 'Reserving items…' : 'Proceed to Payment'}
          </Button>
        </div>
      </div>
    </PageTransition>
  );
}
