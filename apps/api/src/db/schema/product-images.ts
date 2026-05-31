import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { products } from "./products.js";

/**
 * product_images table
 *
 * Stores the CDN/public URLs of images associated with a product.
 * Images are uploaded via a presigned PUT URL flow (D-09, D-12):
 *   1. Vendor requests a presigned URL → backend generates it (no DB write yet)
 *   2. Vendor uploads directly to R2/S3 using the presigned URL
 *   3. Vendor confirms upload → backend inserts this row with the CDN URL
 *
 * Per-variant image overrides are NOT supported in Phase 3 (deferred to post-v1).
 * Product-level images apply to all variants.
 *
 * Image constraints (configurable via env vars, D-11):
 * - MAX_IMAGES_PER_PRODUCT (default 8): enforced at presign request time
 * - MAX_IMAGE_SIZE_BYTES (default 5MB): enforced via ContentLength on PutObjectCommand
 *
 * ON DELETE CASCADE on product_id: deleting a product removes all its images (D-12).
 * No updatedAt: images are created then deleted, never updated in place.
 *
 * Covers PROD-05.
 */
export const productImages = pgTable("product_images", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** FK to the parent product. Cascade: deleting a product removes all its images (D-12). */
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  /**
   * Public CDN URL of the image (not the presigned upload URL).
   * Constructed as `${env.S3_PUBLIC_URL}/${key}` at confirm-upload time.
   * This is the URL stored permanently and served to the storefront.
   */
  url: text("url").notNull(),

  /** Display order within a product's image gallery (lower = first). Default 0. */
  sortOrder: integer("sort_order").notNull().default(0),

  /**
   * Optional alt text for accessibility (WCAG 2.1 AA).
   * Provided by vendor at confirm-upload time. null if not provided.
   */
  altText: text("alt_text"),

  /** Record creation timestamp. No updatedAt — images are immutable once confirmed. */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new product image row */
export type InsertProductImage = typeof productImages.$inferInsert;

/** TypeScript type for selecting a product image row */
export type SelectProductImage = typeof productImages.$inferSelect;
