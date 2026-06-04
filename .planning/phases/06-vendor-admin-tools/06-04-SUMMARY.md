---
phase: 06-vendor-admin-tools
plan: "04"
subsystem: auth
tags: [auth, jwt, vendor-auth, admin-auth, middleware, tdd, argon2, jose]
dependency_graph:
  requires:
    - apps/api/src/db/schema/vendor-users.ts (Plan 06-02 — vendor_users table with role enum)
    - apps/api/src/db/schema/vendors.ts (Plan 06-02 extension — onboardingStatus column)
    - apps/api/src/db/schema/admin-users.ts (Plan 06-02 — admin_users table)
    - packages/contracts/src/vendor/profile.ts (Plan 06-01 — VendorRole union type)
  provides:
    - apps/api/src/modules/vendor-auth/VendorAuthService.ts (migrated to vendor_users, role JWT)
    - apps/api/src/middleware/vendorAuth.ts (accepts owner|manager|staff, exposes request.vendorRole)
    - apps/api/src/modules/admin-auth/AdminAuthService.ts (admin login + 8h JWT)
    - apps/api/src/middleware/adminAuth.ts (requireAdminAuth preHandler)
    - apps/api/src/types/fastify.d.ts (vendorRole, adminId, adminEmail request augmentations)
  affects:
    - Plans 06-05+ (all Phase 6 routes depend on auth foundation)
    - Plans 06-07+ (admin routes use requireAdminAuth)
    - Plans 06-08+ (vendor routes use vendorRole for role-gated actions)
tech_stack:
  added: []
  patterns:
    - TDD RED/GREEN cycle (test first, implement to pass)
    - argon2 + jose HS256 auth pattern (same as VendorAuthService Phase 3, CustomerAuthService Phase 4)
    - Fastify request type augmentation via declare module "fastify" in types/fastify.d.ts
    - Dual-query login pattern (vendor_users lookup + vendors.onboardingStatus check)
key_files:
  created:
    - apps/api/src/modules/admin-auth/AdminAuthService.ts
    - apps/api/src/modules/admin-auth/AdminAuthService.test.ts
    - apps/api/src/modules/admin-auth/index.ts
    - apps/api/src/middleware/adminAuth.ts
  modified:
    - apps/api/src/modules/vendor-auth/VendorAuthService.ts (vendor_users migration)
    - apps/api/src/modules/vendor-auth/VendorAuthService.test.ts (new test coverage)
    - apps/api/src/middleware/vendorAuth.ts (owner|manager|staff roles + vendorRole)
    - apps/api/src/types/fastify.d.ts (vendorRole, adminId, adminEmail augmentations)
key-decisions:
  - "request.vendorId still carries JWT vendorId claim (vendors.id FK) after migration — NOT sub (vendor_users.id); preserves all Phase 3/4/5 ownership checks"
  - "AdminAuthService shares JWT_SECRET with VendorAuthService (no new env var per RESEARCH.md)"
  - "Suspended vendor check uses a second DB query (vendors.onboardingStatus) after credential validation — same error class to avoid enumeration (T-06-11)"
  - "AdminAuthService has no register() — admin accounts are DB-seeded directly"
  - "vendorRole, adminId, adminEmail added to types/fastify.d.ts (single type declaration file for all auth augmentations)"
requirements-completed: [AUTH-04, VEN-01, VEN-05, ADM-02]
duration: ~7min
completed: "2026-06-04"
status: complete
---

# Phase 6 Plan 04: Auth Foundation — VendorAuthService Migration + AdminAuthService Summary

**VendorAuthService migrated to vendor_users with role-bearing JWT (owner|manager|staff), suspended-vendor login block, and vendorRole exposure on requests; AdminAuthService created with 8h admin JWT and requireAdminAuth middleware — all test-covered via TDD.**

## Performance

- **Duration:** ~7 min
- **Started:** 2026-06-04T16:26:20Z
- **Completed:** 2026-06-04T16:33:17Z
- **Tasks completed:** 2 of 2
- **Files created:** 4
- **Files modified:** 4

## Accomplishments

### Task 1: Migrated VendorAuthService to vendor_users + updated vendor middleware (TDD)

**VendorAuthService.ts — login query migration (D-03):**
- Changed `from(vendors).where(eq(vendors.email, email))` to `from(vendorUsers).where(and(eq(vendorUsers.email, email), isNull(vendorUsers.archivedAt)))`
- Added second query to check `vendors.onboardingStatus` for the vendor_user's vendorId — throws `InvalidCredentialsError` if suspended (D-17, T-06-11)
- JWT payload changed from `{ sub: vendor.id, role: "vendor", vendorId: vendor.id }` to `{ sub: vendorUser.id, role: vendorUser.role, vendorId: vendorUser.vendorId, email: vendorUser.email }` (D-06)
- `VendorTokenPayload.role` changed from `"vendor"` literal to `VendorRole` union type (`"owner" | "manager" | "staff"`) from `@grovio/contracts`
- `verifyToken` now accepts owner|manager|staff; rejects admin and customer (T-06-09, T-06-10)

**vendorAuth.ts middleware update:**
- Changed role guard from `payload["role"] !== "vendor"` to: reject if role is NOT one of owner|manager|staff
- Extracted `vendorId` from `payload["vendorId"]` (not `payload["sub"]`) — preserves all ownership checks that compare `request.vendorId` against product/order FK columns referencing `vendors.id`
- Added `request.vendorRole = role` — exposes team role for role-gated route handlers (D-05)

**FastifyRequest type augmentation (types/fastify.d.ts):**
- Added `vendorRole?: "owner" | "manager" | "staff"` to FastifyRequest
- Added `adminId?: string` and `adminEmail?: string` to FastifyRequest (for Task 2)

**Test coverage (18 new tests + 3 existing tests updated):**
- Login reads from vendor_users (not vendors table)
- JWT payload has distinct sub=vendorUser.id vs vendorId=vendorUser.vendorId
- Suspended vendor throws InvalidCredentialsError (D-17)
- Archived vendor_user returns empty rows from vendor_users query (login fails)
- verifyToken accepts owner/manager/staff; rejects admin and customer
- No user enumeration across all three scenarios

### Task 2: Created AdminAuthService + requireAdminAuth middleware (TDD)

**AdminAuthService.ts (new):**
- Queries `adminUsers` table via `from(adminUsers).where(eq(adminUsers.email, email))`
- argon2 + jose HS256 pattern identical to VendorAuthService
- JWT payload: `{ sub: admin.id, role: "admin" as const, email: admin.email }` (D-21)
- TTL_SECONDS = 28800 (8h) — longer admin session vs 1h vendor per D-21/RESEARCH.md
- `verifyToken` checks `payload["role"] === "admin"` — rejects all other roles (T-06-10)
- No `register()` method — admin accounts are seeded directly in DB (no self-registration)
- `InvalidCredentialsError` same message for unknown email vs wrong password (no enumeration)

**adminAuth.ts middleware (new):**
- Mirrors `requireVendorAuth` structure exactly
- Reads Authorization Bearer header, verifies HS256 JWT
- Rejects any token where `payload["role"] !== "admin"` with 401 (T-06-09, T-06-10)
- Sets `request.adminId = payload["sub"]` and `request.adminEmail = payload["email"]`

**admin-auth/index.ts barrel (new):**
- Exports `AdminAuthService`, `InvalidCredentialsError`, `AdminLoginResult`, `AdminTokenPayload`

**Test coverage (10 tests):**
- expiresIn=28800 (TTL gate test)
- Successful login returns accessToken
- Unknown email throws InvalidCredentialsError
- Wrong password throws InvalidCredentialsError
- No user enumeration
- verifyToken accepts admin tokens
- verifyToken rejects vendor tokens (T-06-10)
- verifyToken rejects customer tokens
- verifyToken throws for expired tokens

## Task Commits

| Task | Phase | Commit | Description |
|------|-------|--------|-------------|
| Task 1 RED | test | `5710e20` | Failing tests for VendorAuthService vendor_users migration |
| Task 1 GREEN | feat | `3dd3ba6` | VendorAuthService migrated + vendor middleware updated |
| Task 2 RED | test | `372eabe` | Failing tests for AdminAuthService |
| Task 2 GREEN | feat | `579b927` | AdminAuthService + requireAdminAuth middleware created |

## Test Results

```
VendorAuthService + AdminAuthService: 39 tests passed (3 test files)
Full suite: 454 tests passed (43 test files)
Regressions: 0
```

## Files Created

- `apps/api/src/modules/admin-auth/AdminAuthService.ts` — Admin login + JWT (argon2 + jose, 8h TTL)
- `apps/api/src/modules/admin-auth/AdminAuthService.test.ts` — 10 tests
- `apps/api/src/modules/admin-auth/index.ts` — Barrel export
- `apps/api/src/middleware/adminAuth.ts` — requireAdminAuth Fastify preHandler

## Files Modified

- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — Migrated to vendor_users, role JWT
- `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` — 18 new tests replacing old 11
- `apps/api/src/middleware/vendorAuth.ts` — owner|manager|staff roles, request.vendorRole
- `apps/api/src/types/fastify.d.ts` — vendorRole, adminId, adminEmail request augmentations

## Deviations from Plan

None — plan executed exactly as written.

The TDD cycle followed the gate sequence:
1. RED: wrote failing tests (committed as test(...))
2. GREEN: wrote implementation to pass tests (committed as feat(...))
3. No REFACTOR phase needed — code was clean on first pass

## TDD Gate Compliance

| Plan Gate | Commit | Status |
|-----------|--------|--------|
| Task 1 RED (test commit) | `5710e20` | PASSED |
| Task 1 GREEN (feat commit) | `3dd3ba6` | PASSED |
| Task 2 RED (test commit) | `372eabe` | PASSED |
| Task 2 GREEN (feat commit) | `579b927` | PASSED |

## Known Stubs

None — all implementations are complete and functional. No hardcoded values or placeholder text.

## Threat Flags

No new threat surface introduced. All threats in the plan's `<threat_model>` are mitigated:

| Threat | Mitigation Applied |
|--------|-------------------|
| T-06-09 Role claim forgery | Role read only from jose.jwtVerify payload; JWT_SECRET server-side |
| T-06-10 Vendor token on admin routes | requireAdminAuth rejects role!="admin" with 401 |
| T-06-11 Suspended vendor still logging in | VendorAuthService.login checks onboardingStatus='suspended' after credential validation |
| T-06-12 Stale Phase 3 JWTs | Old tokens missing `vendorId` claim rejected by middleware (missing-claim guard) |

---

## Self-Check: PASSED

Files exist:
- apps/api/src/modules/vendor-auth/VendorAuthService.ts ✓
- apps/api/src/modules/vendor-auth/VendorAuthService.test.ts ✓
- apps/api/src/middleware/vendorAuth.ts ✓
- apps/api/src/modules/admin-auth/AdminAuthService.ts ✓
- apps/api/src/modules/admin-auth/AdminAuthService.test.ts ✓
- apps/api/src/modules/admin-auth/index.ts ✓
- apps/api/src/middleware/adminAuth.ts ✓
- apps/api/src/types/fastify.d.ts ✓

Commits exist:
- 5710e20 (Task 1 RED) ✓
- 3dd3ba6 (Task 1 GREEN) ✓
- 372eabe (Task 2 RED) ✓
- 579b927 (Task 2 GREEN) ✓

Acceptance criteria:
- VendorAuthService.ts login query reads from(vendorUsers) ✓
- VendorAuthService.ts JWT payload sets sub to vendorUser.id and vendorId to vendorUser.vendorId (distinct) ✓
- VendorAuthService throws InvalidCredentialsError when onboardingStatus is 'suspended' ✓
- middleware/vendorAuth.ts no longer hard-checks role !== "vendor"; accepts owner|manager|staff ✓
- middleware/vendorAuth.ts sets both request.vendorId and request.vendorRole ✓
- AdminAuthService.ts queries from(adminUsers) and sets JWT role to "admin" ✓
- AdminAuthService TTL_SECONDS equals 28800 ✓
- AdminAuthService.verifyToken rejects token whose role is not "admin" ✓
- middleware/adminAuth.ts exports requireAdminAuth, rejects non-admin tokens 401, sets request.adminId + request.adminEmail ✓
- All tests pass (454/454) ✓
