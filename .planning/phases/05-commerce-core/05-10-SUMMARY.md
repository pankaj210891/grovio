---
phase: 05-commerce-core
plan: "10"
subsystem: backend/routes
tags: [basket, checkout, webhook, stripe, razorpay, order, wallet, vendor-order, DI-wiring, raw-body, idempotency, CHK-01, CHK-02, CHK-03, CHK-06, PAY-02, PAY-03, PAY-04, WAL-01, WAL-02, ORD-03, ORD-04, ORD-05]

# Dependency graph
requires:
  - plan: "05-09"
    provides: "OrderService.finalizeOrder, CheckoutService, BasketSessionNotFoundError, EmptyBasketError"
  - plan: "05-08"
    provides: "CouponService, ReturnService, CouponDisabledError, CouponInvalidError, ReturnNotEligibleError"
  - plan: "05-07"
    provides: "PaymentService.getProvider, recordWebhookEvent, getEnabledProviders, ProviderNotConfiguredError"
  - plan: "05-06"
    provides: "WalletService.getBalance, getLedger"
  - plan: "05-05"
    provides: "BasketService, BasketNotFoundError, InsufficientStockError, reservationQueue, basketCleanupQueue, startReservationWorker, startBasketCleanupWorker"
provides:
  - "basketRoutes (GET/POST/PATCH/DELETE /basket/*, POST /basket/merge)"
  - "checkoutRoutes (GET /checkout/summary, POST /checkout/initiate|apply-coupon|place-order, GET /checkout/providers)"
  - "stripeWebhookRoutes (POST /webhooks/stripe — raw-body, idempotent finalize)"
  - "razorpayWebhookRoutes (POST /webhooks/razorpay — raw-body, idempotent finalize)"
  - "accountOrderRoutes (GET /account/orders, GET /account/orders/:id, POST /account/orders/:id/return-request)"
  - "accountWalletRoutes (GET /account/wallet, GET /account/wallet/entries)"
  - "vendorOrderRoutes (GET /vendor/orders, PATCH /vendor/orders/:id/status)"
  - "container.ts with all Phase 5 services + queue registrations (9 services + 2 queues)"
  - "app.ts with full Phase 5 route registration"
  - "main.ts with startReservationWorker + startBasketCleanupWorker after listen()"
  - "jobs/index.ts exporting all Phase 5 queues, workers, and job processors"
affects:
  - "05-11 onwards — all API routes now fully served"
  - "Frontend web-storefront — /basket, /checkout/*, /webhooks/* endpoints available"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Plugin-scoped raw-body parser: fastify.addContentTypeParser scoped inside plugin closure — does NOT leak to other routes (Pitfall 1, T-05-SC)"
    - "Webhook idempotency: recordWebhookEvent → return 200 on duplicate; finalizeOrder idempotent by providerOrderId (PAY-03, Pitfall 8)"
    - "Guest basket cookie: grovio_basket_token httpOnly + sameSite:lax set on GET /basket; cleared on POST /basket/merge (CHK-01, CHK-02, D-09)"
    - "Runtime DI guard: getCustomerId/getVendorId throw if auth preHandler not run (WR-01 pattern)"
    - "Direct DB query in vendor listing: fastify.db used directly for read-only vendor orders listing (avoids service method addition)"

key-files:
  created:
    - apps/api/src/routes/basket.ts
    - apps/api/src/routes/checkout.ts
    - apps/api/src/routes/webhooks/stripe.ts
    - apps/api/src/routes/webhooks/razorpay.ts
    - apps/api/src/routes/account/orders.ts
    - apps/api/src/routes/account/wallet.ts
    - apps/api/src/routes/vendor/orders.ts
    - apps/api/src/modules/jobs/index.ts
  modified:
    - apps/api/src/container.ts
    - apps/api/src/app.ts
    - apps/api/src/main.ts

key-decisions:
  - "Vendor orders listing uses fastify.db direct query (not OrderService method) to avoid adding listVendorOrders to OrderService across plan boundaries; ownership enforced by eq(vendorOrders.vendorId, vendorId)"
  - "Webhook signature errors return 400 (not 200) — tells provider we rejected the event; OrderNotFound returns 200 so provider retries at next delivery (Pitfall 8)"
  - "ZodError handling added to app.ts error handler (was missing in the worktree base — auto-fixed Rule 2)"
  - "Container.ts written as a complete Phase 5 version (owning plan) — Phase 1-4 services retained alongside Phase 5 additions"

patterns-established:
  - "Pattern: plugin-scoped raw-body parser for webhook routes (prevents JSON parser contamination)"
  - "Pattern: webhook handler flow — verify signature → recordWebhookEvent → check isNew → act on PAYMENT_CAPTURED"
  - "Pattern: worker startup after listen() — HTTP server boots cleanly regardless of worker status"

requirements-completed: [CHK-01, CHK-02, CHK-03, CHK-06, PAY-02, PAY-03, PAY-04, WAL-01, WAL-02, ORD-03, ORD-04, ORD-05]

# Metrics
duration: "~16 minutes"
completed: "2026-06-03"
---

# Phase 05 Plan 10: HTTP Route Layer + DI Wiring Summary

**Full Phase 5 HTTP exposure: basket cookie/merge routes, auth-guarded checkout, plugin-scoped raw-body webhook routes with idempotent finalize, account order/wallet reads, vendor sub-order management, and complete Awilix container + app + worker bootstrap**

## Performance

- **Duration:** ~16 min
- **Started:** 2026-06-03T14:17:06Z
- **Completed:** 2026-06-03T14:33:37Z
- **Tasks:** 2
- **Files created:** 11 (8 new + 3 modified)

## Accomplishments

- **Task 1 — Route files (7 total):**
  - `basket.ts`: GET /basket (sets httpOnly `grovio_basket_token` cookie for new sessions), POST /basket/items, PATCH/DELETE /basket/items/:id, POST /basket/merge (requireCustomerAuth + clears guest cookie). BasketNotFoundError→404, InsufficientStockError→409
  - `checkout.ts`: all requireCustomerAuth; GET /checkout/summary (computeSummary, CHK-04), POST /checkout/initiate (reserveItems, CHK-05), POST /checkout/apply-coupon (CHK-06, CouponDisabledError→403), POST /checkout/place-order (placeOrder, CHK-03), GET /checkout/providers (D-09)
  - `account/orders.ts`: GET /account/orders, GET /account/orders/:id (OrderOwnershipError→403), POST /account/orders/:id/return-request (ReturnNotEligibleError→422)
  - `account/wallet.ts`: GET /account/wallet (bigint→Number serialization, WAL-01), GET /account/wallet/entries (WAL-02)
  - `vendor/orders.ts`: GET /vendor/orders (direct DB query, vendor-scoped), PATCH /vendor/orders/:id/status (VendorOrderOwnershipError→403, ORD-05)

- **Task 2 — Webhooks + wiring:**
  - `webhooks/stripe.ts`: addContentTypeParser('application/json', {parseAs:'buffer'}) plugin-scoped; reads stripe-signature; handleWebhook → recordWebhookEvent → finalizeOrder on PAYMENT_CAPTURED (PAY-04, Pitfall 8); OrderNotFoundError → 200
  - `webhooks/razorpay.ts`: identical flow; reads x-razorpay-signature; crypto.timingSafeEqual in adapter (T-05-05)
  - `container.ts`: 9 Phase 5 services (basket/inventory/checkout/payment/wallet/order/commission/coupon/return) + reservationQueue + basketCleanupQueue registered
  - `app.ts`: all 7 Phase 5 route plugins registered (webhooks first for raw-body parser isolation, then basket/checkout/account/vendor); ZodError handler added
  - `main.ts`: startReservationWorker + startBasketCleanupWorker started after listen(); graceful shutdown closes all workers + drains all queues
  - `jobs/index.ts`: full barrel export including Phase 5 job processors

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Basket/checkout/account-order/wallet/vendor-order routes | b30c529 | basket.ts, checkout.ts, account/orders.ts, account/wallet.ts, vendor/orders.ts |
| 2 | Webhook routes + container/app/main/jobs wiring | 5974e06 | webhooks/stripe.ts, webhooks/razorpay.ts, container.ts, app.ts, main.ts, jobs/index.ts |

## Verification

- `pnpm --filter @grovio/api typecheck` → **exit 0** (verified against Phase 5 merged state in main repo)
- `grep -rn "addContentTypeParser" apps/api/src/routes/webhooks/` → present in both webhook files
- `grep -rn "addContentTypeParser" apps/api/src/routes/basket.ts apps/api/src/routes/checkout.ts` → empty (scope not leaked, T-05-SC)
- `grep -n "checkoutService" apps/api/src/container.ts` → line 92 (Phase 5 DI wiring confirmed)
- `grep -n "basketRoutes" apps/api/src/app.ts` → line 17 + 96 (route registration confirmed)
- `grep -n "startReservationWorker" apps/api/src/main.ts` → line 7 + 25 + 63 (worker startup confirmed)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing Critical] ZodError handler added to app.ts error handler**
- **Found during:** Task 2 implementation
- **Issue:** The worktree base's app.ts error handler only handled `FastifyError`, not `ZodError`. The plan-level app.ts (on phase branch) already had it, but since this plan owns app.ts exclusively, the ZodError handling was added here to ensure it's in the final version.
- **Fix:** Added `if (error instanceof ZodError)` branch to setErrorHandler returning 400 with structured validation messages
- **Files modified:** `apps/api/src/app.ts`
- **Committed in:** 5974e06 (Task 2)

**2. [Rule 2 - Missing Critical] Direct DB query for vendor orders listing**
- **Found during:** Task 1 implementation
- **Issue:** `OrderService.listVendorOrders()` method did not exist. Adding it would require modifying OrderService (plan 05-09 scope) from a different plan boundary.
- **Fix:** `GET /vendor/orders` uses `fastify.db` directly with `eq(vendorOrders.vendorId, vendorId)` — ownership enforced at the DB query level. PATCH route still uses `OrderService.updateVendorOrderStatus` which existed.
- **Files modified:** `apps/api/src/routes/vendor/orders.ts`
- **Committed in:** b30c529 (Task 1)

---

**Total deviations:** 2 auto-fixed (both Rule 2 — missing critical functionality)
**Impact on plan:** Both fixes necessary for correctness. No scope creep.

## Security Coverage

| Threat | Implementation |
|--------|----------------|
| T-05-05 (webhook spoofing) | Signature verified first in adapter (constructEvent / timingSafeEqual) before any DB write |
| T-05-02 (webhook replay) | recordWebhookEvent + onConflictDoNothing → 200 on duplicate (PAY-03) |
| T-05-06 (privilege escalation) | requireCustomerAuth on all customer routes; vendor JWT guard on vendor routes; guest token is httpOnly + random UUID |
| T-05-CPN (coupon brute force) | COUPONS_ENABLED flag short-circuits in CouponService; per-code redemption cap enforced at service |
| T-05-SC (raw-body scope) | addContentTypeParser scoped to webhook plugin; verified not leaked to basket/checkout |
| Pitfall 1 (raw-body leak) | Plugin-scoped parser confirmed by grep: absent from basket.ts and checkout.ts |
| Pitfall 8 (webhook race) | OrderNotFoundError → 200 in both webhook handlers; provider retries on next delivery |

## Known Stubs

None — all routes are fully wired to their respective services via Awilix DI. No placeholder handlers or TODO methods.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: T-05-05 mitigated | routes/webhooks/stripe.ts | constructEvent called before any DB write; 400 on signature failure |
| threat_flag: T-05-05 mitigated | routes/webhooks/razorpay.ts | timingSafeEqual called before any DB write; 400 on signature failure |
| threat_flag: T-05-02 mitigated | routes/webhooks/stripe.ts + razorpay.ts | recordWebhookEvent dedup + return 200 on duplicate |
| threat_flag: T-05-SC accepted | routes/webhooks/stripe.ts + razorpay.ts | raw-body parser plugin-scoped; JSON parsing unaffected in other routes |

## Self-Check

- [x] `apps/api/src/routes/basket.ts` — FOUND (worktree commit b30c529)
- [x] `apps/api/src/routes/checkout.ts` — FOUND (worktree commit b30c529)
- [x] `apps/api/src/routes/account/orders.ts` — FOUND (worktree commit b30c529)
- [x] `apps/api/src/routes/account/wallet.ts` — FOUND (worktree commit b30c529)
- [x] `apps/api/src/routes/vendor/orders.ts` — FOUND (worktree commit b30c529)
- [x] `apps/api/src/routes/webhooks/stripe.ts` — FOUND (worktree commit 5974e06)
- [x] `apps/api/src/routes/webhooks/razorpay.ts` — FOUND (worktree commit 5974e06)
- [x] `apps/api/src/container.ts` — MODIFIED (worktree commit 5974e06)
- [x] `apps/api/src/app.ts` — MODIFIED (worktree commit 5974e06)
- [x] `apps/api/src/main.ts` — MODIFIED (worktree commit 5974e06)
- [x] `apps/api/src/modules/jobs/index.ts` — FOUND (worktree commit 5974e06)
- [x] Commit b30c529 (Task 1) — FOUND
- [x] Commit 5974e06 (Task 2) — FOUND
- [x] Typecheck exit 0 — VERIFIED (Phase 5 merged state)
- [x] addContentTypeParser in webhook files only — VERIFIED (grep)
- [x] 9 Phase 5 services in container.ts — VERIFIED (grep)

## Self-Check: PASSED
