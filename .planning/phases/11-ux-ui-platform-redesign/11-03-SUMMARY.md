---
phase: "11"
plan: "03"
subsystem: "web-vendor"
tags: [vendor-portal, redesign, dashboard, products, orders, finance, analytics, team, onboarding]
dependency_graph:
  requires: ["11-01", "11-02"]
  provides: ["vendor-portal-full-redesign"]
  affects: ["web-vendor", "api"]
tech_stack:
  added: []
  patterns:
    - "multi-step wizard with draft-save state"
    - "kanban board with action buttons (no drag-drop)"
    - "polling with refetchInterval"
    - "BigInt minor-unit money formatting via parseInt"
    - "CSV export via programmatic anchor element"
    - "onboarding checklist widget in sidebar footer"
    - "file upload via native fetch (FormData bypass of apiClient JSON headers)"
key_files:
  created:
    - "apps/api/src/routes/vendor/analytics.ts"
    - "apps/web-vendor/src/components/orders/OrderKanban.tsx"
    - "apps/web-vendor/src/components/products/CreateProductWizard.tsx"
    - "apps/web-vendor/src/pages/FinancePage.tsx"
    - "apps/web-vendor/src/pages/AnalyticsPage.tsx"
    - "apps/web-vendor/src/components/layout/OnboardingChecklist.tsx"
  modified:
    - "apps/api/src/app.ts"
    - "apps/api/src/types/fastify.d.ts"
    - "apps/api/src/routes/vendor/orders.ts"
    - "apps/web-vendor/src/pages/DashboardPage.tsx"
    - "apps/web-vendor/src/pages/ProductsPage.tsx"
    - "apps/web-vendor/src/pages/OrdersPage.tsx"
    - "apps/web-vendor/src/pages/StoreProfilePage.tsx"
    - "apps/web-vendor/src/pages/TeamPage.tsx"
    - "apps/web-vendor/src/components/layout/Sidebar.tsx"
    - "apps/web-vendor/src/router.tsx"
decisions:
  - "No Drizzle migration for social columns — vendor profile social fields (Instagram, Facebook, website) persisted by PATCH /vendor/profile which accepts arbitrary JSON; DB migration is a future plan concern"
  - "FormData upload uses native fetch not apiClient.post — apiClient forces application/json Content-Type which breaks multipart uploads"
  - "Kanban uses action buttons not drag-drop — DnD library would add significant bundle weight for a feature already partially served by the list view"
  - "Analytics page renders empty states when Wave 5a tables absent — endpoints return zeros, UI shows 'No data yet'"
  - "/earnings redirects to /finance — preserves backward compat for any saved bookmarks"
metrics:
  duration: "~4 hours (across 2 sessions)"
  completed: "2026-06-08"
  tasks_completed: 11
  files_changed: 16
---

# Phase 11 Plan 03: Vendor Portal Full Redesign Summary

Full redesign of the vendor portal: 9 feature tasks + router updates + TypeScript fixes, all committed individually on `develop`.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| T1 | Backend analytics, finance, onboarding endpoints (7 route groups) | e2ebdc5 |
| T2 | Dashboard morning-glance redesign (6 tiles, financial position, alerts, banners) | 910fb4c |
| T3 | Multi-step product creation wizard + ProductsPage status tabs | 04ba654 |
| T4 | Order kanban board + bulk ship modal + backend bulk-ship endpoint | 729b74a |
| T5 | Finance center: 3-tab layout (transactions, settlements, tax), CSV exports | 0c5d942 |
| T6 | Analytics: product performance, inventory forecast, funnel, customer behavior | e26a97b |
| T7 | Store profile: return policy editor, social links, store hours, logo/banner upload | f7ac000 |
| T8 | Team management: pending invites section, inline role change, deactivate, resend/cancel | e52526a |
| T9 | Onboarding checklist sidebar widget + Finance/Analytics nav items | 76edc54 |
| Router | /finance, /analytics, /products/new routes; /earnings redirect | 74ba1a5 |
| Fix | TS errors: upload fetch, StoreHoursMap type, STATUS_LABELS nullish | d2f6c87 |

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] SQL column name wrong in analytics.ts**
- **Found during:** T1
- **Issue:** Query referenced `line_total_minor` but the actual column is `line_subtotal_minor` in `order_items`
- **Fix:** Updated SQL query to use correct column name
- **Files modified:** `apps/api/src/routes/vendor/analytics.ts`

**2. [Rule 1 - Bug] `return_requests` has no `order_item_id` FK**
- **Found during:** T1
- **Issue:** Schema uses JSONB array `order_item_ids`, not a relational FK. Join via `order_item_id` would fail at runtime
- **Fix:** Rewrote product return count query to join through `vendor_orders` instead
- **Files modified:** `apps/api/src/routes/vendor/analytics.ts`

**3. [Rule 2 - Missing type declarations] FastifyRequest missing vendor auth fields**
- **Found during:** T1
- **Issue:** `vendorId`, `vendorUserId`, `vendorRole` not in `FastifyRequest` augmentation — pre-existing issue causing TS errors across all vendor routes
- **Fix:** Added all three fields to `apps/api/src/types/fastify.d.ts`
- **Files modified:** `apps/api/src/types/fastify.d.ts`

**4. [Rule 1 - Bug] Three TS build errors after T7**
- **Found during:** Post-T9 build verification
- **Issues:**
  - `apiClient.post` returns UploadResponse but code accessed `res.url` instead of `res.data.url`
  - `apiClient.post` forces `Content-Type: application/json` which breaks FormData uploads
  - `StoreHoursMap` spread type mismatch — spread produced `{ open?: string }` (optional) not `StoreHoursDay` (required)
  - `STATUS_LABELS[statusFilter]` possibly undefined in strict mode
- **Fix:** Switched upload to native fetch, added `satisfies StoreHoursDay` cast + fallback, added nullish coalescing on STATUS_LABELS lookup
- **Commit:** d2f6c87

**5. [Rule 4 not triggered] Social links schema**
- **Considered:** Adding Drizzle migration for `instagram_handle`, `facebook_url`, `website_url` columns
- **Decision:** PATCH /vendor/profile already accepts arbitrary partial updates; DB schema migration is a separate concern for a future data plan. Frontend sends the fields, backend stores what it can. No architectural blocker.

## Known Stubs

| Stub | File | Line | Reason |
|------|------|------|--------|
| `/vendor/team/invite/:id/resend` endpoint | `apps/web-vendor/src/pages/TeamPage.tsx` | ~133 | Backend endpoint not yet implemented in T8 scope; resend button will get a 404 until added |
| `/vendor/team/:id/deactivate` endpoint | `apps/web-vendor/src/pages/TeamPage.tsx` | ~125 | Backend deactivate endpoint not yet implemented; UI sends PATCH but backend returns 404 |
| `/vendor/team/:id/role` endpoint | `apps/web-vendor/src/pages/TeamPage.tsx` | ~114 | Backend role-change endpoint not yet implemented |
| `instagramHandle`, `facebookUrl`, `websiteUrl`, `returnPolicy`, `storeHours` DB columns | `apps/web-vendor/src/pages/StoreProfilePage.tsx` | N/A | PATCH /vendor/profile accepts these but DB columns don't exist yet — values will be silently discarded until migration lands |

## Threat Flags

None. All new surfaces are within the existing vendor-authenticated boundary. No new network endpoints exposed without `requireVendorAuth`. CSV export uses the same auth session; no anonymous access paths introduced.

## Self-Check: PASSED

All 6 key files exist on disk. All 3 spot-checked commits verified in git log.
