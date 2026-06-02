# Phase 5: Commerce Core - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-02
**Phase:** 5-Commerce Core
**Areas discussed:** Basket persistence & guest merge, Checkout flow + reservation timing, Payment provider UX + webhook design, Wallet hybrid checkout + commission rounding, Inventory model, Order cancellation + return flow, Storefront cart design, Coupon engine eligibility rules

---

## Basket Persistence & Guest Merge

| Option | Description | Selected |
|--------|-------------|----------|
| Server-side only | Guest basket keyed by cookie-based guest token; no localStorage | ✓ |
| Client-side (localStorage) + sync on login | Items in localStorage until login, then POST to merge | |
| Hybrid: localStorage snapshot + server as source | Client caches last state; server authoritative | |

**User's choice:** Server-side only

---

| Option | Description | Selected |
|--------|-------------|----------|
| Merge: combine both baskets | Items combined; same variant quantities summed | ✓ |
| Guest wins: replace the saved basket | Current session replaces saved basket | |
| Account wins: discard the guest basket | Saved account basket takes over | |

**User's choice:** Merge — combine both baskets, quantities summed for same variant

---

| Option | Description | Selected |
|--------|-------------|----------|
| 30 days | Standard e-commerce TTL; silent expiry | ✓ |
| 7 days | Shorter window | |
| Session-only | Expires on browser close | |

**User's choice:** 30 days

---

| Option | Description | Selected |
|--------|-------------|----------|
| React Query (server state) | Always fetched from server; basket query invalidated on mutations | ✓ |
| Zustand (client-managed, synced to server) | Local state synced to backend | |
| You decide | Claude discretion | |

**User's choice:** React Query

---

## Checkout Flow + Reservation Timing

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard with URL-addressable steps | /checkout/address → /delivery → /payment → /review | ✓ |
| Single-page progressive disclosure | All steps on one page, expanding sections | |
| Modal / drawer overlay on basket page | Checkout as side drawer | |

**User's choice:** Multi-step wizard with URL-addressable steps

---

| Option | Description | Selected |
|--------|-------------|----------|
| On 'Proceed to Payment' — checkout initiation | Stock locked when customer reaches payment step | ✓ |
| On 'Place Order' after payment | No lock until payment succeeds | |
| On 'Add to Cart' (basket add) | Very aggressive early locking | |

**User's choice:** On 'Proceed to Payment' (checkout initiation)

---

| Option | Description | Selected |
|--------|-------------|----------|
| 15 minutes | Standard e-commerce window | ✓ |
| 30 minutes | More forgiving | |
| Configurable via env var (default 15 min) | Buyers can tune | |

**User's choice:** 15 minutes

---

| Option | Description | Selected |
|--------|-------------|----------|
| One order ID, grouped by vendor | Single order number; detail page grouped by vendor | ✓ |
| Separate order IDs per vendor | Customer gets multiple order numbers | |
| You decide | Claude discretion | |

**User's choice:** One order ID, grouped by vendor

---

## Payment Provider UX + Webhook Design

| Option | Description | Selected |
|--------|-------------|----------|
| Payment step shows both options | Customer picks Stripe or Razorpay | ✓ |
| Admin configures single active provider | No customer-facing choice | |
| You decide | Claude discretion | |

**User's choice:** Payment step shows both options when both are enabled

---

| Option | Description | Selected |
|--------|-------------|----------|
| payment_events table with unique constraint | DB-level idempotency; permanent audit trail | ✓ |
| Redis lock keyed by event ID (TTL-based) | Short-lived lock; no audit trail | |
| You decide | Claude discretion | |

**User's choice:** payment_events table with unique (provider, provider_event_id) constraint

---

| Option | Description | Selected |
|--------|-------------|----------|
| Stay on same order, retry payment | Order stays payment_pending; customer retries on payment step | ✓ |
| Create a new order on retry | New order per payment attempt | |
| Cancel the order, send back to basket | Order cancelled on failure | |

**User's choice:** Stay on same order, retry payment

---

| Option | Description | Selected |
|--------|-------------|----------|
| Record commissions only — manual payouts Phase 6 | Phase 5 records entries; no automated disbursement | ✓ |
| Wire automated payouts in Phase 5 | Stripe Connect / Razorpay Route now | |

**User's choice:** Record commissions only. Resolves STATE.md Razorpay Route blocker.

---

## Wallet Hybrid Checkout + Commission Rounding

| Option | Description | Selected |
|--------|-------------|----------|
| Partial wallet allowed — card covers remainder | Customer applies some or all credit; card for rest | ✓ |
| Full wallet only — insufficient balance = no wallet option | Only if wallet covers full total | |
| You decide | Claude discretion | |

**User's choice:** Partial wallet — card covers remainder

---

| Option | Description | Selected |
|--------|-------------|----------|
| Flat percentage only, override chain | Global → category → vendor; most specific wins | ✓ |
| Flat % + optional fixed fee per order | More flexible | |
| Tiered rates | Volume-based commission drops | |

**User's choice:** Flat percentage only, priority chain

---

| Option | Description | Selected |
|--------|-------------|----------|
| Item-level proration using allocate() | Per-item share × commission; BIGINT safe | ✓ |
| Order-level flat proportion | Refund % × total commission | |
| You decide | Claude discretion | |

**User's choice:** Item-level proration using allocate(). Resolves STATE.md partial-refund blocker.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Wallet only | All refunds to wallet; no provider API calls | |
| Back to original payment method | Provider refund API call | |
| Customer can choose | Customer selects wallet or original method | ✓ |

**User's choice:** Customer can choose refund destination

---

## Inventory Model

| Option | Description | Selected |
|--------|-------------|----------|
| Variant-level for variant products, product-level for variant-free | Nullable FK complement per Phase 3 D-04 | ✓ |
| Always at the variant level (default variant for variant-free) | Uniform FK model | |
| You decide | Claude discretion | |

**User's choice:** Variant-level for variant products, product-level for variant-free

---

| Option | Description | Selected |
|--------|-------------|----------|
| quantity_available + quantity_reserved columns | Two-column atomic reservation | ✓ |
| Single quantity_on_hand + reservation records table | Separate reservations table | |
| You decide | Claude discretion | |

**User's choice:** quantity_available + quantity_reserved columns

---

## Order Cancellation + Return Flow

| Option | Description | Selected |
|--------|-------------|----------|
| Admin-configurable return window (default 7 days) + delivered status | Simple global rule | |
| Per-vendor return policy (vendor sets window and conditions) | More realistic marketplace | ✓ |
| You decide | Claude discretion | |

**User's choice:** Per-vendor return policy

---

| Option | Description | Selected |
|--------|-------------|----------|
| Store vendor_return_policy table in Phase 5, default to global fallback | Create table now; UI in Phase 6 | |
| Phase 5 uses global default only; vendor policy deferred to Phase 6 | Simpler for Phase 5 | |
| You decide | Claude discretion | ✓ |

**User's choice:** You decide. Claude will create the `vendor_return_policies` table in Phase 5 with a global fallback; Phase 6 adds configuration UI.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Self-serve customer request via storefront | Customer submits from order detail page | ✓ |
| Admin-assisted only in Phase 5 | No self-serve UI | |
| You decide | Claude discretion | |

**User's choice:** Self-serve customer request via storefront

---

## Storefront Cart/Basket Page Design

| Option | Description | Selected |
|--------|-------------|----------|
| Grouped by vendor with vendor name header | Vendor sections with per-vendor delivery | ✓ |
| Flat list (no vendor grouping) | Vendor name as label on each item row | |
| You decide | Claude discretion | |

**User's choice:** Grouped by vendor with vendor name headers

---

| Option | Description | Selected |
|--------|-------------|----------|
| Order summary sidebar (right desktop / bottom mobile) | Subtotal, coupon, wallet, total in sidebar | ✓ |
| On the payment step of checkout only | Delay cost visibility | |
| Cart page + payment step both | Split coupon/wallet across two steps | |

**User's choice:** Order summary sidebar on the cart page

---

## Coupon Engine Eligibility Rules

| Option | Description | Selected |
|--------|-------------|----------|
| Coupon targets a vendor (all items from that vendor) | Vendor-scoped discount | |
| Coupon targets specific product IDs or category IDs | Product/category-scoped discount | |
| Both: vendor-level AND product/category-level | Admin chooses scope per coupon | ✓ |

**User's choice:** Both — vendor-level and product/category-level scope options

---

| Option | Description | Selected |
|--------|-------------|----------|
| Min order value + usage limit + expiry date | Three standard conditions | ✓ |
| Min order value + per-customer use limit only | No total cap | |
| You decide | Claude discretion | |

**User's choice:** Min order value + usage limit + expiry date

---

## Claude's Discretion

- Return policy Phase 5/6 split details (deferred to Claude — decision logged as D-22)
- Checkout route guard implementation (prevent step skipping)
- Order state machine states
- basket_sessions and basket_items table schema details
- BullMQ queue naming for reservation expiry and basket cleanup
- Customer JWT middleware wiring for basket/checkout routes
- Framer Motion animations on checkout steps and cart interactions
- Order slug/display ID strategy

## Deferred Ideas

- Automated vendor payouts (Stripe Connect / Razorpay Route) — v2 (PAY2-01)
- Tiered commission rates — v2
- Fixed-fee commission component — v2
- Per-customer coupon use limit — v1.x
- Coupon stackability — out of scope (one coupon per order)
- Bank transfer payout requests from wallet — v2
- Customer-initiated order cancellation before shipping — v1.x
