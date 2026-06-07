---
phase: 11
plan: "02"
subsystem: web-admin
tags: [admin-portal, rbac, support-tickets, kyc, insights, finance, bulk-import]
dependency_graph:
  requires: ["11-01"]
  provides: ["admin-portal-v2", "admin-rbac", "kyc-workflow", "support-center", "finance-center", "bulk-import"]
  affects: ["apps/web-admin", "apps/api"]
tech_stack:
  added:
    - "@fastify/cookie ^11.0.0 — httpOnly admin_token cookie auth"
    - "@fastify/cors ^10.0.0 — CORS for admin panel"
    - "jose ^6.0.0 — JWT signing/verification (HS256)"
    - "StorageClient — dynamic @aws-sdk/client-s3 import for Cloudflare R2/S3"
  patterns:
    - "Cookie-based admin JWT auth (httpOnly admin_token)"
    - "RBAC via Fastify preHandler guard factory (rbacGuard)"
    - "React Query + Zustand sessionStorage-backed admin auth store"
    - "createBrowserRouter with role-filtered layout + ProtectedAdminRoute"
    - "framer-motion AnimatePresence for route transitions"
    - "Bulk CSV file upload via multipart FormData with preview"
key_files:
  created:
    - "apps/api/src/db/schema/admin-users.ts — admin_users table with role column"
    - "apps/api/src/db/schema/vendor-kyc-documents.ts — KYC document records"
    - "apps/api/src/db/schema/announcements.ts — platform announcements"
    - "apps/api/src/db/schema/support-tickets.ts — support_tickets + support_ticket_replies"
    - "apps/api/src/infrastructure/storage/StorageClient.ts — S3/R2 upload + signed URL"
    - "apps/api/src/middleware/adminAuth.ts — requireAdminAuth + rbacGuard factory"
    - "apps/api/src/modules/admin/AdminService.ts — all admin business logic"
    - "apps/api/src/routes/admin/admin.ts — protected admin route plugin"
    - "apps/web-admin/src/components/layout/CommandBar.tsx — search + notifications + admin dropdown"
    - "apps/web-admin/src/components/layout/Sidebar.tsx — role-filtered nav with badges"
    - "apps/web-admin/src/components/layout/PanelLayout.tsx — CommandBar + Sidebar + Outlet"
    - "apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx — session probe + RBAC redirect"
    - "apps/web-admin/src/hooks/useAdminAuth.ts — session probe + login/logout mutations"
    - "apps/web-admin/src/stores/adminAuthStore.ts — Zustand sessionStorage store"
    - "apps/web-admin/src/pages/auth/LoginPage.tsx — cookie-based login form"
    - "apps/web-admin/src/pages/DashboardPage.tsx — KPI tiles, health widget, announcements"
    - "apps/web-admin/src/pages/InsightsPage.tsx — revenue sparklines, vendor perf, anomaly flags"
    - "apps/web-admin/src/pages/VendorsPage.tsx — health score cards, bulk approve/suspend"
    - "apps/web-admin/src/pages/VendorProfilePage.tsx — KYC tabs, onboarding checklist, payouts"
    - "apps/web-admin/src/pages/CatalogModerationPage.tsx — moderation queue with actions"
    - "apps/web-admin/src/pages/FinancePage.tsx — 4-tab finance center"
    - "apps/web-admin/src/pages/OrdersPage.tsx — advanced filters with saved presets, bulk actions"
    - "apps/web-admin/src/pages/SupportPage.tsx — ticket queue, assign-to-self"
    - "apps/web-admin/src/pages/SupportTicketPage.tsx — threaded conversation view"
    - "apps/web-admin/src/pages/SettingsPage.tsx — branding + admin user role management"
    - "apps/web-admin/src/pages/CmsPage.tsx — CMS homepage stubs"
    - "apps/web-admin/src/pages/FeatureFlagsPage.tsx — live toggle feature flags"
    - "apps/web-admin/src/pages/AuditLogPage.tsx — paginated admin action log"
    - "apps/web-admin/src/pages/BulkImportPage.tsx — CSV template + preview + import"
  modified:
    - "apps/api/src/db/schema/index.ts — added Phase 11 table exports"
    - "apps/api/src/config/env.ts — added STORAGE_* env vars (all optional)"
    - "apps/api/src/types/fastify.d.ts — extended FastifyRequest with adminId/adminEmail/adminRole"
    - "apps/api/src/container.ts — registered AdminService + storageClient"
    - "apps/api/src/app.ts — registered @fastify/cors, @fastify/cookie, adminRoutes"
    - "apps/api/package.json — added @fastify/cookie, @fastify/cors, jose dependencies"
    - "apps/api/.env.example — added STORAGE_* configuration section"
    - "apps/web-admin/src/App.tsx — full createBrowserRouter rewrite with all Phase 11 routes"
    - "apps/web-admin/src/lib/apiClient.ts — rewritten for cookie auth + uploadFile helper"
decisions:
  - "Dynamic import for @aws-sdk/client-s3 — avoids hard startup failure when storage env vars absent (graceful StorageNotConfiguredError)"
  - "No Shadcn/Radix components used — packages/ui in worktree has only tokens (no component library at Phase 11 entry point), all UI built with plain Tailwind CSS + framer-motion"
  - "Single T4-T12 commit — all page components created together since they share routing context (BulkImportPage added as part of T12 bulk import UI)"
  - "BulkImportPage CSV parser is client-side preview only — full server-side validation on /admin/catalog/import-csv"
  - "OrdersPage filter presets stored in sessionStorage not localStorage — clears on tab close per admin session security requirement"
metrics:
  duration: "~2 sessions (context window split)"
  completed: "2026-06-08"
  tasks_completed: 12
  files_created: 30
  files_modified: 8
---

# Phase 11 Plan 02: Admin Portal Full Redesign Summary

Admin panel redesigned from Phase 6 minimal dashboard to a full command-center with cookie-based JWT auth, three-role RBAC, KYC workflow, analytics insights panel, unified finance center, support ticket system, and bulk CSV product import.

## What Was Built

### T1 — DB Migrations (commit: 82728ad)

Four new Drizzle schema files added to `apps/api/src/db/schema/`:
- `admin-users.ts` — added `role` column (TEXT, values: super_admin/moderator/finance_admin)
- `vendor-kyc-documents.ts` — KYC doc records with verified_at, verifiedByAdminEmail
- `announcements.ts` — platform-wide announcements with target_type (customers/vendors/all)
- `support-tickets.ts` — support_tickets with pgEnum status + support_ticket_replies

### T2 — StorageClient (commit: e4c2fb9)

`apps/api/src/infrastructure/storage/StorageClient.ts` — dynamic `import("@aws-sdk/client-s3")` so the module loads lazily and throws `StorageNotConfiguredError` (code: STORAGE_NOT_CONFIGURED) when env vars absent instead of crashing at startup. Exposes `uploadFile()` and `getSignedDownloadUrl()`.

### T3 — Backend API (commit: 40b5238)

- `adminAuth.ts` middleware — JWT extraction from Bearer header OR admin_token httpOnly cookie, sets request.adminId/adminEmail/adminRole
- `rbacGuard` factory — returns Fastify preHandler enforcing section-level role access
- `AdminService.ts` — 20+ methods covering KYC docs, announcements, support tickets, insights (Redis 1hr TTL), platform health, notifications
- `admin.ts` route plugin — full set of /admin/* routes registered with auth + RBAC guards
- `FastifyRequest` extended with adminId, adminEmail, adminRole type declarations

### T4-T12 — Admin Portal UI (commit: 9c666f0)

**Layout infrastructure:**
- `CommandBar` — 56px top bar: global search input, notification bell with badge, dark mode toggle placeholder, admin dropdown
- `Sidebar` — role-filtered nav items (roles array per item), open-tickets badge on Support, Phase 2 category routes preserved in separate section
- `PanelLayout` — CommandBar above, Sidebar + AnimatePresence Outlet below
- `ProtectedAdminRoute` — session probe (GET /admin/auth/me), path-based RBAC redirect
- `useAdminAuth` hook + `adminAuthStore` (Zustand, sessionStorage-backed)
- `apiClient` rewritten — cookie auth (credentials: include), uploadFile for multipart

**Pages:**
- `DashboardPage` — KPI tiles (6 metrics), platform health widget (polls every 60s), Needs Attention queue, Broadcast Announcement card
- `InsightsPage` — period selector 7d/30d/90d, revenue sparklines, vendor performance table, product velocity table, retention rate tile, anomaly flag banners
- `VendorsPage` — vendor health score (KYC+GMV+rating composite), bulk approve/suspend, status tabs (All/Pending/Active/Suspended), search
- `VendorProfilePage` — 3-tab (Overview+KYC+Payouts), KYC doc upload/verify, onboarding checklist, payout history
- `CatalogModerationPage` — moderation queue (Pending/Flagged/Approved/Rejected tabs), per-product Approve/Reject/Flag actions
- `FinancePage` — 4-tab (Overview/Payouts/Commissions/Refunds), bulk payout approve/reject, refund approve/reject
- `OrdersPage` — collapsible advanced filter panel, saved filter presets (sessionStorage), bulk mark-shipped/cancel
- `SupportPage` — ticket queue with status tabs, search, assign-to-self button
- `SupportTicketPage` — threaded conversation (admin messages right-aligned), status update buttons, reply form
- `SettingsPage` — branding info + admin users table with role dropdown (super_admin only)
- `FeatureFlagsPage` — live toggle switches for feature flags
- `AuditLogPage` — paginated admin action log
- `CmsPage` — placeholder with planned Phase 12 note
- `BulkImportPage` — CSV template download, client-side row preview (first 10 rows), confirm to POST /admin/catalog/import-csv

## Deviations from Plan

**1. [Rule 2 - Missing functionality] No Shadcn/Radix components (packages/ui has only tokens in worktree)**
- **Found during:** T4
- **Issue:** Plan references `@grovio/ui` components (KPICard, NotificationBell, cmdk command palette) but `packages/ui/src` in the worktree only has design tokens — no component directory. Phase 11 Wave 1 added `packages/ui` tokens but component generation was handled by a separate plan. Worktree was created from `main` at Phase 2 state (ef2b59f).
- **Fix:** Built all UI components from scratch using Tailwind CSS v4 tokens + framer-motion. Design tokens from packages/ui (grovio-primary, grovio-surface, grovio-border etc.) used via className.
- **Impact:** Functionally complete but no Radix accessibility primitives (focus trapping in dropdowns, aria-expanded). Acceptable for admin panel.

**2. [Rule 2 - Missing functionality] BulkImportPage route not in original App.tsx import list**
- **Found during:** T12
- **Issue:** App.tsx had `/catalog-moderation/import` as a comment but no actual route or import. Plan T12 required a bulk import UI page.
- **Fix:** Created `BulkImportPage.tsx` and added import + route to App.tsx.

**3. [Auto-adjustment] T4-T12 committed as a single commit**
- **Reason:** All page files needed to coexist in App.tsx's import graph for TypeScript to compile without errors. Attempting per-task commits would have left App.tsx with broken imports mid-sequence. Combined into one comprehensive commit after all pages were created.

## Known Stubs

| File | Stub | Reason |
|------|------|--------|
| `DashboardPage.tsx` | KPI tile values hardcoded to 0 | Phase 11 backend aggregation endpoints (GMV, active vendors etc.) not implemented in this plan's AdminService — placeholder until a future plan wires the correct queries |
| `CmsPage.tsx` | No editable CMS content | Full CMS editor deferred to Phase 12 per plan notes |
| `SettingsPage.tsx` branding tab | All branding inputs disabled | Branding config writer backend endpoint not in scope for this plan |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_auth_surface | apps/api/src/middleware/adminAuth.ts | New JWT cookie extraction path — ensure CORS `allowedOrigins` in app.ts is restricted to admin panel domain in production |
| threat_flag: file_upload | apps/api/src/routes/admin/admin.ts | KYC document upload endpoint — file type and size validation must be enforced server-side (not trusting Content-Type header alone) |

## Self-Check: PASSED

**Files verified:**
- `apps/api/src/db/schema/admin-users.ts` — EXISTS
- `apps/api/src/db/schema/vendor-kyc-documents.ts` — EXISTS
- `apps/api/src/db/schema/announcements.ts` — EXISTS
- `apps/api/src/db/schema/support-tickets.ts` — EXISTS
- `apps/api/src/infrastructure/storage/StorageClient.ts` — EXISTS
- `apps/api/src/middleware/adminAuth.ts` — EXISTS
- `apps/api/src/modules/admin/AdminService.ts` — EXISTS
- `apps/api/src/routes/admin/admin.ts` — EXISTS
- `apps/web-admin/src/components/layout/CommandBar.tsx` — EXISTS
- `apps/web-admin/src/components/layout/Sidebar.tsx` — EXISTS
- `apps/web-admin/src/components/layout/PanelLayout.tsx` — EXISTS
- `apps/web-admin/src/components/layout/ProtectedAdminRoute.tsx` — EXISTS
- `apps/web-admin/src/pages/DashboardPage.tsx` — EXISTS
- `apps/web-admin/src/pages/InsightsPage.tsx` — EXISTS
- `apps/web-admin/src/pages/VendorsPage.tsx` — EXISTS
- `apps/web-admin/src/pages/VendorProfilePage.tsx` — EXISTS
- `apps/web-admin/src/pages/CatalogModerationPage.tsx` — EXISTS
- `apps/web-admin/src/pages/FinancePage.tsx` — EXISTS
- `apps/web-admin/src/pages/OrdersPage.tsx` — EXISTS
- `apps/web-admin/src/pages/SupportPage.tsx` — EXISTS
- `apps/web-admin/src/pages/SupportTicketPage.tsx` — EXISTS
- `apps/web-admin/src/pages/SettingsPage.tsx` — EXISTS
- `apps/web-admin/src/pages/BulkImportPage.tsx` — EXISTS

**Commits verified:**
- `82728ad` T1 DB migrations — FOUND
- `e4c2fb9` T2 StorageClient — FOUND
- `40b5238` T3 backend API — FOUND
- `9c666f0` T4-T12 admin portal UI — FOUND
