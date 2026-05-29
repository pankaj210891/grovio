# Project Research Summary

**Project:** Grovio
**Domain:** Configurable multi-vendor, multi-category physical-product marketplace — commercial starter kit (web + React Native + Node/TS backend monorepo)
**Researched:** 2026-05-29
**Confidence:** HIGH

---

## Executive Summary

Grovio is a horizontal-layer infrastructure product, not a typical feature-driven app. Its defining constraint is that it must deliver two simultaneous value dimensions: a fully working multi-vendor marketplace for end-users, and a configurable, rebrandable, buyer-operated starter kit sold on Envato. Every architecture and scope decision must satisfy both dimensions. The recommended approach is a pnpm + Turborepo monorepo with a DDD-structured Fastify backend, three Vite/React web apps, and an Expo bare React Native app, all sharing typed contracts from a single `packages/contracts` source of truth. The stack is fully verified against current npm releases and compatibility matrices as of 2026-05-29.

The central architectural spine is a dynamic category/attribute model (JSONB + GIN indexes + schema registry) that makes the platform vertical-agnostic at runtime. This engine feeds everything downstream: vendor product forms, storefront filters, search facets, and demo presets. Above the category engine sits a multi-vendor commerce layer (inventory reservation → checkout → order splitting → commission engine → wallet ledger → payout batches) whose financial correctness depends on enforcing integer minor-unit money arithmetic end-to-end. A `PaymentProvider` interface abstracts Stripe and Razorpay from day one so both providers can be toggled via config without touching checkout logic.

The top risks are financial and concurrency correctness (floating-point money drift, inventory oversell, wallet double-spend, commission reversal omission on refund), provider coupling (Stripe/Razorpay SDK calls leaking into business logic), and monorepo mechanical failures (Metro symlink config for React Native, type contract drift between apps). All are preventable with a disciplined Phase 1 foundation: BIGINT minor-unit contracts in `packages/contracts`, Metro resolution proven before any feature work, and the `PaymentProvider` interface defined before any checkout code is written.

---

## Key Findings

### Recommended Stack

| Layer | Technology | Version | Rationale |
|-------|-----------|---------|-----------|
| Monorepo tooling | pnpm + Turborepo | 9.x + 2.9.x | Strict peer deps, `workspace:*` refs, Rust-speed build graph |
| Backend runtime | Node.js | 22 LTS | Required by Razorpay SDK >=22.2 |
| HTTP framework | Fastify | 5.8.x | ~76k req/s, schema-based validation; Express 4 maintenance-only |
| Contracts / validation | TypeScript + Zod | 5.8.x + 4.4.x | Shared Zod schemas in `packages/contracts`; Zod 4 stable |
| ORM + migrations | Drizzle ORM + drizzle-kit | 0.45.x + beta | SQL-transparent, JSONB-native, BIGINT columns |
| Primary database | PostgreSQL | 16+ | JSONB + GIN for dynamic attributes, BIGINT money, row-level locks |
| Cache / queues | Redis + BullMQ | 7.x + 5.77.x | Feature flag cache, session, reservation expiry, webhook retry |
| Search | OpenSearch | 2.x | Apache 2.0 (critical for commercial kit); Elasticsearch SSPL is a buyer concern |
| Payments | Stripe + Razorpay | 22.2.x + 2.9.6 | Behind `PaymentProvider` interface; never imported directly in business logic |
| Money arithmetic | BigInt / Dinero.js v2 | — | BIGINT columns; `allocate()` for split residuals; Dinero.js v2 alpha, plain BigInt is safe fallback |
| Email | nodemailer | 8.0.x | Zero deps; Google SMTP transport |
| Auth tokens | jose | 6.2.x | Web Crypto API; active maintenance (jsonwebtoken deprecated) |
| DI container | Awilix | 13.0.x | No decorator metadata required |
| Web UI | React + Vite + Tailwind CSS | 19.2.x + 8.0.x + 4.3.x | React 19 stable; Vite 8 Rolldown/Oxc; Tailwind v4 CSS-native |
| Animations | Motion (framer-motion) | 12.x | Import `motion/react`; 120fps GPU |
| Client state | React Query + Zustand | 5.100.x + 5.0.x | Server state + ephemeral local state |
| Mobile | React Native + Expo bare | 0.83.x + SDK 53 | RN 0.83 ships React 19.2; bare workflow for full native access + EAS |
| Mobile navigation | React Navigation | 7.2.x | v7 stable; v8 alpha excluded |
| Testing | Vitest | 4.1.x | Vite-native; Jest-compatible |

**Critical constraints:** Node 22 LTS non-negotiable (Razorpay). React >=19.2.3 (CVE patch). `drizzle-kit` install with `@beta` tag. Tailwind v4: `@tailwindcss/vite` plugin only, no PostCSS.

### Expected Features

**Must have (v1 blocking):**
- Category engine: CRUD, nested tree, per-category attribute/filter schemas, product templates, vendor-category restrictions
- Customer storefront: homepage, category pages, PLP with dynamic faceted filters, PDP with dynamic attribute display, search with suggestions
- Auth: signup, login, password reset
- Multi-vendor basket + checkout + backend-authoritative totals
- Inventory reservation model at checkout (not on basket add)
- `PaymentProvider` abstraction supporting Stripe and Razorpay
- Order placement with multi-vendor sub-order splitting
- Commission engine: global → category → vendor priority chain
- Customer wallet: ledger-first, checkout payment, refund target, balance display
- Vendor panel: onboarding, dynamic product forms, orders, earnings/payout visibility
- Admin panel: category/vendor/commission management, moderation, CMS, branding, feature flags, settings
- Simple coupon engine (feature-flagged)
- Order tracking with timeline and simulation mode
- Google SMTP transactional email + Google Places autocomplete
- React Native customer app (full feature parity)
- Demo presets x5 (grocery, electronics, furniture, party supplies, tools) + seed importer
- Envato productization deliverables

**Should have (differentiators — include where schedule allows):**
- Framer Motion micro-interactions, tiered commission rules, feature flag management UI, tracking simulation map shell, vendor role-based access (owner + staff), branding token system, audit log

**Defer to v1.x:** Automated vendor payouts (Stripe Connect / Razorpay Route), reviews submission + moderation, wishlist, social login, cashback campaigns, FCM/APNs push wiring

**Defer to v2+:** Multi-currency, semantic/AI search, GPS driver tracking, i18n

**Anti-features (excluded):** Real-time chat, BNPL, subscription billing, AI recommendations, automated KYC, email marketing tool

### Architecture Approach

18 DDD-bounded-context modules with domain / application / infrastructure layers. Modules communicate via domain event bus (not direct imports). Configuration-first: `MarketplaceConfig` + `FeatureFlags` table, Redis-cached, never hot-path DB reads.

**Architecture spine (dependency order):**
1. `packages/contracts` — all API types, Zod schemas, money minor-unit conventions, event shapes
2. Dynamic category/attribute model — `attribute_definitions` + `filter_schema_definitions` + JSONB `attributes` column + GIN index; schema-approved fields only projected into OpenSearch
3. Inventory reservation model — `available_quantity` / `reserved_quantity`; atomic row-lock at checkout; BullMQ expiry worker
4. Multi-vendor order model — `orders` → `vendor_sub_orders` → `order_line_items`; commission at split time; payout audit trail (`payout_batches` + `payout_line_items` + `payout_settlements`)
5. Wallet ledger model — `wallet_ledger_entries` append-only; no direct balance-edit code path
6. `PaymentProvider` interface — provider SDKs in infrastructure adapters only; canonical webhook events at edge
7. Domain event bus — cross-module side effects via events, never direct imports

### Critical Pitfalls

1. **Floating-point money** — BIGINT minor units (paise/cents) everywhere. No `FLOAT`/`DECIMAL`/`NUMERIC(12,2)`. `allocate()` for commission splits to prevent residual drift. Phase 5/6.
2. **Non-atomic inventory reservation** — Never decrement on basket add. Row-lock + timed reservation in a single transaction at checkout initiation. BullMQ idempotent expiry worker. Phase 5.
3. **Wallet double-spend** — Append-only ledger; idempotency key unique constraint. No `UPDATE wallets SET balance = ...` as primary model. Phase 5.
4. **Refund does not reverse commission** — Commission records need reversal entries. Partial refunds generate proportional reversals. Payout = earned minus reversed. Phase 6.
5. **Payment provider coupling** — `PaymentProvider` interface defined before any checkout code. Provider SDKs only in infrastructure adapters. Canonical webhook events normalized at edge. Phase 5.
6. **Webhook idempotency failure** — `processed_webhook_events` table with unique constraint on provider event ID. Processing in transaction. Phase 5.
7. **Metro RN resolution breaks late** — Prove Metro workspace resolution in Phase 1. `watchFolders`, `resolver.nodeModulesPaths`, fresh `--reset-cache` release build. Phase 1.
8. **EAV product attributes** — JSONB + GIN + schema registry. No `(entity_id, key, value)` tables. Phase 2.
9. **Feature flags as hot-path DB reads** — Redis cache, invalidate on admin update. Phase 1.
10. **Envato productization gaps** — `.env.example`, no hardcoded secrets, docs, rebranding guide from Phase 1. Phase 1 + Phase 9.

---

## Implications for Roadmap

### Phase 1: Foundation
**Rationale:** Metro symlink config, shared BIGINT money contracts, feature flag cache, and `.env.example` scaffolding are prerequisites for everything. Metro resolution failure discovered in Phase 7 is project-halting.
**Delivers:** Monorepo scaffold (pnpm + Turborepo), `packages/contracts` with money minor-unit conventions, all five app shells with health checks, proven Metro RN resolution, GitHub Actions CI, feature flag table + Redis-cached `ConfigService`, root `.env.example`.
**Pitfalls closed:** Metro resolution (P7), type contract drift, feature flag hot path (P9), Envato gaps start (P10).
**Research flag:** Standard patterns — no additional research needed.

### Phase 2: Category Engine
**Rationale:** Single blocking dependency for vendor forms, storefront filters, PDP attributes, search facets, and all demo presets.
**Delivers:** `categories` + `attribute_definitions` + `filter_schema_definitions` tables; admin CRUD UI; attribute schema builder; filter schema builder; vendor-category restriction assignment; product template generation.
**Pitfalls closed:** EAV schema (P8) — JSONB + schema registry locked in.
**Research flag:** Standard DDD + JSONB patterns — no additional research needed.

### Phase 3: Catalog and Search
**Rationale:** Products require category schema. OpenSearch mappings derived from approved attribute definitions only. Storefront PLP/PDP demonstrable end-to-end.
**Delivers:** `products` table (JSONB + BIGINT + GIN), catalog module (create/edit/approve), OpenSearch index management with controlled mapping, search API (full-text + faceted), storefront PLP + PDP.
**Research flag:** OpenSearch attribute mapping pipeline from `attribute_definitions` — design spike recommended before implementation.

### Phase 4: Storefront (Customer Web)
**Rationale:** Complete customer web experience built on stable catalog/search APIs. Primary sales demo surface.
**Delivers:** Homepage CMS blocks, category landing pages, PLP with filter chips, PDP, vendor mini-profile, search bar with suggestions, Framer Motion micro-interactions, responsive layout, Google Places wiring, auth flows.
**Research flag:** Standard React + Framer Motion patterns — no additional research needed.

### Phase 5: Commerce Core
**Rationale:** Most financially critical phase. All five money-correctness pitfalls designed and closed here. `PaymentProvider` interface must be architected before any provider code.
**Delivers:** Basket, `inventory_items` + `inventory_reservations`, BullMQ expiry worker, checkout orchestration, `PaymentProvider` interface + Stripe adapter + Razorpay adapter, webhook idempotency infrastructure, order placement + multi-vendor splitting, wallet ledger foundation, commission engine, simple coupon engine, order confirmation email.
**Open questions (decision required before phase):**
- Razorpay Route feasibility in v1 vs manual-only
- Partial-refund commission proration rounding strategy
- Basket merge strategy on guest-to-auth transition
**Pitfalls closed:** P1, P2, P3, P5, P6, P9.
**Research flag:** Razorpay webhook `captured` vs `authorized` event sequence — verify before implementation.

### Phase 6: Vendor and Admin Tools
**Rationale:** Commerce core proven; full operational layer now unblocked. Payout audit trail required even with manual v1 settlement.
**Delivers:** Vendor onboarding/dashboard/product management/inventory/orders/returns/earnings; admin panel (category/vendor/commission/payout/moderation/CMS/settings/integrations/branding/feature flags/audit log/analytics).
**Pitfalls closed:** Commission reversal on refund (P4), payout audit trail.
**Research flag:** Standard CRUD + aggregation patterns — no additional research needed.

### Phase 7: React Native App
**Rationale:** All backend APIs stable after Phase 6. RN app wires to existing endpoints using shared contracts.
**Delivers:** All screens (auth, home, categories, search, PDP, cart + checkout, wallet, orders + tracking, profile, Google Places), Reanimated micro-interactions, offline cart persistence, deep links.
**Research flag:** EAS build config for Expo SDK 53 bare workflow in pnpm monorepo — verify before build pipeline setup.

### Phase 8: Fulfillment and Communications
**Rationale:** Tracking, serviceability, and notifications enhance but do not block core commerce.
**Delivers:** Order status timeline, vendor status update actions, admin override, simulation mode (auto-advance timer), serviceability check, tracking map shell, full Google SMTP transactional email suite, push-ready event hooks.
**Research flag:** Standard event-driven patterns — no additional research needed.

### Phase 9: Productization and Envato Release
**Rationale:** Demo presets and documentation are blocking Envato submission. Seed importer is a hard dependency for presets.
**Delivers:** Seed importer, five demo presets, branding token finalization, full documentation suite, preview assets, QA, packaging.
**Pitfalls closed:** Envato productization gaps (P10), scope explosion check.
**Research flag:** Review current Envato CodeCanyon reviewer checklist before final packaging.

### Open Questions (Decisions Required Before Relevant Phase)

| Question | Phase | Decision Needed |
|----------|-------|-----------------|
| Razorpay Route feasibility in v1 | Phase 5 | Manual-only or automated Route transfer |
| Partial-refund commission proration rounding | Phase 5 | Floor/ceil/banker's + allocation utility in `packages/contracts/src/money/` |
| Basket merge on guest-to-auth | Phase 5 | Merge vs replace vs prompt |
| OpenSearch mapping generation approach | Phase 3 | Event-driven reindex on schema change vs static mapping config |
| Razorpay `captured` status event flow | Phase 5 | Verify against current Razorpay API docs |
| Serviceability check scope | Phase 8 | Admin pin-code list, vendor zones, or Google Places area check |

---

## Confidence Assessment

| Area | Confidence | Notes |
|------|------------|-------|
| Stack | HIGH | All versions verified against npm registry 2026-05-29; compatibility matrix cross-checked |
| Features | HIGH | Cross-verified against competitor platforms and official docs; v1/v1.x/v2+ scope well-defined |
| Architecture | HIGH | DDD + event bus + JSONB + ledger-first wallet patterns are industry-proven |
| Pitfalls | HIGH | Critical pitfalls verified against official docs, post-mortems, and multiple independent sources |

**Overall confidence: HIGH**

### Gaps to Address

- **Razorpay Route automation feasibility:** Not fully validated against current Razorpay Route account requirements. Confirm before Phase 5 planning.
- **Dinero.js v2 alpha stability:** v2 is alpha. Fallback is plain BigInt + documented allocation utility in `packages/contracts/src/money/` — equally correct, lower risk.
- **OpenSearch self-hosted ops complexity for buyers:** Document AWS OpenSearch Service as first-choice managed option in installation guide.
- **Expo SDK 53 + pnpm workspace Metro config:** Known edge cases with pnpm symlinks. Must validate in Phase 1 before any feature work depends on it.

---

## Sources

### Primary (HIGH confidence)
- npm registry (all packages) — all versions verified 2026-05-29
- tailwindcss.com/blog/tailwindcss-v4 — v4 Vite plugin
- docs.expo.dev/bare/overview — bare workflow rationale
- reactnative.dev/blog RN 0.83 — RN 0.83 + React 19.2

### Secondary (MEDIUM confidence)
- uptrace.dev OpenSearch vs Elasticsearch 2025 — Apache 2.0 licensing rationale
- dinero.js GitHub — v2 alpha; BigInt calculator; flagged as alpha risk

---
*Research completed: 2026-05-29*
*Ready for roadmap: yes*
