import {
  bigint,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { products } from "./products.js";

/**
 * product_variants table
 *
 * Each variant represents a distinct purchasable option of a product — e.g.,
 * Size=L + Color=Red. Variant rows carry their own SKU and price in BIGINT minor units.
 *
 * Key design decisions (D-01, D-04):
 * - price_minor: BIGINT minor units (paise/cents). Never FLOAT/DECIMAL/NUMERIC (T-03-S2).
 * - option_values: JSONB key-value map. Keys are attribute definition keys where is_variant=true (D-02).
 *   Example: { size: 'L', color: 'Red' }
 * - Variants are optional (D-03): if a category defines no is_variant=true attributes,
 *   the product has no variant rows and uses base_price_minor directly.
 * - Phase 5 inventory (inventory_items) will reference product_variant_id as FK target.
 *   The UUID PK is therefore a stable forward contract for Phase 5.
 *
 * ON DELETE CASCADE on product_id: deleting a product removes all its variants.
 *
 * Covers PROD-04.
 */
export const productVariants = pgTable("product_variants", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** FK to the parent product. Cascade: deleting a product removes all its variants. */
  productId: uuid("product_id")
    .notNull()
    .references(() => products.id, { onDelete: "cascade" }),

  /**
   * Stock Keeping Unit — vendor-assigned identifier for this variant.
   * Not unique at the DB level (vendors may reuse SKUs across products).
   * Uniqueness within a product is enforced at the service layer.
   */
  sku: text("sku").notNull(),

  /**
   * Variant price in minor currency units (paise/cents) per D-04.
   * BIGINT — no floating-point rounding drift (T-03-S2, CLAUDE.md money rule).
   * Never use NUMERIC, DECIMAL, or FLOAT for this column.
   */
  priceMinor: bigint("price_minor", { mode: "number" }).notNull(),

  /**
   * Key-value map of the variant's dimension values (D-04).
   * Keys correspond to attribute_definitions.key where is_variant=true for this category.
   * Example: { size: 'L', color: 'Red' }
   *
   * Phase 3 plan 03-04 service layer validates that keys exist in the category's
   * is_variant=true attribute definitions before insert.
   */
  optionValues: jsonb("option_values")
    .$type<Record<string, unknown>>()
    .notNull()
    .default({}),

  /** Display order within a product's variant list (lower = first). Default 0. */
  sortOrder: integer("sort_order").notNull().default(0),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new product variant row */
export type InsertProductVariant = typeof productVariants.$inferInsert;

/** TypeScript type for selecting a product variant row */
export type SelectProductVariant = typeof productVariants.$inferSelect;
