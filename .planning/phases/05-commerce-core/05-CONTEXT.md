# Phase 5: Commerce Core - Context

**Gathered:** 2026-06-02
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete commerce layer that lets a customer complete a purchase end-to-end: basket management (guest + authenticated), multi-step checkout flow, inventory reservation, payment processing via Stripe or Razorpay behind a `PaymentProvider` abstraction, wallet ledger with hybrid card+wallet checkout, order placement with multi-vendor splitting, commission engine, and a simple feature-flagged coupon engine. All money operations are backend-authoritative.

**Also in scope (storefront UI):**
- Basket/cart page in `apps/web-storefront` (activates Phase 4's disabled Add to Cart button)
- Multi-step checkout pages (`/checkout/address`, `/checkout/delivery`, `/checkout/payment`, `/checkout/review`)
- Order confirmation + order history + order detail pages
- Customer return request flow (self-serve)

**Specifically NOT in scope:**
- Vendor return approval UI and vendor order management UI (Phase 6)
- Admin payout management UI and commission reporting (Phase 6)
- Automated vendor payouts via Stripe Connect / Razorpay Route (v2, PAY2-01)
- React Native checkout flow (Phase 7)
- Order tracking/delivery timeline (Phase 8)

</domain>

<decisions>
## Implementation Decisions

### Basket Persistence & Guest Merge

- **D-01:** Basket is **server-side only**. Guest basket is keyed by a cookie-based guest token (similar pattern to httpOnly auth cookies from Phase 4 D-09). No localStorage for basket items. Works across devices; no reconstruction logic needed. Guest token is a random UUID, stored in a `basket_sessions` table with a 30-day TTL.
- **D-02:** **Merge strategy on login: combine both baskets.** When a guest logs in, their guest basket items are merged into the account basket. If the same variant exists in both, quantities are summed (subject to available stock cap). No items are discarded silently.
- **D-03:** **Guest basket TTL: 30 days.** Expired guest basket tokens are cleaned up via a BullMQ scheduled cleanup job (or TTL-based expiry). Items disappear silently after expiry with no error state.
- **D-04:** **Frontend basket state: React Query (server state).** No Zustand store for basket. The basket is always fetched from the server — invalidate the basket query on add/remove/update/merge mutations. Consistent with Phase 4's React Query-first data approach.

### Checkout Flow + Reservation Timing

- **D-05:** **Multi-step wizard with URL-addressable steps:** `/checkout/address` → `/checkout/delivery` → `/checkout/payment` → `/checkout/review`. Each step is a distinct React Router v6 route. Progress indicator at top. Back button works. Consistent with Phase 4's URL-serialized state approach (Phase 4 D-06).
- **D-06:** **Inventory reserved on "Proceed to Payment"** — when the customer advances from the delivery step to the payment step (checkout initiation). This is the CHK-05 "checkout initiation" trigger. A BullMQ delayed job is queued at reservation time to release after the TTL.
- **D-07:** **Abandoned reservation TTL: 15 minutes.** BullMQ fires a `ReleaseReservationJob` 15 minutes after reservation is created. If payment has been received by then, the job is a no-op (idempotent check). Released reservations return `quantity_reserved` back to `quantity_available`.
- **D-08:** **Multi-vendor order: one customer-facing order ID, items grouped by vendor.** Customer receives a single order number (e.g., `ORD-2024-001`). The order detail page groups items per vendor with per-vendor delivery status. Backend splits into sub-orders (`order_items` or a `vendor_orders` sub-table) transparently; customers are not exposed to internal sub-order IDs.

### Payment Provider UX + Webhook Design

- **D-09:** **When both providers are enabled, the payment step shows both options.** Customer sees "Pay with Card (Stripe)" and "Pay with Card/UPI (Razorpay)" as selectable payment methods. Selecting one routes through the `PaymentProvider` abstraction. If only one provider is enabled by admin, only that option appears (no choice presented).
- **D-10:** **Webhook idempotency via `payment_events` table** with a unique constraint on `(provider, provider_event_id)`. Incoming webhook upserts into this table. If the row already exists (duplicate delivery), the handler returns 200 and exits. Permanent, auditable, survives restarts. Resolves PAY-03.
- **D-11:** **Payment failure: stay on same order, retry on payment step.** When payment fails (card declined, provider error, timeout), the order record stays in `payment_pending` status. Customer is returned to the `/checkout/payment` step with an error message. They can retry with the same or a different method. The inventory reservation clock keeps ticking. No duplicate orders.
- **D-12:** **Phase 5 records commission entries only — no automated vendor payouts.** Commission amounts are written to a `vendor_commission_entries` table per sub-order. Admin views and manually settles payouts in Phase 6 (MKT-04/MKT-05). Automated Stripe Connect / Razorpay Route is v2 (PAY2-01 deferred). Resolves the STATE.md Razorpay Route feasibility blocker.

### Wallet Hybrid Checkout

- **D-13:** **Partial wallet credit allowed.** On the payment step, the customer's wallet balance is displayed. They can apply some or all of their credit. If the order total exceeds their wallet balance, the remaining amount is charged to a card via the selected payment provider. Full wallet payment (zero card charge) is also supported when balance covers the total.
- **D-16:** **Refund destination: customer's choice.** When a return is approved and a refund is issued, the customer can choose: wallet credit (append-only ledger entry, instant) or refund to original payment method (calls the provider's refund API). Admin/vendor selects the refund trigger in Phase 6; the customer's preference is captured in the return request.

### Commission Engine

- **D-14:** **Flat percentage only, priority chain: global → category → vendor.** Each level stores a single flat `rate_percent NUMERIC(5,2)` (e.g., 10.00 = 10%). The most-specific rate wins: vendor override > category override > global default. No fixed fees, no tiers in v1.
- **D-15:** **Partial-refund commission reversal (MKT-03): item-level proration using `allocate()`.** For each refunded line item, compute its share of the vendor sub-order total (`item_subtotal / sub_order_total`), then apply that proportion to the commission earned on that sub-order. Use `allocate()` from `packages/contracts/money` for BIGINT minor-unit residual distribution. No rounding drift. Resolves the STATE.md partial-refund commission proration blocker.

### Inventory Model

- **D-20:** **Inventory tracks at variant level or product level.** `inventory_items` table: rows have a nullable `product_variant_id` FK (for variant products) AND a nullable `product_id` FK (for variant-free products). Exactly one FK is non-null per row. This fulfills Phase 3 D-04's promise that "Phase 5 adds `inventory_items` linking to `product_variant_id` (or `product_id` for variant-free products)."
- **D-21:** **Two-column model: `quantity_available` + `quantity_reserved`.** Reservation atomically decrements `quantity_available` and increments `quantity_reserved` (row-level lock). Payment success: `quantity_reserved` decremented (stock sold). Abandonment: `quantity_reserved` returned to `quantity_available`. `effective_available = quantity_available` (does not count reserved).

### Order Returns (ORD-04)

- **D-22:** **Per-vendor return policy, with global fallback.** Phase 5 creates a `vendor_return_policies` table (`vendor_id FK`, `return_window_days INT`, `conditions TEXT`, `is_returnable BOOLEAN`). If a vendor has no policy row, fall back to a global default (7 days, returnable). Phase 6 adds the vendor panel UI for configuring this table. This allows Phase 5 to implement the full return eligibility check without requiring vendor configuration UI yet.
- **D-23:** **Self-serve return request from the storefront.** Customer submits a return request from their order detail page (for eligible delivered items within the return window). Request creates a `return_requests` record in `return_requested` status. Vendor reviews and approves/rejects via their panel (Phase 6). The commission reversal (MKT-03 via D-15) triggers when a return is approved.

### Storefront Cart/Basket Page

- **D-24:** **Cart items grouped by vendor with vendor name section headers.** Each vendor gets a labeled section. Per-vendor estimated delivery shown in each section header. Matches the order confirmation and order detail layout (D-08).
- **D-25:** **Order summary sidebar** (right column on desktop, bottom section on mobile): subtotal, coupon code input field, wallet credit toggle + balance display, delivery estimate, order total. Customer sees full cost breakdown before proceeding to checkout.

### Coupon Engine (CHK-06, feature-flagged)

- **D-17:** **Per-item or per-vendor discount.** Coupon scope can be vendor-level (discounts all items from a specific vendor) AND/OR product/category-level (discounts specific product IDs or category IDs). Admin sets the scope per coupon. Discount type: flat amount or percentage. One coupon per order. Feature-flagged via `COUPONS_ENABLED` feature flag.
- **D-18:** **Coupon eligibility conditions:** minimum eligible order amount (for the targeted scope), maximum total redemptions count, and expiry date. Three conditions stored on the `coupons` table.

### Claude's Discretion

- Return policy Phase 5/6 split implementation details (user deferred to Claude — recommendation above in D-22 is Claude's choice)
- Framer Motion animations for checkout steps (page transitions, step progress animation), cart item removal animations
- Exact `basket_sessions` and `basket_items` table schema beyond what's specified
- React Router v6 checkout route guard implementation (prevent skipping steps)
- Order state machine full set of states (suggested: `pending_payment → payment_received → processing → shipped → delivered → cancelled`)
- Slug/display ID strategy for orders (suggested: `ORD-YYYYMMDD-XXXXXX` short hash)
- BullMQ queue naming and concurrency for reservation expiry and basket cleanup jobs
- Customer JWT middleware for basket/checkout routes (same pattern as Phase 4 customer auth)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §"Basket & Checkout" — CHK-01 through CHK-06 (6 requirements)
- `.planning/REQUIREMENTS.md` §"Payments" — PAY-01 through PAY-04 (4 requirements)
- `.planning/REQUIREMENTS.md` §"Wallet" — WAL-01 through WAL-05 (5 requirements)
- `.planning/REQUIREMENTS.md` §"Orders" — ORD-01 through ORD-05 (5 requirements)
- `.planning/REQUIREMENTS.md` §"Multi-Vendor: Commissions & Payouts" — MKT-01 through MKT-03 (3 requirements; MKT-04/05 are Phase 6)
- `.planning/ROADMAP.md` §"Phase 5: Commerce Core" — goal, success criteria (6 SCs), dependency on Phase 4

### Architecture & Money Constraints (CRITICAL)
- `.planning/research/ARCHITECTURE.md` — PaymentProvider abstraction pattern, backend-authoritative pricing, wallet append-only ledger pattern, commission split architecture
- `.planning/research/PITFALLS.md` §"Pitfall 1" — BIGINT minor units for all money columns (no FLOAT/DECIMAL)
- `.planning/research/PITFALLS.md` §"Pitfall 9" — PaymentProvider interface; SDK code in infrastructure adapters only
- `packages/contracts/src/money/allocate.ts` — `allocate()` function for BIGINT residual distribution; MANDATORY for MKT-02 commission splits and MKT-03 partial-refund proration (D-15)
- `packages/contracts/src/money/types.ts` — `Money`, `MinorUnitAmount`, `CurrencyCode` types

### Phase 3 Contracts (Commerce Core builds on these)
- `apps/api/src/db/schema/products.ts` — products table with `base_price_minor BIGINT`
- `apps/api/src/db/schema/product-variants.ts` — `product_variants` table; Phase 5 `inventory_items` FKs to `product_variants.id` (D-20)
- `.planning/phases/03-catalog-search/03-CONTEXT.md` — D-01 through D-04: variant modeling (variant-level tracking confirmed in D-20); D-05: product status state machine; D-17: vendor auth scope

### Phase 4 Contracts (Phase 5 activates what Phase 4 left disabled)
- `.planning/phases/04-customer-storefront-web/04-CONTEXT.md` — D-13: Add to Cart button marked `data-phase="5"`; D-15: variant selectors disabled, Phase 5 activates them; D-09: httpOnly cookie auth pattern (Phase 5 basket API follows same `credentials: 'include'` approach)
- `apps/api/src/db/schema/customers.ts` — customers table; basket and order FKs reference `customers.id`
- `apps/api/src/db/schema/customer-addresses.ts` — addresses used in checkout address step
- `apps/api/src/modules/customer-auth/CustomerAuthService.ts` — checkout routes use the same customer JWT middleware
- `packages/contracts/src/auth.ts` — JwtPayload with role="customer"; basket/checkout endpoints use this

### Technology Stack
- `CLAUDE.md` §"Recommended Stack" — Stripe SDK 22.2.x, Razorpay SDK 2.9.6, BullMQ 5.77.x + ioredis 5.x (reservation expiry jobs), Drizzle ORM 0.45.x, Zod 4.x, React Query 5.x (basket state — D-04), Motion 12.x
- `CLAUDE.md` §"What NOT to Use" — no FLOAT/DECIMAL for money; no direct Stripe/Razorpay SDK calls in business logic (PaymentProvider interface only)

### Existing Patterns to Follow
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — `COUPONS_ENABLED` and `CATALOG_AUTO_APPROVE` follow this exact Redis-cache + DB-fallback pattern
- `apps/api/src/modules/jobs/` — BullMQ job registration pattern; `ReleaseReservationJob` and `BasketExpiryJob` follow this
- `apps/api/src/container.ts` — Awilix DI registration; new services (BasketService, CheckoutService, PaymentService, WalletService, OrderService, CommissionService) register here
- `apps/api/src/routes/account/` — Phase 4 account routes pattern; `/account/orders`, `/account/wallet` follow same plugin structure

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` and `apps/api/src/modules/customer-auth/CustomerAuthService.ts` — Phase 5 checkout routes use the customer JWT middleware from CustomerAuthService; same `request.user.customerId` pattern
- `packages/contracts/src/money/allocate.ts` — `allocate()` already implemented and tested; MANDATORY for commission splits (MKT-02) and partial-refund proration (MKT-03, D-15)
- `apps/api/src/db/schema/product-variants.ts` — Phase 5 `inventory_items` table FKs directly to `product_variants.id` (per Phase 3 D-04 and D-20 above)
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — `COUPONS_ENABLED` feature flag is a new entry in the FeatureFlags table; same pattern as `CATALOG_AUTO_APPROVE`
- `apps/web-storefront` Phase 4 PDP — Add to Cart button has `data-phase="5"` marker; variant selectors are rendered but disabled. Phase 5 wires these by implementing the basket API and updating the React component.

### Established Patterns
- **BIGINT minor units**: All price and money columns use `price_minor BIGINT` naming convention (Phase 3 D-01). `order_total_minor`, `commission_amount_minor`, `wallet_balance_minor` follow the same convention.
- **Append-only wallet ledger**: `wallet_entries` table (never updated, only inserted). Balance = `SUM(amount_minor)` of all entries for a customer. Entry types: `credit`, `debit`, `refund_credit`.
- **Row-level locking for inventory**: `SELECT ... FOR UPDATE` on the `inventory_items` row during reservation to prevent race conditions on concurrent checkout sessions.
- **pgEnum for status types**: Phase 3 added `productStatusEnum`. Phase 5 adds `orderStatusEnum` (`pending_payment`, `payment_received`, `processing`, `shipped`, `delivered`, `cancelled`) and `returnStatusEnum` (`return_requested`, `approved`, `rejected`, `refunded`).
- **BullMQ async jobs**: Phase 3 established `ProductIndexJob` pattern. Phase 5 adds `ReleaseReservationJob` (delayed, 15 min TTL) and optionally `BasketExpiryJob` (scheduled cleanup).
- **httpOnly cookie credentials**: Phase 4 D-09 established `credentials: 'include'` on all API fetch calls + CORS `Access-Control-Allow-Credentials: true`. Basket and checkout API calls follow the same pattern.

### Integration Points
- Phase 4 disabled Add to Cart and variant selectors are the primary storefront activation points. Phase 5 must export basket mutation hooks that Phase 4's PDP components can consume.
- Phase 4's `/account/addresses` data is reused on the checkout address step — customer can select a saved address or enter a new one (Google Places component already built in Phase 4).
- Phase 6 vendor panel will read `vendor_orders` (sub-orders), `vendor_commission_entries`, and `vendor_return_policies` — Phase 5 must create all three tables with clear schemas.
- Phase 6 admin panel will read `payment_events`, `coupons`, and `vendor_return_policies` for reporting and management.
- Phase 7 React Native will consume the same basket/checkout/wallet/order API endpoints — schemas defined in `packages/contracts` must be shared.

</code_context>

<specifics>
## Specific Ideas

- The guest basket cookie should be named `grovio_basket_token` (similar to the auth cookie naming from Phase 4). When a customer logs in, the merge endpoint (`POST /basket/merge`) reads both the guest token cookie and the auth cookie, merges server-side, and clears the guest token.
- The `payment_events` table is the audit trail for all payment webhooks. It should store: `id`, `provider` (stripe/razorpay), `provider_event_id`, `event_type`, `payload JSONB`, `processed_at`, `created_at`. This doubles as a webhook debugging tool for buyers troubleshooting payment issues.
- Commission entries (`vendor_commission_entries`) should store: `id`, `vendor_order_id FK`, `rate_percent NUMERIC(5,2)`, `order_subtotal_minor BIGINT`, `commission_amount_minor BIGINT`, `status` (earned/reversed/net), `created_at`. The `status` field enables MKT-03 reversals without modifying existing rows (append-only pattern consistent with wallet).
- Coupon application flow: `POST /checkout/apply-coupon` validates code → checks eligibility (min order, usage count, expiry, scope match) → returns a discount breakdown. The discount is stored on the order record at placement time (not recalculated on every request). Prevents coupon value drift.
- The `vendor_return_policies` table default fallback: if no row exists for a vendor, use `return_window_days=7, is_returnable=true, conditions='Standard return policy applies'`. Stored as a global config key in the FeatureFlags-adjacent settings table (or as a hardcoded safe default until Phase 6 lets admin configure it).
- Wallet balance display on the payment step: show `Wallet balance: ₹XXX.XX` with a checkbox "Apply wallet credit." If checked, a slider or input lets the customer choose how much to apply (capped at `min(wallet_balance, order_total)`). The remaining card charge updates in real-time.
- Phase 4 D-13 instructs using `data-phase="5"` on the disabled Add to Cart button. Phase 5 replaces this with a `useBasketMutation` hook call — `onClick` triggers `addToBasket({ productId, variantId, quantity })`.

</specifics>

<deferred>
## Deferred Ideas

- **Automated vendor payouts via Stripe Connect / Razorpay Route** — v2 (PAY2-01). Phase 5 records commission amounts only.
- **Tiered commission rates** (e.g., lower % at higher GMV thresholds) — v2. Phase 5 uses flat % only.
- **Fixed-fee commission component** (e.g., 8% + ₹2.00 per order) — v2. Keep it flat % for v1.
- **Per-customer coupon use limit** (e.g., 1 use per customer) — natural v1.x extension. Phase 5 supports total usage cap and expiry only.
- **Coupon stackability** (apply multiple codes) — out of scope. One coupon per order.
- **Refund-to-original-payment-method provider API calls** — the customer can choose, but Phase 5 may implement wallet refund only in the first iteration; the "original payment method" path requires storing payment intent references per order which adds complexity. Planner should assess feasibility for Phase 5 vs Phase 6.
- **Bank transfer payout requests from wallet** — v2. Phase 5 wallet is credit-only (refunds) and checkout-debit only.
- **BNPL / EMI payment options** — explicitly out of scope for v1.
- **Order cancellation by customer** (self-serve cancel before shipping) — ORD-04 mentions returns, not cancellations. Customer-initiated cancellation before payment or before dispatch is a natural v1.x feature.

None of the above add scope to Phase 5.

</deferred>

---

*Phase: 5-Commerce Core*
*Context gathered: 2026-06-02*
