import type { Client } from "@opensearch-project/opensearch";
import type { Env } from "../../config/env.js";

// ---------------------------------------------------------------------------
// Index name
// ---------------------------------------------------------------------------

/**
 * Returns the OpenSearch index name scoped to the current NODE_ENV.
 *
 * Convention: `grovio-products-${NODE_ENV}` isolates dev / test / production
 * clusters automatically — no code change required when switching environments.
 *
 * Research ref: CONTEXT.md (OpenSearch index name — Claude's discretion);
 * RESEARCH.md Open Question 2 recommendation.
 */
export function getIndexName(env: Pick<Env, "NODE_ENV">): string {
  return `grovio-products-${env.NODE_ENV}`;
}

// ---------------------------------------------------------------------------
// Index mapping
// ---------------------------------------------------------------------------

/**
 * Static OpenSearch index mapping for the product search index.
 *
 * Design decisions:
 * - `name` and `categoryName` use `search_as_you_type` for type-ahead
 *   suggestions (D-16, SRCH-01). Simpler than the completion suggester and
 *   supports infix as well as prefix matching.
 * - `attributes` object uses `"dynamic": false` — prevents arbitrary JSONB
 *   key expansion from creating unbounded fields in the index (Anti-Pattern 6,
 *   Pitfall 2). Only the pre-declared keyword sub-properties are indexed.
 * - Pre-declared attribute properties (`color`, `size`, `brand`, `material`,
 *   `material_type`) cover the seeded demo categories. New attributes added
 *   by admins are stored in JSONB on the product row but won't be indexed
 *   until a mapping update is applied (post-v1 tooling concern).
 * - `attr_text` is a flat text field that receives `copy_to` from all
 *   attribute keyword fields. Multi-match queries include `attr_text` so
 *   attribute value text is searched alongside product name and description.
 * - `basePriceMinor`: `long` (BIGINT mapping) — never float (T-03-S2, D-01).
 * - `status`, `categoryId`, `vendorId`: `keyword` for exact-match filtering
 *   and aggregations.
 *
 * Research ref: RESEARCH.md Pattern 4; PATTERNS.md opensearch-mapping.ts.
 */
export const PRODUCT_INDEX_MAPPING = {
  mappings: {
    dynamic: false as const,
    properties: {
      /** Product name — search_as_you_type enables type-ahead (D-16, SRCH-01). */
      name: { type: "search_as_you_type" as const },

      /** Product description — full-text search. */
      description: { type: "text" as const },

      /** Category ID — keyword for terms filter. */
      categoryId: { type: "keyword" as const },

      /** Vendor ID — keyword for vendor-scoped queries. */
      vendorId: { type: "keyword" as const },

      /**
       * Moderation status — keyword for status filter.
       * Only approved products are indexed (D-13); kept for potential
       * re-indexing scenarios where status transitions are replayed.
       */
      status: { type: "keyword" as const },

      /** Base price in minor currency units — long (BIGINT, never float, D-01). */
      basePriceMinor: { type: "long" as const },

      /** Category name — search_as_you_type enables category type-ahead (D-16). */
      categoryName: { type: "search_as_you_type" as const },

      /**
       * Product attributes — object with dynamic:false (Anti-Pattern 6, Pitfall 2).
       *
       * `dynamic: false` means OpenSearch accepts documents with unknown attribute
       * keys (no mapping error) but does NOT index them. Only the pre-declared
       * properties below are searchable and aggregatable.
       *
       * This prevents the mapping explosion that would occur if arbitrary JSONB
       * keys (from product.attributes) were indexed directly.
       */
      attributes: {
        type: "object" as const,
        dynamic: false as const,
        properties: {
          color: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          size: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          brand: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          material: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          material_type: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          condition: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          style: {
            type: "keyword" as const,
            copy_to: "attr_text",
          },
          weight_grams: {
            type: "long" as const,
          },
        },
      },

      /**
       * Flat text field that receives copy_to from all attribute keyword fields.
       * Multi-match queries include this field so attribute values are searched
       * alongside product name and description.
       */
      attr_text: { type: "text" as const },
    },
  },
} as const;

// ---------------------------------------------------------------------------
// ensureIndex — idempotent index creation
// ---------------------------------------------------------------------------

/**
 * Creates the product search index if it does not already exist.
 *
 * Idempotent: calls `indices.exists` first and skips creation when the index
 * is already present. This is safe to call at API startup every time —
 * it becomes a no-op after the first run.
 *
 * @throws Will throw if the OpenSearch client cannot reach the cluster —
 *   callers should handle or let the error propagate as a startup failure.
 */
export async function ensureIndex(
  client: Client,
  env: Pick<Env, "NODE_ENV">
): Promise<void> {
  const indexName = getIndexName(env);

  const existsResponse = await client.indices.exists({ index: indexName });

  // OpenSearch JS client v3: body is the response — status 200 = exists, 404 = not found
  const exists =
    existsResponse.statusCode === 200 ||
    (existsResponse.body !== undefined && existsResponse.body !== false);

  if (exists && existsResponse.statusCode !== 404) {
    return; // index already exists — nothing to do
  }

  await client.indices.create({
    index: indexName,
    body: PRODUCT_INDEX_MAPPING,
  });
}
