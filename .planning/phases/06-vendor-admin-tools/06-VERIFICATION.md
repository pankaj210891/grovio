---
phase: 06-vendor-admin-tools
verified: 2026-06-05T14:00:00Z
status: human_needed
score: 17/17 must-haves verified
overrides_applied: 0
human_verification:
  - test: "Vendor login and role-aware sidebar end-to-end"
    expected: "Owner sees Team, Store Profile, Settings; manager/staff do not. Coupons hidden when COUPONS_ENABLED off. Redirect to /dashboard after login."
    why_human: "Role-conditional rendering and feature-flag reactive UI require a live session with different role credentials to observe"
  - test: "Inventory inline edit persists after page refresh"
    expected: "After editing qty/price, saving, and refreshing, the new values appear — confirming backend persistence, not just optimistic cache update"
    why_human: "Requires running backend + DB to verify the PATCH actually wrote to the inventory/pricing tables"
  - test: "Returns approve flow triggers refund"
    expected: "Approving a return request results in the customer's wallet/payment being credited — confirms ReturnService actually executes the refund leg"
    why_human: "Requires end-to-end wallet/payment path; cannot verify refund outcome from frontend code alone"
  - test: "Team invite accept flow"
    expected: "Staff member receives invite link, opens /accept-invite?token=, sets password, logs in as staff, cannot see Team/Store Profile/Settings nav items"
    why_human: "Requires email delivery or console link inspection, then a second browser session with staff credentials"
  - test: "Admin dashboard charts render with real data (7d/30d/90d toggle)"
    expected: "LineChart and BarChart populate from GET /admin/analytics/summary and /charts responses; period toggle reloads data"
    why_human: "Requires seeded data and running backend to confirm charts receive non-empty payloads"
  - test: "Vendor lifecycle: approve, suspend, reinstate"
    expected: "A suspended vendor cannot log into the vendor panel; reinstate re-enables access"
    why_human: "Requires vendor_users DB state transitions and cookie session invalidation — not verifiable from static code"
  - test: "CommissionRules global rule 403 enforcement"
    expected: "A DELETE attempt on the global rule via devtools/API returns 403; UI shows no Delete button for the global row"
    why_human: "The no-delete-button in UI is verified statically (VERIFIED below), but the backend 403 guard must be confirmed via an actual request"
  - test: "CMS reorder affects storefront homepage"
    expected: "After reordering blocks in admin CmsPage, the storefront homepage reflects the updated order within one refresh (Redis cache invalidated)"
    why_human: "Requires running storefront + admin panel + Redis to observe cache invalidation propagation"
  - test: "FeatureFlags COUPONS_ENABLED toggle propagates to vendor sidebar"
    expected: "Toggling COUPONS_ENABLED off in admin panel causes the Coupons nav item to disappear in the vendor sidebar on next page load"
    why_human: "Requires two running SPA instances and a live flag toggle to observe the cross-panel propagation"
  - test: "Settlement record audit trail"
    expected: "Recording a settlement via PayoutManagementPage creates an append-only settlement row and an audit_log entry with action 'payout.settled'"
    why_human: "Requires running backend + DB inspection to confirm audit_log write and settlement immutability"
---

# Phase 06: Vendor & Admin Tools Verification Report

**Phase Goal:** Vendors have a complete operational panel for onboarding, product management, inventory, orders, earnings, and team access; admins have a full marketplace control plane covering vendors, commissions, payouts, moderation, CMS, branding, settings, feature flags, and analytics
**Verified:** 2026-06-05T14:00:00Z
**Status:** human_needed
**Re-verification:** No — initial verification

## Goal Achievement

### Observable Truths

| # | Truth | Status | Evidence |
|---|-------|--------|---------|
| 1 | VEN-01: Vendor can log in via cookie auth and see a role-aware sidebar panel | VERIFIED | `apps/web-vendor/src/lib/apiClient.ts` has `credentials: 'include'` on all methods; router.tsx uses `createBrowserRouter`; `ProtectedVendorRoute` guards the panel; no X-Internal token header present |
| 2 | VEN-02: Vendor dashboard with KPI cards + period toggle (7d/30d/90d) + low-stock alerts | VERIFIED | `DashboardPage.tsx` implements 7d/30d/90d `PERIODS` array, `period` state, `queryKey: ['vendorDashboard', period]`, and fetches `GET /vendor/dashboard?period=${period}`; KPI cards confirmed in JSX |
| 3 | VEN-03: Inline inventory qty + price editing via PATCH /vendor/inventory/:id and /vendor/products/:productId/pricing | VERIFIED | `InventoryPage.tsx` has `updateQtyMutation` → `PATCH /vendor/inventory/${inventoryItemId}` and `updatePriceMutation` → `PATCH /vendor/products/${productId}/pricing`; `quantityReserved` is rendered in a `readOnly` input |
| 4 | VEN-04: Returns approve/reject with ownership check; backend scopes by vendorId | VERIFIED | `ReturnsPage.tsx` sends `{ rejectionReason: reason }` (WR-05 fixed); reject button `disabled={...!reason.trim()}`; `vendor/returns.ts` backend has JOIN-based ownership check (CR-01 fixed) before calling service |
| 5 | VEN-05: TeamPage owner-only with invite (manager/staff roles only, not owner) | VERIFIED | `TeamPage.tsx` route guarded by `<ProtectedVendorRoute requiredRole="owner" />`; invite select offers only `manager` and `staff` options; owner option intentionally omitted (comment at line 247) |
| 6 | VEN-06: Coupons nav item defaults to hidden (false) and only appears when COUPONS_ENABLED is confirmed on | VERIFIED | `Sidebar.tsx` `useCouponsEnabled` hook returns `data ?? false` (CR-06 fixed); Coupons item conditionally added only when `couponsEnabled` is truthy |
| 7 | MKT-05: EarningsPage has Outstanding Balance card + commission ledger + settlements from GET /vendor/earnings | VERIFIED | `EarningsPage.tsx` fetches `GET /vendor/earnings`; Outstanding Balance `SummaryCard` with `highlight` prop; `commissionEntries` table; `settlements` table — all wired to `data.summary.outstandingBalanceMinor` etc. |
| 8 | ADM-01: Admin logs in via cookie auth (no X-Internal-Admin-Token) and accesses dashboard with recharts charts | VERIFIED | `apiClient.ts` has `credentials: 'include'` throughout; grep for `X-Internal-Admin-Token` returns only a comment (not functional code); `DashboardPage.tsx` uses `MiniLineChart` + `MiniBarChart` from recharts wrappers; period toggle (7d/30d/90d) implemented |
| 9 | ADM-02: VendorsPage approve/suspend/reinstate with colored status badges | VERIFIED | `VendorsPage.tsx` has `STATUS_BADGE` map (pending=amber, approved=green, suspended=red, archived=gray); row actions gated by `onboardingStatus` — Approve for pending, Suspend for approved, Reinstate for suspended |
| 10 | ADM-03: CommissionRulesPage global rule pinned with no delete button; category/vendor overrides have CRUD | VERIFIED | `CommissionRulesPage.tsx`: global section has only "Edit Rate" button (comment `// NOTE: No delete button for global rule (T-06-33)`); `OverrideTable` component renders Edit+Delete for category/vendor overrides |
| 11 | ADM-04: CmsPage Up/Down reorder buttons (no drag-and-drop); active toggle; type-specific edit modal | VERIFIED | `CmsPage.tsx` has ▲/▼ buttons calling `reorderMutation` with `{ direction: 'up'/'down' }`; toggle calls `PATCH /admin/homepage-blocks/${id}` with `{ active }` (WR-07 fixed, no `/toggle` sub-path); `BlockForm` handles banner/product_grid/text_block/featured_categories |
| 12 | ADM-05: SettingsPage with integration secret keys masked/read-only | VERIFIED | `SettingsPage.tsx` has `SECRET_KEYS` array; masked fields rendered with `value="••••••••••••"` + `readOnly` attribute; `aria-label` confirms "masked — read-only" |
| 13 | ADM-06: FeatureFlagsPage toggles via PATCH /admin/feature-flags/:key | VERIFIED | `FeatureFlagsPage.tsx` `toggleMutation` calls `patch<void>(\`/admin/feature-flags/${key}\`, { enabled })`; toggle button wired to mutation |
| 14 | ADM-07: AuditLogPage filterable (actor, action, entity, date range) + CatalogModerationPage approve/reject with rejectionReason | VERIFIED | `AuditLogPage.tsx` has 5 filter inputs (actorType, action, entityType, from, to) building query string; `CatalogModerationPage.tsx` (CR-03 fixed) captures `rejectReason` via inline modal before firing mutation with `{ rejectionReason }` body |
| 15 | MKT-04: PayoutManagementPage uses /admin/payouts/:vendorId paths with decimal settlement amount | VERIFIED | `PayoutManagementPage.tsx` queries `GET /admin/payouts/${selectedVendorId}` and posts `POST /admin/payouts/${selectedVendorId}/settlements` (CR-04 fixed); settlement `amount` input is `type="text"` with decimal pattern `^\d+(\.\d{1,2})?$` |
| 16 | Security: app.ts CORS includes admin + vendor origins (CR-02) | VERIFIED | `app.ts` CORS `origin` array: `[env.STOREFRONT_ORIGIN, env.WEB_ADMIN_URL, env.WEB_VENDOR_URL]` |
| 17 | Security: adminAuth.ts Bearer token disabled in production; no X-Internal-Admin-Token fallback (WR-09) | VERIFIED | `adminAuth.ts` wraps Bearer header extraction in `process.env["NODE_ENV"] !== "production"` guard; no functional X-Internal-Admin-Token code present (only comment reference) |

**Score:** 17/17 truths verified

### Required Artifacts

| Artifact | Expected | Status | Details |
|----------|----------|--------|---------|
| `apps/web-vendor/src/lib/apiClient.ts` | Cookie-credentialed fetch (no token header) | VERIFIED | `credentials: 'include'` on get/post/patch/delete; ApiError class; BASE_URL from VITE_API_URL |
| `apps/web-vendor/src/router.tsx` | createBrowserRouter with protected panel routes | VERIFIED | Public: /auth/login, /accept-invite; Protected: / → ProtectedVendorRoute → PanelLayout; owner-only: team/store-profile/settings wrapped in `<ProtectedVendorRoute requiredRole="owner"/>` |
| `apps/web-vendor/src/components/layout/Sidebar.tsx` | Role-aware nav with COUPONS_ENABLED gate | VERIFIED | `useCouponsEnabled` returns `data ?? false`; Coupons conditionally added; ownerOnly items filtered when `!isOwner` |
| `apps/web-vendor/src/pages/EarningsPage.tsx` | Outstanding balance + commission ledger + settlements | VERIFIED | 241 lines; `SummaryCard` with `highlight` prop for Outstanding Balance; two complete tables for ledger and settlements |
| `apps/web-vendor/src/pages/InventoryPage.tsx` | Inline qty+price edit; quantity_reserved read-only | VERIFIED | Edit slide-over panel; `quantityReserved` in `readOnly` input; PATCH mutations for both qty and price |
| `apps/web-vendor/src/pages/ReturnsPage.tsx` | Approve/reject with WR-05 fix (rejectionReason) | VERIFIED | Reject mutation sends `{ rejectionReason: reason }`; submit button `disabled={...!reason.trim()}` |
| `apps/web-vendor/src/pages/TeamPage.tsx` | Owner-only; invite role select manager/staff only | VERIFIED | Select offers Manager + Staff options only; owner option absent with comment explaining T-06-02 |
| `apps/web-admin/src/App.tsx` | createBrowserRouter with PanelLayout + preserved /categories and /categories/:id routes | VERIFIED | Both `{ path: 'categories', element: <CategoryListPage /> }` and `{ path: 'categories/:id', element: <CategoryDetailPage /> }` present under PanelLayout |
| `apps/web-admin/src/lib/apiClient.ts` | Cookie auth; no X-Internal-Admin-Token | VERIFIED | `credentials: 'include'` in all requests; comment explicitly notes token bypass removed; only comment reference to old token |
| `apps/web-admin/src/pages/PayoutManagementPage.tsx` | /admin/payouts/:vendorId paths (CR-04); decimal settlement | VERIFIED | 451 lines; CR-04 comment confirms corrected paths; settlement amount is `type="text"` with decimal pattern |
| `apps/web-admin/src/pages/CommissionRulesPage.tsx` | Global pinned no-delete; overrides CRUD | VERIFIED | No delete button in global section (comment confirms T-06-33); OverrideTable shows Edit+Delete for overrides |
| `apps/web-admin/src/pages/CmsPage.tsx` | Up/Down reorder (no drag-and-drop); active toggle at correct path | VERIFIED | ▲/▼ buttons with direction param; toggleMutation uses PATCH /admin/homepage-blocks/${id} (WR-07 fixed) |
| `apps/web-admin/src/pages/FeatureFlagsPage.tsx` | Toggle list PATCH /admin/feature-flags/:key | VERIFIED | Toggle calls `patch<void>(\`/admin/feature-flags/${key}\`, { enabled: !flag.isEnabled })` |
| `apps/web-admin/src/pages/AuditLogPage.tsx` | Multi-filter with before/after diffs | VERIFIED | 5 filter inputs; `buildQueryString` builds query params; `AuditRow` with expand/collapse for before/after diffs |
| `apps/api/src/app.ts` | CORS with all 3 origins; all Phase 6 routes registered | VERIFIED | CORS origin is array of 3 env vars; all 9 admin + 8 vendor Phase 6 route plugins registered |
| `apps/api/src/middleware/adminAuth.ts` | Bearer token production-gated; cookie path always active | VERIFIED | Bearer extraction conditional on `process.env["NODE_ENV"] !== "production"`; cookie path unconditional |
| `apps/api/src/routes/vendor/returns.ts` | Ownership check via JOIN before approve/reject (CR-01) | VERIFIED | Both approve and reject handlers perform `innerJoin(vendorOrders, ...)` + `eq(vendorOrders.vendorId, vendorId)` ownership check before calling service |

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `web-vendor/apiClient.ts` | backend /vendor/* | `credentials: 'include'` on every fetch method | WIRED | All 4 methods (get/post/patch/delete) include `credentials: 'include'` |
| `Sidebar.tsx` | COUPONS_ENABLED flag | `useCouponsEnabled()` → `GET /feature-flags/COUPONS_ENABLED`, returns `data ?? false` | WIRED | CR-06 fix confirmed; defaults to false (hidden) while loading |
| `web-admin/apiClient.ts` | backend /admin/* | `credentials: 'include'`; 401 → redirect to /auth/login | WIRED | All helpers call `request()` which has `credentials: 'include'` and 401 redirect |
| `App.tsx` | existing category pages | preserved `/categories` + `/categories/:id` routes under PanelLayout | WIRED | Both category routes confirmed present in createBrowserRouter config |
| `PayoutManagementPage.tsx` | /admin/payouts/:vendorId | GET and POST using correct path post CR-04 fix | WIRED | Comments cite CR-04; both query and mutation use `/admin/payouts/${selectedVendorId}` |
| `ReturnsPage.tsx` | /vendor/returns/:id/reject | `{ rejectionReason: reason }` body (WR-05 fix) | WIRED | Mutation sends `rejectionReason` key matching backend `RejectInputSchema` |
| `CmsPage.tsx` | PATCH /admin/homepage-blocks/:id | toggle uses base PATCH path (no /toggle — WR-07 fix) | WIRED | `toggleMutation` calls `patch<void>(\`/admin/homepage-blocks/${id}\`, { active })` |
| `vendor/returns.ts` | returnRequests scoped to vendorId | JOIN-based ownership check (CR-01) | WIRED | `innerJoin(vendorOrders, eq(returnRequests.vendorOrderId, vendorOrders.id))` + `eq(vendorOrders.vendorId, vendorId)` |

### Data-Flow Trace (Level 4)

| Artifact | Data Variable | Source | Produces Real Data | Status |
|----------|---------------|--------|--------------------|--------|
| `EarningsPage.tsx` | `data.summary.outstandingBalanceMinor` | `useQuery` → `GET /vendor/earnings` → `vendorEarningsRoutes` | Backend queries commission_entries + vendor_payout_settlements tables | FLOWING |
| `InventoryPage.tsx` | `data` (InventoryItem[]) | `useQuery` → `GET /vendor/inventory` → `vendorInventoryRoutes` | Backend queries inventory + products tables (confirmed in 06-08 SUMMARY) | FLOWING |
| `PayoutManagementPage.tsx` | `payoutData` | `useQuery` → `GET /admin/payouts/${selectedVendorId}` → `adminPayoutRoutes` | Backend queries commission_entries + vendor_payout_settlements; requires vendor selection | FLOWING |
| `CommissionRulesPage.tsx` | `data.global`, `data.categoryOverrides`, `data.vendorOverrides` | `useQuery` → `GET /admin/commission-rules` → `adminCommissionRuleRoutes` | Backend queries commission_rules table scoped by scope | FLOWING |
| `FeatureFlagsPage.tsx` | `data.flags` | `useQuery` → `GET /admin/feature-flags` → `adminFeatureFlagRoutes` | Backend queries feature_flags table via FeatureFlagService | FLOWING |
| `AuditLogPage.tsx` | `data.items` | `useQuery` → `GET /admin/audit-log?...` → `adminAuditLogRoutes` | Backend queries audit_log table with AuditLogQuery filters | FLOWING |
| `DashboardPage.tsx` (admin) | `data.ordersByDay`, `data.gmvByCategory` | `useQuery` → `GET /admin/analytics/summary?period=` → `adminAnalyticsRoutes` | Backend computes from orders/vendor_orders tables via AnalyticsService | FLOWING |

### Behavioral Spot-Checks

Step 7b: SKIPPED — requires running backend (PostgreSQL + Redis + OpenSearch) to produce meaningful results. All API routes are registered in app.ts and data-flow traces confirm real DB queries back each page. The build/lint passes confirmed in SUMMARY are the closest automated check.

### Probe Execution

No probe scripts found at `scripts/*/tests/probe-*.sh` for Phase 6. Phase 6 is a UI + API wiring phase; the equivalent automated check documented in 06-08 SUMMARY is the test suite pass (530/530 tests) confirmed in that plan's verification section.

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|-------------|-------------|--------|---------|
| VEN-01 | 06-09 | Vendor can complete onboarding and manage store profile | SATISFIED | Login page, StoreProfilePage (owner-only), SettingsPage with return policy, cookie auth established |
| VEN-02 | 06-09 | Vendor has a dashboard summarizing orders, earnings, inventory health | SATISFIED | DashboardPage with KPI cards, period toggle, low-stock alerts list |
| VEN-03 | 06-09 | Vendor can manage inventory levels and pricing | SATISFIED | InventoryPage with inline edit, PATCH mutations for qty and price, read-only reserved |
| VEN-04 | 06-09 | Vendor can manage orders and handle returns | SATISFIED | OrdersPage for order management; ReturnsPage for approve/reject with ownership enforcement |
| VEN-05 | 06-09 | Vendor owner can invite staff and assign limited permissions | SATISFIED | TeamPage owner-only; invite offers manager/staff only; remove staff capability |
| VEN-06 | 06-09 | Vendor can manage coupons where enabled | SATISFIED | CouponsPage with list + create form; Coupons nav gated by COUPONS_ENABLED (defaults false) |
| MKT-04 | 06-10 | Admin can view payout records and record manual settlement | SATISFIED | PayoutManagementPage with ledger + summary strip + decimal settlement recording |
| MKT-05 | 06-09 | Vendor can view earnings and payout status | SATISFIED | EarningsPage with Outstanding Balance card, commission ledger, settlements table |
| ADM-01 | 06-10 | Admin has dashboard with KPIs and reporting | SATISFIED | DashboardPage with 6 KPI cards, recharts line + bar charts, top-5 vendors table, period toggle |
| ADM-02 | 06-10 | Admin can manage vendors (approve, suspend, configure) | SATISFIED | VendorsPage with colored status badges and lifecycle actions |
| ADM-03 | 06-10 | Admin can configure commission rules | SATISFIED | CommissionRulesPage: global pinned (no delete), category + vendor overrides with full CRUD |
| ADM-04 | 06-10 | Admin can manage CMS/content blocks | SATISFIED | CmsPage with Up/Down reorder, active toggle, type-specific edit modals |
| ADM-05 | 06-10 | Admin can manage global settings, integrations, branding | SATISFIED | SettingsPage with grouped sections; secret keys masked/read-only (smtp_sender_email) |
| ADM-06 | 06-10 | Admin can manage feature flags | SATISFIED | FeatureFlagsPage with toggle list, PATCH /admin/feature-flags/:key per toggle |
| ADM-07 | 06-10 | Admin can moderate catalog and view audit log | SATISFIED | CatalogModerationPage with approve/reject + rejectionReason (CR-03); AuditLogPage with 5-dimensional filter + before/after diffs |

### Anti-Patterns Found

| File | Line | Pattern | Severity | Impact |
|------|------|---------|----------|--------|
| `apps/web-vendor/src/pages/CouponsPage.tsx` | 80 | `return []` inside queryFn catch block when flag is 404 | Info | Intentional: graceful degradation when COUPONS_ENABLED is off returns empty list; not a stub — feature-flag gate is working as designed |

No TBD, FIXME, or XXX markers found in modified files. No unresolved debt markers. All `placeholder` strings found are legitimate HTML input placeholder attributes (not content stubs).

### Human Verification Required

**The following items require a running environment to confirm. All automated checks passed.**

#### 1. Vendor Role Restrictions End-to-End

**Test:** Log in as vendor owner, then as manager, then as staff member. Observe sidebar nav contents at each role level.
**Expected:** Owner sees all 10 nav items including Team, Store Profile, Settings. Manager/staff do not see those 3 items. Coupons absent for all when COUPONS_ENABLED is false in DB.
**Why human:** Role-conditional rendering requires live authentication with different role credentials; cannot be verified by static code analysis alone.

#### 2. Inventory Inline Edit Persistence

**Test:** Edit a quantity and price on InventoryPage, save, hard-refresh the page.
**Expected:** New values displayed after refresh — confirming backend DB write, not just React Query cache.
**Why human:** Requires running backend + PostgreSQL to confirm write persistence.

#### 3. Returns Approve Refund Flow

**Test:** Approve a return request on ReturnsPage.
**Expected:** Customer's wallet or payment is credited; return status updates to approved.
**Why human:** Refund execution depends on ReturnService + payment/wallet integration — not verifiable from frontend code.

#### 4. Team Invite Accept Flow

**Test:** Invite a staff member from TeamPage, open the link, set password on AcceptInvitePage, log in as that staff user.
**Expected:** Staff user cannot navigate to Team, Store Profile, or Settings routes; is redirected to /dashboard.
**Why human:** Requires email delivery or console log inspection, then a second browser session with new credentials.

#### 5. Admin Dashboard Charts with Live Data

**Test:** Start backend with seeded data, log into admin panel, toggle 7d/30d/90d.
**Expected:** LineChart and BarChart render with non-empty data points; period toggle reloads and updates charts.
**Why human:** Requires seeded order data + running AnalyticsService to produce non-empty chart payloads.

#### 6. Vendor Lifecycle Suspension Enforcement

**Test:** Suspend an approved vendor in admin VendorsPage. Try to log in as that vendor.
**Expected:** Suspended vendor's login is rejected (or session invalidated); reinstating re-enables access.
**Why human:** Requires vendor_users table state + auth middleware suspension check — cannot be verified statically.

#### 7. Global Commission Rule Backend 403 Guard

**Test:** Attempt DELETE /admin/commission-rules/{globalRuleId} via browser devtools/curl.
**Expected:** Backend returns 403 with CommissionRuleProtectedError.
**Why human:** The UI correctly shows no delete button (verified), but the backend guard must be confirmed via an actual API request.

#### 8. CMS Reorder Storefront Cache Invalidation

**Test:** Reorder blocks in CmsPage. Refresh the storefront homepage.
**Expected:** Homepage blocks appear in the new order within one page refresh.
**Why human:** Requires running storefront + Redis to observe HomepageService cache invalidation propagation.

#### 9. Feature Flag Vendor Panel Propagation

**Test:** Toggle COUPONS_ENABLED off in admin FeatureFlagsPage. Navigate to vendor panel sidebar.
**Expected:** Coupons nav item disappears on next page load (staleTime is 5 minutes, so refresh or wait).
**Why human:** Cross-panel real-time propagation requires both SPAs running simultaneously.

#### 10. Settlement Audit Trail

**Test:** Record a settlement in PayoutManagementPage. Check audit_log table.
**Expected:** New audit_log row with action 'payout.settled', correct amounts, admin actor.
**Why human:** Requires DB inspection to confirm audit_log write alongside the settlement record.

### Gaps Summary

No gaps. All 17 must-have truths are VERIFIED against actual codebase evidence. All code review fixes (CR-01 through CR-06) and work review fixes (WR-01 through WR-09) have been applied and verified. Status is `human_needed` because 10 end-to-end behavioral items require a running environment to confirm — these are standard UI/UX and integration behaviors that cannot be validated by static code analysis.

---

_Verified: 2026-06-05T14:00:00Z_
_Verifier: Claude (gsd-verifier)_
