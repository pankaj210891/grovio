<!-- GSD:project-start source:PROJECT.md -->
## Project

**Grovio**

Grovio is a configurable, multi-category, multi-vendor marketplace platform for physical products, built as a commercially sellable starter kit (targeting Envato). It ships as a product suite: a customer web storefront, a web admin panel, a web vendor panel, a React Native customer app, and a single shared backend. Buyers can rebrand, reconfigure, and adapt it to many verticals — grocery, furniture, electronics, party decorations, tools, home/kitchen, beauty, office, pet supplies, and admin-defined future categories — without major code rewrites.

**Core Value:** A buyer can rebrand and reconfigure the entire marketplace for a new product vertical — categories, attributes, filters, branding, and integrations — without rewriting core code. Configurability and buyer usability are the product; the marketplace features are the proof.

### Constraints

- **Tech stack (web)**: React + TypeScript + Vite + Tailwind CSS + React Query + Zustand + Framer Motion — stated buyer-facing direction; premium UI/UX and animation are product requirements
- **Tech stack (mobile)**: React Native + TypeScript + React Query + Zustand + React Navigation — shares contracts/state patterns with web
- **Tech stack (backend)**: Node.js + TypeScript + PostgreSQL + Redis + OpenSearch/Elasticsearch + Zod — domain-driven, modular
- **Architecture**: Shared backend; separate web/mobile UI layers; shared API contracts/types; backend-authoritative pricing, wallet, order totals, commissions, payouts; feature-flag-friendly; demo-data support — required so buyers can trust totals and toggle features
- **Payments**: Stripe + Razorpay behind a provider abstraction — buyers enable one or both
- **Email**: Google SMTP for all transactional email (signup, reset, order/payout updates)
- **Addressing**: Google Places autocomplete for checkout/delivery address handling
- **Non-functional**: Strong typing, clean architecture, scalable module boundaries, good performance, responsive + accessibility-conscious UI, easy local setup
- **Productization deliverables**: `.env.example` files, setup/install/rebranding/integration docs, seed-data importer, preview assets/screenshots, support-friendly file organization
<!-- GSD:project-end -->

<!-- GSD:stack-start source:research/STACK.md -->
## Technology Stack

## Recommended Stack
### Monorepo Tooling
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| pnpm | 9.x (latest) | Package manager + workspace protocol | Strictest peer-dep enforcement, symlink-safe node_modules, `workspace:*` for local refs, fastest install times in a large workspace |
| Turborepo | 2.9.x | Build orchestration, remote caching, task graph | Vercel-backed, Rust-written, minimal config. Adds smart build ordering and affected-package execution on top of pnpm workspaces without replacing them. Aligns with ARCHITECTURE.md monorepo layout |
### Core Backend
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Node.js | 22 LTS | Backend runtime | Active LTS, `require(esm)` flag-free, required by Razorpay SDK (>=22.2), aligns with Fastify v5 and Vite 8 requirements |
| TypeScript | 5.8.x | Type safety across the monorepo | Strict mode; project references for incremental compilation across packages |
| Fastify | 5.8.x | HTTP server / API framework | ~76k req/s throughput, schema-based validation pipeline, first-class TypeScript plugin system, `@fastify/awilix` integration available. Chosen over Express: Express 4 is maintenance-only and Express 5 is still early; Fastify v5 is production-stable |
| Zod | 4.4.x | Request validation, shared API schemas in contracts | Zod 4 is now stable, 20% smaller bundle, tree-shakeable; lives in `packages/contracts` so backend and clients share the same schemas. Required by brief |
| Awilix | 13.0.x | Dependency injection container | No decorator metadata (`reflect-metadata`) required; pure function-based registration; strict mode available; `@fastify/awilix` plugin for scoped request containers. Cleaner than tsyringe for backend-only DI where decorators add build complexity |
| Drizzle ORM | 0.45.x + drizzle-kit 1.0.0-beta.x | Database access layer, migration management | TypeScript-first, zero `any` in query results, full JSONB support for product attributes, BIGINT columns for all money fields (matches PITFALLS.md), GIN index support, SQL-transparent so complex queries stay readable. Alternative to Prisma: Prisma's JSONB support is less ergonomic and it adds a query engine binary |
### Database & Storage
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| PostgreSQL | 16+ | Primary relational store | JSONB + GIN indexes for dynamic product attributes (as specified in ARCHITECTURE.md), BIGINT for all money columns, row-level locking for inventory reservations |
| Redis | 7.x | Caching, session store, BullMQ transport, feature flags | Confirmed by ARCHITECTURE.md for config cache, session, feature flag cache, and job queue; required by BullMQ |
| BullMQ | 5.77.x | Background job queue (inventory expiry, webhook retry, email dispatch, search reindex) | Redis-backed, TypeScript-native, exactly-once semantics with idempotency guards. Required for async processing flagged in ARCHITECTURE.md (inventory reservation expiry, notification dispatch) |
| ioredis | 5.11.x | Redis client (used internally by BullMQ) | BullMQ's default Redis adapter; battle-tested, full pipelining, cluster/sentinel support. Note: node-redis (v5) is the newer official client, but ioredis is still the BullMQ default and more stable for this use case |
### Search
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| OpenSearch | 2.x (self-hosted) | Full-text product search, faceted filtering | **Chosen over Elasticsearch.** Apache 2.0 license (no SSPL/commercial concerns for a starter kit sold to buyers); security features (RBAC, TLS) free in OSS build; Linux Foundation governance since Sept 2024. Performance gap vs Elasticsearch is measurable but inconsequential for marketplace search at typical starter kit scale |
| @opensearch-project/opensearch | 3.6.x | Node.js client | Official OpenSearch client; auto-updated weekly against OpenSearch API spec |
### Payments
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| stripe (Node SDK) | 22.2.x | Stripe payment collection and refunds | Official SDK; full TypeScript types; current Stripe API version 2026-05-27 |
| razorpay (Node SDK) | 2.9.6 | Razorpay payment collection and refunds | Official SDK; TypeScript definitions included; requires Node.js >=22.2 (aligns with our runtime choice) |
### Money Arithmetic
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| Dinero.js | 2.x (alpha) | Intermediate monetary arithmetic | `allocate()` function handles split residuals correctly — essential for vendor commission splits and payout distribution. All DB columns remain BIGINT minor units; Dinero is used only at computation boundaries, never stored |
### Email
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| nodemailer | 8.0.x | Transactional email via Google SMTP | Zero dependencies, MIT No Attribution license, 15M+ weekly downloads, Node 6+ compatible; handles SMTP transport, attachment, HTML templates. Required by brief (Google SMTP for all transactional email) |
### Authentication
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| jose | 6.2.x | JWT signing, verification, key management | Web Crypto API-based; TypeScript-first; zero dependencies; supports RS256/ES256/HS256; works across Node, edge, and future service workers. Preferred over `jsonwebtoken` which relies on a deprecated sync API and is not actively maintained for new algorithms |
### Web Frontend (all three web apps)
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React | 19.2.x | UI framework | React 19 is stable; `ref` as prop, Server Actions groundwork, no `forwardRef` needed. Required by brief. Update to >=19.2.3 (CVE-2025-55182 patch) |
| Vite | 8.0.x | Build tool and dev server | Vite 8 uses Rolldown, Oxc for transforms, no Babel dependency, Node 20.19+/22.12+ required (aligned with our runtime). `@tailwindcss/vite` integrates directly |
| TypeScript | 5.8.x | Type safety | Shared config from `packages/config/tsconfig.react.json` |
| Tailwind CSS | 4.3.x | Utility-first styling | v4 is a ground-up rewrite: 5x faster full builds, 100x faster incremental, CSS-native config (`@import "tailwindcss"`), no `tailwind.config.js` required. Use `@tailwindcss/vite` plugin — do not use PostCSS path. Design tokens in `packages/ui/src/tokens/` |
| Motion (framer-motion) | 12.x | Animation and micro-interactions | Rebranded from `framer-motion`; import from `motion/react`; package is still published as `framer-motion@12.x`. No breaking changes. 120fps GPU-accelerated animations. Required by brief for premium UI/UX |
| @tanstack/react-query | 5.100.x | Server state management (API data fetching, caching, synchronization) | v5 is stable; ~20% smaller than v4; first-class Suspense support; required React 18+. Used for all API-derived state. Required by brief |
| Zustand | 5.0.x | Client-side global state (cart session, auth state, UI preferences) | Minimal boilerplate; React 19 compatible; used for ephemeral local state that does not belong in React Query. Required by brief |
### React Native App
| Technology | Version | Purpose | Why Recommended |
|------------|---------|---------|-----------------|
| React Native | 0.83.x | Mobile framework | 0.83 ships React 19.2; New Architecture stable |
| Expo (bare workflow) | SDK 53.x | Tooling, EAS build, Expo modules | Bare workflow gives full native access while retaining Expo SDK and EAS. React Native team officially recommends Expo as the starting point. Bare workflow is the right choice because buyers may need native customization |
| @react-navigation/native | 7.2.x | Navigation | v7 is the current stable; v8 alpha exists but use v7 for stability in a commercial product. Required by brief |
| @tanstack/react-query | 5.100.x | Server state (same version as web) | Shared query key conventions and response types with web via `packages/contracts` |
| Zustand | 5.0.x | Client state (cart, auth — same stores pattern as web) | Shared store factory patterns; platform-specific hydration |
| Motion (react-native-reanimated) | 3.x | Native animations | Expo bare includes react-native-reanimated. Use for native gesture-driven animations (shared element transitions, swipe interactions). `motion/react` is web-only; use `react-native-reanimated` on mobile |
### CI/CD
| Tool | Purpose | Why Recommended |
|------|---------|-----------------|
| GitHub Actions | CI pipeline (lint, typecheck, test, build) | Free for public repos, excellent marketplace ecosystem, native Turborepo remote cache support |
| Turborepo Remote Cache | Cache build artifacts across CI runs | Cuts CI time on large changesets; Vercel hosts it free for Turborepo projects |
| Vitest | 4.1.x | Unit and integration testing | Vite-native; no Babel; fast watch mode; Jest-compatible API so team friction is low; same config as Vite apps |
### Development Tools
| Tool | Purpose | Notes |
|------|---------|-------|
| ESLint 9.x | Linting | Flat config format; shared preset in `packages/config/eslint-preset.js` |
| Prettier 3.x | Formatting | Single config at repo root; enforced in CI |
| Drizzle Studio | Database browser | Ships with `drizzle-kit studio`; useful for demo data inspection |
| BullMQ Dashboard (bull-board) | Queue monitoring in dev | `@bull-board/fastify` — add as dev-only route behind auth flag |
## Installation Reference
# Root monorepo setup
# Backend (apps/api)
# Web apps (apps/web-storefront, web-admin, web-vendor — run per app)
# React Native (apps/mobile)
# Shared packages/contracts
## Alternatives Considered
| Category | Recommended | Alternative | Why Not |
|----------|-------------|-------------|---------|
| Monorepo orchestration | Turborepo | Nx | Nx has more opinions and heavier config; Turborepo is lighter and maps exactly to the pnpm workspace structure already required |
| HTTP framework | Fastify | Express | Express 4 is maintenance-only; Express 5 is early; Fastify v5 has better TypeScript support, schema-based request validation, and significantly higher throughput |
| ORM / query layer | Drizzle ORM | Prisma | Prisma adds a query engine binary and its JSONB support requires raw SQL workarounds; Drizzle is SQL-transparent and JSONB-native |
| ORM / query layer | Drizzle ORM | TypeORM | TypeORM has decorator-heavy patterns, slower query building, and weaker TypeScript inference |
| Search | OpenSearch | Elasticsearch | Elasticsearch SSPL license creates commercial uncertainty for buyers; OpenSearch Apache 2.0 is cleanest for a sellable product |
| Search | OpenSearch | Meilisearch / Typesense | Meilisearch and Typesense are simpler to operate but have weaker facet/filter control and less proven at larger product catalog scales; OpenSearch provides the filter schema → mapping pipeline that ARCHITECTURE.md requires |
| Auth tokens | jose | jsonwebtoken | `jsonwebtoken` uses a deprecated synchronous crypto API; jose uses Web Crypto API and has active maintenance |
| DI container | Awilix | InversifyJS / tsyringe | Both require `reflect-metadata` and decorator configuration which adds tsconfig complexity; Awilix is transparent to app code with no annotations required |
| Mobile tooling | Expo bare workflow | React Native CLI only | React Native CLI alone loses Expo SDK (camera, notifications, location, OTA updates) and EAS; bare workflow provides all native access while retaining the ecosystem |
| State management | Zustand | Redux Toolkit | RTK is heavier and better suited to very large teams; Zustand's minimal API is faster to set up and easier for buyers to understand and extend |
| Testing | Vitest | Jest | Jest requires Babel transform for ES modules in a Vite monorepo; Vitest is zero-config with Vite and faster |
| Money arithmetic | Dinero.js (v2 alpha) / BigInt | decimal.js / bignumber.js | Plain BigInt arithmetic with `packages/contracts/src/money/` allocation utils is the safest choice if v2 alpha stability is uncertain; the PITFALLS.md requirement is integer minor units in BIGINT columns — the library is secondary |
## What NOT to Use
| Avoid | Why | Use Instead |
|-------|-----|-------------|
| `FLOAT` / `DECIMAL` / `NUMERIC(12,2)` for money columns | Floating-point rounding causes commission and payout reconciliation drift at scale (PITFALLS.md Pitfall 1) | BIGINT minor units (paise/cents) everywhere |
| `jsonwebtoken` | Synchronous crypto API, not actively maintained for new algorithms | `jose` |
| Mongoose / MongoDB | PostgreSQL with JSONB + GIN is the architecture; switching stores mid-project is a rewrite | PostgreSQL + Drizzle ORM |
| EAV tables for product attributes | Query performance collapses under filter workloads (PITFALLS.md Pitfall 8) | JSONB column + GIN index + schema registry |
| Direct Stripe/Razorpay SDK calls in checkout or use-case code | Provider tight coupling causes checkout rewrites when adding the second provider (PITFALLS.md Pitfall 9) | `PaymentProvider` interface; SDK code in infrastructure adapters only |
| Webpack (for web apps) | Vite 8 / Rolldown is faster and better maintained for this stack | Vite 8 |
| NestJS | NestJS would work, but it adds heavy opinions (decorators, modules, providers) that increase buyer onboarding friction for a starter kit product; Fastify with Awilix gives clean architecture without a framework-imposed module structure | Fastify + Awilix + domain module layout |
| React Navigation v8 (alpha) | v8 is in alpha; commercial product should use stable v7 | `@react-navigation/native@7.x` |
| Tailwind CSS v3 | v3 uses PostCSS path; v4 integrates natively with Vite and is significantly faster | Tailwind CSS v4 + `@tailwindcss/vite` |
| Hardcoded provider selection in feature flags | Feature flags must be DB-backed and Redis-cached, not compile-time constants | `FeatureFlags` table + `ConfigService` with Redis cache (ARCHITECTURE.md Pattern 4) |
## Version Compatibility Matrix
| Package | Compatible With | Notes |
|---------|-----------------|-------|
| React 19.2.x | React Query 5.x, Zustand 5.x, Framer Motion 12.x | All confirmed React 19 compatible |
| Vite 8.x | Node.js 20.19+ or 22.12+ | Requires ESM-capable Node; aligns with our Node 22 LTS choice |
| Tailwind CSS 4.x | `@tailwindcss/vite` plugin | Do NOT use PostCSS config; v4 plugin replaces it entirely |
| Fastify 5.x | Node.js 18+ | Our Node 22 LTS is compatible |
| Drizzle ORM 0.45.x | `drizzle-kit@beta` (1.0.0-beta.x) | Install kit with `@beta` tag; ORM stable tag is fine |
| Razorpay SDK 2.9.6 | Node.js >=22.2 | This is why we pin Node 22 LTS, not 20 |
| BullMQ 5.x | ioredis 5.x, Redis 7.x | Default adapter is ioredis; node-redis adapter available but not default |
| React Native 0.83.x | React 19.2, Expo SDK 53 | RN 0.83 ships React 19.2 internally; Expo SDK 53 targets 0.83 |
| @react-navigation/native 7.x | React Native 0.73+ | Compatible with RN 0.83 |
| Zod 4.x | TypeScript 5.x, Node.js 18+ | Zod 4 is stable release, not beta |
| jose 6.x | Node.js 20.19+/22.12+ for `require(esm)` | Use dynamic `import()` on older Node if needed |
## Sources
- [turbo - npm](https://www.npmjs.com/package/turbo) — version 2.9.15 confirmed
- [drizzle-orm - npm](https://www.npmjs.com/package/drizzle-orm) — version 0.45.2 confirmed; JSONB and BIGINT support verified
- [drizzle-kit - npm](https://www.npmjs.com/package/drizzle-kit) — 1.0.0-beta track confirmed
- [stripe - npm](https://www.npmjs.com/package/stripe) — version 22.2.0 confirmed, API 2026-05-27
- [razorpay - npm](https://www.npmjs.com/package/razorpay) — version 2.9.6 confirmed, Node >=22.2 requirement
- [fastify - npm](https://www.npmjs.com/package/fastify) — version 5.8.5 confirmed
- [bullmq - npm](https://www.npmjs.com/package/bullmq) — version 5.77.6 confirmed
- [ioredis - npm](https://www.npmjs.com/package/ioredis) — version 5.11.0 confirmed
- [nodemailer - npm](https://www.npmjs.com/package/nodemailer) — version 8.0.9 confirmed, zero dependencies
- [jose - npm](https://www.npmjs.com/package/jose) — version 6.2.3 confirmed, Web Crypto API based
- [zod - npm](https://www.npmjs.com/package/zod) — version 4.4.3 confirmed (Zod 4 stable)
- [react - npm](https://www.npmjs.com/package/react) — version 19.2.6 confirmed; CVE-2025-55182 patched in 19.2.3+
- [vite - npm](https://www.npmjs.com/package/vite) — version 8.0.14 confirmed, Rolldown/Oxc based
- [tailwindcss blog/tailwindcss-v4](https://tailwindcss.com/blog/tailwindcss-v4) — v4 Vite plugin confirmed
- [@tanstack/react-query - npm](https://www.npmjs.com/package/@tanstack/react-query) — version 5.100.14 confirmed
- [zustand - npm](https://www.npmjs.com/package/zustand) — version 5.0.13 confirmed
- [framer-motion - npm](https://www.npmjs.com/package/framer-motion) — version 12.40.0 confirmed; `motion/react` import path
- [@react-navigation/native - npm](https://www.npmjs.com/package/@react-navigation/native) — version 7.2.4 confirmed (v8 alpha available but not used)
- [@opensearch-project/opensearch - npm](https://www.npmjs.com/package/@opensearch-project/opensearch) — version 3.6.0 confirmed
- [OpenSearch vs Elasticsearch 2025 - Uptrace](https://uptrace.dev/comparisons/opensearch-vs-elasticsearch) — Apache 2.0 licensing rationale
- [awilix - npm](https://www.npmjs.com/package/awilix) — version 13.0.3 confirmed, no decorator metadata required
- [vitest - npm](https://www.npmjs.com/package/vitest) — version 4.1.7 confirmed
- [dinero.js GitHub](https://github.com/dinerojs/dinero.js) — v2 alpha; BigInt calculator available
- [Expo bare workflow docs](https://docs.expo.dev/bare/overview/) — bare workflow rationale
- [React Native blog RN 0.83](https://reactnative.dev/blog/2025/12/10/react-native-0.83) — RN 0.83 ships React 19.2
<!-- GSD:stack-end -->

<!-- GSD:conventions-start source:CONVENTIONS.md -->
## Conventions

Conventions not yet established. Will populate as patterns emerge during development.
<!-- GSD:conventions-end -->

<!-- GSD:architecture-start source:ARCHITECTURE.md -->
## Architecture

Architecture not yet mapped. Follow existing patterns found in the codebase.
<!-- GSD:architecture-end -->

<!-- GSD:skills-start source:skills/ -->
## Project Skills

No project skills found. Add skills to any of: `.claude/skills/`, `.agents/skills/`, `.cursor/skills/`, `.github/skills/`, or `.codex/skills/` with a `SKILL.md` index file.
<!-- GSD:skills-end -->

<!-- GSD:workflow-start source:GSD defaults -->
## GSD Workflow Enforcement

Before using Edit, Write, or other file-changing tools, start work through a GSD command so planning artifacts and execution context stay in sync.

Use these entry points:
- `/gsd-quick` for small fixes, doc updates, and ad-hoc tasks
- `/gsd-debug` for investigation and bug fixing
- `/gsd-execute-phase` for planned phase work

Do not make direct repo edits outside a GSD workflow unless the user explicitly asks to bypass it.
<!-- GSD:workflow-end -->



<!-- GSD:profile-start -->
## Developer Profile

> Profile not yet configured. Run `/gsd-profile-user` to generate your developer profile.
> This section is managed by `generate-claude-profile` -- do not edit manually.
<!-- GSD:profile-end -->
