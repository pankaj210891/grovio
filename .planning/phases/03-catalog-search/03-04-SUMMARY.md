---
phase: 03-catalog-search
plan: "04"
subsystem: database
tags: [drizzle, migration, postgresql, redis, attribute-definitions, filter-schema, catalog]
dependency_graph:
  requires:
    - "03-03 (vendors, products, product_variants, product_images schema + is_variant column)"
    - "03-01 (ProductStatusSchema values — productStatusEnum matches 4 values)"
  provides:
    - "Live DB: vendors, products, product_variants, product_images tables created in Neon"
    - "Live DB: product_status pgEnum applied"
    - "Live DB: GIN index on products.attributes for JSONB filtering"
    - "Live DB: is_variant column on attribute_definitions"
    - "Live DB: deferred vendor FK (vcr_vendor_id_fk) on vendor_category_restrictions"
    - "AttributeDefinitionService: is_variant/is_filterable mutual exclusivity guard on create + merged update"
    - "FilterSchemaService: redis dep + write-through cache invalidation on all mutations"
  affects:
    - "Plan 03-05 (ProductService, VendorAuthService — tables must exist before service code)"
    - "Plan 03-06 (SearchService reads category_filter_schema Redis key invalidated here)"
    - "Plan 03-07 (routes for vendor products, admin products — attributes/filter services updated)"
tech_stack:
  added: []
  patterns:
    - "Merged-value guard: updateAttribute loads current row, merges partial, then validates (Pitfall 5)"
    - "Write-through cache invalidation: FilterSchemaService.invalidateFilterCache calls redis.del after every mutation"
    - "Redis key convention: category_filter_schema:{categoryId} — matches SearchService cache read (plan 03-06)"
    - "Deferred FK: manually append ALTER TABLE after drizzle-kit generate when referenced table is in same migration"
    - "Migration cleanup: remove pre-existing tables from generated SQL before applying"
key_files:
  created:
    - apps/api/src/db/migrations/20260531164431_right_juggernaut/migration.sql
    - apps/api/src/db/migrations/20260531164431_right_juggernaut/snapshot.json
  modified:
    - apps/api/src/modules/attribute-definitions/AttributeDefinitionService.ts
    - apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts
    - apps/api/src/modules/filter-schema/FilterSchemaService.ts
    - apps/api/src/modules/filter-schema/FilterSchemaService.test.ts
key-decisions:
  - "feature_flags CREATE TABLE removed from generated migration SQL — Phase 1 created this table; not in Phase 2 drizzle snapshot; re-generating would error on existing table"
  - "Deferred vendor FK (D-18) appended manually after vendors CREATE TABLE in migration SQL — Drizzle ORM doesn't generate it because vendor_category_restrictions.vendor_id has no .references() in Phase 2 schema"
  - "removeFilterEntry loads entry first to get categoryId for cache invalidation — categoryId not available from delete result alone"
  - "reorderFilterEntries parameter renamed from _categoryId to categoryId — needed for cache invalidation; previously unused"
requirements-completed: [PROD-03, PROD-04, SRCH-02, SRCH-04]
duration: 18min
completed: "2026-05-31"
---

# Phase 3 Plan 04: DB Migration + Service Guards Summary

**Phase 3 tables applied to live Neon DB (vendors/products/product_variants/product_images + GIN index + deferred vendor FK), is_variant/is_filterable mutual-exclusivity guard added to AttributeDefinitionService, and Redis cache invalidation wired into FilterSchemaService.**

## Performance

- **Duration:** ~18 minutes
- **Started:** 2026-05-31T16:32:00Z
- **Completed:** 2026-05-31T16:50:00Z
- **Tasks:** 3
- **Files modified:** 5 (2 services + 2 tests + 1 migration)

## Accomplishments

- All Phase 3 database tables (vendors, products, product_variants, product_images) created in the live Neon PostgreSQL database via drizzle-kit migration
- GIN index on `products.attributes` applied for efficient JSONB filter queries (PROD-03)
- Deferred vendor FK constraint (D-18) applied: `vendor_category_restrictions.vendor_id → vendors.id`
- is_variant/is_filterable mutual exclusivity enforced at service layer in both `createAttribute` (resolved values) and `updateAttribute` (merged values) — closes the D-02/Pitfall 5 gap
- Redis cache invalidation wired into all FilterSchemaService mutations (`replaceFilterSchema`, `upsertFilterEntry`, `removeFilterEntry`, `reorderFilterEntries`) using the `category_filter_schema:{categoryId}` key that plan 03-06 SearchService will read

## Task Commits

Each task was committed atomically:

1. **Task 1: is_variant/is_filterable mutual-exclusivity guard** - `d88559b` (feat)
2. **Task 2: Redis cache invalidation in FilterSchemaService** - `2425e50` (feat)
3. **Task 3: [BLOCKING] Generate + apply Phase 3 migration** - `c5a2eda` (feat)

## Files Created/Modified

- `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.ts` — Added `isVariant?: boolean` to `UpdateAttributeInput`; added `validateVariantExclusivity` private helper; `createAttribute` resolves and validates variant/filterable flags before insert; `updateAttribute` loads current row, merges flags, validates
- `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts` — Added `makeUpdateDbMock` helper; added `variantAttr`/`filterableAttr` fixtures; added 7 new tests covering exclusivity rejection and allowed single-flag cases
- `apps/api/src/modules/filter-schema/FilterSchemaService.ts` — Added `redis: Redis` to deps interface; added `invalidateFilterCache` private method; all mutations call invalidation; `removeFilterEntry` loads entry before delete; `reorderFilterEntries` renamed `_categoryId` to `categoryId`
- `apps/api/src/modules/filter-schema/FilterSchemaService.test.ts` — Added `makeRedisMock()` factory; added `makeRemoveEntryDbMock`; all service instantiations pass redis; 4 new tests assert redis.del called with correct key
- `apps/api/src/db/migrations/20260531164431_right_juggernaut/migration.sql` — Phase 3 migration: productStatusEnum, vendors, products (GIN index), product_variants, product_images, is_variant column on attribute_definitions, deferred vcr_vendor_id_fk

## Decisions Made

- **feature_flags removed from generated migration:** drizzle-kit's generate command included `CREATE TABLE "feature_flags"` because the Phase 2 snapshot didn't track it (Phase 1 migration created it outside drizzle-kit's snapshot chain). Removed from the migration before applying to avoid "relation already exists" error against the live DB.
- **Deferred FK appended manually (D-18):** The `vendor_category_restrictions.vendor_id` column has no `.references()` in the Drizzle schema (intentionally deferred from Phase 2 to avoid circular FK ordering). Appended `ALTER TABLE ... ADD CONSTRAINT vcr_vendor_id_fk` after the `vendors` CREATE TABLE statement to ensure FK ordering is correct.
- **removeFilterEntry: load-before-delete pattern:** The `delete().returning()` chain returns the deleted row but the categoryId needs to come from the pre-delete load. If the entry doesn't exist, no invalidation happens (correct behavior).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] pnpm install required in worktree before tests could run**
- **Found during:** Task 1
- **Issue:** The git worktree was created from a base commit (d8447e34) that was ahead of the worktree's existing HEAD (ef2b59f). After `git reset --hard` to align with the base, node_modules were absent in the worktree.
- **Fix:** Ran `pnpm install --frozen-lockfile` in the worktree root to install dependencies. Also built `@grovio/contracts` (no `dist/` in worktree) before running `pnpm build` for Task 3 verification.
- **Files modified:** pnpm generated node_modules (not committed)
- **Commit:** n/a (infrastructure fix, not code change)

**2. [Rule 1 - Bug] feature_flags table in generated migration removed**
- **Found during:** Task 3
- **Issue:** drizzle-kit generate included `CREATE TABLE "feature_flags"` in the new migration because the Phase 2 snapshot didn't know about it. Applying this to Neon would fail with "relation already exists".
- **Fix:** Removed the `CREATE TABLE "feature_flags"` block from the generated migration SQL before applying.
- **Files modified:** `apps/api/src/db/migrations/20260531164431_right_juggernaut/migration.sql`
- **Commit:** c5a2eda

No other deviations — plan executed as specified.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced.

Threat register mitigations applied per plan:
- T-03-G1 (Tampering — is_variant/is_filterable): Mutual exclusivity guard enforced in `AttributeDefinitionService.validateVariantExclusivity()` — called in both `createAttribute` (resolved values) and `updateAttribute` (merged values). Prevents an attribute being both a variant axis and a filter facet.
- T-03-G2 (Information Disclosure — category_filter_schema cache): Write-through invalidation wired into all `FilterSchemaService` mutations. Stale/removed facets cannot be served after any schema change.
- T-03-G3 (Tampering — vendor_category_restrictions.vendor_id): Deferred FK (D-18) applied — restriction rows cannot reference non-existent vendors.
- T-03-G4 (Denial of Service — db:migrate against live Neon): Migration is additive (CREATE/ALTER, no destructive drops). Applied successfully to Neon during planned window.

## Known Stubs

None. This plan contains pure service logic and database migration — no UI components, no hardcoded placeholder values.

## Self-Check

### Created files exist:
- apps/api/src/db/migrations/20260531164431_right_juggernaut/migration.sql — FOUND
- apps/api/src/db/migrations/20260531164431_right_juggernaut/snapshot.json — FOUND

### Modified files have expected content:
- AttributeDefinitionService.ts contains validateVariantExclusivity — FOUND
- AttributeDefinitionService.ts contains isVariant in updateAttribute — FOUND
- FilterSchemaService.ts contains redis in deps interface — FOUND
- FilterSchemaService.ts contains category_filter_schema — FOUND
- migration.sql contains CREATE TABLE "vendors" — FOUND
- migration.sql contains CREATE TABLE "products" — FOUND
- migration.sql contains CREATE TABLE "product_variants" — FOUND
- migration.sql contains CREATE TABLE "product_images" — FOUND
- migration.sql contains vcr_vendor_id_fk — FOUND
- migration.sql contains gin — FOUND (GIN index)

### Commits exist:
- d88559b: feat(03-04): add is_variant/is_filterable mutual-exclusivity guard to AttributeDefinitionService — FOUND
- 2425e50: feat(03-04): add Redis cache invalidation to FilterSchemaService — FOUND
- c5a2eda: feat(03-04): [BLOCKING] generate and apply Phase 3 DB migration — FOUND

### Test results:
- pnpm --filter @grovio/api test -- --run src/modules/attribute-definitions src/modules/filter-schema: 2 test files, 23 tests — PASS
- pnpm --filter @grovio/api build: exit 0 — PASS
- migration-sql-ok verification: all 6 required strings found — PASS

## Self-Check: PASSED
