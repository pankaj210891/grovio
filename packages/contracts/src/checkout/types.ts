import { z } from "zod";
import { PaymentProviderIdSchema } from "../payments/types.js";

/**
 * Checkout contract schemas for Phase 5: Commerce Core.
 *
 * Per D-05: Multi-step wizard with URL-addressable steps:
 *   /checkout/address → /checkout/delivery → /checkout/payment → /checkout/review
 *
 * Per CHK-04: All pricing is backend-authoritative. These schemas define request shapes;
 * the server always re-derives totals from the catalog, never trusts client amounts.
 *
 * Per D-01: All money fields are z.number().int() (minor units).
 * Per Pitfall 5: bigint is NEVER used in contracts — JSON serialization uses number.
 *
 * Security notes:
 * - T-05-04: All money fields typed z.number().int() — float/string amounts rejected.
 * - T-05-IV: walletAppliedMinor has .min(0) to prevent negative credit injection.
 *   addressId/paymentProvider validated to prevent malformed lookups.
 */

/**
 * The four URL-addressable steps in the checkout wizard (D-05).
 * Each step maps to a distinct React Router v6 route.
 */
export const CheckoutStepSchema = z.enum([
  "address",
  "delivery",
  "payment",
  "review",
]);

/** TypeScript type inferred from CheckoutStepSchema */
export type CheckoutStep = z.infer<typeof CheckoutStepSchema>;

/**
 * Input for initiating the checkout process (delivery → payment step transition).
 * Per D-06: Inventory reservation is triggered at this point (CHK-05).
 */
export const InitiateCheckoutInputSchema = z.object({
  /** UUID of the saved customer address to ship to */
  addressId: z.string().uuid(),
  /**
   * Delivery option identifier (e.g., "standard", "express").
   * Validated server-side against available delivery options for the address zone.
   */
  deliveryOption: z.string().min(1),
});

/** TypeScript type inferred from InitiateCheckoutInputSchema */
export type InitiateCheckoutInput = z.infer<typeof InitiateCheckoutInputSchema>;

/**
 * Input for applying a coupon code during checkout (CHK-06, D-17).
 * Feature-flagged via COUPONS_ENABLED — server returns error if flag is disabled.
 */
export const ApplyCouponInputSchema = z.object({
  /** The coupon code string to validate and apply. Min 1 char. */
  code: z.string().min(1),
});

/** TypeScript type inferred from ApplyCouponInputSchema */
export type ApplyCouponInput = z.infer<typeof ApplyCouponInputSchema>;

/**
 * The computed coupon discount, returned from POST /checkout/apply-coupon.
 * Discount amount is re-validated server-side at order placement time (D-17, Pitfall 6).
 *
 * discountMinor is always an integer — never a float (D-01).
 */
export const CouponDiscountSchema = z.object({
  /** The validated coupon code */
  code: z.string(),
  /**
   * Discount amount in minor currency units.
   * Always an integer — never a float (D-01, Pitfall 5).
   */
  discountMinor: z.number().int(),
  /** Human-readable description of the discount scope (e.g. "10% off all items from VendorX") */
  scopeDescription: z.string(),
});

/** TypeScript type inferred from CouponDiscountSchema */
export type CouponDiscount = z.infer<typeof CouponDiscountSchema>;

/**
 * Input for placing an order from the review step.
 *
 * Security notes (T-05-04, T-05-IV):
 * - walletAppliedMinor: validated .min(0) — negative credit injection rejected.
 *   Server re-validates against actual wallet balance; client amount is advisory only (CHK-04).
 * - addressId: uuid validation prevents malformed DB lookups.
 * - paymentProvider: enum validation prevents unsupported provider strings.
 * - couponCode: optional, re-validated server-side at order placement (Pitfall 6).
 */
export const PlaceOrderInputSchema = z.object({
  /** UUID of the delivery address (must belong to the authenticated customer) */
  addressId: z.string().uuid(),
  /** Selected payment provider for this order */
  paymentProvider: PaymentProviderIdSchema,
  /**
   * Amount of wallet credit the customer wants to apply.
   * Server re-validates against actual balance; this value is advisory (CHK-04, WAL-05).
   * Must be 0 or positive — negative values rejected (T-05-IV).
   * Must be an integer in minor currency units — never a float (D-01).
   */
  walletAppliedMinor: z.number().int().min(0),
  /**
   * Coupon code to apply to the order, or null/undefined if no coupon.
   * Re-validated server-side at placement time — not trusted from prior apply-coupon step (Pitfall 6).
   */
  couponCode: z.string().nullable().optional(),
});

/** TypeScript type inferred from PlaceOrderInputSchema */
export type PlaceOrderInput = z.infer<typeof PlaceOrderInputSchema>;

/**
 * The full cost breakdown shown on the checkout review step.
 * All amounts are integer minor currency units (D-01).
 * Always computed server-side — never trusted from client (CHK-04).
 *
 * Security note (T-05-04): All fields typed as z.number().int() — float amounts
 * cannot be injected. These values are display-only; server derives the canonical
 * totals at order placement time.
 */
export const CheckoutSummarySchema = z.object({
  /**
   * Basket items total before discounts and shipping.
   * Minor currency units, always integer (D-01).
   */
  subtotalMinor: z.number().int(),
  /**
   * Total discount applied (coupon + any promotions).
   * Minor currency units, always integer (D-01).
   */
  discountMinor: z.number().int(),
  /**
   * Shipping/delivery fee.
   * Minor currency units, always integer (D-01).
   */
  shippingMinor: z.number().int(),
  /**
   * Wallet credit applied to this order.
   * Minor currency units, always integer (D-01).
   * 0 if no wallet credit applied (D-13).
   */
  walletAppliedMinor: z.number().int(),
  /**
   * Amount to be charged via the payment provider.
   * grandTotalMinor = subtotalMinor - discountMinor + shippingMinor - walletAppliedMinor
   * Minor currency units, always integer (D-01).
   */
  grandTotalMinor: z.number().int(),
});

/** TypeScript type inferred from CheckoutSummarySchema */
export type CheckoutSummary = z.infer<typeof CheckoutSummarySchema>;
