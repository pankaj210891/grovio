---
phase: "01"
plan: "06"
status: complete
completed_at: 2026-05-29T16:34:48Z
---

# Plan 01-06 Summary: Feature-Flag Infrastructure

## What Was Built
- FeatureFlags Drizzle schema (feature_flags table) with uuid PK, key, value, description, isEnabled, metadata, timestamps
- FeatureFlagService: Redis-first read, DB fallback on miss, configurable TTL via FEATURE_FLAG_TTL_SECONDS env var
- GET /internal/flags and GET /internal/flags/:key routes registered on Fastify app
- FeatureFlagService registered in Awilix container as singleton
- env registered in Awilix container as asValue(env)

## Key Decisions
- Redis key pattern: "ff:" + flagKey
- Write path intentionally omitted — Phase 6 admin bolt-on
- isEnabled=false flags return null (treated as non-existent)
- FeatureFlagService uses PROXY injection mode — Awilix passes cradle proxy as constructor arg; deps resolved lazily via property access

## Test Coverage
- 10 unit tests in FeatureFlagService.test.ts — all written (could not run: Node 18 in shell, Vitest 4.x requires Node 22)
- Tests cover: Redis cache hit (no DB), Redis miss → DB read → cache set, nonexistent key, disabled flag, getAllFlags warms cache, invalidateFlag, invalidateAllFlags (with and without keys), post-invalidation re-read

## Migration Generation
- Schema file created; `pnpm db:generate` could not run (drizzle-kit 1.0.0-beta requires Node 22; shell has Node 18)
- Migration will be generated normally when run on Node 22

## Pre-existing Issues Fixed
- `packages/contracts/src/money/allocate.ts` — TS2532 "Object is possibly undefined" on `slices[i]` (fixed with null-coalescing)
- `apps/api/src/plugins/redis.ts` — TS2351 Redis no construct signatures (fixed: `import Redis from "ioredis"` → `import { Redis } from "ioredis"`)
- `apps/api/src/app.ts` — TS18046 `error` typed as unknown in setErrorHandler (fixed: added `FastifyError` type annotation)

## Files Created/Modified
- apps/api/src/db/schema/feature-flags.ts (new)
- apps/api/src/db/schema/index.ts (updated — added export)
- apps/api/src/modules/feature-flags/FeatureFlagService.ts (new)
- apps/api/src/modules/feature-flags/FeatureFlagService.test.ts (new)
- apps/api/src/modules/feature-flags/index.ts (new)
- apps/api/src/routes/feature-flags.ts (new)
- apps/api/src/container.ts (updated — env + featureFlagService registered)
- apps/api/src/app.ts (updated — featureFlagRoutes registered, FastifyError import)
- apps/api/src/plugins/redis.ts (pre-existing fix — named import)
- packages/contracts/src/money/allocate.ts (pre-existing fix — undefined guard)
