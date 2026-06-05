---
phase: 06-vendor-admin-tools
plan: "05"
subsystem: backend-services
tags: [tdd, redis-first, append-only, settings, audit, vitest, drizzle]
dependency_graph:
  requires:
    - apps/api/src/db/schema/marketplace-settings.ts (Plan 06-02 — key TEXT PK + JSONB value)
    - apps/api/src/db/schema/audit-log.ts (Plan 06-02 — append-only, JSONB before/after, no updatedAt)
    - apps/api/src/modules/feature-flags/FeatureFlagService.ts (Redis-first pattern analog)
    - packages/contracts/src/admin/audit.ts (AuditLogQuery, AuditLogEntry types)
  provides:
    - apps/api/src/modules/settings/SettingsService.ts (Redis-first marketplace settings read/write)
    - apps/api/src/modules/settings/index.ts (barrel export)
    - apps/api/src/modules/audit/AuditService.ts (append-only audit log writer + query)
    - apps/api/src/modules/audit/index.ts (barrel export)
  affects:
    - Plans 06-06+ (all Wave 5 admin/vendor services — audit on every mutation; settings for thresholds)
    - container.ts (will register settingsService + auditService in Wave 5)
tech_stack:
  added: []
  patterns:
    - Redis-first read (getSetting mirrors FeatureFlagService.getFlag pattern)
    - UPSERT + Redis.del invalidation after DB write (Pitfall 3 ordering, T-06-14)
    - Append-only INSERT (AuditService mirrors wallet-entries pattern, T-06-13)
    - TDD RED→GREEN cycle per task (2 RED commits + 2 GREEN commits)
    - Drizzle count() SQL aggregate for paginated total count
key_files:
  created:
    - apps/api/src/modules/settings/SettingsService.ts
    - apps/api/src/modules/settings/index.ts
    - apps/api/src/modules/settings/SettingsService.test.ts
    - apps/api/src/modules/audit/AuditService.ts
    - apps/api/src/modules/audit/index.ts
    - apps/api/src/modules/audit/AuditService.test.ts
  modified:
    - apps/api/__mocks__/drizzle-orm/index.js (added count() export — Rule 1 fix)
key-decisions:
  - "SettingsService reuses FEATURE_FLAG_TTL_SECONDS for settings cache TTL (D-19) — avoids a new env var"
  - "getAllSettings is uncached — low-frequency admin page access, simpler implementation"
  - "updateSetting calls Redis.del AFTER the DB UPSERT (Pitfall 3 ordering, T-06-14)"
  - "AuditService deps contains only db (no redis) — append-only writer never reads with caching"
  - "AuditService.query uses Promise.all([count query, data query]) for single-round-trip pagination"
  - "count() added to __mocks__/drizzle-orm/index.js — missing export caused test failures (Rule 1)"
requirements-completed: [ADM-05, ADM-07]
duration: ~7min
completed: "2026-06-04"
---

# Phase 6 Plan 05: SettingsService + AuditService Summary

**Redis-first marketplace settings service (mirrors FeatureFlagService) and append-only audit log writer — both TDD-covered with RED→GREEN commit pairs.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-04T16:26:34Z
- **Completed:** 2026-06-04T16:33:45Z
- **Tasks completed:** 2 of 2
- **Files created/modified:** 7

## Accomplishments

### Task 1: SettingsService (Redis-first marketplace settings)

Created `apps/api/src/modules/settings/SettingsService.ts` — a near-exact analog of `FeatureFlagService` adapted for `marketplace_settings`:

- `getSetting(key)`: Redis-first read; on cache hit returns without DB query; on miss reads DB, calls `setex` with `FEATURE_FLAG_TTL_SECONDS`, returns the JSONB value
- `getAllSettings()`: Direct DB read (no caching) returning all rows as `Record<string, unknown>` — used by admin settings page
- `updateSetting(key, value)`: UPSERT via `onConflictDoUpdate`, then `redis.del(redisKey)` — cache invalidation happens AFTER DB write (T-06-14 ordering)
- `invalidateSetting(key)`: `redis.del(redisKey)` for manual cache busting
- Redis key prefix: `"settings:"` (vs FeatureFlagService's `"ff:"`)

8 tests, all passing.

### Task 2: AuditService (append-only audit log writer)

Created `apps/api/src/modules/audit/AuditService.ts`:

- `log(params)`: `db.insert(auditLog).values({...})` — INSERT only, no UPDATE path; before/after default to null when omitted
- `query(filter)`: Filtered paginated read via `Promise.all([count query, data query])`; supports actorType, action, entityType, from, to filters; ordered by createdAt desc; returns `{ items, total, limit, offset }`
- Deps: `{ db }` only — no Redis (append-only writer, T-06-13)
- No update method — append-only invariant enforced at service layer

8 tests, all passing.

## Task Commits

TDD gates maintained — each task has RED (test) + GREEN (implementation) commits:

| # | Commit | Type | Description |
|---|--------|------|-------------|
| 1 | `55fd1f7` | test | Task 1 RED: add failing tests for SettingsService |
| 2 | `81f0ab0` | feat | Task 1 GREEN: implement SettingsService with Redis-first cache |
| 3 | `bb7d886` | test | Task 2 RED: add failing tests for AuditService |
| 4 | `2b6bfdf` | feat | Task 2 GREEN: implement AuditService + fix drizzle-orm mock |

## TDD Gate Compliance

- Task 1: `test(06-05)` RED commit (55fd1f7) → `feat(06-05)` GREEN commit (81f0ab0) — PASSED
- Task 2: `test(06-05)` RED commit (bb7d886) → `feat(06-05)` GREEN commit (2b6bfdf) — PASSED

## Files Created/Modified

- `apps/api/src/modules/settings/SettingsService.ts` — Redis-first settings read/write (D-19)
- `apps/api/src/modules/settings/index.ts` — barrel export
- `apps/api/src/modules/settings/SettingsService.test.ts` — 8 tests (cache hit/miss, UPSERT, getAllSettings, invalidate)
- `apps/api/src/modules/audit/AuditService.ts` — append-only insert + filtered paginated query
- `apps/api/src/modules/audit/index.ts` — barrel export
- `apps/api/src/modules/audit/AuditService.test.ts` — 8 tests (log, before/after null, query, no update method, deps)
- `apps/api/__mocks__/drizzle-orm/index.js` — added `count()` export (Rule 1 bug fix)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Missing `count` export in drizzle-orm mock**
- **Found during:** Task 2 GREEN phase — `count is not a function` error in AuditService.query tests
- **Issue:** `apps/api/__mocks__/drizzle-orm/index.js` did not export the `count` SQL aggregate function. AuditService uses `count()` from drizzle-orm for the total row count in `query()`. Without the export, `count` is `undefined` and `count()` throws.
- **Fix:** Added `export const count = (col) => ({ type: 'count', col: col ?? '*' })` to the mock
- **Files modified:** `apps/api/__mocks__/drizzle-orm/index.js`
- **Commit:** `2b6bfdf` (included in Task 2 GREEN commit)
- **Scope:** Directly caused by AuditService task's use of `count()` — correct scope per deviation Rule 1

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix — no scope creep. The mock now supports `count()` for any future service tests that use Drizzle aggregate functions.

## Verification

Final verification run:
```
pnpm --filter @grovio/api exec vitest run SettingsService AuditService
Test Files  2 passed (2)
     Tests  16 passed (16)
```

Acceptance criteria confirmed:
- SettingsService.ts redisKey returns prefix `settings:` ✓
- getSetting uses `setex` with `env.FEATURE_FLAG_TTL_SECONDS` ✓
- updateSetting calls `onConflictDoUpdate` then `redis.del` ✓
- On Redis cache hit, DB select is NOT invoked ✓
- AuditService.ts deps interface contains `db` and NOT `redis` ✓
- log() calls `insert(auditLog)` and never `update(` ✓
- query() supports actorType, action, entityType, from, to filters and returns `{ items, total, limit, offset }` ✓
- AuditService class exposes no method that issues an UPDATE ✓

## Known Stubs

None — SettingsService and AuditService are complete backend service implementations with no stubs, placeholders, or hardcoded values.

## Threat Flags

None — this plan creates service-layer modules only. No new network endpoints, auth paths, or file access patterns are introduced. Threat mitigations T-06-13 (append-only audit log) and T-06-14 (Redis invalidation after DB write) are implemented as designed.

---

## Self-Check: PASSED

Files exist:
- apps/api/src/modules/settings/SettingsService.ts ✓
- apps/api/src/modules/settings/index.ts ✓
- apps/api/src/modules/settings/SettingsService.test.ts ✓
- apps/api/src/modules/audit/AuditService.ts ✓
- apps/api/src/modules/audit/index.ts ✓
- apps/api/src/modules/audit/AuditService.test.ts ✓
- apps/api/__mocks__/drizzle-orm/index.js (contains count export) ✓

Commits exist:
- 55fd1f7 (Task 1 RED) ✓
- 81f0ab0 (Task 1 GREEN) ✓
- bb7d886 (Task 2 RED) ✓
- 2b6bfdf (Task 2 GREEN) ✓

Test run: 16/16 passing ✓
AuditService has no `.update(` call ✓
SettingsService redisKey prefix is `settings:` ✓
