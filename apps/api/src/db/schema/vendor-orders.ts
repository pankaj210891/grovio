import { bigint, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { orderStatusEnum } from "./orders.js";
import { orders } from "./orders.js";
import { vendors } from "./vendors.js";

/**
 * vendor_orders table
 *
 * Per-vendor sub-orders within a customer order (D-08, ORD-02).
 *
 * When a customer places a multi-vendor order, OrderService splits it into one
 * vendor_orders row per vendor. The customer sees a single order ID (orders.displayId);
 * items are grouped by vendor in the order detail page (D-08).
 * Internal sub-order IDs are NEVER exposed to customers.
 *
 * Key design decisions:
 * - status: each vendor sub-order has independent lifecycle status. The parent order
 *   status reflects the overall state; individual vendor_orders progress independently.
 * - vendorSubtotalMinor: the sum of order_items.lineSubtotalMinor for this vendor.
 *   BIGINT minor units (Pitfall 1). Used by CommissionService to compute commission.
 * - FK to orders.id CASCADE: deleting an order removes all vendor sub-orders.
 *
 * Commission computed per vendor_orders row by CommissionService at order finalization.
 * Commission entry stored in vendor_commission_entries (linked by vendorOrderId).
 *
 * Covers ORD-02, MKT-01, MKT-02.
 */
export const vendorOrders = pgTable("vendor_orders", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the parent customer order. Cascade delete.
   * Non-null — vendor sub-orders are always created with a parent order.
   */
  orderId: uuid("order_id")
    .notNull()
    .references(() => orders.id, { onDelete: "cascade" }),

  /**
   * FK to the vendor whose items are in this sub-order.
   * Non-null — each sub-order belongs to exactly one vendor.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),

  /**
   * Fulfillment status for this vendor's portion of the order.
   * Default 'payment_received': set when payment webhook is processed.
   * Vendor transitions: payment_received → processing → shipped → delivered.
   * Uses the same orderStatusEnum as the parent order.
   */
  status: orderStatusEnum("status").notNull().default("payment_received"),

  /**
   * Sum of all line item subtotals for this vendor.
   * BIGINT minor units (Pitfall 1). Backend-authoritative.
   * Input to CommissionService.computeCommission() at order finalization.
   */
  vendorSubtotalMinor: bigint("vendor_subtotal_minor", {
    mode: "number",
  }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor order row */
export type InsertVendorOrder = typeof vendorOrders.$inferInsert;

/** TypeScript type for selecting a vendor order row */
export type SelectVendorOrder = typeof vendorOrders.$inferSelect;
