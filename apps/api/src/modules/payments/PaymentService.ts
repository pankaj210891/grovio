/**
 * PaymentService — application-layer orchestration for payment operations.
 *
 * PAY-01 enforcement: This service imports ONLY the PaymentProvider interface
 * and the two adapter classes. It NEVER imports `stripe` or `razorpay` SDKs directly.
 *
 * Responsibilities:
 * - getEnabledProviders(): Returns {stripe, razorpay} booleans based on configured env keys (PAY-02, D-09).
 * - getProvider(): Returns the PaymentProvider implementation for a given provider ID,
 *   or throws ProviderNotConfiguredError if keys are absent (PAY-02).
 * - createPaymentOrder(): Delegates to the configured adapter's createPaymentOrder().
 * - recordWebhookEvent(): Idempotent DB upsert for incoming webhook events (PAY-03, D-10, T-05-02).
 *
 * Pattern source: RESEARCH.md Pattern 1, Pattern 4 (onConflictDoNothing idempotency).
 */
import type { FastifyBaseLogger } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { paymentEvents } from "../../db/schema/index.js";
import { RazorpayAdapter } from "./RazorpayAdapter.js";
import { StripeAdapter } from "./StripeAdapter.js";
import type {
  CreatePaymentOrderParams,
  PaymentProvider,
  ProviderPaymentOrder,
  WebhookEvent,
} from "./PaymentProvider.js";
import { ProviderNotConfiguredError } from "./PaymentProvider.js";

// ---------------------------------------------------------------------------
// Dependency types
// ---------------------------------------------------------------------------

interface PaymentServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
  logger: FastifyBaseLogger;
}

// ---------------------------------------------------------------------------
// PaymentService
// ---------------------------------------------------------------------------

/**
 * PaymentService — selects the enabled payment provider(s) from configuration,
 * delegates create-order / refund through the PaymentProvider interface, and
 * handles idempotent webhook event recording.
 *
 * PAY-01: Only adapter imports go to StripeAdapter/RazorpayAdapter.
 * No Stripe or Razorpay SDK types leak into this class.
 */
export class PaymentService {
  /** Lazily-constructed Stripe adapter (null if STRIPE_SECRET_KEY is not set) */
  private stripeAdapter: StripeAdapter | null = null;
  /** Lazily-constructed Razorpay adapter (null if RAZORPAY_KEY_ID is not set) */
  private razorpayAdapter: RazorpayAdapter | null = null;

  constructor(private deps: PaymentServiceDeps) {
    // Initialize adapters if their env keys are present
    const { env } = deps;

    if (env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET) {
      this.stripeAdapter = new StripeAdapter({
        secretKey: env.STRIPE_SECRET_KEY,
        webhookSecret: env.STRIPE_WEBHOOK_SECRET,
      });
    }

    if (
      env.RAZORPAY_KEY_ID &&
      env.RAZORPAY_KEY_SECRET &&
      env.RAZORPAY_WEBHOOK_SECRET
    ) {
      this.razorpayAdapter = new RazorpayAdapter({
        keyId: env.RAZORPAY_KEY_ID,
        keySecret: env.RAZORPAY_KEY_SECRET,
        webhookSecret: env.RAZORPAY_WEBHOOK_SECRET,
      });
    }
  }

  // ---------------------------------------------------------------------------
  // getEnabledProviders (PAY-02, D-09)
  // ---------------------------------------------------------------------------

  /**
   * Returns which payment providers are currently enabled (keys configured).
   *
   * PAY-02: Buyer enables one or both providers by setting the required env keys.
   * D-09: Payment step shows both options when both are enabled; single option otherwise.
   */
  getEnabledProviders(): { stripe: boolean; razorpay: boolean } {
    return {
      stripe: this.stripeAdapter !== null,
      razorpay: this.razorpayAdapter !== null,
    };
  }

  // ---------------------------------------------------------------------------
  // getProvider (PAY-02)
  // ---------------------------------------------------------------------------

  /**
   * Returns the PaymentProvider implementation for the given provider ID.
   * Throws ProviderNotConfiguredError if the provider's keys are not set.
   *
   * @throws {ProviderNotConfiguredError} if provider is not configured
   */
  getProvider(id: "stripe" | "razorpay"): PaymentProvider {
    if (id === "stripe") {
      if (!this.stripeAdapter) {
        throw new ProviderNotConfiguredError("stripe");
      }
      return this.stripeAdapter;
    }

    if (id === "razorpay") {
      if (!this.razorpayAdapter) {
        throw new ProviderNotConfiguredError("razorpay");
      }
      return this.razorpayAdapter;
    }

    // TypeScript exhaustiveness guard
    throw new ProviderNotConfiguredError(id);
  }

  // ---------------------------------------------------------------------------
  // createPaymentOrder
  // ---------------------------------------------------------------------------

  /**
   * Creates a payment order on the specified provider.
   * Delegates to the adapter's createPaymentOrder() via the PaymentProvider interface.
   *
   * @throws {ProviderNotConfiguredError} if provider is not configured
   */
  async createPaymentOrder(
    provider: "stripe" | "razorpay",
    params: CreatePaymentOrderParams
  ): Promise<ProviderPaymentOrder> {
    const adapter = this.getProvider(provider);
    return adapter.createPaymentOrder(params);
  }

  // ---------------------------------------------------------------------------
  // recordWebhookEvent (PAY-03, D-10, T-05-02)
  // ---------------------------------------------------------------------------

  /**
   * Idempotently records a verified webhook event in the payment_events table.
   *
   * D-10: Unique constraint on (provider, provider_event_id) ensures duplicate webhook
   * deliveries are no-ops. onConflictDoNothing() returns an empty array on duplicate.
   *
   * T-05-02: DB-level idempotency survives server restarts and horizontal scaling.
   *
   * @returns true if the event was newly inserted (first delivery), false if duplicate
   */
  async recordWebhookEvent(
    provider: "stripe" | "razorpay",
    event: WebhookEvent
  ): Promise<boolean> {
    const { db, logger } = this.deps;

    try {
      const inserted = await db
        .insert(paymentEvents)
        .values({
          provider,
          providerEventId: event.providerEventId,
          eventType: event.type,
          payload: event.rawPayload as Record<string, unknown>,
        })
        .onConflictDoNothing({
          target: [paymentEvents.provider, paymentEvents.providerEventId],
        })
        .returning({ id: paymentEvents.id });

      // Empty array = duplicate delivery (unique constraint fired)
      if (inserted.length === 0) {
        logger.debug(
          { provider, providerEventId: event.providerEventId },
          "Duplicate webhook event — skipping (D-10 idempotency)"
        );
        return false;
      }

      logger.info(
        { provider, providerEventId: event.providerEventId, eventType: event.type },
        "Webhook event recorded"
      );
      return true;
    } catch (err) {
      logger.error(
        { provider, providerEventId: event.providerEventId, err },
        "Failed to record webhook event"
      );
      throw err;
    }
  }
}
