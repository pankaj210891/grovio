/**
 * PaymentProvider interface — PAY-01: the hard architectural boundary from Pitfall 9.
 *
 * All checkout and order code depends ONLY on this interface.
 * The Stripe and Razorpay SDKs are imported exclusively in their respective adapter files:
 *   - StripeAdapter.ts (only file allowed to import the stripe SDK)
 *   - RazorpayAdapter.ts (only file allowed to import the razorpay SDK)
 *
 * This file has NO SDK imports — it is a pure interface + type definition.
 * SDK imports are confined to the two adapter files only (PAY-01 / Pitfall 9).
 *
 * Pattern source: RESEARCH.md Pattern 1, ARCHITECTURE.md PaymentProvider Abstraction.
 */

// ---------------------------------------------------------------------------
// Parameters and return types
// ---------------------------------------------------------------------------

/**
 * Parameters for creating a payment order on the provider side.
 * Passed from PaymentService → adapter on checkout initiation.
 */
export interface CreatePaymentOrderParams {
  /** Order total in minor currency units (BIGINT — Pitfall 1: never FLOAT). */
  amountMinor: bigint;
  /** ISO 4217 currency code (e.g., "inr", "usd"). */
  currency: string;
  /** Internal Grovio order ID — stored in provider metadata for webhook lookup. */
  orderId: string;
  /** Internal Grovio customer ID — stored in provider metadata. */
  customerId: string;
  /** Optional human-readable description shown on payment receipts. */
  description?: string;
}

/**
 * Provider-specific payment order details returned after order creation.
 * Both Stripe and Razorpay converge on this shape — differences are in which
 * fields are populated (null for the other provider).
 *
 * Stripe:
 *   - providerOrderId = PaymentIntent ID (pi_xxx)
 *   - clientSecret = PaymentIntent client_secret (for Elements confirmation)
 *   - providerKey = null
 *   - providerOrderRef = null
 *
 * Razorpay:
 *   - providerOrderId = Razorpay order ID (order_xxx) — Pitfall 4: order_id REQUIRED
 *   - clientSecret = null
 *   - providerKey = key_id (passed to checkout modal options)
 *   - providerOrderRef = Razorpay order_id (same as providerOrderId, passed as order_id in modal)
 */
export interface ProviderPaymentOrder {
  /** Unique ID assigned by the payment provider for this payment order. */
  providerOrderId: string;
  /**
   * Stripe PaymentIntent client_secret for client-side Elements confirmation.
   * null for Razorpay.
   */
  clientSecret: string | null;
  /**
   * Razorpay key_id for the checkout modal options.
   * null for Stripe.
   */
  providerKey: string | null;
  /**
   * Razorpay order_id passed to the checkout modal as order_id.
   * CRITICAL (Pitfall 4): Razorpay payments without order_id are auto-refunded.
   * null for Stripe.
   */
  providerOrderRef: string | null;
}

// ---------------------------------------------------------------------------
// Canonical webhook event type union (PAY-03, D-10)
// ---------------------------------------------------------------------------

/**
 * Canonical webhook event type union.
 * Both adapters map their provider-specific event types to this union.
 *
 * Stripe mapping:
 *   payment_intent.succeeded   → PAYMENT_CAPTURED
 *   payment_intent.payment_failed → PAYMENT_FAILED
 *   charge.refunded            → REFUND_SUCCEEDED
 *
 * Razorpay mapping:
 *   payment.captured           → PAYMENT_CAPTURED
 *   payment.failed             → PAYMENT_FAILED
 *   refund.processed           → REFUND_SUCCEEDED
 */
export interface WebhookEvent {
  /** Canonical event type — provider-neutral classification. */
  type:
    | "PAYMENT_CAPTURED"
    | "PAYMENT_FAILED"
    | "REFUND_SUCCEEDED"
    | "REFUND_FAILED";
  /** Provider-assigned unique event ID (for idempotency table — D-10). */
  providerEventId: string;
  /**
   * Internal Grovio order ID extracted from provider metadata.
   * Stripe: from event.data.object.metadata.orderId
   * Razorpay: from event.payload.payment.entity.notes.orderId
   */
  orderId: string;
  /** Payment or refund amount in minor currency units (BIGINT). */
  amountMinor: bigint;
  /** Which provider sent this event. */
  provider: "stripe" | "razorpay";
  /** Full raw provider event payload for audit storage. */
  rawPayload: unknown;
}

// ---------------------------------------------------------------------------
// PaymentProvider interface
// ---------------------------------------------------------------------------

/**
 * PaymentProvider interface — all checkout and order code depends on this.
 *
 * Implementations:
 *   - StripeAdapter  (apps/api/src/modules/payments/StripeAdapter.ts)
 *   - RazorpayAdapter (apps/api/src/modules/payments/RazorpayAdapter.ts)
 *
 * PAY-01: The PaymentService and all other application code reference ONLY
 * this interface — never the concrete adapter classes or their SDK types.
 */
export interface PaymentProvider {
  /**
   * Create a payment order on the provider side.
   * Stripe: creates a PaymentIntent.
   * Razorpay: creates an order (REQUIRED before opening modal — Pitfall 4).
   */
  createPaymentOrder(
    params: CreatePaymentOrderParams
  ): Promise<ProviderPaymentOrder>;

  /**
   * Verify webhook signature and parse the raw body into a canonical WebhookEvent.
   *
   * Stripe: uses stripe.webhooks.constructEvent() (HMAC + timestamp tolerance).
   * Razorpay: uses crypto.createHmac + crypto.timingSafeEqual (Pattern 5).
   *
   * Throws if signature verification fails — the route handler must catch and
   * return 400 without touching the DB.
   *
   * @param rawBody - Raw request body Buffer (not parsed JSON — Pitfall 1/Pattern 4)
   * @param signature - Value from 'stripe-signature' or 'x-razorpay-signature' header
   */
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent>;

  /**
   * Initiate a refund for a previously captured payment.
   * Stripe: calls stripe.refunds.create()
   * Razorpay: calls razorpay.payments.refund()
   *
   * @param params.providerOrderId - The provider's payment/order ID to refund
   * @param params.amountMinor - Refund amount in minor currency units
   */
  initiateRefund(params: {
    providerOrderId: string;
    amountMinor: bigint;
  }): Promise<void>;
}

// ---------------------------------------------------------------------------
// Domain error
// ---------------------------------------------------------------------------

/**
 * Thrown by PaymentService.getProvider() when the requested provider is not
 * configured (missing env keys — PAY-02).
 */
export class ProviderNotConfiguredError extends Error {
  constructor(provider: string) {
    super(
      `Payment provider "${provider}" is not configured. ` +
        `Ensure the required environment variables are set.`
    );
    this.name = "ProviderNotConfiguredError";
  }
}
