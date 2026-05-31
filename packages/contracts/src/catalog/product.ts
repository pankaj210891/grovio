import { z } from "zod";

/**
 * Catalog product contracts.
 *
 * Per D-05: ProductStatusSchema values MUST exactly match the Drizzle
 * productStatusEnum pgEnum defined in plan 03-03.
 *
 * Security notes:
 * - T-03-V1: `status` is omitted from CreateProductInputSchema and
 *   UpdateProductInputSchema — vendors cannot set product status directly.
 *   Status transitions happen only via named service methods (D-06).
 * - T-03-V2: basePriceMinor typed as z.number().int() — float/string price
 *   payloads are rejected at parse time (BIGINT minor units per D-01).
 */

/**
 * Exhaustive enum of product status values (D-05).
 * Values MUST exactly match the Drizzle productStatusEnum in the database.
 */
export const ProductStatusSchema = z.enum([
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);

/** TypeScript type inferred from ProductStatusSchema */
export type ProductStatus = z.infer<typeof ProductStatusSchema>;

/**
 * A product as returned by the API.
 * basePriceMinor is always an integer (minor units, e.g. cents/paise — D-01).
 */
export const ProductSchema = z.object({
  id: z.string().uuid(),
  vendorId: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Product display name */
  name: z.string().min(1),
  /** URL-safe slug — unique per vendor, auto-generated server-side */
  slug: z.string(),
  /** Optional product description */
  description: z.string().optional(),
  /** Product lifecycle status — only changed via named service methods (D-06) */
  status: ProductStatusSchema,
  /**
   * Base price in minor currency units (cents/paise — D-01).
   * Must be an integer — never a float.
   */
  basePriceMinor: z.number().int(),
  /**
   * Per-category product attributes stored as JSONB.
   * Keys are attribute definition keys; values are typed by attrType.
   */
  attributes: z.record(z.string(), z.unknown()),
  /**
   * Rejection reason — non-null only when status is "rejected" (D-08).
   */
  rejectionReason: z.string().nullable(),
  /** Soft-delete timestamp — non-null when product is archived */
  archivedAt: z.string().datetime().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** TypeScript type inferred from ProductSchema */
export type Product = z.infer<typeof ProductSchema>;

/**
 * Input schema for creating a new product.
 * Omits server-managed fields: id, status (defaults to "draft" server-side),
 * slug (auto-generated), rejectionReason, archivedAt, timestamps (D-06).
 */
export const CreateProductInputSchema = z.object({
  name: z.string().min(1),
  categoryId: z.string().uuid(),
  description: z.string().optional(),
  /** Base price in minor currency units (integer — D-01, D-04) */
  basePriceMinor: z.number().int(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

/** TypeScript type inferred from CreateProductInputSchema */
export type CreateProductInput = z.infer<typeof CreateProductInputSchema>;

/**
 * Input schema for updating an existing product.
 * All fields optional. Status is NOT included — only changed via named
 * service methods (submitProduct, approveProduct, rejectProduct — D-06).
 */
export const UpdateProductInputSchema = z.object({
  name: z.string().min(1).optional(),
  description: z.string().optional(),
  /** Base price in minor currency units (integer — D-01) */
  basePriceMinor: z.number().int().optional(),
  attributes: z.record(z.string(), z.unknown()).optional(),
});

/** TypeScript type inferred from UpdateProductInputSchema */
export type UpdateProductInput = z.infer<typeof UpdateProductInputSchema>;

/**
 * Input schema for rejecting a product.
 * A non-empty rejection reason is required (D-08).
 */
export const RejectProductInputSchema = z.object({
  rejectionReason: z.string().min(1),
});

/** TypeScript type inferred from RejectProductInputSchema */
export type RejectProductInput = z.infer<typeof RejectProductInputSchema>;
