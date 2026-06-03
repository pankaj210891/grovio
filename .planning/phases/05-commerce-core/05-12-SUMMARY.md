---
phase: 05-commerce-core
plan: 12
subsystem: ui
tags: [react, react-query, stripe, razorpay, checkout, wallet, orders, framer-motion, zustand]

# Dependency graph
requires:
  - plan: 05-11
    provides: CartPage, useBasket hook, /cart route, router.tsx base after basket
  - plan: 05-10
    provides: All API routes (basket, checkout, webhooks, account/orders, account/wallet)
  - plan: 05-01
    provides: Checkout/orders/wallet/payments contract types (CheckoutSummary, Order, WalletLedgerResponse, InitiatePaymentResult, EnabledProviders)
  - plan: 05-02
    provides: "@stripe/react-stripe-js + @stripe/stripe-js installed in web-storefront"

provides:
  - useCheckout.ts (useCheckoutSummary, useCheckoutProviders, useInitiateCheckout, useApplyCoupon, usePlaceOrder, CheckoutFlowStore)
  - useWallet.ts (useWallet, useWalletEntries)
  - CheckoutProgress.tsx (4-step wizard indicator with motion)
  - CheckoutGuard.tsx (CheckoutGuard per-step + CheckoutRootGuard top-level, D-05)
  - StripePaymentForm.tsx (Elements + PaymentElement + confirmPayment)
  - RazorpayButton.tsx (CDN checkout.js, window.Razorpay, Pitfall 4 order_id)
  - WalletCreditToggle.tsx (WAL-05, D-13 hybrid wallet credit)
  - CheckoutAddressPage.tsx (step 1 — address select + Google Places)
  - CheckoutDeliveryPage.tsx (step 2 — delivery option, initiateCheckout D-06)
  - CheckoutPaymentPage.tsx (step 3 — Stripe/Razorpay/wallet, PAY-04)
  - CheckoutReviewPage.tsx (step 4 — server-authoritative summary)
  - OrderConfirmationPage.tsx (ORD-01 success entrance animation)
  - OrdersPage.tsx (ORD-03 order list with status badges)
  - OrderDetailPage.tsx (ORD-04 vendor-grouped detail + return request D-23, D-16)
  - WalletPage.tsx (WAL-01/02 balance card + ledger table)
  - router.tsx updated with all checkout/order/wallet routes

affects: [05-11, frontend-checkout, commerce-core]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Checkout flow Zustand store (CheckoutFlowStore) for transient UI state — separate from basket React Query state (D-04)"
    - "CheckoutGuard derives step completion from React Query + Zustand, never localStorage (T-05-DSK, D-05)"
    - "StripePaymentForm: Elements + PaymentElement + confirmPayment with return_url to /order-confirmation/:orderId"
    - "RazorpayButton: CDN script loader (idempotent, once) + window.Razorpay modal with order_id (Pitfall 4)"
    - "WalletCreditToggle emits walletCreditRequested to parent; server recomputes authoritative grandTotal (CHK-04, T-05-04)"

key-files:
  created:
    - apps/web-storefront/src/hooks/useCheckout.ts
    - apps/web-storefront/src/hooks/useWallet.ts
    - apps/web-storefront/src/components/checkout/CheckoutProgress.tsx
    - apps/web-storefront/src/components/checkout/CheckoutGuard.tsx
    - apps/web-storefront/src/components/checkout/StripePaymentForm.tsx
    - apps/web-storefront/src/components/checkout/RazorpayButton.tsx
    - apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx
    - apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx
    - apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx
    - apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx
    - apps/web-storefront/src/pages/checkout/CheckoutReviewPage.tsx
    - apps/web-storefront/src/pages/OrderConfirmationPage.tsx
    - apps/web-storefront/src/pages/account/OrdersPage.tsx
    - apps/web-storefront/src/pages/account/OrderDetailPage.tsx
    - apps/web-storefront/src/pages/account/WalletPage.tsx
  modified:
    - apps/web-storefront/src/router.tsx

key-decisions:
  - "All Task 1 + Task 2 files created and committed together in a single commit (6e7eef5) to satisfy router.tsx import dependencies and allow a single typecheck/build verification pass"
  - "CheckoutFlowStore uses Zustand for transient checkout state (selectedAddressId, deliveryOption, walletCreditRequested, paymentResult) — not React Query, which is for server state only (D-04)"
  - "CheckoutGuard uses both React Query auth state AND Zustand checkout state to derive step completion — avoids localStorage (T-05-DSK)"
  - "RazorpayButton loads CDN checkout.js via dynamic script tag, not npm — matches 05-02 decision (no razorpay npm package for browser)"

patterns-established:
  - "Checkout flow: 4 URL-addressable steps under CheckoutRootGuard + per-step CheckoutGuard (D-05)"
  - "Payment mount pattern: placeOrder mutation first → then mount StripePaymentForm(clientSecret) or RazorpayButton(order_id)"

requirements-completed: [CHK-03, CHK-06, PAY-04, WAL-01, WAL-02, WAL-05, ORD-01, ORD-03, ORD-04, STORE-05]

# Metrics
duration: ~9 minutes
completed: 2026-06-03
---

# Phase 05-12: Checkout Wizard + Payment + Order/Wallet Pages Summary

**Full customer checkout UI: 4-step guarded wizard (address/delivery/payment/review), Stripe Elements + Razorpay CDN modal + hybrid wallet credit, order confirmation, and account order history/detail + wallet pages — all server-authoritative amounts from /checkout/summary**

## Performance

- **Duration:** ~9 min
- **Started:** 2026-06-03T19:29:29Z
- **Completed:** 2026-06-03T19:38:42Z
- **Tasks:** 2 auto (Task 3 is human-verify checkpoint — pending)
- **Files created:** 15 new + 1 modified

## Accomplishments

- `useCheckout.ts` — 5 hooks (summary, providers, initiateCheckout, applyCoupon, placeOrder) + CheckoutFlowStore Zustand slice for transient checkout UI state
- `useWallet.ts` — useWallet (balance + ledger) + useWalletEntries hooks
- `CheckoutProgress.tsx` — 4-step progress indicator with motion step number animation, checkmarks for completed steps
- `CheckoutGuard.tsx` — CheckoutRootGuard (auth + non-empty basket gate) + per-step CheckoutGuard using `<Navigate>` for prerequisite redirect (D-05, T-05-DSK); derives state from React Query + Zustand, never localStorage
- `StripePaymentForm.tsx` — `<Elements>` + `<PaymentElement>` + `stripe.confirmPayment` with return_url to /order-confirmation/:orderId (PCI scope with Stripe, T-05-PCI)
- `RazorpayButton.tsx` — CDN script loader (idempotent `<script>` tag once) + `new window.Razorpay({ order_id, ... })` modal with Pitfall 4 compliance (order_id required)
- `WalletCreditToggle.tsx` — checkbox + capped amount input for wallet credit, emits walletCreditRequested to CheckoutPaymentPage which sends to server (advisory, server re-validates CHK-04)
- `CheckoutAddressPage` — saved address selection with radio buttons + inline add-address form with Google Places, auto-selects default
- `CheckoutDeliveryPage` — delivery option selection, calls useInitiateCheckout on proceed (inventory reserve CHK-05, D-06)
- `CheckoutPaymentPage` — reads providers D-09, shows both/one based on config; mounts StripePaymentForm or RazorpayButton after placeOrder; WalletCreditToggle shown when balance > 0
- `CheckoutReviewPage` — server-authoritative summary from useCheckoutSummary + basket items grouped by vendor
- `OrderConfirmationPage` — fetches order, shows vendor-grouped items + totals + motion entrance animation, resets checkout flow
- `OrdersPage` — order list with status badges + date + total, links to detail
- `OrderDetailPage` — vendor-grouped detail with per-vendor status, return request dialog with wallet/original preference (D-23, D-16, ORD-04)
- `WalletPage` — balance card (WAL-01) + ledger table with credit/debit indicators (WAL-02)
- `router.tsx` — 4 nested checkout routes under CheckoutRootGuard + per-step guards + /order-confirmation/:orderId + /account/orders + /account/orders/:id + /account/wallet; /cart from 05-11 preserved

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1+2 | Checkout hooks, wizard, guard, components, pages, routes | 6e7eef5 | 15 created, 1 modified |
| 3 | Human-verify checkpoint | PENDING | — |

## Files Created/Modified

- `apps/web-storefront/src/hooks/useCheckout.ts` — 5 hooks + CheckoutFlowStore (180 lines)
- `apps/web-storefront/src/hooks/useWallet.ts` — useWallet + useWalletEntries (74 lines)
- `apps/web-storefront/src/components/checkout/CheckoutProgress.tsx` — 4-step indicator (118 lines)
- `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx` — step prerequisite redirect guards (104 lines)
- `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx` — Stripe Elements wrapper (116 lines)
- `apps/web-storefront/src/components/checkout/RazorpayButton.tsx` — CDN modal integration (150 lines)
- `apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx` — hybrid wallet credit toggle (118 lines)
- `apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx` — address step (265 lines)
- `apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx` — delivery step (124 lines)
- `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx` — payment step (225 lines)
- `apps/web-storefront/src/pages/checkout/CheckoutReviewPage.tsx` — review step (144 lines)
- `apps/web-storefront/src/pages/OrderConfirmationPage.tsx` — order confirmation (192 lines)
- `apps/web-storefront/src/pages/account/OrdersPage.tsx` — order list (124 lines)
- `apps/web-storefront/src/pages/account/OrderDetailPage.tsx` — order detail + return request (318 lines)
- `apps/web-storefront/src/pages/account/WalletPage.tsx` — wallet balance + ledger (130 lines)
- `apps/web-storefront/src/router.tsx` — updated route tree (113 lines)

## Decisions Made

- Task 1 and Task 2 files were created together in a single commit to satisfy router.tsx import dependencies. The plan logically separated them into two tasks but the router imports all pages at the top-level — creating Task 1 files without Task 2 files would fail typecheck. This is an auto-fix deviation (Rule 3 — blocking).
- CheckoutFlowStore (Zustand) holds transient checkout UI state; React Query holds server-derived state. This keeps basket data (D-04) and checkout wizard control state separate.
- RazorpayButton uses CDN checkout.js exclusively — matches the 05-02 decision that no Razorpay npm browser package exists.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Task 1 and Task 2 files committed together**
- **Found during:** Task 1 execution
- **Issue:** router.tsx imports all pages (including Task 2 pages) at the top level. Creating Task 1 files without Task 2 files would cause TypeScript compile errors and build failure, blocking Task 1 verification.
- **Fix:** Created all Task 1 + Task 2 files in one pass and committed them as a single combined commit `6e7eef5`. Each logical group (hooks, components, pages) is complete and functional.
- **Files modified:** All 16 plan files
- **Committed in:** 6e7eef5

---

**Total deviations:** 1 auto-fixed (Rule 3 - blocking import dependency)
**Impact on plan:** All plan files complete and verified. Logical separation between Task 1 and Task 2 is maintained in code structure (hooks / components / pages / router), just committed atomically.

## Security Coverage

| Threat | Implementation |
|--------|----------------|
| T-05-04 (totals tampering) | All amounts from useCheckoutSummary (GET /checkout/summary); walletCreditRequested is advisory |
| T-05-PCI (card data) | StripePaymentForm uses Stripe Elements iframe; RazorpayButton uses Razorpay modal — card data never in app scope |
| T-05-06 (privilege escalation) | Checkout routes under CheckoutRootGuard (auth check); account routes under ProtectedRoute |
| T-05-DSK (step skipping) | CheckoutGuard derives step completion from React Query + Zustand, redirects via Navigate on unmet prerequisites |

## Known Stubs

None — all pages and components are fully wired to their respective hooks and API endpoints. The CheckoutDeliveryPage uses a static delivery options list (standard/express) rather than fetching from a server endpoint, but this is a functional UI with real data passed to /checkout/initiate (the delivery option string). A future enhancement could add GET /checkout/delivery-options to make this dynamic.

## Threat Flags

None beyond what was already in the plan's threat model. All four threat items (T-05-04, T-05-PCI, T-05-06, T-05-DSK) are mitigated by the implementations above.

## Self-Check: PASSED

- `apps/web-storefront/src/hooks/useCheckout.ts` — FOUND
- `apps/web-storefront/src/hooks/useWallet.ts` — FOUND
- `apps/web-storefront/src/components/checkout/CheckoutProgress.tsx` — FOUND
- `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx` — FOUND
- `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx` — FOUND
- `apps/web-storefront/src/components/checkout/RazorpayButton.tsx` — FOUND
- `apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx` — FOUND
- `apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx` — FOUND
- `apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx` — FOUND
- `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx` — FOUND
- `apps/web-storefront/src/pages/checkout/CheckoutReviewPage.tsx` — FOUND
- `apps/web-storefront/src/pages/OrderConfirmationPage.tsx` — FOUND
- `apps/web-storefront/src/pages/account/OrdersPage.tsx` — FOUND
- `apps/web-storefront/src/pages/account/OrderDetailPage.tsx` — FOUND
- `apps/web-storefront/src/pages/account/WalletPage.tsx` — FOUND
- `apps/web-storefront/src/router.tsx` — MODIFIED (checkout/order/wallet routes)
- Commit 6e7eef5 — FOUND
- `pnpm --filter @grovio/web-storefront typecheck` exits 0 — VERIFIED
- `pnpm --filter @grovio/web-storefront build` exits 0 — VERIFIED
- No npm razorpay import in RazorpayButton.tsx — VERIFIED (grep returns empty)
- CheckoutGuard uses Navigate for redirect — VERIFIED
- StripePaymentForm uses Elements + PaymentElement + confirmPayment — VERIFIED
- router.tsx has /cart route from 05-11 — VERIFIED (line: `{ path: 'cart', element: <CartPage /> }`)

---
*Phase: 05-commerce-core*
*Completed: 2026-06-03 (Tasks 1-2); Task 3 (human-verify) pending*
