import { z } from "zod";

/**
 * Merchandising block types for category landing pages.
 *
 * Per D-12, blocks are stored as a JSONB array in category_metadata.blocks.
 * Per D-14, block type definitions live here as discriminated unions + Zod schemas.
 * v1 types: banner, product_grid, text_block.
 *
 * All admin and API consumers import from this file — never define block shapes inline.
 */

/** Banner block — hero image with optional CTA */
export const BannerBlockSchema = z.object({
  type: z.literal("banner"),
  imageUrl: z.string().url(),
  title: z.string(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
});

/** TypeScript type for a banner block */
export type BannerBlock = z.infer<typeof BannerBlockSchema>;

/** Product grid block — curated list of products displayed as a grid or carousel */
export const ProductGridBlockSchema = z.object({
  type: z.literal("product_grid"),
  title: z.string(),
  /** Array of product UUIDs to display in this block */
  productIds: z.array(z.string().uuid()),
  layout: z.enum(["grid", "carousel"]),
});

/** TypeScript type for a product grid block */
export type ProductGridBlock = z.infer<typeof ProductGridBlockSchema>;

/** Text block — rich content or markdown description */
export const TextBlockSchema = z.object({
  type: z.literal("text_block"),
  title: z.string(),
  /** Plain text or Markdown content; rendered as-is in Phase 4 (no WYSIWYG in v1) */
  content: z.string(),
});

/** TypeScript type for a text block */
export type TextBlock = z.infer<typeof TextBlockSchema>;

/**
 * Discriminated union of all merchandising block types.
 * CategoryMetadataService validates blocks with this schema before any DB write (Pitfall 5).
 */
export const MerchandisingBlockSchema = z.discriminatedUnion("type", [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
]);

/** TypeScript type for any merchandising block */
export type MerchandisingBlock = z.infer<typeof MerchandisingBlockSchema>;
