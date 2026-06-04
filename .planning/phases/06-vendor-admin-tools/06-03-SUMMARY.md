---
phase: 06-vendor-admin-tools
plan: "03"
subsystem: database
tags: [drizzle, migration, postgres, vendor, admin, data-migration, idempotent]
dependency_graph:
  requires:
    - apps/api/src/db/schema/index.ts (Plan 06-02 — all 7 new tables must be defined before generation)
    - apps/api/src/db/schema/vendor-users.ts (migration target — vendor_users table)
    - apps/api/src/db/schema/vendors.ts (migration source — email + password_hash copied FROM)
  provides:
    - apps/api/src/db/migrations/20260604160305_swift_killmonger/ (Phase 6 SQL migration)
    - apps/api/src/db/migrate-vendor-users.ts (idempotent vendor-owner data migration script)
  affects:
    - Plan 06-04 (VendorAuthService migration — requires vendor_users table in DB AND owner rows populated)
    - Plans 06-05+ (all Phase 6 services assume Phase 6 schema is live)
tech_stack:
  added: []
  patterns:
    - drizzle-kit generate → migrate workflow (same as Phase 3/4/5)
    - pg Pool direct SQL for data migration (no ORM layer — avoids complexity for a one-shot migration)
    - NOT EXISTS idempotency guard for safe re-runs (T-06-08)
    - WITH CTE + RETURNING for insert count tracking
key_files:
  created:
    - apps/api/src/db/migrations/20260604160305_swift_killmonger/migration.sql
    - apps/api/src/db/migrations/20260604160305_swift_killmonger/snapshot.json
    - apps/api/src/db/migrate-vendor-users.ts
  modified:
    - apps/api/package.json (added db:migrate:vendor-users script)
key-decisions:
  - "Raw pg client used for data migration instead of Drizzle ORM — avoids ORM layer for a one-shot SQL operation with no schema inference needed"
  - "Coverage check (owner_count == eligible_vendor_count) fails with exit code 1 on mismatch — surfaces issues before Plan 06-04 switches auth to vendor_users"
  - "accepted_at = NOW() for migrated owners — they are already active accounts (no invite flow needed)"
  - "created_at preserved from vendors.created_at — maintains original account history"
requirements-completed: [VEN-01, VEN-05, ADM-02, ADM-05, ADM-07, MKT-04]
duration: ~12min
completed: "2026-06-04"
status: CHECKPOINT — awaiting human verification of live DB migration application
---

# Phase 6 Plan 03: DB Migration Generation & Vendor-Owner Data Migration Summary

**Phase 6 Drizzle migration SQL generated (7 new tables + vendors/coupons extensions) and vendor-owner data migration script written. Human checkpoint required before `db:migrate` is applied to the live Neon DB.**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-04T15:54:17Z
- **Completed:** 2026-06-04T16:06:06Z (pre-checkpoint)
- **Tasks completed:** 2 of 3 (Task 3 is the human checkpoint)
- **Files modified:** 4

## Accomplishments

### Task 1: Generated Phase 6 Drizzle Migration

Generated `apps/api/src/db/migrations/20260604160305_swift_killmonger/migration.sql` containing:

**New pgEnums:**
- `CREATE TYPE "vendor_onboarding_status" AS ENUM('pending', 'approved', 'suspended')`
- `CREATE TYPE "vendor_user_role" AS ENUM('owner', 'manager', 'staff')`

**New tables (7 total):**
- `CREATE TABLE "vendor_users"` — multi-member vendor team, role-based, soft-delete via archived_at
- `CREATE TABLE "vendor_staff_invites"` — invite token, expiry, accepted_at
- `CREATE TABLE "vendor_payout_info"` — isolated banking data, vendorId UNIQUE FK
- `CREATE TABLE "vendor_payouts"` — append-only BIGINT ledger, no updatedAt
- `CREATE TABLE "admin_users"` — admin auth table
- `CREATE TABLE "marketplace_settings"` — key TEXT PK, value JSONB
- `CREATE TABLE "audit_log"` — append-only, JSONB before/after, no updatedAt

**Table extensions:**
- `ALTER TABLE "vendors" ADD COLUMN "onboarding_status"` (default 'approved') + 7 store profile columns
- `ALTER TABLE "coupons" ADD COLUMN "created_by_type"` + `created_by_id`

**Foreign key constraints added for vendor-domain tables.**

### Task 2: Vendor-Owner Data Migration Script

Created `apps/api/src/db/migrate-vendor-users.ts`:
- Copies Phase 3 vendor owner credentials (email + password_hash) from `vendors` into `vendor_users` as `role='owner'`
- Uses `NOT EXISTS` guard: idempotent on re-run (inserts 0 rows if already migrated, T-06-08)
- Sets `accepted_at = NOW()` for migrated owners (they are already active accounts — no invite needed)
- Preserves `created_at` from original `vendors` row
- Logs: inserted count, total owner count, eligible vendor count
- Coverage check: exits with code 1 if owner count != eligible vendor count (T-06-07 safety net)
- Added `db:migrate:vendor-users` script to `apps/api/package.json`

## Task Commits

Each task was committed atomically:

1. **Task 1: Generate Phase 6 Drizzle migration** — `0026803` (chore)
2. **Task 2: Vendor-owner data migration script** — `25e63c3` (feat)

## Files Created/Modified

- `apps/api/src/db/migrations/20260604160305_swift_killmonger/migration.sql` — Phase 6 SQL migration (7 tables + 2 extensions + 4 FK constraints)
- `apps/api/src/db/migrations/20260604160305_swift_killmonger/snapshot.json` — Drizzle Kit migration snapshot
- `apps/api/src/db/migrate-vendor-users.ts` — idempotent vendor-owner data migration script
- `apps/api/package.json` — added `db:migrate:vendor-users` script

## Decisions Made

- Raw pg client (not Drizzle ORM) used in the data migration — simpler for a one-shot INSERT/SELECT with no schema inference needed; follows seed-commerce.ts pattern for DB connection/teardown
- Coverage check (owner_count == eligible_vendor_count) with non-zero exit code on mismatch — prevents Plan 06-04 from silently deploying with missing owner rows
- `accepted_at = NOW()` for migrated owners — they are pre-existing active accounts, not pending staff invites

## Deviations from Plan

### Auto-fixed / Infrastructure Issues

**1. [Rule 3 - Infrastructure] Worktree required reset to 06-02 base**
- **Found during:** Task 1 setup
- **Issue:** Worktree branch was on commit `ef2b59f` (Phase 10 context), not the 06-02 base `2ee6586`. The `worktree_branch_check` condition should have reset to `2ee6586` (the base commit from the orchestrator), but the reset was not executed in the initial HEAD assertion.
- **Fix:** Ran `git reset --hard 2ee65863313b772febd064d9215816dd6ab013a1` to put the worktree at the correct base (after 06-02 work)
- **Impact:** Required pnpm install and contracts build in the worktree (same as 06-02 encountered)

**2. [Rule 3 - Infrastructure] packages/config was empty (known issue from 06-02)**
- **Found during:** Task 1 — first migration generation attempt failed with "File '@grovio/config/tsconfig/node.json' not found"
- **Issue:** `packages/config/` directory was empty in the working tree; tsconfig files tracked in git but not checked out
- **Fix:** `git checkout HEAD -- packages/config/` to restore tracked config files
- **Impact:** Unblocked drizzle-kit generation

**3. [Rule 3 - Infrastructure] Worktree needed pnpm install + contracts build**
- **Found during:** Task 1 setup after worktree reset
- **Issue:** No node_modules in worktree after reset; packages/contracts had no dist/
- **Fix:** `pnpm install` + `pnpm --filter @grovio/contracts build` in worktree root
- **Impact:** Required ~20s install; drizzle-kit and tsx now available

**4. [Autonomous Mode - Checkpoint] db:migrate NOT applied by this agent**
- **Found during:** Task 1 verification step
- **Reason:** The plan executor instructions explicitly state "STOP at the checkpoint task that requires the user to actually run the migration against the live Neon database." The `db:migrate` command runs against the shared cloud DB and requires human verification (Task 3 checkpoint)
- **Impact:** Migration SQL is committed and ready; human must run `pnpm --filter @grovio/api db:migrate` and verify the live DB

**Total deviations:** 3 infrastructure auto-fixed, 1 intentional checkpoint stop
**Impact on plan:** Infrastructure issues resolved inline; migration application correctly deferred to human checkpoint.

## Pre-existing Typecheck Errors (Out of Scope)

3 errors in `product-index-job.test.ts` about missing `slug` property in mock objects. Pre-existing from Phase 3 (noted in 06-02 SUMMARY). NOT introduced by this plan. Not fixed (scope boundary rule).

## Checkpoint Status (Task 3)

**AWAITING HUMAN ACTION**

Task 3 (`checkpoint:human-verify`) requires the user to:
1. Run `pnpm --filter @grovio/api db:migrate` to apply the generated SQL to the live Neon DB
2. Verify in Drizzle Studio or Neon console that all 7 tables and 2 extensions exist
3. Run `pnpm --filter @grovio/api db:migrate:vendor-users` to copy vendor owners into vendor_users
4. Confirm every pre-existing vendor has a role='owner' row in vendor_users
5. Run `pnpm --filter @grovio/api test --run` to confirm existing tests still pass

Once confirmed, reply "approved" so the Plan 06-04 agent can proceed with VendorAuthService migration.

## Known Stubs

None — this plan generates infrastructure (SQL migration + data migration script). No UI stubs.

## Threat Flags

None — this plan adds a SQL migration file and a DB script. No network endpoints, auth paths, or new access patterns are introduced. The threat mitigations are built into the data migration script itself (T-06-07: coverage check, T-06-08: NOT EXISTS idempotency guard).

---

## Self-Check: PASSED

Files exist:
- apps/api/src/db/migrations/20260604160305_swift_killmonger/migration.sql ✓
- apps/api/src/db/migrations/20260604160305_swift_killmonger/snapshot.json ✓
- apps/api/src/db/migrate-vendor-users.ts ✓
- apps/api/package.json (contains db:migrate:vendor-users) ✓

Commits exist:
- 0026803 (Task 1) ✓
- 25e63c3 (Task 2) ✓

Migration SQL acceptance criteria:
- Contains `CREATE TABLE "vendor_users"` ✓
- Contains `CREATE TABLE "vendor_payouts"` ✓
- Contains `CREATE TABLE "admin_users"` ✓
- Contains `CREATE TABLE "marketplace_settings"` ✓
- Contains `CREATE TABLE "audit_log"` ✓
- Contains `ALTER TABLE "vendors" ADD COLUMN "onboarding_status"` ✓
- Contains `ALTER TABLE "coupons" ADD COLUMN "created_by_type"` ✓

Data migration script acceptance criteria:
- Contains `INSERT INTO vendor_users` ✓
- Contains `NOT EXISTS` idempotency guard ✓
- Sets `role = 'owner'` for migrated rows ✓
- Sets `accepted_at` to NOW() ✓
- Logs total owner count after run ✓
- db:migrate:vendor-users script in package.json ✓
