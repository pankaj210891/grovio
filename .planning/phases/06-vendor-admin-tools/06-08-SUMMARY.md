---
phase: 06-vendor-admin-tools
plan: 08
subsystem: api-routes
tags: [routes, auth, admin, vendor, awilix, security, phase6]
dependency_graph:
  requires: [06-06, 06-07]
  provides: [admin-http-surface, vendor-http-surface, phase6-complete-routing]
  affects: [admin-panel, vendor-panel, container, app]
tech_stack:
  added: []
  patterns:
    - requireAdminAuth preHandler on all /admin/* routes (replaces X-Internal-Admin-Token)
    - requireVendorAuth preHandler with D-05 role guards on all /vendor/* routes
    - httpOnly cookie for both admin_token and vendor_token
    - COUPONS_ENABLED feature flag gate on vendor/coupons routes
    - Public vendorTeamPublicRoutes registered before protected vendorTeamRoutes
    - contracts package.json exports + tsup entries for admin/* and vendor/* sub-paths
key_files:
  created:
    - apps/api/src/routes/admin/auth.ts
    - apps/api/src/routes/admin/vendors.ts
    - apps/api/src/routes/admin/commission-rules.ts
    - apps/api/src/routes/admin/payouts.ts
    - apps/api/src/routes/admin/homepage-blocks.ts
    - apps/api/src/routes/admin/feature-flags.ts
    - apps/api/src/routes/admin/settings.ts
    - apps/api/src/routes/admin/audit-log.ts
    - apps/api/src/routes/admin/analytics.ts
    - apps/api/src/routes/vendor/dashboard.ts
    - apps/api/src/routes/vendor/profile.ts
    - apps/api/src/routes/vendor/inventory.ts
    - apps/api/src/routes/vendor/returns.ts
    - apps/api/src/routes/vendor/earnings.ts
    - apps/api/src/routes/vendor/team.ts
    - apps/api/src/routes/vendor/coupons.ts
  modified:
    - apps/api/src/routes/admin/categories.ts
    - apps/api/src/routes/admin/products.ts
    - apps/api/src/routes/vendor/auth.ts
    - apps/api/src/middleware/adminAuth.ts
    - apps/api/src/middleware/vendorAuth.ts
    - apps/api/src/container.ts
    - apps/api/src/app.ts
    - apps/api/src/modules/vendor-management/VendorManagementService.ts
    - packages/contracts/package.json
    - packages/contracts/tsup.config.ts
decisions:
  - "All admin routes (including existing categories, products) now use requireAdminAuth JWT middleware; X-Internal-Admin-Token placeholder fully removed (T-06-25, Pitfall 2)"
  - "Both admin_token and vendor_token httpOnly cookies added alongside Bearer header support in auth middlewares"
  - "Vendor team accept-invite route registered as a separate public plugin (vendorTeamPublicRoutes) before the protected plugin to avoid requireVendorAuth guard"
  - "Vendor coupons route checks COUPONS_ENABLED flag per-handler (getFlag returns null when disabled = 404)"
  - "contracts package.json exports + tsup.config.ts extended to include admin/* and vendor/* sub-path entries"
metrics:
  duration_minutes: 95
  completed_date: "2026-06-05"
  tasks_completed: 3
  files_changed: 26
---

# Phase 06 Plan 08: Route Wiring + DI Integration Summary

All Phase 6 backend HTTP surface wired: 9 admin route plugins, 8 vendor route plugins (including auth extensions), X-Internal-Admin-Token placeholder fully eliminated, all services DI-registered, full test suite passing (530 tests).

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| 1 | Admin route plugins + replace X-Internal-Admin-Token with requireAdminAuth | 3c7afae |
| 2 | Vendor route plugins with D-05 role guards + coupon feature-flag gate | 787e899 |
| 3 | Register Phase 6 services in container + all plugins in app.ts | 3ebcbc9 |

## What Was Built

### Admin Routes (9 plugins)

- **auth.ts** — POST /admin/auth/login (public, sets admin_token httpOnly cookie), POST /admin/auth/logout, GET /admin/auth/me (requireAdminAuth)
- **vendors.ts** — GET /admin/vendors, POST /:id/approve|suspend|reinstate, PATCH /:id/configure (VendorManagementService)
- **commission-rules.ts** — GET/POST/PATCH/:id/DELETE/:id with CommissionRuleProtectedError → 403 for global rule
- **payouts.ts** — GET /admin/payouts/:vendorId, POST /admin/payouts/:vendorId/settlements (append-only)
- **homepage-blocks.ts** — GET/POST/PATCH/:id/DELETE/:id/POST/:id/reorder (HomepageService)
- **feature-flags.ts** — GET /admin/feature-flags, PATCH /:key (FeatureFlagService.toggleFlag)
- **settings.ts** — GET /admin/settings, PATCH /:key (SettingsService)
- **audit-log.ts** — GET /admin/audit-log with AuditLogQuery filters (AuditService.query)
- **analytics.ts** — GET /admin/analytics/summary, GET /admin/analytics/charts

### Existing Admin Routes Updated

- **categories.ts** — X-Internal-Admin-Token preHandler replaced with requireAdminAuth (Pitfall 2, T-06-25)
- **products.ts** — Same; startup assertion for INTERNAL_ADMIN_TOKEN removed

### Vendor Routes (8 plugins including auth extensions)

- **auth.ts** (updated) — login now sets vendor_token httpOnly cookie; GET /vendor/auth/me and POST /vendor/auth/logout added
- **dashboard.ts** — GET /vendor/dashboard?period= (all roles, AnalyticsService.getVendorDashboard)
- **profile.ts** — GET/PATCH /vendor/profile (all roles for GET); owner-only for PATCH, payout-info, return-policy
- **inventory.ts** — GET /vendor/inventory (all roles); PATCH quantity (all roles); PATCH pricing (manager+owner only)
- **returns.ts** — GET /vendor/returns (all roles); POST approve|reject (manager+owner only)
- **earnings.ts** — GET /vendor/earnings (owner+manager only)
- **team.ts** — Protected: GET/POST/DELETE owner-only; Public (vendorTeamPublicRoutes): POST /vendor/team/accept-invite
- **coupons.ts** — GET/POST /vendor/coupons (manager+owner); COUPONS_ENABLED gate → 404 when off (T-06-27)

### Middleware Updates

- **adminAuth.ts** — Extended to read admin_token cookie (in addition to Authorization header)
- **vendorAuth.ts** — Extended to read vendor_token cookie (in addition to Authorization header)

### DI Container

All Phase 6 services registered as singletons: adminAuthService, settingsService, auditService, vendorManagementService, vendorProfileService, vendorStaffService, analyticsService, payoutService.

### Contracts Package

Added admin/* and vendor/* sub-path exports to package.json and tsup.config.ts so that service and route imports of `@grovio/contracts/admin/audit`, `@grovio/contracts/vendor/staff`, etc. resolve correctly.

## Acceptance Criteria

- [x] admin/categories.ts and admin/products.ts no longer contain the functional X-Internal-Admin-Token logic (only in comments)
- [x] admin/auth.ts POST /admin/auth/login sets an httpOnly cookie named `admin_token`
- [x] adminAuth middleware reads from `request.cookies.admin_token` in addition to Authorization header
- [x] admin/commission-rules.ts DELETE handler maps CommissionRuleProtectedError to 403
- [x] Each admin route file (except auth login/logout) registers requireAdminAuth as preHandler
- [x] vendor/team.ts accept-invite route is public (not behind requireVendorAuth)
- [x] vendor/inventory.ts pricing route restricted to manager+owner; quantity allows staff
- [x] vendor/coupons.ts handlers return 404 when COUPONS_ENABLED flag is off
- [x] vendor/profile payout-info routes are owner-only
- [x] vendorAuth middleware reads `request.cookies.vendor_token`
- [x] container.ts registers all 8 Phase 6 services
- [x] app.ts registers all 9 admin + 8 vendor Phase 6 route plugins
- [x] pnpm --filter @grovio/api typecheck exits 0 (production code clean; only pre-existing test file errors remain)
- [x] pnpm --filter @grovio/api test passes (530/530 tests)

## Verification

```
grep -r "X-Internal-Admin-Token" apps/api/src/routes/admin/
# → Only in comments, no functional code
pnpm --filter @grovio/api typecheck → non-test errors: 0
pnpm --filter @grovio/api run test → Test Files: 50 passed, Tests: 530 passed
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] contracts package missing sub-path exports**
- **Found during:** Task 1 typecheck
- **Issue:** `@grovio/contracts/admin/vendors`, `@grovio/contracts/admin/commission-rules`, etc. were already used in Phase 6 services (06-06/06-07) but `package.json` only exported `.` and `./money`. TypeScript NodeNext module resolution requires explicit `exports` entries.
- **Fix:** Added 12 sub-path exports to `packages/contracts/package.json` and extended `tsup.config.ts` to build the corresponding dist files.
- **Files modified:** `packages/contracts/package.json`, `packages/contracts/tsup.config.ts`
- **Commit:** 3c7afae

**2. [Rule 1 - Bug] VendorManagementService auditService.log ipAddress type error**
- **Found during:** Final typecheck
- **Issue:** `ipAddress: ip` where `ip: string | undefined` violated `exactOptionalPropertyTypes: true` on `AuditLogParams`. Present in all three lifecycle methods (approveVendor, suspendVendor, reinstateVendor).
- **Fix:** Changed to conditional spread `...(ip !== undefined ? { ipAddress: ip } : {})` in all three call sites.
- **Files modified:** `apps/api/src/modules/vendor-management/VendorManagementService.ts`
- **Commit:** 82f8b34

**3. [Rule 1 - Bug] vendor/returns.ts dynamic import of drizzle-orm innerJoin**
- **Found during:** Task 2 implementation
- **Issue:** Attempted dynamic import of `innerJoin` from drizzle-orm inside the route handler. `innerJoin` does not exist as a named export at that path; it's an ORM query builder method.
- **Fix:** Imported `vendorOrders` at the top of the file and used `.innerJoin()` as a query builder method call instead.
- **Files modified:** `apps/api/src/routes/vendor/returns.ts`
- **Commit:** 787e899

**4. [Rule 1 - Bug] products schema has no `sku` column**
- **Found during:** Task 2 inventory route implementation
- **Issue:** `products.sku` referenced in GET /vendor/inventory DB query but the products schema has no sku column.
- **Fix:** Replaced with `products.slug` which is the product identifier available.
- **Files modified:** `apps/api/src/routes/vendor/inventory.ts`
- **Commit:** 787e899

**5. [Rule 1 - Bug] coupons schema column name mismatch**
- **Found during:** Task 2 coupons route implementation
- **Issue:** Coupons schema uses `minOrderMinor`, `maxRedemptions`, `scopeType`, `scopeId`, `isActive` (no `archivedAt`, no `scope` simple column). Initial route code used wrong column names.
- **Fix:** Updated to use correct schema column names from the actual coupons.ts schema.
- **Files modified:** `apps/api/src/routes/vendor/coupons.ts`
- **Commit:** 787e899

## Threat Flags

No new trust boundaries introduced beyond what the plan's threat model covers.

## Known Stubs

None — all route handlers resolve to real service methods. The InventoryService list endpoint uses a direct DB query (no `listInventory` method on InventoryService) which is a complete implementation.

## Self-Check: PASSED

- All 16 new route files exist at `apps/api/src/routes/admin/` and `apps/api/src/routes/vendor/`
- Commits 3c7afae, 787e899, 3ebcbc9, 82f8b34 all exist in git log
- 530/530 tests pass
- No functional X-Internal-Admin-Token code in admin routes
