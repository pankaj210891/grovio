---
phase: 06-vendor-admin-tools
fixed_at: 2026-06-05T13:00:00Z
review_path: .planning/phases/06-vendor-admin-tools/06-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 15
skipped: 0
status: all_fixed
---

# Phase 06: Code Review Fix Report

**Fixed at:** 2026-06-05T13:00:00Z
**Source review:** .planning/phases/06-vendor-admin-tools/06-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (6 Critical + 9 Warning)
- Fixed: 15
- Skipped: 0

## Fixed Issues

### CR-01: Vendor returns approve/reject endpoint skips ownership verification

**Files modified:** `apps/api/src/routes/vendor/returns.ts`
**Commit:** 32451ef
**Applied fix:** Added a JOIN-based ownership check before calling the service in both the approve and reject handlers. The check queries `return_requests` JOIN `vendor_orders` to confirm the return belongs to the authenticated vendor's orders. Returns 404 if not found rather than proceeding with the service call.

---

### CR-02: CORS origin is a scalar — admin and vendor panels blocked in production

**Files modified:** `apps/api/src/app.ts`
**Commit:** 2f959b1
**Applied fix:** Changed the `origin` value from the scalar `env.STOREFRONT_ORIGIN` to an array `[env.STOREFRONT_ORIGIN, env.WEB_ADMIN_URL, env.WEB_VENDOR_URL]`. The env already declares both `WEB_ADMIN_URL` and `WEB_VENDOR_URL` so no changes were needed to env.ts.

---

### CR-03: CatalogModerationPage reject sends empty body — backend returns 400

**Files modified:** `apps/web-admin/src/pages/CatalogModerationPage.tsx`
**Commit:** fc62742
**Applied fix:** Added `rejectTarget` and `rejectReason` state. The Reject button now opens an inline modal dialog that captures the rejection reason before firing the mutation. The mutation type signature changed to `{ productId, rejectionReason }` and sends `{ rejectionReason }` in the body. Added `React` import for `React.FormEvent`.

---

### CR-04: PayoutManagementPage calls wrong API endpoint — 404 on every load

**Files modified:** `apps/web-admin/src/pages/PayoutManagementPage.tsx`
**Commit:** 46ee203
**Applied fix:** Changed query path from `/admin/vendors/${selectedVendorId}/payouts` to `/admin/payouts/${selectedVendorId}` and settlement mutation path from `/admin/vendors/${selectedVendorId}/payouts/settlements` to `/admin/payouts/${selectedVendorId}/settlements` to match the registered backend routes.

---

### CR-05: CouponsPage sends wrong field name — minOrderAmountMinor silently dropped

**Files modified:** `apps/web-vendor/src/pages/CouponsPage.tsx`
**Commit:** 37b997d
**Applied fix:** Renamed `minOrderAmountMinor` to `minOrderMinor` in the `Coupon` interface, `CreateCouponInput` interface, `handleCreateSubmit` body construction, and the table display row. All usages now match the backend `CreateCouponInputSchema` field name.

---

### CR-06: Vendor sidebar defaults couponsEnabled to true — flashes for ineligible users

**Files modified:** `apps/web-vendor/src/components/layout/Sidebar.tsx`
**Commit:** 467cf21
**Applied fix:** Changed `data ?? true` to `data ?? false` in `useCouponsEnabled`. The Coupons nav item is now hidden until the feature flag is confirmed enabled by the server.

---

### WR-01 + WR-02: Audit log stale before-state and non-atomic restriction update

**Files modified:** `apps/api/src/modules/vendor-management/VendorManagementService.ts`
**Commit:** d8f57ff
**Applied fix (WR-01):** Moved the commission override query to before any mutations, capturing the real existing `ratePercent` as `beforeCommissionOverridePercent`. The audit log `before` field now uses this real value instead of always hardcoding `null`.
**Applied fix (WR-02):** Wrapped the entire category restriction DELETE + INSERT sequence and the commission upsert/delete inside a single Drizzle transaction to eliminate the window where concurrent readers see zero restrictions.

---

### WR-03: adminEmail stored in createdByAdminId UUID field

**Files modified:** `apps/api/src/modules/vendor-management/VendorManagementService.ts`, `apps/api/src/routes/admin/vendors.ts`
**Commit:** ecd7047
**Applied fix:** Added `adminId: string` parameter to `configureVendor` signature. Updated `createdByAdminId` to use `adminId` (the UUID from JWT sub). Route passes `request.adminId!` as the new parameter while retaining `adminEmail` for audit log actor fields.

---

### WR-04: Logout endpoints unprotected — CSRF logout risk

**Files modified:** `apps/api/src/routes/admin/auth.ts`, `apps/api/src/routes/vendor/auth.ts`
**Commit:** dbf994d
**Applied fix:** Added `{ preHandler: requireAdminAuth }` to `POST /admin/auth/logout` and `{ preHandler: requireVendorAuth }` to `POST /vendor/auth/logout`. A valid session token is now required to clear the cookie, preventing cross-site forced logout.

---

### WR-05: ReturnsPage reject sends { reason } but backend expects { rejectionReason }

**Files modified:** `apps/web-vendor/src/pages/ReturnsPage.tsx`
**Commit:** b13d7f0
**Applied fix:** Changed the reject mutation body from `{ reason }` to `{ rejectionReason: reason }` to match the backend `RejectInputSchema` field name.

---

### WR-06: Vendor SettingsPage sends returnsEnabled but backend expects isReturnable

**Files modified:** `apps/web-vendor/src/pages/SettingsPage.tsx`
**Commit:** 043f1b9
**Applied fix:** Replaced the imported `VendorReturnPolicy` contract type (which uses `returnsEnabled`) with a local `VendorReturnPolicyActual` interface using `isReturnable`. Renamed the state from `returnsEnabled`/`setReturnsEnabled` to `isReturnable`/`setIsReturnable`. Updated the useEffect population, mutation body type, and all JSX references. The mutation now sends `{ returnWindowDays, isReturnable }` matching the backend schema.

---

### WR-07: CmsPage toggle mutation calls non-existent /admin/homepage-blocks/:id/toggle

**Files modified:** `apps/web-admin/src/pages/CmsPage.tsx`
**Commit:** e33f58d
**Applied fix:** Removed the `/toggle` sub-path from the toggle mutation URL. The mutation now calls `PATCH /admin/homepage-blocks/${id}` (with `{ active }` body) which is the registered backend endpoint.

---

### WR-08: vendorTeamRoutes passes vendorId as invitedByUserId — semantic mismatch

**Files modified:** `apps/api/src/types/fastify.d.ts`, `apps/api/src/middleware/vendorAuth.ts`, `apps/api/src/routes/vendor/team.ts`
**Commit:** 652bd93
**Applied fix:** Added `vendorUserId?: string` to `FastifyRequest` type augmentation. In `requireVendorAuth`, exposed `payload["sub"]` as `request.vendorUserId`. In the team invite handler, replaced the second `vendorId` argument with `request.vendorUserId ?? vendorId` (fallback for legacy tokens without the sub claim).

---

### WR-09: Bearer token auth accepted unconditionally in admin and vendor middleware

**Files modified:** `apps/api/src/middleware/adminAuth.ts`, `apps/api/src/middleware/vendorAuth.ts`
**Commit:** de23371
**Applied fix:** Gated the Bearer header extraction behind `process.env["NODE_ENV"] !== "production"` in both middleware files. In production, only the httpOnly cookie path is active. Bearer auth is retained for development and test environments to support integration tests and CLI tooling.

---

_Fixed: 2026-06-05T13:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
