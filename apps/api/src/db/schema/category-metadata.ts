import { jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { MerchandisingBlock } from "@grovio/contracts";
import { categories } from "./categories.js";

/**
 * category_metadata table
 *
 * Stores SEO fields and merchandising blocks for a category landing page (D-12, D-13).
 * One metadata row per category (UNIQUE on categoryId).
 *
 * Lazy-created on first PUT /admin/categories/:id/metadata request.
 * GET /categories/:id/metadata returns null if no metadata row exists yet.
 *
 * SEO fields are flat columns per D-13 (not JSONB) — keeps SQL queries simple
 * and avoids JSONB overhead for structured fields accessed individually.
 *
 * blocks column is a JSONB array of typed MerchandisingBlock objects per D-12.
 * Anti-pattern avoided: blocks are NOT stored in a separate table (Anti-Pattern, D-12).
 * All block type validation runs in CategoryMetadataService via MerchandisingBlockSchema
 * before any DB write (Pitfall 5).
 *
 * ON DELETE CASCADE on categoryId: deleting a category removes its metadata.
 *
 * Covers CAT-07.
 */
export const categoryMetadata = pgTable("category_metadata", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the owning category — UNIQUE enforces one metadata row per category.
   * Cascade: deleting a category removes its metadata.
   */
  categoryId: uuid("category_id")
    .notNull()
    .unique()
    .references(() => categories.id, { onDelete: "cascade" }),

  // -- SEO fields (D-13) -- flat columns, not JSONB --

  /** <title> and og:title for the category landing page. null = use category name. */
  seoTitle: text("seo_title"),

  /** <meta name="description"> and og:description. null = no meta description. */
  seoDescription: text("seo_description"),

  /** Comma-separated keywords for <meta name="keywords">. null = no keywords tag. */
  seoKeywords: text("seo_keywords"),

  /** Canonical URL override. null = use the default /categories/:slug URL. */
  canonicalUrl: text("canonical_url"),

  // -- Merchandising content (D-12) --

  /**
   * Ordered array of merchandising block objects.
   * Structure: MerchandisingBlock[] (discriminated union: banner | product_grid | text_block)
   * Typed via .$type<MerchandisingBlock[]>() — DB stores raw JSON; TypeScript sees typed array.
   * Default is an empty array (no blocks configured yet).
   * Validated in CategoryMetadataService via MerchandisingBlockSchema.array().parse() (Pitfall 5).
   */
  blocks: jsonb("blocks").$type<MerchandisingBlock[]>().notNull().default([]),

  // -- Additional metadata --

  /** Category landing page description — plain text or Markdown (no WYSIWYG in v1). */
  description: text("description"),

  /** Category banner/hero image URL shown on the category landing page. */
  imageUrl: text("image_url"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new category metadata row */
export type InsertCategoryMetadata = typeof categoryMetadata.$inferInsert;

/** TypeScript type for selecting a category metadata row */
export type SelectCategoryMetadata = typeof categoryMetadata.$inferSelect;
