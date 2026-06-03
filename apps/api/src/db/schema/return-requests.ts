import {
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { orders } from "./orders.js";
import { vendorOrders } from "./vendor-orders.js";

/**
 * returnStatusEnum — 4 lifecycle states for customer return requests (D-23, ORD-04).
 *
 * Values MUST exactly match ReturnStatusSchema in packages/contracts/src/orders/types.ts.
 *
 * State machine transitions:
 *   return_requested → approved (vendor action in Phase 6)
 *   return_requested → rejected (vendor action in Phase 6)
 *   approved → refunded (refund issued — wallet credit or provider refund)
 */
export const returnStatusEnum = pgEnum("return_status", [
  "return_requested",
  "approved",
  "rejected",
  "refunded",
]);

/**
 * return_requests table
 *
 * Records customer return requests submitted from the order detail page (D-23, ORD-04).
 *
 * Key design decisions:
 * - orderItemIds: JSONB array of order_item UUIDs — which specific items are being returned.
 *   Stored as JSONB (not a relational join table) for Phase 5 simplicity; service validates
 *   that all IDs belong to the vendorOrder and the authenticated customer.
 * - refundPreference: customer's choice of refund destination (D-16).
 *   'wallet': instant credit (fully supported in Phase 5).
 *   'original': refund to payment method (returns HTTP 501 in Phase 5; Phase 6).
 * - Commission reversal (MKT-03 via D-15): triggered when status transitions to 'approved'.
 *   ReturnService.approveReturn() inserts a 'reversed' vendor_commission_entries row
 *   proportional to the returned items (allocate() proration).
 * - vendorOrderId: FK to the vendor sub-order — return requests are per-vendor (each
 *   vendor handles their own returns). A cross-vendor return creates multiple rows.
 *
 * Covers ORD-04, D-16, D-22, D-23, MKT-03.
 */
export const returnRequests = pgTable("return_requests", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the parent customer order. Non-null.
   * Used to verify order ownership and delivery status (must be 'delivered').
   */
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id),

  /**
   * FK to the vendor sub-order. Non-null.
   * Return requests are scoped per vendor (each vendor handles their returns).
   * Commission reversal (MKT-03) is computed against this vendor sub-order.
   */
  vendorOrderId: uuid("vendor_order_id")
    .notNull()
    .references(() => vendorOrders.id),

  /**
   * FK to the customer who submitted the return request.
   * Non-null — return requests require authentication (ORD-04).
   */
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),

  /**
   * Array of order_item UUIDs being returned (D-23).
   * JSONB array — service validates that all IDs belong to vendorOrderId and customerId.
   * Example: ["uuid-1", "uuid-2"]
   * Used for commission reversal proration in MKT-03 (item-level allocate()).
   */
  orderItemIds: jsonb("order_item_ids")
    .$type<string[]>()
    .notNull(),

  /**
   * Customer-provided reason for the return. Non-empty string.
   * Shown to the vendor when reviewing the return request in Phase 6.
   */
  reason: text("reason").notNull(),

  /**
   * Customer's preferred refund destination (D-16).
   * 'wallet': wallet credit (Phase 5 support — instant, append-only ledger entry).
   * 'original': original payment method (Phase 5 returns 501; Phase 6 implements via provider API).
   */
  refundPreference: text("refund_preference").notNull(),

  /**
   * Return request lifecycle status (pgEnum — constrained at DB level).
   * Vendor transitions: return_requested → approved/rejected (Phase 6).
   * System transition: approved → refunded (when refund is issued).
   */
  status: returnStatusEnum("status").notNull().default("return_requested"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new return request row */
export type InsertReturnRequest = typeof returnRequests.$inferInsert;

/** TypeScript type for selecting a return request row */
export type SelectReturnRequest = typeof returnRequests.$inferSelect;
