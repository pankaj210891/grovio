import { z } from "zod";

/**
 * Search suggest (autocomplete) contracts.
 *
 * Per D-16: SuggestQuerySchema enforces a minimum of 2 characters to prevent
 * trivially broad queries. SuggestResponseSchema returns grouped results for
 * both products and categories in a single response.
 *
 * Security note (T-03-V3): q is a bounded text value (min 2 chars),
 * never a structured object — prevents query-DSL injection downstream.
 */

/**
 * Input schema for a search suggestion request.
 * q must be at least 2 characters to produce meaningful suggestions (D-16).
 */
export const SuggestQuerySchema = z.object({
  /** Search query — minimum 2 characters required (D-16) */
  q: z.string().min(2),
});

/** TypeScript type inferred from SuggestQuerySchema */
export type SuggestQuery = z.infer<typeof SuggestQuerySchema>;

/**
 * A single product suggestion.
 */
export const SuggestProductSchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

/** TypeScript type inferred from SuggestProductSchema */
export type SuggestProduct = z.infer<typeof SuggestProductSchema>;

/**
 * A single category suggestion.
 */
export const SuggestCategorySchema = z.object({
  id: z.string().uuid(),
  name: z.string(),
  slug: z.string(),
});

/** TypeScript type inferred from SuggestCategorySchema */
export type SuggestCategory = z.infer<typeof SuggestCategorySchema>;

/**
 * Grouped autocomplete response with both product and category suggestions (D-16).
 * Returns both arrays in a single response to minimise client round trips.
 */
export const SuggestResponseSchema = z.object({
  /** Matching product suggestions */
  products: z.array(SuggestProductSchema),
  /** Matching category suggestions */
  categories: z.array(SuggestCategorySchema),
});

/** TypeScript type inferred from SuggestResponseSchema */
export type SuggestResponse = z.infer<typeof SuggestResponseSchema>;
