# Phase 1: Foundation - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 1-Foundation
**Mode:** --analyze (trade-off tables presented for each question)
**Areas discussed:** Shared contracts + config architecture (packages/contracts scope, feature-flag service boundary, env structure, MarketplaceConfig schema)

---

## packages/contracts Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Foundational forward-lean | Health-check, feature-flag, auth shapes, request/response envelope, money utils, minimal MarketplaceConfig | ✓ |
| Lean — Phase 1 only | Only health-check and feature-flag types | |
| Full skeleton | Pre-scaffold all future domain namespaces as empty modules | |

**User's choice:** Foundational forward-lean
**Notes:** Money utils and config schema are non-negotiable across every phase. Domain contracts (orders, products) deferred to their phase.

---

## Feature-Flag Service Boundary

| Option | Description | Selected |
|--------|-------------|----------|
| Service + DB + cache + seeded defaults + toggle API | Full infrastructure + pre-seeded known flags + PATCH endpoint for dev | |
| Service + DB + cache only | Infrastructure only; flags toggled via DB seed/migration during development | ✓ |
| Full admin UI | Complete admin panel for feature flags | |

**User's choice:** Service + DB + cache only
**Notes:** No toggle API or admin UI in Phase 1. Flags managed via DB during development. Admin UI is Phase 6 scope.

---

## .env.example Structure

| Option | Description | Selected |
|--------|-------------|----------|
| Root shared + per-app | Root has infrastructure vars; each app has app-specific vars | ✓ |
| Per-app only | Each app fully self-contained, no root file | |
| Single root file | One file at repo root listing all vars | |

**User's choice:** Root shared + per-app
**Notes:** Root covers DB, Redis, JWT, Google, SMTP. Per-app covers VITE_API_URL, EXPO_PUBLIC_API_URL, ports etc.

---

## MarketplaceConfig Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Minimal config now, extend in Phase 5 | { currency, locale, activePaymentProviders[] } — non-breaking to extend | ✓ |
| Full config schema upfront | All known fields across all phases defined now | |
| No shared config type in Phase 1 | Defer until a consuming phase needs it | |

**User's choice:** Minimal config now, extend in Phase 5
**Notes:** Covers what Phase 2–4 needs without over-specifying the commerce config. Phase 5 extends.

---

## Claude's Discretion

- Monorepo directory/package naming conventions
- Backend internal module structure (Fastify + Awilix setup, plugin registration, health-check routing)
- Local dev services approach (Docker Compose vs manual)
- React Native Metro workspace resolution strategy
- Branding/design-token architecture (Tailwind v4 @theme vs CSS custom properties)

## Deferred Ideas

- Feature-flag toggle API — useful dev convenience but out of Phase 1 scope
- Pre-seeded default flag values — deferred to Phase 2–5 migrations as needed
- Full MarketplaceConfig extension — Phase 5 (commerce config, wallet, checkout settings)
- Feature-flag admin UI — Phase 6 (ADM-06)
