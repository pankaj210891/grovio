import { SearchQuerySchema, SuggestQuerySchema } from "@grovio/contracts";
import type { FastifyInstance } from "fastify";
import type { SearchService } from "../modules/search/index.js";

/**
 * Public search routes — no auth required (SRCH-01 through SRCH-04).
 *
 * GET /search          — full-text product search with faceted filtering (SRCH-01, SRCH-02)
 * GET /search/suggest  — type-ahead autocomplete (SRCH-04, D-16)
 * GET /search/popular  — popular searches for storefront typeahead (Phase 11 T9)
 *
 * Graceful degradation (T-03-W5):
 *   When OpenSearch is unavailable (OPENSEARCH_URL unset or searchService.isAvailable()
 *   returns false), both endpoints return 503 SEARCH_UNAVAILABLE. The API stays up
 *   and search degrades cleanly — HTTP boot is independent of search availability.
 *
 * Query validation (T-03-W3 / ASVS V5):
 *   SearchQuerySchema validates all search query params.
 *   SuggestQuerySchema enforces q.min(2) (D-16 — prevents trivially broad queries).
 *   Zod parse failures throw ZodError → app.ts converts to 400.
 *
 * Security note (T-03-J1): q is injected only into structured multi_match value
 *   fields — never interpolated into a raw query-string DSL. Injection prevention
 *   is enforced at the SearchService level (RESEARCH.md Pattern 5).
 */
export async function searchRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /search ──────────────────────────────────────────────────────────
  // Full-text product search with optional faceted filters and cursor pagination (SRCH-01, SRCH-02).
  fastify.get("/search", async (request, reply) => {
    const searchService =
      fastify.diContainer.resolve<SearchService>("searchService");

    // Graceful degradation: return 503 when OpenSearch is not available (T-03-W5)
    if (!searchService.isAvailable()) {
      return reply.status(503).send({
        success: false,
        error: {
          code: "SEARCH_UNAVAILABLE",
          message:
            "Search is temporarily unavailable. Please try again later.",
        },
      });
    }

    // Validate query params via contracts schema (T-03-W3)
    const params = SearchQuerySchema.parse(request.query);

    // Parse serialized filters if provided (e.g. '{"color":"red","size":"L"}')
    let appliedFilters: Array<{ key: string; value: string }> = [];
    if (params.filters) {
      try {
        const parsed = JSON.parse(params.filters) as Record<string, string>;
        appliedFilters = Object.entries(parsed).map(([key, value]) => ({
          key,
          value,
        }));
      } catch {
        // Invalid filters JSON — ignore and search without filters
      }
    }

    const searchParams: Parameters<typeof searchService.search>[0] = {
      appliedFilters,
      limit: params.limit,
    };
    if (params.q !== undefined) searchParams.q = params.q;
    if (params.categoryId !== undefined) searchParams.categoryId = params.categoryId;
    if (params.sort !== undefined) searchParams.sort = params.sort;
    if (params.cursor !== undefined) searchParams.cursor = params.cursor;

    const result = await searchService.search(searchParams);

    return reply.send({
      success: true,
      data: {
        hits: result.hits,
        total: result.total,
        facets: result.facets,
        nextCursor: result.nextCursor,
      },
    });
  });

  // ── GET /search/suggest ──────────────────────────────────────────────────
  // Type-ahead autocomplete returning grouped products + categories (SRCH-04, D-16).
  // q is validated with min length 2 (D-16 — prevents trivially broad queries, T-03-J1).
  fastify.get("/search/suggest", async (request, reply) => {
    const searchService =
      fastify.diContainer.resolve<SearchService>("searchService");

    // Graceful degradation (T-03-W5)
    if (!searchService.isAvailable()) {
      return reply.status(503).send({
        success: false,
        error: {
          code: "SEARCH_UNAVAILABLE",
          message:
            "Search suggestions are temporarily unavailable. Please try again later.",
        },
      });
    }

    // SuggestQuerySchema enforces q.min(2) — Zod parse throws ZodError → 400 (D-16)
    const params = SuggestQuerySchema.parse(request.query);

    const result = await searchService.suggest(params.q);

    return reply.send({
      success: true,
      data: {
        products: result.products,
        categories: result.categories,
      },
    });
  });

  // ── GET /search/popular ──────────────────────────────────────────────────
  // Returns popular search terms from Redis for storefront typeahead (Phase 11 T9).
  //
  // Redis key: popular_searches — stores a JSON array of up to 10 strings.
  // Written by BullMQ jobs that tally search term frequency (future wave).
  // Falls back to an empty array when the key is absent (new installs / cold start).
  //
  // TTL: the key itself is written by a background job with its own TTL; this
  // endpoint just reads it. 1-hour staleTime recommended on the client side.
  fastify.get("/search/popular", async (_request, reply) => {
    const { redis } = fastify;
    let popularTerms: string[] = [];

    try {
      const raw = await redis.get("popular_searches");
      if (raw) {
        const parsed = JSON.parse(raw) as unknown;
        if (Array.isArray(parsed)) {
          popularTerms = (parsed as unknown[])
            .filter((t): t is string => typeof t === "string")
            .slice(0, 10);
        }
      }
    } catch {
      // Redis read failure or JSON parse error — return empty list gracefully
    }

    return reply.send({ success: true, data: { terms: popularTerms } });
  });
}
