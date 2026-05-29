# Phase 1: Foundation - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete mechanical foundation: all five apps (storefront, admin, vendor, React Native, backend) boot in a proven pnpm + Turborepo monorepo, shared type contracts are established in `packages/contracts`, the feature-flag infrastructure is wired (DB-backed + Redis-cached), a branding/design-token config exists, and CI enforces quality on every push. No business-logic features. Zero mechanical debt for Phase 2 to inherit.

</domain>

<decisions>
## Implementation Decisions

### packages/contracts Scope
- **D-01:** Use the **foundational forward-lean** approach. Phase 1 defines: health-check types, feature-flag types, auth token shapes (JWT payload, session), request/response envelope (success/error wrapper), money utils (integer minor-unit convention + `allocate()` helper for split residuals), and the minimal `MarketplaceConfig` type. No domain-specific contracts (products, orders, users) — those belong to their respective phases.
- **D-02:** `MarketplaceConfig` shape for Phase 1: `{ currency: string; locale: string; activePaymentProviders: ('stripe' | 'razorpay')[]; }`. Phase 5 extends this when commerce domains are built — this is intentionally non-breaking to extend.
- **D-03:** `packages/contracts` is the single source of truth for API types, Zod schemas, and money conventions. Every app (backend, storefront, admin, vendor, mobile) imports from it. No duplicated type definitions elsewhere.

### Feature-Flag Service
- **D-04:** Phase 1 delivers the **infrastructure only**: a `FeatureFlags` DB table, a Redis cache layer with TTL-based invalidation, and a service that reads flags with cache-miss fallback to DB. No admin UI (Phase 6) and no internal toggle API.
- **D-05:** Flags are toggled during Phase 1–5 development via DB seed files or migrations. The infrastructure must satisfy success criterion: "A feature flag toggled in the database is reflected in API responses within one Redis TTL cycle, without a code deploy."
- **D-06:** The `FeatureFlags` table schema and service boundary must be designed so Phase 6's admin UI can be bolted on without schema changes — read/write access paths should be clearly separated at the service level.

### Environment Variable Structure
- **D-07:** Use **root shared + per-app** `.env.example` structure:
  - Root `.env.example`: shared infrastructure vars — DB URL, Redis URL, JWT secret, Google Maps API key, Google SMTP credentials, OpenSearch URL, Node environment.
  - Per-app `.env.example` files: app-specific vars — e.g., `VITE_API_URL` + `VITE_PUBLIC_URL` for web apps; `EXPO_PUBLIC_API_URL` + `EXPO_PUBLIC_GOOGLE_MAPS_KEY` for mobile; port config for backend.
- **D-08:** Every env var must be documented with a comment in the `.env.example` file (purpose, expected format, where to obtain it). Required by FND-08 and the productization goal.

### Claude's Discretion
- Monorepo workspace naming conventions (e.g., `apps/web-storefront` vs `apps/storefront`) — planner should choose conventions optimized for buyer clarity and Turborepo task naming.
- Backend internal module structure for the skeleton (Fastify + Awilix DI container setup, plugin registration pattern, health-check route organization).
- Local dev services approach (Docker Compose, manual setup, or hybrid) — choose what best serves buyer onboarding; consider a `docker-compose.yml` for Postgres + Redis + OpenSearch as optional convenience.
- React Native Metro workspace resolution strategy — choose from Expo noHoist, Turborepo transitive dep approach, or manual `extraNodeModules` config; whatever cleanly satisfies FND-03 (proven clean release build).
- Branding/design-token architecture — choose between Tailwind v4 `@theme` in a shared CSS file vs CSS custom properties; must satisfy FND-07 (one-place rebrand propagates across all three web apps).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Project Requirements
- `.planning/REQUIREMENTS.md` §"Platform & Foundation" — FND-01 through FND-08, the 8 Phase 1 requirements with acceptance criteria
- `.planning/PROJECT.md` §"Constraints" — locked tech stack; §"Key Decisions" — monorepo, config-first, feature-flag architecture decisions
- `.planning/ROADMAP.md` §"Phase 1: Foundation" — goal, success criteria, and dependencies

### Technology Stack Reference
- `CLAUDE.md` §"Recommended Stack" — definitive version-pinned tech stack for all packages (pnpm 9, Turborepo 2.9, Fastify 5.8, Drizzle ORM 0.45, Zod 4.4, React 19.2, Vite 8, Tailwind CSS 4.3, Expo SDK 53, React Native 0.83, etc.)
- `CLAUDE.md` §"What NOT to Use" — explicit exclusions (FLOAT/DECIMAL for money, jsonwebtoken, Webpack, NestJS, Tailwind v3, etc.)
- `CLAUDE.md` §"Version Compatibility Matrix" — confirms compatibility between package versions (especially: Vite 8 requires Node 20.19+/22.12+, Razorpay requires Node >=22.2, Tailwind v4 uses `@tailwindcss/vite` not PostCSS)

### Architecture Patterns
- `.planning/PROJECT.md` §"Key Decisions" — feature-flag store pattern: DB-backed, Redis-cached, never hot-path DB reads
- `CLAUDE.md` §"Core Backend" — Awilix 13 for DI (no decorator metadata), BullMQ 5 for background jobs, ioredis 5 as Redis client

No external ADRs or design documents exist yet — this is the first phase. All decisions are captured in this context file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- None — greenfield project. No existing code to build on.

### Established Patterns
- None yet — Phase 1 establishes the patterns all subsequent phases follow.

### Integration Points
- `packages/contracts` → consumed by: `apps/api` (backend validation), `apps/web-storefront`, `apps/web-admin`, `apps/web-vendor` (API response types), `apps/mobile` (shared types via Metro resolution)
- Feature-flag service → consumed by: all backend route handlers that check flag state; Phase 6 admin UI writes to it; Phase 8 simulation mode reads `tracking_simulation_mode` flag
- Design token / branding config → consumed by: all three web apps; Phase 9 rebranding guide instructs buyers on this file

</code_context>

<specifics>
## Specific Ideas

- The Metro + Expo workspace resolution for `packages/contracts` is a **hard gate** — the phase is not complete until a clean release build succeeds (FND-03 / success criterion 2). Plan for this explicitly; do not treat it as an afterthought.
- The feature-flag Redis TTL is the key observable for success criterion 3. The cache layer must expose the TTL value as a configurable env var so buyers can tune it.
- `packages/contracts/src/money/` should contain the allocation utils and currency type conventions separately from API types — money utils will be imported by backend commission code in Phase 5 and must not pull in HTTP-specific types.

</specifics>

<deferred>
## Deferred Ideas

- Feature-flag toggle API (PATCH `/internal/flags/:key`) — useful for development convenience but adds scope to Phase 1. Defer to Phase 6 admin panel or add as a low-priority plan item.
- Admin UI for feature flags — Phase 6 (ADM-06).
- Full `MarketplaceConfig` schema extension (wallet settings, checkout config, commission config) — Phase 5.
- Pre-seeded default flag values (`wallet_enabled`, `coupons_enabled`, `stripe_enabled`, `razorpay_enabled`, `tracking_simulation_mode`) — Phase 1 infrastructure doesn't require these to exist; Phase 2–5 can seed them as needed via migrations.

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 1-Foundation*
*Context gathered: 2026-05-29*
