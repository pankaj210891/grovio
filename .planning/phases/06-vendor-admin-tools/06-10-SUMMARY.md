---
phase: 06-vendor-admin-tools
plan: 10
subsystem: ui
tags: [react, zustand, react-query, recharts, framer-motion, cookie-auth, admin-panel, tailwindcss]

# Dependency graph
requires:
  - phase: 06-vendor-admin-tools
    provides: Phase 6 backend admin routes (cookie-guarded /admin/*), commission rules, payout endpoints, CMS/homepage-blocks, feature-flags, audit-log, vendor management, analytics
  - phase: 02-category-management
    provides: Category list/detail pages preserved under PanelLayout

provides:
  - Full admin SPA with cookie auth (credentials:'include', X-Internal-Admin-Token removed)
  - adminAuthStore (Zustand) + useAdminAuth hook (session probe, login, logout)
  - PanelLayout with animated Sidebar + Header using framer-motion
  - ProtectedAdminRoute redirecting unauthenticated users to /auth/login
  - App.tsx migrated to createBrowserRouter; Phase 2 /categories + /categories/:id routes preserved
  - LoginPage with email+password → cookie session
  - DashboardPage: 6 KPI cards, 7d/30d/90d toggle, orders-by-day line chart, GMV-by-category bar chart, Top 5 vendors table
  - VendorsPage: paginated table, colored onboarding_status badges, Approve/Suspend/Reinstate/Configure actions
  - CatalogModerationPage: pending product approval/rejection
  - CommissionRulesPage: global rate pinned (no delete), category + vendor overrides CRUD
  - PayoutManagementPage: per-vendor ledger, summary strip, settlements history, decimal-string settlement recording
  - CmsPage: ordered homepage blocks, Up/Down reorder, active toggle, type-specific edit modal
  - FeatureFlagsPage: toggle list with PATCH per flag
  - SettingsPage: grouped settings, secret keys masked/read-only
  - AuditLogPage: multi-filter (actor, action, entity, date range), before/after diffs, offset pagination
affects: [07-storefront, future phases using admin panel patterns]

# Tech tracking
tech-stack:
  added:
    - "recharts ^2.15.3 (Line + Bar charts for DashboardPage)"
  patterns:
    - "Cookie auth pattern: credentials:'include' on all fetch calls; 401 → redirect to /auth/login"
    - "Zustand auth store + useAdminAuth hook (session probe on mount, login/logout mutations)"
    - "createBrowserRouter with RouterProvider replacing <Routes> in App.tsx"
    - "PanelLayout with framer-motion AnimatePresence (import from 'framer-motion', not 'motion/react')"
    - "Money display: always divide minor units by 100 for rendering; settlement input as decimal string"
    - "CommissionRules: global row pinned, delete button absent from UI; 403 surfaced gracefully"
    - "Settings: secret keys rendered masked/read-only to prevent accidental exposure"

key-files:
  created:
    - apps/web-admin/src/stores/adminAuthStore.ts
    - apps/web-admin/src/hooks/useAdminAuth.ts
    - apps/web-admin/src/components/layout/PanelLayout.tsx
    - apps/web-admin/src/components/layout/Sidebar.tsx
    - apps/web-admin/src/components/layout/Header.tsx
    - apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx
    - apps/web-admin/src/components/charts/MiniChart.tsx
    - apps/web-admin/src/pages/auth/LoginPage.tsx
    - apps/web-admin/src/pages/DashboardPage.tsx
    - apps/web-admin/src/pages/VendorsPage.tsx
    - apps/web-admin/src/pages/CatalogModerationPage.tsx
    - apps/web-admin/src/pages/CommissionRulesPage.tsx
    - apps/web-admin/src/pages/PayoutManagementPage.tsx
    - apps/web-admin/src/pages/CmsPage.tsx
    - apps/web-admin/src/pages/FeatureFlagsPage.tsx
    - apps/web-admin/src/pages/SettingsPage.tsx
    - apps/web-admin/src/pages/AuditLogPage.tsx
  modified:
    - apps/web-admin/src/lib/apiClient.ts
    - apps/web-admin/src/App.tsx

key-decisions:
  - "Used recharts (not inline SVG) for dashboard charts — approved via Task 1 charting decision checkpoint and package-legitimacy verification"
  - "framer-motion imported as 'framer-motion' (not 'motion/react') in web-admin per PATTERNS.md — web-admin predates motion/react migration"
  - "createBrowserRouter adopted over legacy <Routes> to support data APIs and future loaders"
  - "Phase 2 /categories + /categories/:id routes preserved under PanelLayout — not deleted"
  - "Global commission rule has no delete button in UI; backend enforces 403 as final guard"
  - "Settlement amount submitted as decimal string, converted to minor units server-side — prevents client-side integer manipulation"
  - "CmsPage uses Up/Down arrow buttons for reorder — no drag-and-drop library added to keep bundle clean"

patterns-established:
  - "Admin cookie auth: apiClient sends credentials:'include'; 401 redirects to /auth/login; no token headers"
  - "Sidebar nav organizes all admin sections with a dedicated Categories section for preserved Phase 2 pages"
  - "KPI dashboard with time-range toggle (7d/30d/90d) using React Query + recharts"
  - "Append-only settlement model: POST only, displayed in chronological table, no delete/edit"
  - "Secret key masking: type='password' readonly fields for integration credentials in SettingsPage"

requirements-completed: [ADM-01, ADM-02, ADM-03, ADM-04, ADM-05, ADM-06, ADM-07, MKT-04]

# Metrics
duration: ~90min
completed: 2026-06-05
---

# Phase 6 Plan 10: Admin Panel — Full Control-Plane SPA Summary

**Cookie-auth admin SPA with recharts KPI dashboard, full vendor lifecycle management, commission CRUD (global protected), append-only payout settlements, CMS block reorder, feature-flag toggles, masked settings, and filterable audit log — with Phase 2 category pages preserved**

## Performance

- **Duration:** ~90 min
- **Started:** 2026-06-05T00:00:00Z
- **Completed:** 2026-06-05T00:00:00Z
- **Tasks:** 4 (3 auto + 1 human-verify)
- **Files modified:** 19

## Accomplishments

- Replaced X-Internal-Admin-Token with cookie auth (`credentials:'include'`) end-to-end; no token header surfaces anywhere in the admin client
- Built complete admin SPA: PanelLayout shell with animated Sidebar + Header, ProtectedAdminRoute, App.tsx migrated to createBrowserRouter while preserving all Phase 2 /categories routes
- Delivered all 9 admin control-plane pages (Dashboard + charts, Vendors, Catalog Moderation, Commission Rules, Payout Management, CMS, Feature Flags, Settings, Audit Log) covering ADM-01 through ADM-07 and MKT-04
- Human verification confirmed: login, chart rendering (7d/30d/90d), vendor lifecycle (approve/suspend/reinstate), global commission rule protection, decimal settlement recording, CMS reorder + cache invalidation, flag toggle propagation, settings + audit log filters all working

## Task Commits

Each task was committed atomically:

1. **Task 1: Decide admin dashboard charting approach** — pre-resolved (recharts approved + installed)
2. **Task 2: Admin panel foundation** — `903f5f5` (feat)
3. **Task 3: All admin pages** — `c37b098` (feat)
4. **Task 4: Human verify** — approved by user

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `apps/web-admin/src/lib/apiClient.ts` — Removed X-Internal-Admin-Token/VITE_INTERNAL_ADMIN_TOKEN; added credentials:'include'; 401 → redirect to /auth/login
- `apps/web-admin/src/App.tsx` — Migrated to createBrowserRouter + RouterProvider; preserved /categories + /categories/:id under PanelLayout
- `apps/web-admin/src/stores/adminAuthStore.ts` — Zustand store: admin state + setAdmin
- `apps/web-admin/src/hooks/useAdminAuth.ts` — Session probe (GET /admin/auth/me), login, logout; exposes isAuthenticated/isLoading/admin
- `apps/web-admin/src/components/layout/PanelLayout.tsx` — Sidebar + Header + AnimatePresence Outlet (framer-motion import)
- `apps/web-admin/src/components/layout/Sidebar.tsx` — Full nav: Dashboard, Vendors, Catalog Moderation, Commission Rules, Payout Management, CMS / Homepage, Feature Flags, Settings & Branding, Audit Log, Categories
- `apps/web-admin/src/components/layout/Header.tsx` — Breadcrumb + admin email + logout
- `apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx` — isLoading gate + redirect to /auth/login
- `apps/web-admin/src/components/charts/MiniChart.tsx` — recharts LineChart + BarChart wrappers for dashboard
- `apps/web-admin/src/pages/auth/LoginPage.tsx` — Email + password form → useAdminAuth.login → redirect to /dashboard
- `apps/web-admin/src/pages/DashboardPage.tsx` — 6 KPI cards, 7d/30d/90d toggle, orders-by-day line chart, GMV-by-category bar chart, Top 5 vendors table, manual refresh
- `apps/web-admin/src/pages/VendorsPage.tsx` — Paginated vendor table, colored status badges (pending=amber, approved=green, suspended=red, archived=gray), Approve/Suspend/Reinstate/Configure actions
- `apps/web-admin/src/pages/CatalogModerationPage.tsx` — Pending product list with approve/reject per product
- `apps/web-admin/src/pages/CommissionRulesPage.tsx` — Global rate pinned (no delete), category + vendor override CRUD; 403 surfaced gracefully
- `apps/web-admin/src/pages/PayoutManagementPage.tsx` — Vendor selector, earned/reversed/net/settled/outstanding summary strip, commission ledger, settlements history, Record Settlement form (decimal string amount)
- `apps/web-admin/src/pages/CmsPage.tsx` — Ordered block list, active toggle, Up/Down reorder, Edit/Delete, type-specific edit modal (banner/product_grid/text_block/featured_categories)
- `apps/web-admin/src/pages/FeatureFlagsPage.tsx` — Toggle list; PATCH /admin/feature-flags/:key on change
- `apps/web-admin/src/pages/SettingsPage.tsx` — Grouped settings sections; secret keys rendered masked + read-only
- `apps/web-admin/src/pages/AuditLogPage.tsx` — Multi-filter table (actor, action type, entity type, date range), before/after diff display, offset pagination

## Decisions Made

- **recharts over inline SVG:** recharts was selected (Task 1 decision checkpoint), approved via package-legitimacy human-verify before install. Provides richer charts with less component code and easier future extension.
- **framer-motion (not motion/react):** web-admin predates the motion/react migration; PATTERNS.md specifies framer-motion import path for web-admin. Maintained consistently across PanelLayout and all animated components.
- **createBrowserRouter migration:** Replaced legacy `<Routes>` / `<BrowserRouter>` to enable future data router APIs (loaders, actions) and align with React Router v6+ best practices.
- **Phase 2 category routes preserved:** /categories and /categories/:id are registered under PanelLayout — not deleted — per plan Pitfall. Confirmed in human verification.
- **Settlement as decimal string:** PayoutManagementPage sends amount as a human-entered decimal string (e.g., "1500.00"); the backend converts to minor units and stores append-only. Prevents client-side integer manipulation (T-06-34).
- **Global commission rule: no delete in UI:** CommissionRulesPage renders the global row without a Delete button. The backend independently returns 403 on DELETE attempts, surfaced via toast/error state.
- **No drag-and-drop for CMS:** CmsPage uses Up/Down arrow buttons calling the reorder endpoint. Keeps bundle clean and avoids an additional dependency for a low-frequency admin action.

## Deviations from Plan

None — plan executed exactly as written. The recharts decision checkpoint resolved as "recharts" (pre-approved by user before this execution wave), package-legitimacy was confirmed, and all acceptance criteria were met without auto-fixes.

## Issues Encountered

None. Build and lint passed clean on both task commits. Human verification confirmed all flows working.

## User Setup Required

None — no new external service configuration required. Admin users must be seeded in the `admin_users` table with an argon2-hashed password (use the seeding method from the backend auth service).

## Known Stubs

None. All pages wire to real API endpoints via React Query + the cookie-auth apiClient. No hardcoded empty data or placeholder text present in production code paths.

## Threat Surface Scan

All threats from the plan's threat register were mitigated:

| Threat ID | Status | Notes |
|-----------|--------|-------|
| T-06-32 | Mitigated | apiClient sends no X-Internal-Admin-Token; cookie auth enforced |
| T-06-33 | Mitigated | Global commission rule has no delete button in UI; backend returns 403 |
| T-06-34 | Mitigated | Settlement form sends decimal string; conversion to minor units is server-side |
| T-06-35 | Mitigated | Integration secret keys rendered masked/read-only in SettingsPage |
| T-06-SC | Mitigated | recharts package legitimacy verified via human-verify checkpoint before install |

No new threat surface introduced beyond what the plan modelled.

## Next Phase Readiness

- Admin control-plane is fully operational against the Phase 6 cookie-guarded backend
- All ADM-01..07 and MKT-04 requirements delivered and human-verified
- Phase 2 category pages confirmed working under the new PanelLayout
- Ready for Phase 7 (storefront) which can reference the admin panel's API contract patterns and cookie auth approach
- No blockers or open concerns

---
*Phase: 06-vendor-admin-tools*
*Completed: 2026-06-05*
