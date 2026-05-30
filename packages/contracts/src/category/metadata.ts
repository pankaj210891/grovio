import { z } from "zod";
import { MerchandisingBlockSchema } from "./blocks.js";

/**
 * Category metadata — SEO fields and merchandising blocks for a category landing page.
 *
 * Per D-13, SEO fields are flat columns (not JSONB).
 * Per D-12, blocks is a JSONB array of typed MerchandisingBlock objects.
 *
 * One metadata row per category (UNIQUE on category_id).
 * Lazy-created on first PUT /admin/categories/:id/metadata call.
 * GET /categories/:id/metadata returns null if no metadata row exists yet.
 * Covers CAT-07.
 */
export const CategoryMetadataSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** SEO title for <title> and og:title (D-13) */
  seoTitle: z.string().nullable(),
  /** SEO meta description for <meta name="description"> and og:description (D-13) */
  seoDescription: z.string().nullable(),
  /** Comma-separated SEO keywords for <meta name="keywords"> (D-13) */
  seoKeywords: z.string().nullable(),
  /** Canonical URL override; null = use the default category URL (D-13) */
  canonicalUrl: z.string().url().nullable(),
  /** Merchandising blocks displayed on the category landing page (D-12) */
  blocks: z.array(MerchandisingBlockSchema),
  /** Category description — plain text or Markdown (no WYSIWYG in v1) */
  description: z.string().nullable(),
  /** Category banner/hero image URL */
  imageUrl: z.string().url().nullable(),
});

/** TypeScript type for category metadata */
export type CategoryMetadata = z.infer<typeof CategoryMetadataSchema>;

/**
 * Input schema for upserting category metadata.
 * All fields are optional — omitted fields are not modified on update.
 */
export const UpsertMetadataInputSchema = z.object({
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  blocks: z.array(MerchandisingBlockSchema).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});

/** TypeScript type for metadata upsert input */
export type UpsertMetadataInput = z.infer<typeof UpsertMetadataInputSchema>;
