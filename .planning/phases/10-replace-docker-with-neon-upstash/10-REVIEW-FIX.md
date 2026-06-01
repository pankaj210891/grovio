---
phase: 10-replace-docker-with-neon-upstash
fixed_at: 2026-05-31T00:00:00Z
review_path: .planning/phases/10-replace-docker-with-neon-upstash/10-REVIEW.md
iteration: 1
fix_scope: critical_warning
findings_in_scope: 7
fixed: 7
skipped: 0
status: all_fixed
---

# Phase 10: Code Review Fix Report

**Fixed at:** 2026-05-31T00:00:00Z
**Source review:** .planning/phases/10-replace-docker-with-neon-upstash/10-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 7
- Fixed: 7
- Skipped: 0

## Fixed Issues

### CR-01: Pool connection leaked when startup connectivity check fails in drizzle plugin

**Files modified:** `apps/api/src/plugins/drizzle.ts`
**Commit:** 16cdfe4
**Applied fix:** Wrapped `pool.query("SELECT 1")` in a try/catch block. On error, calls `pool.end()` before re-throwing, ensuring the pg Pool's idle TCP connections are released even when the onClose hook was never registered.

---

### CR-02: Redis client leaked when startup connectivity check fails in redis plugin

**Files modified:** `apps/api/src/plugins/redis.ts`
**Commit:** b67619c
**Applied fix:** Wrapped `redis.connect()` and `redis.ping()` in a try/catch block. On error, calls `redis.quit()` before re-throwing, preventing the ioredis socket descriptor and internal retry timer from leaking when the onClose hook was never registered.

---

### CR-03: JWT_SECRET is absent from CI environment — all CI runs crash at env-parse time

**Files modified:** `.github/workflows/ci.yml`, `README.md`
**Commit:** 2f5921d
**Applied fix:** Added `JWT_SECRET: ${{ secrets.JWT_SECRET }}` to the global `env:` block in ci.yml. Added `JWT_SECRET` entry to the CI secrets list in README.md so buyers know to create this repository secret before CI can pass.

---

### WR-01: drizzle.config.ts uses non-null assertion on DATABASE_URL — validation is bypassed outside Zod

**Files modified:** `apps/api/drizzle.config.ts`
**Commit:** 9174ed9
**Applied fix:** Replaced the `process.env["DATABASE_URL"]!` non-null assertion with an explicit guard. The URL is now resolved into a local `migrationUrl` variable; if both `DATABASE_DIRECT_URL` and `DATABASE_URL` are unset, an `Error` is thrown with a descriptive message pointing buyers to `.env.example`. The `defineConfig` call uses `migrationUrl` directly.

---

### WR-02: enableReadyCheck: true is incompatible with Upstash managed Redis

**Files modified:** `apps/api/src/plugins/redis.ts`
**Commit:** f117859
**Applied fix:** Changed `enableReadyCheck: true` to `enableReadyCheck: false` with an inline comment explaining the Upstash requirement. This prevents the ioredis handshake from timing out or throwing when connecting to Upstash's serverless Redis, which does not support the READY check.

---

### WR-03: apps/api/.env.example is missing CATEGORY_TREE_TTL_SECONDS, GOOGLE_SMTP_USER, GOOGLE_SMTP_PASS, and GOOGLE_MAPS_API_KEY

**Files modified:** `apps/api/.env.example`
**Commit:** 24f35ea
**Applied fix:** Appended four new entries to the file: `CATEGORY_TREE_TTL_SECONDS=300` (optional, has default), `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASS` (required Phase 8+), and `GOOGLE_MAPS_API_KEY` (required Phase 4+). Each entry includes a comment describing its purpose and how to obtain the value.

---

### WR-04: requiresSsl does not trigger on sslmode=verify-full or sslmode=verify-ca

**Files modified:** `apps/api/src/plugins/drizzle.ts`, `apps/api/src/plugins/drizzle.test.ts`
**Commit:** 4aeeb71
**Applied fix:** Extended the `requiresSsl` function to include checks for `sslmode=verify-full` and `sslmode=verify-ca` in addition to the existing `sslmode=require` and `.neon.tech` checks. Updated the JSDoc comment to document all four trigger conditions. Added two new test cases in `drizzle.test.ts` covering both new SSL modes (non-Neon hosts with `sslmode=verify-full` and `sslmode=verify-ca`).

---

_Fixed: 2026-05-31T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
