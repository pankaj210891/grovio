# Phase 5: Commerce Core - Research

**Researched:** 2026-06-02
**Domain:** Multi-vendor e-commerce: basket, inventory reservation, payment processing (Stripe + Razorpay), wallet ledger, order splitting, commission engine, coupon engine
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Basket Persistence & Guest Merge**
- D-01: Basket is server-side only. Guest basket keyed by httpOnly cookie `grovio_basket_token` (random UUID). Stored in a `basket_sessions` table with 30-day TTL.
- D-02: Merge strategy on login: combine both baskets. Same variant quantities are summed, capped at available stock.
- D-03: Guest basket TTL: 30 days. Expired tokens cleaned by BullMQ scheduled job. Items disappear silently after expiry.
- D-04: Frontend basket state: React Query (server state). No Zustand store for basket. Invalidate basket query on all mutations.

**Checkout Flow + Reservation Timing**
- D-05: Multi-step wizard with URL-addressable steps: `/checkout/address` → `/checkout/delivery` → `/checkout/payment` → `/checkout/review`.
- D-06: Inventory reserved on "Proceed to Payment" (delivery → payment step advance). Triggers BullMQ delayed job at reservation time.
- D-07: Abandoned reservation TTL: 15 minutes. BullMQ `ReleaseReservationJob` fires 15 min after reservation. Idempotent check: no-op if payment already received.
- D-08: Multi-vendor order: one customer-facing order ID. Backend splits into sub-orders (`vendor_orders`). Customer not exposed to sub-order IDs.

**Payment Provider UX + Webhook Design**
- D-09: When both providers enabled, payment step shows both options. Single provider = no choice presented. Routes through `PaymentProvider` abstraction.
- D-10: Webhook idempotency via `payment_events` table with unique constraint on `(provider, provider_event_id)`. Upsert on arrival; existing row = return 200 and exit.
- D-11: Payment failure: order stays in `payment_pending`. Customer returned to `/checkout/payment` with error. Inventory reservation clock continues ticking.
- D-12: Phase 5 records commission entries only — no automated vendor payouts. `vendor_commission_entries` table. Phase 6 adds payout management.

**Wallet Hybrid Checkout**
- D-13: Partial wallet credit allowed. Wallet balance displayed on payment step. Remaining card charge billed via payment provider. Full wallet payment supported.
- D-16: Refund destination: customer's choice — wallet credit (instant) or original payment method (provider refund API call). Customer preference captured in return request.

**Commission Engine**
- D-14: Flat percentage only. Priority chain: global → category → vendor (most-specific wins). Rate stored as `NUMERIC(5,2)` on each level (e.g., `10.00` = 10%).
- D-15: Partial-refund commission reversal (MKT-03) via `allocate()` from `packages/contracts/money`. Item-level proration using `item_subtotal / sub_order_total`.

**Inventory Model**
- D-20: `inventory_items` table with nullable `product_variant_id` FK OR nullable `product_id` FK. Exactly one non-null per row.
- D-21: Two-column model: `quantity_available` + `quantity_reserved`. Reservation: atomic decrement `quantity_available` + increment `quantity_reserved` (row-level lock). Payment success: decrement `quantity_reserved`. Abandonment: `quantity_reserved` → `quantity_available`.

**Order Returns (ORD-04)**
- D-22: Per-vendor return policy with global fallback. `vendor_return_policies` table (`vendor_id FK`, `return_window_days INT`, `conditions TEXT`, `is_returnable BOOLEAN`). No row = fallback to 7 days / returnable.
- D-23: Self-serve return request from storefront. Creates `return_requests` record in `return_requested` status. Commission reversal (MKT-03 via D-15) triggers on return approval.

**Storefront Cart/Basket Page**
- D-24: Cart items grouped by vendor with vendor name section headers. Per-vendor estimated delivery shown in each section header.
- D-25: Order summary sidebar: subtotal, coupon code input, wallet credit toggle + balance, delivery estimate, order total.

**Coupon Engine**
- D-17: Per-item or per-vendor discount scope. Admin sets scope per coupon. Discount type: flat amount or percentage. One coupon per order. Feature-flagged via `COUPONS_ENABLED`.
- D-18: Eligibility: minimum order amount, max total redemptions count, expiry date. Three conditions on `coupons` table.

### Claude's Discretion
- Return policy Phase 5/6 split implementation details (D-22 recommendation adopted)
- Framer Motion animations for checkout steps and cart item removal
- Exact `basket_sessions` and `basket_items` table schema
- React Router v6 checkout route guard implementation
- Order state machine states
- Slug/display ID strategy for orders (suggested: `ORD-YYYYMMDD-XXXXXX`)
- BullMQ queue naming and concurrency for reservation expiry and basket cleanup jobs
- Customer JWT middleware for basket/checkout routes

### Deferred Ideas (OUT OF SCOPE)
- Automated vendor payouts via Stripe Connect / Razorpay Route (PAY2-01)
- Tiered commission rates
- Fixed-fee commission component
- Per-customer coupon use limit
- Coupon stackability
- Refund-to-original-payment-method (provider API calls) — may defer to Phase 6
- Bank transfer payout requests from wallet
- BNPL / EMI payment options
- Order cancellation by customer (self-serve)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CHK-01 | Customer can add/update/remove items in a basket spanning multiple vendors | Basket API + server-side session, React Query mutations |
| CHK-02 | Basket persists for guests and merges into the account on login | `basket_sessions` table, merge endpoint, cookie pattern |
| CHK-03 | Customer can complete a checkout flow (address → delivery → payment → review) | React Router v6 wizard, URL-addressable steps |
| CHK-04 | All pricing, discounts, and order totals computed backend-authoritatively | Backend re-fetch from catalog on checkout, never trust client amounts |
| CHK-05 | Stock reserved atomically at checkout initiation with timed release | Drizzle `.for('update')` in transaction, BullMQ `ReleaseReservationJob` |
| CHK-06 | Customer can apply a coupon during checkout (feature-flagged) | `COUPONS_ENABLED` FeatureFlagService, `coupons` table, coupon validation service |
| PAY-01 | Payment through `PaymentProvider` abstraction; no provider SDK in business logic | `PaymentProvider` interface, StripeAdapter + RazorpayAdapter in infrastructure |
| PAY-02 | Buyer can enable Stripe, Razorpay, or both via configuration | Feature flags: `STRIPE_ENABLED`, `RAZORPAY_ENABLED` — Redis-cached |
| PAY-03 | Payment webhooks verified and processed idempotently | `payment_events` table, unique `(provider, provider_event_id)`, D-10 |
| PAY-04 | Customer can pay using configured provider; receives confirmation | Stripe Elements + PaymentIntent client confirmation; Razorpay checkout script |
| WAL-01 | Customer can view wallet balance | `wallet_entries` SUM aggregation or cached `wallet_balance_minor` on customers |
| WAL-02 | Customer can view wallet ledger/history of credits and debits | `wallet_entries` table with `entry_type`, `amount_minor`, `reference_id` |
| WAL-03 | Wallet modeled as append-only ledger with idempotent entries | No direct balance edits; unique `idempotency_key` on `wallet_entries` |
| WAL-04 | Refunds can be issued to the customer wallet | `wallet_entries` row with `entry_type='refund_credit'` on return approval |
| WAL-05 | Customer can pay (fully or partially) using wallet balance at checkout | Hybrid checkout: `wallet_applied_minor` on order; remainder via provider |
| ORD-01 | Customer can place an order and receive an order confirmation | `orders` table, `vendor_orders` sub-table, order ID generation |
| ORD-02 | Single customer order splits into per-vendor sub-orders backend-side | `vendor_orders` table with FK to `orders.id`; commission per `vendor_orders` row |
| ORD-03 | Customer can view order history and order detail | `/account/orders` and `/account/orders/:id` routes |
| ORD-04 | Customer can request a return/refund on eligible order items | `return_requests` table, eligibility check against `vendor_return_policies` |
| ORD-05 | Vendor and admin can view and update status of sub-orders they own | `vendor_orders` status field; read/update routes scoped by vendor JWT |
| MKT-01 | Commission computed per vendor sub-order using priority chain | `CommissionService` with global → category → vendor rate resolution |
| MKT-02 | Commission splits use integer minor-unit allocation (no rounding drift) | `allocate()` from `packages/contracts/money` |
| MKT-03 | Refunds generate proportional commission reversal entries | Item-level proration using `allocate()`, D-15; append-only reversal rows |
</phase_requirements>

---

## Summary

Phase 5 is the largest single phase in the Grovio roadmap: 23 requirements spanning basket, checkout, two payment providers, a wallet ledger, multi-vendor order splitting, a commission engine, and coupon support. Every money path must be BIGINT-only with no floating-point at any layer. The backend is already proven through Phase 4 — Fastify, Drizzle ORM, BullMQ, Awilix DI, and the httpOnly cookie auth pattern are all in place and working. Phase 5 adds seven new domain services (BasketService, CheckoutService, PaymentService, WalletService, OrderService, CommissionService, CouponService) and two BullMQ job handlers.

The two payment providers have fundamentally different checkout UX: Stripe uses `@stripe/react-stripe-js` Elements rendered in an iframe in the React checkout page, with a client-side `stripe.confirmPayment()` call and server-side PaymentIntent creation. Razorpay uses a dynamically-loaded external script (`checkout.razorpay.com/v1/checkout.js`) that opens a modal overlay — the integration cannot be fully React-native. Both providers converge on the same webhook → `payment_events` upsert → canonical event → order finalization flow.

The most technically intricate pieces are: (1) atomic inventory reservation with `SELECT FOR UPDATE` in Drizzle, (2) Stripe raw-body webhook requirement in Fastify (needs `addContentTypeParser` with `parseAs: 'buffer'`), (3) multi-vendor order subtotal splitting using `allocate()` with BIGINT arithmetic, and (4) the wallet hybrid checkout where wallet credit is applied before the provider payment amount is computed. The `allocate()` function in `packages/contracts/money/allocate.ts` is already implemented and tested — it is the mandatory tool for all commission and payout splits.

**Primary recommendation:** Build in strict layer order — contracts → DB schema → services → routes → storefront. Start with the basket and inventory core, gate on a working reservation flow before touching payment SDKs, then add wallet and commission on top of a confirmed order placement.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Basket CRUD (add/update/remove/merge) | API / Backend | Browser / Client | Server-side basket (D-01) — no client storage |
| Guest basket token management | Browser / Client | API / Backend | Cookie set by backend on basket create; client sends cookie with requests |
| Inventory reservation (SELECT FOR UPDATE) | API / Backend | — | Atomic DB operation; cannot be client-side |
| BullMQ reservation expiry | API / Backend (worker) | — | Background job; no client involvement |
| Checkout step wizard (address/delivery/payment/review) | Browser / Client | API / Backend | URL-addressable React Router v6 pages; backend validates each step |
| Backend-authoritative total computation | API / Backend | — | Re-fetches prices from catalog; never trusts client amounts (CHK-04) |
| Stripe PaymentIntent creation | API / Backend | — | Requires secret key; must be server-side |
| Stripe Elements (card input, confirm) | Browser / Client | — | Stripe.js iframed elements; PCI compliance requires client-side tokenization |
| Razorpay order creation | API / Backend | — | Requires key_secret; must be server-side |
| Razorpay checkout modal | Browser / Client | — | External script opens modal; not a React component |
| Webhook signature verification | API / Backend | — | Raw buffer + secret; must be server-side; raw body required (Fastify) |
| Webhook idempotency (`payment_events`) | API / Backend | — | DB unique constraint; cannot be client-side |
| Wallet ledger reads (balance, history) | API / Backend | — | Append-only ledger; aggregate sum or cached balance column |
| Wallet hybrid checkout computation | API / Backend | — | `wallet_applied_minor` set server-side; never trusts client-provided amount |
| Order placement and vendor splitting | API / Backend | — | `allocate()` for BIGINT split; commission entries created in same transaction |
| Commission rate resolution | API / Backend | — | Priority chain (global→category→vendor); single service call per sub-order |
| Return eligibility check | API / Backend | — | `vendor_return_policies` lookup; window + `is_returnable` check |
| Coupon eligibility + application | API / Backend | — | Feature-flagged; all validation server-side; discount stored on order at placement |
| Cart/checkout UI (pages, animations) | Browser / Client | — | React + Motion 12.x micro-interactions; Tailwind CSS |
| Order history + order detail pages | Browser / Client | API / Backend | React Query fetching from API; standard account route pattern |

---

## Standard Stack

### Core (Backend — new packages for Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `stripe` | 22.2.0 | Stripe payment collection + refunds (infrastructure adapter only) | Official SDK; full TypeScript types; current API `2026-05-27` [VERIFIED: npm registry] |
| `razorpay` | 2.9.6 | Razorpay payment collection + refunds (infrastructure adapter only) | Official SDK; TypeScript definitions included; Node >=22.2 (matched) [VERIFIED: npm registry] |

> Note: `stripe` and `razorpay` are new installs for Phase 5. All other backend dependencies (`drizzle-orm`, `bullmq`, `ioredis`, `zod`, `jose`, `fastify`) are already installed in `apps/api/package.json`.

### Core (Storefront — new packages for Phase 5)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@stripe/stripe-js` | 9.7.0 | Load Stripe.js for client-side PaymentElement + `confirmPayment` | Official Stripe browser SDK; PCI compliance requires loading from Stripe CDN via this wrapper [VERIFIED: npm registry] |
| `@stripe/react-stripe-js` | 6.5.0 | `Elements` provider + `PaymentElement` React component for Stripe card input | Official Stripe React integration; wraps Stripe.js in React context [VERIFIED: npm registry] |

> Note: Razorpay does NOT have an official React package. Its checkout is a modal opened via the global `window.Razorpay` constructor, loaded from `https://checkout.razorpay.com/v1/checkout.js` via a `<script>` tag. No npm package is needed on the storefront for Razorpay. [CITED: razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/]

### Already Installed (not new installs)

All remaining Phase 5 dependencies are already in `package.json` files:

| Library | Installed At | Phase 5 Role |
|---------|-------------|--------------|
| `drizzle-orm` 0.45.x (rc.3) | `apps/api` | New schema tables + `.for('update')` transaction |
| `bullmq` 5.77.x | `apps/api` | `ReleaseReservationJob` + `BasketExpiryJob` |
| `ioredis` 5.x | `apps/api` | Already wired; BullMQ connection reused |
| `zod` 4.x | `apps/api` | New Zod schemas in `packages/contracts` |
| `@tanstack/react-query` 5.x | `apps/web-storefront` | Basket mutations, checkout queries |
| `framer-motion` / `motion` 12.x | `apps/web-storefront` | Checkout step transitions, cart animations |
| `react-router-dom` 7.x | `apps/web-storefront` | Checkout wizard URL-addressable routes |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `@stripe/react-stripe-js` Elements | Stripe Checkout hosted page | Elements gives full UI control within Grovio's checkout wizard; hosted page redirects away from the site — inconsistent with the multi-step flow |
| Razorpay npm-based modal | `razorpay` npm package frontend usage | Razorpay's frontend integration requires their CDN script for PCI compliance; there is no official browser/React npm package |
| `allocate()` from contracts | `dinero.js` v2 | `allocate()` is already implemented, tested, and proven in `packages/contracts/money/allocate.ts`; no additional library needed |

**Installation (Phase 5 new packages):**
```bash
# Backend
pnpm --filter @grovio/api add stripe razorpay

# Storefront
pnpm --filter @grovio/web-storefront add @stripe/stripe-js @stripe/react-stripe-js
```

**Version verification:**
- `stripe`: 22.2.0 — published 2026-05-27 [VERIFIED: npm registry]
- `razorpay`: 2.9.6 — published 2025-02-24 [VERIFIED: npm registry]
- `@stripe/stripe-js`: 9.7.0 — published 2026-05-26 [VERIFIED: npm registry]
- `@stripe/react-stripe-js`: 6.5.0 — published 2026-05-29 [VERIFIED: npm registry]

---

## Package Legitimacy Audit

> slopcheck was not available in this environment. All packages are tagged with provenance notes. The planner must gate each new package behind a `checkpoint:human-verify` task before install.

| Package | Registry | Age | Downloads/wk | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-------------|-------------|-----------|-------------|
| `stripe` | npm | ~15 yrs (2011) | 12,110,451 | github.com/stripe/stripe-node | N/A (unavailable) | [VERIFIED: npm registry] — official Stripe SDK, primary official package |
| `razorpay` | npm | ~10 yrs (2016) | 281,925 | github.com/razorpay/razorpay-node | N/A (unavailable) | [VERIFIED: npm registry] — official Razorpay SDK, matches CLAUDE.md spec |
| `@stripe/stripe-js` | npm | ~6 yrs (2020) | 8,401,124 | github.com/stripe/stripe-js | N/A (unavailable) | [VERIFIED: npm registry] — official Stripe browser SDK |
| `@stripe/react-stripe-js` | npm | ~6 yrs (2020) | 6,096,519 | github.com/stripe/react-stripe-js | N/A (unavailable) | [VERIFIED: npm registry] — official Stripe React SDK |

**Packages removed due to slopcheck [SLOP] verdict:** none

**Packages flagged as suspicious [SUS]:** none

*slopcheck was unavailable at research time. All four packages above are well-established official SDKs from Stripe (github.com/stripe) and Razorpay (github.com/razorpay) with multi-year histories and millions of weekly downloads. Despite the [VERIFIED: npm registry] tag from registry confirmation + authoritative source match (CLAUDE.md), the planner MUST still add a `checkpoint:human-verify` before install per protocol.*

---

## Architecture Patterns

### System Architecture Diagram

```
Customer Browser
      │
      ├─── GET /basket  ──────────────────────────────────────┐
      │    (React Query, credentials: include)                 │
      │                                                         ▼
      ├─── POST /basket/items  ──────────────► BasketService (DB: basket_sessions, basket_items)
      │    (add/update/remove)                     │
      │                                             │  item price snapshot from products table
      │                                             ▼
      │                               ProductService (catalog prices — authoritative)
      │
      ├─── GET /checkout/initiate  ──────────► CheckoutService
      │    (delivery→payment transition)             │
      │                                             ├── InventoryService.reserveItems()
      │                                             │       └── Drizzle tx: SELECT FOR UPDATE
      │                                             │               inventory_items → reservation
      │                                             │
      │                                             └── BullMQ: enqueue ReleaseReservationJob
      │                                                         (delay: 15 min)
      │
      ├─── POST /checkout/complete  ─────────► CheckoutService
      │    (review→payment submit)                  │
      │                                             ├── Re-fetch prices (CHK-04)
      │                                             ├── Apply wallet credit (WalletService)
      │                                             ├── Apply coupon (CouponService) [if enabled]
      │                                             └── PaymentService.createOrder()
      │                                                     │
      │                                          ┌──────────┴──────────┐
      │                                          ▼                     ▼
      │                                   StripeAdapter          RazorpayAdapter
      │                                 (infrastructure)        (infrastructure)
      │                                 Stripe SDK calls       Razorpay SDK calls
      │
      ├─── [Stripe] stripe.confirmPayment()  ─── (client confirms in browser via Elements iframe)
      │                                             │
      │    [Razorpay] window.Razorpay modal  ──────┘
      │
      │    ▼ ASYNC: payment provider webhook
POST /webhooks/stripe  ──────────────► StripeWebhookHandler
POST /webhooks/razorpay  ────────────► RazorpayWebhookHandler
      │                                    │
      │                              1. Verify signature (raw body)
      │                              2. Upsert payment_events (idempotency)
      │                              3. Canonical event dispatch:
      │                                   PAYMENT_CAPTURED → OrderService.finalizeOrder()
      │                                      │
      │                                      ├── Update order status: payment_received
      │                                      ├── VendorOrderService.split() → vendor_orders rows
      │                                      ├── CommissionService.compute() → vendor_commission_entries
      │                                      ├── WalletService.debit() → wallet_entries
      │                                      └── InventoryService.consumeReservation()
      │
      └─── GET /account/orders  ──────────► OrderService (read: orders + vendor_orders)
           GET /account/wallet  ──────────► WalletService (read: wallet_entries)
           POST /account/returns  ─────────► ReturnService (create return_requests)
```

### Recommended Project Structure

```
apps/api/src/
├── db/schema/
│   ├── basket-sessions.ts         # NEW: basket_sessions table
│   ├── basket-items.ts            # NEW: basket_items table
│   ├── inventory-items.ts         # NEW: inventory_items table (D-20, D-21)
│   ├── inventory-reservations.ts  # NEW: inventory_reservations table
│   ├── orders.ts                  # NEW: orders table + orderStatusEnum
│   ├── vendor-orders.ts           # NEW: vendor_orders table (sub-orders)
│   ├── order-items.ts             # NEW: order_items table (line items)
│   ├── wallet-entries.ts          # NEW: wallet_entries table (append-only)
│   ├── payment-events.ts          # NEW: payment_events table (webhook idempotency)
│   ├── vendor-commission-entries.ts # NEW: vendor_commission_entries table
│   ├── commission-rules.ts        # NEW: commission_rules table (global/category/vendor)
│   ├── coupons.ts                 # NEW: coupons table
│   ├── return-requests.ts         # NEW: return_requests table
│   ├── vendor-return-policies.ts  # NEW: vendor_return_policies table
│   └── index.ts                   # Updated barrel
│
├── modules/
│   ├── basket/                    # NEW
│   │   ├── BasketService.ts
│   │   └── index.ts
│   ├── checkout/                  # NEW
│   │   ├── CheckoutService.ts
│   │   └── index.ts
│   ├── inventory/                 # NEW
│   │   ├── InventoryService.ts
│   │   └── index.ts
│   ├── payments/                  # NEW
│   │   ├── PaymentProvider.ts     # Interface + canonical event types
│   │   ├── StripeAdapter.ts       # Infrastructure: Stripe SDK calls ONLY
│   │   ├── RazorpayAdapter.ts     # Infrastructure: Razorpay SDK calls ONLY
│   │   ├── PaymentService.ts      # Application layer (uses interface, not SDK)
│   │   └── index.ts
│   ├── wallet/                    # NEW
│   │   ├── WalletService.ts
│   │   └── index.ts
│   ├── orders/                    # NEW
│   │   ├── OrderService.ts
│   │   └── index.ts
│   ├── commissions/               # NEW
│   │   ├── CommissionService.ts
│   │   └── index.ts
│   ├── coupons/                   # NEW
│   │   ├── CouponService.ts
│   │   └── index.ts
│   ├── returns/                   # NEW
│   │   ├── ReturnService.ts
│   │   └── index.ts
│   └── jobs/
│       ├── queues.ts              # UPDATED: add reservationQueue, basketCleanupQueue
│       ├── workers.ts             # UPDATED: add startReservationWorker, startBasketCleanupWorker
│       ├── release-reservation-job.ts  # NEW
│       └── basket-expiry-job.ts        # NEW
│
├── routes/
│   ├── basket.ts                  # NEW: /basket/* (public + customer-auth)
│   ├── checkout.ts                # NEW: /checkout/* (customer-auth guarded)
│   ├── webhooks/
│   │   ├── stripe.ts              # NEW: POST /webhooks/stripe (raw body)
│   │   └── razorpay.ts            # NEW: POST /webhooks/razorpay (raw body)
│   ├── account/
│   │   ├── orders.ts              # NEW: /account/orders (customer-auth)
│   │   └── wallet.ts              # NEW: /account/wallet (customer-auth)
│   └── vendor/
│       └── orders.ts              # NEW: /vendor/orders (vendor-auth)

apps/web-storefront/src/
├── pages/
│   ├── CartPage.tsx               # NEW: /cart (D-24, D-25)
│   ├── checkout/
│   │   ├── CheckoutAddressPage.tsx   # NEW: /checkout/address
│   │   ├── CheckoutDeliveryPage.tsx  # NEW: /checkout/delivery
│   │   ├── CheckoutPaymentPage.tsx   # NEW: /checkout/payment (Stripe + Razorpay)
│   │   └── CheckoutReviewPage.tsx    # NEW: /checkout/review
│   ├── OrderConfirmationPage.tsx  # NEW: /order-confirmation/:orderId
│   ├── account/
│   │   ├── OrdersPage.tsx         # NEW: /account/orders
│   │   ├── OrderDetailPage.tsx    # NEW: /account/orders/:id
│   │   └── WalletPage.tsx         # NEW: /account/wallet
│   └── ProductDetailPage.tsx      # UPDATED: wire Add to Cart button (removes data-phase="5")
├── hooks/
│   ├── useBasket.ts               # NEW: React Query basket hooks
│   ├── useCheckout.ts             # NEW: checkout flow state hooks
│   └── useWallet.ts               # NEW: wallet hooks
└── components/
    ├── basket/
    │   ├── BasketItem.tsx
    │   └── OrderSummary.tsx
    ├── checkout/
    │   ├── CheckoutProgress.tsx   # Step indicator
    │   ├── StripePaymentForm.tsx  # Elements wrapper
    │   └── RazorpayButton.tsx     # Razorpay modal trigger
    └── wallet/
        └── WalletCreditToggle.tsx

packages/contracts/src/
├── basket/                        # NEW
│   ├── index.ts
│   └── types.ts
├── checkout/                      # NEW
│   └── types.ts
├── orders/                        # NEW
│   └── types.ts
├── wallet/                        # NEW
│   └── types.ts
├── payments/                      # NEW
│   └── types.ts
└── commissions/                   # NEW
    └── types.ts
```

### Pattern 1: PaymentProvider Interface (CRITICAL — PAY-01, Pitfall 9)

**What:** All checkout and order code depends only on the `PaymentProvider` interface. Stripe SDK (`stripe`) and Razorpay SDK (`razorpay`) are imported only inside their respective adapter files.

**When to use:** Every payment operation — create order, confirm, refund, webhook parsing.

**Example:**
```typescript
// Source: ARCHITECTURE.md PaymentProvider Abstraction
// apps/api/src/modules/payments/PaymentProvider.ts

export interface CreatePaymentOrderParams {
  amountMinor: bigint;
  currency: string;
  orderId: string;
  customerId: string;
  description?: string;
}

export interface ProviderPaymentOrder {
  providerOrderId: string;
  clientSecret: string | null;   // Stripe: PaymentIntent client_secret
  providerKey: string | null;    // Razorpay: key_id for checkout options
  providerOrderRef: string | null; // Razorpay: order_id
}

export interface WebhookEvent {
  type: 'PAYMENT_CAPTURED' | 'PAYMENT_FAILED' | 'REFUND_SUCCEEDED' | 'REFUND_FAILED';
  providerEventId: string;
  orderId: string;
  amountMinor: bigint;
  provider: 'stripe' | 'razorpay';
  rawPayload: unknown;
}

export interface PaymentProvider {
  createPaymentOrder(params: CreatePaymentOrderParams): Promise<ProviderPaymentOrder>;
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent>;
  initiateRefund(params: { providerOrderId: string; amountMinor: bigint }): Promise<void>;
}
```

### Pattern 2: Atomic Inventory Reservation with Drizzle SELECT FOR UPDATE

**What:** Drizzle ORM supports `SELECT FOR UPDATE` via `.for('update')` chained on a `select()` call inside a transaction. This is the mechanism for preventing inventory oversell (Pitfall 2).

**When to use:** Only in `InventoryService.reserveItems()` — the checkout initiation path (D-06).

**Example:**
```typescript
// Source: Drizzle ORM discussions#1337 + answeroverflow.com/m/1202652683492925544
await db.transaction(async (tx) => {
  const [item] = await tx
    .select()
    .from(inventoryItems)
    .where(eq(inventoryItems.id, itemId))
    .for('update'); // Row-level lock — concurrent checkout requests queue here

  if (!item || item.quantityAvailable < requestedQty) {
    throw new Error('INSUFFICIENT_STOCK');
  }

  await tx.update(inventoryItems)
    .set({
      quantityAvailable: item.quantityAvailable - requestedQty,
      quantityReserved: item.quantityReserved + requestedQty,
    })
    .where(eq(inventoryItems.id, itemId));

  await tx.insert(inventoryReservations).values({
    basketId,
    customerId,
    inventoryItemId: itemId,
    quantity: requestedQty,
    status: 'reserved',
    expiresAt: new Date(Date.now() + 15 * 60 * 1000),
  });
});
```

> IMPORTANT: `.for('update')` is NOT officially documented in Drizzle ORM docs (as of research date) but IS implemented in the query builder source. [CITED: github.com/drizzle-team/drizzle-orm/discussions/1337] It is the community-confirmed pattern. Since the API surface exists and is used in production by many projects, confidence is HIGH.

### Pattern 3: BullMQ Delayed Job for Reservation Expiry (D-07)

**What:** When inventory is reserved, a BullMQ job is queued with a `delay` of 15 minutes. If the job fires and the order is still `payment_pending`, reservation is released back to `quantity_available`. If payment was captured, the job is a no-op.

**When to use:** Every `InventoryService.reserveItems()` call also enqueues the expiry job.

**Example:**
```typescript
// Source: docs.bullmq.io/guide/jobs/delayed + idempotent-jobs pattern
const jobId = `release-reservation:${reservationId}`;  // deterministic job ID

await reservationQueue.add(
  'release-reservation',
  { reservationId },
  {
    jobId,              // Deterministic ID prevents duplicate jobs on retry
    delay: 15 * 60 * 1000,  // 15 minutes in ms
    removeOnComplete: true,
    removeOnFail: { count: 3 },
  }
);

// Worker: idempotent check before releasing
async function processReleaseReservation(job: Job<{ reservationId: string }>) {
  const { reservationId } = job.data;
  const reservation = await db.select().from(inventoryReservations)
    .where(eq(inventoryReservations.id, reservationId)).limit(1);

  if (!reservation[0] || reservation[0].status !== 'reserved') {
    return; // Already consumed or released — no-op
  }

  await db.transaction(async (tx) => {
    await tx.update(inventoryItems)
      .set({
        quantityAvailable: sql`${inventoryItems.quantityAvailable} + ${reservation[0].quantity}`,
        quantityReserved: sql`${inventoryItems.quantityReserved} - ${reservation[0].quantity}`,
      })
      .where(eq(inventoryItems.id, reservation[0].inventoryItemId));

    await tx.update(inventoryReservations)
      .set({ status: 'expired' })
      .where(eq(inventoryReservations.id, reservationId));
  });
}
```

### Pattern 4: Stripe Webhook Raw Body in Fastify (CRITICAL)

**What:** Stripe's `constructEvent()` requires the exact raw bytes received. Fastify's default JSON parser transforms the body before the handler runs. The fix is a route-scoped `addContentTypeParser` with `parseAs: 'buffer'`.

**When to use:** Only for `POST /webhooks/stripe`. Do not apply globally — it would break JSON parsing for all other routes.

**Example:**
```typescript
// Source: github.com/fastify/help/issues/158 + docs.stripe.com/webhooks/signature
export async function stripeWebhookRoutes(fastify: FastifyInstance) {
  // Override JSON parser for this route scope only
  fastify.addContentTypeParser(
    'application/json',
    { parseAs: 'buffer' },
    (_req, body, done) => {
      done(null, body); // Pass raw Buffer — Stripe needs the exact bytes
    }
  );

  fastify.post('/webhooks/stripe', async (request, reply) => {
    const sig = request.headers['stripe-signature'] as string;
    const rawBody = request.body as Buffer;

    let event: Stripe.Event;
    try {
      event = stripe.webhooks.constructEvent(rawBody, sig, env.STRIPE_WEBHOOK_SECRET);
    } catch (err) {
      return reply.status(400).send({ error: 'Webhook signature verification failed' });
    }

    // D-10: Idempotency upsert
    const inserted = await db.insert(paymentEvents)
      .values({
        provider: 'stripe',
        providerEventId: event.id,
        eventType: event.type,
        payload: event,
      })
      .onConflictDoNothing({ target: [paymentEvents.provider, paymentEvents.providerEventId] })
      .returning({ id: paymentEvents.id });

    if (inserted.length === 0) {
      return reply.status(200).send({ received: true }); // Duplicate — no-op
    }

    // Dispatch canonical event...
    return reply.status(200).send({ received: true });
  });
}
```

> Note: The same `addContentTypeParser` + `onConflictDoNothing` pattern applies for `POST /webhooks/razorpay`, substituting HMAC SHA256 verification via `crypto.createHmac`.

### Pattern 5: Razorpay HMAC Webhook Verification

**What:** Razorpay sends a `x-razorpay-signature` header. Verification uses Node.js `crypto.createHmac('sha256', secret).update(rawBody).digest('hex')`.

**Example:**
```typescript
// Source: razorpay.com/docs/webhooks/validate-test + razorpay-node GitHub
import crypto from 'node:crypto';

const sig = request.headers['x-razorpay-signature'] as string;
const rawBody = request.body as Buffer;

const computed = crypto
  .createHmac('sha256', env.RAZORPAY_WEBHOOK_SECRET)
  .update(rawBody)
  .digest('hex');

if (!crypto.timingSafeEqual(Buffer.from(computed, 'hex'), Buffer.from(sig, 'hex'))) {
  return reply.status(400).send({ error: 'Webhook signature verification failed' });
}
```

### Pattern 6: Multi-Vendor Commission Split with allocate()

**What:** When an order spans multiple vendors, the total order amount is split by vendor subtotal ratios using `allocate()`. Commission is then computed per vendor sub-order.

**Example:**
```typescript
// Source: packages/contracts/src/money/allocate.ts (already implemented + tested)
import { allocate } from '@grovio/contracts/money';

// Example: order total 10000 paise, vendor A subtotal 6000, vendor B subtotal 4000
const vendorSubtotals = [6000n, 4000n]; // BIGINT minor units
const totalMinor = 10000n;

// Split proportionally (largest-remainder method, no drift)
const [vendorAShare, vendorBShare] = allocate(totalMinor, vendorSubtotals.map(Number));
// vendorAShare = 6000n, vendorBShare = 4000n

// Commission per vendor (flat rate from CommissionService)
const vendorACommissionRate = 0.10; // 10%
const [vendorACommission, vendorANet] = allocate(vendorAShare, [10, 90]); // 10% + 90%
// vendorACommission = 600n, vendorANet = 5400n
```

### Pattern 7: Wallet Append-Only Ledger (WAL-03)

**What:** The wallet is a series of immutable `wallet_entries` rows. Balance = `SUM(amount_minor)` where `entry_type IN ('credit', 'refund_credit')` minus `SUM(amount_minor)` where `entry_type = 'debit'`. A cached `wallet_balance_minor` column on `customers` table is maintained transactionally.

**When to use:** Every wallet read (balance display) and write (checkout debit, refund credit).

**Example:**
```typescript
// Pattern: Append-only insert + cached balance update in same transaction
await db.transaction(async (tx) => {
  await tx.insert(walletEntries).values({
    customerId,
    entryType: 'debit',
    amountMinor: walletAppliedMinor,
    idempotencyKey: `order:${orderId}:wallet-debit`,  // Unique constraint prevents double-spend
    referenceId: orderId,
    referenceType: 'order',
  });

  // Update cached balance (derived, not authoritative)
  await tx.update(customers)
    .set({ walletBalanceMinor: sql`${customers.walletBalanceMinor} - ${walletAppliedMinor}` })
    .where(eq(customers.id, customerId));
});
```

### Pattern 8: React Query Basket Mutations (D-04)

**What:** Basket state is server-authoritative. Mutations (add/update/remove) use React Query's `useMutation` with `onMutate` optimistic update and `onError` rollback. `onSettled` always invalidates the basket query.

**Example:**
```typescript
// Source: tanstack.com/query/v5/docs/react/guides/optimistic-updates
export function useAddToBasket() {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: (vars: { productId: string; variantId?: string; quantity: number }) =>
      apiClient.post('/basket/items', vars),

    onMutate: async (vars) => {
      await queryClient.cancelQueries({ queryKey: ['basket'] });
      const previous = queryClient.getQueryData(['basket']);
      // Optimistic update (show count +1 in header instantly)
      queryClient.setQueryData(['basket'], (old: BasketResponse | undefined) => ({
        ...old,
        itemCount: (old?.itemCount ?? 0) + vars.quantity,
      }));
      return { previous };
    },

    onError: (_err, _vars, context) => {
      queryClient.setQueryData(['basket'], context?.previous);
    },

    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ['basket'] });
    },
  });
}
```

### Anti-Patterns to Avoid

- **Client-trusted totals:** Never pass `amount` from the checkout form body to the payment provider. Always re-fetch prices from the `products`/`product_variants` table inside `CheckoutService` (CHK-04, Pitfall 5).
- **Stripe SDK in CheckoutService:** Never import `stripe` inside `CheckoutService.ts`. Only `PaymentProvider` interface is allowed there (PAY-01, Pitfall 9).
- **Parsed body for Stripe webhook:** Never pass `JSON.stringify(request.body)` to `stripe.webhooks.constructEvent()` — it will always fail. Must use raw `Buffer` (Pattern 4 above).
- **Direct wallet balance edit:** Never `UPDATE customers SET wallet_balance_minor = X`. Always write a `wallet_entries` row first, then update cached balance in the same transaction (WAL-03, Pitfall 3).
- **Float arithmetic for money:** Never `commission = subTotal * 0.10` when `subTotal` is a `number` type holding minor units. Use `BigInt` arithmetic: `commission = BigInt(Math.round(Number(subTotalBigInt) * ratePercent / 100))` or the `allocate()` split pattern (Pitfall 1, Pitfall 7).
- **Razorpay SDK on the frontend:** There is no Razorpay npm package for browsers. Use `window.Razorpay` from the CDN script tag only.
- **BullMQ job without deterministic jobId:** Always set `jobId` on reservation expiry jobs. Without it, server restart may enqueue duplicate release jobs for the same reservation.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Integer allocation with no rounding drift | Custom split function | `allocate()` from `packages/contracts/money` | Already implemented, tested against edge cases (100n split 3 ways, residual distribution); reinventing it risks subtle drift |
| Stripe webhook signature verification | HMAC comparison | `stripe.webhooks.constructEvent()` | Stripe's SDK handles timestamp tolerance window (replay attack prevention), header format, and version compatibility |
| Razorpay webhook signature verification | Manual HMAC | `crypto.createHmac('sha256', secret)` | Use Node.js built-in `crypto` — this is the documented Razorpay approach; no library needed |
| Payment idempotency | In-memory dedup | `payment_events` table with unique constraint + `onConflictDoNothing` | DB-level unique constraint survives restarts and horizontal scaling |
| Row-level inventory locking | Application-level mutex | `SELECT FOR UPDATE` in Drizzle transaction | DB-enforced locking is the only correct approach for concurrent checkout sessions |
| BullMQ Redis connection config | Custom ioredis setup | Reuse `bullMqConnection` from `apps/api/src/modules/jobs/queues.ts` | Already working pattern with `maxRetriesPerRequest: null` and Upstash TLS — deviation causes silent failures |
| Wallet balance read | SUM query on every request | Cached `wallet_balance_minor` on `customers` + ledger writes | SUM over large ledgers is expensive; cache updated transactionally = fast read + audit trail |

**Key insight:** Most of the complex mechanics in Phase 5 (money allocation, idempotency, locking) are either already solved in the codebase or solved by the provider SDKs. The engineering work is wiring these pieces correctly, not building the mechanics from scratch.

---

## Common Pitfalls

### Pitfall 1: Stripe Webhook Signature Failure in Fastify
**What goes wrong:** `StripeSignatureVerificationError` on every webhook, even from valid Stripe calls.
**Why it happens:** Fastify's JSON parser runs before the route handler, converting the raw body bytes to a JavaScript object. `constructEvent()` needs the original bytes.
**How to avoid:** Use `fastify.addContentTypeParser('application/json', { parseAs: 'buffer' }, ...)` scoped to the webhook route plugin. Return `Buffer` directly — do not `JSON.parse()` inside this parser for the webhook scope.
**Warning signs:** Signature errors only appear in production but not in local Stripe CLI testing (different secrets); or signature errors on all events despite correct secret.

### Pitfall 2: Inventory Oversell Under Concurrent Checkout
**What goes wrong:** Two customers both check out the last item in stock simultaneously. Both pass the availability check, both pay, one order cannot be fulfilled.
**Why it happens:** Availability check and reservation decrement are separate operations without a DB lock.
**How to avoid:** Use `SELECT FOR UPDATE` inside a transaction (Pattern 2). The second concurrent request blocks at the lock until the first transaction commits, then reads the updated `quantity_available` which is now 0.
**Warning signs:** No `FOR UPDATE` in inventory service; availability check and update are separate DB calls.

### Pitfall 3: Wallet Double-Spend via Race Condition
**What goes wrong:** Customer opens two checkout tabs simultaneously, both read the same wallet balance, both successfully apply the full balance, resulting in a negative wallet balance.
**Why it happens:** Wallet debit reads balance first, then writes entry — two concurrent reads get the same balance before either write commits.
**How to avoid:** `wallet_entries.idempotency_key` with a UNIQUE constraint prevents two `order:${orderId}:wallet-debit` entries. Also, check wallet balance inside the same transaction as the debit (or SELECT the `walletBalanceMinor` FOR UPDATE on the customers row).
**Warning signs:** No `idempotency_key` unique constraint on `wallet_entries`; balance check and debit insert are in separate transactions.

### Pitfall 4: Razorpay Checkout Fails Without order_id
**What goes wrong:** Razorpay checkout modal opens but payment immediately fails or is auto-refunded.
**Why it happens:** Payments made without an `order_id` are not captured and are automatically refunded by Razorpay.
**How to avoid:** Always create a Razorpay order via `razorpay.orders.create()` on the backend before opening the modal. Pass the returned `order.id` as `order_id` in the Razorpay options object.
**Warning signs:** `order_id` not present in Razorpay checkout options; `handler` callback receives `razorpay_payment_id` but `status` is `failed`.

### Pitfall 5: BigInt Serialization Failure
**What goes wrong:** API responses containing BigInt values (e.g., `walletBalanceMinor: 99900n`) throw `TypeError: Do not know how to serialize a BigInt` when `reply.send()` tries to JSON-serialize them.
**Why it happens:** `JSON.stringify()` does not support `BigInt` natively.
**How to avoid:** Convert all `bigint` values to `number` or `string` at the API response boundary. For amounts that fit in safe integer range (< 2^53, i.e., ~90 trillion paise), `Number(bigIntValue)` is safe. Add a Fastify serializer or a response DTO mapping step that converts before `reply.send()`.
**Warning signs:** `TypeError: Do not know how to serialize a BigInt` in Fastify logs; this ONLY appears at runtime, not at compile time.

### Pitfall 6: Coupon Applied Before Backend Recompute
**What goes wrong:** Customer applies coupon; the discount is stored on the frontend state; checkout completes without the backend re-applying the coupon discount, resulting in incorrect order total charged.
**Why it happens:** Coupon discount value computed on the frontend is trusted as authoritative.
**How to avoid:** Per D-17/CONTEXT.md Specific Ideas: store the coupon code on the order at placement time; `CheckoutService` re-validates and re-applies the coupon from the `coupons` table when computing the final `grand_total_minor`. Never trust a client-provided discount amount.
**Warning signs:** `discount_amount_minor` in the request body is used directly without re-validation.

### Pitfall 7: Commission Not Reversed on Refund
**What goes wrong:** Vendor receives a refund approval, customer gets money back, but the `vendor_commission_entries` still shows full earned commission, leading to overpayment in Phase 6 payout.
**Why it happens:** Return/refund flow modifies `orders` status but does not touch commission records.
**How to avoid:** `ReturnService.approveReturn()` must (a) insert a `wallet_entries` row with `entry_type='refund_credit'`, AND (b) insert a `vendor_commission_entries` row with `status='reversed'` for the proportional amount (D-15, MKT-03, allocate() proration).
**Warning signs:** `return_requests` status transitions to `approved` without any corresponding `vendor_commission_entries` reversal row.

### Pitfall 8: Payment Webhook Before Order Record Exists
**What goes wrong:** Payment provider webhook fires before the `orders` record is created (race between the client-side confirmation and the webhook delivery).
**Why it happens:** Stripe and Razorpay can fire `payment.captured` / `payment_intent.succeeded` within milliseconds of the client-side confirmation — sometimes before the server has created the order record.
**How to avoid:** Store the `provider_order_id` on the `orders` record at PaymentIntent/order creation time (before the client-side confirmation step). The webhook handler looks up the order by `provider_order_id`, not by internal order ID. If the order record is not found, enqueue the webhook event for retry rather than failing.
**Warning signs:** Webhook handler does a lookup by `orderId` from the webhook payload without a fallback; no retry mechanism for "order not found" state.

---

## Code Examples

### Full Inventory Reservation Service
```typescript
// Source: Drizzle docs (orm.drizzle.team/docs/transactions) + .for('update') community pattern
async reserveItems(params: {
  basketId: string;
  customerId: string;
  items: Array<{ inventoryItemId: string; quantity: number }>;
}): Promise<string[]> {
  const reservationIds: string[] = [];

  for (const item of params.items) {
    await this.deps.db.transaction(async (tx) => {
      const [invRow] = await tx
        .select()
        .from(inventoryItems)
        .where(eq(inventoryItems.id, item.inventoryItemId))
        .for('update');  // Row-level lock

      if (!invRow || invRow.quantityAvailable < item.quantity) {
        throw new Error(`INSUFFICIENT_STOCK:${item.inventoryItemId}`);
      }

      await tx.update(inventoryItems)
        .set({
          quantityAvailable: invRow.quantityAvailable - item.quantity,
          quantityReserved: invRow.quantityReserved + item.quantity,
        })
        .where(eq(inventoryItems.id, item.inventoryItemId));

      const [reservation] = await tx.insert(inventoryReservations)
        .values({
          basketId: params.basketId,
          customerId: params.customerId,
          inventoryItemId: item.inventoryItemId,
          quantity: item.quantity,
          status: 'reserved',
          expiresAt: new Date(Date.now() + 15 * 60 * 1000),
        })
        .returning({ id: inventoryReservations.id });

      reservationIds.push(reservation.id);
    });
  }

  // Enqueue expiry jobs after all reservations committed
  for (const reservationId of reservationIds) {
    await this.deps.reservationQueue.add(
      'release-reservation',
      { reservationId },
      { jobId: `release-reservation:${reservationId}`, delay: 15 * 60 * 1000 }
    );
  }

  return reservationIds;
}
```

### Commission Computation
```typescript
// Source: ARCHITECTURE.md commission rules + allocate() from packages/contracts/money
async computeCommission(params: {
  vendorOrderId: string;
  vendorId: string;
  categoryId: string;
  subtotalMinor: bigint;
}): Promise<void> {
  // Priority chain: vendor rate > category rate > global rate (D-14)
  const rate = await this.resolveRate(params.vendorId, params.categoryId);

  // BIGINT arithmetic: (subtotal * rate_percent) / 100
  // Use allocate() to split into [commission, net] with no rounding drift
  const rateParts = [rate, 100 - rate]; // e.g., [10, 90] for 10% rate
  const [commissionMinor, netVendorMinor] = allocate(params.subtotalMinor, rateParts);

  await this.deps.db.insert(vendorCommissionEntries).values({
    vendorOrderId: params.vendorOrderId,
    ratePercent: rate.toString(),
    orderSubtotalMinor: Number(params.subtotalMinor), // BIGINT → number (safe: <2^53)
    commissionAmountMinor: Number(commissionMinor),
    netVendorMinor: Number(netVendorMinor),
    status: 'earned',
  });
}
```

### Order Summary BIGINT Serialization Guard
```typescript
// Pattern: convert BigInt to number at response boundary (Pitfall 5)
function serializeOrderSummary(order: SelectOrder) {
  return {
    id: order.id,
    displayId: order.displayId,
    subtotalMinor: Number(order.subtotalMinor),      // bigint → number
    shippingMinor: Number(order.shippingMinor),
    walletAppliedMinor: Number(order.walletAppliedMinor),
    grandTotalMinor: Number(order.grandTotalMinor),
    status: order.status,
    createdAt: order.createdAt.toISOString(),
  };
}
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|-----------------|--------------|--------|
| Stripe `charges` API | Stripe `PaymentIntents` API | 2019 (SCA compliance) | PaymentIntents handle 3DS/SCA automatically; Charges API is legacy |
| Stripe `CardElement` | Stripe `PaymentElement` | 2021 | PaymentElement supports all payment methods in one component; CardElement only handles cards |
| Razorpay Checkout in `<script>` tag | Same (Razorpay v1 checkout.js) | Unchanged | Razorpay does not have an official React package; CDN script + `window.Razorpay` is still the standard approach |
| `react-stripe-elements` | `@stripe/react-stripe-js` | 2020 | Old package is deprecated; new package supports PaymentElement and all current Stripe.js features |
| BullMQ `QueueScheduler` (standalone process) | Built into Worker (v2+) | BullMQ v2 | No longer need a separate QueueScheduler process — Worker handles delayed jobs internally |

**Deprecated/outdated:**
- `react-stripe-elements` (old package): Replaced by `@stripe/react-stripe-js`. Do not use.
- `stripe.charges.create()`: Use `stripe.paymentIntents.create()` for all new integrations.
- BullMQ `QueueScheduler`: Removed in v2+. The Worker now handles delayed job promotion internally. [ASSUMED — based on BullMQ changelog knowledge; verify against current docs.bullmq.io if uncertain]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BullMQ `QueueScheduler` is not needed in v5.x (Worker handles delayed jobs internally) | State of the Art, Pattern 3 | Low — easily verified by running a delayed job in dev; the existing BullMQ pattern in `queues.ts` and `workers.ts` doesn't use QueueScheduler and already works in Phase 3 |
| A2 | Drizzle ORM `.for('update')` works in the currently-installed version (`drizzle-orm` 1.0.0-rc.3) | Pattern 2, Don't Hand-Roll | Medium — if this API changed in the rc.3 version from community docs, the SELECT FOR UPDATE pattern would need a raw SQL fallback via `db.execute(sql\`SELECT ... FOR UPDATE\`)` |
| A3 | Razorpay checkout.js CDN script approach is still the correct frontend integration for React SPA | Pattern section, Storefront stack | Low — Razorpay's official docs consistently describe this pattern; no official React package exists |
| A4 | `@stripe/react-stripe-js` 6.5.0 is compatible with React 19.2.x | Standard Stack | Low — Stripe React SDK is tested against React 18+; React 19 is backward-compatible; watch for any `useEffect` cleanup issues but none are known |
| A5 | Coupon discount stored at order placement time (not recalculated on every request) is the correct approach | Architecture Patterns, Pitfall 6 | Low — this matches CONTEXT.md Specific Ideas verbatim ("The discount is stored on the order record at placement time") |

**If this table is empty:** All claims were verified or cited. This table has 5 assumptions, all LOW risk.

---

## Open Questions

1. **Refund-to-original-payment-method (CONTEXT.md Deferred)**
   - What we know: D-16 says customer can choose wallet credit OR original payment method. CONTEXT.md deferred notes "Phase 5 may implement wallet refund only in the first iteration."
   - What's unclear: Does Phase 5 scope include the provider refund API call (`stripe.refunds.create()` / `razorpay.payments.refund()`) or only wallet credit refunds?
   - Recommendation: Planner should implement wallet-credit-only refunds in Phase 5. The provider API call path requires storing `payment_intent_id` per order (which is a good idea regardless) and can be added in a single Wave within Phase 5 or deferred to Phase 6. Storing the payment intent ID on the order record should be done in Phase 5 regardless.

2. **Wallet balance storage on `customers` table**
   - What we know: ARCHITECTURE.md says a cached `current_balance_minor` is acceptable. CONTEXT.md says `wallet_balance_minor` follows the naming convention.
   - What's unclear: Should `wallet_balance_minor` be added to the existing `customers` table (requires a migration) or stored in a separate `wallets` table per ARCHITECTURE.md?
   - Recommendation: Add `wallet_balance_minor BIGINT NOT NULL DEFAULT 0` directly to `customers` table (simpler FK path). A separate `wallets` table adds a join for every wallet read with no benefit in Phase 5 since wallets are 1:1 with customers.

3. **`drizzle-orm` version in use is `1.0.0-rc.3`**
   - What we know: The installed version is `1.0.0-rc.3` per `apps/api/package.json` — not the `0.45.x` stable that CLAUDE.md specifies.
   - What's unclear: The `1.0.0-rc.3` version may have API changes from `0.45.x`. The `.for('update')` pattern and `onConflictDoNothing` behavior should be verified.
   - Recommendation: Planner should include a Wave 0 task to verify `.for('update')` and `onConflictDoNothing({ target: [...] })` work correctly in rc.3 before the reservation service is built. If they differ, use raw SQL via `db.execute(sql\`...\`)` as a fallback.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | ✓ | 24.16.0 | — |
| PostgreSQL (Neon) | DB schema migration, Drizzle ORM | ✓ | Cloud (Neon) | — |
| Redis (Upstash) | BullMQ, feature flags, basket TTL | ✓ | Cloud (Upstash) | — |
| Stripe account (test mode keys) | PAY-02/PAY-04 Stripe integration | [ASSUMED] | Test keys from env | Cannot test Stripe flows without STRIPE_SECRET_KEY + STRIPE_WEBHOOK_SECRET in .env |
| Razorpay account (test mode keys) | PAY-02/PAY-04 Razorpay integration | [ASSUMED] | Test keys from env | Cannot test Razorpay flows without RAZORPAY_KEY_ID + RAZORPAY_KEY_SECRET in .env |
| Stripe CLI | Local webhook testing | [ASSUMED] | — | Manual webhook replay via Stripe dashboard |

**Missing dependencies with no fallback:**
- Stripe test API keys (`STRIPE_SECRET_KEY`, `STRIPE_PUBLISHABLE_KEY`, `STRIPE_WEBHOOK_SECRET`): Required to test any Stripe payment flow. Must be added to `.env` before payment integration tests can run.
- Razorpay test API keys (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`): Same constraint.

**Missing dependencies with fallback:**
- Stripe CLI: Helpful for webhook testing but not strictly required — Stripe Dashboard can replay events.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `apps/api/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter @grovio/api test -- --reporter=dot` |
| Full suite command | `pnpm --filter @grovio/api test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | Notes |
|--------|----------|-----------|-------------------|-------|
| CHK-01 | Add/update/remove basket items | unit | `vitest run BasketService.test.ts` | Wave 0 gap |
| CHK-02 | Guest basket merge on login | unit | `vitest run BasketService.test.ts` | Wave 0 gap |
| CHK-04 | Backend-authoritative totals (tampered client payload rejected) | unit | `vitest run CheckoutService.test.ts` | Wave 0 gap |
| CHK-05 | Atomic inventory reservation (concurrent checkout) | unit | `vitest run InventoryService.test.ts` | Wave 0 gap; mock `db.transaction` |
| CHK-06 | Coupon eligibility validation | unit | `vitest run CouponService.test.ts` | Wave 0 gap |
| PAY-01 | PaymentProvider interface (Stripe adapter does not bleed into CheckoutService) | unit | `vitest run PaymentService.test.ts` | Wave 0 gap |
| PAY-03 | Webhook idempotency (duplicate delivery = no-op) | unit | `vitest run stripeWebhook.test.ts` | Wave 0 gap |
| WAL-03 | Wallet append-only (no direct balance edit code path) | unit | `vitest run WalletService.test.ts` | Wave 0 gap |
| WAL-05 | Wallet hybrid checkout (wallet_applied_minor capped at min(balance, total)) | unit | `vitest run WalletService.test.ts` | Wave 0 gap |
| ORD-02 | Multi-vendor order splitting (vendor sub-orders created) | unit | `vitest run OrderService.test.ts` | Wave 0 gap |
| MKT-01 | Commission rate priority chain (vendor > category > global) | unit | `vitest run CommissionService.test.ts` | Wave 0 gap |
| MKT-02 | Commission split sums exactly to order total (no rounding drift) | unit | `vitest run CommissionService.test.ts` | Wave 0 gap; test with awkward amounts e.g. 10001n across 3 vendors |
| MKT-03 | Partial refund reversal proration via allocate() | unit | `vitest run ReturnService.test.ts` | Wave 0 gap |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grovio/api test -- --reporter=dot`
- **Per wave merge:** `pnpm --filter @grovio/api test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/basket/BasketService.test.ts` — covers CHK-01, CHK-02
- [ ] `apps/api/src/modules/checkout/CheckoutService.test.ts` — covers CHK-04
- [ ] `apps/api/src/modules/inventory/InventoryService.test.ts` — covers CHK-05 (concurrent mock)
- [ ] `apps/api/src/modules/coupons/CouponService.test.ts` — covers CHK-06
- [ ] `apps/api/src/modules/payments/PaymentService.test.ts` — covers PAY-01, PAY-03
- [ ] `apps/api/src/modules/wallet/WalletService.test.ts` — covers WAL-03, WAL-05
- [ ] `apps/api/src/modules/orders/OrderService.test.ts` — covers ORD-02
- [ ] `apps/api/src/modules/commissions/CommissionService.test.ts` — covers MKT-01, MKT-02
- [ ] `apps/api/src/modules/returns/ReturnService.test.ts` — covers MKT-03

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes (basket + checkout routes) | `requireCustomerAuth` middleware (existing Phase 4 pattern) |
| V3 Session Management | yes (basket sessions) | httpOnly cookie `grovio_basket_token`; 30-day TTL; server-side |
| V4 Access Control | yes (order ownership, vendor sub-order access) | `customerId` from JWT on all basket/order reads; vendor-scoped sub-order routes |
| V5 Input Validation | yes | Zod schemas on all request bodies; backend re-derives totals (CHK-04) |
| V6 Cryptography | yes (webhook signatures) | `stripe.webhooks.constructEvent()` (HMAC-SHA256 + timestamp tolerance); `crypto.createHmac` for Razorpay |

### Known Threat Patterns for Commerce Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Client-supplied order total manipulation | Tampering | Backend re-fetches all prices from catalog; never trusts `amount` from request body |
| Replay attack on payment webhook | Tampering | Stripe: `constructEvent()` checks timestamp tolerance (default 300s). Razorpay: idempotency via `payment_events` unique constraint |
| Double-spend wallet attack | Elevation of Privilege | `wallet_entries.idempotency_key` unique constraint; `SELECT FOR UPDATE` on balance before debit |
| Inventory oversell (race condition) | Tampering | `SELECT FOR UPDATE` + transaction for all reservation writes (Pitfall 2) |
| Coupon code brute force | Elevation of Privilege | `COUPONS_ENABLED` feature flag; short-circuit on disabled; rate-limiting on `/checkout/apply-coupon` endpoint |
| Guest basket token prediction | Spoofing | Token is a random UUID (cryptographically random); httpOnly cookie prevents XSS theft |
| Cross-customer basket access | Elevation of Privilege | `basket_sessions` linked to `customer_id` (authenticated) or `guest_token` (cookie); strict ownership check in BasketService |
| Stripe webhook without signature | Spoofing | Signature verification is the FIRST action in webhook handler; reject before any DB access |
| SQL injection via coupon codes | Tampering | Parameterized Drizzle ORM queries; never string-interpolated SQL for coupon lookup |

---

## Sources

### Primary (HIGH confidence)
- [ARCHITECTURE.md](.planning/research/ARCHITECTURE.md) — PaymentProvider abstraction pattern, wallet append-only ledger, commission split data model
- [PITFALLS.md](.planning/research/PITFALLS.md) — Pitfall 1 (BIGINT), Pitfall 2 (inventory), Pitfall 3 (wallet), Pitfall 5 (client totals), Pitfall 7 (commission residual), Pitfall 9 (provider coupling), Pitfall 10 (webhook idempotency)
- [Stripe Docs: Accept a Payment (Web + Elements)](https://docs.stripe.com/payments/accept-a-payment?platform=web&ui=elements)
- [Stripe Docs: Webhook Signature Verification](https://docs.stripe.com/webhooks/signature)
- [Razorpay Docs: Standard Checkout Integration Steps](https://razorpay.com/docs/payments/payment-gateway/web-integration/standard/integration-steps/)
- [Razorpay Docs: Validate and Test Webhooks](https://razorpay.com/docs/webhooks/validate-test/)
- [Razorpay Docs: Payments Webhook Events](https://razorpay.com/docs/webhooks/payments/)
- [TanStack Query v5: Optimistic Updates](https://tanstack.com/query/v5/docs/react/guides/optimistic-updates)
- [BullMQ Docs: Delayed Jobs](https://docs.bullmq.io/guide/jobs/delayed)
- [BullMQ Docs: Idempotent Jobs](https://docs.bullmq.io/patterns/idempotent-jobs)
- `packages/contracts/src/money/allocate.ts` — allocate() already implemented and tested
- `apps/api/src/modules/jobs/queues.ts` — existing BullMQ connection pattern (reused)
- `apps/api/src/middleware/customerAuth.ts` — existing requireCustomerAuth (reused)

### Secondary (MEDIUM confidence)
- [github.com/fastify/help/issues/158](https://github.com/fastify/help/issues/158) — Fastify raw body for Stripe webhook (addContentTypeParser pattern)
- [github.com/drizzle-team/drizzle-orm/discussions/1337](https://github.com/drizzle-team/drizzle-orm/discussions/1337) — Drizzle `.for('update')` pattern (community-confirmed, not in official docs)

### Tertiary (LOW confidence — marked as [ASSUMED] where applicable)
- BullMQ QueueScheduler removal claim (A1 in Assumptions Log) — needs verification against docs.bullmq.io for v5.x

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all package versions verified against npm registry from official packages
- Architecture: HIGH — PaymentProvider, wallet ledger, commission splits all documented in ARCHITECTURE.md and verified patterns
- Pitfalls: HIGH — verified from PITFALLS.md + official provider docs + codebase inspection
- Stripe webhook Fastify pattern: MEDIUM — community-verified GitHub issue, consistent with Stripe official docs
- Drizzle SELECT FOR UPDATE: MEDIUM — community-confirmed in discussions, not in official docs

**Research date:** 2026-06-02
**Valid until:** 2026-07-02 (30 days; Stripe and Razorpay SDK versions should be re-verified if planning extends beyond this date)
