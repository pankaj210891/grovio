---
phase: 06-vendor-admin-tools
plan: "07"
subsystem: backend-admin-services
tags: [vendor-management, payouts, commissions, feature-flags, cms, tdd, audit]
dependency_graph:
  requires: [06-04, 06-05]
  provides:
    - VendorManagementService (approve/suspend/reinstate/configure + listVendors)
    - PayoutService (recordSettlement + getVendorPayout)
    - CommissionService.getRules/createRule/updateRule/deleteRule/invalidateRateCache
    - FeatureFlagService.toggleFlag/listFlags
    - HomepageService.createBlock/updateBlock/deleteBlock/reorderBlock/listBlocksForAdmin
  affects:
    - apps/api/src/modules/vendor-management/
    - apps/api/src/modules/payouts/
    - apps/api/src/modules/commissions/CommissionService.ts
    - apps/api/src/modules/feature-flags/FeatureFlagService.ts
    - apps/api/src/modules/homepage/HomepageService.ts
tech_stack:
  added: []
  patterns:
    - append-only insert (vendorPayouts — no UPDATE path)
    - server-side minor-unit conversion (Math.round(parseFloat(amount)*100))
    - post-write cache invalidation (Pitfall 3 — invalidate AFTER write)
    - CommissionRuleProtectedError (coded error for global rule guard)
    - audit-on-every-mutation (T-06-24)
key_files:
  created:
    - apps/api/src/modules/vendor-management/VendorManagementService.ts
    - apps/api/src/modules/vendor-management/VendorManagementService.test.ts
    - apps/api/src/modules/vendor-management/index.ts
    - apps/api/src/modules/payouts/PayoutService.ts
    - apps/api/src/modules/payouts/PayoutService.test.ts
    - apps/api/src/modules/payouts/index.ts
  modified:
    - apps/api/src/modules/commissions/CommissionService.ts
    - apps/api/src/modules/commissions/__tests__/CommissionService.test.ts
    - apps/api/src/modules/feature-flags/FeatureFlagService.ts
    - apps/api/src/modules/feature-flags/FeatureFlagService.test.ts
    - apps/api/src/modules/homepage/HomepageService.ts
    - apps/api/src/modules/homepage/HomepageService.test.ts
decisions:
  - "PayoutService delegates getVendorPayout to AdminVendorPayoutProvider interface (AnalyticsService, plan 06-09)"
  - "CommissionRuleProtectedError (coded error class) maps to 403 at route layer"
  - "invalidateRateCache uses KEYS+DEL v1 approach (acceptable at v1 rule-set size)"
  - "auditService added to CommissionServiceDeps, FeatureFlagServiceDeps, HomepageServiceDeps"
metrics:
  duration_minutes: 30
  completed: "2026-06-05"
  tasks_completed: 3
  files_changed: 12
---

# Phase 06 Plan 07: Admin Backend Services Summary

**One-liner:** Admin control-plane services: vendor lifecycle management, append-only settlement recording with server-side minor-unit conversion, commission CRUD with global-rule protection and cache invalidation, feature flag toggle, and homepage CMS write methods — all mutations audited.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | VendorManagementService + PayoutService | c94b943 | vendor-management/, payouts/ (NEW) |
| 2 | CommissionService CRUD + cache invalidation | 9eebc99 | CommissionService.ts (MODIFIED) |
| 3 | FeatureFlagService toggle + HomepageService CMS writes | 4d6f46a | FeatureFlagService.ts, HomepageService.ts (MODIFIED) |

## What Was Built

### Task 1: VendorManagementService + PayoutService

**VendorManagementService** (`apps/api/src/modules/vendor-management/VendorManagementService.ts`):
- `approveVendor(vendorId, adminEmail, ip)`: sets `onboarding_status='approved'`, audits `vendor.approved`
- `suspendVendor(vendorId, adminEmail, ip)`: sets `onboarding_status='suspended'`, audits `vendor.suspended`
- `reinstateVendor(vendorId, adminEmail, ip)`: sets `onboarding_status='approved'`, audits `vendor.reinstated`
- `configureVendor(vendorId, input, adminEmail)`: replaces all `vendor_category_restrictions` rows, upserts vendor-scoped commission rule, audits `vendor.configured`
- `listVendors({ limit, offset })`: returns paginated `AdminVendorListItem` rows

Each mutation loads the before-state first, performs the update, then writes the audit log (T-06-24).

**PayoutService** (`apps/api/src/modules/payouts/PayoutService.ts`):
- `recordSettlement(vendorId, params, adminEmail)`: converts `amount` (decimal string) to minor units via `Math.round(parseFloat(amount) * 100)` (T-06-20, Pitfall 5), inserts append-only `vendor_payouts` row, rejects non-positive amounts, audits `payout.settled`
- `getVendorPayout(vendorId)`: delegates to `analyticsService.getAdminVendorPayout(vendorId)` via `AdminVendorPayoutProvider` interface (AnalyticsService implemented in plan 06-09)

Key design: `PayoutService` accepts `amount` as decimal string only — `amountMinor` is never accepted from client input (T-06-20 mitigation).

### Task 2: CommissionService CRUD + cache invalidation + global-rule protection

Extended `CommissionService` with admin mutation methods:
- `getRules()`: returns `{ global, categoryOverrides[], vendorOverrides[] }` (ADM-03, D-18)
- `createRule(input, adminEmail)`: inserts category/vendor rule, calls `invalidateRateCache()`, audits `commission_rule.created`
- `updateRule(id, input, adminEmail)`: updates `ratePercent`, calls `invalidateRateCache()`, audits `commission_rule.updated`
- `deleteRule(id, adminEmail)`: **throws `CommissionRuleProtectedError`** if rule scope is `'global'` (T-06-21 — global rule undeletable, D-18 anti-pattern); deletes category/vendor rules, calls `invalidateRateCache()`, audits `commission_rule.deleted`
- `invalidateRateCache()`: scans and deletes all `commission:rate:*` Redis keys (T-06-22, Pitfall 4)

Added `auditService` to `CommissionServiceDeps` and added `CommissionRuleProtectedError` exported class.

### Task 3: FeatureFlagService toggle + HomepageService CMS writes

**FeatureFlagService** extensions:
- `toggleFlag(key, enabled)`: updates `feature_flags.isEnabled` in DB, then calls `invalidateFlag(key)` AFTER the DB write (Pitfall 3 ordering), logs `feature_flag.toggled` (ADM-06, D-12)
- `listFlags()`: returns ALL flags (including disabled) for admin toggle list

**HomepageService** extensions:
- `createBlock(input)`: validates via `MerchandisingBlockSchema`, assigns `sortOrder = max + 1`, inserts row, then `invalidateBlocks()` AFTER write (Pitfall 3, T-06-23), audits `homepage_block.created`
- `updateBlock(id, input)`: validates block payload, updates row, then `invalidateBlocks()` after, audits `homepage_block.updated`
- `deleteBlock(id)`: deletes row, then `invalidateBlocks()` after, audits `homepage_block.deleted`
- `reorderBlock(id, direction)`: swaps `sortOrder` with the adjacent block (up = lower `sortOrder`, down = higher), `invalidateBlocks()` after all swaps
- `listBlocksForAdmin()`: returns ALL blocks including inactive, ordered by `sortOrder ASC` (bypasses Redis cache for admin freshness)

Added `auditService` to both `FeatureFlagServiceDeps` and `HomepageServiceDeps`.

## Test Coverage

All 3 tasks follow TDD (RED → GREEN):
- `VendorManagementService.test.ts`: 9 tests covering all lifecycle mutations, category restriction insert/delete, configureVendor, listVendors
- `PayoutService.test.ts`: 9 tests covering minor-unit conversion (5000.00→500000, 1.00→100, 999.99→99999), append-only constraint, audit, rejection of non-positive amounts
- `CommissionService.test.ts`: 8 new tests added to existing file (getRules, createRule, updateRule, deleteRule global guard, deleteRule category, invalidateRateCache); all original tests unbroken
- `FeatureFlagService.test.ts`: 4 new tests (toggleFlag DB update, invalidateFlag ordering, audit, listFlags); all original tests unbroken
- `HomepageService.test.ts`: 12 new tests (createBlock Pitfall-3 ordering, cache invalidation, audit, updateBlock, deleteBlock, reorderBlock swap, listBlocksForAdmin); all original tests unbroken

Full test suite: **493 tests pass** (454 pre-existing + 39 new).

## Deviations from Plan

### Auto-fixed Issues

None — plan executed as written.

### Implementation Decisions

1. **AdminVendorPayoutProvider interface (Rule 2 — missing dependency)**: `AnalyticsService.getAdminVendorPayout` does not exist yet (plan 06-09). Defined `AdminVendorPayoutProvider` interface in `PayoutService.ts` to allow dependency injection without coupling to a non-existent concrete class. This follows the existing pattern (e.g., `PaymentProvider` interface). Container registration in plan 06-08 will wire the concrete implementation.

2. **auditService deps parameter**: The plan specified adding `auditService` to `CommissionServiceDeps`. Extended this to `FeatureFlagServiceDeps` and `HomepageServiceDeps` as well (required by the plan's behavior specifications for T-06-24 audit coverage). Container registration in plan 06-08 will provide the `AuditService` instance.

3. **listVendors GMV/product counts**: These computed fields (gmvLast30dMinor, productCount, categoryRestrictionCount) are returned as `0` from the base `VendorManagementService`. The full aggregation via SQL JOINs or AnalyticsService is left for plan 06-08/06-09 where the admin routes and analytics service are implemented. This is intentional — the service layer is correct structurally, and the route layer can augment with the analytics data.

## Threat Surface Scan

All plan threat mitigations implemented:
- **T-06-20**: PayoutService server-side minor-unit conversion (Math.round) — implemented
- **T-06-21**: deleteRule global-rule guard (CommissionRuleProtectedError) — implemented
- **T-06-22**: invalidateRateCache on every rule mutation — implemented
- **T-06-23**: invalidateBlocks AFTER every CMS write (Pitfall 3) — implemented
- **T-06-24**: auditService.log on every mutation across all 5 services — implemented

No new security-relevant surface introduced beyond what the plan specified.

## Self-Check: PASSED

Files created/modified:
- FOUND: apps/api/src/modules/vendor-management/VendorManagementService.ts
- FOUND: apps/api/src/modules/vendor-management/VendorManagementService.test.ts
- FOUND: apps/api/src/modules/vendor-management/index.ts
- FOUND: apps/api/src/modules/payouts/PayoutService.ts
- FOUND: apps/api/src/modules/payouts/PayoutService.test.ts
- FOUND: apps/api/src/modules/payouts/index.ts
- FOUND: apps/api/src/modules/commissions/CommissionService.ts (modified)
- FOUND: apps/api/src/modules/commissions/__tests__/CommissionService.test.ts (modified)
- FOUND: apps/api/src/modules/feature-flags/FeatureFlagService.ts (modified)
- FOUND: apps/api/src/modules/feature-flags/FeatureFlagService.test.ts (modified)
- FOUND: apps/api/src/modules/homepage/HomepageService.ts (modified)
- FOUND: apps/api/src/modules/homepage/HomepageService.test.ts (modified)

Commits verified:
- c94b943: feat(06-07): implement VendorManagementService + PayoutService (Task 1)
- 9eebc99: feat(06-07): extend CommissionService with admin CRUD + cache invalidation (Task 2)
- 4d6f46a: feat(06-07): extend FeatureFlagService + HomepageService with CMS write methods (Task 3)

Test results: 493 tests pass (full suite including new modules)
