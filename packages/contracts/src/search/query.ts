import { z } from "zod";

/**
 * Search query contracts.
 *
 * SearchResponseSchema carries both search hits AND facet aggregations to
 * support the faceted-filtering UX (RESEARCH.md Pattern 5).
 * Cursor-based pagination is used (nextCursor) for infinite scroll.
 */

/**
 * Input schema for a product search request.
 * All fields are optional — an empty query returns all approved products.
 * filters is a serialized filter string (e.g. JSON or URL-encoded key=value pairs).
 */
export const SearchQuerySchema = z.object({
  /** Full-text search query */
  q: z.string().optional(),
  /** Filter results to a specific category */
  categoryId: z.string().uuid().optional(),
  /** Serialized applied filters (e.g. '{"color":"red","size":"L"}') */
  filters: z.string().optional(),
  /** Sort order (e.g. "price_asc", "price_desc", "relevance") */
  sort: z.string().optional(),
  /** Number of results per page (1–100, default 20) */
  limit: z.coerce.number().int().min(1).max(100).default(20),
  /** Opaque cursor for keyset pagination (from previous SearchResponse.nextCursor) */
  cursor: z.string().optional(),
});

/** TypeScript type inferred from SearchQuerySchema */
export type SearchQuery = z.infer<typeof SearchQuerySchema>;

/**
 * A single search result item.
 * basePriceMinor is always an integer in minor currency units (D-01).
 */
export const SearchHitSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
  /** Base price in minor currency units (cents/paise — D-01) */
  basePriceMinor: z.number().int(),
  categoryId: z.string().uuid(),
  vendorId: z.string().uuid(),
  /** Primary product image URL (null if no images uploaded) */
  imageUrl: z.string().url().nullable(),
});

/** TypeScript type inferred from SearchHitSchema */
export type SearchHit = z.infer<typeof SearchHitSchema>;

/**
 * A single facet value with its result count.
 */
export const FacetValueSchema = z.object({
  value: z.string(),
  count: z.number().int(),
});

/** TypeScript type inferred from FacetValueSchema */
export type FacetValue = z.infer<typeof FacetValueSchema>;

/**
 * A facet group as returned in a search response.
 * key matches an attribute definition key; label is for UI display.
 */
export const FacetSchema = z.object({
  key: z.string(),
  label: z.string(),
  values: z.array(FacetValueSchema),
});

/** TypeScript type inferred from FacetSchema */
export type Facet = z.infer<typeof FacetSchema>;

/**
 * Full search response — hits + aggregations + pagination cursor.
 * facets carry aggregated counts for filter panel population (Pattern 5).
 * nextCursor is null when there are no more results.
 */
export const SearchResponseSchema = z.object({
  hits: z.array(SearchHitSchema),
  total: z.number().int(),
  /** Facet aggregations for rendering the category filter panel */
  facets: z.array(FacetSchema),
  /** Opaque cursor for the next page; null when no more results */
  nextCursor: z.string().nullable(),
});

/** TypeScript type inferred from SearchResponseSchema */
export type SearchResponse = z.infer<typeof SearchResponseSchema>;
