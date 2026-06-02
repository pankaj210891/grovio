---
phase: 05-commerce-core
plan: 01
subsystem: api
tags: [zod, contracts, typescript, basket, checkout, orders, wallet, payments, commissions, money]

# Dependency graph
requires:
  - phase: 04-customer-storefront-web
    provides: "Phase 4's auth.ts JwtPayload + customer-auth patterns that Phase 5 basket/checkout routes reuse"
  - phase: 03-catalog-search
    provides: "product/variant schemas and DB conventions that order contracts reference"
provides:
  - "BasketItemSchema, BasketSchema, AddToBasketInputSchema, UpdateBasketItemInputSchema in packages/contracts/src/basket/"
  - "CheckoutStepSchema, InitiateCheckoutInputSchema, ApplyCouponInputSchema, CouponDiscountSchema, PlaceOrderInputSchema, CheckoutSummarySchema in packages/contracts/src/checkout/"
  - "OrderStatusSchema (6 values), ReturnStatusSchema (4 values), OrderItemSchema, VendorOrderSchema, OrderSchema, CreateReturnRequestInputSchema in packages/contracts/src/orders/"
  - "WalletEntryTypeSchema, WalletEntrySchema, WalletBalanceSchema, WalletLedgerResponseSchema in packages/contracts/src/wallet/"
  - "PaymentProviderIdSchema, ProviderPaymentOrderSchema, InitiatePaymentResultSchema, EnabledProvidersSchema, InitiatePaymentInputSchema in packages/contracts/src/payments/"
  - "CommissionStatusSchema, CommissionScopeSchema, VendorCommissionEntrySchema in packages/contracts/src/commissions/"
  - "Root barrel packages/contracts/src/index.ts updated to export all six new domains"
affects:
  - "05-02 (DB schema — orderStatusEnum/returnStatusEnum/walletEntryTypeEnum/commissionStatusEnum must match these contract enum values)"
  - "05-03 through 05-12 (all Phase 5 plans consume these contracts for request validation and response typing)"
  - "07-mobile (React Native uses same @grovio/contracts for basket/checkout/order/wallet/payment types)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod schema → z.infer<typeof Schema> type pair pattern applied to all six new domains"
    - "All money fields z.number().int() (never z.bigint() or z.number() without .int()) — Pitfall 5 compliant"
    - "UUID validation on all id fields (T-05-IV threat mitigation)"
    - "walletAppliedMinor bounded .min(0) to prevent negative credit injection (T-05-IV)"
    - "quantity bounded .min(1).max(100) on all input schemas (T-05-IV)"
    - "Domain barrel index.ts pattern: export * from './types.js' (matches catalog pattern)"

key-files:
  created:
    - packages/contracts/src/basket/types.ts
    - packages/contracts/src/basket/index.ts
    - packages/contracts/src/checkout/types.ts
    - packages/contracts/src/checkout/index.ts
    - packages/contracts/src/orders/types.ts
    - packages/contracts/src/orders/index.ts
    - packages/contracts/src/wallet/types.ts
    - packages/contracts/src/wallet/index.ts
    - packages/contracts/src/payments/types.ts
    - packages/contracts/src/payments/index.ts
    - packages/contracts/src/commissions/types.ts
    - packages/contracts/src/commissions/index.ts
  modified:
    - packages/contracts/src/index.ts

key-decisions:
  - "checkout/types.ts imports PaymentProviderIdSchema from ../payments/types.js — payments types created first to enable this cross-domain import without inline duplication"
  - "VendorBasketGroupSchema added to basket contracts to support D-24 vendor-grouped cart page layout (not originally listed but essential for the BasketSchema structure)"
  - "WalletLedgerResponseSchema includes both balanceMinor and entries array to serve GET /account/wallet in a single response (avoids two-round-trip pattern)"
  - "CommissionScopeSchema added alongside CommissionStatusSchema to represent the priority chain levels (global/category/vendor) as a typed enum"

patterns-established:
  - "Pattern: All Phase 5 contract files follow catalog/product.ts template — Zod schema definition then z.infer<typeof Schema> type then both exported"
  - "Pattern: Money fields always z.number().int() at JSON boundary; bigint stays in DB/service layer only"
  - "Pattern: Domain barrels use export * from './types.js' (with .js extension for ESM compatibility)"

requirements-completed: [CHK-01, CHK-02, CHK-03, CHK-04, ORD-01, ORD-02, ORD-03, WAL-01, WAL-02, PAY-04, MKT-01]

# Metrics
duration: 12min
completed: 2026-06-02
---

# Phase 5 Plan 01: Commerce Core Contract Schemas Summary

**Six Zod schema domains (basket, checkout, orders, wallet, payments, commissions) defining all Phase 5 API request/response shapes with z.number().int() money fields and enum values matching planned pgEnums**

## Performance

- **Duration:** 12 min
- **Started:** 2026-06-02T18:56:01Z
- **Completed:** 2026-06-02T19:08:59Z
- **Tasks:** 2
- **Files modified:** 13 (12 created + 1 updated root barrel)

## Accomplishments

- Six new contract domain directories created in `packages/contracts/src/` with types.ts + index.ts in each
- All 23 existing contract tests pass; root barrel updated with six new `export *` lines
- OrderStatusSchema (6 values), ReturnStatusSchema (4 values), WalletEntryTypeSchema (3 values), CommissionStatusSchema (3 values), CommissionScopeSchema (3 values), PaymentProviderIdSchema (2 values) — all ready for pgEnum matching in plan 05-02
- Threat mitigations T-05-04 and T-05-IV implemented: all money fields z.number().int(), walletAppliedMinor .min(0), quantity .min(1).max(100), all IDs z.string().uuid()

## Task Commits

1. **Task 1: Basket, checkout, and orders contract schemas** — `3c619c1` (feat)
2. **Task 2: Wallet, payments, commissions contracts + root barrel wiring** — `feb98b6` (feat)

## Files Created/Modified

- `packages/contracts/src/basket/types.ts` — BasketItemSchema, VendorBasketGroupSchema, BasketSchema, AddToBasketInputSchema, UpdateBasketItemInputSchema
- `packages/contracts/src/basket/index.ts` — domain barrel
- `packages/contracts/src/checkout/types.ts` — CheckoutStepSchema, InitiateCheckoutInputSchema, ApplyCouponInputSchema, CouponDiscountSchema, PlaceOrderInputSchema, CheckoutSummarySchema
- `packages/contracts/src/checkout/index.ts` — domain barrel
- `packages/contracts/src/orders/types.ts` — OrderStatusSchema, ReturnStatusSchema, OrderItemSchema, VendorOrderSchema, OrderSchema, CreateReturnRequestInputSchema
- `packages/contracts/src/orders/index.ts` — domain barrel
- `packages/contracts/src/wallet/types.ts` — WalletEntryTypeSchema, WalletEntrySchema, WalletBalanceSchema, WalletLedgerResponseSchema
- `packages/contracts/src/wallet/index.ts` — domain barrel
- `packages/contracts/src/payments/types.ts` — PaymentProviderIdSchema, ProviderPaymentOrderSchema, InitiatePaymentResultSchema, EnabledProvidersSchema, InitiatePaymentInputSchema
- `packages/contracts/src/payments/index.ts` — domain barrel
- `packages/contracts/src/commissions/types.ts` — CommissionStatusSchema, CommissionScopeSchema, VendorCommissionEntrySchema
- `packages/contracts/src/commissions/index.ts` — domain barrel
- `packages/contracts/src/index.ts` — updated to add 6 new export * lines

## Decisions Made

- payments/types.ts was created in Task 1 (even though it was assigned to Task 2) because checkout/types.ts needed to import `PaymentProviderIdSchema` from it. This avoided inline duplication and matched the plan's intent of creating payments types first.
- `VendorBasketGroupSchema` added to basket contracts — plan listed `groupedByVendor as array of {vendorId, vendorName, items, vendorSubtotalMinor}` in BasketSchema, so a named schema was the correct pattern to avoid an inline anonymous z.object().
- `CommissionScopeSchema` added to commissions types — the plan specified "CommissionScopeSchema z.enum(['global','category','vendor'])" as part of the commissions domain.

## Deviations from Plan

None — plan executed exactly as written. The payments/types.ts file was created during Task 1 execution (as the plan suggested: "prefer defining it in payments and importing") and committed in Task 1 alongside the basket/checkout/orders files. The plan listed it in Task 2's files but explicitly noted this forward-reference issue and approved cross-task creation.

## Issues Encountered

**Worktree node_modules missing:** The git worktree at `D:/My Projects/grovio/.claude/worktrees/agent-a821b20fa163cfd8d/` did not have node_modules. Build commands from the worktree directory failed. Resolved by creating a Windows junction from the worktree's `packages/contracts/node_modules` to the main repo's `packages/contracts/node_modules`. This allowed `pnpm --filter @grovio/contracts build` to succeed from the worktree context.

**Absolute path drift:** Initial file creation accidentally wrote files to the main repo (`D:/My Projects/grovio/packages/...`) instead of the worktree (`D:/My Projects/grovio/.claude/worktrees/agent-a821b20fa163cfd8d/packages/...`). The errant files were deleted from the main repo and re-created in the correct worktree path before committing.

## Known Stubs

None — this plan creates pure contract schemas (Zod types + TypeScript types). No UI rendering, no data source wiring. All exports are complete and correct.

## Threat Flags

None. The new schemas are type-only contract definitions; they do not introduce new network endpoints, auth paths, or file access patterns.

## Self-Check: PASSED

- `packages/contracts/src/basket/types.ts` — FOUND
- `packages/contracts/src/checkout/types.ts` — FOUND
- `packages/contracts/src/orders/types.ts` — FOUND
- `packages/contracts/src/wallet/types.ts` — FOUND
- `packages/contracts/src/payments/types.ts` — FOUND
- `packages/contracts/src/commissions/types.ts` — FOUND
- Commit `3c619c1` — FOUND (Task 1)
- Commit `feb98b6` — FOUND (Task 2)
- `pnpm --filter @grovio/contracts build` exits 0 — VERIFIED
- `pnpm --filter @grovio/contracts test` passes 23/23 — VERIFIED
- No z.bigint() in any of the six new domains — VERIFIED (grep returns only a comment)

## Next Phase Readiness

- Plan 05-02 (DB schema) can now define `orderStatusEnum`, `returnStatusEnum`, `walletEntryTypeEnum`, `commissionStatusEnum` pgEnums with values that exactly match these contracts
- Plans 05-03 through 05-12 have fixed API shapes to build against; no schema renegotiation needed
- Phase 7 (React Native) has typed contracts for basket, checkout, orders, wallet, payments ready for cross-platform sharing

---
*Phase: 05-commerce-core*
*Completed: 2026-06-02*
