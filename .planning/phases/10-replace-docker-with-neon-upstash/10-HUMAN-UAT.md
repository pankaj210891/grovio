---
status: passed
phase: 10-replace-docker-with-neon-upstash
source: [10-VERIFICATION.md]
started: 2026-05-30T19:00:00Z
updated: 2026-05-31T12:15:00Z
---

## Current Test

[complete — all tests pass]

## Tests

### 1. Unit test suite execution (Node 22)
expected: Run `pnpm --filter @grovio/api test` on Node 22+ — all test files pass, exit code 0.
result: pass
reported: "Test Files 10 passed (10) — Tests 74 passed (74). Exit code 0."
severity: —

## Summary

total: 1
passed: 1
issues: 0
pending: 0
skipped: 0
blocked: 0

## Gaps

(none)

## Resolution (2026-05-31)

Root cause of the original failure: two issues.

1. **OXC tsconfig symlink bug** — Vite 8's OXC transformer resolves relative `extends`
   paths via the symlink path (not the real path). `packages/config/tsconfig.base.json`
   had `"extends": "../../tsconfig.base.json"` which resolved to
   `apps/api/node_modules/tsconfig.base.json` (non-existent) via the symlink path.
   Fixed by inlining the compilerOptions directly into `packages/config/tsconfig.base.json`.

2. **Missing test env vars** — `drizzle.ts` and `redis.ts` import `env` at module load
   time; without DATABASE_URL/REDIS_URL/JWT_SECRET set, ZodError is thrown during test
   collection. Fixed by adding `test.env` block to `apps/api/vitest.config.ts`.

3. **Stale test mocks** — 4 test assertions in CategoryService.test.ts and
   CategoryMetadataService.test.ts were written before final implementation details
   (JSON date serialisation, transaction wrapping, Zod 4 UUID strictness). All fixed.

Commit: 09431b9
