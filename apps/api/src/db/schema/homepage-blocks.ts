import {
  boolean,
  integer,
  jsonb,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * homepage_blocks table
 *
 * Stores ordered, configurable content blocks rendered on the storefront homepage.
 * Each block has a type discriminant and a JSONB payload validated at the service
 * layer against MerchandisingBlockSchema (packages/contracts/src/category/blocks.ts).
 *
 * Block types (validated by Zod at HomepageService, not pgEnum — D-02):
 *   - 'banner'              → BannerBlockSchema
 *   - 'product_grid'        → ProductGridBlockSchema
 *   - 'text_block'          → TextBlockSchema
 *   - 'featured_categories' → FeaturedCategoriesBlockSchema
 *
 * No pgEnum for `type` — Zod validates at the application layer, allowing new block
 * types to be added without a DB migration (same pattern as products.attributes JSONB).
 *
 * Admin write-side (create/update/delete/reorder blocks) is Phase 6.
 * Only the `getBlocks()` read path is built in Phase 4.
 *
 * Read performance: blocks are Redis-cached (HOMEPAGE_BLOCKS_TTL_SECONDS, D-04).
 * HomepageService invalidates the cache on any admin mutation (Phase 6).
 *
 * Covers STORE-01 (storefront homepage blocks).
 */
export const homepageBlocks = pgTable("homepage_blocks", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Block type discriminant (e.g. 'banner', 'product_grid', 'text_block',
   * 'featured_categories'). Validated against MerchandisingBlockSchema at
   * HomepageService.getBlocks() read time. Not a pgEnum — extensible without
   * DB migration.
   */
  type: text("type").notNull(),

  /**
   * Block configuration payload as JSONB (D-02).
   * Validated against the appropriate block sub-schema at service layer.
   * Structure depends on the type discriminant (see MerchandisingBlockSchema).
   * Admin writes are validated before insert; reads are validated on retrieval.
   */
  payload: jsonb("payload").notNull(),

  /**
   * Display order on the homepage. Blocks are sorted ascending by this value.
   * Admin panel allows drag-and-drop reordering (Phase 6).
   * Defaults to 0 — newly created blocks appear first until explicitly ordered.
   */
  sortOrder: integer("sort_order").notNull().default(0),

  /**
   * Whether this block is visible on the storefront.
   * Inactive blocks are excluded from HomepageService.getBlocks() results.
   * Allows admins to temporarily hide a block without deleting it (Phase 6).
   * Defaults to true.
   */
  isActive: boolean("is_active").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new homepage block row */
export type InsertHomepageBlock = typeof homepageBlocks.$inferInsert;

/** TypeScript type for selecting a homepage block row */
export type SelectHomepageBlock = typeof homepageBlocks.$inferSelect;
