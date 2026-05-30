import { z } from "zod";
import { AttributeDefinitionSchema } from "./attribute-definition.js";

/**
 * Display type for filter schema entries — controls which UI widget the storefront
 * uses to render this attribute as a filter on Product Listing Pages.
 *
 * Recommended attribute type → display type mappings (Pattern 6 in PATTERNS.md):
 *   number       → range_slider
 *   boolean      → toggle
 *   enum         → radio (single) or checkbox (multi)
 *   multi_select → checkbox
 *   text/textarea → not filterable (full-text search only)
 */
export const DisplayTypeSchema = z.enum([
  "checkbox",
  "radio",
  "range_slider",
  "toggle",
]);

/** TypeScript type for the filter display type enum */
export type DisplayType = z.infer<typeof DisplayTypeSchema>;

/**
 * A single filter schema definition entry — returned by GET /categories/:id/filters.
 * Includes a subset of the referenced attribute definition for display purposes.
 * Covers CAT-04.
 */
export const FilterSchemaDefSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  attributeDefId: z.string().uuid(),
  /** Joined attribute fields — avoids a second round-trip from the storefront */
  attribute: AttributeDefinitionSchema.pick({
    key: true,
    label: true,
    attrType: true,
    options: true,
  }),
  displayType: DisplayTypeSchema,
  sortOrder: z.number().int(),
});

/** TypeScript type for a filter schema definition */
export type FilterSchemaDef = z.infer<typeof FilterSchemaDefSchema>;

/**
 * Input schema for upserting the entire filter schema for a category.
 * Replaces all existing entries with the provided array (PUT semantics).
 */
export const UpsertFilterSchemaInputSchema = z.object({
  filters: z.array(
    z.object({
      attributeDefId: z.string().uuid(),
      displayType: DisplayTypeSchema,
      sortOrder: z.number().int(),
    })
  ),
});

/** TypeScript type for filter schema upsert input */
export type UpsertFilterSchemaInput = z.infer<typeof UpsertFilterSchemaInputSchema>;
