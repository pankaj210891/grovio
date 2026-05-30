import { z } from "zod";

/**
 * Product template field — a hint/default entry referencing an attribute_definition key.
 * Stored as JSONB in product_templates.template_fields.
 *
 * Uses attribute_definition.key (text) rather than UUID so the template survives
 * attribute deletion and recreation with the same key (RESEARCH.md Open Questions #2).
 */
export const TemplateFieldSchema = z.object({
  /** References attribute_definition.key for this category */
  key: z.string().min(1),
  /** Optional default value shown to vendors in the product-create form */
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  /** Optional UX hint text shown below the field in the vendor form */
  hint: z.string().optional(),
});

/** TypeScript type for a single template field */
export type TemplateField = z.infer<typeof TemplateFieldSchema>;

/**
 * Full product template — one per category (unique on category_id).
 * Returned by GET /categories/:id/template.
 * Covers CAT-05.
 */
export const ProductTemplateSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  templateFields: z.array(TemplateFieldSchema),
});

/** TypeScript type for a full product template */
export type ProductTemplate = z.infer<typeof ProductTemplateSchema>;

/** Input schema for upserting a product template */
export const UpsertTemplateInputSchema = z.object({
  templateFields: z.array(TemplateFieldSchema),
});

/** TypeScript type for template upsert input */
export type UpsertTemplateInput = z.infer<typeof UpsertTemplateInputSchema>;
