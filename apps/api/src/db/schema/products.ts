import {
  bigint,
  index,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";
import { vendors } from "./vendors.js";

/**
 * product_status Drizzle pgEnum — the 4 states in the product moderation state machine.
 * Constrains status at the Postgres level — invalid values are rejected by the DB
 * even if service-layer validation is bypassed (T-03-S1).
 *
 * State machine transitions (D-05):
 *   draft → pending_review → approved
 *   pending_review → rejected
 *   rejected → draft (vendor edits and re-submits)
 *
 * Values must exactly match ProductStatusSchema in packages/contracts/src/catalog/product.ts.
 */
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);

/**
 * products table
 *
 * Central catalog table. Each product belongs to one vendor and one category.
 * Product attributes are stored as JSONB (D-03, PROD-03) — NOT as EAV rows
 * (Anti-Pattern 3 from ARCHITECTURE.md). A GIN index enables queryable filtering
 * on the attributes column.
 *
 * Key design decisions:
 * - base_price_minor: BIGINT minor units (paise/cents) per D-01. Never FLOAT/DECIMAL/NUMERIC.
 * - status: pgEnum constrains to 4 values at DB level (T-03-S1, D-05).
 * - attributes: JSONB + GIN index for filtered search (PROD-03, no EAV).
 * - rejection_reason: non-null only when status = 'rejected'; enforced at service layer (D-08).
 * - archived_at: soft-delete following the categories.ts pattern.
 *
 * On vendor DELETE: products are cascade-deleted (FK to vendors.id).
 * On category DELETE: products are cascade-deleted (FK to categories.id).
 *
 * Products enter OpenSearch ONLY when status = 'approved' (D-13).
 * Search sync is async via BullMQ ProductIndexJob (D-14).
 *
 * Covers PROD-01, PROD-02, PROD-03, PROD-06.
 */
export const products = pgTable(
  "products",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the vendor who owns this product. Cascade: deleting a vendor removes their products. */
    vendorId: uuid("vendor_id")
      .notNull()
      .references(() => vendors.id, { onDelete: "cascade" }),

    /** FK to the product's category. Cascade: deleting a category removes its products. */
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    /** Product display name. */
    name: text("name").notNull(),

    /**
     * URL-safe slug — unique across all products.
     * Auto-derived from name on create; vendor-overridable.
     * ProductService validates uniqueness before insert/update.
     */
    slug: text("slug").notNull().unique(),

    /** Full product description. Optional. */
    description: text("description"),

    /**
     * Moderation status (pgEnum — constrained at DB level per T-03-S1).
     * Transitions managed exclusively by named ProductService methods:
     * submitProduct, approveProduct, rejectProduct, archiveProduct.
     * Never directly updated via the generic updateProduct() method.
     */
    status: productStatusEnum("status").notNull().default("draft"),

    /**
     * Base price in minor currency units (paise/cents) per D-01.
     * BIGINT — no floating-point rounding drift (T-03-S2, CLAUDE.md money rule).
     * Never use NUMERIC, DECIMAL, or FLOAT for this column.
     *
     * For variant products, this is the starting price displayed before variant selection.
     * The actual charged price comes from product_variants.price_minor (D-03).
     */
    basePriceMinor: bigint("base_price_minor", { mode: "number" }).notNull(),

    /**
     * Product attributes as a typed JSONB object (D-03, PROD-03).
     * Keys are attribute definition keys for the product's category.
     * Values are validated against attribute_definitions schema registry at service layer.
     *
     * GIN index on this column enables efficient queryable filtering (see table extras below).
     * dynamic: false on the OpenSearch mapping prevents field explosion from arbitrary keys.
     */
    attributes: jsonb("attributes")
      .$type<Record<string, unknown>>()
      .notNull()
      .default({}),

    /**
     * Admin rejection reason — required when status = 'rejected' (D-08).
     * null when status is draft, pending_review, or approved.
     * Surfaced to vendors in their panel so they know what to fix.
     * Service layer enforces non-null on rejection; not a DB constraint (simpler migration).
     */
    rejectionReason: text("rejection_reason"),

    /**
     * Soft-delete timestamp. null = active; non-null = archived.
     * Archived products are excluded from vendor list and search results.
     * Hard delete is intentionally unavailable — maintains order history integrity.
     */
    archivedAt: timestamp("archived_at", { withTimezone: true }),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /**
     * GIN index on attributes JSONB column (PROD-03).
     * Enables efficient filtering via JSONB operators (@>, ?, ?|, ?&).
     * Required for queryable attribute filtering without EAV (Anti-Pattern 3).
     */
    index("products_attributes_gin_idx").using("gin", t.attributes),

    /**
     * Unique index on slug (already enforced by .unique() above, but explicit
     * index name makes it identifiable in query plans and migration output).
     */
    index("products_slug_idx").on(t.slug),
  ]
);

/** TypeScript type for inserting a new product row */
export type InsertProduct = typeof products.$inferInsert;

/** TypeScript type for selecting a product row */
export type SelectProduct = typeof products.$inferSelect;
