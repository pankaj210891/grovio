# Roadmap: Grovio

## Overview

Grovio is a horizontal-layer infrastructure product. The roadmap builds complete capability layers in strict dependency order: a proven monorepo foundation first, then the dynamic category engine that feeds everything downstream, then catalog and search, then the customer storefront, then the financially critical commerce core, then the full vendor and admin operational tooling, then the React Native app that consumes stable APIs, then fulfillment and communications enhancements, and finally the productization and packaging required for the Envato release. Every phase delivers a coherent, independently verifiable capability before the next begins.

## Phases

- [ ] **Phase 1: Foundation** - Monorepo scaffold, shared contracts, all five app shells booting, proven Metro RN resolution, CI, feature-flag layer, branding config
- [x] **Phase 2: Category Engine** - Admin-managed category tree, per-category attribute/filter schemas, product templates, vendor-category restrictions (completed 2026-05-30)
- [ ] **Phase 3: Catalog & Search** - Vendor product CRUD with dynamic attribute forms, admin moderation, OpenSearch index, full-text + faceted search API
- [ ] **Phase 4: Customer Storefront (Web)** - Complete customer web experience: homepage, category pages, PLP, PDP, search, auth flows, responsive + animated UI
- [ ] **Phase 5: Commerce Core** - Basket, inventory reservation, checkout, PaymentProvider abstraction, wallet ledger, order placement + multi-vendor splitting, commission engine, coupon engine
- [ ] **Phase 6: Vendor & Admin Tools** - Full vendor panel, full admin panel, commission/payout audit trail, marketplace operational tooling
- [ ] **Phase 7: React Native App** - Full-featured customer mobile app consuming stable backend APIs via shared contracts
- [ ] **Phase 8: Fulfillment & Communications** - Order tracking timeline + map shell, serviceability check, simulation mode, full transactional email suite, push-ready notification events
- [ ] **Phase 9: Productization & Release** - Seed importer, five demo presets, full buyer documentation suite, preview assets, Envato packaging

## Phase Details

### Phase 1: Foundation

**Goal**: All five apps boot in a proven monorepo, shared type contracts are locked in, feature flags and branding config are wired, and the project is ready for feature development with zero mechanical debt
**Depends on**: Nothing (first phase)
**Requirements**: FND-01, FND-02, FND-03, FND-04, FND-05, FND-06, FND-07, FND-08
**Success Criteria** (what must be TRUE):

  1. All five apps (storefront, admin, vendor, React Native, backend) boot locally from a single documented setup command and return health-check responses
  2. The React Native app completes a clean release build against shared `packages/contracts` with Metro workspace resolution verified (no symlink failures)
  3. A feature flag toggled in the database is reflected in API responses within one Redis TTL cycle, without a code deploy
  4. Changing a design token in the branding config propagates visual changes across all three web apps
  5. CI runs lint, type-check, format, and tests on every push and fails the build on violations

**Plans**: 10 plans in 5 waves

**Wave 1** (parallel from clean slate):

- [x] 01-01-PLAN.md — Monorepo scaffold: pnpm workspace, Turborepo pipeline, shared tsconfig/ESLint/Prettier in packages/config, cloud infra setup (Neon/Upstash/Bonsai)
- [x] 01-02-PLAN.md — packages/contracts: health types, feature-flag types, auth token shapes, request/response envelope, MarketplaceConfig, money utils + allocate()

**Wave 2** *(blocked on Wave 1 completion)*:

- [x] 01-03-PLAN.md — Backend skeleton: Fastify + Awilix DI, Drizzle ORM + Redis setup, GET /health, Zod env config
- [x] 01-04-PLAN.md — Web app shells: storefront, admin, vendor — Vite 8 + React 19 + Tailwind v4 + health screens
- [x] 01-05-PLAN.md — React Native app shell: Expo bare + React Navigation v7, Metro workspace config for contracts

**Wave 3** *(blocked on Wave 2 completion)*:

- [ ] 01-06-PLAN.md — Feature-flag infrastructure: FeatureFlags Drizzle schema + migration, FeatureFlagService (Redis cache + DB fallback, configurable TTL)
- [ ] 01-07-PLAN.md — Branding/design-token config: packages/ui @theme CSS tokens, wired into all three web apps
- [ ] 01-08-PLAN.md — Root .env.example: all shared infrastructure vars documented with comments

**Wave 4** *(blocked on Wave 3 completion)*:

- [ ] 01-09-PLAN.md — CI pipeline: GitHub Actions lint + typecheck + format:check + test + build, fail on violations

**Wave 5** *(blocked on Wave 4 completion)*:

- [ ] 01-10-PLAN.md — Metro release build verification (FND-03 hard gate) + full-stack boot checkpoint

Cross-cutting constraints: All apps import from @grovio/contracts (D-03); FEATURE_FLAG_TTL_SECONDS env var configures Redis TTL (D-05)
**UI hint**: yes

### Phase 2: Category Engine

**Goal**: Admin can define and manage the full category taxonomy — nested trees, per-category attribute schemas, filter schemas, product templates, and vendor restrictions — making the platform vertical-agnostic at runtime
**Depends on**: Phase 1
**Requirements**: CAT-01, CAT-02, CAT-03, CAT-04, CAT-05, CAT-06, CAT-07
**Success Criteria** (what must be TRUE):

  1. Admin can create, edit, archive, and reorder categories and subcategories through a tree UI, with changes persisted immediately
  2. Admin can define typed attributes for a category (text, number, boolean, enum) and those definitions are retrievable via API
  3. Admin can specify which attributes become storefront filter facets for a category, and the filter schema is returned per-category by the API
  4. Admin can restrict specific vendors to specific categories, and the restriction is enforced when a vendor attempts to create a product
  5. Admin can configure banners, SEO fields, and merchandising blocks per category and retrieve them via API

**Plans**: 8 plans in 6 waves

Plans:

- [x] 02-01-PLAN.md — packages/contracts category subfolder: blocks, tree, attribute-definition, filter-schema, product-template, vendor-restriction, metadata + barrel
- [x] 02-02-PLAN.md — 6 Drizzle schema tables + attr_type/filter_display_type pgEnums + barrel + CATEGORY_TREE_TTL_SECONDS env var
- [x] 02-03-PLAN.md — [BLOCKING] db:generate + db:migrate; CategoryService (depth guard, tree builder, Redis cache) + tests
- [x] 02-04-PLAN.md — AttributeDefinitionService + FilterSchemaService + tests
- [x] 02-05-PLAN.md — ProductTemplateService + VendorRestrictionService + CategoryMetadataService + tests
- [x] 02-06-PLAN.md — Awilix registration + public category routes + guarded admin routes + app.ts wiring
- [x] 02-07-PLAN.md — web-admin: dnd-kit/react-router install (legitimacy checkpoint), router/query scaffold, category tree CRUD UI
- [x] 02-08-PLAN.md — web-admin: attribute builder, filter schema, product template, vendor restriction, metadata/blocks editors

### Phase 3: Catalog & Search

**Goal**: Vendors can create and manage products whose fields are driven by the category schema, admin can moderate them, and customers can discover products via full-text search and dynamic faceted filters
**Depends on**: Phase 2
**Requirements**: PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, SRCH-01, SRCH-02, SRCH-03, SRCH-04
**Success Criteria** (what must be TRUE):

  1. A vendor creating a product for a given category sees only the attribute fields defined in that category's schema, and submitted values are stored as JSONB and queryable
  2. Vendor can manage product variants, images, and pricing, and can edit or archive their own products
  3. Admin can approve or reject a vendor product before it appears in any customer-facing listing or search result
  4. A customer full-text search query returns ranked results with type-ahead suggestions within acceptable latency
  5. A customer can filter a product listing using facets derived exclusively from the target category's filter schema, and can apply, remove, and combine filters with sort options

**Plans**: 7 plans in 5 waves

**Wave 1** (parallel from clean slate):

- [x] 03-01-PLAN.md — packages/contracts catalog + search domains (product/variant/image, query/suggest/filter) + is_variant on attribute-definition contract
- [x] 03-02-PLAN.md — Install 5 Phase 3 packages (opensearch, bullmq, aws-sdk/client-s3, s3-request-presigner, argon2) behind legitimacy checkpoint

**Wave 2** *(blocked on Wave 1)*:

- [x] 03-03-PLAN.md — Drizzle schema: vendors, products (+productStatusEnum +GIN index), product_variants, product_images; is_variant column; S3/image/filter-cache env vars

**Wave 3** *(blocked on Wave 2)*:

- [x] 03-04-PLAN.md — [BLOCKING] db:generate + db:migrate + deferred vendor FK (D-18); is_variant/is_filterable mutual-exclusivity guard; filter-schema Redis cache invalidation

**Wave 4** *(blocked on Wave 3)*:

- [ ] 03-05-PLAN.md — vendor-auth (VendorAuthService: argon2 + jose JWT) + catalog (ProductService state machine/ownership/restrictions/auto-approve, ImageService presign flow)
- [ ] 03-06-PLAN.md — OpenSearch plugin + index mapping; BullMQ queue/worker + ProductIndexJob (is_searchable projection); SearchService (post_filter facets, suggest, cached filters)

**Wave 5** *(blocked on Wave 4)*:

- [ ] 03-07-PLAN.md — vendor JWT middleware + vendor/admin/search routes + /categories/:id/filters; DI container + app.ts + main.ts worker startup

### Phase 4: Customer Storefront (Web)

**Goal**: A customer can browse the entire marketplace on the web — from homepage through category landing pages, search, product listing, and product detail — with a responsive, animated, accessible UI and full authentication flows
**Depends on**: Phase 3
**Requirements**: STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, AUTH-06
**Success Criteria** (what must be TRUE):

  1. A visitor can sign up, log in, reset their password, and stay logged in across browser refresh; vendor and admin logins resolve to role-appropriate panels
  2. A customer can navigate from homepage merchandising blocks through category landing pages to a paginated/infinite-scroll PLP and through to a PDP showing dynamic, category-specific attributes
  3. The storefront search bar provides type-ahead suggestions and navigates to filtered results; filter chips are functional on PLP and category pages
  4. A customer can manage their profile and save delivery addresses with Google Places autocomplete
  5. All storefront pages are responsive/mobile-first, pass keyboard navigation, use semantic markup, meet contrast requirements, and include Framer Motion micro-interactions

**Plans**: TBD
**UI hint**: yes

### Phase 5: Commerce Core

**Goal**: A customer can complete a purchase end-to-end — basket management, checkout with inventory reservation, payment via Stripe or Razorpay, wallet usage, order placement with multi-vendor splitting, and commission calculation — with every money operation backend-authoritative and financially correct
**Depends on**: Phase 4
**Requirements**: CHK-01, CHK-02, CHK-03, CHK-04, CHK-05, CHK-06, PAY-01, PAY-02, PAY-03, PAY-04, WAL-01, WAL-02, WAL-03, WAL-04, WAL-05, ORD-01, ORD-02, ORD-03, ORD-04, ORD-05, MKT-01, MKT-02, MKT-03
**Success Criteria** (what must be TRUE):

  1. A customer can add items from multiple vendors to a basket, have it persist as a guest and merge on login, complete the full checkout flow (address → delivery → payment → review), and receive an order confirmation
  2. Stock is reserved atomically at checkout initiation (not on basket add), and abandoned reservations are released automatically by a background worker — no oversell is possible
  3. All pricing, discounts, and totals are computed server-side and match what the customer sees; a modified client payload is rejected or ignored
  4. A customer can pay via Stripe or Razorpay (whichever is configured), receive success/failure confirmation, and the payment webhook is processed idempotently without double-charging
  5. A customer can view wallet balance and ledger history, apply wallet credit at checkout (fully or partially), and receive refunds into their wallet — the wallet is append-only with no direct balance edits
  6. A single placed order splits into per-vendor sub-orders backend-side; a commission is computed per sub-order using the global → category → vendor priority chain with integer minor-unit allocation and no rounding drift

**Plans**: TBD

### Phase 6: Vendor & Admin Tools

**Goal**: Vendors have a complete operational panel for onboarding, product management, inventory, orders, earnings, and team access; admins have a full marketplace control plane covering vendors, commissions, payouts, moderation, CMS, branding, settings, feature flags, and analytics
**Depends on**: Phase 5
**Requirements**: MKT-04, MKT-05, VEN-01, VEN-02, VEN-03, VEN-04, VEN-05, VEN-06, ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07
**Success Criteria** (what must be TRUE):

  1. A vendor can complete onboarding, view a dashboard summarizing orders/earnings/inventory health, manage product listings and inventory levels, and handle orders and returns/refunds
  2. A vendor owner can invite staff and assign scoped permissions (inventory, orders, product editing); vendor can manage coupons/promotions where the feature flag is enabled
  3. A vendor can view their earned commissions, reversed amounts, net earnings, and payout status with a full ledger history
  4. Admin can approve/suspend vendors, configure commission rules (global, category, vendor override), view payout records per vendor with a full audit trail, and record manual settlements
  5. Admin can manage CMS/homepage blocks, branding/theme settings, global integration config, feature flag toggles, category/catalog moderation, and view an audit log of sensitive actions — all from the admin panel

**Plans**: TBD
**UI hint**: yes

### Phase 7: React Native App

**Goal**: The customer mobile app delivers full feature parity with the web storefront and commerce flows, consuming shared API contracts, with native navigation and micro-interactions
**Depends on**: Phase 6
**Requirements**: MOB-01, MOB-02, MOB-03, MOB-04, MOB-05, MOB-06, MOB-07
**Success Criteria** (what must be TRUE):

  1. A customer can sign up, log in, and complete mobile onboarding, with session persisting across app restarts
  2. A customer can browse the home screen, navigate category trees, run searches with filters, and view a PDP with dynamic category-specific attributes
  3. A customer can manage their cart across vendors and complete the full checkout flow including payment in the app
  4. A customer can view wallet balance and history, view order history and tracking status, and manage their profile and saved addresses using Google Places autocomplete
  5. All screens consume shared `packages/contracts` types and include premium motion and micro-interactions using Reanimated

**Plans**: TBD
**UI hint**: yes

### Phase 8: Fulfillment & Communications

**Goal**: Customers can track order status through a timeline and map shell, the platform sends all transactional emails, serviceability is checked at checkout, and notification events are emitted in a push-ready structure
**Depends on**: Phase 5
**Requirements**: FUL-01, FUL-02, FUL-03, FUL-04, NOT-01, NOT-02
**Success Criteria** (what must be TRUE):

  1. A customer can view a live order status timeline showing all status transitions for their order and sub-orders
  2. Admin can switch tracking between live mode and demo/simulation mode from the admin panel, and simulation mode auto-advances order states on a timer
  3. The checkout flow performs a serviceability/delivery check before allowing payment, and the tracking view includes a map shell for the delivery leg
  4. The system sends transactional emails via Google SMTP for signup, password reset, order updates, and payout alerts — all email templates are configurable
  5. Every significant order and payout event emits a structured push-ready notification event that a future push provider can consume without code changes to the business logic

**Plans**: TBD

### Phase 9: Productization & Release

**Goal**: The product is packaged for commercial Envato release: a seed importer loads any of five demo presets, buyer documentation covers installation/setup/rebranding/integrations, and preview assets meet Envato reviewer expectations
**Depends on**: Phase 8
**Requirements**: PRD-01, PRD-02, PRD-03, PRD-04, PRD-05, PRD-06
**Success Criteria** (what must be TRUE):

  1. Running the seed importer with a preset name (grocery, electronics, furniture, party supplies, or tools) fully populates the database with demo categories, products, vendors, and orders for that vertical
  2. A buyer can follow the installation and local-development documentation from a clean machine and have all five apps running without external help
  3. A buyer can follow the rebranding guide and change design tokens to produce a fully rebranded storefront without touching business-logic code
  4. Integration setup docs for Stripe, Razorpay, Google SMTP, and Google Places are complete and accurate; `.env.example` files are present with every variable documented
  5. Preview screenshots and assets are produced, file organization is reviewed against the Envato CodeCanyon submission checklist, and the package is submission-ready

**Plans**: TBD

## Progress

**Execution Order:**
Phases execute in numeric order: 1 → 2 → 3 → 4 → 5 → 6 → 7 → 8 → 9

| Phase | Plans Complete | Status | Completed |
|-------|----------------|--------|-----------|
| 1. Foundation | 5/10 | In Progress|  |
| 2. Category Engine | 8/8 | Complete    | 2026-05-30 |
| 3. Catalog & Search | 4/7 | In Progress|  |
| 4. Customer Storefront (Web) | 0/TBD | Not started | - |
| 5. Commerce Core | 0/TBD | Not started | - |
| 6. Vendor & Admin Tools | 0/TBD | Not started | - |
| 7. React Native App | 0/TBD | Not started | - |
| 8. Fulfillment & Communications | 0/TBD | Not started | - |
| 9. Productization & Release | 0/TBD | Not started | - |

### Phase 10: Replace Docker with Neon + Upstash

**Goal:** Local Docker is fully removed; PostgreSQL, Redis, and OpenSearch run on cloud free tiers (Neon, Upstash, Bonsai), the backend auto-detects TLS from the connection URL, and a buyer can set up all infrastructure from the README without Docker
**Requirements**: None (infrastructure/config migration)
**Depends on:** Phase 9
**Plans:** 3/3 plans complete
Plans:
**Wave 1**

- [x] 10-01-PLAN.md — Backend TLS auto-detection (requiresSsl/detectRedisTls helpers + tests), DATABASE_DIRECT_URL/OPENSEARCH_URL env fields, drizzle.config direct URL
- [x] 10-02-PLAN.md — Both .env.example files to Neon/Upstash/Bonsai formats + docker-compose sweep; CI credentials from GitHub Actions secrets

**Wave 2** *(blocked on Wave 1 completion)*

- [x] 10-03-PLAN.md — Delete docker-compose.yml; create README Infrastructure Setup section; update ROADMAP Phase 1 cloud-infra description
