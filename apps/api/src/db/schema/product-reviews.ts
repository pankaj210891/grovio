import { boolean, integer, pgTable, smallint, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { products } from "./products.js";

/**
 * product_reviews table
 *
 * Stores customer reviews for products. One review per customer per product
 * (unique constraint). Reviews can be moderated by admin (soft-hide via
 * moderated column rather than hard delete for audit trail).
 *
 * Vendor can reply to a review via vendor_reply / vendor_replied_at.
 * avg_rating and review_count are cached aggregates on the products table —
 * updated by ReviewService on insert/update/delete (Plan 11-05 T1.5).
 *
 * Plan 11-05 T1.
 */
export const productReviews = pgTable(
  "product_reviews",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the customer who wrote the review. */
    customerId: uuid("customer_id")
      .notNull()
      .references(() => customers.id, { onDelete: "cascade" }),

    /** FK to the reviewed product. */
    productId: uuid("product_id")
      .notNull()
      .references(() => products.id, { onDelete: "cascade" }),

    /**
     * Star rating 1–5. Enforced via CHECK constraint at the DB level.
     * SMALLINT is sufficient for the 1–5 range.
     */
    rating: smallint("rating").notNull(),

    /** Optional review title (headline). */
    title: text("title"),

    /** Full review body text. Required (NOT NULL). */
    body: text("body").notNull(),

    /**
     * True when the customer has placed an order containing this product.
     * Set by ReviewService by querying order_items at insert time.
     * Cannot be set by the client directly — always backend-computed.
     */
    verifiedPurchase: boolean("verified_purchase").notNull().default(false),

    /** Vendor's reply text. null until the vendor replies. */
    vendorReply: text("vendor_reply"),

    /** Timestamp when the vendor replied. null until replied. */
    vendorRepliedAt: timestamp("vendor_replied_at", { withTimezone: true }),

    /**
     * Admin moderation flag. true = review is hidden from public endpoints.
     * Soft-hide: the row remains in the DB for audit trail.
     * Set by ReviewService.moderateReview() (admin-only).
     */
    moderated: boolean("moderated").notNull().default(false),

    /** Email of the admin who moderated the review. null if not moderated. */
    moderatedByAdminEmail: text("moderated_by_admin_email"),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /** Unique: one review per customer per product. */
    unique("product_reviews_customer_product_unique").on(t.customerId, t.productId),
  ]
);

/**
 * rating_check constraint value.
 * Drizzle does not have a native CHECK constraint builder in v0.45.
 * Enforced at service layer; migration SQL adds the CHECK manually.
 */
export const REVIEW_RATING_MIN = 1;
export const REVIEW_RATING_MAX = 5;

/** TypeScript type for inserting a new product_review row */
export type InsertProductReview = typeof productReviews.$inferInsert;

/** TypeScript type for selecting a product_review row */
export type SelectProductReview = typeof productReviews.$inferSelect;

// Re-export for convenience
export { integer };
