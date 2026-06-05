import { z } from "zod";
import {
  MerchandisingBlockSchema,
} from "../category/blocks.js";

/**
 * Admin CMS / homepage block management contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-04, D-11: Structured form approach (not WYSIWYG). Admin manages an ordered
 *   list of homepage blocks with type-specific edit modals.
 *
 * Per D-11: Block types are the existing MerchandisingBlock discriminated union from
 *   packages/contracts/src/category/blocks.ts — imported here, NOT redefined.
 *   Block type-specific shapes: banner, product_grid, text_block, featured_categories.
 *
 * Phase 4 created the homepage_blocks table; Phase 6 adds admin write endpoints:
 *   POST /admin/homepage-blocks (create)
 *   PATCH /admin/homepage-blocks/:id (update)
 *   DELETE /admin/homepage-blocks/:id (delete)
 *   POST /admin/homepage-blocks/:id/reorder (reorder up/down)
 *   PATCH /admin/homepage-blocks/:id/toggle (enable/disable)
 *
 * HomepageService Redis cache is invalidated after each block mutation (D-11).
 */

// ---------------------------------------------------------------------------
// Create Homepage Block (D-11, ADM-04)
// ---------------------------------------------------------------------------

/**
 * Input for creating a new homepage block.
 * The block payload is the full MerchandisingBlock discriminated union.
 */
export const CreateHomepageBlockInputSchema = z.object({
  /**
   * The block content payload.
   * Must be a valid MerchandisingBlock discriminated union (banner, product_grid,
   * text_block, or featured_categories — per category/blocks.ts).
   * Block types are NOT redefined here (D-11 requirement).
   */
  block: MerchandisingBlockSchema,
  /**
   * Whether this block should be active (visible on the storefront) after creation.
   * Defaults to true if not specified.
   */
  active: z.boolean().default(true),
});

/** TypeScript type inferred from CreateHomepageBlockInputSchema */
export type CreateHomepageBlockInput = z.infer<typeof CreateHomepageBlockInputSchema>;

// ---------------------------------------------------------------------------
// Update Homepage Block (D-11, ADM-04)
// ---------------------------------------------------------------------------

/**
 * Input for updating an existing homepage block (PATCH /admin/homepage-blocks/:id).
 * All fields are optional — partial update.
 */
export const UpdateHomepageBlockInputSchema = z.object({
  /**
   * Updated block content payload.
   * Must be a valid MerchandisingBlock discriminated union (same types as create).
   */
  block: MerchandisingBlockSchema.optional(),
  /** Toggle block visibility on the storefront */
  active: z.boolean().optional(),
});

/** TypeScript type inferred from UpdateHomepageBlockInputSchema */
export type UpdateHomepageBlockInput = z.infer<typeof UpdateHomepageBlockInputSchema>;

// ---------------------------------------------------------------------------
// Reorder Homepage Block (D-11, ADM-04)
// ---------------------------------------------------------------------------

/**
 * Input for reordering a homepage block (Up/Down arrows in the admin UI).
 * No drag-and-drop in v1 — increment/decrement position only (D-11).
 */
export const ReorderHomepageBlockInputSchema = z.object({
  /** The block UUID to reorder */
  blockId: z.string().uuid(),
  /** Direction to move the block in the ordered list */
  direction: z.enum(["up", "down"]),
});

/** TypeScript type inferred from ReorderHomepageBlockInputSchema */
export type ReorderHomepageBlockInput = z.infer<typeof ReorderHomepageBlockInputSchema>;
