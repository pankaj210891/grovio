---
phase: 05-commerce-core
plan: 06
subsystem: backend/wallet,backend/commissions
tags: [wallet, commissions, tdd, bigint, append-only, idempotency, allocate]
dependency_graph:
  requires:
    - 05-04 (DB schema migration — wallet_entries, commission_rules, vendor_commission_entries, customers.wallet_balance_minor)
    - packages/contracts/money (allocate() function — MANDATORY for commission splits)
  provides:
    - apps/api/src/modules/wallet/WalletService.ts (WAL-01..05)
    - apps/api/src/modules/commissions/CommissionService.ts (MKT-01, MKT-02)
  affects:
    - 05-07 (CheckoutService will call WalletService.debit + CommissionService.computeCommission)
    - 05-08 (OrderService finalizeOrder will call both services)
    - 05-10 (ReturnService will call WalletService.credit for refund_credit entries)
tech_stack:
  added: []
  patterns:
    - append-only ledger with idempotency_key unique constraint (WAL-03, T-05-03)
    - Redis-first rate cache with DB fallback priority chain (D-14, FeatureFlagService analog)
    - allocate() BIGINT split for zero rounding drift (MKT-02, Pitfall 1/7)
    - sql template operator (sql`... +/- ${amount}`) for transactional balance updates (WAL-03)
key_files:
  created:
    - apps/api/src/modules/wallet/WalletService.ts
    - apps/api/src/modules/wallet/index.ts
    - apps/api/src/modules/wallet/__tests__/WalletService.test.ts
    - apps/api/src/modules/commissions/CommissionService.ts
    - apps/api/src/modules/commissions/index.ts
    - apps/api/src/modules/commissions/__tests__/CommissionService.test.ts
  modified: []
decisions:
  - "WalletService.debit() reads balance before transaction to fail fast on InsufficientWalletBalance; idempotency_key unique constraint is the final guard against double-spend (T-05-03)"
  - "CommissionService.resolveRate() converts NUMERIC(5,2) string to integer via Math.round(parseFloat(...)) before caching; fractional rates (e.g., 10.50%) are rounded to nearest integer for allocate() parts"
  - "contracts dist/ is gitignored; pnpm --filter @grovio/contracts build required in CI before API tests run"
metrics:
  duration: "~20 minutes"
  completed: "2026-06-03"
  tasks_completed: 2
  files_created: 6
---

# Phase 5 Plan 06: Wallet Ledger + Commission Engine Summary

**One-liner:** Append-only wallet ledger with idempotent credit/debit and hybrid checkout calc (WAL-01..05), plus Redis-cached priority-chain commission resolution with allocate()-guaranteed zero-drift splits (MKT-01, MKT-02).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | WalletService append-only ledger + hybrid checkout calc (WAL-01..05) | da6d054... (test: 3c37509, impl: 7320739) | WalletService.ts, index.ts, WalletService.test.ts |
| 2 | CommissionService priority chain + allocate() split (MKT-01, MKT-02) | da6d054 (test: f63a4ba, impl: da6d054) | CommissionService.ts, index.ts, CommissionService.test.ts |

## What Was Built

### WalletService (WAL-01..05)

**File:** `apps/api/src/modules/wallet/WalletService.ts`

The wallet is an append-only ledger. Five methods:

- `getBalance(customerId)` — reads `customers.wallet_balance_minor` cached column (WAL-01). O(1) read; no aggregate query.
- `getLedger(customerId)` — returns `wallet_entries` ordered by `createdAt` desc (WAL-02).
- `credit(params)` — inserts `entry_type='credit'` row + increments cached balance with `sql\`...+ amount\`` in one DB transaction. `onConflictDoNothing` on `idempotency_key` makes repeated calls a safe no-op (WAL-03, WAL-04, Pitfall 3).
- `debit(params)` — idempotency key `order:{orderId}:wallet-debit`; throws `InsufficientWalletBalanceError` if balance < amount; inserts `entry_type='debit'` + decrements cached balance transactionally (WAL-03, T-05-03).
- `computeWalletApplied(balance, requested, total)` — pure function returning `min(balance, requested, total)`, always >= 0. Used by CheckoutService to derive card-charge remainder (WAL-05, D-13).

**Security (T-05-03):** No method sets `wallet_balance_minor` directly — only `sql\`...+/-\`` updates paired with ledger inserts in a single transaction. The unique `idempotency_key` constraint prevents double-spend.

**Domain error:** `InsufficientWalletBalanceError` (code: `INSUFFICIENT_WALLET_BALANCE`).

### CommissionService (MKT-01, MKT-02)

**File:** `apps/api/src/modules/commissions/CommissionService.ts`

Two methods:

- `resolveRate(vendorId, categoryId)` — Redis-first cache (key: `commission:rate:{vendorId}:{categoryId}`). On cache miss: queries DB in vendor → category → global priority order; caches resolved rate with `FEATURE_FLAG_TTL_SECONDS` TTL (D-14, MKT-01). Returns integer (e.g., `10` for 10%).
- `computeCommission(params)` — calls `resolveRate`, splits `subtotalMinor` using `allocate(subtotalMinor, [rate, 100-rate])` from `@grovio/contracts/money`. Inserts `vendor_commission_entries` row with `status='earned'`. Returns `{commissionMinor, netVendorMinor}` as `bigint` values (MKT-02).

**Zero-drift guarantee (T-05-07):** `allocate()` uses the largest-remainder method — `commissionMinor + netVendorMinor === subtotalMinor` exactly for all amounts, including awkward values like 10001 at 33%.

**No float math:** `allocate()` receives `[rate, 100-rate]` integer parts — no `* 0.10` or `/ 100` anywhere (Pitfall 1, Pitfall 7).

## Test Coverage

| File | Tests | Key Behaviors |
|------|-------|---------------|
| WalletService.test.ts | 13 | getBalance, getLedger, credit+idempotency, debit+InsufficientBalance, debit idempotencyKey pattern, computeWalletApplied 5 cases |
| CommissionService.test.ts | 12 | resolveRate vendor/category/global/cache-hit/cache-set, computeCommission 10%+10000, exact reconciliation 10001@10%, exact reconciliation 10001@33%, exact reconciliation 9999@7%, status='earned', bigint return types |

**Total: 25 tests, 25 passing.**

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

### Deviation: contracts dist must be built before API tests

- **Found during:** Task 2, CommissionService GREEN phase
- **Issue:** `packages/contracts/dist/` is gitignored. `@grovio/contracts/money` couldn't be resolved by Vitest until the package was built.
- **Fix:** Ran `pnpm --filter @grovio/contracts build` to produce the dist. dist/ is intentionally gitignored (correct).
- **Impact:** CI pipelines must run `pnpm --filter @grovio/contracts build` before `pnpm --filter @grovio/api test`. This is expected for a workspace package with a build step.
- **Tracked as:** [Rule 3 - Blocking] Build contracts before API tests run

## Known Stubs

None — both services are fully wired against the DB schema from plan 05-04. No placeholder data or mock integrations.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: resolved T-05-03 | WalletService.ts | append-only + unique idempotency_key prevents wallet double-spend as specified in threat register |
| threat_flag: resolved T-05-07 | CommissionService.ts | allocate() BIGINT split guarantees commission + net === subtotal exactly — no tampering via rounding drift |

Both threats from the plan's threat register are mitigated as designed.

## Self-Check: PASSED

Files created:
- [x] apps/api/src/modules/wallet/WalletService.ts — FOUND
- [x] apps/api/src/modules/wallet/index.ts — FOUND
- [x] apps/api/src/modules/wallet/__tests__/WalletService.test.ts — FOUND
- [x] apps/api/src/modules/commissions/CommissionService.ts — FOUND
- [x] apps/api/src/modules/commissions/index.ts — FOUND
- [x] apps/api/src/modules/commissions/__tests__/CommissionService.test.ts — FOUND

Test run: 25 tests, 25 passing.

Acceptance criteria verified:
- [x] WalletService.ts exports `class WalletService` with all 5 required methods
- [x] No direct `wallet_balance_minor =` assignments (grep verified: only sql arithmetic)
- [x] computeWalletApplied test asserts min(balance, requested, total) and never negative
- [x] debit test asserts InsufficientWalletBalanceError when balance < amount
- [x] CommissionService.ts imports `allocate` from `@grovio/contracts/money`
- [x] resolveRate test asserts vendor > category > global precedence
- [x] computeCommission test asserts commissionMinor + netVendorMinor === subtotalMinor for awkward amounts
- [x] vendor_commission_entries inserts use status 'earned'
- [x] No float commission math (grep verified: no `* 0.` or `/ 100` in CommissionService.ts)
