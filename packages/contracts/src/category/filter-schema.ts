import { z } from "zod";
import { AttributeDefinitionSchema } from "./attribute-definition.js";

/**
 * Filter schema contracts for per-category storefront filter configuration.
 *
 * Per CAT-04: Admin defines which attributes appear as storefront filter widgets
 * and which display type widget to use for each (checkbox, radio, range_slider, toggle).
 *
 * Pattern 6: display_type enum maps attribute types to UI widgets.
 * | Attribute Type | Recommended Display Types         |
 * |----------------|-----------------------------------|
 * | text           | not filterable (text search only) |
 * | textarea       | not filterable                    |
 * | number         | range_slider                      |
 * | boolean        | toggle                            |
 * | enum           | radio, checkbox                   |
 * | multi_select   | checkbox                          |
 */

/**
 * Display type enum for filter widgets.
 * Controls which storefront UI widget renders each category filter.
 */
export const DisplayTypeSchema = z.enum([
  "checkbox",
  "radio",
  "range_slider",
  "toggle",
]);

/** TypeScript type inferred from DisplayTypeSchema */
export type DisplayType = z.infer<typeof DisplayTypeSchema>;

/**
 * A single filter schema definition entry as returned by the API.
 * Represents one attribute configured as a storefront filter for a category.
 */
export const FilterSchemaDefSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  attributeDefId: z.string().uuid(),
  /**
   * Embedded attribute metadata — key fields needed by the storefront filter UI.
   * Only key, label, attrType, and options are included (not internal flags).
   */
  attribute: AttributeDefinitionSchema.pick({
    key: true,
    label: true,
    attrType: true,
    options: true,
  }),
  /** Which UI widget renders this filter on the storefront */
  displayType: DisplayTypeSchema,
  /** Display order within the category filter panel */
  sortOrder: z.number().int(),
});

/** TypeScript type inferred from FilterSchemaDefSchema */
export type FilterSchemaDef = z.infer<typeof FilterSchemaDefSchema>;

/**
 * Input schema for replacing the entire filter schema for a category.
 * Sends the full ordered list of filter entries; any existing entries not
 * in this list are removed.
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

/** TypeScript type inferred from UpsertFilterSchemaInputSchema */
export type UpsertFilterSchemaInput = z.infer<
  typeof UpsertFilterSchemaInputSchema
>;
