---
phase: 05-commerce-core
plan: "03"
subsystem: commerce-schema
tags: [drizzle, schema, postgres, commerce, basket, inventory, orders, wallet, payments, commissions, coupons, returns]
dependency_graph:
  requires:
    - "04-02"  # customers, customer-addresses tables
    - "03-03"  # vendors, products, product-variants tables
    - "02-02"  # categories table
    - "05-01"  # contracts (enum values matched)
  provides:
    - "commerce-db-schema"
    - "13-new-drizzle-tables"
    - "phase5-env-vars"
  affects:
    - "05-04"  # migration plan reads this schema
    - "05-05"  # service plans reference these tables
tech_stack:
  added: []
  patterns:
    - "BIGINT minor units for all money columns (Pitfall 1)"
    - "pgEnum for all status columns (orderStatusEnum, returnStatusEnum, walletEntryTypeEnum, paymentProviderEnum, commissionStatusEnum)"
    - "Append-only tables with no updatedAt (wallet_entries, vendor_commission_entries per WAL-03)"
    - "Dual nullable FK pattern for inventory_items (D-20)"
    - "Two-column quantity model for inventory (quantityAvailable + quantityReserved, D-21)"
    - "Compound unique constraint for webhook idempotency (payment_events_provider_event_uniq, D-10)"
    - "NUMERIC(5,2) ONLY for ratePercent (never for money amounts, D-14)"
key_files:
  created:
    - apps/api/src/db/schema/basket-sessions.ts
    - apps/api/src/db/schema/basket-items.ts
    - apps/api/src/db/schema/inventory-items.ts
    - apps/api/src/db/schema/inventory-reservations.ts
    - apps/api/src/db/schema/orders.ts
    - apps/api/src/db/schema/vendor-orders.ts
    - apps/api/src/db/schema/order-items.ts
    - apps/api/src/db/schema/wallet-entries.ts
    - apps/api/src/db/schema/payment-events.ts
    - apps/api/src/db/schema/commission-rules.ts
    - apps/api/src/db/schema/vendor-commission-entries.ts
    - apps/api/src/db/schema/coupons.ts
    - apps/api/src/db/schema/return-requests.ts
    - apps/api/src/db/schema/vendor-return-policies.ts
  modified:
    - apps/api/src/db/schema/customers.ts
    - apps/api/src/db/schema/index.ts
    - apps/api/.env.example
    - apps/api/src/config/env.ts
    - apps/api/src/modules/customer-auth/CustomerAuthService.test.ts
decisions:
  - "wallet_balance_minor added directly to customers table (not a separate wallets table) — faster reads, simpler FK path for checkout, 1:1 customer:wallet in Phase 5"
  - "NUMERIC(5,2) used ONLY for ratePercent columns (commission_rules, vendor_commission_entries); all money amounts are BIGINT minor units"
  - "vendor_commission_entries and wallet_entries have no updatedAt column — append-only invariant enforced at schema level"
  - "inventory_reservations.orderId is nullable (null = reservation exists before order is created during payment step)"
  - "coupons.discountValue is BIGINT for both flat and percentage types — service layer interprets based on discountType"
metrics:
  duration: "~45 minutes"
  completed_date: "2026-06-02"
  tasks_completed: 2
  tasks_total: 2
  files_created: 14
  files_modified: 5
---

# Phase 5 Plan 03: Commerce Core Schema Definitions Summary

13 new Drizzle schema tables for basket, inventory, orders, wallet, payments, commissions, coupons, and returns — with all money as BIGINT minor units, append-only ledgers enforced at the schema level, and payment webhook idempotency via a compound unique constraint.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Basket, inventory, and wallet-balance schemas | c304dcb | basket-sessions.ts, basket-items.ts, inventory-items.ts, inventory-reservations.ts, customers.ts (+walletBalanceMinor) |
| 2 | Orders, wallet, payments, commissions, coupons, returns schemas + barrel + env | 0411ef6 | orders.ts, vendor-orders.ts, order-items.ts, wallet-entries.ts, payment-events.ts, commission-rules.ts, vendor-commission-entries.ts, coupons.ts, return-requests.ts, vendor-return-policies.ts, index.ts, .env.example, env.ts |

## Schema Summary

### Basket Domain
- **basket_sessions**: Guest (nullable customerId + unique guestToken cookie) and authenticated sessions. 30-day TTL via expiresAt (D-01, D-03, CHK-01).
- **basket_items**: BIGINT unitPriceMinor price snapshot; nullable productVariantId FK for variant-free products (D-20, CHK-01).

### Inventory Domain
- **inventory_items**: Dual nullable FK pattern — productVariantId OR productId non-null per row (D-20). Two-column model: quantityAvailable + quantityReserved for atomic reservations (D-21, CHK-05).
- **inventory_reservations**: Status reserved/consumed/expired. 15-minute expiresAt for BullMQ ReleaseReservationJob (D-07). orderId nullable (null = pre-order payment step).

### Customer Update
- **customers.walletBalanceMinor**: BIGINT cached balance column defaulting to 0 (WAL-01). Updated transactionally alongside every wallet_entries insert. Fast reads without aggregating ledger.

### Order Domain
- **orders**: orderStatusEnum (6 values matching contracts), displayId unique for customer-facing IDs, providerOrderId for webhook-to-order lookup (Pitfall 8). All money BIGINT.
- **vendor_orders**: Per-vendor sub-order. Uses shared orderStatusEnum. vendorSubtotalMinor input to CommissionService (ORD-02).
- **order_items**: Immutable price snapshot (no updatedAt). productName denormalized. lineSubtotalMinor pre-computed BIGINT.

### Wallet Domain
- **wallet_entries**: walletEntryTypeEnum (credit/debit/refund_credit matching contracts). idempotencyKey unique constraint prevents double-spend (WAL-03, T-05-03). NO updatedAt — append-only.

### Payments Domain
- **payment_events**: paymentProviderEnum (stripe/razorpay matching contracts). Compound unique constraint `payment_events_provider_event_uniq` on (provider, providerEventId) for webhook idempotency (D-10, PAY-03, T-05-02). payload JSONB for audit trail.

### Commission Domain
- **commission_rules**: ratePercent NUMERIC(5,2) — the ONLY non-BIGINT financial column. scope text (global/category/vendor matching CommissionScopeSchema). Nullable vendorId/categoryId FKs per priority chain (D-14).
- **vendor_commission_entries**: commissionStatusEnum (earned/reversed/net matching contracts). BIGINT money columns. NO updatedAt — append-only (MKT-01, MKT-03).

### Coupon Domain
- **coupons**: discountType/scopeType as text. discountValue BIGINT (no FLOAT). redemptionCount + maxRedemptions for usage cap. expiresAt + isActive for eligibility (D-17, D-18, CHK-06).

### Returns Domain
- **return_requests**: returnStatusEnum (4 values matching contracts). orderItemIds JSONB array. refundPreference text (wallet/original per D-16). vendorOrderId FK for commission reversal (MKT-03).
- **vendor_return_policies**: Per-vendor unique FK. returnWindowDays default 7. isReturnable boolean. Global fallback at service layer (D-22).

### Infrastructure
- **index.ts barrel**: 29 total exports (was 16 before), all 13 new tables in FK-dependency order.
- **env.ts + .env.example**: STRIPE_SECRET_KEY, STRIPE_PUBLISHABLE_KEY, STRIPE_WEBHOOK_SECRET, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET, RAZORPAY_WEBHOOK_SECRET (all optional — API boots without them). RESERVATION_TTL_MINUTES default 15.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed CustomerAuthService.test.ts mock missing walletBalanceMinor**
- **Found during:** Task 1 typecheck
- **Issue:** Adding `walletBalanceMinor` to the customers table made `SelectCustomer` require the new field. The existing test fixture `baseCustomer: SelectCustomer` was missing it, causing a TypeScript error.
- **Fix:** Added `walletBalanceMinor: 0` to the test fixture.
- **Files modified:** `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts`
- **Commit:** c304dcb (included in Task 1 commit)

**2. [Rule 3 - Blocker] Built @grovio/contracts package before typecheck**
- **Found during:** Task 1 typecheck
- **Issue:** The contracts package had not been built in this worktree environment; `@grovio/contracts` module was not found during typecheck.
- **Fix:** Ran `pnpm --filter @grovio/contracts build` to produce dist files.
- **Impact:** None (build-environment initialization, not a code issue).

## Threat Mitigations Applied

| Threat | Mitigation Applied |
|--------|--------------------|
| T-05-02 (Tampering: payment_events) | `payment_events_provider_event_uniq` compound unique constraint on (provider, providerEventId) — duplicate webhook delivery is a no-op |
| T-05-03 (Elevation: wallet_entries) | Append-only schema (no updatedAt) + unique idempotency_key column prevents double-spend and direct balance manipulation |
| T-05-01 (Tampering: inventory_items) | quantityAvailable + quantityReserved two-column model for atomic row-level reservation (service-layer SELECT FOR UPDATE) |
| T-05-07 (Tampering: money columns) | All money columns are BIGINT minor units; only ratePercent uses NUMERIC(5,2) — no FLOAT/DECIMAL anywhere |

## Known Stubs

None. This plan defines only schema tables. No UI components, no business logic, no hardcoded values that flow to rendering.

## Threat Flags

None — this plan only adds DB schema definitions and env var declarations. No new network endpoints, no new auth paths, no file access patterns were introduced.

## Self-Check: PASSED

### Files Created
- [x] apps/api/src/db/schema/basket-sessions.ts — FOUND
- [x] apps/api/src/db/schema/basket-items.ts — FOUND
- [x] apps/api/src/db/schema/inventory-items.ts — FOUND
- [x] apps/api/src/db/schema/inventory-reservations.ts — FOUND
- [x] apps/api/src/db/schema/orders.ts — FOUND
- [x] apps/api/src/db/schema/vendor-orders.ts — FOUND
- [x] apps/api/src/db/schema/order-items.ts — FOUND
- [x] apps/api/src/db/schema/wallet-entries.ts — FOUND
- [x] apps/api/src/db/schema/payment-events.ts — FOUND
- [x] apps/api/src/db/schema/commission-rules.ts — FOUND
- [x] apps/api/src/db/schema/vendor-commission-entries.ts — FOUND
- [x] apps/api/src/db/schema/coupons.ts — FOUND
- [x] apps/api/src/db/schema/return-requests.ts — FOUND
- [x] apps/api/src/db/schema/vendor-return-policies.ts — FOUND

### Commits Verified
- [x] c304dcb — Task 1: basket, inventory, wallet-balance schemas
- [x] 0411ef6 — Task 2: orders, wallet, payments, commissions, coupons, returns + barrel + env

### Verification Results
- [x] `pnpm --filter @grovio/api typecheck` — exits 0 (no errors)
- [x] `grep -rn "doublePrecision|real(" apps/api/src/db/schema/` — no matches in new files (money-only check; customer-addresses.ts uses doublePrecision for lat/lng which is correct — not money)
- [x] Barrel export count: 29 (was 16; increased by 13 for Phase 5 tables)
- [x] `inventory-items.js` present in barrel
- [x] `payment_events_provider_event_uniq` named constraint present in payment-events.ts
- [x] `idempotencyKey` unique in wallet-entries.ts, no updatedAt column
- [x] All enum values match their contracts counterparts (verified by grep)
- [x] `walletBalanceMinor` BIGINT on customers table
