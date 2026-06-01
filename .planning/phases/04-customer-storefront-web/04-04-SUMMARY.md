---
phase: 04-customer-storefront-web
plan: "04"
subsystem: api, homepage, customer-addresses
tags: [redis-cache, drizzle-orm, zod, tdd, homepage-blocks, customer-addresses, auth-isolation]

# Dependency graph
requires:
  - phase: 04-customer-storefront-web
    plan: "02"
    provides: "homepage_blocks + customer_addresses tables; HOMEPAGE_BLOCKS_TTL_SECONDS env var"
provides:
  - HomepageService: getBlocks() Redis-first read with MerchandisingBlockSchema validation, invalidateBlocks()
  - CustomerAddressService: listAddresses/createAddress/updateAddress/deleteAddress scoped by customerId
  - homepage/index.ts and customer-addresses/index.ts barrel exports
affects:
  - 04-05 (Wave 4 routes: GET /homepage uses HomepageService; /account/addresses uses CustomerAddressService)
  - 04-06 (app.ts registers homepageRoutes; container.ts registers homepageService + customerAddressService)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Redis-first read with MerchandisingBlockSchema.parse at read time (T-04-11 mitigation)
    - asc(homepageBlocks.sortOrder) for deterministic block ordering
    - setex with env.HOMEPAGE_BLOCKS_TTL_SECONDS (consistent with CATEGORY_TREE_TTL_SECONDS pattern)
    - and(eq(id), eq(customerId)) double-predicate for per-customer row scoping (T-04-10 mitigation)
    - No Redis cache for CustomerAddressService — address data is customer-specific, not shared
    - RFC 4122 strict UUIDs required in test data for Zod v4 z.string().uuid() validation

key-files:
  created:
    - apps/api/src/modules/homepage/HomepageService.ts
    - apps/api/src/modules/homepage/HomepageService.test.ts
    - apps/api/src/modules/homepage/index.ts
    - apps/api/src/modules/customer-addresses/CustomerAddressService.ts
    - apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts
    - apps/api/src/modules/customer-addresses/index.ts

key-decisions:
  - "HomepageService spreads row.payload into MerchandisingBlockSchema.parse with type discriminant — ensures correct sub-schema dispatch regardless of payload field ordering"
  - "CustomerAddressService uses and(eq(id), eq(customerId)) for all single-row ops — cross-customer attempts return null/false without revealing whether the address ID exists"
  - "Multiple isDefault=true addresses tolerated in Phase 4 — single-default enforcement deferred to Phase 5 checkout flow (documented in plan acceptance criteria)"
  - "RFC 4122 strict UUIDs required in test fixtures — Zod v4 z.string().uuid() enforces version and variant bits (catching cat-uuid-1 style test IDs)"

patterns-established:
  - "Pattern: HomepageService — exact FeatureFlagService Redis-first read shape; deps {db, redis, env}; cacheKey singleton; getBlocks+invalidateBlocks"
  - "Pattern: CustomerAddressService — CategoryService CRUD analog; deps {db} only (no Redis); and() double-predicate for AUTH-05 isolation"

requirements-completed: [STORE-01, AUTH-05]

# Metrics
duration: 15min
completed: "2026-06-01"
---

# Phase 4 Plan 04: HomepageService + CustomerAddressService Summary

**HomepageService (Redis-first block read with Zod validation, STORE-01) and CustomerAddressService (per-customer address CRUD with AUTH-05 isolation) built test-first (RED→GREEN)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-01T13:36:20Z
- **Completed:** 2026-06-01
- **Tasks:** 2 (each TDD: RED commit + GREEN commit)
- **Files created:** 6

## Accomplishments

- HomepageService implements Redis-first `getBlocks()` and `invalidateBlocks()`. Mirrors FeatureFlagService pattern exactly: `redis.get` → parse JSON on hit; DB `WHERE isActive=true ORDER BY sortOrder ASC` on miss → `MerchandisingBlockSchema.parse` per row → `redis.setex` with `env.HOMEPAGE_BLOCKS_TTL_SECONDS`.
- CustomerAddressService implements full CRUD: `listAddresses`, `createAddress`, `updateAddress`, `deleteAddress`. All single-row operations scope by BOTH `id` AND `customerId` via Drizzle `and()` — structural AUTH-05 isolation that makes cross-customer access return null/false.
- 8 HomepageService tests pass, 11 CustomerAddressService tests pass (19 total new tests). Full suite: 301 pass; pre-existing `product-index-job.test.ts` failure unchanged.

## Task Commits

| Task | Phase | Name | Commit | Files |
|------|-------|------|--------|-------|
| 1 | RED | HomepageService tests (failing) | ad535ed | HomepageService.test.ts |
| 1 | GREEN | HomepageService implementation | 4a23d28 | HomepageService.ts, index.ts, HomepageService.test.ts (UUID fix) |
| 2 | RED | CustomerAddressService tests (failing) | 068ff03 | CustomerAddressService.test.ts |
| 2 | GREEN | CustomerAddressService implementation | 3ad93f6 | CustomerAddressService.ts, index.ts |

## Files Created

- `apps/api/src/modules/homepage/HomepageService.ts` — Redis-first block read; getBlocks + invalidateBlocks; deps {db, redis, env}; MerchandisingBlockSchema.parse per JSONB row
- `apps/api/src/modules/homepage/HomepageService.test.ts` — 8 tests: cache hit, cache miss (DB query + setex + ordered + empty), malformed JSONB rejection, invalidateBlocks + re-read
- `apps/api/src/modules/homepage/index.ts` — barrel re-export of HomepageService
- `apps/api/src/modules/customer-addresses/CustomerAddressService.ts` — listAddresses/createAddress/updateAddress/deleteAddress; and(eq(id), eq(customerId)) isolation; no Redis cache
- `apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts` — 11 tests: list scoping, empty list, AUTH-05 cross-customer assertions for list/update/delete, create with correct customerId, update returns null for wrong customer, delete returns false for wrong customer
- `apps/api/src/modules/customer-addresses/index.ts` — barrel re-exports service class and input types

## Decisions Made

- `HomepageService` merges `{ ...row.payload, type: row.type }` before `MerchandisingBlockSchema.parse` — ensures the type discriminant is always present even if the JSONB payload was stored without it (defensive, no regression risk).
- `CustomerAddressService` uses no Redis cache — address data is per-customer and not a shared hot-path read; the latency cost of DB reads for address management is acceptable.
- Multiple `isDefault=true` addresses are permitted in Phase 4 — single-default enforcement is deferred to Phase 5 checkout flow as documented in the plan's acceptance criteria.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed test UUID data to pass Zod v4 strict UUID validation**
- **Found during:** Task 1 GREEN phase — first test run failed with ZodError on `categoryIds` in `lowOrderBlock`
- **Issue:** Test fixture UUIDs (`cat-uuid-1`, `block-uuid-1`, `00000000-0000-0000-0000-000000000101`) did not conform to RFC 4122 format. Zod v4 `z.string().uuid()` enforces version bits (`[1-8]` in third segment) and variant bits (`[89abAB]` in fourth segment), rejecting all placeholder IDs.
- **Fix:** Replaced all test fixture IDs with RFC 4122 compliant UUIDs (e.g., `a1b2c3d4-e5f6-4a1b-8c2d-111111111111`).
- **Files modified:** `apps/api/src/modules/homepage/HomepageService.test.ts`
- **Commit:** `4a23d28` (bundled with GREEN commit)

## TDD Gate Compliance

- **Task 1 RED gate:** commit `ad535ed` — `test(04-04): add failing HomepageService tests (RED)` — 8 tests, all failing (module not found)
- **Task 1 GREEN gate:** commit `4a23d28` — `feat(04-04): implement HomepageService with Redis-first block read (GREEN)` — 8 tests, all passing
- **Task 2 RED gate:** commit `068ff03` — `test(04-04): add failing CustomerAddressService tests (RED)` — 11 tests, all failing (module not found)
- **Task 2 GREEN gate:** commit `3ad93f6` — `feat(04-04): implement CustomerAddressService with per-customer isolation (GREEN)` — 11 tests, all passing
- No REFACTOR needed — implementations are clean.

## Known Stubs

None — both services are fully implemented with real logic.

## Threat Surface Scan

No new security surface beyond what is documented in the plan's threat model.

- T-04-10 mitigated: `and(eq(id), eq(customerId))` in updateAddress and deleteAddress makes cross-customer access structurally impossible; returning null/false avoids ID disclosure.
- T-04-11 mitigated: `MerchandisingBlockSchema.parse({ ...payload, type })` rejects malformed/unknown block types at read time before they reach any response.
- T-04-12 accepted: Redis cache with configurable TTL absorbs repeated homepage reads.

## Self-Check: PASSED

Files exist:
- apps/api/src/modules/homepage/HomepageService.ts — FOUND
- apps/api/src/modules/homepage/HomepageService.test.ts — FOUND
- apps/api/src/modules/homepage/index.ts — FOUND
- apps/api/src/modules/customer-addresses/CustomerAddressService.ts — FOUND
- apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts — FOUND
- apps/api/src/modules/customer-addresses/index.ts — FOUND

Commits exist: ad535ed, 4a23d28, 068ff03, 3ad93f6 — all FOUND

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
