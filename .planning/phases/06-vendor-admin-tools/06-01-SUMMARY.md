---
phase: 06-vendor-admin-tools
plan: "01"
subsystem: contracts
tags: [contracts, types, zod, vendor, admin, phase-6]
dependency_graph:
  requires:
    - packages/contracts/src/commissions/ (phase 5 — CommissionStatus, CommissionScope patterns)
    - packages/contracts/src/category/blocks.ts (MerchandisingBlock — imported by admin/cms.ts)
  provides:
    - packages/contracts/src/vendor/index.ts (VendorRole, VendorOnboardingStatus, VendorStoreProfile, VendorPayoutInfo, VendorReturnPolicy, VendorStaffMember, InviteVendorStaffInput, AcceptVendorInviteInput, VendorStaffInvite, VendorEarningsSummary, VendorCommissionLedgerEntry, VendorSettlementRecord, VendorEarningsResponse, VendorDashboardSummary, VendorDashboardPeriod)
    - packages/contracts/src/admin/index.ts (AdminLoginInput, AdminProfile, AdminVendorListItem, AdminVendorListResponse, SuspendVendorInput, ApproveVendorInput, ReinstateVendorInput, ConfigureVendorInput, CommissionRuleScope, CommissionRule, CommissionRulesResponse, CreateCommissionRuleInput, UpdateCommissionRuleInput, RecordSettlementInput, AdminPayoutSummary, AdminVendorPayoutResponse, MarketplaceSettingKey, UpdateSettingInput, MarketplaceSettingsResponse, AuditActorType, AuditLogEntry, AuditLogQuery, AuditLogResponse, AnalyticsPeriod, AdminAnalyticsSummary, OrdersByDayPoint, TopVendorByGmv, GmvByCategoryPoint, AdminAnalyticsResponse, CreateHomepageBlockInput, UpdateHomepageBlockInput, ReorderHomepageBlockInput)
  affects:
    - All Phase 6 backend plans (06-02 through 06-10) — consume vendor/admin contracts
    - apps/api (all Phase 6 modules import from @grovio/contracts)
    - apps/web-vendor (vendor panel imports VendorRole, earnings, dashboard types)
    - apps/web-admin (admin panel imports admin analytics, commission, payout types)
tech_stack:
  added: []
  patterns:
    - Zod schema + inferred type dual-export pattern (XSchema + type X)
    - BIGINT minor-unit money fields named *Minor (Pitfall 1)
    - String decimal input for settlement amount (Pitfall 5 / T-06-01 mitigation)
    - VendorRole restricted to manager|staff in InviteVendorStaffInput (T-06-02 mitigation)
    - MerchandisingBlock imported (not redefined) in admin/cms.ts
key_files:
  created:
    - packages/contracts/src/vendor/profile.ts
    - packages/contracts/src/vendor/staff.ts
    - packages/contracts/src/vendor/earnings.ts
    - packages/contracts/src/vendor/dashboard.ts
    - packages/contracts/src/vendor/index.ts
    - packages/contracts/src/admin/auth.ts
    - packages/contracts/src/admin/vendors.ts
    - packages/contracts/src/admin/commission-rules.ts
    - packages/contracts/src/admin/payouts.ts
    - packages/contracts/src/admin/settings.ts
    - packages/contracts/src/admin/audit.ts
    - packages/contracts/src/admin/analytics.ts
    - packages/contracts/src/admin/cms.ts
    - packages/contracts/src/admin/index.ts
  modified:
    - packages/contracts/src/index.ts (appended vendor/index.js and admin/index.js exports)
decisions:
  - "VendorRole (owner|manager|staff) defined in vendor/profile.ts as the single source of truth imported by both vendor/staff.ts and backend auth"
  - "InviteVendorStaffInput.role uses z.refine() to reject 'owner' at schema level (T-06-02 mitigation, D-05)"
  - "RecordSettlementInput.amount is z.string() not z.number() — server-side decimal-to-minor conversion per T-06-01 and Pitfall 5"
  - "CommissionRulesResponse has exactly three groups: global (single), categoryOverrides (array), vendorOverrides (array)"
  - "MerchandisingBlock imported from category/blocks.ts in admin/cms.ts — not redefined (D-11)"
  - "All money fields named *Minor and z.number().int() — JSON serialization uses number not bigint"
  - "MarketplaceSettingKey as z.enum with 10 canonical snake_case keys (D-19)"
  - "AuditActorType z.enum(['admin','vendor','system']) matches D-13 table constraint"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-04"
  tasks_completed: 2
  files_count: 15
---

# Phase 6 Plan 01: Vendor & Admin API Contracts Summary

## One-liner

Phase 6 vendor and admin Zod contracts defining VendorRole union (D-05), BIGINT minor-unit earnings/payout DTOs (D-08/D-09), string-input settlement (Pitfall 5/T-06-01), and full admin analytics/audit/CMS/commission/settings schemas in `@grovio/contracts`.

## What Was Built

Created two new contract subfolders in `packages/contracts/src/`:

### Vendor Domain (`packages/contracts/src/vendor/`)

**profile.ts** — `VendorRoleSchema` (owner|manager|staff, D-05), `VendorOnboardingStatusSchema` (pending|approved|suspended, D-01), `VendorStoreProfile`, `UpdateVendorStoreProfileInput` (omits onboardingStatus — admin-only), `VendorPayoutInfo` and `UpdateVendorPayoutInfoInput` (bank details, D-02), `VendorReturnPolicy` and `UpdateVendorReturnPolicyInput`.

**staff.ts** — `VendorStaffMember`, `InviteVendorStaffInput` with `role` field zod-refined to reject "owner" (T-06-02 mitigation, D-05), `AcceptVendorInviteInput` (token + password.min(8)), `VendorStaffInvite` (D-04).

**earnings.ts** — `VendorEarningsSummary` with `outstandingBalanceMinor` (canonical balance formula from D-08), `VendorCommissionLedgerEntry`, `VendorSettlementRecord`, `VendorEarningsResponse` (MKT-04, MKT-05, D-09). All money fields end with `Minor` suffix per Pitfall 1.

**dashboard.ts** — `VendorDashboardSummary` (ordersCount, grossSalesMinor, netEarningsMinor, outstandingBalanceMinor, lowStockCount, lowStockProducts array), `VendorDashboardPeriod` (7d|30d|90d, VEN-02).

**index.ts** — barrel re-exporting all vendor files with `.js` extensions.

### Admin Domain (`packages/contracts/src/admin/`)

**auth.ts** — `AdminLoginInput` (email + password.min(1)), `AdminProfile` (id, email, role: z.literal("admin"), D-21).

**vendors.ts** — `AdminVendorListItem` (gmvLast30dMinor, categoryRestrictionCount, etc.), `AdminVendorListResponse` (offset pagination), `SuspendVendorInput`, `ApproveVendorInput`, `ReinstateVendorInput`, `ConfigureVendorInput` (categoryRestrictionIds + commissionOverridePercent, ADM-02, D-17).

**commission-rules.ts** — `CommissionRuleScopeSchema` (global|category|vendor), `CommissionRule`, `CommissionRulesResponse` with exactly three groups (global single, categoryOverrides array, vendorOverrides array), `CreateCommissionRuleInput` (scope restricted to category|vendor only), `UpdateCommissionRuleInput` (ADM-03, D-18).

**payouts.ts** — `RecordSettlementInput` (`amount: z.string()` — decimal string, not minor units — T-06-01/Pitfall 5), `AdminPayoutSummary` (identical minor-unit fields to VendorEarningsSummary), `AdminVendorPayoutResponse` combining summary + ledger + settlements + payoutInfo nullable (MKT-04, D-07/D-08).

**settings.ts** — `MarketplaceSettingKeySchema` z.enum with 10 canonical keys (store_name, default_currency, timezone, default_return_window_days, low_stock_threshold, primary_color, logo_url, favicon_url, smtp_sender_name, smtp_sender_email), `UpdateSettingInput`, `MarketplaceSettingsResponse` as z.record (ADM-05, D-19).

**audit.ts** — `AuditActorTypeSchema` (admin|vendor|system), `AuditLogEntry` with before/after JSONB as z.unknown().nullable(), `AuditLogQuery` (all optional filters), `AuditLogResponse` (offset pagination, ADM-07, D-13).

**analytics.ts** — `AnalyticsPeriodSchema` (7d|30d|90d), `AdminAnalyticsSummary` with 6 KPIs including `pendingPayoutsMinor`, `OrdersByDayPoint`, `TopVendorByGmv`, `GmvByCategoryPoint`, `AdminAnalyticsResponse` (ADM-01, D-10). All money fields named `*Minor`.

**cms.ts** — `CreateHomepageBlockInput`, `UpdateHomepageBlockInput`, `ReorderHomepageBlockInput` (direction up|down). Imports and uses `MerchandisingBlockSchema` from `../category/blocks.js` — does NOT redefine banner/product_grid/text_block/featured_categories shapes (D-11 requirement, ADM-04).

**index.ts** — barrel re-exporting all admin files with `.js` extensions.

### Root Barrel Update

`packages/contracts/src/index.ts` — appended `export * from "./vendor/index.js";` and `export * from "./admin/index.js";` after the commissions export, maintaining the existing ordering convention.

## Verification

- `tsc --noEmit` passes with 0 errors on worktree source
- `tsup` build succeeds: dist/index.js 59.20 KB, dist/index.d.ts 112.87 KB
- Key symbols confirmed in dist: `VendorRole`, `AdminAnalyticsSummary`, `RecordSettlementInput`
- `VendorEarningsSummary.outstandingBalanceMinor` present
- `InviteVendorStaffInput.role` rejects "owner" via z.refine
- `RecordSettlementInput.amount` is z.string()
- `CommissionRulesResponse` has global, categoryOverrides, vendorOverrides groups
- admin/cms.ts imports `MerchandisingBlockSchema` from category/blocks.js

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Vendor domain contracts | `1c18642` | feat(06-01): create vendor domain contracts (profile, staff, earnings, dashboard) |
| Task 2: Admin domain contracts + root barrel | `97c25c9` | feat(06-01): create admin domain contracts and wire root barrel |

## Deviations from Plan

None — plan executed exactly as written.

The worktree required a node_modules junction to the main repo's packages/contracts/node_modules to enable tsc to resolve dependencies during verification. This is a worktree infrastructure detail, not a plan deviation.

## Known Stubs

None — this plan creates type definitions only (no runtime UI components or data fetching). All contracts are complete and ready for downstream consumption.

## Threat Flags

None — this plan adds compile-time type definitions only. No network endpoints, auth paths, file access patterns, or schema changes at runtime trust boundaries are introduced in this plan.

## Self-Check: PASSED

Files exist:
- packages/contracts/src/vendor/profile.ts ✓
- packages/contracts/src/vendor/staff.ts ✓
- packages/contracts/src/vendor/earnings.ts ✓
- packages/contracts/src/vendor/dashboard.ts ✓
- packages/contracts/src/vendor/index.ts ✓
- packages/contracts/src/admin/auth.ts ✓
- packages/contracts/src/admin/vendors.ts ✓
- packages/contracts/src/admin/commission-rules.ts ✓
- packages/contracts/src/admin/payouts.ts ✓
- packages/contracts/src/admin/settings.ts ✓
- packages/contracts/src/admin/audit.ts ✓
- packages/contracts/src/admin/analytics.ts ✓
- packages/contracts/src/admin/cms.ts ✓
- packages/contracts/src/admin/index.ts ✓

Commits exist:
- 1c18642 (Task 1) ✓
- 97c25c9 (Task 2) ✓
