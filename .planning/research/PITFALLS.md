# Pitfalls Research

**Domain:** Configurable multi-vendor marketplace platform — commercial starter kit (Envato-style)
**Researched:** 2026-05-28
**Confidence:** HIGH (critical pitfalls verified across official docs, post-mortems, and multiple independent sources)

---

## Critical Pitfalls

### Pitfall 1: Floating-Point Arithmetic for All Money Values

**What goes wrong:**
Commission rates, order totals, wallet balances, and payout amounts accumulate floating-point rounding errors. A 10% commission on $3.75 in JavaScript gives 0.375 — which may serialize differently across layers, cause split totals to not sum exactly to the order total, and produce payout amounts that are off by fractions of a cent per transaction. At high volume, the platform's book balance diverges from the payment gateway's settled amount. Reconciliation breaks.

**Why it happens:**
JavaScript's `number` type (IEEE 754 double-precision) cannot represent many decimal fractions exactly. Developers write `price * commissionRate` assuming clean decimal arithmetic, never test at scale, and discover the drift only during a payout audit.

**How to avoid:**
Store and compute all monetary values as integers in the smallest currency unit (paise for INR, cents for USD). Use BigInt or a library like `dinero.js` for intermediate arithmetic. Apply a single, documented rounding rule at defined boundary points — never inside loops. Database columns for money should be `BIGINT`. The API contract must specify that all monetary fields are integer paise/cents.

**Warning signs:**
- Any money-related column typed as `FLOAT`, `REAL`, or `DOUBLE` in a migration
- `numeric(12,2)` creeping into transactional price/totals tables after the contract has been decided
- Commission or payout computed with `*` or `/` directly on decimal price strings
- Payout + platform fee does not equal order total when summed in tests

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 2: Non-Atomic Inventory Reservation — Overselling Under Concurrency

**What goes wrong:**
Two customers add the same last-in-stock item to their baskets simultaneously. Both read `stock = 1`. Both proceed to checkout. Both pay. The platform has sold 2 units of 1 in stock.

**Why it happens:**
Developers implement stock as a simple decrement on order placement without a reservation step. The stock check and stock decrement are separate DB operations with no lock between them.

**How to avoid:**
Implement a two-phase inventory model: `available_quantity` and `reserved_quantity`. On checkout initiation, lock the inventory row and create a timed reservation. On payment success, consume the reservation. On payment failure, timeout, or abandonment, release it. Never decrement stock on basket add.

**Warning signs:**
- `UPDATE ... stock = stock - 1` outside a transaction
- No `inventory_reservations` table in the schema
- Stock decrement triggered only from payment webhook logic
- No expiry/release worker for abandoned reservations

**Phase to address:** Phase 4 — Commerce core (schema can begin earlier)

---

### Pitfall 3: Wallet Concurrency — Double-Spend via Lost Update

**What goes wrong:**
A customer opens two checkout tabs with the same wallet balance and spends the same funds twice. Refund webhooks may also credit the same refund twice.

**Why it happens:**
Wallet state is modeled as a mutable balance field updated with read-modify-write logic, without ledger semantics, locking, or idempotency protection.

**How to avoid:**
Use an append-only wallet ledger as the source of truth. A cached `current_balance_minor` column is acceptable for fast reads, but every mutation must write ledger entries transactionally first. Enforce idempotency with a unique `idempotency_key` and a processed-webhook guard.

**Warning signs:**
- Direct wallet balance updates without ledger entries
- No unique constraint on wallet idempotency keys
- No replay test for duplicate refund/top-up events
- Negative wallet balance appearing after concurrent tests

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 4: Refund Does Not Reverse Commission

**What goes wrong:**
A customer receives a refund, but the platform still treats the vendor commission as earned and payout-eligible. The books drift and the operator leaks money.

**Why it happens:**
Commission logic is treated as a one-way calculation at order placement, and refund logic is added later without linking back to commission and payout calculations.

**How to avoid:**
Record commissions as ledger-like entries with reversal semantics. Partial refunds must generate proportional reversals. Payout eligibility must aggregate earned minus reversed commission, not gross historical commission.

**Warning signs:**
- Refund code does not touch commission records
- Payout balance is computed from orders only
- No test that refund reduces vendor eligible earnings

**Phase to address:** Phase 5 — Marketplace operations

---

### Pitfall 5: Order Totals Not Verified Server-Side

**What goes wrong:**
The client tampers with an order total and the backend charges the altered amount because it trusts the request body.

**Why it happens:**
Checkout logic treats frontend price display data as authoritative and forwards that amount to the payment provider.

**How to avoid:**
The backend must re-derive item totals, discounts, tax, shipping, wallet credit, and final charge from source records every time. Client totals are never trusted.

**Warning signs:**
- `amount: req.body.amount` sent to a provider SDK
- No catalog re-fetch before payment order creation
- No tampered-checkout test case

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 6: Payout Without Audit Trail

**What goes wrong:**
A vendor disputes a payout, but the system can only show a final amount and status, not which orders, reversals, or adjustments produced that figure.

**Why it happens:**
Payouts are modeled as one summary row instead of a data structure with derivation history.

**How to avoid:**
Use a three-layer payout model: `payout_batches`, `payout_line_items`, and `payout_settlements`. Even if settlement is manual in v1, the audit trail must still exist.

**Warning signs:**
- `vendor_payouts` contains only vendor, amount, status, created_at
- No FK path from payout to order-derived line items
- Vendor earnings UI shows only one total number

**Phase to address:** Phase 5 — Marketplace operations

---

### Pitfall 7: Commission Rounding Residual Breaks Reconciliation

**What goes wrong:**
Split amounts rounded independently do not sum back to the original order total, creating small but cumulative reconciliation errors.

**Why it happens:**
Each share is rounded independently without residual assignment or invariant testing.

**How to avoid:**
Use integer arithmetic with a residual allocation strategy such as largest remainder. Assert in tests that split sums plus platform fee always equal the original order total.

**Warning signs:**
- Independent rounding for each vendor share
- No test with awkward values like 10001 paise across multiple vendors
- Platform fee computed independently instead of as remainder

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 8: EAV Schema for Dynamic Product Attributes

**What goes wrong:**
Filtering products by several category-specific attributes becomes join-heavy, slow, and difficult to index for search facets.

**Why it happens:**
EAV feels flexible early on, but it collapses under realistic listing/filter workloads.

**How to avoid:**
Use JSONB for product attribute values and separate schema tables for metadata and validation. Index JSONB with GIN. Only project approved searchable fields into OpenSearch.

**Warning signs:**
- Generic `(entity_id, key, value)` attribute tables
- Product listing queries with repeated joins to the same attribute table
- Search mappings generated from arbitrary runtime keys

**Phase to address:** Phase 2 — Category engine

---

### Pitfall 9: Payment Provider Tight Coupling

**What goes wrong:**
The first provider works, but adding a second provider later forces a checkout rewrite or spreads `if provider === ...` logic across the codebase.

**Why it happens:**
Gateway-specific SDK calls are placed directly in checkout handlers and business logic.

**How to avoid:**
Define a `PaymentProvider` interface first. Keep provider-specific webhook parsing at the edge and translate everything into canonical internal payment events.

**Warning signs:**
- Stripe/Razorpay imports inside checkout modules
- Duplicated business logic across `/webhooks/stripe` and `/webhooks/razorpay`
- No provider-neutral service boundary

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 10: Webhook Without Idempotency

**What goes wrong:**
Duplicate payment or refund webhooks re-trigger side effects: double wallet credits, duplicate order transitions, duplicate payout actions.

**Why it happens:**
Webhook handlers execute business logic on every delivery and assume exactly-once delivery semantics.

**How to avoid:**
Record processed provider event IDs in a table with a unique constraint and wrap processing in a transaction. Duplicate deliveries should become no-ops.

**Warning signs:**
- No `processed_webhook_events` table
- No duplicate delivery tests
- Side effects initiated directly in webhook controller path without queueing or idempotency guard

**Phase to address:** Phase 4 — Commerce core

---

### Pitfall 11: Monorepo Type Contract Drift

**What goes wrong:**
Backend, web, and mobile start using slightly different versions of the same response types, and one client silently breaks after an API change.

**Why it happens:**
Shared contracts are deferred, or types are duplicated across apps.

**How to avoid:**
Create one contracts package in Phase 1 and require all apps plus the backend to use it. Runtime validation schemas should live there too.

**Warning signs:**
- Separate `types/api.ts` files in each app
- Backend response shape changes without shared contract updates
- Mobile and web compile against different field names

**Phase to address:** Phase 1 — Foundation

---

### Pitfall 12: React Native Monorepo Resolution Breaks Late

**What goes wrong:**
The web apps consume shared packages fine, but Metro fails once the RN app imports them, especially in release builds.

**Why it happens:**
Metro needs explicit workspace/symlink handling and is less forgiving than browser bundlers.

**How to avoid:**
Prove Metro workspace resolution in Phase 1, not after the architecture is already committed. Configure watch folders, symlink handling, and exact React/React Native versions up front.

**Warning signs:**
- Default Metro config left untouched
- Shared package import attempted before monorepo configuration is validated
- Different React versions across workspaces

**Phase to address:** Phase 1 — Foundation

---

### Pitfall 13: Feature Flags as Runtime DB Queries

**What goes wrong:**
Every request checks feature flags by hitting the database, turning simple storefront rendering into a high-chatter path.

**Why it happens:**
Flags are treated as normal data access, not as cached configuration.

**How to avoid:**
Load and cache flags in Redis or process memory, invalidate on admin updates, and avoid synchronous DB reads for hot request paths.

**Warning signs:**
- `SELECT * FROM feature_flags` inside request handlers
- PLP/PDP routes making config reads for every page load
- No cache invalidation strategy

**Phase to address:** Phase 1 — Foundation

---

### Pitfall 14: Envato Rejection Due to Productization Gaps

**What goes wrong:**
The software works, but the item is rejected because docs, setup flow, env scaffolding, code quality, or packaging quality are below marketplace expectations.

**Why it happens:**
Productization is treated as a final polish step rather than an architectural requirement.

**How to avoid:**
Ship `.env.example`, lint rules, file organization standards, installation docs, rebranding docs, integration docs, and real preview assets as part of the build plan from the beginning.

**Warning signs:**
- Missing `.env.example`
- Hardcoded test keys
- Poor root-level file organization
- Setup steps that only the original author can complete

**Phase to address:** Phase 1 and final productization phase

---

### Pitfall 15: Configurable Product Scope Explosion

**What goes wrong:**
The project quietly doubles in scope because every operational feature also becomes a buyer-facing configuration feature, and the team underestimates the documentation, rebranding, and flagging work.

**Why it happens:**
The product is treated like a custom marketplace build instead of a sellable starter kit.

**How to avoid:**
For every feature, ask two questions: "Does it work for the end user?" and "Can the buyer configure, disable, rebrand, and understand it without code edits?" If the answer to the second is no, the feature is incomplete for this product type.

**Warning signs:**
- Features implemented without admin settings or docs
- Hidden constants instead of config values
- Demo presets added manually instead of through an importer

**Phase to address:** All phases, especially planning and productization

---

## Verification Checklist

| Pitfall | Verification |
|---------|--------------|
| Floating-point money | All transactional money columns use BIGINT minor units; no decimal arithmetic in commerce code |
| Inventory oversell | Concurrent checkout test shows reservations prevent duplicate sale |
| Wallet double-spend | Concurrent wallet-spend test plus duplicate webhook replay test both pass |
| Refund commission mismatch | Refund test reduces payout-eligible vendor earnings correctly |
| Client-trusted totals | Tampered checkout request is rejected or recomputed safely |
| Payout without audit trail | Payout detail page shows batch, line items, and settlement reference |
| Split rounding residual | Property/invariant tests prove split sums match original total |
| EAV schema | Product attributes stored as JSONB with GIN index; no EAV tables |
| Provider tight coupling | Checkout depends on interface, not Stripe/Razorpay SDK directly |
| Webhook duplication | Duplicate event replay produces one business effect |
| Type drift | Shared contracts package is imported by backend, web, and mobile |
| RN monorepo breakage | Fresh clone and RN release build can resolve shared packages |
| Feature flag performance | No hot path hits DB for flag reads |
| Envato rejection risk | Setup docs validated by a clean-machine install |
| Scope explosion | Each shipped feature has config path, docs path, and demo path |
