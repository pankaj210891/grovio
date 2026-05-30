import { z } from "zod";

/**
 * Category attribute definition contracts.
 *
 * Per D-05/D-06: 6 core attribute types are defined as an exhaustive Zod enum.
 * No free-form type strings are accepted — the enum is the single source of truth
 * for the attr_type Drizzle pgEnum in the database.
 *
 * Security note (T-02-02): z.enum of exactly 6 values forbids arbitrary attr_type
 * values from being accepted by the API, preventing schema pollution.
 */

/**
 * Exhaustive enum of the 6 core attribute types (D-05/D-06).
 * Matches the Drizzle pgEnum `attr_type` in attribute_definitions table.
 */
export const AttrTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "boolean",
  "enum",
  "multi_select",
]);

/** TypeScript type inferred from AttrTypeSchema */
export type AttrType = z.infer<typeof AttrTypeSchema>;

/**
 * A single option entry for enum/multi_select attribute types (D-07).
 * Stored as JSONB array on the attribute_definitions row.
 */
export const AttributeOptionSchema = z.object({
  /** Machine-readable value stored on the product */
  value: z.string(),
  /** Human-readable label shown in admin UI and storefront filters */
  label: z.string(),
});

/** TypeScript type inferred from AttributeOptionSchema */
export type AttributeOption = z.infer<typeof AttributeOptionSchema>;

/**
 * A category attribute definition as returned by the API.
 * Represents one typed attribute configured for a specific category.
 */
export const AttributeDefinitionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Attribute key — unique per category; referenced by product template fields */
  key: z.string().min(1),
  /** Human-readable label for admin UI and storefront display */
  label: z.string().min(1),
  /** Attribute type — exactly 6 allowed values (D-06) */
  attrType: AttrTypeSchema,
  /**
   * Options array for enum/multi_select types (D-07).
   * Null for text, textarea, number, boolean.
   */
  options: z.array(AttributeOptionSchema).nullable(),
  /** Whether vendors must provide this attribute when listing a product */
  isRequired: z.boolean(),
  /** Whether this attribute appears in the storefront filter panel (Phase 3) */
  isFilterable: z.boolean(),
  /** Whether this attribute is projected into OpenSearch (Phase 3) */
  isSearchable: z.boolean(),
  /** Display order within the category attribute list */
  sortOrder: z.number().int(),
});

/** TypeScript type inferred from AttributeDefinitionSchema */
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

/**
 * Input schema for creating a new attribute definition.
 * Omits system-managed fields (id, categoryId — supplied by route params).
 */
export const CreateAttributeInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  attrType: AttrTypeSchema,
  /** Required when attrType is enum or multi_select; omit for other types */
  options: z.array(AttributeOptionSchema).optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** TypeScript type inferred from CreateAttributeInputSchema */
export type CreateAttributeInput = z.infer<typeof CreateAttributeInputSchema>;
