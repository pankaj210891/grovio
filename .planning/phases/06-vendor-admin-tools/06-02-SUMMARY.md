---
phase: 06-vendor-admin-tools
plan: "02"
subsystem: database
tags: [drizzle, schema, postgres, vendor, admin, pgEnum, bigint, jsonb, append-only]
dependency_graph:
  requires:
    - apps/api/src/db/schema/vendors.ts (Phase 3 vendors table — extended in this plan)
    - apps/api/src/db/schema/coupons.ts (Phase 5 coupons table — extended in this plan)
    - apps/api/src/db/schema/wallet-entries.ts (append-only ledger pattern reference)
    - apps/api/src/db/schema/vendor-commission-entries.ts (pgEnum + timestamps pattern reference)
    - packages/contracts/src/vendor/ (Phase 6 plan 01 — VendorRole, VendorOnboardingStatus enums)
  provides:
    - apps/api/src/db/schema/vendor-users.ts (vendor_users table + vendorUserRoleEnum D-03)
    - apps/api/src/db/schema/vendor-staff-invites.ts (vendor_staff_invites table D-04)
    - apps/api/src/db/schema/vendor-payout-info.ts (vendor_payout_info table D-02)
    - apps/api/src/db/schema/vendor-payouts.ts (append-only vendor_payouts ledger D-07)
    - apps/api/src/db/schema/admin-users.ts (admin_users table D-21)
    - apps/api/src/db/schema/marketplace-settings.ts (marketplace_settings key-PK table D-19)
    - apps/api/src/db/schema/audit-log.ts (append-only audit_log table D-13)
    - apps/api/src/db/schema/vendors.ts (extended: vendorOnboardingStatusEnum + store profile cols D-01)
    - apps/api/src/db/schema/coupons.ts (extended: created_by_type + created_by_id D-14)
    - apps/api/src/db/schema/index.ts (barrel re-exporting all 7 new tables in FK order)
  affects:
    - Plan 06-03 (migration — these tables need drizzle-kit generate + migrate)
    - Plans 06-04 through 06-10 (all Phase 6 backend services consume these schemas)
    - VendorAuthService (Phase 6 migration to vendor_users table)
    - AdminAuthService (new service — uses admin_users table)
    - SettingsService (new service — uses marketplace_settings table)
    - AuditService (new service — inserts to audit_log table)
tech_stack:
  added: []
  patterns:
    - pgEnum for status types (vendorUserRoleEnum, vendorOnboardingStatusEnum) consistent with Phase 3/5
    - Append-only tables have NO updatedAt column (vendor_payouts, audit_log)
    - BIGINT mode:number for money column (vendor_payouts.amount_minor, Pitfall 1)
    - key TEXT PRIMARY KEY for key-value config tables (marketplace_settings)
    - JSONB for before/after snapshots in audit_log
    - Soft-delete via archivedAt (vendor_users, consistent with vendors pattern)
    - Separate payout info table to prevent banking data leakage in profile responses (T-06-05)
key_files:
  created:
    - apps/api/src/db/schema/vendor-users.ts
    - apps/api/src/db/schema/vendor-staff-invites.ts
    - apps/api/src/db/schema/vendor-payout-info.ts
    - apps/api/src/db/schema/vendor-payouts.ts
    - apps/api/src/db/schema/admin-users.ts
    - apps/api/src/db/schema/marketplace-settings.ts
    - apps/api/src/db/schema/audit-log.ts
  modified:
    - apps/api/src/db/schema/vendors.ts (added vendorOnboardingStatusEnum + 8 profile columns)
    - apps/api/src/db/schema/coupons.ts (added created_by_type + created_by_id)
    - apps/api/src/db/schema/index.ts (appended Plan 06-02 barrel exports in FK order)
    - apps/api/src/modules/vendor-auth/VendorAuthService.test.ts (updated mock for new vendor columns)
key-decisions:
  - "vendorUsers.invitedBy uses loose UUID FK (no .references()) to avoid Drizzle circular reference at module load"
  - "vendor_payout_info.vendorId is UNIQUE — exactly one banking record per vendor (D-02), isolated from profile responses"
  - "vendor_payouts and audit_log have NO updatedAt — append-only design enforced at schema level (T-06-03, T-06-04)"
  - "marketplace_settings uses key TEXT as PRIMARY KEY (no id column) — enables simple UPSERT-based SettingsService writes"
  - "coupons.createdByType and createdById are nullable text (not FK) — backward compatible with Phase 5 data"
  - "vendors.onboardingStatus defaults to 'approved' — preserves existing Phase 3 vendor access post-migration (D-03)"
requirements-completed: [VEN-01, VEN-05, VEN-06, MKT-04, ADM-05, ADM-07, ADM-02, ADM-03]
duration: ~20min
completed: "2026-06-04"
---

# Phase 6 Plan 02: Vendor & Admin DB Schema Summary

**7 new Drizzle schema tables (vendor_users, vendor_staff_invites, vendor_payout_info, vendor_payouts, admin_users, marketplace_settings, audit_log) with 2 table extensions, 2 append-only ledgers without updatedAt, BIGINT minor-unit money, and a barrel re-export in FK-safe order.**

## Performance

- **Duration:** ~20 min
- **Started:** 2026-06-04T15:35:00Z
- **Completed:** 2026-06-04T15:50:00Z
- **Tasks:** 2
- **Files modified:** 11

## Accomplishments

- Created 4 vendor-domain tables: vendor_users (pgEnum role owner|manager|staff, D-03), vendor_staff_invites (D-04), vendor_payout_info (isolated banking data, D-02), vendor_payouts (append-only BIGINT ledger, D-07, T-06-03)
- Extended vendors table with vendorOnboardingStatusEnum and 7 store profile columns (storeName, storeDescription, logoUrl, bannerUrl, contactEmail, contactPhone, address, D-01)
- Created 3 admin/infra tables: admin_users (D-21), marketplace_settings (key TEXT PK + JSONB value, D-19), audit_log (append-only with JSONB before/after, D-13, T-06-04)
- Extended coupons table with created_by_type and created_by_id for vendor coupon scoping (D-14)
- Wired schema barrel with all 7 new tables exported in FK-dependency order

## Task Commits

Each task was committed atomically:

1. **Task 1: vendor-domain schema tables + extend vendors** - `f730cb8` (feat)
2. **Task 2: admin/settings/audit tables + extend coupons + wire barrel** - `3eb7c18` (feat)

## Files Created/Modified

- `apps/api/src/db/schema/vendor-users.ts` — vendor_users table with vendorUserRoleEnum pgEnum
- `apps/api/src/db/schema/vendor-staff-invites.ts` — vendor_staff_invites with inviteToken unique, expiresAt
- `apps/api/src/db/schema/vendor-payout-info.ts` — vendor_payout_info with vendorId unique FK (isolated banking)
- `apps/api/src/db/schema/vendor-payouts.ts` — append-only vendor_payouts ledger, amountMinor BIGINT, NO updatedAt
- `apps/api/src/db/schema/admin-users.ts` — admin_users table for AdminAuthService
- `apps/api/src/db/schema/marketplace-settings.ts` — marketplace_settings, key PK, value JSONB
- `apps/api/src/db/schema/audit-log.ts` — append-only audit_log, before/after JSONB, NO updatedAt
- `apps/api/src/db/schema/vendors.ts` — extended with vendorOnboardingStatusEnum + 8 profile columns
- `apps/api/src/db/schema/coupons.ts` — extended with created_by_type, created_by_id
- `apps/api/src/db/schema/index.ts` — barrel updated with Plan 06-02 section (7 exports in FK order)
- `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` — Rule 1 fix: updated mock object

## Decisions Made

- `vendorUsers.invitedBy` is a loose UUID column (no `.references()`) to avoid Drizzle circular dependency when vendor_users self-references — consistent with how Phase 3 avoided circular FKs
- `marketplace_settings` key is the primary key (no separate `id`) — design mirrors decision D-19 and the feature_flags pattern with `key TEXT UNIQUE` but makes key the actual PK for UPSERT ergonomics
- `vendors.onboardingStatus` defaults to `'approved'` so no migration data update needed for existing Phase 3 vendors (D-03 migration note)
- `coupons.created_by_type` and `created_by_id` are nullable text columns (not typed FKs) for backward compatibility with Phase 5 coupon data

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated VendorAuthService.test.ts mock vendor object**
- **Found during:** Task 1 (vendors.ts extension)
- **Issue:** `baseVendor: SelectVendor` mock was missing the 8 new nullable columns added to vendors.ts. TypeScript TS2740 error: "Type ... is missing the following properties: storeName, storeDescription, logoUrl, bannerUrl, and 4 more."
- **Fix:** Added all 8 new nullable/enum columns to the test fixture with appropriate null/default values
- **Files modified:** `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts`
- **Verification:** `pnpm --filter @grovio/api typecheck` TS2740 error resolved
- **Committed in:** `f730cb8` (part of Task 1 commit)

---

**Total deviations:** 1 auto-fixed (Rule 1 - Bug)
**Impact on plan:** Necessary correctness fix — no scope creep.

## Issues Encountered

**Worktree node_modules setup:** The worktree's `apps/api/node_modules` was partially set up (only .bin and .cache) and `packages/contracts` had no dist/ build. Required:
1. `pnpm install` in the worktree root to complete symlink setup
2. `pnpm --filter @grovio/contracts build` to compile contracts dist/

This is an infrastructure concern, not a code issue. The pnpm worktree symlink approach works correctly once initialized.

**Pre-existing typecheck errors (out of scope):** 3 errors in `product-index-job.test.ts` about missing `slug` property in mock objects. These are pre-existing from Phase 3 and were NOT introduced by this plan. Logged to deferred items — not fixed (scope boundary rule).

## User Setup Required

None — no external service configuration required. Schema-only plan.

## Next Phase Readiness

- All 7 new Drizzle schema tables are defined and barrel-exported
- Plan 06-03 (migration generation) can now run `drizzle-kit generate` to create SQL migrations
- Plans 06-04+ (service implementations) can import all new types from `@grovio/db/schema`
- `vendorUserRoleEnum` and `vendorOnboardingStatusEnum` are available for VendorAuthService migration

---

## Known Stubs

None — this plan creates schema definitions only (no runtime services or UI components).

## Threat Flags

None — this plan adds database schema definitions only. No network endpoints, auth paths, or file access patterns are introduced. Security mitigations (T-06-03 append-only payouts, T-06-04 append-only audit log, T-06-05 isolated payout info, T-06-06 BIGINT money) are implemented as schema constraints per the threat register.

## Self-Check: PASSED

Files exist:
- apps/api/src/db/schema/vendor-users.ts ✓
- apps/api/src/db/schema/vendor-staff-invites.ts ✓
- apps/api/src/db/schema/vendor-payout-info.ts ✓
- apps/api/src/db/schema/vendor-payouts.ts ✓
- apps/api/src/db/schema/admin-users.ts ✓
- apps/api/src/db/schema/marketplace-settings.ts ✓
- apps/api/src/db/schema/audit-log.ts ✓

Commits exist:
- f730cb8 (Task 1) ✓
- 3eb7c18 (Task 2) ✓

Acceptance criteria:
- vendor-users.ts exports vendorUserRoleEnum pgEnum("vendor_user_role", ["owner","manager","staff"]) ✓
- vendor-payouts.ts contains bigint("amount_minor", { mode: "number" }) and no updatedAt ✓
- vendor-payout-info.ts has vendorId with .unique() ✓
- vendors.ts defines vendorOnboardingStatusEnum and onboarding_status with default 'approved' ✓
- marketplace-settings.ts has key as primaryKey and value as jsonb (no id column) ✓
- audit-log.ts contains jsonb before/after columns and no updatedAt ✓
- coupons.ts contains created_by_type and created_by_id columns ✓
- index.ts exports vendor-users.js, vendor-staff-invites.js, vendor-payout-info.js,
  vendor-payouts.js, admin-users.js, marketplace-settings.js, audit-log.js ✓
- pnpm --filter @grovio/api typecheck: only pre-existing product-index-job.test.ts errors remain ✓
