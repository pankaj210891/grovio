---
phase: 06-vendor-admin-tools
plan: 09
subsystem: ui
tags: [react, react-router-dom, zustand, react-query, motion, tailwind, vendor-panel, role-based-access]

# Dependency graph
requires:
  - phase: 06-vendor-admin-tools
    provides: Phase 6 backend vendor routes, role guards, auth endpoints, earnings/inventory/returns/coupons/team APIs (06-03 through 06-08)
provides:
  - Complete vendor SPA (apps/web-vendor) wired to Phase 6 backend
  - Cookie-credentialed apiClient + queryClient
  - Zustand vendorAuthStore (session probe, login/logout mutations, role)
  - useVendorAuth hook with hasRole(owner > manager > staff) hierarchy
  - ProtectedVendorRoute with optional requiredRole prop
  - PanelLayout: collapsible Sidebar + Header + AnimatePresence Outlet
  - Role-aware Sidebar: Team/Store Profile hidden for non-owners; Coupons hidden when COUPONS_ENABLED off
  - 12 vendor pages covering VEN-01 through VEN-06 and MKT-05
affects: [06-10, storefront-phase, mobile-phase]

# Tech tracking
tech-stack:
  added:
    - react-router-dom 7.16.0 (added to apps/web-vendor — was missing from the package)
  patterns:
    - Cookie-credentialed fetch apiClient (credentials:'include') shared across all vendor API calls
    - Session probe pattern: GET /vendor/auth/me on app mount to restore auth state
    - hasRole hierarchy helper: owner > manager > staff (ordinal comparison)
    - ProtectedVendorRoute wraps layout outlet; requiredRole variant wraps individual routes
    - AnimatePresence mode="wait" keyed on location.pathname for smooth page transitions
    - Inline click-to-edit for inventory quantity and price with React Query invalidation on save
    - Minor-unit money display: all amounts divided by 100 before rendering

key-files:
  created:
    - apps/web-vendor/src/lib/apiClient.ts
    - apps/web-vendor/src/lib/queryClient.ts
    - apps/web-vendor/src/stores/vendorAuthStore.ts
    - apps/web-vendor/src/stores/uiStore.ts
    - apps/web-vendor/src/hooks/useVendorAuth.ts
    - apps/web-vendor/src/components/layout/ProtectedVendorRoute.tsx
    - apps/web-vendor/src/components/layout/PanelLayout.tsx
    - apps/web-vendor/src/components/layout/Sidebar.tsx
    - apps/web-vendor/src/components/layout/Header.tsx
    - apps/web-vendor/src/router.tsx
    - apps/web-vendor/src/pages/auth/LoginPage.tsx
    - apps/web-vendor/src/pages/auth/AcceptInvitePage.tsx
    - apps/web-vendor/src/pages/DashboardPage.tsx
    - apps/web-vendor/src/pages/ProductsPage.tsx
    - apps/web-vendor/src/pages/InventoryPage.tsx
    - apps/web-vendor/src/pages/OrdersPage.tsx
    - apps/web-vendor/src/pages/ReturnsPage.tsx
    - apps/web-vendor/src/pages/EarningsPage.tsx
    - apps/web-vendor/src/pages/CouponsPage.tsx
    - apps/web-vendor/src/pages/TeamPage.tsx
    - apps/web-vendor/src/pages/StoreProfilePage.tsx
    - apps/web-vendor/src/pages/SettingsPage.tsx
  modified:
    - apps/web-vendor/package.json (added react-router-dom dependency)
    - apps/web-vendor/src/main.tsx (switched from placeholder App to RouterProvider + QueryClientProvider)

key-decisions:
  - "Cookie-credentialed fetch (credentials:'include') used on all API calls — no token in localStorage; session is server-managed httpOnly cookie"
  - "hasRole hierarchy implemented as ordinal comparison (owner=2 > manager=1 > staff=0) so a single helper covers all role checks"
  - "COUPONS_ENABLED flag read from GET /feature-flags public endpoint in Sidebar — nav item hidden client-side; backend enforces independently"
  - "Team and Store Profile nav items hidden for non-owner roles at UI layer; backend (06-08) remains the enforcing authority (T-06-30 disposition)"
  - "AcceptInvitePage reads token from query string and POSTs to /vendor/team/accept-invite; redirects to /auth/login with success message on completion"
  - "Inline editing in InventoryPage uses local edit state + PATCH on blur/save; quantity_reserved is read-only column"
  - "ReturnsPage enforces non-empty rejection reason in component state before enabling submit — matches Phase 6 backend validation"
  - "EarningsPage Outstanding Balance card derives value from earned - reversed - settled in the response payload"
  - "Money always displayed in major units: minor_units / 100 with currency from config"

patterns-established:
  - "Session probe on mount: useVendorAuth calls GET /vendor/auth/me; 200 sets auth store, 401 clears it — no redirect on probe failure (redirect handled by ProtectedVendorRoute)"
  - "ProtectedVendorRoute pattern: wait for isLoading; if unauthenticated navigate to /auth/login; if role insufficient navigate to /dashboard"
  - "AnimatePresence Outlet: PanelLayout wraps <Outlet> in <AnimatePresence mode=wait> keyed on pathname for cross-page transitions (motion/react)"
  - "All pages follow CategoryListPage template: motion entry animation, useQuery data fetch, loading/error/empty state branches, toast on mutation success"
  - "Slide-over create/edit panels: AnimatePresence controlled by local boolean state, same pattern as admin CategoryListPage"

requirements-completed: [VEN-01, VEN-02, VEN-03, VEN-04, VEN-05, VEN-06, MKT-05]

# Metrics
duration: ~90min
completed: 2026-06-05
---

# Phase 06 Plan 09: Vendor Panel SPA Summary

**Full vendor SPA built on react-router-dom with cookie auth, role-aware sidebar, and 12 pages covering inventory inline-edit, returns approve/reject, earnings ledger, team invite/accept, and feature-gated coupons**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-05
- **Completed:** 2026-06-05
- **Tasks:** 3 (2 auto + 1 human-verify checkpoint)
- **Files modified:** 24

## Accomplishments

- Cookie-credentialed apiClient and queryClient established as the vendor panel's API layer, eliminating any localStorage token exposure
- Full authentication flow: login, session probe on mount, logout, and team-invite acceptance via token link
- Role-aware layout and routing: owner-only sections (Team, Store Profile, Settings payout/return policy) guarded at both the sidebar and route level; staff limited to order shipping actions only; COUPONS_ENABLED feature flag gates the Coupons nav item
- Inline inventory and pricing editing (InventoryPage) with read-only quantity_reserved, PATCH-on-save, and toast confirmation
- EarningsPage with Outstanding Balance card, summary strip, commission ledger table, and settlements received table (MKT-05)
- Human verification confirmed all role restrictions, inline edits, returns flows, team invite/accept, and earnings display correct

## Task Commits

Each task was committed atomically:

1. **Task 1: Vendor panel foundation — router, auth store, layout, protected routing** - `3dc8d72` (feat)
2. **Task 2: All vendor panel pages (dashboard, inventory, orders, returns, earnings, team, profile, coupons)** - `8468bc2` (feat)
3. **Task 3: Human verify checkpoint** — approved by user (no code commit; verification only)

## Files Created/Modified

- `apps/web-vendor/src/lib/apiClient.ts` — fetch wrapper with credentials:'include', ApiError class, BASE_URL from VITE_API_URL
- `apps/web-vendor/src/lib/queryClient.ts` — QueryClient configured with no retry on 401/403/404
- `apps/web-vendor/src/stores/vendorAuthStore.ts` — Zustand store holding vendorUser, role, setVendorUser
- `apps/web-vendor/src/stores/uiStore.ts` — Zustand store for sidebarCollapsed toggle and toast queue
- `apps/web-vendor/src/hooks/useVendorAuth.ts` — session probe, login/logout mutations, isAuthenticated/isLoading/user/role, hasRole helper
- `apps/web-vendor/src/components/layout/ProtectedVendorRoute.tsx` — waits for isLoading; redirects unauthenticated to /auth/login; redirects insufficient role to /dashboard
- `apps/web-vendor/src/components/layout/PanelLayout.tsx` — Sidebar + Header + AnimatePresence Outlet keyed on pathname
- `apps/web-vendor/src/components/layout/Sidebar.tsx` — role-aware nav (Team/Store Profile/Settings hidden non-owners, Coupons hidden when flag off), collapsible, active-link styling with grovio tokens
- `apps/web-vendor/src/components/layout/Header.tsx` — breadcrumb, user email display, logout button
- `apps/web-vendor/src/router.tsx` — createBrowserRouter: public auth routes + protected panel routes with owner-only guards
- `apps/web-vendor/src/main.tsx` — replaced placeholder App with QueryClientProvider + RouterProvider
- `apps/web-vendor/src/pages/auth/LoginPage.tsx` — email+password form, POST /vendor/auth/login, redirect to /dashboard
- `apps/web-vendor/src/pages/auth/AcceptInvitePage.tsx` — reads ?token= from URL, POST /vendor/team/accept-invite, redirect to /auth/login on success
- `apps/web-vendor/src/pages/DashboardPage.tsx` — period toggle (7d/30d/90d), KPI cards, low-stock alert list
- `apps/web-vendor/src/pages/ProductsPage.tsx` — vendor product list via GET /vendor/products
- `apps/web-vendor/src/pages/InventoryPage.tsx` — inline edit for qty (PATCH /vendor/inventory/:id) and price (PATCH /vendor/products/:id/pricing); quantity_reserved read-only
- `apps/web-vendor/src/pages/OrdersPage.tsx` — vendor sub-order list with role-restricted status actions
- `apps/web-vendor/src/pages/ReturnsPage.tsx` — approve (optional note) and reject (required reason) flows; manager+owner only
- `apps/web-vendor/src/pages/EarningsPage.tsx` — Outstanding Balance card, summary strip, commission ledger, settlements table
- `apps/web-vendor/src/pages/CouponsPage.tsx` — coupon list + create form; graceful 404 handling when flag is off
- `apps/web-vendor/src/pages/TeamPage.tsx` — owner only; staff list, invite form (email + manager|staff role), soft-delete
- `apps/web-vendor/src/pages/StoreProfilePage.tsx` — owner only; profile fields + payout-info form
- `apps/web-vendor/src/pages/SettingsPage.tsx` — owner only; return policy (window days, returns enabled)
- `apps/web-vendor/package.json` — added react-router-dom 7.16.0

## Decisions Made

- Cookie-credentialed fetch (credentials:'include') on all API calls — session managed server-side via httpOnly cookie; no token in localStorage
- hasRole implemented as ordinal comparison (owner=2 > manager=1 > staff=0) — a single helper covers all role-level checks across the app
- COUPONS_ENABLED flag sourced from GET /feature-flags public endpoint in Sidebar — client hides nav item; backend enforces independently (defense in depth)
- Team + Store Profile hidden for non-owners at UI layer; backend (06-08 D-05 role guards) is the enforcing authority per T-06-30 disposition
- Money always displayed as minor_units / 100 — no raw minor-unit numbers shown to the user anywhere

## Deviations from Plan

None — plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None — no external service configuration required. Vendor panel connects to the same backend as the admin panel using cookie-based session auth established in Phase 6 (06-03).

## Next Phase Readiness

- Vendor panel is fully functional for VEN-01 through VEN-06 and MKT-05
- Plan 06-10 (admin panel) can proceed immediately — the same apiClient + auth store + PanelLayout patterns established here serve as the template for the admin SPA
- No blockers

---
*Phase: 06-vendor-admin-tools*
*Completed: 2026-06-05*
