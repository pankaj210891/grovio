---
phase: 05-commerce-core
verified: 2026-06-05T00:00:00Z
status: human_needed
score: 12/13 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Complete the checkout wizard end-to-end in the browser"
    expected: "4-step guard prevents step skipping; Stripe/Razorpay payment options match configured keys; wallet hybrid charge shows correct card-charge remainder; successful payment lands on /order-confirmation; order appears in /account/orders with vendor grouping and return request action; /account/wallet shows balance and ledger"
    why_human: "Plan 05-12 Task 3 (checkpoint:human-verify gate=blocking) is explicitly marked PENDING in 05-12-SUMMARY.md. Requires Stripe/Razorpay test keys and a live browser session to exercise PAY-04, WAL-05, ORD-01, ORD-03, ORD-04."
---

# Phase 5: Commerce Core Verification Report

**Phase Goal:** A customer can complete a purchase end-to-end — basket management, checkout with inventory reservation, payment via Stripe or Razorpay, wallet usage, order placement with multi-vendor splitting, and commission calculation — with every money operation backend-authoritative and financially correct
**Verified:** 2026-06-05
**Status:** human_needed
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|----------|
| 1 | Every Phase 5 API request/response shape has a Zod schema + inferred type in packages/contracts | VERIFIED | All six domain dirs (basket, checkout, orders, wallet, payments, commissions) exist with types.ts + index.ts; root barrel exports all six via `export * from` |
| 2 | All money fields in contracts are z.number().int() — never bigint, never float | VERIFIED | grep of all six contract domains returns zero z.bigint() hits; checkout/types.ts explicitly shows `.int()` on every money field; no raw z.number() without .int() |
| 3 | All 13 new Phase 5 tables are defined as Drizzle pgTable schemas and exported from the barrel | VERIFIED | All 13 files confirmed present in apps/api/src/db/schema/; barrel index.ts has 29 exports (up from 16) in FK-dependency order |
| 4 | wallet_entries is append-only (no updatedAt) with unique idempotency_key | VERIFIED | wallet-entries.ts: `idempotencyKey: text(...).notNull().unique()` at line 83; no updatedAt column per grep; vendor-commission-entries.ts also lacks updatedAt |
| 5 | payment_events has unique (provider, provider_event_id) constraint | VERIFIED | payment-events.ts: `payment_events_provider_event_uniq` constraint found at line 100 |
| 6 | A Drizzle migration was generated and applied for all 13 Phase 5 tables + customers.wallet_balance_minor | VERIFIED | Migration `20260602194354_strange_whistler/migration.sql` exists and contains CREATE TABLE for inventory_items, wallet_entries; ALTER TABLE customers for wallet_balance_minor; seed-commerce.ts confirmed present with COUPONS_ENABLED + global 10% rate |
| 7 | BasketService supports CRUD + guest basket merge with stock-capped summing (CHK-01, CHK-02) | VERIFIED | BasketService.ts has mergeGuestBasket; BasketNotFoundError + InsufficientStockError exported; deterministic jobId `release-reservation:{id}` confirmed in InventoryService.ts |
| 8 | InventoryService reserves stock atomically via row-level lock and enqueues idempotent delayed release job (CHK-05) | VERIFIED | InventoryService.ts uses `.for('update')` confirmed working; reserveItems/consumeReservation/releaseReservation all present; queues.ts exports reservationQueue + basketCleanupQueue using bullMqConnection |
| 9 | WalletService is append-only with idempotency, and CommissionService uses allocate() with priority chain | VERIFIED | WalletService.ts: idempotencyKey-based credit/debit confirmed; computeWalletApplied present; CommissionService.ts imports allocate from @grovio/contracts/money at line 5; resolveRate + computeCommission confirmed |
| 10 | All payment business logic depends only on PaymentProvider interface — stripe/razorpay SDKs confined to adapters (PAY-01, PAY-02) | VERIFIED | grep for `from "stripe"` across all modules returns ONLY StripeAdapter.ts; same for razorpay → only RazorpayAdapter.ts; PaymentService has getEnabledProviders + recordWebhookEvent; no SDK imports in CheckoutService confirmed |
| 11 | CouponService short-circuits on COUPONS_ENABLED flag; ReturnService checks eligibility and credits wallet + reverses commission via allocate() | VERIFIED | CouponService.ts calls featureFlagService.getFlag('COUPONS_ENABLED') before any DB lookup; ReturnService.ts imports allocate; approveReturn issues refund_credit + commission reversal via append-only insert |
| 12 | CheckoutService computes totals server-side re-fetching catalog prices; OrderService splits multi-vendor orders with allocate() and finalizes idempotently (CHK-04, ORD-02) | VERIFIED | CheckoutService.ts uses productService.getProductCatalogPrice — basket snapshot discarded; no stripe/razorpay imports; OrderService.ts imports allocate at line 3, uses it for vendorSubtotalMinor split; finalizeOrder is idempotent on providerOrderId |
| 13 | End-to-end checkout wizard with payment (Stripe/Razorpay) + wallet + order confirmation + account order/wallet pages are verified working in the browser | UNCERTAIN | All components confirmed present and wired: StripePaymentForm uses Elements+PaymentElement+confirmPayment; RazorpayButton loads CDN and uses order_id; CheckoutGuard uses Navigate; 4 checkout routes confirmed in router.tsx; WalletCreditToggle wired in CheckoutPaymentPage with real useWallet data. HOWEVER: Plan 05-12 Task 3 (blocking human-verify gate) is explicitly PENDING in 05-12-SUMMARY.md — live browser verification with Stripe/Razorpay test keys has not been performed |

**Score:** 12/13 truths verified (truth #13 is UNCERTAIN pending human verification)

---

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `packages/contracts/src/basket/types.ts` | Basket, BasketItem, AddToBasketInput schemas | VERIFIED | BasketItemSchema, BasketSchema, AddToBasketInputSchema all exported |
| `packages/contracts/src/orders/types.ts` | Order, VendorOrder, OrderStatus schemas | VERIFIED | OrderStatusSchema with exactly 6 enum values confirmed |
| `packages/contracts/src/wallet/types.ts` | WalletBalance, WalletEntry schemas | VERIFIED | WalletEntrySchema, WalletBalanceSchema exported |
| `packages/contracts/src/payments/types.ts` | InitiatePaymentInput, PaymentProviderId schemas | VERIFIED | PaymentProviderIdSchema (stripe, razorpay), EnabledProvidersSchema exported |
| `packages/contracts/src/index.ts` | Root barrel with 6 new domain exports | VERIFIED | All 6 `export * from` lines present for basket/checkout/orders/wallet/payments/commissions |
| `apps/api/src/db/schema/inventory-items.ts` | inventory_items table (D-20, D-21) | VERIFIED | quantityAvailable + quantityReserved present; dual nullable FK pattern confirmed |
| `apps/api/src/db/schema/orders.ts` | orders table + orderStatusEnum | VERIFIED | orderStatusEnum pgEnum with 6 values; displayId unique; providerOrderId nullable |
| `apps/api/src/db/schema/wallet-entries.ts` | Append-only wallet ledger | VERIFIED | idempotencyKey unique; no updatedAt column |
| `apps/api/src/db/schema/payment-events.ts` | Webhook idempotency table | VERIFIED | payment_events_provider_event_uniq constraint confirmed |
| `apps/api/src/db/schema/index.ts` | Barrel with all 13 new tables | VERIFIED | 29 total exports including inventory-items.js |
| `apps/api/src/db/migrations/20260602194354_strange_whistler/migration.sql` | Phase 5 SQL migration | VERIFIED | Contains CREATE TABLE inventory_items, wallet_entries |
| `apps/api/src/db/seed-commerce.ts` | COUPONS_ENABLED + global commission seed | VERIFIED | COUPONS_ENABLED flag and ratePercent='10.00' global commission seed confirmed |
| `apps/api/src/modules/basket/BasketService.ts` | Basket CRUD + merge | VERIFIED | mergeGuestBasket, BasketNotFoundError, InsufficientStockError all exported |
| `apps/api/src/modules/inventory/InventoryService.ts` | Atomic reservation + release | VERIFIED | reserveItems with `.for('update')`, consumeReservation, releaseReservation confirmed |
| `apps/api/src/modules/jobs/release-reservation-job.ts` | Delayed reservation release worker | VERIFIED | processReleaseReservationJob with idempotent status check at line 63 |
| `apps/api/src/modules/jobs/queues.ts` | reservationQueue + basketCleanupQueue | VERIFIED | Both queues using bullMqConnection confirmed |
| `apps/api/src/modules/wallet/WalletService.ts` | Append-only ledger + hybrid checkout calc | VERIFIED | idempotencyKey usage, computeWalletApplied, InsufficientWalletBalanceError confirmed |
| `apps/api/src/modules/commissions/CommissionService.ts` | Priority chain + allocate() split | VERIFIED | imports allocate from @grovio/contracts/money; resolveRate + computeCommission confirmed |
| `apps/api/src/modules/payments/PaymentProvider.ts` | PaymentProvider interface | VERIFIED | `interface PaymentProvider` at line 129 |
| `apps/api/src/modules/payments/StripeAdapter.ts` | Stripe SDK adapter (only file importing stripe) | VERIFIED | `import Stripe from "stripe"` present; no other module imports stripe |
| `apps/api/src/modules/payments/PaymentService.ts` | Provider selection + abstraction | VERIFIED | getEnabledProviders + recordWebhookEvent at lines 93, 161; no stripe/razorpay imports |
| `apps/api/src/modules/coupons/CouponService.ts` | Feature-flagged coupon validation | VERIFIED | CouponDisabledError, COUPONS_ENABLED flag check before DB lookup confirmed |
| `apps/api/src/modules/returns/ReturnService.ts` | Return eligibility + approval with commission reversal | VERIFIED | allocate imported; approveReturn with refund_credit + commission reversal confirmed |
| `apps/api/src/modules/checkout/CheckoutService.ts` | Server-authoritative pricing + reservation + order creation | VERIFIED | computeSummary re-fetches catalog prices; reserveItems called; no stripe/razorpay imports |
| `apps/api/src/modules/orders/OrderService.ts` | Vendor splitting + finalization + reads | VERIFIED | allocate imported; vendorSubtotalMinor split confirmed; finalizeOrder idempotent |
| `apps/api/src/routes/webhooks/stripe.ts` | Raw-body Stripe webhook with idempotent finalize | VERIFIED | addContentTypeParser scoped to plugin; recordWebhookEvent + finalizeOrder confirmed |
| `apps/api/src/container.ts` | Phase 5 service + queue registrations | VERIFIED | All 9 services (basket/inventory/checkout/payment/wallet/order/commission/coupon/return) + reservationQueue + basketCleanupQueue at lines 100-108 |
| `apps/api/src/app.ts` | Phase 5 route registration | VERIFIED | basketRoutes + all 7 Phase 5 route plugins registered |
| `apps/api/src/main.ts` | Worker startup | VERIFIED | startReservationWorker + startBasketCleanupWorker started after listen() confirmed |
| `apps/api/package.json` | stripe + razorpay dependencies | VERIFIED | stripe@22.2.0 + razorpay@2.9.6 confirmed |
| `apps/web-storefront/package.json` | @stripe/stripe-js + @stripe/react-stripe-js | VERIFIED | @stripe/react-stripe-js@6.5.0 + @stripe/stripe-js@9.7.0 confirmed |
| `apps/web-storefront/src/hooks/useBasket.ts` | Basket query + mutations | VERIFIED | useBasket, useAddToBasket, useRemoveBasketItem, useMergeBasket all exported |
| `apps/web-storefront/src/pages/CartPage.tsx` | Vendor-grouped cart + summary | VERIFIED | groupedByVendor.map vendor sections + OrderSummary confirmed |
| `apps/web-storefront/src/pages/ProductDetailPage.tsx` | Add to Cart wired (no data-phase placeholder) | VERIFIED | data-phase="5" count = 0; useAddToBasket mutation wired |
| `apps/web-storefront/src/components/layout/Header.tsx` | Live basket count badge | VERIFIED | itemCount from useBasket; badge hidden at 0; /cart link confirmed |
| `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx` | Step-skip prevention | VERIFIED | Navigate used for redirects; derives state from React Query + Zustand |
| `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx` | Stripe Elements payment form | VERIFIED | Elements + PaymentElement + confirmPayment from @stripe/react-stripe-js confirmed |
| `apps/web-storefront/src/components/checkout/RazorpayButton.tsx` | Razorpay CDN modal | VERIFIED | window.Razorpay + order_id (Pitfall 4) + CDN script URL confirmed; no npm razorpay import |
| `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx` | Stripe + Razorpay + wallet payment step | VERIFIED | WalletCreditToggle wired to useWallet balance; StripePaymentForm + RazorpayButton conditionally rendered by provider config |
| `apps/web-storefront/src/pages/account/WalletPage.tsx` | Wallet balance + ledger UI | VERIFIED | useWallet hook connected; balance card + ledger table |
| `apps/web-storefront/src/router.tsx` | All Phase 5 routes including checkout/payment | VERIFIED | checkout/address/delivery/payment/review + /order-confirmation/:orderId + /account/orders + /account/wallet all confirmed |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `packages/contracts/src/index.ts` | basket/checkout/orders/wallet/payments/commissions barrels | `export * from` | VERIFIED | All 6 new domain barrels exported; plus vendor/admin added in Phase 6 |
| `apps/api/src/modules/inventory/InventoryService.ts` | reservationQueue | `queue.add with jobId release-reservation:{id}` | VERIFIED | Deterministic jobId at line 208; 900000ms delay (15 min) |
| `apps/api/src/modules/commissions/CommissionService.ts` | allocate from @grovio/contracts/money | `import allocate` | VERIFIED | Import at line 5; used for commission/net split |
| `apps/api/src/modules/wallet/WalletService.ts` | wallet_entries + customers.wallet_balance_minor | `transactional insert + cached balance update` | VERIFIED | onConflictDoNothing on idempotencyKey; sql arithmetic update on wallet_balance_minor |
| `apps/api/src/routes/webhooks/stripe.ts` | OrderService.finalizeOrder | `PaymentService.recordWebhookEvent then finalize on PAYMENT_CAPTURED` | VERIFIED | finalizeOrder called at line 81; recordWebhookEvent at line 68 |
| `apps/api/src/main.ts` | startReservationWorker + startBasketCleanupWorker | worker startup after listen | VERIFIED | Both workers started at lines 63 and 72 |
| `apps/api/src/container.ts` | All 9 Phase 5 services + 2 queues | asClass singletons + asValue | VERIFIED | All confirmed at lines 100-108 |
| `apps/api/src/modules/checkout/CheckoutService.ts` | InventoryService + WalletService + CouponService + PaymentService | constructor-injected deps | VERIFIED | inventoryService.reserveItems called; no SDK imports in CheckoutService |
| `apps/api/src/modules/orders/OrderService.ts` | CommissionService + allocate() | per-vendor split + commission entry | VERIFIED | allocate import at line 3; vendorSubtotalMinor computed via allocate |
| `apps/web-storefront/src/pages/ProductDetailPage.tsx` | useBasket addToBasket | onClick mutation | VERIFIED | useAddToBasket imported at line 9; mutation wired; data-phase="5" count = 0 |
| `apps/web-storefront/src/router.tsx` | CartPage | route /cart | VERIFIED | CartPage route confirmed in router.tsx |
| `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx` | GET /checkout/providers + POST /checkout/place-order | useCheckout | VERIFIED | useCheckoutProviders + usePlaceOrder wired; WalletCreditToggle uses real wallet balance |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|-------------------|--------|
| CartPage.tsx | `basket.groupedByVendor` | useBasket → GET /basket → BasketService.getBasket → DB join | Yes — DB query with product/vendor joins | FLOWING |
| CheckoutPaymentPage.tsx | `providers`, `summary`, `wallet.balanceMinor` | useCheckoutProviders/useCheckoutSummary/useWallet → API → PaymentService/CheckoutService/WalletService | Yes — DB-backed computations | FLOWING |
| WalletPage.tsx | `walletData` (balanceMinor + entries) | useWallet → GET /account/wallet → WalletService.getLedger → DB | Yes — wallet_entries DB query | FLOWING |
| OrdersPage.tsx | order list | useQuery orders → GET /account/orders → OrderService.listOrdersForCustomer → DB | Yes — orders DB query | FLOWING |
| OrderSummary (cart) | coupon Apply button | No API call — setTimeout fake (by design) | No — cart coupon is informational; actual coupon applied in checkout wizard | INTENTIONAL PLACEHOLDER — plan 05-11 explicitly deferred coupon/wallet to 05-12; functional coupon path exists in CheckoutPaymentPage via useApplyCoupon |

### Behavioral Spot-Checks

Step 7b skipped — API requires a running database (Neon) and payment provider credentials. No runnable entry points can be tested in isolation without external services.

### Probe Execution

Step 7c — No probe-*.sh files declared in Phase 5 plans or found in scripts/ for this phase. The Drizzle feature probe (probe-drizzle-features.ts) was an ad-hoc script run during 05-04 execution, not a formal probe script.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| CHK-01 | 05-01, 05-05, 05-10, 05-11 | Basket add/update/remove across vendors | SATISFIED | BasketService CRUD + basket routes + CartPage + useBasket hook all wired |
| CHK-02 | 05-01, 05-05, 05-10, 05-11 | Basket persists for guests, merges on login | SATISFIED | mergeGuestBasket in BasketService; POST /basket/merge route with requireCustomerAuth; guest cookie management confirmed |
| CHK-03 | 05-09, 05-10, 05-12 | Checkout flow address→delivery→payment→review | SATISFIED | 4-step wizard with CheckoutGuard + per-step routes all confirmed; CheckoutDeliveryPage calls initiateCheckout |
| CHK-04 | 05-09, 05-10, 05-12 | All totals backend-authoritative | SATISFIED | computeSummary re-fetches catalog prices; basket snapshot discarded; test asserts tamper rejection |
| CHK-05 | 05-05, 05-09, 05-10 | Stock reserved atomically at checkout initiation with timed release | SATISFIED | InventoryService.reserveItems with SELECT FOR UPDATE; ReleaseReservationJob idempotent delayed job confirmed |
| CHK-06 | 05-04, 05-08, 05-10 | Coupon engine feature-flagged | SATISFIED | COUPONS_ENABLED seeded=false; CouponService short-circuits when off; POST /checkout/apply-coupon route confirmed |
| PAY-01 | 05-07 | PaymentProvider abstraction, no SDK in business logic | SATISFIED | stripe confined to StripeAdapter.ts only; razorpay confined to RazorpayAdapter.ts only; verified by grep |
| PAY-02 | 05-02, 05-07 | Buyer enables Stripe/Razorpay via config | SATISFIED | getEnabledProviders() reads env keys; STRIPE_SECRET_KEY etc. optional in env.ts |
| PAY-03 | 05-07, 05-10 | Webhooks verified and processed idempotently | SATISFIED | recordWebhookEvent with onConflictDoNothing; webhook routes return 200 on duplicate; payment_events_provider_event_uniq constraint |
| PAY-04 | 05-07, 05-10, 05-12 | Customer pays and receives confirmation | NEEDS HUMAN | Components fully wired; checkout+payment browser flow has NOT been human-verified (05-12 Task 3 PENDING) |
| WAL-01 | 05-03, 05-06, 05-10, 05-12 | Customer views wallet balance | SATISFIED | GET /account/wallet route + WalletService.getBalance + WalletPage UI all confirmed |
| WAL-02 | 05-06, 05-10, 05-12 | Customer views wallet ledger | SATISFIED | GET /account/wallet/entries route + WalletService.getLedger + WalletPage ledger table confirmed |
| WAL-03 | 05-03, 05-06 | Append-only wallet ledger, idempotent entries | SATISFIED | No updatedAt on wallet_entries; unique idempotencyKey; onConflictDoNothing on credit confirmed |
| WAL-04 | 05-08 | Refunds credited to wallet | SATISFIED | ReturnService.approveReturn calls WalletService.credit with refund_credit + idempotencyKey `return:{id}:refund-credit` |
| WAL-05 | 05-06, 05-09, 05-12 | Customer pays using wallet balance at checkout | SATISFIED | computeWalletApplied returns min(balance,requested,total); wallet deduction before provider charge; WalletCreditToggle in CheckoutPaymentPage wired to real balance |
| ORD-01 | 05-09, 05-12 | Customer places order, receives confirmation | NEEDS HUMAN | OrderService.createPendingOrder + finalizeOrder wired; OrderConfirmationPage exists. Payment flow not browser-verified (05-12 Task 3 PENDING) |
| ORD-02 | 05-09 | Multi-vendor order splits into vendor sub-orders | SATISFIED | OrderService uses allocate() for vendorSubtotalMinor; vendor_orders created at createPendingOrder with drift-free subtotals |
| ORD-03 | 05-09, 05-10, 05-12 | Customer views order history and detail | SATISFIED | GET /account/orders + GET /account/orders/:id routes + OrdersPage + OrderDetailPage all confirmed |
| ORD-04 | 05-08, 05-10, 05-12 | Customer requests return on eligible items | SATISFIED | POST /account/orders/:id/return-request route; ReturnService.createReturnRequest with eligibility check; OrderDetailPage return dialog with wallet/original preference |
| ORD-05 | 05-09, 05-10 | Vendor/admin can update sub-order status | SATISFIED | PATCH /vendor/orders/:id/status with vendor ownership check; updateVendorOrderStatus in OrderService confirmed |
| MKT-01 | 05-06, 05-09 | Commission computed per vendor sub-order via priority chain | SATISFIED | CommissionService.resolveRate (vendor>category>global); computeCommission called once per vendor sub-order in finalizeOrder |
| MKT-02 | 05-06 | Commission splits use allocate() for no rounding drift | SATISFIED | allocate() imported from @grovio/contracts/money; tests assert commissionMinor + netVendorMinor === subtotalMinor for awkward amounts |
| MKT-03 | 05-08 | Refunds generate proportional commission reversal | SATISFIED | ReturnService.approveReturn inserts vendor_commission_entries status='reversed' via allocate() proration; original earned row never modified |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web-storefront/src/components/basket/OrderSummary.tsx` | 56-57 | Coupon Apply button uses setTimeout fake instead of API call | INFO | By design — plan 05-11 explicitly stated "add a TODO marker referencing 05-12"; actual coupon application via POST /checkout/apply-coupon is wired in CheckoutPaymentPage/useCheckout hook. Not a blocker. |
| `apps/web-storefront/src/components/basket/OrderSummary.tsx` | 127-140 | Wallet credit section shows "Coming in checkout" / "Available at checkout" | INFO | By design — plan 05-11 explicitly deferred wallet toggle to 05-12; real wallet credit via WalletCreditToggle is fully wired in CheckoutPaymentPage with live balance. Cart-page placeholder is intentional UX. Not a blocker. |

No TBD, FIXME, or XXX debt markers found in any Phase 5 backend service or storefront checkout file.

### Human Verification Required

#### 1. Checkout + Payment + Order/Wallet End-to-End Flow

**Test:** With Stripe and/or Razorpay test keys configured in .env, start storefront + API. Navigate the full checkout flow:
1. From /cart click "Proceed to checkout" → /checkout/address. Try to jump to /checkout/payment directly via URL — confirm the guard redirects back.
2. Select an address, continue to delivery, click "Proceed to Payment" — confirm /checkout/payment is reached (inventory reserved at this step).
3. On the payment step confirm provider options match configured keys (both shown if both keys set). If wallet balance > 0, toggle wallet credit and confirm the card-charge remainder updates.
4. Pay with Stripe test card 4242 4242 4242 4242 — confirm PaymentElement mounts and submit succeeds, landing on /order-confirmation with an order display ID.
5. (If Razorpay configured) Repeat with Razorpay — confirm modal opens with order_id and test payment completes.
6. Visit /account/orders — confirm new order appears; open it — confirm items grouped by vendor and a "Request return" action on eligible delivered items.
7. Visit /account/wallet — confirm balance and ledger (debit entry if wallet credit was used).

**Expected:** All steps complete without errors; CheckoutGuard prevents step skipping; both payment providers work with their test credentials; order confirmation displays; account pages reflect the completed order and wallet state.

**Why human:** Plan 05-12 Task 3 is a `checkpoint:human-verify` with `gate:blocking` that is explicitly PENDING in 05-12-SUMMARY.md. This covers PAY-04 (customer pays and receives confirmation), ORD-01 (order confirmation), and the live Stripe/Razorpay integration — all of which require a browser session with real payment provider test credentials. These cannot be verified by grep or code inspection.

---

### Gaps Summary

No automated gaps were found. All 12 verifiable must-haves are confirmed in the codebase with substantive implementations, real data flows, and correct wiring. The single outstanding item is the Plan 05-12 blocking human-verify checkpoint for the end-to-end checkout/payment/order/wallet browser flow.

The cart-page OrderSummary wallet toggle and coupon Apply stubs are intentional design decisions explicitly planned in 05-11 with the ticket noting they would be completed in 05-12 — the 05-12 implementations (WalletCreditToggle in CheckoutPaymentPage, useApplyCoupon in useCheckout) are fully wired and confirmed.

---

_Verified: 2026-06-05_
_Verifier: Claude (gsd-verifier)_
