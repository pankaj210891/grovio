---
phase: "05"
plan: "08"
subsystem: backend/commerce
tags: [coupon-engine, return-service, feature-flags, commission-reversal, wallet-refund, tdd]
dependency_graph:
  requires: ["05-04", "05-06"]
  provides: [CouponService, ReturnService]
  affects: [CheckoutService, WalletService, CommissionService]
tech_stack:
  added: []
  patterns:
    - "Feature-flag gate short-circuits all DB lookups when COUPONS_ENABLED is off"
    - "Server-authoritative discount computation: floor(subtotal*pct/100) for percentages, capped at eligible subtotal"
    - "Append-only commission reversal via allocate() proration — earned rows never modified"
    - "Atomic return approval: wallet credit + commission reversal in one transaction"
key_files:
  created:
    - apps/api/src/modules/coupons/CouponService.ts
    - apps/api/src/modules/coupons/index.ts
    - apps/api/src/modules/coupons/__tests__/CouponService.test.ts
    - apps/api/src/modules/returns/ReturnService.ts
    - apps/api/src/modules/returns/index.ts
    - apps/api/src/modules/returns/__tests__/ReturnService.test.ts
  modified: []
decisions:
  - "CouponService uses ilike() for case-insensitive code lookup — normalizes to uppercase on entry"
  - "Redis caches coupon rows as JSON (key: coupon:code:<NORMALISED-CODE>) — TTL from COUPON_CACHE_TTL_SECONDS or FEATURE_FLAG_TTL_SECONDS fallback"
  - "ReturnService.checkEligibility accepts deliveredAt as optional field — falls back to updatedAt when status='delivered' because vendor_orders schema lacks a dedicated deliveredAt column"
  - "approveReturn calls WalletService.credit inside the transaction callback for atomicity; idempotency key prevents double-credit on retry (WAL-03)"
  - "Full-return optimization: when refundMinor >= vendorSubtotal, the entire earned commission is reversed without allocate() call"
  - "createReturnRequest loads vendor order first (loadVendorOrder), then calls checkEligibility — test mock order matters"
metrics:
  duration: "11m 17s"
  completed_date: "2026-06-03"
  tasks_completed: 2
  files_created: 6
  tests_added: 32
---

# Phase 05 Plan 08: Coupon Engine + Return/Refund Flow Summary

**One-liner:** Feature-flagged coupon validation (server-authoritative integer discount math) and per-vendor return eligibility with atomic wallet refund + proportional commission reversal via allocate().

## What Was Built

### Task 1: CouponService (CHK-06, D-17, D-18) — TDD

**CouponService** (`apps/api/src/modules/coupons/CouponService.ts`):

- `validateCoupon({code, orderSubtotalMinor, vendorIds, productIds, categoryIds})` — full coupon validation pipeline
- **Feature-flag gate first (CHK-06):** calls `featureFlagService.getFlag('COUPONS_ENABLED')` before any DB lookup; throws `CouponDisabledError` (code `COUPONS_DISABLED`) when off (D-17, T-05-CPN)
- **Redis-first caching:** coupon rows cached as JSON at `coupon:code:<NORMALISED>` with TTL from `COUPON_CACHE_TTL_SECONDS` env var
- **Eligibility checks (D-18):** isActive, expiresAt > now, redemptionCount < maxRedemptions, orderSubtotalMinor >= minOrderMinor, scope match
- **Scope matching (D-17):** global (null scopeId), vendor, product, category — each checks the corresponding IDs array
- **Integer discount math (Pitfall 1):**
  - Flat: `min(discountValue, orderSubtotalMinor)`
  - Percentage: `min(Math.floor(orderSubtotalMinor * pct / 100), orderSubtotalMinor)` — no floating point
- `CouponInvalidError` (code `COUPON_INVALID`, reason field) for all eligibility failures
- **20 unit tests:** flag-off gate, flag-off no DB call, flat discount, cap at subtotal, percentage floor, percentage cap, expired, over-redemption, below-min, scope-mismatch (vendor/product/category), Redis cache hit

### Task 2: ReturnService (ORD-04, WAL-04, MKT-03) — TDD

**ReturnService** (`apps/api/src/modules/returns/ReturnService.ts`):

- `checkEligibility(vendorOrder)` — loads `vendor_return_policies` for vendor; global fallback (7 days / returnable) when no policy row exists (D-22); returns false if not returnable, not delivered, or outside window
- `createReturnRequest(params)` — verifies eligibility, inserts `return_requests` with `status='return_requested'` (D-23); scoped by `customerId` (T-05-06)
- `approveReturn(returnRequestId)` — **one atomic transaction (Pitfall 7, T-05-RFD):**
  1. Sets `return_requests.status = 'approved'`
  2. Loads all order items for the vendor order (needed for refund + proration)
  3. Computes `refundMinor` = sum of returned item `lineSubtotalMinor`
  4. If `refundPreference='wallet'`: calls `WalletService.credit` with `entry_type='refund_credit'` and `idempotencyKey = 'return:{id}:refund-credit'` (WAL-04)
  5. Computes proportional commission reversal via `allocate()` (D-15, MKT-03): `allocate(earnedCommission, [returnedSubtotal, remainingSubtotal])[0]`
  6. Inserts `vendor_commission_entries` with `status='reversed'` — **original earned row never modified** (append-only, T-05-RFD)
- `refundPreference='original'` stores the preference but does NOT call provider refund API (Phase 6 deferred scope, per RESEARCH Open Question 1)
- **12 unit tests:** fallback policy path, outside window, non-returnable, no deliveredAt, createReturnRequest insert, wallet credit assertion, no wallet for 'original', commission reversed insert, prorated reversal math (1/3 of 3000 = 1000), append-only verification, status set to 'approved'

## Acceptance Criteria Results

| Criteria | Result |
|----------|--------|
| CouponService calls `getFlag('COUPONS_ENABLED')` before any DB lookup | PASS — test asserts `db.select` not called when flag off |
| Percentage discount uses integer math and never exceeds eligible subtotal | PASS — `Math.floor()`, capped at `orderSubtotalMinor` |
| CouponInvalidError for expired, over-redemption, below-min-order, scope-mismatch | PASS — 4 test cases each |
| `pnpm --filter @grovio/api test --run src/modules/coupons` exits 0 | PASS — 20/20 tests |
| checkEligibility uses 7-day/returnable fallback when no policy row (D-22) | PASS — test asserts fallback path |
| approveReturn calls WalletService.credit with `refund_credit` + idempotencyKey `return:{id}:refund-credit` | PASS |
| approveReturn inserts `vendor_commission_entries` `status='reversed'` with allocate()-derived prorated amount | PASS — test asserts `commissionAmountMinor: 1000` for 1/3 proration |
| Original 'earned' row is never updated | PASS — no `update(vendorCommissionEntries)` in returns module |
| `pnpm --filter @grovio/api test --run src/modules/returns` exits 0 | PASS — 12/12 tests |
| `pnpm --filter @grovio/api typecheck` passes | PASS |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Removed incorrect `db.select().from(db as any)` in createReturnRequest**
- **Found during:** Task 2 GREEN phase
- **Issue:** Draft `createReturnRequest` had a leftover `.from(db as any).limit(1)` chain (dead code from a revision) that caused `TypeError: db.select(...).from(...).limit is not a function`
- **Fix:** Removed the dead code block; `loadVendorOrder` uses the properly-imported `vendorOrders` schema table
- **Files modified:** `apps/api/src/modules/returns/ReturnService.ts`

**2. [Rule 1 - Bug] Fixed dynamic import of vendorOrders schema**
- **Found during:** Task 2 GREEN phase
- **Issue:** Initial design used `await import("../../db/schema/index.js")` inside `loadVendorOrder` which doesn't resolve to the Drizzle table object in Vitest's module system
- **Fix:** Changed to top-level static import of `vendorOrders` from schema index
- **Files modified:** `apps/api/src/modules/returns/ReturnService.ts`

**3. [Rule 1 - Bug] Fixed test mock order for createReturnRequest**
- **Found during:** Task 2 GREEN phase
- **Issue:** Test had mocks in wrong order (policy first, then vendor order). Actual code calls `loadVendorOrder` first, then `checkEligibility` (which queries policy)
- **Fix:** Swapped mock order in test to: vendor order first, policy second
- **Files modified:** `apps/api/src/modules/returns/__tests__/ReturnService.test.ts`

**4. [Rule 1 - Bug] Fixed TypeScript exactOptionalPropertyTypes error on deliveredAt**
- **Found during:** Task 2 typecheck
- **Issue:** `deliveredAt: undefined` didn't match `deliveredAt?: Date | null` with exactOptionalPropertyTypes:true
- **Fix:** Updated type to `deliveredAt?: Date | null | undefined` in `VendorOrderForEligibility`
- **Files modified:** `apps/api/src/modules/returns/ReturnService.ts`

**5. [Rule 2 - Missing functionality] Contracts package needed a build before tests could resolve**
- **Found during:** Task 2 GREEN phase
- **Issue:** `@grovio/contracts/money` package had no `dist/` folder in the worktree, causing import resolution failure
- **Fix:** Ran `pnpm --filter @grovio/contracts build` to generate the dist artifacts
- **Impact:** None on committed code; dist files are gitignored and will be rebuilt by Turborepo in the main pipeline

## Security Coverage

| Threat | Implementation |
|--------|----------------|
| T-05-04: Coupon discount tampering | discountMinor always computed server-side from DB; client amount never trusted (Pitfall 6) |
| T-05-CPN: Coupon brute force | COUPONS_ENABLED gate short-circuits when off; per-code redemption cap enforced |
| T-05-RFD: Commission reversal tampering | approveReturn inserts prorated 'reversed' entry via allocate() in same transaction; earned rows immutable |
| T-05-06: Return ownership | createReturnRequest scoped by customerId from JWT (T-05-06) |

## Threat Flags

None — all new code operates on backend ledger tables and feature flag infrastructure. No new network endpoints added (routes are in plan 05-10).

## Known Stubs

None — all coupon and return service logic is fully wired with real business logic. No hardcoded empty values or placeholder data.

## Self-Check: PASSED

- `apps/api/src/modules/coupons/CouponService.ts` — EXISTS
- `apps/api/src/modules/coupons/index.ts` — EXISTS
- `apps/api/src/modules/coupons/__tests__/CouponService.test.ts` — EXISTS
- `apps/api/src/modules/returns/ReturnService.ts` — EXISTS
- `apps/api/src/modules/returns/index.ts` — EXISTS
- `apps/api/src/modules/returns/__tests__/ReturnService.test.ts` — EXISTS
- Commit `c8e66bc` (test RED CouponService) — EXISTS
- Commit `b20eeba` (feat GREEN CouponService) — EXISTS
- Commit `0ce2272` (test RED ReturnService) — EXISTS
- Commit `09a94d5` (feat GREEN ReturnService) — EXISTS
- `grep -rn "update(vendorCommissionEntries)" apps/api/src/modules/returns/` → empty (append-only confirmed)
- `pnpm --filter @grovio/api typecheck` → PASS (no errors)
- 32/32 tests pass in both modules
