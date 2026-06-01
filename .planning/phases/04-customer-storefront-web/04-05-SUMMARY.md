---
phase: 04-customer-storefront-web
plan: 05
subsystem: api
tags: [fastify, cookies, cors, jwt, zod, awilix, nodemailer]

# Dependency graph
requires:
  - phase: 04-03
    provides: CustomerAuthService, requireCustomerAuth middleware, customerAuth module
  - phase: 04-04
    provides: CustomerAddressService, HomepageService, mailer transport factory

provides:
  - "POST /auth/signup — creates customer account, returns 201"
  - "POST /auth/login — authenticates and sets httpOnly access_token + refresh_token cookies (D-09)"
  - "POST /auth/refresh — rotates access token using scoped refresh cookie"
  - "POST /auth/logout — clears both auth cookies (T-04-16)"
  - "POST /auth/forgot-password — triggers reset email, always 200 (no enumeration)"
  - "POST /auth/reset-password — completes reset with time-limited token"
  - "GET/PATCH /account/profile — auth-gated customer profile read/update"
  - "GET/POST/PATCH/DELETE /account/addresses/* — auth-gated address CRUD"
  - "GET /homepage — public, Redis-cached block array"
  - "@fastify/cors with credentials:true registered before routes (T-04-13)"
  - "@fastify/cookie registered before customer auth routes (D-09)"
  - "customerAuthService, customerAddressService, homepageService, mailer in Awilix"

affects:
  - 04-06-frontend-setup
  - 04-07-storefront-pages
  - 04-08-account-pages
  - phase-05-commerce-core

# Tech tracking
tech-stack:
  added:
    - "@fastify/cors — CORS with credentials mode"
    - "@fastify/cookie — httpOnly cookie read/write"
  patterns:
    - "httpOnly cookie issuance on login (D-09) — access_token + refresh_token"
    - "refresh_token cookie scoped to path=/auth/refresh (Pitfall 7)"
    - "CORS with specific origin from env.STOREFRONT_ORIGIN, never wildcard (T-04-13)"
    - "forgotPassword always returns 200 — no email enumeration (T-04-08)"
    - "customerAddressRoutes passes request.customerId to every service call (AUTH-05)"
    - "Profile route queries fastify.db directly (no service wrapper needed)"

key-files:
  created:
    - apps/api/src/routes/customer/auth.ts
    - apps/api/src/routes/account/profile.ts
    - apps/api/src/routes/account/addresses.ts
    - apps/api/src/routes/homepage.ts
  modified:
    - apps/api/src/container.ts
    - apps/api/src/app.ts

key-decisions:
  - "Profile route queries fastify.db directly rather than via CustomerAuthService — no getProfile() method exists and adding one would be over-engineering for simple field reads"
  - "CORS registered before awilix is not needed — awilix is already registered via plugin order; CORS must be before routes, which it is"
  - "Cookie plugin checked for prior registration — not found, registered once safely"

patterns-established:
  - "Customer auth endpoints mounted at /auth/* (not /customer/auth/*) to align with storefront URL conventions"
  - "Account routes use fastify.addHook preHandler for requireCustomerAuth — all routes in plugin are guarded"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04, AUTH-05, STORE-01]

# Metrics
duration: 25min
completed: 2026-06-01
---

# Phase 4 Plan 05: Backend Route Wiring Summary

**Customer auth httpOnly cookie endpoints + auth-gated /account/* CRUD + public /homepage, wired via Awilix and @fastify/cors with credentials**

## Performance

- **Duration:** ~25 min
- **Started:** 2026-06-01T19:10:00Z
- **Completed:** 2026-06-01T19:35:00Z
- **Tasks:** 3
- **Files modified:** 6

## Accomplishments

- Six customer auth endpoints at `/auth/*` with httpOnly cookie issuance (D-09), refresh token path-scoping (Pitfall 7), and no email enumeration on forgot-password (T-04-08)
- Two auth-gated account route plugins (`/account/profile` and `/account/addresses`) using `requireCustomerAuth` preHandler, with every service call passing `request.customerId` (AUTH-05)
- Public `GET /homepage` route returning Redis-cached block array via HomepageService
- Awilix container extended with `customerAuthService`, `customerAddressService`, `homepageService`, and `mailer` registrations
- `@fastify/cors` registered with `origin: env.STOREFRONT_ORIGIN` and `credentials: true` — never wildcard (T-04-13 / Pitfall 2)
- `@fastify/cookie` registered before route plugins so `reply.setCookie` and `request.cookies` work correctly

## Task Commits

1. **Task 1: Customer auth routes + account routes + homepage route** - `ba9a0e4` (feat)
2. **Task 2: Awilix registration of services + mailer** - `570c834` (feat)
3. **Task 3: app.ts — register CORS + cookie + four route plugins** - `a63ecfb` (feat)

**Plan metadata:** _(docs commit hash — see below)_

## Files Created/Modified

- `apps/api/src/routes/customer/auth.ts` — customerAuthRoutes: 6 public endpoints with cookie issuance
- `apps/api/src/routes/account/profile.ts` — accountProfileRoutes: GET/PATCH /account/profile, auth-gated
- `apps/api/src/routes/account/addresses.ts` — accountAddressRoutes: full CRUD, auth-gated, AUTH-05 scoped
- `apps/api/src/routes/homepage.ts` — homepageRoutes: public GET /homepage
- `apps/api/src/container.ts` — added 3 service singletons + mailer asValue
- `apps/api/src/app.ts` — registered cors, cookie, and 4 new route plugins

## Decisions Made

- Profile GET queries `fastify.db` directly via Drizzle (no `CustomerAuthService.getProfile()` method needed — simple SELECT with exclusion of passwordHash is cleaner without adding a service method)
- Cookie plugin checked before registration: was not already registered, so registered once safely (per RESEARCH.md Assumption A1 — duplicate plugin guard)
- Account address route inline Zod schemas validate both required fields (street/city/state/pincode/country) and optional fields (label/lat/lng/placeId/isDefault) with correct nullability

## Deviations from Plan

None — plan executed exactly as written. All acceptance criteria met.

## Issues Encountered

- Pre-existing `product-index-job.test.ts` has a `beforeEach` not imported (test file bug outside plan scope). 30/31 test files pass (301 tests). This is a pre-existing issue logged to deferred items.

## Known Stubs

None — all route handlers call live services and return real data.

## Threat Surface Scan

No new security surface beyond what the plan's threat model covers (T-04-13 through T-04-17 all mitigated as specified):
- CORS with specific origin + credentials: implemented
- refresh_token cookie scoped to /auth/refresh: implemented
- requireCustomerAuth preHandler on all /account/* routes: implemented
- Logout clears both cookies with matching path attributes: implemented
- Inline Zod validation on every route body: implemented

## Next Phase Readiness

- All Phase 4 backend HTTP contracts are now live and callable
- Storefront frontend (Waves 5-6) can now call `/auth/*`, `/account/*`, and `/homepage` endpoints
- Cookie-based auth with CORS credentials is the linchpin for frontend-backend integration (D-09)
- Pre-existing `product-index-job.test.ts` beforeEach import issue should be fixed before Phase 5

## Self-Check: PASSED

- `apps/api/src/routes/customer/auth.ts` FOUND
- `apps/api/src/routes/account/profile.ts` FOUND
- `apps/api/src/routes/account/addresses.ts` FOUND
- `apps/api/src/routes/homepage.ts` FOUND
- Commit `ba9a0e4` FOUND
- Commit `570c834` FOUND
- Commit `a63ecfb` FOUND

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
