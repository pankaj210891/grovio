---
phase: 10-replace-docker-with-neon-upstash
verified: 2026-05-30T19:00:00Z
status: human_needed
score: 11/11 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Run pnpm --filter @grovio/api test on Node 22 and confirm both test suites pass"
    expected: "All 10 vitest tests pass (5 in drizzle.test.ts, 5 in redis.test.ts) — vitest exits 0"
    why_human: "Plan 01 SUMMARY explicitly documents a Node 18 constraint in the worktree that prevented automated test execution. The test logic and helper implementations are correct by code inspection, but the test suite run result was never machine-verified in this environment."
---

# Phase 10: Replace Docker with Neon/Upstash Verification Report

**Phase Goal:** Replace local Docker services with managed cloud equivalents — Neon (Postgres), Upstash (Redis), Bonsai (OpenSearch) — so the project has zero Docker dependency and a buyer can connect to free cloud tiers immediately after cloning
**Verified:** 2026-05-30T19:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | Backend connects to Neon over TLS automatically when DATABASE_URL targets Neon, and to local Postgres without TLS | VERIFIED | `requiresSsl()` exported from `drizzle.ts`; plugin body calls `requiresSsl(env.DATABASE_URL)` and spreads `ssl: true` conditionally via `...(ssl ? { ssl: true } : {})` |
| 2 | Backend connects to Upstash over TLS automatically when REDIS_URL uses the rediss:// scheme | VERIFIED | `detectRedisTls()` exported from `redis.ts`; plugin body calls `detectRedisTls(env.REDIS_URL)` and spreads `tls: {}` conditionally via `...(isTls ? { tls: {} } : {})` |
| 3 | drizzle-kit migrations run against a direct (non-pooled) Neon URL when DATABASE_DIRECT_URL is set | VERIFIED | `drizzle.config.ts` line 26: `url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!` |
| 4 | env validation accepts DATABASE_DIRECT_URL and OPENSEARCH_URL as optional URLs | VERIFIED | `env.ts` lines 43 and 70: `DATABASE_DIRECT_URL: z.string().url().optional()` and `OPENSEARCH_URL: z.string().url().optional()` |
| 5 | Both .env.example files document Neon pooled DATABASE_URL, Neon direct DATABASE_DIRECT_URL, Upstash rediss:// REDIS_URL, and Bonsai https OPENSEARCH_URL with placeholder-only values | VERIFIED | Root `.env.example` contains `ep-cool-name-123456-pooler.neon.tech`, `DATABASE_DIRECT_URL=`, `rediss://`, and `bonsai.io`. `apps/api/.env.example` contains all four variables in cloud formats. Zero docker-compose references in either file. |
| 6 | No .env.example comment references docker-compose | VERIFIED | `grep -c "docker-compose" .env.example apps/api/.env.example` returns `0` in each file |
| 7 | CI injects DATABASE_URL, DATABASE_DIRECT_URL, REDIS_URL, OPENSEARCH_URL from GitHub Actions repository secrets | VERIFIED | `.github/workflows/ci.yml` top-level `env:` block contains all four `${{ secrets.* }}` mappings; no CI step echoes any secret |
| 8 | docker-compose.yml no longer exists | VERIFIED | `test -f docker-compose.yml` returns ABSENT; commit `738026a` deleted it |
| 9 | The project README has a self-contained Infrastructure Setup section covering Neon, Upstash, and Bonsai signup and the exact env var each produces | VERIFIED | `README.md` (164 lines) contains heading "Infrastructure Setup"; references `neon.com`, `upstash.com`, `bonsai.io`; documents all four env vars; no docker-compose substring; includes `number_of_replicas: 0` Bonsai note and Upstash Fixed-plan note |
| 10 | No buyer-facing markdown doc references docker-compose | VERIFIED | `grep -rn "docker-compose" --include="*.md" . \| grep -v '.planning/' \| grep -v node_modules` returns zero matches |
| 11 | ROADMAP.md Phase 1 plan 01-01 description no longer mentions docker-compose infra | VERIFIED | ROADMAP.md line 45: `cloud infra setup (Neon/Upstash/Bonsai)` — no `docker-compose infra` substring present |

**Score:** 11/11 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/api/src/plugins/drizzle.ts` | requiresSsl() named export + conditional ssl on pg.Pool | VERIFIED | Contains `export function requiresSsl(`, conditional `...(ssl ? { ssl: true } : {})` — no unconditional ssl |
| `apps/api/src/plugins/drizzle.test.ts` | Unit tests for requiresSsl() | VERIFIED | 5 tests: Neon pooled URL (true), sslmode-only URL (true), Neon direct URL (true), localhost (false), 127.0.0.1 (false) |
| `apps/api/src/plugins/redis.ts` | detectRedisTls() named export + conditional tls on ioredis | VERIFIED | Contains `export function detectRedisTls(`, conditional `...(isTls ? { tls: {} } : {})` — no unconditional tls |
| `apps/api/src/plugins/redis.test.ts` | Unit tests for detectRedisTls() | VERIFIED | 5 tests: Upstash rediss:// (true), redis://localhost (false), redis:// with password (false), empty string (false), substring match guard (false) |
| `apps/api/src/config/env.ts` | DATABASE_DIRECT_URL + OPENSEARCH_URL optional env fields | VERIFIED | Both fields present with `z.string().url().optional()`; JSDoc contains no docker-compose references |
| `apps/api/drizzle.config.ts` | Migration URL falls back DATABASE_DIRECT_URL -> DATABASE_URL | VERIFIED | `url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!` on line 26 |
| `.env.example` | Root infra env vars in Neon/Upstash/Bonsai format | VERIFIED | Contains `ep-cool-name-123456-pooler.neon.tech`, `DATABASE_DIRECT_URL=`, `rediss://`, `bonsai.io`; 0 docker-compose matches |
| `apps/api/.env.example` | API env vars in Neon/Upstash format + DATABASE_DIRECT_URL + OPENSEARCH_URL | VERIFIED | Contains `rediss://`, `DATABASE_DIRECT_URL=`, `OPENSEARCH_URL=`; 0 docker-compose matches |
| `.github/workflows/ci.yml` | Cloud credentials injected from repo secrets for all CI environments | VERIFIED | Top-level env block reads `${{ secrets.DATABASE_URL }}`, `${{ secrets.DATABASE_DIRECT_URL }}`, `${{ secrets.REDIS_URL }}`, `${{ secrets.OPENSEARCH_URL }}`; no echo of any secret |
| `README.md` | Infrastructure Setup section: Neon/Upstash/Bonsai signup + exact env vars | VERIFIED | 164 lines; heading "Infrastructure Setup" found 3 times; all four env vars documented; bonsai.io + neon.com + upstash.com present; number_of_replicas:0 note + Upstash Fixed-plan note present |
| `.planning/ROADMAP.md` | Phase 1 plan description updated to cloud infra | VERIFIED | Line 45 reads `cloud infra setup (Neon/Upstash/Bonsai)` — no `docker-compose infra` |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `apps/api/src/plugins/drizzle.ts` | `env.DATABASE_URL` | `requiresSsl(env.DATABASE_URL)` gating ssl option on pg.Pool | WIRED | `requiresSsl(env.DATABASE_URL)` on line 30; result gates `...(ssl ? { ssl: true } : {})` on line 33 |
| `apps/api/src/plugins/redis.ts` | `env.REDIS_URL` | `detectRedisTls(env.REDIS_URL)` gating tls option on ioredis | WIRED | `detectRedisTls(env.REDIS_URL)` on line 29; result gates `...(isTls ? { tls: {} } : {})` on line 36 |
| `.github/workflows/ci.yml` | GitHub Actions repository secrets | top-level env block reading `${{ secrets.* }}` | WIRED | All four secrets mapped in env block lines 11–14; no services block present |
| `README.md` | both .env.example files | documents the same DATABASE_URL/DATABASE_DIRECT_URL/REDIS_URL/OPENSEARCH_URL variables | WIRED | README env var table on lines 139–148 documents all four variables matching both .env.example files |

### Data-Flow Trace (Level 4)

Not applicable — phase produces no components rendering dynamic data. All deliverables are configuration files, infrastructure helpers, documentation, and test files.

### Behavioral Spot-Checks

| Behavior | Command | Result | Status |
|----------|---------|--------|--------|
| requiresSsl returns true for Neon URL | Code inspection: `connectionString.includes(".neon.tech")` | Logic is correct for all test cases defined in drizzle.test.ts | PASS (code-verified) |
| detectRedisTls returns true for rediss:// | Code inspection: `url.startsWith("rediss://")` | Logic is correct for all test cases defined in redis.test.ts | PASS (code-verified) |
| drizzle.config.ts uses direct URL | `grep "DATABASE_DIRECT_URL" apps/api/drizzle.config.ts` | `process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!` found | PASS |
| CI env block has all four secrets | `grep -c "secrets.DATABASE_URL" .github/workflows/ci.yml` | Returns 1 | PASS |
| docker-compose.yml absent | `test -f docker-compose.yml` | Returns ABSENT | PASS |
| Unit test suite runs | `pnpm --filter @grovio/api test` | Not executable in this environment (Node 18 constraint — see Human Verification) | SKIP |

### Probe Execution

No probe scripts defined for this phase.

### Requirements Coverage

No requirement IDs were declared for this phase (infrastructure/config migration per plan frontmatter and ROADMAP.md).

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| None | — | — | — | — |

Scanned all phase-modified files for TBD/FIXME/XXX/TODO/HACK/PLACEHOLDER markers and hardcoded empty values. Zero matches found in: `drizzle.ts`, `redis.ts`, `drizzle.test.ts`, `redis.test.ts`, `env.ts`, `drizzle.config.ts`, `.env.example`, `apps/api/.env.example`, `.github/workflows/ci.yml`, `README.md`.

The worktree artifact at `.claude/worktrees/agent-ad62e35df5660e0b6/docker-compose.yml` is an untracked Claude worktree file, not a project file — it does not affect the main-tree state and is outside buyer-facing scope.

### Human Verification Required

#### 1. Unit Test Suite Execution

**Test:** Run `pnpm --filter @grovio/api test` from the project root on a machine with Node 22 installed
**Expected:** All 10 vitest tests pass — 5 in `apps/api/src/plugins/drizzle.test.ts` (requiresSsl) and 5 in `apps/api/src/plugins/redis.test.ts` (detectRedisTls). Test command exits 0.
**Why human:** Plan 01 SUMMARY documents a confirmed Node 18 environment constraint in the Claude worktree that prevented test execution. vitest 4.1.7 requires Node 20+. The test logic passes static code review — both helpers are single-expression pure functions matching the specification exactly — but the machine-executed test result was not captured. CI with Node 22 should produce a passing run.

### Gaps Summary

No gaps. All 11 must-have truths verified with direct codebase evidence. All artifacts exist, are substantive, and are wired. Zero anti-patterns or debt markers found.

The sole human verification item is a test-suite execution confirmation blocked by the Node 18 worktree constraint, not by any correctness issue in the code.

---

_Verified: 2026-05-30T19:00:00Z_
_Verifier: Claude (gsd-verifier)_
