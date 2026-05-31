---
phase: 03-catalog-search
plan: "06"
subsystem: search-infrastructure
tags: [opensearch, bullmq, search, async-indexing, fastify-plugin, redis-cache, tdd]
dependency_graph:
  requires:
    - "03-01 (SearchResponse/SuggestResponse/FacetSchema contracts)"
    - "03-03 (products, attribute_definitions, filter_schema_definitions schema)"
    - "03-04 (FilterSchemaService Redis cache invalidation — category_filter_schema key)"
  provides:
    - "apps/api/src/plugins/opensearch.ts — fastify.opensearch decoration (Client | null)"
    - "apps/api/src/modules/search/opensearch-mapping.ts — getIndexName(), PRODUCT_INDEX_MAPPING, ensureIndex()"
    - "apps/api/src/modules/jobs/queues.ts — productIndexQueue + bullMqConnection (maxRetriesPerRequest:null)"
    - "apps/api/src/modules/jobs/product-index-job.ts — processProductIndexJob + buildSearchDocument (is_searchable projection)"
    - "apps/api/src/modules/jobs/workers.ts — startProductIndexWorker (concurrency:3)"
    - "apps/api/src/modules/jobs/index.ts — jobs module barrel"
    - "apps/api/src/modules/search/SearchService.ts — search/suggest/getFilterSchema with post_filter + caching"
    - "apps/api/src/modules/search/index.ts — search module barrel"
  affects:
    - "apps/api/src/types/fastify.d.ts (FastifyInstance.opensearch typed)"
    - "Plan 03-07 (routes register OpenSearch plugin + start worker after listen)"
tech_stack:
  added:
    - "@opensearch-project/opensearch 3.6.x — Client, index management, search queries"
    - "bullmq 5.77.x — Queue, Worker for async product indexing"
  patterns:
    - "fastify-plugin fp() for optional OpenSearch decoration — null when OPENSEARCH_URL unset"
    - "BullMQ dedicated connection config object (not Redis instance) to avoid ioredis version type mismatch"
    - "maxRetriesPerRequest:null on BullMQ connection — prevents MaxRetriesPerRequestError on blocking commands (Pitfall 1)"
    - "buildSearchDocument() pure function — projects only is_searchable attr keys, never spreads raw JSONB (D-15, Anti-Pattern 6, SRCH-04)"
    - "post_filter in search query — aggregation counts remain accurate when filter applied (SRCH-02/SRCH-03)"
    - "search_as_you_type on name+categoryName — type-ahead suggestions (D-16, SRCH-01)"
    - "dynamic:false on attributes mapping object — prevents field explosion (Anti-Pattern 6, Pitfall 2)"
    - "Redis category_filter_schema:{categoryId} key — matches FilterSchemaService invalidation (Pitfall 6)"
    - "TDD RED/GREEN for both product-index-job.ts and SearchService.ts"
key_files:
  created:
    - apps/api/src/plugins/opensearch.ts
    - apps/api/src/modules/search/opensearch-mapping.ts
    - apps/api/src/modules/jobs/queues.ts
    - apps/api/src/modules/jobs/workers.ts
    - apps/api/src/modules/jobs/product-index-job.ts
    - apps/api/src/modules/jobs/product-index-job.test.ts
    - apps/api/src/modules/jobs/index.ts
    - apps/api/src/modules/search/SearchService.ts
    - apps/api/src/modules/search/SearchService.test.ts
    - apps/api/src/modules/search/index.ts
  modified:
    - apps/api/src/types/fastify.d.ts
decisions:
  - "BullMQ connection: pass RedisOptions config object instead of Redis instance to avoid ioredis@5.10.1/5.11.0 TypeScript type incompatibility"
  - "ensureIndex() uses statusCode === 200 check (OpenSearch JS client v3 response shape)"
  - "suggest() builds grouped products+categories from search hits (D-16) — categoryName field drives category deduplication"
  - "search() returns unavailable:true flag on graceful degradation rather than throwing (T-03-J5)"
  - "getFilterSchema() returns raw DB row shape to avoid double mapping overhead in search()"
metrics:
  duration: "~12 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_created: 10
  files_modified: 1
---

# Phase 3 Plan 06: OpenSearch Plugin + BullMQ Indexing + SearchService Summary

**One-liner:** OpenSearch Fastify plugin with optional boot, BullMQ product-index queue with dedicated maxRetriesPerRequest:null connection (Pitfall 1), ProductIndexJob with is_searchable attribute projection (D-15, SRCH-04), and SearchService with post_filter faceting, 2-char-minimum type-ahead suggestions, and Redis-cached filter schema.

## What Was Built

Three tasks executed atomically with TDD on Tasks 2 and 3:

**Task 1 — OpenSearch Fastify plugin + index mapping** (feat commit 3a0b7d1)
- `plugins/opensearch.ts`: `fp()` plugin that decorates `fastify.opensearch` with `null` when `OPENSEARCH_URL` is unset (API boots without OpenSearch), or a `Client` instance with `onClose` hook when URL is set. Named "opensearch" for Fastify's dependency graph.
- `modules/search/opensearch-mapping.ts`: `getIndexName(env)` returns `grovio-products-${env.NODE_ENV}` (isolated per environment); `PRODUCT_INDEX_MAPPING` with `search_as_you_type` on `name` and `categoryName` (D-16, SRCH-01) and `dynamic: false` on the `attributes` object (Anti-Pattern 6, Pitfall 2); `ensureIndex(client, env)` creates index idempotently.
- `types/fastify.d.ts`: Extended `FastifyInstance` with `opensearch: Client | null`.

**Task 2 — BullMQ queue + worker + ProductIndexJob processor** (TDD: RED ed013f8, GREEN 6e30ce1)
- `modules/jobs/queues.ts`: `bullMqConnection` config object with `maxRetriesPerRequest: null` (Pitfall 1 — MUST NOT reuse `fastify.redis`); passes URL as string in `RedisOptions` to avoid ioredis 5.10.1/5.11.0 TypeScript type mismatch; `productIndexQueue` on "product-index-queue".
- `modules/jobs/product-index-job.ts`: `buildSearchDocument(product, searchableAttrKeys)` pure function projects ONLY the `is_searchable=true` attribute keys — never spreads raw JSONB keys (D-15, Anti-Pattern 6, SRCH-04); `processProductIndexJob(job, deps)` handles `action:'delete'` (calls `opensearch.delete`, tolerates 404) and `action:'index'` (LEFT JOIN query for product + category + isSearchable=true attr defs, upserts to NODE_ENV-scoped index).
- `modules/jobs/workers.ts`: `startProductIndexWorker(deps)` creates `new Worker("product-index-queue", ..., { connection: bullMqConnection, concurrency: 3 })` with failed-event logging.
- `modules/jobs/index.ts`: barrel re-export.
- 9 tests: buildSearchDocument excludes non-searchable keys; processProductIndexJob delete calls opensearch.delete; index uses NODE_ENV-scoped name; attributes exclude non-searchable keys.

**Task 3 — SearchService + barrel** (TDD: RED 975466b, GREEN d5c9f26)
- `modules/search/SearchService.ts`: `isAvailable()` checks opensearch dep; `search()` builds multi_match query with category filter, aggregations from filter schema, and `post_filter` when `appliedFilters.length > 0` (SRCH-02/SRCH-03); `suggest()` rejects q shorter than 2 chars (D-16), queries `search_as_you_type` fields on name+categoryName, returns grouped `{ products, categories }` (D-16); `getFilterSchema()` Redis read-through under `category_filter_schema:{categoryId}` key with `FILTER_SCHEMA_TTL_SECONDS` TTL (matches FilterSchemaService invalidation — Pitfall 6); both search/suggest degrade gracefully to empty results when opensearch is null (T-03-J5).
- `modules/search/index.ts`: barrel re-exporting SearchService and opensearch-mapping.
- 11 tests: isAvailable() false/true; search() post_filter present/absent; search() agg → facet mapping; suggest() 2-char guard; suggest() graceful degradation; getFilterSchema() Redis hit short-circuits DB; Redis miss caches result.

## Verification

- `pnpm --filter @grovio/api test -- --run src/modules/jobs src/modules/search`: **2 test files, 20 tests, all PASS**
- `pnpm --filter @grovio/api typecheck`: **exits 0**
- mapping-ok node check: **PASS** (search_as_you_type + dynamic + false present)
- maxRetriesPerRequest in queues.ts: **FOUND** (3 occurrences)
- isSearchable in product-index-job.ts: **FOUND**
- post_filter in SearchService.ts: **FOUND**
- category_filter_schema in SearchService.ts: **FOUND**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] ioredis version type mismatch: pass RedisOptions object instead of Redis instance to BullMQ**
- **Found during:** Task 2 typecheck
- **Issue:** BullMQ 5.77.6 bundles ioredis@5.10.1 internally. Our project uses ioredis@5.11.0. TypeScript's `exactOptionalPropertyTypes: true` makes the two `Redis` class types structurally incompatible — passing our ioredis@5.11.0 `Redis` instance to BullMQ's `ConnectionOptions` (which expects ioredis@5.10.1 `Redis`) causes TS2322.
- **Fix:** Changed `queues.ts` to export `bullMqConnection` as a `RedisOptions` config object (with `url`, `maxRetriesPerRequest: null`, `enableReadyCheck: false`, TLS options) instead of a `Redis` instance. BullMQ accepts `RedisOptions` per its `ConnectionOptions` union type. The critical `maxRetriesPerRequest: null` requirement (Pitfall 1) is preserved.
- **Files modified:** `apps/api/src/modules/jobs/queues.ts`, `apps/api/src/modules/jobs/workers.ts`
- **Commit:** 6e30ce1

**2. [Rule 1 - Bug] OpenSearch mock in tests needed type cast to avoid 80+ property mismatch**
- **Found during:** Task 2 typecheck
- **Issue:** `makeOpenSearchMock()` returns an object with only `index` and `delete` vi.fn() stubs. TypeScript's structural check requires all ~80 Client properties when assigning to `Client` type. TS2740 error.
- **Fix:** Added `interface OpenSearchMock { index: Mock; delete: Mock }` and an `asClient(mock)` helper that casts `unknown as OpenSearchClient` — used only at call sites to `processProductIndexJob`. Same pattern applied in SearchService.test.ts.
- **Files modified:** `apps/api/src/modules/jobs/product-index-job.test.ts`, `apps/api/src/modules/search/SearchService.test.ts`
- **Commit:** 6e30ce1

## Threat Surface Scan

New network/auth surfaces introduced by this plan:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: outbound_connection | apps/api/src/plugins/opensearch.ts | New outbound HTTP connection to OpenSearch cluster on startup |
| threat_flag: outbound_connection | apps/api/src/modules/jobs/queues.ts | New dedicated Redis connection (separate from fastify.redis) |

**Threat register mitigations applied:**
- T-03-J1 (Tampering — OpenSearch query injection): q passed into structured `multi_match.query` value only — never into raw query-string DSL (SearchService.ts line ~130).
- T-03-J2 (Information Disclosure — index document attributes): only `is_searchable=true` attributes projected by `buildSearchDocument()` (D-15); `dynamic: false` on attributes mapping object prevents arbitrary key indexing (Anti-Pattern 6).
- T-03-J3 (Information Disclosure — non-approved products): index job only called on approval trigger (ProductService, plan 03-05); delete action removes on revert (D-13, Pitfall 7).
- T-03-J4 (Denial of Service — BullMQ worker crash): dedicated connection with `maxRetriesPerRequest: null` prevents MaxRetriesPerRequestError on blocking commands (Pitfall 1).
- T-03-J5 (Denial of Service — OpenSearch unavailable): `SearchService.isAvailable()` + graceful empty result instead of unhandled errors.

## Known Stubs

None. All functions are fully implemented:
- `nextCursor` in `SearchResult` is always `null` — cursor-based pagination for search is a plan 03-07 route concern, not a SearchService stub.

## TDD Gate Compliance

Task 2 (product-index-job):
- RED commit: `ed013f8 test(03-06): add failing tests for ProductIndexJob processor (RED)`
- GREEN commit: `6e30ce1 feat(03-06): BullMQ queue + worker + ProductIndexJob processor (GREEN)`

Task 3 (SearchService):
- RED commit: `975466b test(03-06): add failing tests for SearchService (RED)`
- GREEN commit: `d5c9f26 feat(03-06): SearchService with post_filter faceting, suggest, cached filter schema (GREEN)`

Both RED/GREEN gates present. REFACTOR step not needed (code is clean).

## Self-Check

### Created files exist:
- apps/api/src/plugins/opensearch.ts — FOUND (3a0b7d1)
- apps/api/src/modules/search/opensearch-mapping.ts — FOUND (3a0b7d1)
- apps/api/src/modules/jobs/queues.ts — FOUND (6e30ce1)
- apps/api/src/modules/jobs/workers.ts — FOUND (6e30ce1)
- apps/api/src/modules/jobs/product-index-job.ts — FOUND (6e30ce1)
- apps/api/src/modules/jobs/product-index-job.test.ts — FOUND (ed013f8, updated 6e30ce1)
- apps/api/src/modules/jobs/index.ts — FOUND (6e30ce1)
- apps/api/src/modules/search/SearchService.ts — FOUND (d5c9f26)
- apps/api/src/modules/search/SearchService.test.ts — FOUND (975466b)
- apps/api/src/modules/search/index.ts — FOUND (d5c9f26)

### Modified files have expected content:
- fastify.d.ts contains opensearch: Client | null — FOUND
- opensearch-mapping.ts contains search_as_you_type — FOUND (mapping-ok check)
- opensearch-mapping.ts contains dynamic:false — FOUND
- queues.ts contains maxRetriesPerRequest:null — FOUND (3 occurrences)
- product-index-job.ts contains isSearchable — FOUND
- SearchService.ts contains post_filter — FOUND
- SearchService.ts contains category_filter_schema — FOUND

### Commits exist:
- 3a0b7d1: feat(03-06): OpenSearch Fastify plugin + index mapping module — FOUND
- ed013f8: test(03-06): add failing tests for ProductIndexJob processor (RED) — FOUND
- 6e30ce1: feat(03-06): BullMQ queue + worker + ProductIndexJob processor (GREEN) — FOUND
- 975466b: test(03-06): add failing tests for SearchService (RED) — FOUND
- d5c9f26: feat(03-06): SearchService with post_filter faceting, suggest, cached filter schema (GREEN) — FOUND

### Test results:
- 20 tests across 2 test files — ALL PASS
- pnpm --filter @grovio/api typecheck — exit 0
- mapping-ok check — PASS

## Self-Check: PASSED
