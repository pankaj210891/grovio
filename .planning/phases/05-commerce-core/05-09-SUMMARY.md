---
phase: 05-commerce-core
plan: "09"
subsystem: backend/commerce
tags: [checkout, orders, vendor-split, allocate, server-authoritative, idempotency, tdd, CHK-03, CHK-04, CHK-05, ORD-01, ORD-02, ORD-03, ORD-05, WAL-05, MKT-01]

# Dependency graph
requires:
  - plan: "05-05"
    provides: "InventoryService.reserveItems + consumeReservation"
  - plan: "05-06"
    provides: "WalletService.computeWalletApplied + CommissionService.computeCommission"
  - plan: "05-07"
    provides: "PaymentService.createPaymentOrder (provider abstraction — NEVER SDK)"
  - plan: "05-08"
    provides: "CouponService.validateCoupon"
provides:
  - "OrderService (ORD-01..03, ORD-05, MKT-01)"
  - "CheckoutService (CHK-03, CHK-04, CHK-05, WAL-05)"
  - "OrderNotFoundError, OrderOwnershipError, VendorOrderOwnershipError"
  - "BasketSessionNotFoundError, EmptyBasketError"
  - "17 unit tests (11 OrderService + 6 CheckoutService) covering all acceptance criteria"
affects:
  - "05-10 (webhook routes call OrderService.finalizeOrder)"
  - "05-11 (basket + checkout routes expose CheckoutService and OrderService endpoints)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server-authoritative pricing: computeSummary always re-fetches from catalog, never from basket snapshot (CHK-04, T-05-04)"
    - "Multi-vendor order splitting with allocate() at createPendingOrder time — vendor_orders created upfront with drift-free subtotals (ORD-02)"
    - "finalizeOrder idempotent by providerOrderId — OrderNotFoundError signals retry to webhook handler (Pitfall 8)"
    - "CheckoutService uses PaymentService abstraction — no stripe/razorpay imports (T-05-PAY, Pitfall 9)"
    - "Wallet applied before provider charge computation: grandTotal = subtotal + shipping - discount - wallet (WAL-05, D-13)"
    - "Inventory reservation at proceed-to-payment (initiateCheckout), NOT on basket add (CHK-05, D-06)"
    - "Windows worktree vitest fix: drizzle-orm/pg-core mocked via vitest.config.ts resolve.alias due to pnpm Unix symlinks not resolving on Windows in bash context"

key-files:
  created:
    - apps/api/src/modules/orders/OrderService.ts
    - apps/api/src/modules/orders/index.ts
    - apps/api/src/modules/orders/__tests__/OrderService.test.ts
    - apps/api/src/modules/checkout/CheckoutService.ts
    - apps/api/src/modules/checkout/index.ts
    - apps/api/src/modules/checkout/__tests__/CheckoutService.test.ts
    - apps/api/__mocks__/drizzle-orm/index.js
  modified:
    - apps/api/vitest.config.ts

key-decisions:
  - "vendor_orders are created at createPendingOrder time (not at finalizeOrder) because order_items.vendorOrderId is NOT NULL — the schema FK chain requires vendor_orders to exist before items are inserted"
  - "finalizeOrder looks up order by providerOrderId OUTSIDE the transaction first for the idempotency check, then enters transaction only when action is needed (optimistic idempotency pattern)"
  - "CheckoutService.computeSummary uses productService.getProductCatalogPrice() as the authority for prices — basket snapshot prices are loaded but discarded; only catalog prices are used in total computation (CHK-04)"
  - "Windows worktree pnpm resolution workaround: drizzle-orm/pg-core/node-postgres are Unix symlinks (not Windows junctions) in pnpm virtual store. Resolved via __mocks__/drizzle-orm/index.js + vitest.config.ts resolve.alias. This is a test-only infrastructure fix; production code is unaffected."
  - "allocate() ratios for vendor split use raw line subtotals (not percentages) — this ensures the largest-remainder method distributes residuals proportionally to actual item amounts"

patterns-established:
  - "Pattern: vendor split at order creation time using allocate(), not at finalization"
  - "Pattern: finalizeOrder as the single post-payment canonical path called by all webhook handlers"
  - "Pattern: vitest.config.ts resolve.alias in worktree for Windows pnpm symlink workaround"

requirements-completed: [CHK-03, CHK-04, CHK-05, ORD-01, ORD-02, ORD-03, ORD-05, WAL-05, MKT-01]

# Metrics
duration: "~24 minutes"
completed: "2026-06-03"
---

# Phase 05 Plan 09: CheckoutService + OrderService Orchestration Core Summary

**Server-authoritative checkout (catalog prices, coupon+wallet, provider order) and drift-free multi-vendor order splitting (allocate()), idempotent finalization, commission computation, and ownership-checked order reads**

## Performance

- **Duration:** ~24 min
- **Started:** 2026-06-03T13:48:26Z
- **Completed:** 2026-06-03T14:12:00Z
- **Tasks:** 2
- **Files created:** 8 (6 source + 1 mock + 1 config modified)

## Accomplishments

- **OrderService**: drift-free multi-vendor split via `allocate()` at `createPendingOrder` time; idempotent `finalizeOrder` keyed off `providerOrderId` (Pitfall 8); `CommissionService.computeCommission` called once per vendor sub-order (MKT-01); ownership-checked `getOrderById` (customerId) and `updateVendorOrderStatus` (vendorId)
- **CheckoutService**: `computeSummary` re-fetches authoritative prices from catalog via `ProductCatalogLookup.getProductCatalogPrice` — basket snapshot prices never trusted (CHK-04, T-05-04); full-wallet checkout yields grandTotal=0 card charge; `initiateCheckout` calls `InventoryService.reserveItems` at proceed-to-payment (CHK-05); `placeOrder` delegates to `PaymentService` with no SDK imports (T-05-PAY, Pitfall 9)
- **17 unit tests**: 11 OrderService + 6 CheckoutService, TDD RED→GREEN cycle for both tasks
- **Windows worktree infrastructure fix**: drizzle-orm/pg-core are Unix symlinks (not Windows junctions) in pnpm virtual store; resolved via `__mocks__/drizzle-orm/index.js` + `vitest.config.ts` resolve.alias

## Task Commits

| Task | Name | Commits | Files |
|------|------|---------|-------|
| 1 RED | OrderService failing tests | 5ef8190 | OrderService.test.ts |
| 1 GREEN | OrderService implementation | c7f1bcd | OrderService.ts, index.ts, __mocks__/drizzle-orm/index.js, vitest.config.ts, updated test |
| 2 RED | CheckoutService failing tests | 484dbcd | CheckoutService.test.ts |
| 2 GREEN | CheckoutService implementation | 7ea5c1a | CheckoutService.ts, index.ts |

## Verification

- `node vitest.mjs run src/modules/orders src/modules/checkout` → **17/17 tests pass**
- `grep -rn "from \"stripe\"\|from \"razorpay\"" apps/api/src/modules/checkout apps/api/src/modules/orders` → **empty (no SDK imports)**
- `finalizeOrder` idempotency: second call with `status=payment_received` → no writes (verified by test)
- `updateVendorOrderStatus` ownership: non-owning vendor → `VendorOrderOwnershipError` (verified by test)
- `computeSummary` tamper-rejection: basket snapshot price 9999, catalog price 1000 → subtotal uses 1000 (verified by test, CHK-04)
- `allocate()` reconciliation: `v1Amount + v2Amount === orderSubtotal` for awkward amounts (verified by test, ORD-02)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Windows pnpm Unix symlink issue for drizzle-orm in worktree**
- **Found during:** Task 1 test run
- **Issue:** `drizzle-orm/pg-core` and `drizzle-orm/node-postgres` are Unix symlinks in pnpm virtual store — not Windows junctions. Node.js (and vitest) cannot resolve them from bash shell context on Windows, causing `Cannot find package 'drizzle-orm'` errors.
- **Fix:** Created `apps/api/__mocks__/drizzle-orm/index.js` with comprehensive chainable column/operator mocks. Updated `vitest.config.ts` to add `resolve.alias` entries for `drizzle-orm`, `drizzle-orm/pg-core`, `drizzle-orm/node-postgres` pointing to the mock file.
- **Files modified:** `apps/api/__mocks__/drizzle-orm/index.js` (new), `apps/api/vitest.config.ts`
- **Impact:** Tests work correctly. Production code is unaffected (drizzle-orm resolves normally when pnpm scripts run via Windows CMD which resolves junctions correctly).

**2. [Rule 1 - Design Clarification] vendor_orders must be created at createPendingOrder (not finalizeOrder)**
- **Found during:** Task 1 implementation
- **Issue:** Initial plan design assumed vendor_orders could be created during `finalizeOrder`. However, `order_items.vendorOrderId` is `NOT NULL` in the schema — items cannot be inserted without a linked vendor_orders row.
- **Fix:** `createPendingOrder` now creates vendor_orders rows (with `status='pending_payment'`) alongside order_items. `finalizeOrder` updates their status to `payment_received` and triggers commissions. `allocate()` is called at creation time so sub-order amounts are pre-computed and stored.
- **Files modified:** `apps/api/src/modules/orders/OrderService.ts`

## Known Stubs

None — all methods are fully implemented with real business logic. No hardcoded empty values or placeholder data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-05-04 mitigated | CheckoutService.ts | computeSummary uses productService.getProductCatalogPrice — basket snapshot prices never used in totals |
| threat_flag: T-05-01 mitigated | CheckoutService.ts | initiateCheckout calls InventoryService.reserveItems — reservation at proceed-to-payment |
| threat_flag: T-05-02 mitigated | OrderService.ts | finalizeOrder idempotent by providerOrderId — second webhook delivery is a no-op |
| threat_flag: T-05-PAY mitigated | CheckoutService.ts | no stripe/razorpay SDK imports; verified by unit test + grep |

## Self-Check: PASSED

- [x] `apps/api/src/modules/orders/OrderService.ts` — FOUND
- [x] `apps/api/src/modules/orders/index.ts` — FOUND
- [x] `apps/api/src/modules/orders/__tests__/OrderService.test.ts` — FOUND
- [x] `apps/api/src/modules/checkout/CheckoutService.ts` — FOUND
- [x] `apps/api/src/modules/checkout/index.ts` — FOUND
- [x] `apps/api/src/modules/checkout/__tests__/CheckoutService.test.ts` — FOUND
- [x] `apps/api/__mocks__/drizzle-orm/index.js` — FOUND
- [x] Commit 5ef8190 (test/orders RED) — FOUND
- [x] Commit c7f1bcd (feat/orders GREEN) — FOUND
- [x] Commit 484dbcd (test/checkout RED) — FOUND
- [x] Commit 7ea5c1a (feat/checkout GREEN) — FOUND
- [x] 17 tests passing (11 orders + 6 checkout) — VERIFIED
- [x] No stripe/razorpay imports in checkout/orders modules — VERIFIED

## TDD Gate Compliance

- [x] RED gate: `test(05-09)` commits exist for both tasks — 5ef8190 (orders), 484dbcd (checkout)
- [x] GREEN gate: `feat(05-09)` commits exist after RED for both tasks — c7f1bcd (orders), 7ea5c1a (checkout)
- [x] REFACTOR gate: no refactor needed — code is clean as committed
