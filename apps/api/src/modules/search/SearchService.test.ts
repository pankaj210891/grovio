import { describe, expect, it, vi, beforeEach } from "vitest";
import type { Mock } from "vitest";
import type { Client as OpenSearchClient } from "@opensearch-project/opensearch";
import { SearchService } from "./SearchService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Minimal OpenSearch client mock */
interface OpenSearchMock {
  search: Mock;
}

function makeOpenSearchMock(searchResult?: unknown): OpenSearchMock {
  return {
    search: vi.fn().mockResolvedValue(
      searchResult ?? {
        statusCode: 200,
        body: {
          hits: { hits: [], total: { value: 0 } },
          aggregations: {},
        },
      }
    ),
  };
}

function asClient(mock: OpenSearchMock): OpenSearchClient {
  return mock as unknown as OpenSearchClient;
}

/** Redis mock */
function makeRedisMock(cachedValue?: string | null) {
  return {
    get: vi.fn().mockResolvedValue(cachedValue ?? null),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
}

/** DB mock for getFilterSchema — returns filter schema rows */
function makeDbMock(
  filterRows: Array<{
    fsd_id: string;
    fsd_category_id: string;
    fsd_attribute_def_id: string;
    fsd_display_type: string;
    fsd_sort_order: number;
    ad_key: string;
    ad_label: string;
    ad_attr_type: string;
    ad_options: null;
  }>
) {
  const selectChain = {
    from: vi.fn().mockReturnValue({
      innerJoin: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          orderBy: vi.fn().mockResolvedValue(filterRows),
        }),
      }),
    }),
  };
  return { select: vi.fn().mockReturnValue(selectChain) };
}

const sampleFilterRow = {
  fsd_id: "fsd-1",
  fsd_category_id: "cat-abc",
  fsd_attribute_def_id: "attr-1",
  fsd_display_type: "checkbox",
  fsd_sort_order: 0,
  ad_key: "color",
  ad_label: "Color",
  ad_attr_type: "enum",
  ad_options: null,
};

// ---------------------------------------------------------------------------
// Helpers to make env
// ---------------------------------------------------------------------------

function makeEnv(overrides?: Partial<{ NODE_ENV: string; FILTER_SCHEMA_TTL_SECONDS: number }>) {
  return {
    NODE_ENV: "test" as const,
    FILTER_SCHEMA_TTL_SECONDS: 300,
    ...overrides,
  };
}

// ---------------------------------------------------------------------------
// SearchService.isAvailable()
// ---------------------------------------------------------------------------

describe("SearchService.isAvailable()", () => {
  it("returns false when opensearch dep is null", () => {
    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: null,
    });
    expect(service.isAvailable()).toBe(false);
  });

  it("returns true when opensearch dep is provided", () => {
    const openSearchMock = makeOpenSearchMock();
    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: asClient(openSearchMock),
    });
    expect(service.isAvailable()).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// SearchService.search() — graceful degradation
// ---------------------------------------------------------------------------

describe("SearchService.search()", () => {
  it("returns empty results with unavailable flag when opensearch is null (graceful degradation)", async () => {
    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: null,
    });

    const result = await service.search({ q: "widget" });

    expect(result.hits).toEqual([]);
    expect(result.total).toBe(0);
    expect(result.facets).toEqual([]);
    expect(result.nextCursor).toBeNull();
    expect(result.unavailable).toBe(true);
  });

  it("includes post_filter in query when appliedFilters are provided (SRCH-02/SRCH-03)", async () => {
    const openSearchMock = makeOpenSearchMock({
      statusCode: 200,
      body: {
        hits: { hits: [], total: { value: 0 } },
        aggregations: {},
      },
    });

    const service = new SearchService({
      db: makeDbMock([sampleFilterRow]) as never,
      redis: makeRedisMock(JSON.stringify([sampleFilterRow])) as never,
      env: makeEnv() as never,
      opensearch: asClient(openSearchMock),
    });

    await service.search({
      q: "red",
      categoryId: "cat-abc",
      appliedFilters: [{ key: "color", value: "red" }],
    });

    expect(openSearchMock.search).toHaveBeenCalledOnce();
    const callBody = openSearchMock.search.mock.calls[0]![0];
    const body = callBody.body as Record<string, unknown>;

    // post_filter MUST be present when appliedFilters are non-empty (SRCH-02/SRCH-03)
    expect(body).toHaveProperty("post_filter");
    const postFilter = body["post_filter"] as Record<string, unknown>;
    const boolClause = postFilter["bool"] as Record<string, unknown>;
    expect(Array.isArray(boolClause["must"])).toBe(true);
  });

  it("does NOT include post_filter when no appliedFilters provided", async () => {
    const openSearchMock = makeOpenSearchMock({
      statusCode: 200,
      body: {
        hits: { hits: [], total: { value: 0 } },
        aggregations: {},
      },
    });

    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: asClient(openSearchMock),
    });

    await service.search({ q: "widget", appliedFilters: [] });

    expect(openSearchMock.search).toHaveBeenCalledOnce();
    const callBody = openSearchMock.search.mock.calls[0]![0];
    const body = callBody.body as Record<string, unknown>;
    expect(body).not.toHaveProperty("post_filter");
  });

  it("maps OpenSearch aggregations to facets in the response", async () => {
    const openSearchMock = makeOpenSearchMock({
      statusCode: 200,
      body: {
        hits: {
          hits: [],
          total: { value: 5 },
        },
        aggregations: {
          color: {
            buckets: [
              { key: "red", doc_count: 3 },
              { key: "blue", doc_count: 2 },
            ],
          },
        },
      },
    });

    const service = new SearchService({
      db: makeDbMock([sampleFilterRow]) as never,
      redis: makeRedisMock(JSON.stringify([sampleFilterRow])) as never,
      env: makeEnv() as never,
      opensearch: asClient(openSearchMock),
    });

    const result = await service.search({
      categoryId: "cat-abc",
      appliedFilters: [],
    });

    // Facets should map the aggregation results
    expect(result.facets).toHaveLength(1);
    const colorFacet = result.facets[0]!;
    expect(colorFacet.key).toBe("color");
    expect(colorFacet.values).toContainEqual({ value: "red", count: 3 });
    expect(colorFacet.values).toContainEqual({ value: "blue", count: 2 });
  });
});

// ---------------------------------------------------------------------------
// SearchService.suggest() — 2-char guard + grouped response
// ---------------------------------------------------------------------------

describe("SearchService.suggest()", () => {
  it("throws when q is shorter than 2 characters (D-16)", async () => {
    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: asClient(makeOpenSearchMock()),
    });

    await expect(service.suggest("a")).rejects.toThrow(/2.*char/i);
  });

  it("returns empty results when opensearch is null (graceful degradation)", async () => {
    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: null,
    });

    const result = await service.suggest("re");

    expect(result.products).toEqual([]);
    expect(result.categories).toEqual([]);
  });

  it("returns grouped products and categories from suggest query", async () => {
    const openSearchMock = makeOpenSearchMock({
      statusCode: 200,
      body: {
        hits: {
          hits: [
            {
              _index: "grovio-products-test",
              _id: "prod-1",
              _source: {
                name: "Red Widget",
                slug: "red-widget",
                categoryId: "cat-1",
                categoryName: "Widgets",
              },
            },
          ],
          total: { value: 1 },
        },
        aggregations: {},
      },
    });

    const service = new SearchService({
      db: makeDbMock([]) as never,
      redis: makeRedisMock() as never,
      env: makeEnv() as never,
      opensearch: asClient(openSearchMock),
    });

    const result = await service.suggest("re");

    // Should return grouped structure (D-16)
    expect(result).toHaveProperty("products");
    expect(result).toHaveProperty("categories");
  });
});

// ---------------------------------------------------------------------------
// SearchService.getFilterSchema() — Redis cache
// ---------------------------------------------------------------------------

describe("SearchService.getFilterSchema()", () => {
  it("returns cached value from Redis without hitting the DB (Redis hit)", async () => {
    const cachedSchema = [sampleFilterRow];
    const redis = makeRedisMock(JSON.stringify(cachedSchema));
    const db = makeDbMock([]); // DB mock should NOT be called

    const service = new SearchService({
      db: db as never,
      redis: redis as never,
      env: makeEnv() as never,
      opensearch: null,
    });

    const result = await service.getFilterSchema("cat-abc");

    // Redis get MUST have been called with the correct key
    expect(redis.get).toHaveBeenCalledWith("category_filter_schema:cat-abc");

    // DB select MUST NOT have been called (Redis hit short-circuits)
    expect(db.select).not.toHaveBeenCalled();

    // Result should be the cached data
    expect(result).toHaveLength(1);
    expect(result[0]?.fsd_id).toBe("fsd-1");
  });

  it("reads from DB on Redis miss and caches the result", async () => {
    const redis = makeRedisMock(null); // cache miss
    const db = makeDbMock([sampleFilterRow]);

    const service = new SearchService({
      db: db as never,
      redis: redis as never,
      env: makeEnv() as never,
      opensearch: null,
    });

    const result = await service.getFilterSchema("cat-abc");

    // DB MUST have been called on cache miss
    expect(db.select).toHaveBeenCalled();

    // Redis setex MUST have been called to cache the result
    expect(redis.setex).toHaveBeenCalledWith(
      "category_filter_schema:cat-abc",
      300,
      expect.any(String)
    );

    expect(result).toHaveLength(1);
  });
});
