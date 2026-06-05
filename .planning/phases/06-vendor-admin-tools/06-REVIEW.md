---
phase: 06-vendor-admin-tools
reviewed: 2026-06-05T12:00:00Z
depth: standard
files_reviewed: 67
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/container.ts
  - apps/api/src/middleware/adminAuth.ts
  - apps/api/src/middleware/vendorAuth.ts
  - apps/api/src/modules/vendor-management/VendorManagementService.ts
  - apps/api/src/routes/admin/analytics.ts
  - apps/api/src/routes/admin/audit-log.ts
  - apps/api/src/routes/admin/auth.ts
  - apps/api/src/routes/admin/categories.ts
  - apps/api/src/routes/admin/commission-rules.ts
  - apps/api/src/routes/admin/feature-flags.ts
  - apps/api/src/routes/admin/homepage-blocks.ts
  - apps/api/src/routes/admin/payouts.ts
  - apps/api/src/routes/admin/products.ts
  - apps/api/src/routes/admin/settings.ts
  - apps/api/src/routes/admin/vendors.ts
  - apps/api/src/routes/vendor/auth.ts
  - apps/api/src/routes/vendor/coupons.ts
  - apps/api/src/routes/vendor/dashboard.ts
  - apps/api/src/routes/vendor/earnings.ts
  - apps/api/src/routes/vendor/inventory.ts
  - apps/api/src/routes/vendor/profile.ts
  - apps/api/src/routes/vendor/returns.ts
  - apps/api/src/routes/vendor/team.ts
  - apps/web-admin/src/App.tsx
  - apps/web-admin/src/components/charts/MiniChart.tsx
  - apps/web-admin/src/components/layout/Header.tsx
  - apps/web-admin/src/components/layout/PanelLayout.tsx
  - apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx
  - apps/web-admin/src/components/layout/Sidebar.tsx
  - apps/web-admin/src/hooks/useAdminAuth.ts
  - apps/web-admin/src/lib/apiClient.ts
  - apps/web-admin/src/pages/AuditLogPage.tsx
  - apps/web-admin/src/pages/CatalogModerationPage.tsx
  - apps/web-admin/src/pages/CmsPage.tsx
  - apps/web-admin/src/pages/CommissionRulesPage.tsx
  - apps/web-admin/src/pages/DashboardPage.tsx
  - apps/web-admin/src/pages/FeatureFlagsPage.tsx
  - apps/web-admin/src/pages/PayoutManagementPage.tsx
  - apps/web-admin/src/pages/SettingsPage.tsx
  - apps/web-admin/src/pages/VendorsPage.tsx
  - apps/web-admin/src/pages/auth/LoginPage.tsx
  - apps/web-admin/src/stores/adminAuthStore.ts
  - apps/web-vendor/package.json
  - apps/web-vendor/src/components/layout/Header.tsx
  - apps/web-vendor/src/components/layout/PanelLayout.tsx
  - apps/web-vendor/src/components/layout/ProtectedVendorRoute.tsx
  - apps/web-vendor/src/components/layout/Sidebar.tsx
  - apps/web-vendor/src/hooks/useVendorAuth.ts
  - apps/web-vendor/src/lib/apiClient.ts
  - apps/web-vendor/src/lib/queryClient.ts
  - apps/web-vendor/src/main.tsx
  - apps/web-vendor/src/pages/CouponsPage.tsx
  - apps/web-vendor/src/pages/DashboardPage.tsx
  - apps/web-vendor/src/pages/EarningsPage.tsx
  - apps/web-vendor/src/pages/InventoryPage.tsx
  - apps/web-vendor/src/pages/OrdersPage.tsx
  - apps/web-vendor/src/pages/ProductsPage.tsx
  - apps/web-vendor/src/pages/ReturnsPage.tsx
  - apps/web-vendor/src/pages/SettingsPage.tsx
  - apps/web-vendor/src/pages/StoreProfilePage.tsx
  - apps/web-vendor/src/pages/TeamPage.tsx
  - apps/web-vendor/src/pages/auth/AcceptInvitePage.tsx
  - apps/web-vendor/src/pages/auth/LoginPage.tsx
  - apps/web-vendor/src/router.tsx
  - apps/web-vendor/src/stores/uiStore.ts
  - apps/web-vendor/src/stores/vendorAuthStore.ts
  - packages/contracts/package.json
  - packages/contracts/tsup.config.ts
findings:
  critical: 6
  warning: 9
  info: 4
  total: 19
status: issues_found
---

# Phase 06: Code Review Report

**Reviewed:** 2026-06-05T12:00:00Z
**Depth:** standard
**Files Reviewed:** 67
**Status:** issues_found

## Summary

Phase 06 introduces the full admin and vendor control-plane: authentication, vendor lifecycle management, commission rules, payouts, feature flags, settings, audit log, analytics, vendor team management, coupons, inventory/pricing updates, and return management. Both an admin web panel and a vendor web panel were delivered.

The overall auth architecture is sound — httpOnly cookies, proper JWT role checks, no X-Internal-Admin-Token bypass remaining. However, six blockers were found that either permit incorrect financial data, introduce a cross-tenant data-access vulnerability, send the wrong HTTP body to a backend endpoint that validates it, cause incorrect CORS handling in production, allow COUPONS_ENABLED to incorrectly default to visible before the flag resolves, or bypass server-side return ownership checks.

---

## Critical Issues

### CR-01: Vendor returns approve endpoint skips ownership verification

**File:** `apps/api/src/routes/vendor/returns.ts:83`
**Issue:** `POST /vendor/returns/:id/approve` calls `service.approveReturn(request.params.id)` without passing `vendorId`. The `ReturnService.approveReturn` method receives only the return request ID. If ReturnService does not internally join back to `vendor_orders.vendorId` and compare it to the caller's vendorId, any authenticated vendor can approve another vendor's return request by guessing or knowing the return ID (UUID, so low probability in practice, but the ownership check is absent at the route layer). The `GET /vendor/returns` query correctly scopes by vendorId via an INNER JOIN, but the approve and reject POST paths do not pass vendorId to the service. Contrast with `InventoryOwnershipError` which is explicitly surfaced in inventory routes.

**Fix:** Pass the vendorId from the JWT to the service method and enforce ownership inside `ReturnService`:
```typescript
// In vendor/returns.ts, approve handler:
const vendorId = getVendorId(request);
await service.approveReturn(request.params.id, vendorId); // add vendorId param

// In ReturnService.approveReturn:
async approveReturn(returnId: string, vendorId: string): Promise<void> {
  // JOIN return_requests -> vendor_orders, assert vendor_orders.vendor_id = vendorId
  // throw ReturnRequestNotFoundError if not found or wrong vendor
  ...
}
```

---

### CR-02: CORS `origin` is a scalar string — multi-origin admin panel not supported; production misconfiguration risk

**File:** `apps/api/src/app.ts:86`
**Issue:** The CORS plugin receives `origin: env.STOREFRONT_ORIGIN` — a single string. The admin panel (web-admin) and vendor panel (web-vendor) are separate origins (different ports or subdomains). In production they require their own origin entries or the browser will block their credentialed requests with a CORS error. Supplying a single string means only the storefront can make credentialed requests; admin and vendor panels will fail silently for users (401 → loop to login).

Additionally, a scalar `origin` passed to `@fastify/cors` is interpreted as an allowed-origin matcher but is NOT the same as `origin: true`. If the env var is `https://store.example.com` then requests from `https://admin.example.com` will get a 200 but with no `Access-Control-Allow-Origin` header, causing browser-level CORS failure.

**Fix:**
```typescript
// env.ts: add ADMIN_PANEL_ORIGIN, VENDOR_PANEL_ORIGIN
await fastify.register(cors, {
  origin: [
    env.STOREFRONT_ORIGIN,
    env.ADMIN_PANEL_ORIGIN,
    env.VENDOR_PANEL_ORIGIN,
  ],
  credentials: true,
  methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
});
```

---

### CR-03: CatalogModerationPage reject sends empty body — backend Zod validation will reject it as 400

**File:** `apps/web-admin/src/pages/CatalogModerationPage.tsx:71`
**Issue:** The reject mutation calls `post<void>(\`/admin/products/${productId}/reject\`, {})` with an empty object `{}`. The backend route validates `RejectProductInputSchema` which requires `rejectionReason: z.string().min(1)`. This means every reject action from the Catalog Moderation page will return a 400 VALIDATION_ERROR and the mutation `onError` will show "Failed to reject product" — the feature is entirely broken. There is no UI to enter a rejection reason; the page was coded as if the reject action needs no input.

**Fix:** Add a rejection reason input (e.g., inline prompt or slide-over) and pass it in the body:
```typescript
// Add state: const [rejectReason, setRejectReason] = useState('');

const rejectMutation = useMutation({
  mutationFn: ({ productId, rejectionReason }: { productId: string; rejectionReason: string }) =>
    post<void>(`/admin/products/${productId}/reject`, { rejectionReason }),
  ...
});

// Replace direct mutate call with a slide-over/modal that captures rejectionReason first
```

---

### CR-04: PayoutManagementPage calls wrong API endpoint — `/admin/vendors/:id/payouts` instead of `/admin/payouts/:id`

**File:** `apps/web-admin/src/pages/PayoutManagementPage.tsx:59`
**Issue:** The payout data query fetches `/admin/vendors/${selectedVendorId}/payouts` (line 59) and the settlement mutation posts to `/admin/vendors/${selectedVendorId}/payouts/settlements` (line 65). However the backend routes are registered as:
- `GET /admin/payouts/:vendorId` (in `adminPayoutRoutes`)
- `POST /admin/payouts/:vendorId/settlements`

The `/admin/vendors/:id/payouts` path does not exist; both requests will receive a 404 from the server's `setNotFoundHandler`, causing the entire Payout Management page to be non-functional.

**Fix:**
```typescript
// Line 59 — fix queryFn path:
queryFn: () => get<AdminVendorPayoutResponse>(`/admin/payouts/${selectedVendorId}`),

// Line 65 — fix settlement mutation path:
mutationFn: (body: RecordSettlementInput) =>
  post<void>(`/admin/payouts/${selectedVendorId}/settlements`, body),
```

---

### CR-05: CouponsPage sends wrong field name for minimum order amount — `minOrderAmountMinor` vs `minOrderMinor`

**File:** `apps/web-vendor/src/pages/CouponsPage.tsx:107-113`
**Issue:** The `CreateCouponInput` interface defined locally in `CouponsPage.tsx` uses `minOrderAmountMinor` (line 40), but the backend `CreateCouponInputSchema` in `vendor/coupons.ts` uses the field name `minOrderMinor` (line 27). The mutation body therefore sends `{ ..., minOrderAmountMinor: ... }` which is unrecognized by Zod. Since `minOrderMinor` has `.optional()`, Zod will silently accept the request and set the field to `undefined`, causing it to fall back to 0 (the code in coupons.ts line 109 does `body.minOrderMinor ?? 0`). The minimum order amount entered by the vendor will be silently dropped and all coupons will have a minimum order of 0 regardless of what the vendor typed.

**Fix:** Align the frontend interface field name with the backend schema:
```typescript
// In CouponsPage.tsx, update the interface and the submit body:
interface CreateCouponInput {
  code: string;
  discountType: 'flat' | 'percent';
  discountValue: number;
  minOrderMinor: number;  // was: minOrderAmountMinor
  expiresAt?: string;
  maxRedemptions?: number;
}

// In handleCreateSubmit:
const body: CreateCouponInput = {
  code: code.trim().toUpperCase(),
  discountType,
  discountValue: ...,
  minOrderMinor: Math.round(parseFloat(minOrder) * 100),  // was: minOrderAmountMinor
};
```

Also update the list display — `coupon.minOrderAmountMinor` on line 208 of CouponsPage.tsx will be `undefined` since the DB column is `minOrderMinor`; replace with `coupon.minOrderMinor`.

---

### CR-06: Vendor sidebar `useCouponsEnabled` defaults to `true` before flag resolves — coupon nav item flashes for ineligible roles

**File:** `apps/web-vendor/src/components/layout/Sidebar.tsx:44`
**Issue:** The `useCouponsEnabled` hook returns `data ?? true` when `data` is `undefined` (i.e., while the React Query fetch is in-flight). This means the Coupons nav item is visible for all users during the initial load, including users whose role would be blocked by the server's `manager+owner` gate. More significantly, the nav item should default to `false` (hidden) until the flag is confirmed enabled, to match the server's behaviour of returning 404 when the feature is off. Defaulting to `true` violates the principle that a disabled flag means the feature is invisible.

**Fix:**
```typescript
// Line 44 — change the fallback:
return data ?? false; // hidden until flag is confirmed enabled
```

---

## Warnings

### WR-01: `configureVendor` audit log records stale `before.commissionOverridePercent` as always `null`

**File:** `apps/api/src/modules/vendor-management/VendorManagementService.ts:260`
**Issue:** The audit log's `before` object hard-codes `commissionOverridePercent: null` with a comment "approximate; current override not stored here". This means the before-state of the audit entry for `vendor.configured` is always incorrect when there is an existing commission override. Auditors cannot determine what the previous override was. This defeats the purpose of the before/after audit trail for commission data (T-06-24).

**Fix:** Query the existing vendor-scoped commission rule before making changes and include the real `ratePercent` in the `before` field:
```typescript
const existingOverride = await db.select()
  .from(commissionRules)
  .where(and(eq(commissionRules.scope, "vendor"), eq(commissionRules.vendorId, vendorId)))
  .limit(1);

// Then in auditService.log:
before: {
  categoryRestrictionIds: beforeRestrictions.map((r) => r.categoryId),
  commissionOverridePercent: existingOverride[0]?.ratePercent ?? null,
},
```

---

### WR-02: `configureVendor` replace-then-insert is not atomic — concurrent requests can corrupt restrictions

**File:** `apps/api/src/modules/vendor-management/VendorManagementService.ts:193-205`
**Issue:** The category restrictions replacement is two separate statements: DELETE all existing, then INSERT new set. There is no wrapping transaction. A concurrent request between the DELETE and INSERT will observe zero restrictions for the vendor, which could allow the vendor to temporarily sell in any category. All multi-step mutations should be wrapped in a Drizzle transaction.

**Fix:**
```typescript
await db.transaction(async (tx) => {
  await tx.delete(vendorCategoryRestrictions)
    .where(eq(vendorCategoryRestrictions.vendorId, vendorId));
  if (input.categoryRestrictionIds.length > 0) {
    await tx.insert(vendorCategoryRestrictions).values(
      input.categoryRestrictionIds.map((categoryId) => ({
        vendorId, categoryId, createdByAdminId: adminEmail,
      }))
    );
  }
  // also do commission upsert inside tx
});
```

---

### WR-03: `adminEmail` on request is used as UUID `createdByAdminId` in vendor category restrictions

**File:** `apps/api/src/modules/vendor-management/VendorManagementService.ts:202`
**Issue:** `createdByAdminId: adminEmail` stores an email address in what is described as an admin ID field. If the DB column `created_by_admin_id` is typed as `uuid`, this will cause a runtime DB type error. Even if it is a text column, the field semantics are wrong — entity IDs and emails are not interchangeable. In `adminAuth.ts`, `request.adminId` holds the JWT `sub` claim which is the actual admin user UUID. The route should pass `request.adminId` for the ID and separately log `adminEmail` for audit.

**Fix:** Pass `adminId` from `request.adminId` through to the service rather than the email string:
```typescript
// In admin/vendors.ts route, pass adminId separately:
await service.configureVendor(request.params.id, body, request.adminId!, request.adminEmail!);

// In VendorManagementService.configureVendor signature:
async configureVendor(vendorId: string, input: ConfigureVendorInput, adminId: string, adminEmail: string)

// Then:
createdByAdminId: adminId,  // proper UUID, not email
```

---

### WR-04: `POST /admin/auth/logout` and `POST /vendor/auth/logout` are unprotected — CSRF risk in non-SameSite-Strict cookie configurations

**File:** `apps/api/src/routes/admin/auth.ts:63` and `apps/api/src/routes/vendor/auth.ts:122`
**Issue:** Both logout endpoints require no authentication. `clearCookie` is called unconditionally regardless of caller. With `sameSite: "lax"` cookies, cross-site form POSTs from an attacker-controlled page can force a logout (CSRF logout). The cookie is cleared even for unauthenticated callers, so there is no way to distinguish a legitimate logout from a forced one. This is a medium-severity CSRF variant.

**Fix:** Require `requireAdminAuth` / `requireVendorAuth` on logout, or switch to `sameSite: "strict"` for auth cookies. The former approach is more correct and mirrors the `GET /admin/auth/me` pattern:
```typescript
fastify.post("/admin/auth/logout", { preHandler: requireAdminAuth }, async (_request, reply) => {
  void reply.clearCookie("admin_token", { path: "/" });
  return reply.send({ success: true, data: null });
});
```

---

### WR-05: `ReturnsPage` sends `{ reason }` to `/vendor/returns/:id/reject` but backend expects `{ rejectionReason }`

**File:** `apps/web-vendor/src/pages/ReturnsPage.tsx:82`
**Issue:** The reject mutation posts `{ reason: reason.trim() }` (line 82), but the backend `RejectInputSchema` in `vendor/returns.ts` line 25 validates `{ rejectionReason: z.string().min(1) }`. Zod will return a 400 VALIDATION_ERROR because `rejectionReason` is missing. The reject action on the vendor Returns page is fully broken.

**Fix:**
```typescript
// ReturnsPage.tsx line 82:
mutationFn: ({ id, reason }: { id: string; reason: string }) =>
  apiClient.post(`/vendor/returns/${id}/reject`, { rejectionReason: reason }),  // was: { reason }
```

---

### WR-06: `SettingsPage` (vendor) sends `returnsEnabled` but backend schema expects `isReturnable`

**File:** `apps/web-vendor/src/pages/SettingsPage.tsx:57-59`
**Issue:** The vendor settings page patches `/vendor/profile/return-policy` with body `{ returnWindowDays, returnsEnabled }`. The backend `UpdateReturnPolicyInputSchema` in `vendor/profile.ts` line 37-41 uses `isReturnable: z.boolean()`. The `returnsEnabled` field will be stripped by Zod (`isReturnable` is required, not optional), causing a validation failure. The return policy toggle feature is therefore non-functional from the vendor settings page.

**Fix:**
```typescript
// SettingsPage.tsx handleSubmit:
saveMutation.mutate({
  returnWindowDays: parseInt(returnWindowDays, 10),
  isReturnable: returnsEnabled,  // was: returnsEnabled
});

// Also update the local state type and the useEffect population:
const [isReturnable, setIsReturnable] = useState(true);
// In useEffect:
setIsReturnable(data.isReturnable);  // was: data.returnsEnabled
```

Note: the `VendorReturnPolicy` contract type should also be checked to confirm field name matches `isReturnable`.

---

### WR-07: `CmsPage` toggle mutation calls non-existent endpoint `/admin/homepage-blocks/:id/toggle`

**File:** `apps/web-admin/src/pages/CmsPage.tsx:230`
**Issue:** The toggle mutation sends `PATCH /admin/homepage-blocks/${id}/toggle` with `{ active }`. The backend only exposes `PATCH /admin/homepage-blocks/:id` (no `/toggle` sub-path). This will return a 404 from the not-found handler. To toggle a block's active state, the existing `PATCH /admin/homepage-blocks/:id` endpoint should be used.

**Fix:**
```typescript
const toggleMutation = useMutation({
  mutationFn: ({ id, active }: { id: string; active: boolean }) =>
    patch<void>(`/admin/homepage-blocks/${id}`, { active }),  // remove /toggle
  onSuccess: invalidate,
  ...
});
```

---

### WR-08: `vendorTeamRoutes` passes `vendorId` (vendors.id) as `invitedByUserId` — semantic mismatch

**File:** `apps/api/src/routes/vendor/team.ts:89`
**Issue:** The invite call passes `vendorId` for both the `vendorId` parameter and the `invitedByUserId` parameter: `service.invite(vendorId, vendorId, body)`. The comment says "use vendorId from JWT as the inviter identity (loose ref)" — but `invitedByUserId` semantically should be the `vendor_users.id` of the person sending the invite (the owner's user row ID), not the `vendors.id`. While this may not break functionality if the field is purely informational, it will be confusing in audit trails. The JWT carries both `sub` (vendor_users.id) and `vendorId` — the `sub` should be used for `invitedByUserId`.

**Fix:** Expose `request.vendorUserId` in `requireVendorAuth` (from `payload["sub"]`) and use it:
```typescript
// vendorAuth.ts: also set request.vendorUserId = payload["sub"] as string;
// vendor/team.ts invite handler:
const invite = await service.invite(vendorId, request.vendorUserId, body);
```

---

### WR-09: `adminAuth.ts` accepts Bearer token in addition to cookie — widens attack surface without additional validation

**File:** `apps/api/src/middleware/adminAuth.ts:40-45`
**Issue:** The admin auth middleware accepts a Bearer token from the `Authorization` header as well as the httpOnly cookie. This is described as being "for API clients / integration tests", but in a production admin panel that should only be accessible from the web app, accepting Bearer tokens means an XSS payload can exfiltrate the token from any non-httpOnly storage and replay it against admin endpoints. The vendor middleware has the same pattern. If Bearer header support is kept, it should be gated by environment (disabled in production), or the implementation should document clearly that admin tokens must never be stored client-side.

**Fix:** Either restrict Bearer header auth to non-production environments or document a clear threat model. At minimum add a warning comment:
```typescript
// WARNING: Bearer header auth bypasses httpOnly cookie protection.
// Only enable in development/test environments.
if (process.env["NODE_ENV"] !== "production") {
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  }
}
```

---

## Info

### IN-01: `void vendor` dead statement at end of `configureVendor`

**File:** `apps/api/src/modules/vendor-management/VendorManagementService.ts:268`
**Issue:** `void vendor;` is a no-op. The `vendor` variable is loaded via `this.loadVendor()` but never read — only the side-effect (throwing if vendor not found) is used. The `void` statement serves only as a lint suppression for an unused variable. This is a dead code pattern that should use the return value or be restructured.

**Fix:** Either use the `vendor` row in the audit log `before` state (useful for including vendor name), or change the call to a dedicated "assert vendor exists" helper that does not assign a return value.

---

### IN-02: `SettingsPage` (admin) sends redundant `key` field in PATCH body

**File:** `apps/web-admin/src/pages/SettingsPage.tsx:176`
**Issue:** The save mutation posts `{ key, value }` to `PATCH /admin/settings/:key`. The backend handler in `admin/settings.ts:41-44` extracts the key from `request.params.key` and ignores the body's `key` field. Sending the key twice is harmless but redundant and could confuse future readers about where the key is authoritative.

**Fix:**
```typescript
mutationFn: ({ key, value }: { key: MarketplaceSettingKey; value: unknown }) =>
  patch<void>(`/admin/settings/${key}`, { value }),  // remove key from body
```

---

### IN-03: `DashboardPage` (admin) uses `data.ordersByDay` without null guard when `data` is only guarded as truthy

**File:** `apps/web-admin/src/pages/DashboardPage.tsx:148`
**Issue:** `data.ordersByDay.length > 0` is accessed inside `{s && (<>` but `s` is `data?.summary`, not `data`. If the API returns `{ summary: {...}, ordersByDay: undefined }` (e.g., a partial response), this will throw a runtime error. The pattern should consistently guard `data` not just `s`:
```typescript
{data && s && (
  <>
    ...
    {data.ordersByDay?.length > 0 ? ...}
```

---

### IN-04: `web-vendor/package.json` not reviewed for dependency versions

**File:** `apps/web-vendor/package.json`
**Issue:** The web-vendor `package.json` was in the file list but its contents were not included in the review reading. Dependency version alignment (e.g., `motion/react` import vs `framer-motion` package name) should be verified. The web-vendor app uses `import { motion } from 'motion/react'` (consistent with Framer Motion 12.x rebranding) while web-admin uses `import { motion } from 'framer-motion'`. Both are valid for the same package (`framer-motion@12.x` exports both paths), but confirm `framer-motion` is listed in `web-vendor/package.json` since the import path `motion/react` requires it.

---

_Reviewed: 2026-06-05T12:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
