import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Client } from "@opensearch-project/opensearch";
import type { Env } from "../../config/env.js";
import {
  attributeDefinitions,
  filterSchemaDefinitions,
} from "../../db/schema/index.js";
import { getIndexName } from "./opensearch-mapping.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export interface SearchParams {
  q?: string;
  categoryId?: string;
  appliedFilters?: Array<{ key: string; value: string }>;
  sort?: string;
  limit?: number;
  cursor?: string;
}

export interface SearchHit {
  id: string;
  name: string;
  slug: string;
  basePriceMinor: number;
  categoryId: string;
  vendorId: string;
  imageUrl: string | null;
}

export interface FacetValue {
  value: string;
  count: number;
}

export interface Facet {
  key: string;
  label: string;
  values: FacetValue[];
}

export interface SearchResult {
  hits: SearchHit[];
  total: number;
  facets: Facet[];
  nextCursor: string | null;
  /** True when OpenSearch is unavailable — callers can surface a 503. */
  unavailable?: boolean;
}

export interface SuggestResult {
  products: Array<{ id: string; name: string; slug: string }>;
  categories: Array<{ id: string; name: string; slug: string }>;
}

// ---------------------------------------------------------------------------
// Raw filter schema row shape (matches FilterSchemaService join output)
// ---------------------------------------------------------------------------

interface FilterSchemaRow {
  fsd_id: string;
  fsd_category_id: string;
  fsd_attribute_def_id: string;
  fsd_display_type: string;
  fsd_sort_order: number;
  ad_key: string;
  ad_label: string;
  ad_attr_type: string;
  ad_options: unknown;
}

// ---------------------------------------------------------------------------
// Dependencies interface
// ---------------------------------------------------------------------------

interface SearchServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Pick<Env, "NODE_ENV" | "FILTER_SCHEMA_TTL_SECONDS">;
  /** null when OPENSEARCH_URL is not configured. */
  opensearch: Client | null;
}

// ---------------------------------------------------------------------------
// SearchService
// ---------------------------------------------------------------------------

/**
 * SearchService
 *
 * Read-only projection layer for OpenSearch. PostgreSQL is always authoritative;
 * OpenSearch is eventually consistent via BullMQ async indexing (D-14).
 *
 * Core capabilities:
 * - search(): Full-text multi_match with post_filter faceting. Using post_filter
 *   means aggregation counts remain accurate when a filter is applied (SRCH-02/SRCH-03).
 * - suggest(): search_as_you_type queries on product name + category name, returning
 *   grouped products/categories. Enforces 2-char minimum (D-16, T-03-J1).
 * - getFilterSchema(): Returns the category's filterable attributes, Redis-cached
 *   under category_filter_schema:{categoryId} with FILTER_SCHEMA_TTL_SECONDS TTL.
 *   Cache key matches FilterSchemaService.invalidateFilterCache() (Pitfall 6).
 * - isAvailable(): false when opensearch dep is null.
 *
 * Graceful degradation: search() and suggest() return empty results when
 * isAvailable() is false — callers can surface a 503 rather than throwing (T-03-J5).
 *
 * Security: q is passed only into structured multi_match value, never into a
 * raw query-string DSL (T-03-J1 — injection prevention).
 *
 * Research refs: RESEARCH.md Pattern 5 (post_filter + aggs);
 * D-16 (suggest 2-char min); PATTERNS.md SearchService adaptation.
 */
export class SearchService {
  constructor(private deps: SearchServiceDeps) {}

  // ── Public: availability check ────────────────────────────────────────────

  /**
   * Returns false when OpenSearch is not configured (OPENSEARCH_URL unset).
   * Callers should check this before surfacing search features.
   */
  isAvailable(): boolean {
    return this.deps.opensearch !== null;
  }

  // ── Public: search ────────────────────────────────────────────────────────

  /**
   * Full-text product search with faceted filtering.
   *
   * When appliedFilters are non-empty, a post_filter clause is added so that
   * aggregation (facet) counts are computed on the full unfiltered result set —
   * only the hits are filtered. This is the standard faceted search pattern
   * (SRCH-02/SRCH-03, RESEARCH.md Pattern 5).
   *
   * @param params - Search parameters.
   * @returns SearchResult with hits, total, facets, cursor, and optional unavailable flag.
   */
  async search(params: SearchParams): Promise<SearchResult> {
    const empty: SearchResult = {
      hits: [],
      total: 0,
      facets: [],
      nextCursor: null,
      unavailable: true,
    };

    if (!this.isAvailable()) {
      return empty;
    }

    const { opensearch, env } = this.deps;
    const { q, categoryId, appliedFilters = [], sort, limit = 20 } = params;
    const indexName = getIndexName(env);

    // Resolve filter schema for aggregations if categoryId provided
    const filterSchema = categoryId
      ? await this.getFilterSchema(categoryId)
      : [];

    // Build aggregations from filter schema
    const aggs: Record<string, unknown> = {};
    for (const fs of filterSchema) {
      if (fs.ad_key) {
        aggs[fs.ad_key] = {
          terms: { field: `attributes.${fs.ad_key}` },
        };
      }
    }

    // Build base query
    const baseQuery = q
      ? {
          multi_match: {
            query: q,
            fields: ["name", "name._2gram", "name._3gram", "description", "attr_text"],
          },
        }
      : { match_all: {} };

    // Apply category filter in the main query
    const queryClause = categoryId
      ? {
          bool: {
            must: [baseQuery],
            filter: [{ term: { categoryId } }],
          },
        }
      : baseQuery;

    // Determine sort
    const sortParam = resolveSortParam(sort);

    // Build the OpenSearch request body
    const body: Record<string, unknown> = {
      query: queryClause,
      aggs,
      sort: sortParam,
      size: limit,
    };

    // post_filter: applied only when filters are active (SRCH-02/SRCH-03)
    if (appliedFilters.length > 0) {
      body["post_filter"] = {
        bool: {
          must: appliedFilters.map((f) => ({
            term: { [`attributes.${f.key}`]: f.value },
          })),
        },
      };
    }

    const response = await opensearch!.search({
      index: indexName,
      body,
    });

    const respBody = response.body as Record<string, unknown>;
    const hitsBlock = respBody["hits"] as Record<string, unknown>;
    const rawHits = (hitsBlock["hits"] as Array<Record<string, unknown>>) ?? [];
    const total =
      (hitsBlock["total"] as { value: number } | number) instanceof Object
        ? (hitsBlock["total"] as { value: number }).value
        : (hitsBlock["total"] as number) ?? 0;

    const hits: SearchHit[] = rawHits.map((h) => {
      const src = h["_source"] as Record<string, unknown>;
      return {
        id: h["_id"] as string,
        name: (src["name"] as string) ?? "",
        slug: (src["slug"] as string) ?? "",
        basePriceMinor: (src["basePriceMinor"] as number) ?? 0,
        categoryId: (src["categoryId"] as string) ?? "",
        vendorId: (src["vendorId"] as string) ?? "",
        imageUrl: (src["imageUrl"] as string | null) ?? null,
      };
    });

    // Map aggregations to facets
    const aggsBlock = (respBody["aggregations"] ?? {}) as Record<string, unknown>;
    const facets: Facet[] = filterSchema
      .filter((fs) => aggsBlock[fs.ad_key])
      .map((fs) => {
        const aggResult = aggsBlock[fs.ad_key] as {
          buckets: Array<{ key: string; doc_count: number }>;
        };
        return {
          key: fs.ad_key,
          label: fs.ad_label,
          values: (aggResult.buckets ?? []).map((b) => ({
            value: b.key,
            count: b.doc_count,
          })),
        };
      });

    return {
      hits,
      total,
      facets,
      nextCursor: null, // TODO: implement cursor pagination in plan 03-07
      unavailable: false,
    };
  }

  // ── Public: suggest ────────────────────────────────────────────────────────

  /**
   * Type-ahead search suggestions for product names and category names.
   *
   * Security: q must be at least 2 characters (D-16, T-03-J1).
   * Queries search_as_you_type fields on name and categoryName.
   * Returns grouped { products, categories } in a single response (D-16).
   *
   * @param q - Search query (minimum 2 characters).
   * @throws Error when q is shorter than 2 characters.
   */
  async suggest(q: string): Promise<SuggestResult> {
    if (q.length < 2) {
      throw new Error(
        "Suggest query must be at least 2 characters long (D-16)"
      );
    }

    const empty: SuggestResult = { products: [], categories: [] };

    if (!this.isAvailable()) {
      return empty;
    }

    const { opensearch, env } = this.deps;
    const indexName = getIndexName(env);

    const response = await opensearch!.search({
      index: indexName,
      body: {
        query: {
          multi_match: {
            query: q,
            type: "bool_prefix",
            fields: [
              "name",
              "name._2gram",
              "name._3gram",
              "categoryName",
              "categoryName._2gram",
              "categoryName._3gram",
            ],
          },
        },
        size: 10,
      },
    });

    const respBody = response.body as Record<string, unknown>;
    const hitsBlock = respBody["hits"] as Record<string, unknown>;
    const rawHits = (hitsBlock["hits"] as Array<Record<string, unknown>>) ?? [];

    // Group hits into products and categories
    const seenCategories = new Set<string>();
    const products: SuggestResult["products"] = [];
    const categories: SuggestResult["categories"] = [];

    for (const h of rawHits) {
      const src = h["_source"] as Record<string, unknown>;
      const id = h["_id"] as string;
      const name = (src["name"] as string) ?? "";
      const slug = (src["slug"] as string) ?? "";

      products.push({ id, name, slug });

      // Collect unique category suggestions from the hit's categoryId/Name
      const catId = src["categoryId"] as string;
      const catName = src["categoryName"] as string;
      const catSlug = slug; // approximate; category routing handled in routes

      if (catId && catName && !seenCategories.has(catId)) {
        seenCategories.add(catId);
        categories.push({ id: catId, name: catName, slug: catSlug });
      }
    }

    return { products, categories };
  }

  // ── Public: filter schema with Redis caching ──────────────────────────────

  /**
   * Returns the filter schema for a category from Redis cache or DB.
   *
   * Cache key: `category_filter_schema:{categoryId}`
   * MUST match the key invalidated by FilterSchemaService.invalidateFilterCache()
   * (Pitfall 6 — stale filter schema after admin schema change).
   *
   * TTL: FILTER_SCHEMA_TTL_SECONDS (default 300s). Write-through invalidation in
   * FilterSchemaService ensures changes propagate immediately, so this TTL is a
   * safety net only.
   *
   * @param categoryId - Category UUID.
   * @returns Raw filter schema rows (joined with attribute metadata).
   */
  async getFilterSchema(categoryId: string): Promise<FilterSchemaRow[]> {
    const { db, redis, env } = this.deps;
    const cacheKey = `category_filter_schema:${categoryId}`;

    // Redis-first: return cached schema immediately if present.
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as FilterSchemaRow[];
    }

    // DB fallback: join filter_schema_definitions with attribute_definitions.
    const rows = await db
      .select({
        fsd_id: filterSchemaDefinitions.id,
        fsd_category_id: filterSchemaDefinitions.categoryId,
        fsd_attribute_def_id: filterSchemaDefinitions.attributeDefId,
        fsd_display_type: filterSchemaDefinitions.displayType,
        fsd_sort_order: filterSchemaDefinitions.sortOrder,
        ad_key: attributeDefinitions.key,
        ad_label: attributeDefinitions.label,
        ad_attr_type: attributeDefinitions.attrType,
        ad_options: attributeDefinitions.options,
      })
      .from(filterSchemaDefinitions)
      .innerJoin(
        attributeDefinitions,
        eq(filterSchemaDefinitions.attributeDefId, attributeDefinitions.id)
      )
      .where(eq(filterSchemaDefinitions.categoryId, categoryId))
      .orderBy(asc(filterSchemaDefinitions.sortOrder));

    // Cache the result for subsequent reads.
    await redis.setex(
      cacheKey,
      env.FILTER_SCHEMA_TTL_SECONDS,
      JSON.stringify(rows)
    );

    return rows as FilterSchemaRow[];
  }
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Resolve sort parameter to an OpenSearch sort clause. */
function resolveSortParam(
  sort?: string
): Array<Record<string, unknown>> {
  switch (sort) {
    case "price_asc":
      return [{ basePriceMinor: { order: "asc" } }];
    case "price_desc":
      return [{ basePriceMinor: { order: "desc" } }];
    case "name_asc":
      return [{ "name.keyword": { order: "asc" } }];
    default:
      // Default: relevance (_score desc)
      return [{ _score: { order: "desc" } }];
  }
}
