---
phase: 05-commerce-core
plan: "05"
subsystem: api
tags: [basket, inventory, bullmq, tdd, CHK-01, CHK-02, CHK-05, D-02, D-06, D-07, D-21, D-24]

# Dependency graph
requires:
  - phase: 05-04
    provides: "Phase 5 migration applied, .for('update') confirmed, onConflictDoNothing confirmed"
  - phase: 05-03
    provides: "basket_sessions, basket_items, inventory_items, inventory_reservations DB schema"
  - phase: 05-01
    provides: "BasketSchema, BasketItemSchema contracts in packages/contracts/src/basket/"
provides:
  - "BasketService (getOrCreateGuestSession, addItem, updateItem, removeItem, getBasket, mergeGuestBasket)"
  - "BasketNotFoundError (BASKET_NOT_FOUND), InsufficientStockError (INSUFFICIENT_STOCK) from basket module"
  - "InventoryService (reserveItems, consumeReservation, releaseReservation)"
  - "InsufficientStockError (INSUFFICIENT_STOCK) from inventory module"
  - "processReleaseReservationJob (idempotent reservation expiry processor)"
  - "processBasketExpiryJob (expired basket session cleanup)"
  - "reservationQueue (BullMQ Queue, reservation-expiry-queue)"
  - "basketCleanupQueue (BullMQ Queue, basket-cleanup-queue)"
  - "startReservationWorker (BullMQ Worker factory, concurrency 5)"
  - "startBasketCleanupWorker (BullMQ Worker factory, concurrency 1)"
affects:
  - "05-09 (CheckoutService calls InventoryService.reserveItems on proceed-to-payment)"
  - "05-10 (basket routes consume BasketService; mergeGuestBasket on login)"
  - "05-11 (OrderService.finalizeOrder calls InventoryService.consumeReservation)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "TDD cycle (RED→GREEN) with test-first commits for both tasks"
    - "Drizzle .for('update') inside db.transaction() for row-level inventory lock (Pattern 2, RESEARCH.md)"
    - "BullMQ deterministic jobId `release-reservation:{id}` prevents duplicate expiry jobs (T-05-RES)"
    - "Job enqueue AFTER transaction commit — avoids enqueuing uncommitted reservations"
    - "Vendor-grouped basket items (D-24) with per-vendor subtotals from joined query"
    - "mergeGuestBasket: sum matching quantities, cap at inventory.quantityAvailable (D-02)"
    - "InsufficientStockError exported from both basket and inventory modules with identical interface"
    - "processReleaseReservationJob: idempotent pre-check outside transaction (status != 'reserved' → no-op)"
    - "Windows junction for node_modules: worktree/apps/api/node_modules → main repo (vitest access)"

key-files:
  created:
    - apps/api/src/modules/basket/BasketService.ts
    - apps/api/src/modules/basket/index.ts
    - apps/api/src/modules/basket/__tests__/BasketService.test.ts
    - apps/api/src/modules/inventory/InventoryService.ts
    - apps/api/src/modules/inventory/index.ts
    - apps/api/src/modules/inventory/__tests__/InventoryService.test.ts
    - apps/api/src/modules/jobs/release-reservation-job.ts
    - apps/api/src/modules/jobs/basket-expiry-job.ts
  modified:
    - apps/api/src/modules/jobs/queues.ts
    - apps/api/src/modules/jobs/workers.ts

key-decisions:
  - "InsufficientStockError defined independently in both basket and inventory modules (same code/name) to avoid a shared-errors cross-module import that could cause circular deps in future; callers can import from either"
  - "mergeGuestBasket reads inventory availability via LEFT JOIN on inventoryItems in transaction — avoids extra round-trip while keeping the merge atomic"
  - "releaseReservation does a pre-check outside the transaction (read-then-lock): sufficient because expired reservations are effectively immutable after TTL elapses"
  - "Windows junction created for node_modules to enable vitest to run in the git worktree (same approach as 05-01 SUMMARY)"

patterns-established:
  - "Pattern: SELECT FOR UPDATE via Drizzle .for('update') confirmed in 05-04, used directly here"
  - "Pattern: BullMQ job enqueued post-commit with deterministic jobId + delay"
  - "Pattern: processXxxJob follows product-index-job.ts: pure function with deps injection"

requirements-completed: [CHK-01, CHK-02, CHK-05]

# Metrics
duration: "~11 minutes"
completed: "2026-06-03"
---

# Phase 5 Plan 05: Basket + Inventory Core Summary

**BasketService (CRUD + guest-merge with stock cap) and InventoryService (SELECT FOR UPDATE atomic reservation + BullMQ idempotent delayed release jobs) with full unit test coverage**

## Performance

- **Duration:** ~11 min
- **Started:** 2026-06-03T00:23:01Z
- **Completed:** 2026-06-03T00:33:44Z
- **Tasks:** 2
- **Files modified:** 10 (8 created + 2 updated)

## Accomplishments

- BasketService with full CRUD, vendor-grouped `getBasket` (D-24), and `mergeGuestBasket` with stock-capped quantity summing (D-02)
- InventoryService with `reserveItems` using Drizzle `.for('update')` row-level lock (Pattern 2), enqueuing deterministic `release-reservation:{id}` jobs at 900000ms delay
- `processReleaseReservationJob`: idempotent (no-op when status != 'reserved'), returns stock on expiry
- `processBasketExpiryJob`: DELETE WHERE expiresAt < NOW, cascade-removes basket_items
- `queues.ts` updated: `reservationQueue` + `basketCleanupQueue` both reusing `bullMqConnection`
- `workers.ts` updated: `startReservationWorker` (concurrency 5) + `startBasketCleanupWorker` (concurrency 1)
- 22 unit tests (13 basket + 9 inventory) all green via TDD RED→GREEN cycle
- TypeScript clean (one pre-existing `@aws-sdk/client-s3` error in unrelated `ImageService.ts` — out of scope)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | BasketService failing tests | c3a919b | BasketService.test.ts |
| 1 GREEN | BasketService implementation | 3110661 | BasketService.ts, index.ts, updated test |
| 2 RED | InventoryService failing tests | 4d8de67 | InventoryService.test.ts |
| 2 GREEN | InventoryService + jobs implementation | c606623 | InventoryService.ts, index.ts, release-reservation-job.ts, basket-expiry-job.ts, queues.ts, workers.ts, updated test |

## Verification

- `pnpm --filter @grovio/api test -- src/modules/basket src/modules/inventory` → 22 passed, 0 failed
- `grep -rn "release-reservation:" apps/api/src/modules/inventory/` → confirms deterministic jobId in InventoryService.ts line 163
- TypeScript typecheck: only pre-existing `@aws-sdk/client-s3` error (unrelated to this plan)
- `queues.ts` exports `reservationQueue` and `basketCleanupQueue` — VERIFIED
- `workers.ts` exports `startReservationWorker` and `startBasketCleanupWorker` — VERIFIED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing handling] mergeGuestBasket: zero-stock edge case**
- **Found during:** Task 1 implementation
- **Issue:** Plan specified "cap at inventory.quantityAvailable" but didn't define behavior when available stock = 0 and customer already has the item
- **Fix:** When stock = 0 after cap, preserve existing customer quantity (don't discard silently) — falls back to current customer item quantity
- **Files modified:** `apps/api/src/modules/basket/BasketService.ts`
- **Commit:** 3110661

**2. [Rule 1 - Bug] TypeScript TS2502 circular type annotation in tests**
- **Found during:** Typecheck after Task 2
- **Issue:** `(fn: (tx: typeof tx) => unknown)` creates circular type reference
- **Fix:** Changed to `(fn: (txArg: unknown) => unknown)` in both test files
- **Files modified:** `BasketService.test.ts`, `InventoryService.test.ts`
- **Commit:** c606623

**3. [Rule 3 - Blocking] node_modules missing in git worktree**
- **Found during:** Initial test run
- **Issue:** Worktree has no `node_modules/` — vitest could not be found
- **Fix:** Created Windows junctions: `worktree/node_modules` → `main/node_modules`, `worktree/apps/api/node_modules` → `main/apps/api/node_modules`
- **Files modified:** None (junctions only)
- **Commit:** N/A (junctions not tracked in git)

## Known Stubs

None — all methods are fully implemented and connected to the DB schema from Plan 05-03/05-04.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-05-01 mitigated | apps/api/src/modules/inventory/InventoryService.ts | SELECT FOR UPDATE row lock inside transaction serializes concurrent reservations |
| threat_flag: T-05-RES mitigated | apps/api/src/modules/inventory/InventoryService.ts + jobs/release-reservation-job.ts | Deterministic jobId prevents duplicate release jobs; idempotent processor checks status before acting |
| threat_flag: T-05-BSK mitigated | apps/api/src/modules/basket/BasketService.ts | BasketNotFoundError on unknown guest tokens; token is random UUID |

## Self-Check: PASSED

- [x] `apps/api/src/modules/basket/BasketService.ts` — FOUND
- [x] `apps/api/src/modules/basket/index.ts` — FOUND
- [x] `apps/api/src/modules/basket/__tests__/BasketService.test.ts` — FOUND
- [x] `apps/api/src/modules/inventory/InventoryService.ts` — FOUND
- [x] `apps/api/src/modules/inventory/index.ts` — FOUND
- [x] `apps/api/src/modules/inventory/__tests__/InventoryService.test.ts` — FOUND
- [x] `apps/api/src/modules/jobs/release-reservation-job.ts` — FOUND
- [x] `apps/api/src/modules/jobs/basket-expiry-job.ts` — FOUND
- [x] Commit c3a919b (test/basket RED) — FOUND
- [x] Commit 3110661 (feat/basket GREEN) — FOUND
- [x] Commit 4d8de67 (test/inventory RED) — FOUND
- [x] Commit c606623 (feat/inventory GREEN) — FOUND
- [x] 22 tests passing (13 basket + 9 inventory) — VERIFIED
- [x] Deterministic jobId `release-reservation:` grep — VERIFIED
- [x] `queues.ts` exports `reservationQueue` + `basketCleanupQueue` — VERIFIED
- [x] `workers.ts` exports `startReservationWorker` + `startBasketCleanupWorker` — VERIFIED

## TDD Gate Compliance

- [x] RED gate: `test(05-05)` commits exist for both tasks — c3a919b, 4d8de67
- [x] GREEN gate: `feat(05-05)` commits exist after RED for both tasks — 3110661, c606623
- [x] REFACTOR gate: no refactor needed — code is clean as committed
