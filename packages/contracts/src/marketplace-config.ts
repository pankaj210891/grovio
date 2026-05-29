import { z } from "zod";

/**
 * Schema for the minimal MarketplaceConfig shape defined in D-02.
 *
 * Shape: { currency, locale, activePaymentProviders }
 *
 * Phase 5 extends this type non-breakingly when wallet, checkout, and commission
 * config are introduced. This minimal shape is the D-02 contract.
 */
export const MarketplaceConfigSchema = z.object({
  /**
   * ISO-4217 three-letter currency code (e.g., "INR", "USD").
   * Must be exactly 3 characters.
   */
  currency: z.string().length(3),
  /**
   * BCP-47 locale code (e.g., "en-IN", "en-US").
   * Used for number/date formatting throughout all apps.
   */
  locale: z.string().min(2),
  /**
   * Payment providers enabled for this marketplace deployment.
   * Buyers configure this to enable Stripe, Razorpay, or both.
   * Empty array is valid (marketplace in setup mode).
   */
  activePaymentProviders: z.array(z.enum(["stripe", "razorpay"])).min(0),
});

/** TypeScript type inferred from MarketplaceConfigSchema (D-02 shape) */
export type MarketplaceConfig = z.infer<typeof MarketplaceConfigSchema>;
