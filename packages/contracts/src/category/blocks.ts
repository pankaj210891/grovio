import { z } from "zod";

/**
 * Merchandising block type definitions for category metadata.
 *
 * Per D-14: Block types are defined here as discriminated unions + Zod schemas.
 * All consumers (admin panel, API validation, Phase 4 CMS) import from this file.
 *
 * v1 block types: banner, product_grid, text_block.
 * Phase 4 CMS can extend by adding new member schemas to MerchandisingBlockSchema.
 */

/** Banner block — hero image with optional CTA */
export const BannerBlockSchema = z.object({
  type: z.literal("banner"),
  /** Full-width banner image URL */
  imageUrl: z.string().url(),
  /** Banner headline */
  title: z.string(),
  /** Optional subheadline */
  subtitle: z.string().optional(),
  /** Optional call-to-action button label */
  ctaText: z.string().optional(),
  /** Optional call-to-action URL */
  ctaUrl: z.string().url().optional(),
});

/** TypeScript type inferred from BannerBlockSchema */
export type BannerBlock = z.infer<typeof BannerBlockSchema>;

/** Product grid block — curated list of product IDs rendered as grid or carousel */
export const ProductGridBlockSchema = z.object({
  type: z.literal("product_grid"),
  /** Section heading */
  title: z.string(),
  /** Ordered list of product UUIDs to display */
  productIds: z.array(z.string().uuid()),
  /** Display layout for the product collection */
  layout: z.enum(["grid", "carousel"]),
});

/** TypeScript type inferred from ProductGridBlockSchema */
export type ProductGridBlock = z.infer<typeof ProductGridBlockSchema>;

/** Text block — static editorial content */
export const TextBlockSchema = z.object({
  type: z.literal("text_block"),
  /** Block heading */
  title: z.string(),
  /** Block body content (plain text or Markdown) */
  content: z.string(),
});

/** TypeScript type inferred from TextBlockSchema */
export type TextBlock = z.infer<typeof TextBlockSchema>;

/**
 * Featured categories block — curated list of category IDs rendered as a grid or row.
 *
 * Phase 4 addition (D-02): Extends the block union with a category showcase block.
 * categoryIds constrained to UUIDs — non-UUID payloads are rejected at parse time (T-04-01).
 */
export const FeaturedCategoriesBlockSchema = z.object({
  type: z.literal("featured_categories"),
  /** Section heading */
  title: z.string(),
  /** Ordered list of category UUIDs to showcase */
  categoryIds: z.array(z.string().uuid()),
  /** Display layout for the category collection */
  layout: z.enum(["grid", "row"]),
});

/** TypeScript type inferred from FeaturedCategoriesBlockSchema */
export type FeaturedCategoriesBlock = z.infer<typeof FeaturedCategoriesBlockSchema>;

/**
 * Discriminated union of all merchandising block types.
 *
 * Security note (T-02-01): z.discriminatedUnion rejects unknown block types and
 * structurally-invalid blocks at parse time, preventing malformed data from reaching
 * the database via CategoryMetadataService.
 *
 * Phase 4 extends with FeaturedCategoriesBlockSchema (D-02). The three Phase 2 types
 * (banner, product_grid, text_block) are unchanged.
 */
export const MerchandisingBlockSchema = z.discriminatedUnion("type", [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
  FeaturedCategoriesBlockSchema,
]);

/** TypeScript type inferred from MerchandisingBlockSchema */
export type MerchandisingBlock = z.infer<typeof MerchandisingBlockSchema>;
