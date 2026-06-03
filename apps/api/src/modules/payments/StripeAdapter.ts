/**
 * StripeAdapter — infrastructure adapter for Stripe payments.
 *
 * CRITICAL: This is the ONLY file in the codebase allowed to import the `stripe` SDK.
 * All other modules depend on the PaymentProvider interface, never on Stripe types directly.
 * PAY-01 / Pitfall 9: SDK imports confined to this adapter.
 *
 * Pattern source: RESEARCH.md Pattern 1 (interface), Pattern 4 (constructEvent raw body).
 */
import Stripe from "stripe";
import type {
  CreatePaymentOrderParams,
  PaymentProvider,
  ProviderPaymentOrder,
  WebhookEvent,
} from "./PaymentProvider.js";

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export interface StripeAdapterOptions {
  /** Stripe secret key (sk_test_... / sk_live_...). From STRIPE_SECRET_KEY env var. */
  secretKey: string;
  /**
   * Stripe webhook signing secret. From STRIPE_WEBHOOK_SECRET env var.
   * Used by constructEvent() for HMAC + timestamp tolerance verification.
   */
  webhookSecret: string;
}

// ---------------------------------------------------------------------------
// StripeAdapter
// ---------------------------------------------------------------------------

/**
 * StripeAdapter implements PaymentProvider for Stripe.
 *
 * Stripe-specific behavior:
 * - createPaymentOrder: Creates a PaymentIntent (3DS-ready via automatic_payment_methods).
 *   Returns PaymentIntent.id as providerOrderId and client_secret for Elements confirmation.
 * - handleWebhook: Uses stripe.webhooks.constructEvent() for signature + timestamp verification.
 *   Maps payment_intent.succeeded → PAYMENT_CAPTURED, payment_intent.payment_failed →
 *   PAYMENT_FAILED, charge.refunded → REFUND_SUCCEEDED.
 * - initiateRefund: Calls stripe.refunds.create().
 */
export class StripeAdapter implements PaymentProvider {
  private readonly stripe: Stripe;
  private readonly webhookSecret: string;

  constructor(options: StripeAdapterOptions) {
    this.stripe = new Stripe(options.secretKey);
    this.webhookSecret = options.webhookSecret;
  }

  // ---------------------------------------------------------------------------
  // createPaymentOrder
  // ---------------------------------------------------------------------------

  /**
   * Creates a Stripe PaymentIntent and returns the client_secret for Elements confirmation.
   *
   * 3DS-ready: automatic_payment_methods: { enabled: true } delegates SCA/3DS handling
   * to Stripe.js on the client. The PaymentIntent amount is in minor units (e.g., paise/cents).
   *
   * Pitfall 1 (RESEARCH): amountMinor is passed as-is — Stripe accepts minor units.
   * orderId is stored in metadata for webhook → order lookup.
   */
  async createPaymentOrder(
    params: CreatePaymentOrderParams
  ): Promise<ProviderPaymentOrder> {
    const intent = await this.stripe.paymentIntents.create({
      amount: Number(params.amountMinor), // minor units (paise/cents)
      currency: params.currency,
      automatic_payment_methods: { enabled: true },
      metadata: {
        orderId: params.orderId,
        customerId: params.customerId,
        ...(params.description ? { description: params.description } : {}),
      },
    });

    return {
      providerOrderId: intent.id, // PaymentIntent ID (pi_xxx)
      clientSecret: intent.client_secret, // for Elements stripe.confirmPayment()
      providerKey: null, // Stripe does not need key_id on the client
      providerOrderRef: null, // Stripe does not use a separate order_id
    };
  }

  // ---------------------------------------------------------------------------
  // handleWebhook
  // ---------------------------------------------------------------------------

  /**
   * Verifies Stripe webhook signature and returns a canonical WebhookEvent.
   *
   * Pattern 4 (RESEARCH): rawBody MUST be the raw Buffer from Fastify's
   * addContentTypeParser({ parseAs: 'buffer' }) — NOT parsed JSON.
   * stripe.webhooks.constructEvent() verifies HMAC-SHA256 with timestamp tolerance
   * to prevent replay attacks. Throws if verification fails.
   *
   * T-05-05 (threat model): signature verification is the first action; no DB
   * access happens before the event is verified.
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent> {
    // constructEvent throws on signature failure — let the route handler catch it
    const event = this.stripe.webhooks.constructEvent(
      rawBody,
      signature,
      this.webhookSecret
    );

    return this.mapStripeEvent(event);
  }

  // ---------------------------------------------------------------------------
  // initiateRefund
  // ---------------------------------------------------------------------------

  /**
   * Initiates a refund via the Stripe Refunds API.
   * providerOrderId is expected to be the PaymentIntent ID (pi_xxx).
   */
  async initiateRefund(params: {
    providerOrderId: string;
    amountMinor: bigint;
  }): Promise<void> {
    await this.stripe.refunds.create({
      payment_intent: params.providerOrderId,
      amount: Number(params.amountMinor),
    });
  }

  // ---------------------------------------------------------------------------
  // Private: mapStripeEvent
  // ---------------------------------------------------------------------------

  /**
   * Maps a verified Stripe event to the canonical WebhookEvent union.
   * Throws on unhandled event types (caller should ignore 200 responses for unknowns).
   */
  private mapStripeEvent(event: Stripe.Event): WebhookEvent {
    switch (event.type) {
      case "payment_intent.succeeded": {
        const pi = event.data.object as Stripe.PaymentIntent;
        return {
          type: "PAYMENT_CAPTURED",
          providerEventId: event.id,
          orderId: pi.metadata?.orderId ?? "",
          amountMinor: BigInt(pi.amount_received),
          provider: "stripe",
          rawPayload: event,
        };
      }

      case "payment_intent.payment_failed": {
        const pi = event.data.object as Stripe.PaymentIntent;
        return {
          type: "PAYMENT_FAILED",
          providerEventId: event.id,
          orderId: pi.metadata?.orderId ?? "",
          amountMinor: BigInt(pi.amount),
          provider: "stripe",
          rawPayload: event,
        };
      }

      case "charge.refunded": {
        const charge = event.data.object as Stripe.Charge;
        return {
          type: "REFUND_SUCCEEDED",
          providerEventId: event.id,
          // Extract orderId from payment_intent metadata via charge.payment_intent metadata
          // Route handlers should also look up by charge.payment_intent ID
          orderId: (charge.metadata as Record<string, string>)?.orderId ?? "",
          amountMinor: BigInt(charge.amount_refunded),
          provider: "stripe",
          rawPayload: event,
        };
      }

      default:
        // Return a best-effort event for unknown types; PaymentService will handle gracefully
        return {
          type: "PAYMENT_FAILED",
          providerEventId: event.id,
          orderId: "",
          amountMinor: 0n,
          provider: "stripe",
          rawPayload: event,
        };
    }
  }
}
