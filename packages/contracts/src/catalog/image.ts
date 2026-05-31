import { z } from "zod";

/**
 * Catalog product image contracts.
 *
 * Image upload uses a two-step presign + confirm flow:
 * 1. Client requests a presigned upload URL (PresignImageInputSchema →
 *    PresignImageResponseSchema) from the API
 * 2. Client uploads directly to S3/R2 using uploadUrl
 * 3. Client confirms the upload (ConfirmImageUploadInputSchema) so the
 *    API writes the image record to the database
 */

/**
 * A product image as returned by the API.
 */
export const ProductImageSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  /** Public CDN URL for the image */
  url: z.string().url(),
  /** Display order within the product's image gallery */
  sortOrder: z.number().int(),
  /** Alt text for accessibility and SEO (nullable) */
  altText: z.string().nullable(),
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from ProductImageSchema */
export type ProductImage = z.infer<typeof ProductImageSchema>;

/**
 * Input schema for requesting a presigned upload URL.
 * contentType must be a valid MIME type (e.g. "image/jpeg", "image/webp").
 */
export const PresignImageInputSchema = z.object({
  contentType: z.string(),
  /** File size in bytes — validated against MAX_IMAGE_SIZE_BYTES env var */
  fileSizeBytes: z.number().int().positive(),
});

/** TypeScript type inferred from PresignImageInputSchema */
export type PresignImageInput = z.infer<typeof PresignImageInputSchema>;

/**
 * Response schema for a presigned image upload URL.
 * uploadUrl — direct PUT URL to S3/R2 (short TTL, signed)
 * cdnUrl    — public URL the image will be accessible at after upload
 * key       — S3/R2 object key, passed back in ConfirmImageUploadInputSchema
 */
export const PresignImageResponseSchema = z.object({
  uploadUrl: z.string().url(),
  cdnUrl: z.string().url(),
  key: z.string(),
});

/** TypeScript type inferred from PresignImageResponseSchema */
export type PresignImageResponse = z.infer<typeof PresignImageResponseSchema>;

/**
 * Input schema for confirming a completed image upload.
 * Sent after the client has successfully PUT the file to uploadUrl.
 */
export const ConfirmImageUploadInputSchema = z.object({
  /** S3/R2 object key returned by the presign endpoint */
  key: z.string(),
  /** Optional alt text for accessibility */
  altText: z.string().optional(),
});

/** TypeScript type inferred from ConfirmImageUploadInputSchema */
export type ConfirmImageUploadInput = z.infer<
  typeof ConfirmImageUploadInputSchema
>;

/**
 * Input schema for reordering product images.
 * orderedImageIds must contain all existing image IDs in the desired order.
 */
export const ReorderImagesInputSchema = z.object({
  orderedImageIds: z.array(z.string().uuid()),
});

/** TypeScript type inferred from ReorderImagesInputSchema */
export type ReorderImagesInput = z.infer<typeof ReorderImagesInputSchema>;
