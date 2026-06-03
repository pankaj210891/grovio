import { z } from "zod";

/**
 * Order contract schemas for Phase 5: Commerce Core.
 *
 * Per D-08: Multi-vendor order — one customer-facing order ID; items grouped by vendor.
 * Per D-23: Self-serve return request from the storefront order detail page.
 * Per ORD-01/ORD-02: Customer order splits into vendor sub-orders (VendorOrder) backend-side.
 *
 * Per D-01: All money fields are z.number().int() (minor units).
 * Per Pitfall 5: bigint is NEVER used in contracts — JSON serialization uses number.
 *
 * Security notes:
 * - T-05-04: All money fields typed z.number().int() — float amounts rejected at parse time.
 * - T-05-IV: orderItemIds validated as UUID array; reason required as non-empty string.
 *
 * OrderStatusSchema values MUST exactly match the Drizzle orderStatusEnum pgEnum (D-08).
 * ReturnStatusSchema values MUST exactly match the Drizzle returnStatusEnum pgEnum (D-23).
 */

/**
 * Exhaustive enum of order lifecycle status values (D-08).
 * Values MUST exactly match the orderStatusEnum pgEnum defined in plan 05-02.
 */
export const OrderStatusSchema = z.enum([
  "pending_payment",
  "payment_received",
  "processing",
  "shipped",
  "delivered",
  "cancelled",
]);

/** TypeScript type inferred from OrderStatusSchema */
export type OrderStatus = z.infer<typeof OrderStatusSchema>;

/**
 * Exhaustive enum of return request status values (D-23, ORD-04).
 * Values MUST exactly match the returnStatusEnum pgEnum defined in plan 05-02.
 */
export const ReturnStatusSchema = z.enum([
  "return_requested",
  "approved",
  "rejected",
  "refunded",
]);

/** TypeScript type inferred from ReturnStatusSchema */
export type ReturnStatus = z.infer<typeof ReturnStatusSchema>;

/**
 * A single line item within a vendor sub-order.
 * Represents one product (or variant) purchase at a snapshotted price.
 *
 * All money fields are minor currency units, always integers (D-01).
 */
export const OrderItemSchema = z.object({
  /** Order item row ID */
  id: z.string().uuid(),
  /** FK to the product */
  productId: z.string().uuid(),
  /**
   * FK to the product variant, or null for variant-free products (D-20).
   */
  productVariantId: z.string().uuid().nullable(),
  /** Denormalized product name at the time of purchase (snapshot) */
  productName: z.string(),
  /** Quantity ordered */
  quantity: z.number().int(),
  /**
   * Unit price at the time of purchase in minor currency units.
   * Snapshot — does not change if the product price is updated later.
   * Always an integer — never a float (D-01).
   */
  unitPriceMinor: z.number().int(),
  /**
   * Line subtotal (quantity × unitPriceMinor) in minor currency units.
   * Always an integer — never a float (D-01).
   */
  lineSubtotalMinor: z.number().int(),
});

/** TypeScript type inferred from OrderItemSchema */
export type OrderItem = z.infer<typeof OrderItemSchema>;

/**
 * A vendor-scoped sub-order within a customer order (D-08, ORD-02).
 * Customer sees items grouped by vendor; per-vendor delivery status is tracked here.
 * Internal sub-order IDs are NOT exposed to customers (D-08).
 *
 * All money fields are minor currency units, always integers (D-01).
 */
export const VendorOrderSchema = z.object({
  /** Vendor sub-order ID (internal — exposed here for display in order detail) */
  id: z.string().uuid(),
  /** FK to the vendor */
  vendorId: z.string().uuid(),
  /** Denormalized vendor display name for grouping in order detail page */
  vendorName: z.string(),
  /**
   * Fulfillment status for this vendor's portion of the order.
   * Each vendor sub-order has its own status; the parent order status reflects overall state.
   */
  status: OrderStatusSchema,
  /** Line items for this vendor's portion of the order */
  items: z.array(OrderItemSchema),
  /**
   * Total for this vendor's items in minor currency units.
   * Equals the sum of item lineSubtotalMinor values for this vendor.
   * Always an integer — never a float (D-01).
   */
  vendorSubtotalMinor: z.number().int(),
});

/** TypeScript type inferred from VendorOrderSchema */
export type VendorOrder = z.infer<typeof VendorOrderSchema>;

/**
 * The full customer-facing order (ORD-01, ORD-03).
 * One customer-facing ID covers all vendor sub-orders (D-08).
 * Vendor sub-orders are exposed in the order detail page but customers never see internal sub-order IDs.
 *
 * All money fields are minor currency units, always integers (D-01).
 */
export const OrderSchema = z.object({
  /** Internal order UUID */
  id: z.string().uuid(),
  /**
   * Customer-facing display ID (e.g. "ORD-20240601-A3F9").
   * Unique, human-readable, shown in order confirmation and history (D-08).
   */
  displayId: z.string(),
  /** Overall order lifecycle status */
  status: OrderStatusSchema,
  /**
   * Sum of all line item subtotals before delivery and discounts.
   * Minor currency units, always integer (D-01).
   */
  subtotalMinor: z.number().int(),
  /**
   * Delivery/shipping fee for the order.
   * Minor currency units, always integer (D-01).
   */
  shippingMinor: z.number().int(),
  /**
   * Total coupon/promotion discount applied.
   * Minor currency units, always integer (D-01).
   */
  discountMinor: z.number().int(),
  /**
   * Wallet credit applied to this order (D-13, WAL-05).
   * Minor currency units, always integer (D-01). 0 if no wallet credit used.
   */
  walletAppliedMinor: z.number().int(),
  /**
   * Final amount charged (subtotal - discount + shipping - walletApplied).
   * Minor currency units, always integer (D-01).
   */
  grandTotalMinor: z.number().int(),
  /** Vendor sub-orders grouped for display in order detail (D-08) */
  vendorOrders: z.array(VendorOrderSchema),
  /** ISO 8601 datetime string when the order was created */
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from OrderSchema */
export type Order = z.infer<typeof OrderSchema>;

/**
 * Input for creating a customer return request (ORD-04, D-23).
 * Customer submits from the order detail page for eligible delivered items.
 *
 * Security notes (T-05-IV):
 * - orderItemIds: validated as UUID array — malformed IDs rejected.
 * - reason: required non-empty string.
 * - refundPreference: enum — invalid values rejected.
 *
 * Per D-16: refundPreference='original' returns HTTP 501 in Phase 5
 * (wallet-credit refunds only; provider refund API in Phase 6).
 */
export const CreateReturnRequestInputSchema = z.object({
  /**
   * UUIDs of the specific order items to return.
   * Must be items belonging to a delivered order owned by the authenticated customer.
   */
  orderItemIds: z.array(z.string().uuid()).min(1),
  /** Customer-provided reason for the return */
  reason: z.string().min(1),
  /**
   * Customer's preferred refund destination (D-16).
   * - "wallet": instant credit to customer wallet (fully supported in Phase 5)
   * - "original": refund to original payment method (returns HTTP 501 in Phase 5; Phase 6)
   */
  refundPreference: z.enum(["wallet", "original"]),
});

/** TypeScript type inferred from CreateReturnRequestInputSchema */
export type CreateReturnRequestInput = z.infer<typeof CreateReturnRequestInputSchema>;
