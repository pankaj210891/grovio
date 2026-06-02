import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * paymentProviderEnum — supported payment providers (D-09, PAY-01).
 *
 * Values MUST exactly match PaymentProviderIdSchema in packages/contracts/src/payments/types.ts.
 * - stripe: Stripe payment provider
 * - razorpay: Razorpay payment provider
 */
export const paymentProviderEnum = pgEnum("payment_provider", [
  "stripe",
  "razorpay",
]);

/**
 * payment_events table — webhook idempotency table (D-10, PAY-03, T-05-02)
 *
 * Every incoming payment webhook is upserted into this table before any business
 * logic runs. The UNIQUE constraint on (provider, providerEventId) makes duplicate
 * webhook deliveries a no-op insert — the handler returns 200 and exits without
 * processing the event again.
 *
 * This table also serves as an audit trail for all payment webhook activity.
 * Buyers can inspect this table to debug payment issues in production.
 *
 * Key design decisions (T-05-02, D-10, PAY-03):
 * - unique constraint on (provider, provider_event_id): DB-level idempotency.
 *   `onConflictDoNothing()` in Drizzle catches the unique violation.
 *   Survives server restarts and horizontal scaling (no in-memory dedup).
 * - payload JSONB: stores the full provider event payload for audit/replay.
 * - processedAt: null = event received but handler not yet run (e.g., race between
 *   webhook arrival and order creation). Non-null = event fully processed.
 * - No FK to orders: webhook may arrive before the order record is created (Pitfall 8).
 *   Order lookup is done by provider_order_id on the orders table.
 *
 * Security: T-05-02 — unique constraint ensures duplicate webhook delivery is a no-op.
 * Signature verification is done BEFORE any insert into this table.
 *
 * Covers PAY-03.
 */
export const paymentEvents = pgTable(
  "payment_events",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * Payment provider that sent this webhook event.
     * Used as part of the compound idempotency key.
     */
    provider: paymentProviderEnum("provider").notNull(),

    /**
     * Provider-assigned unique event ID.
     * Stripe: Event ID (evt_xxx). Razorpay: Event ID or payment ID.
     * Together with provider, uniquely identifies this event across all providers.
     */
    providerEventId: text("provider_event_id").notNull(),

    /**
     * Human-readable event type string from the provider.
     * Stripe: e.g., 'payment_intent.succeeded', 'charge.refunded'.
     * Razorpay: e.g., 'payment.captured', 'refund.processed'.
     * Used for event routing to the appropriate handler.
     */
    eventType: text("event_type").notNull(),

    /**
     * Full provider event payload as received (after signature verification).
     * JSONB — stores the complete event object for audit and potential replay.
     * Useful for debugging payment issues and replaying failed events.
     */
    payload: jsonb("payload").notNull(),

    /**
     * Timestamp when the event handler completed processing.
     * null = received but not yet processed (e.g., order not found race — Pitfall 8).
     * Non-null = order finalization completed for this event.
     */
    processedAt: timestamp("processed_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * Compound unique constraint on (provider, provider_event_id) — D-10, PAY-03, T-05-02.
     * The named constraint enables `onConflictDoNothing({ target: [...] })` in Drizzle.
     * When a duplicate webhook arrives, the INSERT fails on this constraint, and
     * the webhook handler returns 200 without processing the event again.
     */
    unique("payment_events_provider_event_uniq").on(
      t.provider,
      t.providerEventId
    ),
  ]
);

/** TypeScript type for inserting a new payment event row */
export type InsertPaymentEvent = typeof paymentEvents.$inferInsert;

/** TypeScript type for selecting a payment event row */
export type SelectPaymentEvent = typeof paymentEvents.$inferSelect;
