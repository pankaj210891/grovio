import { z } from "zod";

/**
 * Search filter contracts.
 *
 * FilterRequestSchema describes what the client sends when requesting
 * facet counts for a category with active filters applied.
 *
 * FacetResultSchema wraps category attribute definitions with live
 * result counts from OpenSearch aggregations, driving the storefront
 * filter panel UI.
 */

/**
 * A single applied filter entry — key matches an attribute definition key.
 */
export const AppliedFilterSchema = z.object({
  key: z.string(),
  value: z.string(),
});

/** TypeScript type inferred from AppliedFilterSchema */
export type AppliedFilter = z.infer<typeof AppliedFilterSchema>;

/**
 * Input schema for requesting facet counts for a category.
 * appliedFilters contains the currently active filters so the backend
 * can compute post-filter aggregation counts.
 */
export const FilterRequestSchema = z.object({
  categoryId: z.string().uuid(),
  /** Currently active filters — used for post-filter aggregation (Pattern 5) */
  appliedFilters: z.array(AppliedFilterSchema).default([]),
});

/** TypeScript type inferred from FilterRequestSchema */
export type FilterRequest = z.infer<typeof FilterRequestSchema>;

/**
 * A facet value option with count from OpenSearch aggregations.
 * label is the human-readable display value for the filter UI.
 * count is the number of products matching this facet value given
 * the current applied filters.
 */
export const FacetResultValueSchema = z.object({
  value: z.string(),
  label: z.string(),
  count: z.number().int(),
});

/** TypeScript type inferred from FacetResultValueSchema */
export type FacetResultValue = z.infer<typeof FacetResultValueSchema>;

/**
 * A facet result for a single attribute — used to render one filter widget
 * in the storefront filter panel.
 * displayType determines which UI widget to render (checkbox, radio,
 * range_slider, toggle — matches DisplayTypeSchema in category contracts).
 */
export const FacetResultSchema = z.object({
  /** Attribute definition key */
  key: z.string(),
  /** Human-readable label for the filter section header */
  label: z.string(),
  /** UI widget type — maps to DisplayTypeSchema values */
  displayType: z.string(),
  /** Available values with result counts from OpenSearch aggregations */
  values: z.array(FacetResultValueSchema),
});

/** TypeScript type inferred from FacetResultSchema */
export type FacetResult = z.infer<typeof FacetResultSchema>;
