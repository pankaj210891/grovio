---
phase: "01"
plan: "03"
subsystem: api
tags: [fastify, awilix, drizzle-orm, ioredis, postgresql, redis, zod, env-config, di-container]

# Dependency graph
requires:
  - phase: "01-01"
    provides: "pnpm workspace, @grovio/config tsconfig.node.json, docker-compose postgres+redis"
  - phase: "01-02"
    provides: "@grovio/contracts — HealthCheckResponse, ApiError, ApiSuccess envelopes"
provides:
  - "apps/api Fastify 5 backend skeleton with Awilix DI, Drizzle ORM, Redis plugins"
  - "Zod-validated env config (DATABASE_URL, REDIS_URL, JWT_SECRET, FEATURE_FLAG_TTL_SECONDS)"
  - "GET /health route returning HealthCheckResponse from @grovio/contracts"
  - "404 and error handlers returning ApiError envelopes"
  - "buildApp() factory function for testable server construction"
  - "Drizzle Kit config + empty schema barrel ready for plan 01-06 FeatureFlags table"
  - "Awilix container (PROXY mode) with db/redis/logger registered as asValue()"
affects:
  - "01-06 (feature-flags — registers FeatureFlagService into container, adds schema to barrel)"
  - "02-x (auth routes — plugs JwtService into container, registers user/session routes)"
  - "All subsequent backend plans that add domain routes or DI registrations"

# Tech tracking
tech-stack:
  added:
    - fastify@5.8.x (HTTP server framework)
    - fastify-plugin@5.x (plugin encapsulation boundary control)
    - awilix@13.0.x (DI container, PROXY injection mode, no decorator metadata)
    - drizzle-orm@0.45.x + drizzle-orm/node-postgres (PostgreSQL ORM layer)
    - drizzle-kit@1.0.0-beta (migration generation via drizzle.config.ts)
    - pg@8.x + @types/pg (node-postgres Pool for Drizzle connection)
    - ioredis@5.11.x (Redis client with lazyConnect)
    - zod@4.4.x (env schema validation at startup)
    - tsx@4.x (TypeScript dev runner for pnpm dev script)
  patterns:
    - buildApp() factory pattern — accepts FastifyServerOptions for test overrides
    - Plugin registration order: drizzle → redis → awilix (enforced via fastify-plugin dependencies array)
    - Manual Awilix bootstrap (no @fastify/awilix) — createAppContainer() called after db/redis are decorated
    - FastifyInstance augmentation via declare module "fastify" in src/types/fastify.d.ts
    - Fail-fast env validation — envSchema.parse(process.env) throws at module load on any missing var
    - All error responses use ApiError envelope from @grovio/contracts

key-files:
  created:
    - apps/api/package.json (@grovio/api, all runtime deps, dev scripts)
    - apps/api/tsconfig.json (extends @grovio/config/tsconfig/node.json, rootDir src, outDir dist)
    - apps/api/.env.example (all vars documented with purpose, format, how-to-obtain)
    - apps/api/src/config/env.ts (Zod envSchema + typed Env export + env singleton)
    - apps/api/src/app.ts (buildApp() factory, plugin order, 404+error handlers)
    - apps/api/src/main.ts (server start + SIGINT/SIGTERM graceful shutdown)
    - apps/api/src/container.ts (createAppContainer() with InjectionMode.PROXY)
    - apps/api/src/plugins/drizzle.ts (pg Pool + drizzle(), decorates fastify.db)
    - apps/api/src/plugins/redis.ts (ioredis, decorates fastify.redis)
    - apps/api/src/plugins/awilix.ts (manual Awilix bootstrap, decorates fastify.diContainer)
    - apps/api/src/routes/health.ts (GET /health → HealthCheckResponse)
    - apps/api/src/types/fastify.d.ts (declare module augmentation for db/redis/diContainer)
    - apps/api/drizzle.config.ts (dialect postgresql, schema src/db/schema/index.ts)
    - apps/api/src/db/schema/index.ts (empty barrel for future schema additions)
  modified: []

key-decisions:
  - "Manual Awilix bootstrap used instead of @fastify/awilix — @fastify/awilix@4.x Fastify 5 compatibility unconfirmed; manual pattern is simpler and has zero extra dependencies"
  - "drizzle.config.ts excluded from tsconfig.json include/rootDir — drizzle-kit runs it via its own tsx invocation; including it would conflict with rootDir: src"
  - "fastify.decorate() augmented via declare module fastify — avoids any-casting in plugin and route code"
  - "pg.Pool imported as named import from pg — avoids default-import destructure pattern that can fail with strict ESM interop"
  - "setErrorHandler suppresses raw error.message in production (NODE_ENV=production) — mitigates T-03-01 information disclosure threat"
  - "JWT_SECRET min(32) enforced in envSchema — mitigates T-03-03 JWT signing weakness"

patterns-established:
  - "buildApp(opts?) factory: all tests pass opts:{logger:false} to silence test output; opts merged over defaults"
  - "Plugin dependency declaration: fastify-plugin name + dependencies array ensures Fastify enforces registration order"
  - "Empty schema barrel pattern: src/db/schema/index.ts starts empty; future plans add re-exports"
  - "ApiError envelope on all error paths: 404 handler and setErrorHandler both return {success:false, error:{code,message}}"

requirements-completed:
  - FND-04

# Metrics
duration: 8min
completed: "2026-05-29"
---

# Phase 01 Plan 03: Fastify Backend Skeleton Summary

**Fastify 5 API skeleton with Awilix PROXY DI container, Drizzle ORM + pg, ioredis, Zod env validation, and GET /health returning HealthCheckResponse from @grovio/contracts — the runtime anchor for all subsequent backend plans.**

## Performance

- **Duration:** 8 minutes
- **Started:** 2026-05-29T12:25:35Z
- **Completed:** 2026-05-29T12:33:35Z
- **Tasks:** 2 completed
- **Files created:** 14

## Accomplishments

- Established `apps/api` as a fully-typed pnpm workspace member with all runtime dependencies declared (fastify, awilix, drizzle-orm, ioredis, pg, zod, @grovio/contracts)
- Created Zod-validated env config (`envSchema`) that fails fast at startup for any missing or malformed variable; exports typed `Env` object consumed by all plugins
- Built `buildApp()` factory with deterministic plugin registration order (drizzle → redis → awilix) enforced via fastify-plugin dependency declarations
- Wired manual Awilix 13 PROXY-mode container that receives `db`, `redis`, and `logger` as infrastructure values; domain services plug in via subsequent plans
- Delivered `GET /health` route typed to `HealthCheckResponse` from `@grovio/contracts`; all error responses use `ApiError` envelope from contracts
- Created `drizzle.config.ts` pointing to empty schema barrel (`src/db/schema/index.ts`); plan 01-06 adds the first table definition

## Task Commits

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Package scaffold — package.json, tsconfig, env config | 2cf8164 | package.json, tsconfig.json, src/config/env.ts, .env.example |
| 2 | Fastify app factory — plugins, container, health route | 645a0cc | src/app.ts, src/main.ts, src/container.ts, src/plugins/*, src/routes/health.ts, drizzle.config.ts |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Manual Awilix bootstrap used instead of @fastify/awilix**
- **Found during:** Task 2
- **Issue:** `@fastify/awilix@4.x` compatibility with Fastify 5 could not be confirmed — npm registry was unreachable (SSL certificate error on this machine); plan itself anticipated this case and specified manual bootstrap as the fallback
- **Fix:** Removed `@fastify/awilix` from package.json; implemented manual bootstrap in `src/plugins/awilix.ts` using `createAppContainer()` called after drizzle + redis plugins are registered
- **Files modified:** `apps/api/package.json`, `apps/api/src/plugins/awilix.ts`
- **Commit:** 645a0cc

**2. [Rule 1 - Bug] drizzle.config.ts excluded from tsconfig include/rootDir**
- **Found during:** Task 2
- **Issue:** Plan specified `include: ["src/**/*", "drizzle.config.ts"]` with `rootDir: "src"`, but TypeScript rejects files outside rootDir in the include list — would cause tsc error
- **Fix:** Removed `drizzle.config.ts` from tsconfig.json include array; drizzle-kit uses its own tsx execution path and does not require the file to be in the main tsc compilation
- **Files modified:** `apps/api/tsconfig.json`
- **Commit:** 645a0cc (part of Task 2)

**3. [Rule 2 - Security] Production error message sanitization added**
- **Found during:** Task 2 (while implementing setErrorHandler)
- **Issue:** Threat model T-03-01 requires sanitized ApiError in production; the plan mentioned it in the threat register but did not explicitly code it in the setErrorHandler action description
- **Fix:** Added `isProd` check in `setErrorHandler` — returns generic message in production, raw message in development
- **Files modified:** `apps/api/src/app.ts`
- **Commit:** 645a0cc

## Verification Notes

`pnpm typecheck` cannot be run — pnpm is not installed on this system and node_modules are not installed (no `pnpm install` has been run yet). This matches the same note in the 01-02 SUMMARY. TypeScript correctness was verified by manual code review:

- All imports use `.js` extension (NodeNext ESM requirement)
- `fastify.d.ts` augments FastifyInstance with correct types for `db`, `redis`, `diContainer`
- Plugin dependency declarations (`fastify-plugin` name/dependencies) enforce correct registration order
- `env.ts` uses `envSchema.parse(process.env)` at module level — parse errors throw at startup
- `buildApp()` return type is `Promise<FastifyInstance>`

## Known Stubs

None — all implemented functionality is complete for its intended scope. The `src/db/schema/index.ts` barrel is intentionally empty pending plan 01-06 (FeatureFlags schema).

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-03-01: Stack traces in production | Mitigated — setErrorHandler returns generic message when NODE_ENV=production |
| T-03-02: Missing DATABASE_URL/REDIS_URL crashes | Accepted — Zod parse throws at startup; fail-fast is correct behavior |
| T-03-03: JWT_SECRET min-length | Mitigated — envSchema enforces JWT_SECRET.min(32); shorter secret rejected at startup |
| T-03-04: Health endpoint version info | Accepted — version info is not sensitive; standard operational tooling |
| T-03-SC: npm package legitimacy | All packages (fastify, awilix, drizzle-orm, ioredis, pg, zod, fastify-plugin) are in CLAUDE.md recommended stack |

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model.

## Self-Check: PASSED

Files verified present:
- apps/api/package.json — FOUND
- apps/api/tsconfig.json — FOUND
- apps/api/.env.example — FOUND
- apps/api/src/config/env.ts — FOUND
- apps/api/src/app.ts — FOUND
- apps/api/src/main.ts — FOUND
- apps/api/src/container.ts — FOUND
- apps/api/src/plugins/drizzle.ts — FOUND
- apps/api/src/plugins/redis.ts — FOUND
- apps/api/src/plugins/awilix.ts — FOUND
- apps/api/src/routes/health.ts — FOUND
- apps/api/src/types/fastify.d.ts — FOUND
- apps/api/drizzle.config.ts — FOUND
- apps/api/src/db/schema/index.ts — FOUND

Commits verified present: 2cf8164, 645a0cc — in git log.
