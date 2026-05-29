# Feature Research

**Domain:** Multi-vendor, multi-category physical-product marketplace platform (commercial starter kit)
**Researched:** 2026-05-28
**Confidence:** HIGH — cross-verified across official platform docs, competitor analysis, and industry sources

---

## Overview

Grovio is a **commercial product for sale** (Envato-style), not just a marketplace. This doubles the feature surface: every feature must work correctly for end-users of the running marketplace AND be configurable, rebrandable, and documentable for the developer/agency buyer. Both dimensions are captured below.

### Operating Constraints for v1

These constraints are architectural guardrails, not optional notes. They keep scope realistic and keep the product sellable as a starter kit.

- Single currency per installation; no multi-currency in v1.
- Integer money contract everywhere in minor units (paise/cents) across API, DB, calculations, wallet, commissions, refunds, and payouts.
- Manual payout workflow in v1 with full audit trail; automated bank-account disbursement via Stripe Connect / Razorpay Route is deferred.
- Tracking supports live-ready interfaces plus simulation/demo mode; no driver app in v1.
- No automated KYC/identity verification in v1; provide extension hooks and documentation only.
- Coupon support in v1 is intentionally simple: one rules layer, cart/checkout application, admin-controlled enable/disable, no enterprise campaign engine.
- Reviews in v1 are display-ready only (seed/demo data or imported data); customer submission, moderation workflow, and vendor replies are deferred to v1.x.

---

## 1. Customer Storefront

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Homepage with hero, banners, featured categories, featured products | First impression; every major marketplace has this | MEDIUM | Admin-configurable via CMS blocks |
| Category landing pages with subcategory navigation | Users browse by category; absence = broken discovery | MEDIUM | Must respect category tree from category engine |
| Product listing page (PLP) with grid layout, sorting, pagination | Universal e-commerce convention | MEDIUM | Needs per-category filter schema rendering |
| Product detail page (PDP) — images, description, attributes, price, add-to-cart | Core transactional page | MEDIUM | Must render category-specific attributes dynamically |
| Search bar with live suggestions / autocomplete | 43% of shoppers go directly to search; missing = friction | HIGH | OpenSearch/ES-backed; needs debounce, suggestion API |
| Dynamic category-specific faceted filters | Category-specific attribute schemas drive filters; static filters fail multi-category platforms | HIGH | Depends on per-category filter schemas from category engine |
| Filter chips (applied filter badges, clear-all) | Modern UX convention; removes friction from filter state | LOW | Client-side state; tied to filter panel |
| Sorting (price asc/desc, newest, bestseller, relevance) | Standard and expected on all PLPs | LOW | Backend sort param; relevance needs search score |
| Shopping cart / basket (add, update qty, remove) | Core commerce primitive; completely blocking | MEDIUM | Backend-authoritative totals; multi-vendor cart |
| Checkout flow — address, shipping, payment, review, confirm | Core transactional flow; blocking | HIGH | Multi-step; integrates Google Places, Stripe/Razorpay |
| Guest checkout | 34% of carts are abandoned when account required; widely expected | MEDIUM | Auth optional at checkout; account creation offered post-purchase |
| Order confirmation page + confirmation email | Trust signal; sets expectation for delivery | LOW | Depends on email (Google SMTP) |
| Order history and order detail page | Users re-purchase and track from here | MEDIUM | Auth-required; multi-vendor sub-order display |
| Order tracking / status timeline | Customers expect to see order progress | MEDIUM | Configurable: live mode vs demo/simulation mode |
| Customer account — profile, saved addresses | Returning customers expect saved data | LOW | Depends on auth |
| Auth flows — signup, login, password reset | Universal baseline | LOW | Google SMTP for email flows |
| Responsive layout (mobile + desktop) | Mobile commerce drives 73% of marketplace traffic | MEDIUM | Tailwind breakpoints; mobile-first |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Framer Motion micro-interactions (hover, page transitions, add-to-cart) | Premium feel that distinguishes kit from commodity templates | MEDIUM | Only on web; React Native uses its own motion layer |
| Wishlist / save for later | Drives return visits; intent tracking signal | LOW | Auth-required; simple persistence; deferred to v1.x if schedule tightens |
| Product reviews and ratings display | Trust signal; 68% higher conversion for reviewed products | LOW | Display-only in v1; seeded/imported data only; submission/moderation deferred to v1.x |
| Vendor mini-profile on PDP (store name, rating) | Differentiates from single-vendor stores; supports discovery | LOW | Read-only pull from vendor profile |
| Google Places autocomplete for address entry | Faster, error-free address entry; modern UX standard | LOW | Already in tech stack; must wire to checkout form |
| Search with filter chip persistence on back-navigation | Reduces frustration on return from PDP | LOW | Client-side state (Zustand) |
| Category-specific attribute display on PDP (e.g. "Wattage: 60W" for electronics vs "Weight: 500g" for grocery) | Demonstrates multi-category flexibility — core value prop | MEDIUM | Driven by attribute schema; no hardcoding |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Real-time chat with vendors/support | Buyers want direct communication | Full chat system is a distinct product scope; adds significant infra (WebSockets, message storage, moderation) | Order notes/status updates satisfy most communication needs; add later |
| Social login (Google/Facebook OAuth) | Reduces friction | Good but not blocking; adds scope and OAuth management complexity for a v1 kit | Email/password + password-reset covers the requirement; add social login as a documented later extension |
| Live product video / streaming | Trend feature for engagement | Extremely high complexity; streaming infra is out of scope for a starter kit | Static image galleries + video upload covers 99% of use cases |
| AI-powered product recommendations | Trendy; used by Amazon, etc. | Requires training data that a fresh install doesn't have; misleading in a demo | Configurable curated "featured products" blocks serve the same demo purpose |
| Delivery slot selection at checkout | Relevant for grocery/perishables | Depends on a logistics system that is out of scope for v1 | Show estimated delivery timeframe from vendor config |

---

## 2. Search & Discovery

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Full-text product search | Core discovery mechanism | HIGH | OpenSearch/ES; index mapping must be controlled from approved schemas |
| Autocomplete / search suggestions | Modern standard; reduces zero-result searches | MEDIUM | Debounced API; prefix matching on product names/categories |
| Zero-results handling with suggestions | Bad UX if nothing shown | LOW | "No results for X — did you mean Y?" with category fallback |
| Search result ranking by relevance | Broken if not weighted properly | MEDIUM | ES/OS relevance scoring; category boost signals |
| Category-scoped search | Searching "knife" in Kitchen vs Tools should differ | MEDIUM | Pass category context to search query |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Faceted search with per-category attribute filters | Demonstrates the category engine; the key differentiator of a multi-category kit | HIGH | Driven by filter schema per category; must be dynamic, not hardcoded |
| Search with filter chip UI and URL-serialized state | Shareable/bookmarkable search with filters applied | LOW | URL query param sync via React Router |
| Vendor-filtered search | "Show only from Vendor X" option | LOW | Filter param on search API |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Semantic / vector search (AI embeddings) | Smarter result matching | Requires embedding model, vector store, and enough catalog data to matter; overkill for a starter kit | ES/OS keyword + relevance scoring covers demo quality; documented as extension point |
| Search analytics dashboard (buyer-facing trending searches) | Nice UX | Requires event pipeline and aggregation; scope creep for v1 | Stub the event hooks; analytics for admin in a future phase |

---

## 3. Category Engine

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Category CRUD (create, edit, archive, reorder) | Admin must manage the catalog tree | MEDIUM | Backend + admin UI |
| Nested subcategory tree (at least 3 levels) | Real catalogs need hierarchy (Electronics > Phones > Android) | MEDIUM | Recursive tree; must handle infinite depth carefully |
| Per-category attribute schema definition | Core differentiator of the platform; makes it multi-category | HIGH | Admin defines attribute name, type, required/optional, display order |
| Per-category filter schema definition | Drives the faceted search feature; without this, filters are static | HIGH | Defines which attributes become searchable/filterable facets |
| Per-category product template | Vendors see only the attributes relevant to their category | MEDIUM | Drives vendor product-create form dynamically |
| Category banner / hero image | Visual merchandising expected | LOW | Image upload, stored in CDN |
| Category SEO fields (title, description, slug) | Admin-managed SEO per category page | LOW | Standard metadata fields |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Vendor-category restriction (admin assigns vendor to categories) | Marketplaces need to control what vendors can sell | MEDIUM | Many-to-many vendor ↔ category; checked at product-create time |
| Attribute type system (text, number, boolean, enum/select, multi-select, range) | Richer attribute modeling enables better search facets | MEDIUM | Type determines widget (text input vs slider vs checkbox group) |
| Category merchandising settings (featured, sort weight, is-visible, landing CTA) | Admin can promote categories or hide them during setup | LOW | Simple metadata flags on category record |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Buyer-defined custom categories | Flexible for power-users | Breaks curation model; pollutes attribute schema governance | Admin-only category management with easy CRUD is sufficient |
| AI-generated category hierarchies | Speeds setup | Model dependency; unpredictable quality; no value in a demo preset | Ship with seed data presets showing complete category trees per vertical |

---

## 4. Commerce / Checkout

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Multi-vendor basket (items from multiple vendors in one cart) | Core marketplace requirement; "one cart, multiple sellers" | HIGH | Backend-authoritative; vendor grouping in cart display |
| Backend-authoritative pricing and totals | Prevents fraud; buyers expect correct totals | HIGH | Never trust client-calculated totals; backend recomputes from catalog, coupons, tax, shipping, wallet |
| Stripe payment integration | Global standard; required for most markets | MEDIUM | Webhook handling, intent confirmation, refund support |
| Razorpay payment integration | Required for Indian market (explicit in brief) | MEDIUM | Behind payment provider abstraction layer |
| Payment provider abstraction (one or both enabled via config) | Buyer enabling one provider must not require code changes | HIGH | Strategy pattern; env-flag driven |
| Address management (save, edit, set default) | Returning customers expect saved addresses | LOW | Depends on auth + Google Places |
| Order placement with multi-vendor splitting | Backend splits one order into per-vendor sub-orders | HIGH | Commission calculation at split time |
| Inventory reservation at checkout | Prevents oversell under concurrency | HIGH | Timed reservation with release on failure/expiry; do not decrement stock on basket add |
| Order confirmation email | Trust and record-keeping | LOW | Google SMTP; order details template |
| Coupon / promo code support at checkout | Buyers expect discount codes; vendors want to run promos | MEDIUM | Simple v1 engine only; admin-controlled enable/disable via feature flag |
| Tax calculation (flat rate, configurable) | Required for most markets; blocking in production | MEDIUM | Simple flat-rate config acceptable for v1 starter kit |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Wallet as partial or full payment method | Customer loyalty driver; differentiates from basic checkout | MEDIUM | Wallet balance checked at checkout; combined with gateway if partial |
| Refund to wallet (vs gateway refund only) | Faster refund experience; reduces gateway processing time | MEDIUM | Admin/vendor initiates; ledger entry added |
| Checkout progress indicator | Reduces abandonment; professional UX | LOW | Multi-step form with step indicator |
| Per-vendor shipping cost at checkout | Transparent breakdown when multiple vendors | MEDIUM | Each sub-order has its own shipping line |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Buy Now Pay Later (BNPL) | Popular in some markets | Requires third-party BNPL provider integration (Klarna, Afterpay); adds significant complexity and legal/compliance overhead | Document as extension point; payment abstraction layer supports adding it later |
| Subscription billing | Recurring purchase use case | Different product type; out of scope for physical goods marketplace | N/A for this kit |
| One-click reorder | UX improvement | Nice to have; low priority until core checkout is polished | Order history + "reorder" CTA can be added in v1.x |
| Delivery slot booking | Grocery / time-sensitive delivery | Requires logistics scheduling system; out of scope | Show estimated delivery timeframe from vendor config |

---

## 5. Payments & Wallet

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Wallet balance display (customer-facing) | If wallet is shown, balance must be visible | LOW | Returned from backend; source of truth is ledger-backed |
| Wallet transaction ledger / history | Customers need to audit credits and debits | LOW | Paginated list; date, amount, type, description |
| Add funds to wallet (via gateway) | Wallet is useless without a top-up mechanism | MEDIUM | Checkout-like flow; Stripe/Razorpay top-up |
| Refund to wallet | Faster alternative to gateway refund | MEDIUM | Admin/vendor-initiated; ledger entry |
| Backend-authoritative wallet balance | Prevents double-spend and fraud | HIGH | Ledger-first model; optional cached current balance only |
| Commission engine (percentage, flat, per-category, per-vendor) | Marketplace earns from every transaction | HIGH | Applied at order-split time; commission record per sub-order |
| Payout records (vendor earnings ledger) | Vendors must see what they're owed | MEDIUM | Running balance; commission-deducted earnings per order |
| Manual payout initiation (admin) | Admin triggers vendor withdrawals | MEDIUM | Admin marks payout processed; updates ledger; this is the v1 payout mode |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Wallet cashback / credit-ready structure | Loyalty mechanism; drives repeat purchase | MEDIUM | Configuration flag; rules engine stub; full campaigns deferred to v1.x |
| Tiered commission rules (category-level override, vendor-level override) | Marketplaces grow by offering incentive tiers to high-performing vendors | HIGH | Commission rule priority: global → category → vendor |
| Payout schedule config (weekly/monthly batch vs instant) | Buyers need to set payout rhythm per their business model | LOW | Config value; admin payout processor respects it |
| Payment provider abstraction with runtime toggle | Buyers in different geographies need different providers | HIGH | Core architectural requirement; env-config drives which provider is active |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Automated Stripe Connect payout (push to vendor bank accounts) | Reduces admin manual work | Stripe Connect has significant account verification and compliance requirements; adds legal/regulatory complexity for a starter kit sold globally | Payout records + manual trigger with documented Stripe Connect extension path |
| Automated Razorpay Route vendor disbursement | Important for India-market automation | Adds provider-specific compliance, account-state checks, and more reconciliation complexity than a starter kit should absorb in v1 | Same payout ledger + manual disbursement workflow; document Route extension path |
| KYC / identity verification for wallets | Compliance requirement at scale | Regulatory complexity varies enormously by jurisdiction; over-engineering for a starter kit | Stub the hook; document as required step before production launch |
| Peer-to-peer wallet transfers | Interesting for social commerce | Out of scope for physical product marketplace | N/A for this kit |

---

## 6. Vendor Panel

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Vendor onboarding flow (registration, profile, bank details) | Without onboarding, no vendors on platform | MEDIUM | Admin approval gating; multi-step form |
| Vendor dashboard (sales KPIs, recent orders, earnings) | Overview at a glance; expected by any seller | LOW | Aggregated read from orders/commissions |
| Product management (create, edit, archive) | Core vendor job; blocking | HIGH | Must use dynamic product template from category engine |
| Category-specific product creation form | Form fields change per category; critical for multi-category value | HIGH | Depends on category engine's per-category product templates |
| Inventory management (stock quantity, low-stock alerts) | Prevents overselling; required | MEDIUM | Stock model supports reservation semantics; low-stock threshold config |
| Pricing management (base price, sale price, per-variant pricing) | Core selling function | MEDIUM | Store prices as integer minor units; sale price with optional date range |
| Order management (view, process, mark shipped, tracking input) | Vendors need to fulfill their sub-orders | MEDIUM | Vendor sees only their sub-orders from split orders |
| Returns and refund handling (receive, accept/reject, initiate refund) | Part of real marketplace operations | HIGH | Policy enforcement + refund trigger to wallet or gateway |
| Store profile (name, logo, banner, bio, policies) | Store identity; customers see this | LOW | Simple profile form; image uploads |
| Wallet / payout visibility (earnings, commission deductions, payout history) | Vendor must trust the money math | MEDIUM | Read-only ledger plus payout breakdown; withdrawal request trigger optional |
| Notifications (new order, low stock, payout, message) | Real-time awareness without polling | LOW | Push-ready event hooks; email fallback via Google SMTP |
| Basic analytics (sales trend, top products, revenue by period) | Vendors make decisions from data | MEDIUM | Aggregation queries on order/commission tables |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Vendor role-based access (owner + staff with scoped permissions) | Larger vendors have staff; permission scoping reduces risk | MEDIUM | Role table; permission bitmask or list; admin assigns |
| Promotions and coupon creation (if feature-flagged on) | Vendors run their own deals | MEDIUM | Coupon entity; vendor-scoped; simple v1 rules only |
| Reviews / Q&A management (view reviews, flag spam, respond) | Trust management; vendor reputation | LOW | v1 supports display/read visibility only; response and moderation flows deferred to v1.x |
| Vendor-specific storefront settings (shipping policy, return policy text) | Buyers need to see vendor policies | LOW | Text fields on vendor profile; displayed on PDP vendor section |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Live chat with customers | Vendors want direct buyer communication | Full messaging infra out of scope (see storefront anti-features) | Order status notes + email notifications cover core communication |
| Social media feed integration for vendor stores | Marketing feature | Out of scope for a marketplace OS; adds no operational value | Vendor can share product URLs externally |
| Custom domain per vendor store | Powerful for SaaS marketplaces | Multi-tenancy DNS complexity; out of scope for a physical product marketplace starter | Vendor has a profile page at /store/:slug |

---

## 7. Admin Panel

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Admin dashboard (platform KPIs: GMV, orders, vendors, customers) | Operating blind without overview | LOW | Read aggregations from main tables |
| Category management (full CRUD + attribute/filter schema builder) | Core category engine; critical for multi-category value | HIGH | Most complex admin module; see category engine section |
| Vendor management (view, approve, suspend, configure commissions) | Admin must control who sells | MEDIUM | Approval workflow; commission override per vendor |
| Catalog moderation (approve/reject vendor product listings) | Quality control; optional but expected in managed marketplaces | MEDIUM | Listing status: draft → pending → approved/rejected |
| Commission engine configuration (global, per-category, per-vendor) | Admin earns from platform; must configure revenue model | HIGH | Commission rule priority chain |
| Payout management (view vendor earnings, trigger payouts, mark paid) | Admin reconciles finances | MEDIUM | Payout queue; status tracking; line-item audit trail required |
| Orders management (view all orders, filter, status tracking) | Platform-wide order oversight | MEDIUM | Admin sees all sub-orders across all vendors |
| CMS / content blocks (homepage banners, category promos, announcement bar) | Admin controls marketing without code | MEDIUM | Block type registry; JSON content; storefront renders |
| Global settings (platform name, currency, tax rate, marketplace policies) | Buyers must configure for their market | LOW | Key-value config table; env override |
| Integrations setup (payment provider keys, SMTP, Google Places API key) | Buyers must point to their own accounts | MEDIUM | Credential storage (encrypted); per-integration form |
| Theme / branding settings (colors, fonts, logo, favicon) | Rebranding is core buyer expectation | MEDIUM | Design token overrides; buyer applies via admin without code edit |
| Analytics and reporting (sales, vendors, categories, customers) | Admin needs business intelligence | HIGH | Aggregation queries; date range; CSV export |
| User role management (admin roles: super-admin, staff) | Multi-admin scenarios; permission scoping | MEDIUM | RBAC on admin panel; route-level guards |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Feature flag management (enable/disable: wallet, coupons, reviews, Q&A, tracking mode) | Buyers configure platform behavior without touching code | MEDIUM | Feature flag table or config file; UI toggle per flag |
| Tracking mode toggle (live vs demo/simulation) | Buyers without live logistics provider still get a working demo | LOW | Config flag; simulation generates fake tracking events |
| Vendor category restriction management | Admin controls what each vendor can sell | MEDIUM | Many-to-many assignment UI |
| Audit log for admin actions | Accountability and debugging for marketplace operators | MEDIUM | Event log table; action, actor, timestamp, payload diff |
| Bulk product approval / rejection | Manages catalogs at scale | LOW | Checkbox multi-select + batch action in moderation list |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Built-in email marketing / newsletter tool | Admin wants to retain customers | Separate product category (Mailchimp, Klaviyo); adds significant scope | Google SMTP handles transactional; document Mailchimp webhook integration as extension |
| Multi-language / i18n in admin | Global deployments need localization | Doubles UI work; can be layered on top with i18next after v1 | English-first; document i18n extension path |
| A/B testing framework in admin | Conversion optimization | Separate domain; out of scope | Feature flags + external analytics can serve this purpose |
| Multi-currency support | International marketplaces | Significant financial complexity (FX rates, display vs settlement currency, rounding) | Single currency configured at install time; document as planned v2 feature |

---

## 8. Mobile App (React Native Customer App)

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Auth and onboarding screens (signup, login, password reset) | Gate to personalized experience | LOW | Mirrors web auth API |
| Home screen (banners, featured categories, featured products) | First impression; mirrors web homepage | MEDIUM | Shared API; mobile-specific layout |
| Category browsing (category list → subcategory → PLP) | Primary discovery path on mobile | MEDIUM | Tree navigation; shared category API |
| Search with suggestions and filter chips | Mobile search is more critical than desktop | HIGH | Same OpenSearch/ES API; mobile-optimized UI |
| Product detail page (images carousel, attributes, price, add-to-cart) | Core transaction screen | MEDIUM | Same product API; swipeable image gallery |
| Cart and checkout (review cart, address, payment, confirm) | Core transaction flow | HIGH | Same checkout API; native payment sheet where applicable |
| Wallet (balance, top-up, transaction history) | Matches web wallet | MEDIUM | Same wallet API |
| Orders and tracking (order list, order detail, tracking timeline) | Customer expects mobile access to orders | MEDIUM | Same orders API; tracking timeline component |
| Profile and saved addresses (edit profile, manage addresses) | Returning customer management | LOW | Same customer API |
| Google Places autocomplete for address entry | Prevents address entry friction on mobile keyboard | LOW | React Native Google Places SDK |
| Push notification readiness (event hooks wired, provider integration documented) | Mobile without push notifications misses retention opportunity | LOW | Events emitted; FCM/APNs wiring deferred per project brief |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Shared API contracts and types with web | Single source of truth; buyers maintain one backend | HIGH | Core architectural requirement; TypeScript interfaces in shared package |
| React Native Animated / Reanimated micro-interactions | Premium feel; comparable to Framer Motion on web | MEDIUM | Swipe gestures, skeleton loaders, cart animation |
| Offline cart persistence | Allows adding to cart without connectivity | LOW | AsyncStorage / MMKV; sync on reconnect |
| Deep linking to product and category pages | Enables marketing links from email/SMS to open correct app screen | MEDIUM | React Navigation deep link config |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Vendor app (separate) | Vendors want mobile management | Separate app scope; dedicated delivery/driver app also excluded per brief | Vendors use responsive vendor web panel on mobile browser |
| In-app purchase (App Store / Google Play billing) | Native payment for digital | Not applicable for physical goods; Apple/Google IAP is for digital content only | Stripe/Razorpay web checkout flow is correct for physical goods |
| AR product try-on / 3D viewer | Trend feature for fashion/furniture | Enormous complexity; device capability fragmentation | High-quality image gallery with zoom covers the requirement |
| Full offline mode (catalog cached locally) | Works without internet | Massive sync complexity; catalog is dynamic and large | Offline cart + graceful loading states is sufficient |

---

## 9. Fulfillment & Tracking

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| Order status timeline (placed → confirmed → packed → shipped → delivered) | Buyers need to know where their order is | MEDIUM | Status enum + timestamp log per sub-order |
| Vendor updates order status (mark confirmed, packed, shipped) | Vendors fulfill; must be able to advance status | LOW | Vendor panel action; triggers notification event |
| Tracking number input by vendor | Vendor provides carrier tracking number | LOW | Simple field on sub-order; displayed to customer |
| Admin override of order status | Edge cases; disputes; corrections | LOW | Admin-only action in order detail |
| Notification events on status change | Keeps customer informed without polling | LOW | Event hooks → Google SMTP email; push-ready events for app |
| Configurable tracking mode (live vs simulation/demo) | Buyers without live logistics still get a working demo | LOW | Config flag; simulation mode auto-advances status on timer |
| Serviceability check at checkout | Prevents orders to unserviceable zones | MEDIUM | Vendor or admin defines serviceable areas; checked at checkout |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Map shell for tracking (simulated pin movement in demo mode) | Visual delight; makes demo compelling for buyers | MEDIUM | React Native Maps + web map embed; static or animated in simulation |
| Google Places-integrated delivery address validation | Ensures delivery address is valid before dispatch | LOW | Reuses Google Places API already in stack |
| Delivery ETA placeholder contract | Gives future live-tracking providers a stable interface | LOW | Expose ETA field even in simulation mode |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Real-time GPS driver tracking | Impressive demo and customer trust | Requires a driver app, live location streaming, battery/permission handling, and map infra | Timeline + simulation mode provide sufficient v1 demo quality |
| Carrier auto-sync integrations | Buyer wants shipment status automation | Every carrier adds provider-specific complexity and support overhead | Manual tracking number input + extensible tracking provider interface |
| Delivery route optimization | Useful for managed fleets | Different product category; operational software, not starter-kit baseline | Out of scope |

---

## 10. Productization & Envato Readiness

### Table Stakes

| Feature | Why Expected | Complexity | Notes |
|---------|-------------|------------|-------|
| `.env.example` files for root + each app | Buyers need predictable configuration | LOW | No hardcoded secrets anywhere |
| Installation guide | Envato buyers expect step-by-step setup | MEDIUM | Assume zero prior project context |
| Rebranding guide | Core value proposition of a commercial starter kit | LOW | Logos, colors, fonts, names, favicons, package rename notes |
| Payment integration guide | Buyers must connect Stripe/Razorpay safely | LOW | Explain webhooks, test mode, callback URLs |
| Google SMTP / Places setup docs | Required for email and address UX | LOW | Include quota/key restrictions guidance |
| Seed data / demo preset switching guide | Critical to the sales/demo experience | MEDIUM | Explain importer and reset flow |
| CHANGELOG.md and upgrade notes | Buyers need upgrade confidence | LOW | Include migration instructions |
| Preview assets from real demo | Envato expectation | LOW | Screenshots must match actual build |

### Differentiators

| Feature | Value Proposition | Complexity | Notes |
|---------|------------------|------------|-------|
| Demo preset pack (grocery, electronics, furniture, party supplies, tools) | Shows category-engine flexibility instantly | HIGH | Requires seed importer and curated data |
| Feature-flagged demo modes | Buyer can show rich flows without live providers | MEDIUM | Wallet, tracking simulation, coupons, reviews visibility |
| Reusable branding token system | Makes the kit feel productized, not one-off | MEDIUM | Shared design tokens across web apps |

### Anti-Features

| Feature | Why Requested | Why to Avoid in v1 | Alternative |
|---------|--------------|-------------------|-------------|
| Auto-updater / one-click update system | Easy upgrades for buyers | Extremely complex; code conflicts during update are buyer's responsibility; Envato products are delivered as ZIP | Standard CHANGELOG.md + migration notes per version |
| SaaS dashboard for buyers (license key, update portal) | Managed experience | Separate product; Envato handles licensing | Envato handles license validation; not the kit's responsibility |
| Video walkthrough embedded in admin | Onboarding experience | Out of scope; buyers expect static docs + comments in code | Written docs + inline code comments serve the same purpose |
| Per-buyer customization service | Premium support tier | Freelance/agency service, not a product feature | Include a "customization guide" in docs; point buyers to hire a developer |

---

## Feature Dependencies

```text
Category Engine (attribute schemas, filter schemas, product templates)
    └──required by──> Category Landing Pages (filter panel rendering)
    └──required by──> Product Listing Page (dynamic filters)
    └──required by──> Product Detail Page (dynamic attribute display)
    └──required by──> Vendor Product Create Form (dynamic fields)
    └──required by──> Search Facets (filter schema drives ES/OS facets)
    └──required by──> Demo Presets (each preset defines its own category tree)

Auth (signup, login, JWT)
    └──required by──> Customer Profile, Orders, Wishlist, Wallet
    └──required by──> Vendor Panel (all modules)
    └──required by──> Admin Panel (all modules)

Basket / Cart
    └──required by──> Checkout
    └──required by──> Multi-vendor order splitting

Checkout Reservation Layer
    └──required by──> Safe inventory allocation under concurrency
    └──required by──> Payment success/failure release semantics

Order Placement + Backend Splitting
    └──required by──> Commission Engine (commissions calculated at split)
    └──required by──> Vendor sub-order management
    └──required by──> Payout Records (earnings per vendor per order)
    └──required by──> Order Tracking (tracking operates on sub-orders)

Payment Provider Abstraction (Stripe + Razorpay)
    └──required by──> Checkout (payment step)
    └──required by──> Wallet top-up
    └──required by──> Refund processing

Wallet (ledger-first, cached balance optional)
    └──required by──> Wallet as checkout payment method
    └──required by──> Refund to wallet
    └──required by──> Cashback / credit issuance

Google SMTP
    └──required by──> All transactional email (signup, order, payout, password reset)

Google Places API
    └──required by──> Checkout address entry (web + mobile)
    └──required by──> Delivery serviceability check

Commission Engine
    └──required by──> Payout Records
    └──required by──> Vendor earnings display
    └──required by──> Admin payout management

Seed Data Importer
    └──required by──> Demo Presets (each preset is a seed dataset)
    └──required by──> Preview assets (screenshots generated from seeded state)

Feature Flags
    └──enhances──> Wallet (can be disabled for simpler deployments)
    └──enhances──> Coupons / promotions (simple v1 ruleset)
    └──enhances──> Reviews visibility (display-only in v1)
    └──enhances──> Tracking mode (live vs simulation)

Design Tokens / Theme Config
    └──required by──> Admin branding settings (token overrides at runtime)
    └──required by──> Rebranding Guide (buyer doc references token file)
```

### Key Dependency Notes

- **Category Engine must come before Storefront, Vendor Panel, and Search.** The attribute/filter schema is the spine of the entire product. Without it, PLPs have static filters, PDPs have hardcoded attributes, and vendor product forms are one-size-fits-all — none of which demonstrate the platform's core value.
- **Inventory reservation must be modeled before live checkout.** Safe reservation semantics are part of commerce correctness, not an optimization.
- **Order splitting must come before Commission and Payout.** Commissions are applied at split time; payouts operate on the resulting vendor earnings records.
- **Payment Abstraction must be architected at Commerce Core, not retrofitted.** Adding a second provider later (e.g., adding Razorpay after Stripe is wired directly) is expensive. The abstraction must be present from Phase 4.
- **Seed Data Importer is a blocking dependency for Demo Presets.** The presets are data, not code; the importer is the mechanism to load them.
- **Feature flags should be an architecture decision in Phase 1, not an afterthought.** Even a simple boolean feature-flag table or config object enables all subsequent modules to be toggled without code changes, which is the core buyer value proposition.

---

## MVP Definition (v1 Starter Kit)

### Must Ship in v1

- [ ] Category engine (CRUD, attribute schemas, filter schemas, product templates) — without this, multi-category value is absent
- [ ] Customer storefront (homepage, category pages, PLP with dynamic filters, PDP, search) — proof of concept for buyers evaluating the kit
- [ ] Auth (signup, login, password reset) — gates all personalized functionality
- [ ] Basket + checkout + order placement with multi-vendor splitting — the transaction; the whole reason the platform exists
- [ ] Inventory reservation model at checkout — prevents oversell and establishes safe commerce behavior
- [ ] Stripe integration with payment abstraction designed for Stripe + Razorpay — payments are blocking, abstraction is mandatory
- [ ] Wallet (balance, ledger, refund to wallet, checkout payment option) — brief explicitly requires this
- [ ] Vendor panel (onboarding, product management with dynamic forms, orders, earnings/payout view) — vendors are required for a working marketplace demo
- [ ] Admin panel (category management, vendor management, commission config, payout management, CMS, branding, feature flags, settings) — the operating system of the marketplace
- [ ] Commission engine (global + per-category + per-vendor rules) — revenue model for the marketplace operator
- [ ] Simple coupon engine (optional by feature flag, but implemented in v1) — basic discounting without campaign complexity
- [ ] Order tracking with timeline and simulation/demo mode — required for demo quality
- [ ] Google SMTP transactional email — communications backbone
- [ ] Google Places autocomplete — address entry in checkout
- [ ] React Native customer app (all modules listed in section 8) — the brief explicitly includes this in v1 scope
- [ ] Demo presets x5 (grocery, electronics, furniture, party supplies, tools) — the sales argument for the kit
- [ ] Seed data importer — unlocks demo presets
- [ ] `.env.example` files + install guide + rebranding guide + integration docs — makes the kit sellable on Envato

### Add After v1 (v1.x)

- [ ] Automated Stripe Connect payout to vendor bank accounts — reduce admin manual work
- [ ] Automated Razorpay Route vendor disbursement — India-market payout automation
- [ ] Product reviews and ratings submission + moderation — trust layer for live deployments
- [ ] Q&A on product pages — pre-purchase trust
- [ ] Wishlist / save for later — retention feature if not completed in v1
- [ ] Social login (Google OAuth) — reduced auth friction
- [ ] Cashback campaigns / credit rules — loyalty feature; wallet foundation is v1
- [ ] Push notification provider wiring (FCM / APNs) — push hooks are v1; provider wiring is v1.x

### Future Consideration (v2+)

- [ ] Multi-currency support — significant financial complexity
- [ ] Semantic / AI-powered search — requires meaningful catalog data first
- [ ] Real-time GPS order tracking with driver app — separate application scope
- [ ] In-app notification inbox — requires real-time infra
- [ ] Multi-language / i18n — layerable on top of v1 foundation

---

## Feature Prioritization Matrix

| Feature | User Value | Implementation Cost | Priority |
|---------|------------|---------------------|----------|
| Category engine (attribute + filter schemas) | HIGH | HIGH | P1 |
| Customer storefront with dynamic filters | HIGH | HIGH | P1 |
| Checkout + multi-vendor order splitting | HIGH | HIGH | P1 |
| Inventory reservation model | HIGH | HIGH | P1 |
| Payment provider abstraction (Stripe + Razorpay) | HIGH | HIGH | P1 |
| Vendor panel (product + orders + earnings) | HIGH | HIGH | P1 |
| Admin panel (category + vendor + commissions + settings) | HIGH | HIGH | P1 |
| Commission engine | HIGH | HIGH | P1 |
| Customer wallet (balance, ledger, checkout, refund) | HIGH | MEDIUM | P1 |
| React Native customer app | HIGH | HIGH | P1 |
| Demo presets + seed data importer | HIGH (for saleability) | HIGH | P1 |
| Productization docs + .env.example | HIGH (for saleability) | LOW | P1 |
| Search with faceted filters | HIGH | HIGH | P1 |
| Order tracking (with simulation mode) | MEDIUM | MEDIUM | P1 |
| Google SMTP transactional email | HIGH | LOW | P1 |
| Google Places autocomplete | MEDIUM | LOW | P1 |
| Admin branding / theme settings | HIGH (for rebrand) | MEDIUM | P1 |
| Feature flags architecture | HIGH (for configurability) | LOW | P1 |
| Simple coupon engine | MEDIUM | MEDIUM | P1 |
| Product reviews display | MEDIUM | LOW | P2 |
| Reviews submission + moderation | MEDIUM | MEDIUM | P2 |
| Wishlist | MEDIUM | LOW | P2 |
| Serviceability check at checkout | MEDIUM | MEDIUM | P2 |
| Automated vendor payouts (Stripe Connect / Razorpay Route) | MEDIUM | HIGH | P2 |
| Cashback campaigns | LOW | MEDIUM | P3 |
| Social login | LOW | LOW | P3 |
| Multi-currency | LOW | HIGH | P3 |
| AI-powered recommendations | LOW | HIGH | P3 |
