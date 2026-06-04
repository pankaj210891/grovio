---
phase: "06-vendor-admin-tools"
plan: "06"
subsystem: "backend-services"
tags: ["vendor-profile", "vendor-staff", "analytics", "returns", "inventory", "tdd", "bigint-money", "idor-guard"]
dependency_graph:
  requires: ["06-04", "06-05"]
  provides: ["VendorProfileService", "VendorStaffService", "AnalyticsService", "ReturnService.rejectReturn", "InventoryService.updateInventory", "InventoryService.updatePricing"]
  affects: ["06-07", "06-08", "06-09", "06-10"]
tech_stack:
  added: []
  patterns: ["sql-aggregation-outstanding-balance", "idor-ownership-check", "onConflictDoUpdate-upsert", "argon2-invite-accept", "bullmq-product-index-trigger", "append-only-rejection"]
key_files:
  created:
    - apps/api/src/modules/vendor-profile/VendorProfileService.ts
    - apps/api/src/modules/vendor-profile/index.ts
    - apps/api/src/modules/vendor-profile/VendorProfileService.test.ts
    - apps/api/src/modules/vendor-staff/VendorStaffService.ts
    - apps/api/src/modules/vendor-staff/index.ts
    - apps/api/src/modules/vendor-staff/VendorStaffService.test.ts
    - apps/api/src/modules/analytics/AnalyticsService.ts
    - apps/api/src/modules/analytics/index.ts
    - apps/api/src/modules/analytics/AnalyticsService.test.ts
    - apps/api/src/db/migrations/20260605000000_phase6_rejection_reason/migration.sql
  modified:
    - apps/api/src/modules/returns/ReturnService.ts
    - apps/api/src/modules/returns/index.ts
    - apps/api/src/modules/returns/__tests__/ReturnService.rejectReturn.test.ts
    - apps/api/src/modules/inventory/InventoryService.ts
    - apps/api/src/modules/inventory/index.ts
    - apps/api/src/modules/inventory/__tests__/InventoryService.vendor.test.ts
    - apps/api/src/db/schema/return-requests.ts
    - apps/api/src/config/env.ts
    - apps/api/src/container.ts
decisions:
  - "Outstanding balance query uses a single DB round-trip with correlated subquery for vendor_payouts (Pattern 7)"
  - "InventoryService.updateInventory/updatePricing share IDOR pattern via product.vendorId check"
  - "rejectReturn is a zero-money-movement operation — no wallet credit, no commission reversal"
  - "VendorStaffService deps use full Env type (not Pick) after adding WEB_VENDOR_URL to env schema"
  - "productIndexQueue is optional in InventoryServiceDeps to avoid breaking existing tests"
metrics:
  duration: "1117s"
  completed_date: "2026-06-05"
  tasks: 3
  files: 17
---

# Phase 06 Plan 06: Vendor Backend Services Summary

**One-liner:** VendorProfileService (banking isolation), VendorStaffService (argon2 invite/accept with 48h expiry), AnalyticsService (SQL outstanding-balance aggregation via Pattern 7), plus ReturnService.rejectReturn and InventoryService pricing/inventory with IDOR ownership guards.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 (RED) | Failing tests: VendorProfileService + VendorStaffService | 8c4baf6 | VendorProfileService.test.ts, VendorStaffService.test.ts |
| 2 (RED) | Failing test: AnalyticsService | dc4eb40 | AnalyticsService.test.ts |
| 3 (RED) | Failing tests: rejectReturn + inventory vendor extensions | eedc8d9 | ReturnService.rejectReturn.test.ts, InventoryService.vendor.test.ts |
| 1 (GREEN) | Implement VendorProfileService + VendorStaffService | 73580ae | VendorProfileService.ts, VendorStaffService.ts, env.ts, container.ts |
| 2 (GREEN) | Implement AnalyticsService | a458c37 | AnalyticsService.ts |
| 3 (GREEN) | Implement rejectReturn + InventoryService vendor extensions | 425641d | ReturnService.ts, InventoryService.ts, return-requests schema, migration |

## TDD Gate Compliance

- RED gate: `test(06-06)` commits for all 3 tasks precede GREEN `feat(06-06)` commits ✓
- GREEN gate: `feat(06-06)` commits follow each RED commit ✓
- No REFACTOR pass needed — code is clean as written

## Key Behaviors Implemented

### VendorProfileService (D-01, D-02, T-06-15)
- `getProfile(vendorId)` — explicit column select EXCLUDING all banking fields (`accountHolderName`, `bankAccountNumber`, `ifscOrRoutingCode`, `bankName`). These live in `vendor_payout_info` only.
- `updateProfile(vendorId, input)` — whitelist of D-01 columns; `onboardingStatus` is NOT writable by vendor.
- `getPayoutInfo` / `updatePayoutInfo` — separate method; uses `onConflictDoUpdate` on `vendorId` UNIQUE.
- `getReturnPolicy` / `updateReturnPolicy` — reads/writes `vendor_return_policies` (D-22).

### VendorStaffService (D-04, D-05, T-06-16, T-06-17)
- `invite(vendorId, invitedByUserId, {email, role})` — throws `OwnerRoleNotInvitableError` when role='owner'; generates `crypto.randomUUID()` token + 48h expiry; sends invite email via mailer.
- `accept({token, password})` — loads invite by token; rejects expired or already-accepted tokens (`InvalidInviteTokenError`); argon2 hashes password; inserts `vendor_users` + sets `acceptedAt` in transaction.
- `listStaff(vendorId)` — returns non-archived staff via `isNull(archivedAt)` filter.
- `removeStaff(vendorId, userId)` — throws `CannotRemoveOwnerError` for owner role; soft-deletes via `archivedAt`.

### AnalyticsService (MKT-05, VEN-02, ADM-01, D-08, D-09, D-10)
- `getVendorEarnings(vendorId)` — single SQL query returning earned + reversed + settled via correlated subquery. `outstanding = earned - reversed - settled` (Pattern 7). Test: 10000/2000/3000 → 5000.
- `getAdminVendorPayout(vendorId)` — wraps earnings + adds `payoutInfo` from `vendor_payout_info`.
- `getVendorDashboard(vendorId, period)` — KPIs + earnings + low stock. Low stock threshold from `SettingsService.getSetting('low_stock_threshold')`, default 5.
- `getAdminSummary(period)` — combined SQL for GMV/orders/activeVendors/newCustomers/commissionEarned + pending payouts via SQL subquery across all vendors.
- `getAdminCharts(period)` — ordersByDay, topVendorsByGmv (joins `vendors.storeName`), gmvByCategory.

### ReturnService.rejectReturn (D-16, VEN-04)
- Validates `rejectionReason` is non-empty (throws on empty or whitespace).
- Asserts `return_requested` status (throws `ReturnNotRejectableError` for approved/rejected/refunded).
- Sets `status='rejected'` + stores `rejectionReason` in DB.
- DOES NOT issue wallet credit, payment refund, or commission reversal (zero-money-movement).

### InventoryService vendor extensions (D-15, VEN-03, T-06-18, T-06-19)
- `updateInventory(vendorId, inventoryItemId, {quantityAvailable})` — joins `inventory_items → products` to verify `product.vendorId === vendorId` (IDOR guard T-06-18); updates `quantityAvailable` only; `quantityReserved` is never included in set payload (T-06-19).
- `updatePricing(vendorId, productId, {basePriceMinor}, variantId?)` — loads product, verifies vendor ownership; updates `basePriceMinor` (or `productVariants.priceMinor` if variantId); enqueues `ProductIndexJob` via `productIndexQueue.add('product-index', {productId, action:'index'})` after write.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] Added `rejection_reason` column to `return_requests`**
- **Found during:** Task 3 implementation
- **Issue:** `return_requests` table had no column to store rejection reason; `rejectReturn()` couldn't persist it
- **Fix:** Added `rejectionReason text` column to `return_requests.ts` schema + SQL migration `20260605000000_phase6_rejection_reason`
- **Files modified:** `apps/api/src/db/schema/return-requests.ts`, new migration file
- **Commit:** 425641d

**2. [Rule 2 - Missing functionality] Added `WEB_VENDOR_URL` and `WEB_ADMIN_URL` to env schema**
- **Found during:** Task 1 (VendorStaffService invite email link)
- **Issue:** Invite link `{WEB_VENDOR_URL}/accept-invite?token=...` had no corresponding env var
- **Fix:** Added `WEB_VENDOR_URL` (default `http://localhost:5174`) and `WEB_ADMIN_URL` (default `http://localhost:5175`) to `env.ts`
- **Files modified:** `apps/api/src/config/env.ts`
- **Commit:** 73580ae

**3. [Rule 2 - Missing functionality] Made `productIndexQueue` optional in InventoryServiceDeps**
- **Found during:** Task 3 (InventoryService.updatePricing)
- **Issue:** Existing tests construct `InventoryService` without `productIndexQueue`; making it required would break them
- **Fix:** Added `productIndexQueue?: Queue<any>` as optional dep; updatePricing guards with `if (productIndexQueue)`
- **Files modified:** `apps/api/src/modules/inventory/InventoryService.ts`
- **Commit:** 425641d

## Threat Surface Scan

No new network endpoints or auth paths introduced in this plan (services only — routes are in separate plans).

| Flag | File | Description |
|------|------|-------------|
| threat_flag: payout_banking_isolation | VendorProfileService.ts | Banking data never flows through getProfile; separate getPayoutInfo method requires owner-role gate at route layer |
| threat_flag: invite_token_replay | VendorStaffService.ts | acceptedAt + expiresAt check prevents replay. randomUUID provides 128-bit entropy |
| threat_flag: idor_inventory | InventoryService.ts | updateInventory/updatePricing verify product.vendorId before write (T-06-18) |
| threat_flag: quantity_reserved_immutable | InventoryService.ts | updateInventory never includes quantityReserved in set payload (T-06-19) |

## Known Stubs

None. All data flows are wired to real DB tables/schema. No placeholder values.

## Self-Check: PASSED

All created files verified:
- `apps/api/src/modules/vendor-profile/VendorProfileService.ts` FOUND
- `apps/api/src/modules/vendor-staff/VendorStaffService.ts` FOUND
- `apps/api/src/modules/analytics/AnalyticsService.ts` FOUND
- `apps/api/src/db/migrations/20260605000000_phase6_rejection_reason/migration.sql` FOUND

All commits verified:
- 8c4baf6: test(06-06): add failing tests for VendorProfileService + VendorStaffService
- dc4eb40: test(06-06): add failing test for AnalyticsService
- eedc8d9: test(06-06): add failing tests for rejectReturn + vendor inventory/pricing extensions
- 73580ae: feat(06-06): implement VendorProfileService + VendorStaffService
- a458c37: feat(06-06): implement AnalyticsService (vendor earnings + admin analytics)
- 425641d: feat(06-06): rejectReturn + InventoryService vendor pricing/inventory updates

Full test suite (454 tests): PASSED (no regressions)
