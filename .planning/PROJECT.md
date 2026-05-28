# Grovio

## What This Is

Grovio is a configurable, multi-category, multi-vendor marketplace platform for physical products, built as a commercially sellable starter kit (targeting Envato). It ships as a product suite: a customer web storefront, a web admin panel, a web vendor panel, a React Native customer app, and a single shared backend. Buyers can rebrand, reconfigure, and adapt it to many verticals — grocery, furniture, electronics, party decorations, tools, home/kitchen, beauty, office, pet supplies, and admin-defined future categories — without major code rewrites.

## Core Value

A buyer can rebrand and reconfigure the entire marketplace for a new product vertical — categories, attributes, filters, branding, and integrations — without rewriting core code. Configurability and buyer usability are the product; the marketplace features are the proof.

## Requirements

### Validated

<!-- Shipped and confirmed valuable. -->

(None yet — ship to validate)

### Active

<!-- Current scope. Building toward these. Hypotheses until shipped. -->

- [ ] Monorepo foundation: shared packages, backend skeleton, web app shells (storefront/admin/vendor), React Native shell, design tokens/branding config, linting/formatting/testing/CI
- [ ] Category engine: category CRUD, subcategory tree, per-category attribute schemas, per-category filter schemas, product templates, merchandising settings, vendor-category restrictions
- [ ] Customer storefront: homepage, category landing pages, search with suggestions + filter chips, dynamic category-specific filters, product listing + detail pages, Framer Motion interactions, responsive/mobile-first behavior
- [ ] Commerce core: basket management, checkout flow, address handling, Stripe/Razorpay payment abstraction, wallet base, order placement + confirmation, multi-vendor single-order splitting
- [ ] Vendor & admin marketplace tools: vendor onboarding, vendor dashboard/product/inventory/pricing/orders/returns, commission engine, payout records, admin moderation/approval, category/attribute/CMS/settings/integrations/branding/analytics modules, vendor roles & permissions
- [ ] React Native customer app: auth/onboarding, home, category browsing, search + filters, product detail, cart + checkout, wallet, orders + tracking, profile + saved addresses, Google Places
- [ ] Fulfillment & communication: Google Places autocomplete, delivery/serviceability logic, tracking timeline + map shell (live or demo/simulation mode), Google SMTP transactional email, push-ready notification events
- [ ] Productization & release: demo presets (grocery, electronics, furniture, party supplies, tools), seed data importer, buyer/install/rebranding/integration documentation, preview assets, QA + packaging

### Out of Scope

<!-- Explicit boundaries with reasoning to prevent re-adding. -->

- Digital / downloadable products — platform targets physical-product marketplaces only
- Dedicated delivery/driver application — fulfillment/delivery is an optional later-stage role, not a first-class app in this milestone
- Full push-notification delivery infrastructure — only push-ready event structure is in scope; wiring a provider (FCM/APNs) is deferred
- Native (non-React-Native) iOS/Android apps — mobile is React Native to share contracts with web
- Real-time chat / messaging — not core to marketplace value; not in the brief

## Context

- **Commercial product for sale.** Intended for Envato or similar. Envato's technical bar — organized, editable, understandable, well-documented files — is treated as a core product goal, not an afterthought. Codebase, config model, docs, demo data, and install process are all optimized for buyer usability and easy customization.
- **Greenfield monorepo.** No existing code; starting from scratch.
- **Multi-platform suite.** Web (storefront, admin, vendor) + React Native mobile + shared Node backend, with shared API contracts and types across platforms.
- **Configuration-first.** Nothing hardcoded to a single vertical (e.g., not grocery-only). Admin defines categories, attributes, filters, and templates at runtime.
- **Demo-driven sales.** Multiple demo presets (grocery, electronics, furniture, party supplies, tools) demonstrate flexibility to prospective buyers.

## Constraints

- **Tech stack (web)**: React + TypeScript + Vite + Tailwind CSS + React Query + Zustand + Framer Motion — stated buyer-facing direction; premium UI/UX and animation are product requirements
- **Tech stack (mobile)**: React Native + TypeScript + React Query + Zustand + React Navigation — shares contracts/state patterns with web
- **Tech stack (backend)**: Node.js + TypeScript + PostgreSQL + Redis + OpenSearch/Elasticsearch + Zod — domain-driven, modular
- **Architecture**: Shared backend; separate web/mobile UI layers; shared API contracts/types; backend-authoritative pricing, wallet, order totals, commissions, payouts; feature-flag-friendly; demo-data support — required so buyers can trust totals and toggle features
- **Payments**: Stripe + Razorpay behind a provider abstraction — buyers enable one or both
- **Email**: Google SMTP for all transactional email (signup, reset, order/payout updates)
- **Addressing**: Google Places autocomplete for checkout/delivery address handling
- **Non-functional**: Strong typing, clean architecture, scalable module boundaries, good performance, responsive + accessibility-conscious UI, easy local setup
- **Productization deliverables**: `.env.example` files, setup/install/rebranding/integration docs, seed-data importer, preview assets/screenshots, support-friendly file organization

## Key Decisions

<!-- Decisions that constrain future work. Add throughout project lifecycle. -->

| Decision | Rationale | Outcome |
|----------|-----------|---------|
| Monorepo with shared packages | Share API contracts/types across web, mobile, backend; single source of truth | — Pending |
| Configuration-first, feature-flag-friendly architecture | Buyers must adapt to new verticals without code rewrites (core value) | — Pending |
| Category engine with per-category attribute/filter/template schemas | Platform must not be hardcoded to grocery; admin defines categories at runtime | — Pending |
| Payment provider abstraction (Stripe + Razorpay) | Buyers enable one or both without touching core checkout | — Pending |
| Backend-authoritative pricing/wallet/totals/commissions/payouts | Trust and correctness for multi-vendor money flows | — Pending |
| Multi-vendor single-order with backend splitting | Customers expect one cart across vendors; backend handles splits/commissions/payouts | — Pending |
| Configurable tracking (live vs demo/simulation mode) | Buyers without a live logistics provider still get a working demo | — Pending |
| Horizontal-layer roadmap (foundation → engine → storefront → commerce → tools → mobile → fulfillment → productization) | Infrastructure-heavy, multi-platform starter kit benefits from complete capability layers | — Pending |

## Evolution

This document evolves at phase transitions and milestone boundaries.

**After each phase transition** (via `/gsd-transition`):
1. Requirements invalidated? → Move to Out of Scope with reason
2. Requirements validated? → Move to Validated with phase reference
3. New requirements emerged? → Add to Active
4. Decisions to log? → Add to Key Decisions
5. "What This Is" still accurate? → Update if drifted

**After each milestone** (via `/gsd-complete-milestone`):
1. Full review of all sections
2. Core Value check — still the right priority?
3. Audit Out of Scope — reasons still valid?
4. Update Context with current state

---
*Last updated: 2026-05-28 after initialization*
