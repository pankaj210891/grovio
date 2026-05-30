import { z } from "zod";
import { MerchandisingBlockSchema } from "./blocks.js";

/**
 * Category metadata contracts — SEO fields and merchandising blocks.
 *
 * Per D-12: The `blocks` field is a JSONB array of typed MerchandisingBlock objects.
 * Per D-13: SEO fields are flat columns (not nested) on the category_metadata row.
 * Per CAT-07: Admin can configure banners, descriptions, SEO, and merchandising blocks.
 *
 * One metadata row per category (lazy-created on first save, null returned if not yet saved).
 */

/**
 * Category metadata as returned by GET /categories/:id/metadata.
 * Includes flat SEO columns and the typed merchandising blocks array.
 */
export const CategoryMetadataSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Page title for SEO (D-13) */
  seoTitle: z.string().nullable(),
  /** Meta description for SEO (D-13) */
  seoDescription: z.string().nullable(),
  /** Comma-separated keywords for SEO (D-13) */
  seoKeywords: z.string().nullable(),
  /** Canonical URL for duplicate content handling (D-13) */
  canonicalUrl: z.string().url().nullable(),
  /**
   * Ordered list of merchandising blocks (D-12).
   * Each block is validated via MerchandisingBlockSchema discriminated union.
   */
  blocks: z.array(MerchandisingBlockSchema),
  /** Category landing page description (plain text or Markdown) */
  description: z.string().nullable(),
  /** Category hero / banner image URL */
  imageUrl: z.string().url().nullable(),
});

/** TypeScript type inferred from CategoryMetadataSchema */
export type CategoryMetadata = z.infer<typeof CategoryMetadataSchema>;

/**
 * Input schema for creating or updating category metadata.
 * All fields are optional — partial updates replace only the provided fields.
 */
export const UpsertMetadataInputSchema = z.object({
  // Nullable strings allow the admin to explicitly clear an existing field value.
  // undefined = "do not change"; null or '' = "clear to null in the DB".
  seoTitle: z.string().nullable().optional(),
  seoDescription: z.string().nullable().optional(),
  seoKeywords: z.string().nullable().optional(),
  canonicalUrl: z.string().url().nullable().optional().or(z.literal('')),
  /** Block array replaces the entire blocks column on each save */
  blocks: z.array(MerchandisingBlockSchema).optional(),
  description: z.string().nullable().optional(),
  imageUrl: z.string().url().nullable().optional().or(z.literal('')),
});

/** TypeScript type inferred from UpsertMetadataInputSchema */
export type UpsertMetadataInput = z.infer<typeof UpsertMetadataInputSchema>;
