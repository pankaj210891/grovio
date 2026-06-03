import type { FastifyInstance } from "fastify";
import type { PaymentService } from "../../modules/payments/index.js";
import type { OrderService } from "../../modules/orders/index.js";
import { OrderNotFoundError } from "../../modules/orders/index.js";

/**
 * Stripe webhook route (raw-body + idempotent finalize, PAY-03, PAY-04, Pitfall 1).
 *
 * Security (T-05-05, T-05-02):
 *   - CRITICAL: `fastify.addContentTypeParser` is scoped to THIS plugin only.
 *     This prevents the raw-body parser from leaking to other routes (Pitfall 1).
 *     Raw body is required for Stripe signature verification (constructEvent).
 *   - Signature verified first (in StripeAdapter.handleWebhook) before any DB write (T-05-05).
 *   - Duplicate webhook detection: PaymentService.recordWebhookEvent uses onConflictDoNothing
 *     on (provider, provider_event_id) — returns false on duplicate (PAY-03, D-10, T-05-02).
 *   - finalizeOrder keyed by providerOrderId — idempotent (Pitfall 8):
 *     if order already payment_received → no-op; if not found → return 200 (provider will retry).
 *
 * POST /webhooks/stripe
 */
export async function stripeWebhookRoutes(fastify: FastifyInstance): Promise<void> {
  // CRITICAL: Override JSON parser for THIS plugin scope ONLY (RESEARCH.md Pattern 4, Pitfall 1).
  // Raw Buffer body is required for stripe.webhooks.constructEvent signature verification.
  // This does NOT affect other routes — the parser is scoped to this Fastify plugin enclosure.
  fastify.addContentTypeParser(
    "application/json",
    { parseAs: "buffer" },
    (_req, body, done) => {
      done(null, body); // Pass raw Buffer — Stripe needs exact bytes for HMAC verification
    }
  );

  function getPaymentService(): PaymentService {
    return fastify.diContainer.resolve<PaymentService>("paymentService");
  }

  function getOrderService(): OrderService {
    return fastify.diContainer.resolve<OrderService>("orderService");
  }

  // ── POST /webhooks/stripe ─────────────────────────────────────────────────
  // Receives Stripe webhook events, verifies signature, records idempotently,
  // and finalizes the order on PAYMENT_CAPTURED (PAY-04, Pitfall 8).
  fastify.post("/webhooks/stripe", async (request, reply) => {
    const paymentService = getPaymentService();
    const orderService = getOrderService();

    // Read raw Buffer body (required for constructEvent — MUST be exact bytes)
    const rawBody = request.body as Buffer;
    const sig = (request.headers["stripe-signature"] ?? "") as string;

    let webhookEvent;
    try {
      // 1. Verify signature + parse event via StripeAdapter (T-05-05)
      //    constructEvent verifies the HMAC and timestamp tolerance internally.
      //    Throws if signature invalid — never proceed to DB writes without verification.
      webhookEvent = await paymentService.getProvider("stripe").handleWebhook(rawBody, sig);
    } catch (err) {
      // Invalid signature — return 400 to signal to Stripe that we rejected the event
      fastify.log.warn({ err }, "[StripeWebhook] Signature verification failed");
      return reply.status(400).send({
        success: false,
        error: { code: "WEBHOOK_SIGNATURE_INVALID", message: "Invalid webhook signature" },
      });
    }

    // 2. Idempotent dedup: record event, skip if duplicate (PAY-03, D-10, T-05-02)
    const isNew = await paymentService.recordWebhookEvent("stripe", webhookEvent);
    if (!isNew) {
      // Duplicate delivery — return 200 without re-processing (PAY-03)
      fastify.log.debug(
        { providerEventId: webhookEvent.providerEventId },
        "[StripeWebhook] Duplicate event — skipping"
      );
      return reply.status(200).send({ received: true });
    }

    // 3. Handle PAYMENT_CAPTURED: finalize the order (Pitfall 8)
    if (webhookEvent.type === "PAYMENT_CAPTURED") {
      try {
        await orderService.finalizeOrder(webhookEvent.providerEventId);
      } catch (err) {
        if (err instanceof OrderNotFoundError) {
          // Order not found — Pitfall 8: webhook arrived before order was persisted.
          // Return 200 so Stripe does NOT retry (we'll pick it up on the next delivery).
          fastify.log.warn(
            { providerEventId: webhookEvent.providerEventId },
            "[StripeWebhook] OrderNotFound — returning 200 for retry on next delivery (Pitfall 8)"
          );
          return reply.status(200).send({ received: true });
        }
        throw err; // Re-throw unexpected errors — Stripe will retry
      }
    }

    return reply.status(200).send({ received: true });
  });
}
