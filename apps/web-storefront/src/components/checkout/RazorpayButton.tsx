/**
 * RazorpayButton — Razorpay CDN checkout.js modal integration (PAY-04, Pitfall 4)
 *
 * Pitfall 4 rule: order_id MUST be passed to the Razorpay constructor.
 * Without it Razorpay creates an order internally, bypassing our server's order
 * record — payment succeeds but the order is never found in our DB on webhook.
 *
 * No npm package needed for the browser — Razorpay uses a CDN checkout.js script
 * (`https://checkout.razorpay.com/v1/checkout.js`). This file loads that script
 * dynamically once, then opens the modal on click.
 *
 * PCI scope: Razorpay modal handles card entry in their hosted iframe (T-05-PCI).
 */

import { useEffect, useRef } from 'react';
import { Button } from '../ui/Button.js';

// ---------------------------------------------------------------------------
// window.Razorpay type declaration (CDN script — no npm type definitions)
// ---------------------------------------------------------------------------

interface RazorpayOptions {
  key: string;
  amount: number;     // Minor units (paise/cents)
  currency?: string;
  order_id: string;   // REQUIRED (Pitfall 4) — Razorpay order_id from our server
  name?: string;
  description?: string;
  handler: (response: RazorpayResponse) => void;
  modal?: {
    ondismiss?: () => void;
  };
}

interface RazorpayResponse {
  razorpay_payment_id: string;
  razorpay_order_id: string;
  razorpay_signature: string;
}

declare global {
  interface Window {
    Razorpay: new (options: RazorpayOptions) => { open: () => void };
  }
}

// ---------------------------------------------------------------------------
// Script loader (idempotent — loads once)
// ---------------------------------------------------------------------------

const RAZORPAY_SCRIPT_URL = 'https://checkout.razorpay.com/v1/checkout.js';
let scriptLoaded = false;
let scriptLoading = false;

function loadRazorpayScript(): Promise<void> {
  if (scriptLoaded) return Promise.resolve();
  if (scriptLoading) {
    // Wait for existing load
    return new Promise((resolve) => {
      const interval = setInterval(() => {
        if (scriptLoaded) { clearInterval(interval); resolve(); }
      }, 50);
    });
  }

  scriptLoading = true;
  return new Promise((resolve, reject) => {
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT_URL;
    script.async = true;
    script.onload = () => { scriptLoaded = true; scriptLoading = false; resolve(); };
    script.onerror = () => { scriptLoading = false; reject(new Error('Failed to load Razorpay')); };
    document.head.appendChild(script);
  });
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

interface RazorpayButtonProps {
  /** Razorpay key_id (VITE_RAZORPAY_KEY_ID or from server response) */
  providerKey: string;
  /** Razorpay order_id returned from our POST /checkout/place-order (Pitfall 4) */
  providerOrderRef: string;
  /** Amount in minor units (paise/cents) — matches what the server charged */
  amountMinor: number;
  /** Internal order ID for logging / error messages */
  orderId: string;
  /** Called when Razorpay modal reports payment success */
  onSuccess: (response: RazorpayResponse) => void;
  /** Called when modal is dismissed without payment */
  onDismiss?: () => void;
}

/**
 * Renders a "Pay with Razorpay" button that:
 * 1. Loads the Razorpay CDN checkout.js script (once)
 * 2. Opens `new window.Razorpay({ key, order_id, amount, handler })` on click
 * 3. Calls onSuccess with the payment response
 *
 * NOTE: No npm razorpay package is imported here — browser Razorpay integration
 * uses CDN script only (confirmed in 05-02 summary / STATE.md decision).
 */
export function RazorpayButton({
  providerKey,
  providerOrderRef,
  amountMinor,
  orderId,
  onSuccess,
  onDismiss,
}: RazorpayButtonProps) {
  const scriptReadyRef = useRef(false);

  useEffect(() => {
    void loadRazorpayScript().then(() => {
      scriptReadyRef.current = true;
    });
  }, []);

  function handleClick() {
    if (!scriptReadyRef.current || typeof window.Razorpay === 'undefined') {
      // Script not yet ready — trigger load and retry
      void loadRazorpayScript().then(() => {
        scriptReadyRef.current = true;
        openModal();
      });
      return;
    }
    openModal();
  }

  function openModal() {
    const rzp = new window.Razorpay({
      key: providerKey,
      order_id: providerOrderRef, // REQUIRED per Pitfall 4
      amount: amountMinor,
      currency: 'INR',
      name: 'Grovio',
      description: `Order ${orderId}`,
      handler: onSuccess,
      modal: {
        ...(onDismiss !== undefined && { ondismiss: onDismiss }),
      },
    });
    rzp.open();
  }

  return (
    <Button
      type="button"
      variant="primary"
      className="w-full"
      onClick={handleClick}
    >
      Pay with Razorpay
    </Button>
  );
}
