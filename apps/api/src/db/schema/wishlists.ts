import { bigint, pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { products } from "./products.js";

/**
 * wishlists table
 *
 * Stores customer wishlisted products. Hard-delete is used (no soft-delete per plan).
 * Unique constraint ensures a customer can only wishlist a product once.
 *
 * price_at_wishlist_minor: BIGINT — stores the product price at the time of wishlisting.
 * Used by PriceDropCheckJob to detect price drops without needing historical price data.
 * All money columns use BIGINT minor units (paise/cents) — Pitfall 1 from RESEARCH.md.
 *
 * Plan 11-05 T1.
 */
export const wishlists = pgTable(
  "wishlists",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the customer who wishlisted the product. */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    /** FK to the wishlisted product. */
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    /**
     * Product price in minor currency units at the time of wishlisting (Pitfall 1).
     * Used for price drop detection: if current price < this value, alert the customer.
     * Populated by WishlistService.addToWishlist() by reading products.base_price_minor.
     */
    priceAtWishlistMinor: bigint("price_at_wishlist_minor", { mode: "number" })
      .notNull()
      .default(0),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /** Unique: a customer can wishlist each product only once. */
    unique("wishlists_customer_product_unique").on(t.customerId, t.productId),
  ]
);

/** TypeScript type for inserting a new wishlist row */
export type InsertWishlist = typeof wishlists.$inferInsert;

/** TypeScript type for selecting a wishlist row */
export type SelectWishlist = typeof wishlists.$inferSelect;
