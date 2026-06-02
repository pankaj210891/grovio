# Requirements: Grovio

**Defined:** 2026-05-29
**Core Value:** A buyer can rebrand and reconfigure the entire marketplace for a new product vertical — categories, attributes, filters, branding, integrations — without rewriting core code.

## v1 Requirements

Requirements for the initial commercial release (the Envato-ready starter kit). Each maps to a roadmap phase.

### Platform & Foundation

- [ ] **FND-01**: Project is a single pnpm + Turborepo monorepo containing backend, three web apps (storefront/admin/vendor), and the React Native app
- [ ] **FND-02**: A shared `packages/contracts` package is the single source of truth for API types, Zod schemas, and money (integer minor-unit) conventions, consumed by every app
- [ ] **FND-03**: The React Native app resolves shared monorepo packages via verified Metro configuration (proven with a clean release build)
- [ ] **FND-04**: All five apps boot from a single documented local setup with health-check endpoints/screens
- [ ] **FND-05**: Linting, formatting, type-checking, and a test runner are configured and enforced in CI (GitHub Actions)
- [ ] **FND-06**: A configuration-first layer exposes a feature-flag store (DB-backed, Redis-cached) that admin can toggle without code changes
- [ ] **FND-07**: A design-token / branding config drives theming across web apps so buyers can rebrand from one place
- [ ] **FND-08**: Root `.env.example` files document every required environment variable with no hardcoded secrets

### Category Engine

- [x] **CAT-01**: Admin can create, edit, archive, and reorder categories
- [x] **CAT-02**: Admin can create nested subcategories (category tree)
- [x] **CAT-03**: Admin can define category-specific attribute schemas (typed attributes per category)
- [x] **CAT-04**: Admin can define per-category filter schemas controlling which attributes become storefront filters
- [x] **CAT-05**: Admin can define product templates per category to speed vendor product creation
- [x] **CAT-06**: Admin can restrict which vendors may sell in which categories
- [x] **CAT-07**: Admin can configure category banners, descriptions, SEO fields, and merchandising blocks

### Catalog & Products

- [x] **PROD-01**: Vendor can create a product whose fields are driven by the selected category's attribute schema/template
- [x] **PROD-02**: Vendor can edit and archive their own products
- [x] **PROD-03**: Product attributes are stored so they are queryable for filtering and search (JSONB + indexed)
- [x] **PROD-04**: Vendor can manage product variants/options where the category defines them
- [x] **PROD-05**: Vendor can upload and manage product images
- [x] **PROD-06**: Admin can moderate (approve/reject) vendor products before they go live

### Search & Discovery

- [x] **SRCH-01**: Customer can full-text search products with type-ahead suggestions
- [x] **SRCH-02**: Customer can filter a product list using dynamic, category-specific facets
- [x] **SRCH-03**: Customer can apply and remove filters via filter chips and sort results
- [x] **SRCH-04**: Search/index only exposes attributes the category schema marks as searchable/filterable

### Customer Storefront (Web)

- [x] **STORE-01**: Customer can view a configurable homepage with merchandising/CMS blocks
- [x] **STORE-02**: Customer can view category landing pages with category-specific filters
- [x] **STORE-03**: Customer can view a product listing page (PLP) with pagination/infinite scroll
- [x] **STORE-04**: Customer can view a product detail page (PDP) showing dynamic, category-specific attributes
- [x] **STORE-05**: Storefront is responsive/mobile-first and uses Framer Motion micro-interactions
- [x] **STORE-06**: Storefront is accessibility-conscious (keyboard nav, semantic markup, contrast)

### Authentication & Accounts

- [x] **AUTH-01**: Customer can sign up with email and password
- [x] **AUTH-02**: Customer can log in and session persists across refresh/app restart
- [x] **AUTH-03**: Customer can reset password via emailed link
- [x] **AUTH-04**: Vendor and admin users authenticate with role-appropriate access
- [x] **AUTH-05**: Customer can manage profile and saved addresses
- [x] **AUTH-06**: Address entry uses Google Places autocomplete

### Basket & Checkout

- [ ] **CHK-01**: Customer can add/update/remove items in a basket spanning multiple vendors
- [ ] **CHK-02**: Basket persists for guests and merges into the account on login
- [ ] **CHK-03**: Customer can complete a checkout flow (address → delivery → payment → review)
- [ ] **CHK-04**: All pricing, discounts, and order totals are computed backend-authoritatively (never trusted from client)
- [ ] **CHK-05**: Stock is reserved atomically at checkout initiation (not on basket add) with timed release of abandoned reservations
- [ ] **CHK-06**: Customer can apply a coupon during checkout (simple coupon engine, feature-flagged)

### Payments

- [ ] **PAY-01**: Payment processing goes through a `PaymentProvider` abstraction; no provider SDK is called from business logic
- [ ] **PAY-02**: Buyer can enable Stripe, Razorpay, or both via configuration
- [ ] **PAY-03**: Payment webhooks are verified and processed idempotently (no double-processing on retry)
- [ ] **PAY-04**: Customer can pay using a configured provider and receives confirmation on success/failure

### Wallet

- [ ] **WAL-01**: Customer can view wallet balance
- [ ] **WAL-02**: Customer can view a wallet ledger/history of credits and debits
- [ ] **WAL-03**: Wallet is modeled as an append-only ledger (no direct balance edits) with idempotent entries
- [ ] **WAL-04**: Refunds can be issued to the customer wallet
- [ ] **WAL-05**: Customer can pay (fully or partially) using wallet balance at checkout

### Orders

- [ ] **ORD-01**: Customer can place an order and receive an order confirmation
- [ ] **ORD-02**: A single customer order containing multiple vendors splits into per-vendor sub-orders backend-side
- [ ] **ORD-03**: Customer can view order history and order detail
- [ ] **ORD-04**: Customer can request a return/refund on eligible order items
- [ ] **ORD-05**: Vendor and admin can view and update the status of sub-orders they own

### Multi-Vendor: Commissions & Payouts

- [ ] **MKT-01**: A commission is computed per vendor sub-order using a priority chain (global → category → vendor)
- [ ] **MKT-02**: Commission splits use integer minor-unit allocation so totals reconcile with no rounding drift
- [ ] **MKT-03**: Refunds generate proportional commission reversal entries
- [ ] **MKT-04**: Admin can view payout records per vendor with a full audit trail (earned, reversed, net) and record manual settlement
- [ ] **MKT-05**: Vendor can view their earnings and payout status

### Vendor Panel (Web)

- [ ] **VEN-01**: Vendor can complete onboarding and manage a store profile
- [ ] **VEN-02**: Vendor has a dashboard summarizing orders, earnings, and inventory health
- [ ] **VEN-03**: Vendor can manage inventory levels and pricing for their products
- [ ] **VEN-04**: Vendor can manage orders (view, update status, handle returns/refunds)
- [ ] **VEN-05**: Vendor owner can invite vendor staff and assign limited permissions (e.g., inventory, orders, product editing)
- [ ] **VEN-06**: Vendor can manage promotions/coupons where enabled

### Admin Panel (Web)

- [ ] **ADM-01**: Admin has a dashboard with marketplace KPIs and reporting
- [ ] **ADM-02**: Admin can manage vendors (approve, suspend, configure)
- [ ] **ADM-03**: Admin can configure the commission engine (rules and rates)
- [ ] **ADM-04**: Admin can manage CMS/content blocks and homepage merchandising
- [ ] **ADM-05**: Admin can manage global settings, integrations setup, and theme/branding
- [ ] **ADM-06**: Admin can manage feature flags (toggle wallet, coupons, tracking mode, providers, etc.)
- [ ] **ADM-07**: Admin can moderate catalog and view an audit log of sensitive actions

### Mobile App (React Native)

- [ ] **MOB-01**: Customer can sign up, log in, and onboard in the app
- [ ] **MOB-02**: Customer can browse home, categories, and search with filters
- [ ] **MOB-03**: Customer can view product detail with dynamic attributes
- [ ] **MOB-04**: Customer can manage cart and complete checkout
- [ ] **MOB-05**: Customer can view wallet, orders, and tracking
- [ ] **MOB-06**: Customer can manage profile and saved addresses with Google Places
- [ ] **MOB-07**: App consumes the shared API contracts and includes premium motion/micro-interactions

### Fulfillment & Tracking

- [ ] **FUL-01**: Customer can view live order tracking with a status timeline/history
- [ ] **FUL-02**: Admin can switch tracking between live mode and demo/simulation mode
- [ ] **FUL-03**: System performs a serviceability/delivery check during checkout
- [ ] **FUL-04**: Tracking includes a map shell for the delivery view

### Notifications & Email

- [ ] **NOT-01**: System sends transactional email via Google SMTP for signup, password reset, order updates, and payout alerts
- [ ] **NOT-02**: Notification events are emitted in a push-ready structure (event hooks) without wiring a push provider

### Productization & Release

- [ ] **PRD-01**: A seed-data importer can load demo data
- [ ] **PRD-02**: Five demo presets are provided (grocery, electronics, furniture, party supplies, tools)
- [ ] **PRD-03**: Buyer documentation covers installation, setup, and local development
- [ ] **PRD-04**: A rebranding guide explains theme/branding and design-token changes
- [ ] **PRD-05**: Integration setup docs cover Stripe, Razorpay, Google SMTP, and Google Places
- [ ] **PRD-06**: Preview assets/screenshots are produced and file organization is support-friendly for Envato review

## v2 Requirements

Acknowledged but deferred. Not in the current roadmap.

### Payments & Payouts
- **PAY2-01**: Automated vendor payouts via Stripe Connect / Razorpay Route
- **PAY2-02**: Multi-currency support

### Engagement
- **ENG2-01**: Product reviews and ratings (submission + moderation)
- **ENG2-02**: Q&A on product pages
- **ENG2-03**: Wishlist / saved items
- **ENG2-04**: Cashback / credit campaigns
- **ENG2-05**: Social / OAuth login

### Notifications
- **NOT2-01**: Live push notification delivery wired to FCM/APNs

### Discovery
- **SRCH2-01**: Semantic / AI-assisted search and recommendations
- **INTL-01**: Internationalization / localization (i18n)

### Fulfillment
- **FUL2-01**: GPS / live driver tracking and a dedicated delivery/driver app

## Out of Scope

Explicitly excluded. Documented to prevent scope creep.

| Feature | Reason |
|---------|--------|
| Digital / downloadable products | Platform targets physical-product marketplaces only |
| Real-time chat / messaging | Not core to marketplace value; high complexity |
| BNPL / subscription billing | Out of scope for a v1 marketplace starter kit |
| AI product recommendations | Over-engineering for v1; deferred concept |
| Automated vendor KYC | Compliance-heavy; manual/admin review in v1 |
| Built-in email marketing tool | Transactional email only in scope |
| Native (non-React-Native) iOS/Android apps | Mobile is React Native to share contracts |

## Traceability

Which phases cover which requirements. Populated during roadmap creation.

| Requirement | Phase | Status |
|-------------|-------|--------|
| FND-01 | Phase 1 | Pending |
| FND-02 | Phase 1 | Pending |
| FND-03 | Phase 1 | Pending |
| FND-04 | Phase 1 | Pending |
| FND-05 | Phase 1 | Pending |
| FND-06 | Phase 1 | Pending |
| FND-07 | Phase 1 | Pending |
| FND-08 | Phase 1 | Pending |
| CAT-01 | Phase 2 | Complete |
| CAT-02 | Phase 2 | Complete |
| CAT-03 | Phase 2 | Complete |
| CAT-04 | Phase 2 | Complete |
| CAT-05 | Phase 2 | Complete |
| CAT-06 | Phase 2 | Complete |
| CAT-07 | Phase 2 | Complete |
| PROD-01 | Phase 3 | Complete |
| PROD-02 | Phase 3 | Complete |
| PROD-03 | Phase 3 | Complete |
| PROD-04 | Phase 3 | Complete |
| PROD-05 | Phase 3 | Complete |
| PROD-06 | Phase 3 | Complete |
| SRCH-01 | Phase 3 | Complete |
| SRCH-02 | Phase 3 | Complete |
| SRCH-03 | Phase 3 | Complete |
| SRCH-04 | Phase 3 | Complete |
| STORE-01 | Phase 4 | Complete |
| STORE-02 | Phase 4 | Complete |
| STORE-03 | Phase 4 | Complete |
| STORE-04 | Phase 4 | Complete |
| STORE-05 | Phase 4 | Complete |
| STORE-06 | Phase 4 | Complete |
| AUTH-01 | Phase 4 | Complete |
| AUTH-02 | Phase 4 | Complete |
| AUTH-03 | Phase 4 | Complete |
| AUTH-04 | Phase 4 | Complete |
| AUTH-05 | Phase 4 | Complete |
| AUTH-06 | Phase 4 | Complete |
| CHK-01 | Phase 5 | Pending |
| CHK-02 | Phase 5 | Pending |
| CHK-03 | Phase 5 | Pending |
| CHK-04 | Phase 5 | Pending |
| CHK-05 | Phase 5 | Pending |
| CHK-06 | Phase 5 | Pending |
| PAY-01 | Phase 5 | Pending |
| PAY-02 | Phase 5 | Pending |
| PAY-03 | Phase 5 | Pending |
| PAY-04 | Phase 5 | Pending |
| WAL-01 | Phase 5 | Pending |
| WAL-02 | Phase 5 | Pending |
| WAL-03 | Phase 5 | Pending |
| WAL-04 | Phase 5 | Pending |
| WAL-05 | Phase 5 | Pending |
| ORD-01 | Phase 5 | Pending |
| ORD-02 | Phase 5 | Pending |
| ORD-03 | Phase 5 | Pending |
| ORD-04 | Phase 5 | Pending |
| ORD-05 | Phase 5 | Pending |
| MKT-01 | Phase 5 | Pending |
| MKT-02 | Phase 5 | Pending |
| MKT-03 | Phase 5 | Pending |
| MKT-04 | Phase 6 | Pending |
| MKT-05 | Phase 6 | Pending |
| VEN-01 | Phase 6 | Pending |
| VEN-02 | Phase 6 | Pending |
| VEN-03 | Phase 6 | Pending |
| VEN-04 | Phase 6 | Pending |
| VEN-05 | Phase 6 | Pending |
| VEN-06 | Phase 6 | Pending |
| ADM-01 | Phase 6 | Pending |
| ADM-02 | Phase 6 | Pending |
| ADM-03 | Phase 6 | Pending |
| ADM-04 | Phase 6 | Pending |
| ADM-05 | Phase 6 | Pending |
| ADM-06 | Phase 6 | Pending |
| ADM-07 | Phase 6 | Pending |
| MOB-01 | Phase 7 | Pending |
| MOB-02 | Phase 7 | Pending |
| MOB-03 | Phase 7 | Pending |
| MOB-04 | Phase 7 | Pending |
| MOB-05 | Phase 7 | Pending |
| MOB-06 | Phase 7 | Pending |
| MOB-07 | Phase 7 | Pending |
| FUL-01 | Phase 8 | Pending |
| FUL-02 | Phase 8 | Pending |
| FUL-03 | Phase 8 | Pending |
| FUL-04 | Phase 8 | Pending |
| NOT-01 | Phase 8 | Pending |
| NOT-02 | Phase 8 | Pending |
| PRD-01 | Phase 9 | Pending |
| PRD-02 | Phase 9 | Pending |
| PRD-03 | Phase 9 | Pending |
| PRD-04 | Phase 9 | Pending |
| PRD-05 | Phase 9 | Pending |
| PRD-06 | Phase 9 | Pending |

**Coverage:**
- v1 requirements: 94 total (note: 94 requirements counted across 17 categories; original header estimated 73)
- Mapped to phases: 94
- Unmapped: 0 ✓

**Phase distribution:**
- Phase 1 (Foundation): 8 requirements
- Phase 2 (Category Engine): 7 requirements
- Phase 3 (Catalog & Search): 10 requirements
- Phase 4 (Customer Storefront Web): 12 requirements
- Phase 5 (Commerce Core): 23 requirements
- Phase 6 (Vendor & Admin Tools): 15 requirements
- Phase 7 (React Native App): 7 requirements
- Phase 8 (Fulfillment & Communications): 6 requirements
- Phase 9 (Productization & Release): 6 requirements

---
*Requirements defined: 2026-05-29*
*Last updated: 2026-05-29 — Traceability populated after roadmap creation*
