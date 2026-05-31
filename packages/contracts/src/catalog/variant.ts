import { z } from "zod";

/**
 * Catalog product variant contracts.
 *
 * Variants represent product options (e.g. size + color combinations).
 * priceMinor is always an integer in minor currency units (D-01, D-04).
 */

/**
 * A product variant as returned by the API.
 * priceMinor overrides the product basePriceMinor for this variant (D-04).
 */
export const ProductVariantSchema = z.object({
  id: z.string().uuid(),
  productId: z.string().uuid(),
  /** Stock Keeping Unit — unique identifier for this variant */
  sku: z.string().min(1),
  /**
   * Variant price in minor currency units (cents/paise — D-01, D-04).
   * Must be an integer — never a float.
   */
  priceMinor: z.number().int(),
  /**
   * Variant option values as a key-value map.
   * Keys are attribute definition keys where is_variant=true.
   * Example: { "size": "L", "color": "Red" }
   */
  optionValues: z.record(z.string(), z.unknown()),
  /** Display order within the product's variants list */
  sortOrder: z.number().int(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

/** TypeScript type inferred from ProductVariantSchema */
export type ProductVariant = z.infer<typeof ProductVariantSchema>;

/**
 * Input schema for creating a new product variant.
 * Omits server-managed fields: id, productId (from route params), timestamps.
 */
export const CreateVariantInputSchema = z.object({
  sku: z.string().min(1),
  /** Variant price in minor currency units (integer — D-01) */
  priceMinor: z.number().int(),
  optionValues: z.record(z.string(), z.unknown()),
  sortOrder: z.number().int().optional(),
});

/** TypeScript type inferred from CreateVariantInputSchema */
export type CreateVariantInput = z.infer<typeof CreateVariantInputSchema>;

/**
 * Input schema for updating an existing product variant.
 * All fields optional.
 */
export const UpdateVariantInputSchema = z.object({
  sku: z.string().min(1).optional(),
  /** Variant price in minor currency units (integer — D-01) */
  priceMinor: z.number().int().optional(),
  optionValues: z.record(z.string(), z.unknown()).optional(),
  sortOrder: z.number().int().optional(),
});

/** TypeScript type inferred from UpdateVariantInputSchema */
export type UpdateVariantInput = z.infer<typeof UpdateVariantInputSchema>;
