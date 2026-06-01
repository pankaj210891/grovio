---
phase: 04-customer-storefront-web
plan: "01"
subsystem: contracts, api, ui
tags: [zod, react-router, lucide-react, react-intersection-observer, googlemaps, fastify-cors, fastify-cookie, nodemailer, typescript]

# Dependency graph
requires:
  - phase: 02-category-product-catalog
    provides: MerchandisingBlockSchema discriminated union in packages/contracts/src/category/blocks.ts
provides:
  - FeaturedCategoriesBlockSchema added to MerchandisingBlock discriminated union (D-02)
  - All Phase 4 npm dependencies installed in correct workspace apps
  - react-router-dom, lucide-react, react-intersection-observer, @googlemaps/js-api-loader in web-storefront
  - @fastify/cors, @fastify/cookie, nodemailer in api
affects:
  - 04-02 (CORS registration uses @fastify/cors)
  - 04-03 (FeaturedCategoriesBlock type consumed by HomepageService + frontend block renderer)
  - 04-05 (CustomerAuthService uses @fastify/cookie via reply.setCookie())
  - 04-06 (PlacesAutocompleteInput uses @googlemaps/js-api-loader)
  - 04-07 (infinite scroll uses react-intersection-observer)
  - 04-08 (router tree uses react-router-dom)

# Tech tracking
tech-stack:
  added:
    - react-router-dom@^7.16.0 (frontend)
    - lucide-react@^1.17.0 (frontend)
    - react-intersection-observer@^10.0.3 (frontend)
    - "@googlemaps/js-api-loader@^2.0.2 (frontend)"
    - "@types/google.maps (frontend dev)"
    - "@fastify/cors@^11.2.0 (backend)"
    - "@fastify/cookie@^11.0.2 (backend)"
    - nodemailer@^8.0.0 (backend)
    - "@types/nodemailer (backend dev)"
  patterns:
    - FeaturedCategoriesBlockSchema follows same JSDoc + z.object() style as Phase 2 block schemas
    - categoryIds constrained to z.string().uuid() for T-04-01 payload validation at parse time

key-files:
  created: []
  modified:
    - packages/contracts/src/category/blocks.ts
    - apps/api/package.json
    - apps/web-storefront/package.json
    - pnpm-lock.yaml

key-decisions:
  - "@fastify/cookie installed unconditionally — not yet in api/package.json, required for D-09 httpOnly cookie auth in Plan 04-05"
  - "lucide-react@latest resolves to ^1.17.0 per RESEARCH.md verified version"
  - "@types/google.maps added as dev dep alongside @googlemaps/js-api-loader for PlacesAutocompleteInput TypeScript support"
  - "Import from react-router canonical path, not react-router-dom, per RESEARCH.md Pitfall 8 and PATTERNS.md"

patterns-established:
  - "Pattern: FeaturedCategoriesBlockSchema shape — { type: 'featured_categories', title: string, categoryIds: uuid[], layout: 'grid' | 'row' }"
  - "Pattern: Non-breaking union extension — new schema added as fourth member, three Phase 2 schemas untouched"

requirements-completed: [STORE-01, STORE-05]

# Metrics
duration: 15min
completed: "2026-06-01"
---

# Phase 4 Plan 01: Contracts Extension + Dependency Setup Summary

**FeaturedCategoriesBlockSchema added to MerchandisingBlock discriminated union (D-02) and all nine Phase 4 npm packages installed across api and web-storefront workspaces**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-01T00:00:00Z
- **Completed:** 2026-06-01T00:15:00Z
- **Tasks:** 3 (Task 1 was a human checkpoint, Tasks 2 and 3 executed)
- **Files modified:** 4

## Accomplishments
- `FeaturedCategoriesBlockSchema` added to `packages/contracts/src/category/blocks.ts` as the fourth member of `MerchandisingBlockSchema`; existing Phase 2 block schemas unchanged; contracts build and typecheck pass
- All frontend Phase 4 dependencies installed: `react-router-dom`, `lucide-react`, `react-intersection-observer`, `@googlemaps/js-api-loader`, `@types/google.maps`
- All backend Phase 4 dependencies installed: `@fastify/cors`, `@fastify/cookie`, `nodemailer`, `@types/nodemailer`
- Lockfile updated; `pnpm install` exits clean; no blocking peer-dep errors introduced by these installs

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy verification** — human checkpoint (no commit; APPROVED)
2. **Task 2: Add featured_categories block to contracts union** — `4c6b787` (feat)
3. **Task 3: Install Phase 4 backend and frontend dependencies** — `6df2dd6` (feat)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `packages/contracts/src/category/blocks.ts` — Added `FeaturedCategoriesBlockSchema`, `FeaturedCategoriesBlock` type, updated `MerchandisingBlockSchema` union and JSDoc
- `apps/api/package.json` — Added `@fastify/cors`, `@fastify/cookie`, `nodemailer` to dependencies; `@types/nodemailer` to devDependencies
- `apps/web-storefront/package.json` — Added `react-router-dom`, `lucide-react`, `react-intersection-observer`, `@googlemaps/js-api-loader` to dependencies; `@types/google.maps` to devDependencies
- `pnpm-lock.yaml` — Updated lockfile with all new packages

## Decisions Made
- `@fastify/cookie` installed unconditionally alongside `@fastify/cors` because it is required for `reply.setCookie()` in Plan 04-05 (D-09 httpOnly cookie auth). Not yet in `api/package.json`, confirmed not registered in `app.ts`.
- `@types/google.maps` added as a dev dependency to support the `google.maps.places.Autocomplete` type reference in `PlacesAutocompleteInput` (PATTERNS.md).
- Import path for React Router is `react-router` (canonical v7), not `react-router-dom` — both work at runtime but `react-router` is the v7 standard. `react-router-dom` is installed for compatibility but imports throughout Phase 4 will use `react-router`.

## Deviations from Plan

None — plan executed exactly as specified. The pre-existing typecheck errors in `apps/api/src/modules/jobs/product-index-job.test.ts` (missing `beforeEach`) and `apps/web-storefront/src/App.tsx` (`motion/react` types) and `apps/web-storefront/src/main.tsx` (relative import extension) are pre-existing issues confirmed by running typecheck before and after our changes — they are out of scope per the scope boundary rule.

## Issues Encountered
- Pre-existing `pnpm --filter @grovio/api typecheck` failure: `product-index-job.test.ts(178,3): error TS2304: Cannot find name 'beforeEach'`. Confirmed pre-existing — unrelated to plan 04-01 changes. Logged to deferred-items.
- Pre-existing `pnpm --filter @grovio/web-storefront typecheck` failures: `motion/react` module not found and relative import `.js` extension. Both confirmed pre-existing before our installs. These will be resolved in a later plan when the storefront's `tsconfig.json` is configured and `framer-motion@12` types are set up.
- `@vitejs/plugin-react` peer warning for Vite 8: `unmet peer vite@"^4.2.0 || ^5.0.0 || ^6.0.0 || ^7.0.0"`. Pre-existing in the project (Vite 8 was already in `package.json`). Not a blocking error.

## User Setup Required
None — no external service configuration required for this plan. Package installs are self-contained.

## Next Phase Readiness
- `FeaturedCategoriesBlock` type is now importable from `@grovio/contracts` for both frontend block renderer and backend `HomepageService` validation
- All Phase 4 npm packages are available in their correct workspaces, unblocking all subsequent waves
- Plan 04-02 can proceed: `@fastify/cors` and `@fastify/cookie` are ready to register in `app.ts`
- Plan 04-05 can proceed: `nodemailer` and `@fastify/cookie` are available for `CustomerAuthService`
- Plan 04-06 can proceed: `@googlemaps/js-api-loader` and `@types/google.maps` are available for `PlacesAutocompleteInput`

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
