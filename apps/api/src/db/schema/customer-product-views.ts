import { index, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { products } from "./products.js";

/**
 * customer_product_views table
 *
 * Records each product view by a customer. No unique constraint — multiple
 * views by the same customer for the same product are recorded separately
 * for accurate trending computation (plan note: no unique constraint intended).
 *
 * Two composite indexes:
 *   - (customer_id, viewed_at DESC): optimises "Recently Viewed" query which
 *     selects the most recent distinct products per customer.
 *   - (product_id, viewed_at): optimises "Trending" computation which
 *     aggregates view counts per product over a date range.
 *
 * Rate-limiting (duplicate view prevention within 5 minutes) is enforced at
 * the service layer, not at the DB level (plan T5.1).
 *
 * Plan 11-05 T1.
 */
export const customerProductViews = pgTable(
  "customer_product_views",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the customer who viewed the product. */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    /** FK to the viewed product. */
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    /** Timestamp when the view was recorded. Defaults to now(). */
    viewedAt: timestamp("viewed_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * Index for "Recently Viewed" query — selects last 10 distinct products
     * per customer ordered by viewedAt DESC.
     */
    index("customer_product_views_customer_time_idx").on(t.customerId, t.viewedAt),

    /**
     * Index for "Trending" computation — aggregates view_count per product
     * over the last 7 days, filtered by viewedAt range.
     */
    index("customer_product_views_product_time_idx").on(t.productId, t.viewedAt),
  ]
);

/** TypeScript type for inserting a new customer_product_view row */
export type InsertCustomerProductView = typeof customerProductViews.$inferInsert;

/** TypeScript type for selecting a customer_product_view row */
export type SelectCustomerProductView = typeof customerProductViews.$inferSelect;
