import { z } from "zod";

/**
 * Attribute type enum — the 6 supported attribute value types for category schemas.
 * Matches the Drizzle pgEnum "attr_type" definition exactly (D-05, D-06).
 */
export const AttrTypeSchema = z.enum([
  "text",
  "textarea",
  "number",
  "boolean",
  "enum",
  "multi_select",
]);

/** TypeScript type for the attr_type enum */
export type AttrType = z.infer<typeof AttrTypeSchema>;

/**
 * A single option for enum/multi_select attributes.
 * Stored as JSONB in attribute_definitions.options (D-07).
 */
export const AttributeOptionSchema = z.object({
  /** The internal value stored on the product */
  value: z.string(),
  /** The human-readable label shown to vendors and customers */
  label: z.string(),
});

/** TypeScript type for a single attribute option */
export type AttributeOption = z.infer<typeof AttributeOptionSchema>;

/**
 * Full attribute definition schema — returned by GET /categories/:id/attributes.
 * Covers CAT-03.
 */
export const AttributeDefinitionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Programmatic key — unique per category (e.g., "material", "size") */
  key: z.string().min(1),
  /** Human-readable label for admin and vendor UI */
  label: z.string().min(1),
  attrType: AttrTypeSchema,
  /** Options array for enum/multi_select; null for all other types (D-07) */
  options: z.array(AttributeOptionSchema).nullable(),
  isRequired: z.boolean(),
  /** Controls whether this attribute appears in the filter schema builder (CAT-04) */
  isFilterable: z.boolean(),
  /** Controls OpenSearch projection (Phase 3 reads this flag) */
  isSearchable: z.boolean(),
  sortOrder: z.number().int(),
});

/** TypeScript type for a full attribute definition */
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

/**
 * Input schema for creating a new attribute definition.
 * Business rule: options is required (non-empty) for enum/multi_select; must be absent for others.
 * Enforced in AttributeDefinitionService.createAttribute() — not a Zod-level refinement
 * to keep error messages domain-friendly.
 */
export const CreateAttributeInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  attrType: AttrTypeSchema,
  options: z.array(AttributeOptionSchema).optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});

/** TypeScript type for attribute creation input */
export type CreateAttributeInput = z.infer<typeof CreateAttributeInputSchema>;

/** Input schema for updating an existing attribute definition */
export const UpdateAttributeInputSchema = CreateAttributeInputSchema.partial().omit({
  key: true,
  attrType: true,
});

/** TypeScript type for attribute update input */
export type UpdateAttributeInput = z.infer<typeof UpdateAttributeInputSchema>;
