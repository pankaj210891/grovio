import { z } from "zod";

/**
 * Payment contract schemas for Phase 5: Commerce Core.
 *
 * Per PAY-01: All payment operations go through the PaymentProvider abstraction.
 * No provider SDK types should appear here — only the shared JSON-boundary shapes.
 *
 * Per Pitfall 5: amountMinor is z.number().int() (not z.bigint()) because
 * BigInt cannot cross the JSON boundary.
 *
 * Per D-09: When both providers are enabled, the payment step shows both options.
 */

/**
 * Identifies the configured payment provider.
 * Values MUST match the paymentProviderEnum pgEnum in the database schema.
 */
export const PaymentProviderIdSchema = z.enum(["stripe", "razorpay"]);

/** TypeScript type inferred from PaymentProviderIdSchema */
export type PaymentProviderId = z.infer<typeof PaymentProviderIdSchema>;

/**
 * Provider-specific payment order details returned after order creation.
 * Both providers converge on this shape at the JSON boundary.
 *
 * Stripe: clientSecret is the PaymentIntent client_secret for Elements confirmation.
 * Razorpay: providerKey is key_id, providerOrderRef is the Razorpay order_id for modal.
 */
export const ProviderPaymentOrderSchema = z.object({
  /** Unique ID assigned by the payment provider for this payment order */
  providerOrderId: z.string(),
  /**
   * Stripe PaymentIntent client_secret for client-side confirmation.
   * null for Razorpay (uses providerKey + providerOrderRef instead).
   */
  clientSecret: z.string().nullable(),
  /**
   * Razorpay key_id for the checkout modal options.
   * null for Stripe (uses clientSecret instead).
   */
  providerKey: z.string().nullable(),
  /**
   * Razorpay order_id passed to the checkout modal as order_id.
   * null for Stripe.
   */
  providerOrderRef: z.string().nullable(),
});

/** TypeScript type inferred from ProviderPaymentOrderSchema */
export type ProviderPaymentOrder = z.infer<typeof ProviderPaymentOrderSchema>;

/**
 * Result returned from initiating payment for an order.
 * Consumed by the checkout payment step to render the appropriate provider UI.
 *
 * amountMinor is always an integer (minor units — never float per D-01).
 */
export const InitiatePaymentResultSchema = z.object({
  /** Internal order ID */
  orderId: z.string().uuid(),
  /** Customer-facing order display ID (e.g. "ORD-20240601-A3F9") */
  displayId: z.string(),
  /**
   * Total amount charged via payment provider in minor currency units.
   * This is the grand total MINUS any wallet credit applied (D-13).
   * Always an integer — never a float (Pitfall 5, D-01).
   */
  amountMinor: z.number().int(),
  /** The provider that will process this payment */
  provider: PaymentProviderIdSchema,
  /** Provider-specific order details for client-side confirmation */
  providerOrder: ProviderPaymentOrderSchema,
});

/** TypeScript type inferred from InitiatePaymentResultSchema */
export type InitiatePaymentResult = z.infer<typeof InitiatePaymentResultSchema>;

/**
 * Flags indicating which payment providers are currently enabled.
 * Driven by STRIPE_ENABLED and RAZORPAY_ENABLED feature flags (PAY-02).
 *
 * Per D-09: If only one provider is enabled, the payment step shows only that option.
 * Both true = customer sees both choices.
 */
export const EnabledProvidersSchema = z.object({
  /** Whether Stripe payment is enabled by admin (PAY-02) */
  stripe: z.boolean(),
  /** Whether Razorpay payment is enabled by admin (PAY-02) */
  razorpay: z.boolean(),
});

/** TypeScript type inferred from EnabledProvidersSchema */
export type EnabledProviders = z.infer<typeof EnabledProvidersSchema>;

/**
 * Input schema for initiating a payment order.
 * Used as the request body for POST /checkout/initiate-payment.
 *
 * Security note (T-05-IV): walletAppliedMinor is validated with .min(0) to prevent
 * negative wallet amounts, and bounded by z.number().int() to reject floats.
 * Final totals are always recomputed server-side (CHK-04).
 */
export const InitiatePaymentInputSchema = z.object({
  /** Selected payment provider for this checkout */
  provider: PaymentProviderIdSchema,
  /**
   * Amount of wallet credit the customer wants to apply.
   * Server re-validates this against actual wallet balance (CHK-04, WAL-05).
   * Must be 0 or positive — negative values rejected (T-05-IV).
   * Must be an integer in minor currency units (never float — D-01).
   */
  walletAppliedMinor: z.number().int().min(0),
});

/** TypeScript type inferred from InitiatePaymentInputSchema */
export type InitiatePaymentInput = z.infer<typeof InitiatePaymentInputSchema>;
