import { bigint, integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { basketSessions } from "./basket-sessions.js";
import { productVariants } from "./product-variants.js";
import { products } from "./products.js";

/**
 * basket_items table
 *
 * Stores individual product line items within a basket session.
 *
 * Key design decisions:
 * - productVariantId: nullable FK — null for variant-free products (D-20).
 *   Exactly one of (productVariantId non-null) or (productVariantId null) per row.
 *   Variant-free products are identified by productId alone.
 * - unitPriceMinor: BIGINT snapshot of the price at add-to-basket time (CHK-04).
 *   Server re-fetches authoritative prices at checkout — this is for display only.
 *   NEVER float/decimal (Pitfall 1, CLAUDE.md money rule).
 * - quantity: integer — bounded 1–100 at service layer (T-05-IV from basket contract).
 *
 * FK cascade on basketSessionId: items are deleted when their session is deleted.
 * FK cascade on productId/productVariantId: items are deleted when the product/variant
 * is removed from the catalog (hard delete).
 *
 * Covers CHK-01, CHK-02.
 */
export const basketItems = pgTable("basket_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the owning basket session. Cascade delete.
   * Never null — every basket item belongs to exactly one session.
   */
  basketSessionId: uuid("basket_session_id")
    .notNull()
    .references(() => basketSessions.id, { onDelete: "cascade" }),

  /**
   * FK to the product being added to the basket.
   * Cascade delete: removing a product removes it from all baskets.
   */
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  /**
   * FK to the specific product variant selected (D-20).
   * null for variant-free products (e.g., books, simple SKUs).
   * Cascade delete: removing a variant removes the basket item.
   */
  productVariantId: uuid("product_variant_id").references(
    () => productVariants.id,
    { onDelete: "cascade" }
  ),

  /** Quantity of this product/variant in the basket. Min 1. */
  quantity: integer("quantity").notNull().default(1),

  /**
   * Unit price snapshot in minor currency units (paise/cents) at add-to-basket time (CHK-04).
   * BIGINT — no floating-point rounding drift (Pitfall 1, CLAUDE.md money rule).
   * Display only — server re-derives authoritative price at checkout from the catalog.
   * Never trust this value for order total computation.
   */
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new basket item row */
export type InsertBasketItem = typeof basketItems.$inferInsert;

/** TypeScript type for selecting a basket item row */
export type SelectBasketItem = typeof basketItems.$inferSelect;
