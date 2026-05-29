# Architecture Research

**Domain:** Configurable multi-vendor, multi-category physical-product marketplace (web + mobile + shared Node/TS backend)
**Researched:** 2026-05-28
**Confidence:** HIGH — all major recommendations verified against current official documentation and multi-source research

---

## Standard Architecture

### System Overview

```text
┌──────────────────────────────────────────────────────────────────────────────┐
│                            CLIENT LAYER                                     │
│                                                                              │
│  ┌──────────────────┐  ┌──────────────────┐  ┌────────────────────────────┐ │
│  │  Web Storefront  │  │  Web Admin Panel │  │    Web Vendor Panel        │ │
│  │  React+Vite+TW   │  │  React+Vite+TW   │  │    React+Vite+TW           │ │
│  └────────┬─────────┘  └────────┬─────────┘  └─────────────┬──────────────┘ │
│           │                     │                           │                │
│  ┌────────┴─────────────────────┴───────────────────────────┴────────────┐   │
│  │         React Native Customer App (iOS + Android)                    │   │
│  │         RN + TypeScript + React Navigation + Zustand                 │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
│                                   │                                          │
│       All clients consume @grovio/contracts (shared types + Zod schemas)    │
└───────────────────────────────────┼──────────────────────────────────────────┘
                                    │ HTTPS REST (JSON)
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                           API GATEWAY LAYER                                 │
│                                                                              │
│  ┌───────────────────────────────────────────────────────────────────────┐   │
│  │ Express/Fastify HTTP Server — route registration, auth middleware    │   │
│  │ Global: rate-limiting, request validation (Zod), error handling      │   │
│  └───────────────────────────────────────────────────────────────────────┘   │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                         DOMAIN MODULE LAYER                                 │
│                                                                              │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │   auth   │ │ customer │ │  vendor  │ │ vendor-  │ │    category +    │   │
│  │          │ │          │ │          │ │  staff   │ │ attribute-schema │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ catalog  │ │  search  │ │  basket  │ │ checkout │ │    payments      │   │
│  │          │ │          │ │          │ │          │ │ (Stripe/Razorpay)│   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────┐ ┌──────────────────┐   │
│  │ inventory│ │  wallet  │ │commission│ │  payouts │ │      orders      │   │
│  │reservtns │ │          │ │          │ │          │ │                  │   │
│  └──────────┘ └──────────┘ └──────────┘ └──────────┘ └──────────────────┘   │
│  ┌──────────┐ ┌──────────┐ ┌──────────┐                                      │
│  │tracking  │ │   cms    │ │notificatn│                                      │
│  │          │ │          │ │          │                                      │
│  └──────────┘ └──────────┘ └──────────┘                                      │
│                                                                              │
│  Each module: domain/ → application/ (use-cases) → infrastructure/          │
└───────────────────────────────────┬──────────────────────────────────────────┘
                                    │
┌───────────────────────────────────┼──────────────────────────────────────────┐
│                         INFRASTRUCTURE LAYER                                │
│                                                                              │
│  ┌───────────────┐  ┌──────────┐  ┌──────────────────┐  ┌─────────────────┐ │
│  │  PostgreSQL   │  │  Redis   │  │  OpenSearch /    │  │  External APIs  │ │
│  │  (primary DB) │  │ (cache,  │  │  Elasticsearch   │  │ Stripe,Razorpay │ │
│  │               │  │ sessions,│  │  (product search)│  │ Google SMTP     │ │
│  │               │  │ queues)  │  │                  │  │ Google Places   │ │
│  └───────────────┘  └──────────┘  └──────────────────┘  └─────────────────┘ │
└──────────────────────────────────────────────────────────────────────────────┘
```

### Component Responsibilities

| Component | Responsibility | Communicates With |
|-----------|---------------|-------------------|
| `auth` | JWT issuance/refresh, role claims, session invalidation | All modules (via middleware) |
| `customer` | Customer profile, saved addresses, preferences | auth, wallet, orders |
| `vendor` | Vendor profiles, bank details, store settings, category restrictions | auth, category, catalog, commissions, payouts |
| `vendor-staff` | Role assignments scoped to a vendor, permission gates | vendor, auth |
| `category` | Category tree CRUD, attribute-schema definitions, filter-schema definitions, product templates | catalog, search (schema sync) |
| `attribute-schema` | Per-category attribute type registry (text, number, enum, boolean, multi-select, range) | category, catalog |
| `catalog` | Product lifecycle (create/edit/approve), variant management, inventory-facing product metadata, pricing | category, vendor, search (index sync), basket, inventory-reservations |
| `search` | Index management (OpenSearch), query handling, facet generation from category filter schemas | catalog, category |
| `basket` | Session/auth-scoped cart, item validation, price snapshot | catalog, checkout |
| `checkout` | Address capture, delivery option selection, order total computation, inventory hold orchestration, payment intent creation | basket, payments, wallet, orders, inventory-reservations |
| `payments` | Payment provider abstraction (Stripe / Razorpay), payment order lifecycle, webhook handling, refund initiation | checkout, orders, wallet |
| `inventory-reservations` | Timed reservation holds, release/reconcile on payment success/failure/expiry | catalog, checkout, orders |
| `wallet` | Ledger-first balance system per customer/vendor, credit, debit, refund-to-wallet, cached current balance maintenance | payments, orders, commissions, payouts |
| `commissions` | Commission rule engine (per-vendor, per-category, tiered/flat/percentage), commission record creation and reversal | orders, vendor, payouts |
| `payouts` | Payout schedule, payout batch creation, payout line items, manual settlement tracking in v1, provider transfer extension path later | commissions, wallet, vendor |
| `orders` | Order aggregate, vendor sub-order splitting, order lifecycle events | checkout, fulfillment, notifications, wallet, commissions |
| `fulfillment` | Delivery/serviceability logic, stock release/commit coordination, fulfillment state | orders, tracking, vendor, inventory-reservations |
| `tracking` | Tracking timeline, status history, configurable live vs simulation mode | fulfillment, orders, notifications |
| `cms` | Content blocks, banners, homepage slots, SEO metadata | category, storefront |
| `notifications` | Event-driven email dispatch (Google SMTP), push-ready event emission | All modules (subscribes to domain events) |
| `admin` | Admin-only aggregation routes, marketplace-level analytics, moderation actions | All modules |

---

## Monorepo Layout

```text
grovio/
├── apps/
│   ├── api/                       # Node.js/TypeScript backend (Express or Fastify)
│   ├── web-storefront/            # Customer-facing web app (React + Vite)
│   ├── web-admin/                 # Admin panel (React + Vite)
│   ├── web-vendor/                # Vendor panel (React + Vite)
│   └── mobile/                    # React Native customer app
│
├── packages/
│   ├── contracts/                 # Shared API types, Zod schemas, response shapes
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── catalog/
│   │   │   ├── orders/
│   │   │   ├── wallet/
│   │   │   └── ...one folder per domain
│   │   └── package.json           # exports raw TypeScript — never pre-compiled JS
│   │
│   ├── api-client/                # Typed HTTP fetch wrapper (platform-aware)
│   │   ├── src/
│   │   │   ├── client.ts          # Web implementation (browser fetch)
│   │   │   └── client.native.ts   # React Native implementation (RN-aware)
│   │   └── package.json           # conditional exports: "react-native" → .native.ts
│   │
│   ├── ui/                        # Shared design tokens, Tailwind preset, base components
│   │   └── src/
│   │       ├── tokens/            # colors, spacing, typography (used by all web apps)
│   │       └── components/        # Only truly generic primitives (if any)
│   │
│   ├── config/                    # Shared ESLint, Prettier, TypeScript base configs
│   │   ├── eslint-preset.js
│   │   ├── tsconfig.base.json
│   │   └── tsconfig.react.json
│   │
│   └── seed/                      # Seed data definitions for demo presets
│       ├── presets/
│       │   ├── grocery/
│       │   ├── electronics/
│       │   ├── furniture/
│       │   ├── party-supplies/
│       │   └── tools/
│       └── importer/              # Seed runner script
│
├── turbo.json                     # Turborepo pipeline (build, dev, lint, test)
├── pnpm-workspace.yaml
└── .env.example                   # Root env example; each app also has its own
```

### Monorepo Rationale

- **`packages/contracts`** is the single source of truth for all API shapes. Every API response, request body, and domain event type lives here. Backend validates with Zod; frontends and mobile import the same schemas for type-safe consumption. A field rename causes a TypeScript error across all consumers simultaneously.
- **`packages/api-client`** uses the file extension pattern (`client.native.ts`) with conditional `package.json` exports so React Native and web receive the correct transport implementation at build time — zero runtime overhead.
- **Raw TypeScript exports** from all packages (no pre-compiled JS). Each consuming app transpiles according to its own bundler (Vite, Metro). This eliminates module format mismatches.
- **Turborepo** handles build ordering and affected-package execution. Remote cache cuts CI time significantly on larger change sets.
- **pnpm workspaces** with `workspace:*` protocol ensures cross-package references always resolve locally during development.

---

## Architectural Patterns

### Pattern 1: Domain-Module Internal Layers (DDD per bounded context)

**What:** Each backend module owns its own `domain/`, `application/`, and `infrastructure/` sub-layers. The domain layer contains entities, value objects, and business rules with zero framework or DB dependencies. The application layer contains use-case classes. The infrastructure layer contains repository implementations, DB queries, and external adapters.

**When to use:** Every module in `apps/api/src/modules/`. This is the only structure used — no exceptions for "simple" modules.

**Trade-offs:** Slightly more files up front; pays off when a module (e.g. `payments`) needs to swap Stripe for Razorpay, or when `tracking` swaps live for simulation mode — only the infrastructure layer changes.

### Pattern 2: Backend-Authoritative Money Math + Integer Minor Units

**What:** All price totals, wallet balances, commission amounts, tax amounts, refund values, payout amounts, and shipping charges are represented as integer minor units in the backend domain layer. The frontend never sends a trusted calculated total — it sends intent (items, quantities, payment method), and the backend recomputes from source records.

**Contract:** Every money field in contracts and persistent data uses minor units with explicit naming or metadata, for example `unit_price_minor`, `grand_total_minor`, `wallet_balance_minor`. Formatting to `₹499.00` or `$4.99` is a presentation concern only.

**Trade-offs:** Slightly more conversion discipline at boundaries; eliminates a whole class of rounding, fraud, and reconciliation bugs.

**Example data flow:**

```text
Client POSTs: { basketId, paymentMethod, addressId }
          ↓
checkout module re-fetches basket items from catalog (authoritative prices)
          ↓
applies promotions/discounts server-side
          ↓
computes totals in minor units:
subtotal_minor + shipping_minor + tax_minor - wallet_credit_minor = grand_total_minor
          ↓
creates gateway payment order with grand_total_minor (never from client input)
          ↓
returns { orderId, providerPayload, totals } to client
```

### Pattern 3: Domain Event Bus for Cross-Module Communication

**What:** Modules do not import each other's services directly. Instead, the orders module emits `OrderPlaced`, `OrderPaid`, `OrderDelivered`, and `OrderRefunded` events. The commissions, wallet, notifications, search, tracking, and inventory-reservations modules subscribe to relevant events.

**When to use:** All cross-module side-effects — commission creation, wallet ledger entries, email dispatch, reservation release, tracking initialization, search reindexing.

**Trade-offs:** Slightly harder to trace call chains during debugging; eliminates circular dependencies between modules and keeps bounded contexts clean.

### Pattern 4: Configuration-First with Feature Flags

**What:** A `MarketplaceConfig` record in the database holds all buyer-facing toggles and settings. A `FeatureFlags` table stores named boolean/value flags. A `ConfigService` loads config at startup with Redis caching and exposes it to use-cases and middleware. Nothing buyer-facing is hardcoded.

**When to use:** Every feature a buyer may want to toggle: wallet enabled, tracking mode, active payment providers, coupon support, reviews visibility, promotion tools.

**Trade-offs:** Slightly more abstraction for simple settings; enables buyer demos and reduces per-install code edits.

---

## Dynamic Category / Attribute Schema Modeling

### Recommendation: Hybrid JSONB + Schema Registry (not EAV)

Pure EAV is the wrong choice. The category engine should store schema metadata in relational tables and per-product category-specific values in JSONB, with strict validation against approved schema definitions.

### Core Model

```text
attribute_definitions
- one row per category-specific attribute definition
- owns machine key, label, type, enum options, validation, visibility, searchability

filter_schema_definitions
- one row per category-specific filter control
- references approved attribute definitions only
- drives storefront filter UI and search facet behavior

products
- stable core columns for shared product data
- attributes JSONB for category-specific values only
- GIN index on attributes
```

### Search Mapping Guardrail

Only approved searchable/filterable attributes from `attribute_definitions` may be projected into OpenSearch. The system must not allow arbitrary runtime field creation based on whatever appears in JSONB at write time.

This rule avoids two common failures:
- uncontrolled mapping explosion in OpenSearch;
- implicit schema drift between admin-defined category rules and indexed search fields.

### Recommended SQL Shape

```sql
CREATE TABLE attribute_definitions (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id    uuid NOT NULL REFERENCES categories(id),
  key            text NOT NULL,
  label          text NOT NULL,
  attr_type      text NOT NULL,
  options        jsonb,
  is_required    boolean DEFAULT false,
  is_searchable  boolean DEFAULT true,
  sort_order     integer DEFAULT 0,
  UNIQUE (category_id, key)
);

CREATE TABLE filter_schema_definitions (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id         uuid NOT NULL REFERENCES categories(id),
  attribute_def_id    uuid NOT NULL REFERENCES attribute_definitions(id),
  display_type        text NOT NULL,
  sort_order          integer DEFAULT 0
);

CREATE TABLE products (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  vendor_id           uuid NOT NULL REFERENCES vendors(id),
  category_id         uuid NOT NULL REFERENCES categories(id),
  name                text NOT NULL,
  description         text,
  base_price_minor    bigint NOT NULL,
  status              text NOT NULL DEFAULT 'draft',
  attributes          jsonb NOT NULL DEFAULT '{}',
  created_at          timestamptz DEFAULT now(),
  updated_at          timestamptz DEFAULT now()
);

CREATE INDEX products_attrs_gin ON products USING GIN (attributes jsonb_path_ops);
CREATE INDEX products_category_id ON products (category_id);
CREATE INDEX products_vendor_id ON products (vendor_id);
```

### Filtering Flow

1. Admin defines category attributes and filter schema.
2. Vendor submits a product using the generated category template.
3. Backend validates submitted JSONB against the schema registry.
4. Catalog emits `ProductUpserted`.
5. Search projects only approved searchable attributes into the OpenSearch document.
6. Storefront fetches the category filter schema and renders controls dynamically.
7. Product filtering is executed in PostgreSQL for smaller datasets and in OpenSearch for full-text plus facet-heavy use cases.

---

## Inventory Reservation Model

Inventory correctness is part of the core architecture, not an implementation detail.

### Reservation Rules

- Basket add does **not** decrement stock.
- Checkout initiation creates a timed reservation.
- Reservation acquisition must be atomic, using row locks and a transaction.
- Payment success converts reserved quantity into sold quantity.
- Payment failure, timeout, or abandonment releases the reservation.
- Expiry cleanup runs in a job queue and must be idempotent.

### Suggested Tables

```sql
CREATE TABLE inventory_items (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  product_id            uuid NOT NULL REFERENCES products(id),
  variant_id            uuid,
  available_quantity    integer NOT NULL,
  reserved_quantity     integer NOT NULL DEFAULT 0,
  low_stock_threshold   integer DEFAULT 0,
  updated_at            timestamptz DEFAULT now()
);

CREATE TABLE inventory_reservations (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  basket_id             uuid NOT NULL,
  customer_id           uuid NOT NULL,
  inventory_item_id     uuid NOT NULL REFERENCES inventory_items(id),
  quantity              integer NOT NULL,
  status                text NOT NULL,
  expires_at            timestamptz NOT NULL,
  payment_reference     text,
  created_at            timestamptz DEFAULT now(),
  updated_at            timestamptz DEFAULT now()
);
```

### Reservation Lifecycle

```text
PENDING → RESERVED → CONSUMED
                 └→ RELEASED
                 └→ EXPIRED
```

---

## Multi-Vendor Orders, Commissions, Wallet, and Payouts

### Data Model

```text
orders
- one customer checkout aggregate
- grand_total_minor, tax_total_minor, shipping_total_minor, wallet_applied_minor

vendor_sub_orders
- one row per vendor in a multi-vendor checkout
- subtotal_minor, shipping_minor, commission_minor, net_vendor_minor

order_line_items
- one row per item
- unit_price_minor, line_total_minor

commission_rules
- global, category-level, vendor-level, vendor+category override

commission_records
- immutable record of earned commission at payment time
- reversal record on refund

wallets
- owner container row only
- optional cached current_balance_minor for fast reads
- not authoritative by itself

wallet_ledger_entries
- immutable source of truth
- every debit/credit references an order, refund, payout, adjustment, or top-up

payout_batches
- admin-created or schedule-created payout request for a vendor/date window

payout_line_items
- individual earning/reversal/adjustment rows included in a payout batch

payout_settlements
- v1: manual settlement record with admin actor + external reference
- v1.x: provider transfer records for Stripe Connect / Razorpay Route
```

### Wallet Rule

The wallet is **ledger-first**. A cached `current_balance_minor` field may exist for performance, but every mutation must write ledger entries inside the transaction, and any cached balance must be derived/maintained from that ledger mutation. No direct balance-edit code path is allowed.

### Payout Rule

v1 payouts are operationally manual but data-rich. The platform must still create payout batches, payout line items, status transitions, and settlement references so that automation can be layered on later without reworking the bookkeeping model.

---

## Payment Provider Abstraction

### Interface Boundary

The rest of the system must depend on a provider-neutral interface, never on Stripe or Razorpay SDKs directly.

```typescript
interface PaymentProvider {
  createPaymentOrder(params: CreatePaymentOrderParams): Promise<ProviderPaymentOrder>;
  confirmPayment(params: ConfirmPaymentParams): Promise<PaymentResult>;
  handleWebhook(rawBody: Buffer, signature: string): Promise<WebhookEvent>;
  initiateRefund(params: RefundParams): Promise<RefundResult>;
}
```

### v1 Scope

- Stripe and Razorpay payment collection are both supported behind the same abstraction.
- Refund initiation also sits behind the same abstraction.
- Automated vendor disbursement is **not** part of v1 operational flow.
- Webhook processing is provider-specific at the edge, but must emit a canonical internal event shape.

### Canonical Webhook Events

```text
PAYMENT_AUTHORIZED
PAYMENT_CAPTURED
PAYMENT_FAILED
REFUND_CREATED
REFUND_SUCCEEDED
TRANSFER_FAILED      # reserved for later payout automation
TRANSFER_SUCCEEDED   # reserved for later payout automation
```

---

## Integration Points

### External Services

| Service | Integration Pattern | Module Owner | Notes |
|---------|---------------------|-------------|-------|
| Stripe | Provider abstraction in `payments` module; webhook edge route resolves provider-specific payload into canonical event | `payments` | v1 uses it for collection/refunds; Connect payout automation is a later extension |
| Razorpay | Same `PaymentProvider` interface as Stripe | `payments` | v1 uses it for collection/refunds; Route disbursement automation is a later extension |
| Google SMTP | Nodemailer transport; templates per event type | `notifications` | Used for all transactional email |
| Google Places API | Address autocomplete on checkout and profile | `fulfillment`, `customer` | Frontend-assisted input; server validates normalized address data |
| OpenSearch / Elasticsearch | Event-driven index sync on `ProductUpserted` / `ProductArchived`; read path belongs to `search` module | `search`, `catalog` | Search mappings derived from approved attribute definitions only |
| Redis | Session cache, config cache, job queue (BullMQ), basket temp storage, feature flag cache | Cross-cutting | Shared client via DI container |

### Internal Module Boundaries

| Boundary | Communication Pattern | Notes |
|----------|----------------------|-------|
| `catalog` → `search` | Domain event: `ProductUpserted` | search owns its own index model |
| `checkout` → `inventory-reservations` | Direct use-case call | reservation must happen before payment order creation |
| `checkout` → `payments` | Direct use-case call | checkout orchestrates payment order creation synchronously |
| `payments` → `orders` | Domain event: `PaymentCaptured` | orders module finalizes order state from payment truth |
| `payments` → `inventory-reservations` | Domain event: `PaymentFailed` / `PaymentCaptured` | reservation release/consume is event-driven |
| `orders` → `commissions` | Domain event: `OrderPaid` | commissions records earned values and reversals |
| `orders` → `wallet` | Domain event: `OrderPaid`, `OrderRefunded` | wallet manages ledger entries |
| `orders` → `payouts` | Domain event: `OrderPaid`, `OrderRefunded` | payout eligibility materialization happens here |
| `fulfillment` → `tracking` | Domain event: `FulfillmentStatusUpdated` | tracking appends timeline entries |
| Any module → `notifications` | Domain event | notifications is a pure subscriber |
| `category` → `catalog` | Repository read | acceptable direct dependency because category owns the schema |

---

## Anti-Patterns to Avoid

### Anti-Pattern 1: Client-Trusted Totals

Do not accept order totals, tax, shipping, or wallet deductions from the client as authoritative input. The client may submit intent; the backend must recompute all monetary fields.

### Anti-Pattern 2: Mutable Wallet Without Ledger Semantics

Do not build wallet behavior around `UPDATE wallets SET balance = ...` as the primary model. The wallet ledger is the source of truth; cached balance exists only as a performance aid.

### Anti-Pattern 3: EAV Product Attributes

Do not store category-specific attributes in generic key-value rows. Use JSONB plus a schema registry.

### Anti-Pattern 4: Hardcoded Provider Logic in Checkout

Do not import Stripe or Razorpay SDKs inside checkout controllers or use-cases. Provider-specific logic belongs in payment adapters only.

### Anti-Pattern 5: Automated Payout Assumed in v1

Do not design v1 bookkeeping around the assumption that provider transfers will happen automatically. The bookkeeping model must stand on its own with manual settlement and auditability.

### Anti-Pattern 6: Search Mapping From Arbitrary Runtime Fields

Do not index every incoming JSONB key automatically. Only schema-approved searchable fields may be mapped into OpenSearch.

---

## Suggested Build Order

```text
Phase 1 — Foundation
  ├── Monorepo scaffold (Turborepo + pnpm workspaces)
  ├── packages/contracts (money types, API envelopes, domain event types)
  ├── packages/config (tsconfig, eslint)
  ├── apps/api skeleton (Express/Fastify, DI container, health check)
  ├── apps/web-storefront shell
  ├── apps/web-admin shell
  ├── apps/web-vendor shell
  └── apps/mobile shell

Phase 2 — Category Engine
  ├── categories schema
  ├── attribute_definitions + filter_schema_definitions
  ├── category admin UI
  └── schema validation rules

Phase 3 — Catalog + Search
  ├── products schema with JSONB attributes + BIGINT money columns
  ├── catalog module
  ├── controlled search mapping generation
  └── storefront PLP/PDP + dynamic filter rendering

Phase 4 — Commerce Core
  ├── basket
  ├── inventory_items + inventory_reservations
  ├── checkout orchestration
  ├── payment provider abstraction (Stripe + Razorpay)
  ├── webhook idempotency infrastructure
  ├── order placement + vendor split model
  └── wallet ledger foundation

Phase 5 — Marketplace Operations
  ├── commission engine + reversal semantics
  ├── payout batches + payout line items + manual settlement records
  ├── vendor earnings views
  ├── admin finance screens
  └── returns/refunds integration

Phase 6 — Mobile App Completion
  ├── wire all shared contracts into RN app
  ├── checkout + wallet + tracking flows
  └── deep links + offline cart persistence

Phase 7 — Demo Presets + Productization
  ├── seed importer
  ├── preset datasets
  ├── branding layer
  ├── installation / integration docs
  └── Envato submission assets
```

### Build Order Notes

- Category schema must exist before products.
- Products must exist before checkout.
- Inventory reservation must exist before live payment flow.
- Wallet, commission, and payout records must share the same minor-unit money contract from day one.
- Productization is not a final afterthought; `.env.example`, file organization, and setup docs should begin in Phase 1.
