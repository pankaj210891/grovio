import { z } from "zod";

/**
 * Product template contracts for per-category vendor product creation templates.
 *
 * Per CAT-05: Admin defines template fields that give vendors defaults and hints
 * when creating products in a specific category. Template fields reference
 * attribute_definition keys by `key` (text string), not by id.
 *
 * Open Question 2 resolution: Using `key` (not `id`) because:
 * - `key` survives attribute delete+recreate with the same key
 * - Avoids FK complexity on a JSONB column
 * - Human-readable — admin understands the template without joining to attribute_definitions
 */

/**
 * A single template field — default value and hint for one attribute.
 * References an attribute_definition by `key` within the same category.
 */
export const TemplateFieldSchema = z.object({
  /** Attribute key this template field applies to (references attribute_definitions.key) */
  key: z.string().min(1),
  /**
   * Optional default value prefilled for the vendor.
   * Supports string, number, or boolean to match all 6 attribute types.
   */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Optional UX hint shown below the form field in the vendor product create form */
  hint: z.string().optional(),
});

/** TypeScript type inferred from TemplateFieldSchema */
export type TemplateField = z.infer<typeof TemplateFieldSchema>;

/**
 * A product template as returned by the API.
 * One template per category (enforced by unique constraint on category_id).
 */
export const ProductTemplateSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Ordered list of template fields — one per attribute the template provides guidance for */
  templateFields: z.array(TemplateFieldSchema),
});

/** TypeScript type inferred from ProductTemplateSchema */
export type ProductTemplate = z.infer<typeof ProductTemplateSchema>;

/**
 * Input schema for creating or updating a product template.
 * Replaces the entire templateFields array on the existing template row.
 */
export const UpsertTemplateInputSchema = z.object({
  templateFields: z.array(TemplateFieldSchema),
});

/** TypeScript type inferred from UpsertTemplateInputSchema */
export type UpsertTemplateInput = z.infer<typeof UpsertTemplateInputSchema>;
