/**
 * RazorpayAdapter — infrastructure adapter for Razorpay payments.
 *
 * CRITICAL: This is the ONLY file in the codebase allowed to import the `razorpay` SDK.
 * All other modules depend on the PaymentProvider interface, never on Razorpay types directly.
 * PAY-01 / Pitfall 9: SDK imports confined to this adapter.
 *
 * Pattern source: RESEARCH.md Pattern 1 (interface), Pattern 5 (HMAC webhook verification),
 * Pitfall 4 (order_id REQUIRED before modal).
 */
import crypto from "node:crypto";
import Razorpay from "razorpay";
import type {
  CreatePaymentOrderParams,
  PaymentProvider,
  ProviderPaymentOrder,
  WebhookEvent,
} from "./PaymentProvider.js";

// ---------------------------------------------------------------------------
// Constructor options
// ---------------------------------------------------------------------------

export interface RazorpayAdapterOptions {
  /** Razorpay key ID (rzp_test_... / rzp_live_...). From RAZORPAY_KEY_ID env var. */
  keyId: string;
  /** Razorpay key secret. From RAZORPAY_KEY_SECRET env var. Never exposed to client. */
  keySecret: string;
  /**
   * Razorpay webhook secret. From RAZORPAY_WEBHOOK_SECRET env var.
   * Used for HMAC-SHA256 signature verification (Pattern 5).
   */
  webhookSecret: string;
}

// ---------------------------------------------------------------------------
// RazorpayAdapter
// ---------------------------------------------------------------------------

/**
 * RazorpayAdapter implements PaymentProvider for Razorpay.
 *
 * Razorpay-specific behavior:
 * - createPaymentOrder: Creates a Razorpay order (CRITICAL — Pitfall 4: payments without
 *   order_id are auto-refunded by Razorpay). Returns order.id as both providerOrderId and
 *   providerOrderRef; returns keyId as providerKey for the frontend modal options.
 * - handleWebhook: HMAC-SHA256 verification via crypto.createHmac + crypto.timingSafeEqual
 *   (Pattern 5 — timing-safe comparison prevents timing attacks on the signature check).
 *   Maps payment.captured → PAYMENT_CAPTURED, payment.failed → PAYMENT_FAILED,
 *   refund.processed → REFUND_SUCCEEDED.
 * - initiateRefund: Calls razorpay.payments.refund().
 */
export class RazorpayAdapter implements PaymentProvider {
  private readonly razorpay: Razorpay;
  private readonly keyId: string;
  private readonly webhookSecret: string;

  constructor(options: RazorpayAdapterOptions) {
    this.razorpay = new Razorpay({
      key_id: options.keyId,
      key_secret: options.keySecret,
    });
    this.keyId = options.keyId;
    this.webhookSecret = options.webhookSecret;
  }

  // ---------------------------------------------------------------------------
  // createPaymentOrder
  // ---------------------------------------------------------------------------

  /**
   * Creates a Razorpay order and returns the order_id required for the checkout modal.
   *
   * CRITICAL (Pitfall 4): Razorpay requires a server-side order to be created before
   * the checkout modal is opened. Payments made without order_id are NOT captured
   * and are automatically refunded by Razorpay.
   *
   * The returned providerOrderRef (= order.id) MUST be passed as `order_id` in
   * the Razorpay checkout modal options on the frontend.
   * The returned providerKey (= keyId) MUST be passed as `key` in modal options.
   *
   * orderId is stored in order.notes.orderId for webhook → Grovio order lookup.
   */
  async createPaymentOrder(
    params: CreatePaymentOrderParams
  ): Promise<ProviderPaymentOrder> {
    const order = await this.razorpay.orders.create({
      amount: Number(params.amountMinor), // minor units (paise)
      currency: params.currency.toUpperCase(),
      notes: {
        orderId: params.orderId,
        customerId: params.customerId,
        ...(params.description ? { description: params.description } : {}),
      },
    });

    return {
      providerOrderId: order.id, // Razorpay order ID (order_xxx)
      clientSecret: null, // Razorpay does not use client_secret
      providerKey: this.keyId, // key_id passed to checkout modal as `key`
      providerOrderRef: order.id, // passed to checkout modal as `order_id` (Pitfall 4)
    };
  }

  // ---------------------------------------------------------------------------
  // handleWebhook
  // ---------------------------------------------------------------------------

  /**
   * Verifies Razorpay webhook signature and returns a canonical WebhookEvent.
   *
   * Pattern 5 (RESEARCH): HMAC-SHA256 using Node.js built-in `crypto` module.
   * crypto.timingSafeEqual prevents timing attacks on the signature comparison.
   *
   * T-05-05 (threat model): signature verification is the first action; no DB
   * access happens before the event is verified.
   *
   * @param rawBody - Raw request body Buffer from Fastify's addContentTypeParser
   * @param signature - Value from 'x-razorpay-signature' header
   */
  async handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent> {
    // HMAC-SHA256 verification (Pattern 5)
    const computed = crypto
      .createHmac("sha256", this.webhookSecret)
      .update(rawBody)
      .digest("hex");

    // timing-safe comparison prevents signature length oracle attacks
    const sigBuffer = Buffer.from(signature, "hex");
    const computedBuffer = Buffer.from(computed, "hex");

    if (
      sigBuffer.length !== computedBuffer.length ||
      !crypto.timingSafeEqual(computedBuffer, sigBuffer)
    ) {
      throw new Error("Razorpay webhook signature verification failed");
    }

    // Parse the verified payload
    const payload = JSON.parse(rawBody.toString("utf8")) as Record<string, unknown>;
    return this.mapRazorpayEvent(payload);
  }

  // ---------------------------------------------------------------------------
  // initiateRefund
  // ---------------------------------------------------------------------------

  /**
   * Initiates a refund via the Razorpay Payments API.
   * providerOrderId is expected to be the Razorpay payment ID (pay_xxx).
   */
  async initiateRefund(params: {
    providerOrderId: string;
    amountMinor: bigint;
  }): Promise<void> {
    await this.razorpay.payments.refund(params.providerOrderId, {
      amount: Number(params.amountMinor),
    });
  }

  // ---------------------------------------------------------------------------
  // Private: mapRazorpayEvent
  // ---------------------------------------------------------------------------

  /**
   * Maps a verified Razorpay webhook payload to the canonical WebhookEvent union.
   *
   * Razorpay webhook event structure:
   *   { event: "payment.captured", payload: { payment: { entity: { ... } } } }
   *
   * orderId is extracted from notes.orderId (set during order creation).
   * providerEventId is derived from the payment/refund entity ID since Razorpay
   * does not provide a top-level unique event ID.
   */
  private mapRazorpayEvent(payload: Record<string, unknown>): WebhookEvent {
    const event = payload["event"] as string;
    const paymentEntity = (
      (payload["payload"] as Record<string, unknown>)?.[
        "payment"
      ] as Record<string, unknown>
    )?.["entity"] as Record<string, unknown> | undefined;

    const refundEntity = (
      (payload["payload"] as Record<string, unknown>)?.[
        "refund"
      ] as Record<string, unknown>
    )?.["entity"] as Record<string, unknown> | undefined;

    switch (event) {
      case "payment.captured": {
        const notes = (paymentEntity?.["notes"] as Record<string, string>) ?? {};
        return {
          type: "PAYMENT_CAPTURED",
          providerEventId: (paymentEntity?.["id"] as string) ?? "",
          orderId: notes["orderId"] ?? "",
          amountMinor: BigInt((paymentEntity?.["amount"] as number) ?? 0),
          provider: "razorpay",
          rawPayload: payload,
        };
      }

      case "payment.failed": {
        const notes = (paymentEntity?.["notes"] as Record<string, string>) ?? {};
        return {
          type: "PAYMENT_FAILED",
          providerEventId: (paymentEntity?.["id"] as string) ?? "",
          orderId: notes["orderId"] ?? "",
          amountMinor: BigInt((paymentEntity?.["amount"] as number) ?? 0),
          provider: "razorpay",
          rawPayload: payload,
        };
      }

      case "refund.processed": {
        const notes = (refundEntity?.["notes"] as Record<string, string>) ?? {};
        return {
          type: "REFUND_SUCCEEDED",
          providerEventId: (refundEntity?.["id"] as string) ?? "",
          orderId: notes["orderId"] ?? "",
          amountMinor: BigInt((refundEntity?.["amount"] as number) ?? 0),
          provider: "razorpay",
          rawPayload: payload,
        };
      }

      default:
        // Return best-effort for unknown event types
        return {
          type: "PAYMENT_FAILED",
          providerEventId: "",
          orderId: "",
          amountMinor: 0n,
          provider: "razorpay",
          rawPayload: payload,
        };
    }
  }
}
