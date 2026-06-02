import { bigint, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants.js";
import { products } from "./products.js";
import { vendorOrders } from "./vendor-orders.js";

/**
 * order_items table
 *
 * Individual product line items within a vendor sub-order (ORD-01).
 *
 * Key design decisions:
 * - productName: denormalized snapshot of the product name at purchase time.
 *   Product names can change after order placement; the snapshot preserves what
 *   the customer saw at checkout (same pattern as basket_items.unitPriceMinor).
 * - unitPriceMinor / lineSubtotalMinor: BIGINT snapshot of prices at checkout time.
 *   Computed backend-authoritatively at order placement (CHK-04); never trusts client.
 *   lineSubtotalMinor = quantity * unitPriceMinor (no partial units).
 * - productVariantId: nullable FK — null for variant-free products (D-20).
 *   Denormalized quantity and prices capture the exact purchase configuration.
 * - FK to vendor_orders.id CASCADE: deleting a vendor sub-order removes its items.
 * - No updatedAt: line items are immutable snapshots. Status is tracked on the
 *   parent vendor_orders row, not per line item.
 *
 * Covers ORD-01 (line items in order), MKT-03 (orderItemIds in return_requests).
 */
export const orderItems = pgTable("order_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor sub-order this item belongs to. Cascade delete.
   * Non-null — every item belongs to exactly one vendor sub-order.
   */
  vendorOrderId: uuid("vendor_order_id")
    .notNull()
    .references(() => vendorOrders.id, { onDelete: "cascade" }),

  /**
   * FK to the product. Non-null.
   * Preserved for reference (product may be archived after purchase).
   */
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id),

  /**
   * FK to the product variant. null for variant-free products (D-20).
   * Preserved for reference (variant may be removed after purchase).
   */
  productVariantId: uuid("product_variant_id").references(
    () => productVariants.id
  ),

  /**
   * Denormalized product name at the time of purchase.
   * Snapshot — does not change if the product is renamed or archived later.
   * Shown in order history and order detail pages.
   */
  productName: text("product_name").notNull(),

  /** Quantity ordered for this product/variant. Always >= 1. */
  quantity: integer("quantity").notNull(),

  /**
   * Unit price in minor currency units at the time of purchase (CHK-04 snapshot).
   * BIGINT — no floating-point rounding drift (Pitfall 1, CLAUDE.md money rule).
   * Backend-authoritative: re-fetched from products/product_variants at checkout.
   */
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),

  /**
   * Line subtotal = quantity * unitPriceMinor in minor currency units.
   * BIGINT — no floating-point rounding drift (Pitfall 1, CLAUDE.md money rule).
   * Pre-computed by OrderService at placement; stored for fast reads in order detail.
   */
  lineSubtotalMinor: bigint("line_subtotal_minor", { mode: "number" }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new order item row */
export type InsertOrderItem = typeof orderItems.$inferInsert;

/** TypeScript type for selecting an order item row */
export type SelectOrderItem = typeof orderItems.$inferSelect;
