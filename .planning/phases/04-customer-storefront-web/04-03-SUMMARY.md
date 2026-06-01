---
phase: 04-customer-storefront-web
plan: "03"
subsystem: api, auth
tags: [argon2, jose, jwt, nodemailer, customer-auth, middleware, tdd, password-reset]

# Dependency graph
requires:
  - phase: 04-customer-storefront-web
    plan: "02"
    provides: "customers + password_reset_tokens tables; SMTP_* env vars; STOREFRONT_ORIGIN"
provides:
  - CustomerAuthService: register/login/verifyToken/refreshTokens/forgotPassword/resetPassword
  - CustomerAlreadyExistsError, InvalidCredentialsError, InvalidResetTokenError error classes
  - customer-auth/index.ts barrel export
  - createMailerTransport factory (SMTP or jsonTransport dev fallback)
  - requireCustomerAuth cookie middleware (access_token httpOnly cookie guard)
affects:
  - 04-04 (app.ts registers @fastify/cookie + cors; customerAuthRoutes + accountRoutes use service/middleware)
  - 04-05 (CustomerAddressService routes use requireCustomerAuth)
  - 04-06 (HomepageService independent; mailer registered in container)
  - container.ts (Wave 4 adds customerAuthService + mailer asValue)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - argon2 (Argon2id default) for password hashing — OWASP recommendation
    - jose SignJWT / jwtVerify with HS256 for customer token pair
    - randomUUID + createHash('sha256') for password reset token — raw never stored (T-04-07)
    - nodemailer jsonTransport as graceful dev fallback when SMTP not configured
    - httpOnly cookie read via request.cookies['access_token'] (D-09)
    - FastifyRequest module augmentation for customerId? field
    - vi.mock hoisting for argon2, jose, crypto in TDD test file

key-files:
  created:
    - apps/api/src/modules/customer-auth/CustomerAuthService.ts
    - apps/api/src/modules/customer-auth/CustomerAuthService.test.ts
    - apps/api/src/modules/customer-auth/index.ts
    - apps/api/src/modules/mailer/mailer.ts
    - apps/api/src/middleware/customerAuth.ts

key-decisions:
  - "CustomerAuthService returns {accessToken, refreshToken, expiresIn} from login() — route sets cookies in Wave 4; service never touches reply (D-09 compliance)"
  - "JWT role claim is 'customer' with no vendorId — vendor tokens cannot access customer routes (D-11, T-04-06)"
  - "forgotPassword silently succeeds for unknown email — no account-existence disclosure (T-04-08)"
  - "SHA-256 hash stored in password_reset_tokens; raw token emailed only (T-04-07)"
  - "jsonTransport dev fallback: API boots with no SMTP configured; CustomerAuthService logs reset link to console instead of throwing"
  - "@fastify/cookie import in customerAuth.ts provides module augmentation for request.cookies type"

patterns-established:
  - "Pattern: CustomerAuthService deps interface includes mailer: nodemailer.Transporter for Awilix injection"
  - "Pattern: crypto.randomUUID() + createHash('sha256').update(raw).digest('hex') for single-use token pattern"
  - "Pattern: ACCESS_TTL_SECONDS=3600 / REFRESH_TTL_SECONDS=604800 constants (customer differs from vendor — refresh token added)"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-04]

# Metrics
duration: 15min
completed: "2026-06-01"
---

# Phase 4 Plan 03: CustomerAuthService + Mailer + Auth Middleware Summary

**CustomerAuthService (argon2 + jose, role=customer), nodemailer transport factory with dev fallback, and requireCustomerAuth cookie middleware built test-first (RED→GREEN)**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-01
- **Completed:** 2026-06-01
- **Tasks:** 3 (Task 1 is TDD: RED commit + GREEN commit)
- **Files modified:** 5 (all new)

## Accomplishments

- CustomerAuthService implements six methods: register/login/verifyToken/refreshTokens/forgotPassword/resetPassword. Covers AUTH-01/02/03/04 and all STRIDE threats T-04-05 through T-04-09.
- All 19 unit tests pass across all behaviors including the anti-enumeration assertion (T-04-05), non-customer role rejection (T-04-06), SHA-256 token hashing (T-04-07), and silent-success for unknown email (T-04-08).
- Mailer factory createMailerTransport returns a real SMTP transport or jsonTransport stub — API boots with zero SMTP config.
- requireCustomerAuth reads the httpOnly cookie (D-09), guards customer role (D-11/T-04-06), sets request.customerId, and returns a 401 envelope on failure.
- Full test suite: 282 tests pass; pre-existing product-index-job.test.ts failure (beforeEach not defined) unchanged.

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 RED | CustomerAuthService tests (failing) | 4580d8c | CustomerAuthService.test.ts |
| 1 GREEN | CustomerAuthService implementation | d2afebe | CustomerAuthService.ts, index.ts |
| 2 | Mailer transport factory | 481070b | mailer.ts |
| 3 | requireCustomerAuth middleware | 42a7185 | customerAuth.ts |

## Files Created/Modified

- `apps/api/src/modules/customer-auth/CustomerAuthService.ts` — full auth service; register/login/verifyToken/refreshTokens/forgotPassword/resetPassword; CustomerAlreadyExistsError/InvalidCredentialsError/InvalidResetTokenError; ACCESS_TTL_SECONDS=3600, REFRESH_TTL_SECONDS=604800
- `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts` — 19 unit tests; vi.mock argon2/jose/crypto; makeDbMock chain helper; covers all behaviors and security properties
- `apps/api/src/modules/customer-auth/index.ts` — barrel re-exports service class + three error classes + types
- `apps/api/src/modules/mailer/mailer.ts` — createMailerTransport(env); SMTP when configured, jsonTransport dev stub otherwise; Mailer type alias
- `apps/api/src/middleware/customerAuth.ts` — requireCustomerAuth; reads request.cookies['access_token']; customer role guard; sets request.customerId; @fastify/cookie import for type augmentation; FastifyRequest augmentation

## Decisions Made

- `login()` returns `{ accessToken, refreshToken, expiresIn }` not cookies — the route handler sets cookies in Wave 4 (D-09). Service stays transport-agnostic.
- JWT payload carries `{ sub: customerId, role: "customer" }` with no `vendorId` claim — prevents elevation of privilege across roles (D-11).
- `forgotPassword()` silently succeeds for unknown emails — prevents account-existence disclosure (T-04-08).
- `@fastify/cookie` imported (side-effect only) in `customerAuth.ts` to pull in the FastifyRequest type augmentation for `request.cookies` — resolves TS2339 without requiring `@fastify/cookie` to be registered at import time.

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing typecheck error (`product-index-job.test.ts(178,3): error TS2304: Cannot find name 'beforeEach'`) was already present before this plan's changes; confirmed pre-existing per 04-02-SUMMARY.md. All new files introduce zero TypeScript errors.

## TDD Gate Compliance

- **RED gate:** commit `4580d8c` — `test(04-03): add failing CustomerAuthService tests (RED)` — 19 tests, all failing (module not found)
- **GREEN gate:** commit `d2afebe` — `feat(04-03): implement CustomerAuthService with full auth flow (GREEN)` — 19 tests, all passing
- No REFACTOR needed — implementation is clean.

## Known Stubs

None — CustomerAuthService is fully implemented with real logic. The mailer fallback (jsonTransport + console.log) is an intentional design choice, not a stub; it satisfies the plan's "dev fallback" requirement.

## Threat Surface Scan

No new security surface beyond what is documented in the plan's threat model. All T-04-05 through T-04-09 mitigations are implemented and test-covered.

## Self-Check: PASSED

All files exist:
- apps/api/src/modules/customer-auth/CustomerAuthService.ts — FOUND
- apps/api/src/modules/customer-auth/CustomerAuthService.test.ts — FOUND
- apps/api/src/modules/customer-auth/index.ts — FOUND
- apps/api/src/modules/mailer/mailer.ts — FOUND
- apps/api/src/middleware/customerAuth.ts — FOUND

All commits exist: 4580d8c, d2afebe, 481070b, 42a7185 — FOUND

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
