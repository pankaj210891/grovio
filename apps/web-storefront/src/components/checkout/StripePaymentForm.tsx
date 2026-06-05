/**
 * StripePaymentForm — Stripe Elements PaymentElement wrapper (PAY-04)
 *
 * Wraps <Elements stripe={loadStripe(publishableKey)} options={{ clientSecret }}>
 * with <PaymentElement> and a submit that calls stripe.confirmPayment.
 *
 * The return_url on confirmPayment points to /order-confirmation/:orderId so
 * Stripe redirects back after 3DS / bank auth (Pattern from RESEARCH.md).
 *
 * PCI scope stays with Stripe — card data never touches the app server (T-05-PCI).
 */

import { useCallback } from 'react';
import { Elements, PaymentElement, useStripe, useElements } from '@stripe/react-stripe-js';
import { loadStripe } from '@stripe/stripe-js';
import { Button } from '../ui/Button.js';
import { useUiStore } from '../../store/ui-store.js';

// ---------------------------------------------------------------------------
// Stripe instance — created once with the publishable key
// ---------------------------------------------------------------------------

const STRIPE_PUBLISHABLE_KEY =
  (import.meta.env['VITE_STRIPE_PUBLISHABLE_KEY'] as string | undefined) ?? '';

// loadStripe returns a Promise<Stripe | null>. Called outside component to avoid
// recreating on each render (Stripe.js best practice).
const stripePromise = STRIPE_PUBLISHABLE_KEY
  ? loadStripe(STRIPE_PUBLISHABLE_KEY)
  : null;

// ---------------------------------------------------------------------------
// Inner form (must be inside <Elements> to access useStripe / useElements)
// ---------------------------------------------------------------------------

interface StripeInnerFormProps {
  orderId: string;
}

function StripeInnerForm({ orderId }: StripeInnerFormProps) {
  const stripe = useStripe();
  const elements = useElements();
  const addToast = useUiStore((s) => s.addToast);

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      if (!stripe || !elements) return;

      const { error } = await stripe.confirmPayment({
        elements,
        confirmParams: {
          // Stripe will redirect here after payment (including 3DS / bank auth)
          return_url: `${window.location.origin}/order-confirmation/${orderId}`,
        },
      });

      if (error) {
        // confirmPayment only rejects with an error if the payment fails immediately
        // (e.g. invalid card, insufficient funds). For 3DS redirects it resolves
        // without error (the redirect happens). D-11: stay on step with error.
        addToast({
          id: crypto.randomUUID(),
          message: error.message ?? 'Payment failed. Please try another card.',
          variant: 'error',
        });
      }
      // On success, Stripe redirects to return_url — no explicit navigation needed here.
    },
    [stripe, elements, orderId, addToast],
  );

  return (
    <form onSubmit={(e) => { void handleSubmit(e); }} className="flex flex-col gap-5">
      {/* Stripe-hosted card entry iframe (PCI scope stays with Stripe, T-05-PCI) */}
      <PaymentElement />

      <Button
        type="submit"
        variant="primary"
        className="w-full"
        disabled={!stripe || !elements}
      >
        Pay now
      </Button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Public component
// ---------------------------------------------------------------------------

interface StripePaymentFormProps {
  /** Stripe PaymentIntent client_secret returned from POST /checkout/place-order */
  clientSecret: string;
  /** Internal order ID — used as the return_url path */
  orderId: string;
}

/**
 * Mounts the Stripe Elements PaymentElement with the given clientSecret.
 * Calls stripe.confirmPayment on submit, which redirects to /order-confirmation.
 */
export function StripePaymentForm({ clientSecret, orderId }: StripePaymentFormProps) {
  if (!stripePromise) {
    return (
      <p className="text-sm text-grovio-error" role="alert">
        Stripe is not configured. Set VITE_STRIPE_PUBLISHABLE_KEY.
      </p>
    );
  }

  return (
    <Elements
      stripe={stripePromise}
      options={{
        clientSecret,
        appearance: { theme: 'stripe' },
      }}
    >
      <StripeInnerForm orderId={orderId} />
    </Elements>
  );
}
