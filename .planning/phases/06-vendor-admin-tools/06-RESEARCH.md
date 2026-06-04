# Phase 6: Vendor & Admin Tools — Research

**Researched:** 2026-06-04
**Domain:** Multi-panel B2B/admin web application — vendor management panel, admin control plane, multi-role auth, audit logging, payout ledger, marketplace settings
**Confidence:** HIGH (all findings verified from codebase inspection and installed packages)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** `vendors` table extended with `store_name`, `store_description`, `logo_url`, `banner_url`, `contact_email`, `contact_phone`, `address`, `onboarding_status` pgEnum (`pending`|`approved`|`suspended`). `archived_at` kept for soft-delete. `name` stays (owner display); `store_name` is public-facing.
- **D-02:** `vendor_payout_info` table: `id`, `vendor_id FK UNIQUE`, `account_holder_name`, `bank_account_number`, `ifsc_or_routing_code`, `bank_name`, `updated_at`. Isolated from vendor profile API responses.
- **D-03:** `vendor_users` table: `id UUID`, `vendor_id FK`, `email TEXT UNIQUE`, `password_hash TEXT`, `role pgEnum(owner|manager|staff)`, `invited_by FK nullable`, `accepted_at nullable`, `archived_at`, `created_at`, `updated_at`. Migration copies Phase 3 vendor owner accounts (email + password_hash) from `vendors` to `vendor_users` as `role='owner'`. VendorAuthService authenticates against `vendor_users`. Old `email`/`password_hash` on `vendors` retained but unused.
- **D-04:** Staff invite flow: `POST /vendor/team/invite { email, role }` → `vendor_staff_invites` row (`id`, `vendor_id`, `email`, `role`, `invite_token UUID UNIQUE`, `invited_by FK`, `expires_at` 48h, `accepted_at`). Email sent via mailer. Accept link `/vendor/accept-invite?token=XXX` → create `vendor_users` row.
- **D-05:** Three roles: `owner` (full), `manager` (products/inventory/orders/returns/coupons, no team/payout/profile), `staff` (inventory quantity view/edit + orders view/mark-shipped). Permission enforcement backend-side via `request.vendorUser.role` from JWT.
- **D-06:** Vendor JWT payload: `{ sub: vendorUserId, vendorId, role, email }`. Existing Phase 3 JWTs invalidated — refresh token rotation forces re-login after migration.
- **D-07:** `vendor_payouts` table (append-only): `id UUID`, `vendor_id FK`, `amount_minor BIGINT`, `settlement_reference TEXT`, `note TEXT nullable`, `settled_by_admin_email TEXT`, `settled_at TIMESTAMP`, `created_at`. No updates ever.
- **D-08:** Admin payout page per vendor: summary strip (total earned, reversed, net, settled, outstanding balance), commission ledger table, settlements table, vendor payout info as read-only panel.
- **D-09:** Vendor earnings page (MKT-05): mirrors admin payout view minus settlement entry form and other vendors' data.
- **D-10:** Admin dashboard: 7d/30d/90d toggle (default 30d). Metrics: GMV, Orders, Active Vendors, New Customers, Commission Earned, Pending Payouts. `GET /admin/analytics/summary?period=30d`. Orders-by-day line chart, Top 5 vendors GMV table, GMV-by-category bar chart. Manual refresh, no polling.
- **D-11:** CMS block management: structured form (no WYSIWYG). Ordered list with type badge, active toggle, Edit/Delete, Up/Down arrows (no drag-and-drop). Type-specific edit modal. Image fields URL-input only.
- **D-12:** Feature flag management: simple toggle list. All rows from `feature_flags`. `PATCH /admin/feature-flags/:key { enabled: boolean }`. FeatureFlagService invalidates Redis on update.
- **D-13:** `audit_log` table: `id UUID`, `actor_type TEXT (admin|vendor|system)`, `actor_id TEXT`, `actor_email TEXT`, `action TEXT (dot-namespaced)`, `entity_type TEXT`, `entity_id TEXT`, `before JSONB nullable`, `after JSONB nullable`, `ip_address TEXT`, `created_at`. Service-layer writes. Admin page: filterable table.
- **D-14:** `coupons` table gains `created_by_type TEXT` and `created_by_id TEXT`. Vendor coupons auto-scoped to own store (`scope='vendor'`). Vendor Coupons nav hidden when `COUPONS_ENABLED` flag off.
- **D-15:** Inventory & Pricing: combined table view per product/variant showing `quantity_available`, `quantity_reserved` (read-only), `base_price_minor` (editable). `PATCH /vendor/inventory/:inventoryItemId` + `PATCH /vendor/products/:productId/pricing`. Price updates trigger `ProductIndexJob` (BullMQ).
- **D-16:** Vendor returns page: list of `return_requests` for their sub-orders. Approve → `ReturnService.approveReturn()` (wallet credit or payment refund + commission reversal). Reject → status `rejected` + rejection reason. Both logged to `audit_log`.
- **D-17:** Admin vendor list: paginated table. Actions: Approve/Suspend/Reinstate/Configure (side panel for category restrictions + commission override). No hard-delete.
- **D-18:** Commission Engine Config UI: three sections (Global rate, Category overrides, Vendor overrides). Global rate row pinned, undeletable. Category/vendor overrides: Add/Edit/Delete. All mutations logged to `audit_log`.
- **D-19:** `marketplace_settings` table: `key TEXT PK`, `value JSONB`, `updated_at`. Groups: General, Branding, Email, Integration visibility. `SettingsService` wraps with Redis caching (same pattern as FeatureFlagService).
- **D-20:** Both panels: persistent left sidebar (collapses to icon bar on tablet, hamburger on mobile), top header with breadcrumbs + user avatar + logout, main content area. Vendor sidebar: Dashboard, Products, Inventory & Pricing, Orders, Returns, Earnings & Payouts, Coupons (feature-flagged), Team, Store Profile, Settings. Admin sidebar: Dashboard, Vendors, Catalog Moderation, Commission Rules, Payout Management, CMS/Homepage, Feature Flags, Settings & Branding, Audit Log (+ existing Categories).
- **D-21:** Admin auth: new `admin_users` table (`id`, `email`, `password_hash`, `created_at`). `AdminAuthService` + `POST /admin/auth/login`. Admin panel login page at `apps/web-admin/src/pages/auth/LoginPage.tsx`. httpOnly cookie auth (Phase 4 D-09 pattern). Admin JWTs: `role=admin`.

### Claude's Discretion

- Exact Framer Motion animations for sidebar collapse/expand, page transitions
- Drizzle schema column ordering and index choices beyond what's specified
- Error state and empty state designs for all tables
- Admin analytics query optimization (single SQL vs multiple; views vs CTEs)
- Exact admin email template for vendor staff invites
- Pagination strategy for audit log and vendor list (cursor-based vs offset; offset fine for v1)
- Return window eligibility check details (vendor UI for `vendor_return_policies`)
- React Query cache invalidation strategy for vendor dashboard metrics
- Order of sidebar items beyond what's specified

### Deferred Ideas (OUT OF SCOPE)

- Automated vendor payouts via Stripe Connect / Razorpay Route (v2 — PAY2-01)
- Tiered commission rates
- File upload for images (URL-input only in v1)
- Rich text editor for CMS text blocks
- Bulk CSV inventory import
- Vendor analytics beyond dashboard summary
- Admin analytics beyond summary KPIs
- Per-customer coupon use limit
- Vendor return policy UI is IN SCOPE (reminder not to miss it)
</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| MKT-04 | Admin can view payout records per vendor with full audit trail (earned, reversed, net) and record manual settlement | D-07/D-08: `vendor_payouts` append-only table + commission ledger query pattern verified in codebase |
| MKT-05 | Vendor can view their earnings and payout status | D-09: mirrors admin payout view, `vendor_commission_entries` query verified |
| VEN-01 | Vendor can complete onboarding and manage a store profile | D-01 `vendors` extension + `onboarding_status` pgEnum + D-21 `admin_users` table enable the approval workflow |
| VEN-02 | Vendor has a dashboard summarizing orders, earnings, and inventory health | D-10 pattern adapted for vendor scope; low-stock threshold from `marketplace_settings` |
| VEN-03 | Vendor can manage inventory levels and pricing for their products | D-15: `PATCH /vendor/inventory/:id` + `PATCH /vendor/products/:id/pricing` + `ProductIndexJob` trigger |
| VEN-04 | Vendor can manage orders (view, update status, handle returns/refunds) | D-16: `ReturnService.approveReturn()` already implemented in Phase 5; vendor routes extend existing `OrderService` |
| VEN-05 | Vendor owner can invite vendor staff and assign limited permissions | D-03/D-04/D-05: `vendor_users` + `vendor_staff_invites` + role scope table |
| VEN-06 | Vendor can manage promotions/coupons where enabled | D-14: `coupons` table extension + feature-flag guard |
| ADM-01 | Admin has a dashboard with marketplace KPIs and reporting | D-10: `/admin/analytics/summary?period=N` + chart data endpoints |
| ADM-02 | Admin can manage vendors (approve, suspend, configure) | D-17: `onboarding_status` transitions + `audit_log` writes |
| ADM-03 | Admin can configure the commission engine (rules and rates) | D-18: existing `commission_rules` table; CRUD endpoints + cache invalidation |
| ADM-04 | Admin can manage CMS/content blocks and homepage merchandising | D-11: write endpoints for `homepage_blocks` + `HomepageService.invalidateBlocks()` |
| ADM-05 | Admin can manage global settings, integrations setup, and theme/branding | D-19: `marketplace_settings` table + `SettingsService` Redis pattern |
| ADM-06 | Admin can manage feature flags (toggle wallet, coupons, tracking, providers) | D-12: `PATCH /admin/feature-flags/:key` + existing `FeatureFlagService.invalidateFlag()` |
| ADM-07 | Admin can moderate catalog and view audit log of sensitive actions | D-13: `audit_log` table + filterable admin UI |
</phase_requirements>

---

## Summary

Phase 6 is the largest UI-heavy phase in the project. It builds two complete operational panels — the vendor panel (`apps/web-vendor`) and admin panel (`apps/web-admin`) — on top of a mature backend. The bulk of the backend work is new schema tables (6 new + 2 modified), a database migration that moves auth from `vendors` to `vendor_users`, new service classes following established patterns, and new Fastify route plugins. The frontend work is the majority of the development effort: two full panel shells with persistent sidebar layouts, role-based navigation, and approximately 20+ distinct admin/vendor pages.

The critical planning constraint is the **vendor auth migration** (D-03/D-06). Phase 3 VendorAuthService reads from `vendors.email`; Phase 6 must migrate those credentials to `vendor_users` as `role='owner'` rows, update VendorAuthService to authenticate against `vendor_users`, and update all existing vendor API routes that use `request.vendor.id` (the old `vendors.id` FK) to use `request.vendorUser.vendorId` (the new `vendor_users.vendorId` FK). This migration touches existing route middleware and requires all existing Phase 3/4/5 vendor route tests to pass after the change.

The admin panel already has a React Router v7 app shell with the category CRUD pages from Phase 2. Phase 6 adds all new admin routes alongside those existing pages. The vendor panel currently has only a placeholder `App.tsx`; Phase 6 builds it from scratch with the full panel shell. Both panels need react-router-dom (already in web-admin; needs installing for web-vendor), Zustand auth stores, and apiClient with cookie credentials support.

**Primary recommendation:** Execute the migration as Wave 0 (migration-only, no feature code), validate that all existing vendor routes continue to pass tests, then build new features atop the stable new auth base. Keep all new backend services as standalone modules following the `FeatureFlagService` Redis-first pattern, and register them in `container.ts` before wiring routes.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Vendor auth (owner/manager/staff JWT) | API / Backend | — | JWT issuance is always backend-authoritative; role guard is server-side |
| Admin auth (admin JWT) | API / Backend | — | Same JWT infrastructure; AdminAuthService mirrors VendorAuthService |
| Staff invite flow | API / Backend | Frontend Server (email link) | Token generation + email send is backend; accept UI is vendor panel page |
| Role-based route guarding | API / Backend | Frontend (UX only) | API enforces role; frontend hides UI elements as UX convenience only (D-05) |
| Vendor dashboard KPIs | API / Backend | — | Computed server-side from vendor_orders + commission_entries; client renders only |
| Admin analytics KPIs | API / Backend | — | SQL aggregation queries; no client-side computation |
| Commission rule CRUD | API / Backend | — | Must invalidate Redis rate cache on any mutation |
| Payout settlement recording | API / Backend | — | Append-only insert to vendor_payouts; outstanding balance query is server-side |
| Feature flag toggle | API / Backend | — | Must call FeatureFlagService.invalidateFlag() on PATCH |
| Homepage block write (CMS) | API / Backend | — | Must call HomepageService.invalidateBlocks() on all mutations |
| Marketplace settings | API / Backend | — | SettingsService Redis-first, same as FeatureFlagService |
| Audit log write | API / Backend | — | All writes in service layer, not middleware |
| Vendor panel shell + routing | Frontend Server (Vite SPA) | — | apps/web-vendor — persistent sidebar, protected routes, role-aware nav |
| Admin panel shell + routing | Frontend Server (Vite SPA) | — | apps/web-admin — extends existing React Router v7 app |
| Inventory inline editing | Frontend Server (Vite SPA) | API | Client-side UX; PATCH calls to backend for save |
| CMS block ordering (Up/Down) | Frontend Server (Vite SPA) | API | No drag-and-drop; arrow buttons call reorder endpoint |
| Return approval action | Frontend Server (Vite SPA) | API | Vendor UI triggers; ReturnService.approveReturn() is backend |

---

## Standard Stack

### Core (already installed — verified from pnpm-lock.yaml and node_modules/.pnpm)

| Library | Installed Version | Purpose | Notes |
|---------|------------------|---------|-------|
| react | 19.2.6 | UI framework | [VERIFIED: pnpm store] |
| react-dom | 19.2.6 | DOM renderer | [VERIFIED: pnpm store] |
| react-router-dom | 7.16.0 | Routing (both panels) | [VERIFIED: pnpm store] Already in web-admin; needs adding to web-vendor |
| framer-motion | 12.40.0 | Animations (import `motion/react`) | [VERIFIED: pnpm store] Both panel packages already have it |
| @tanstack/react-query | 5.100.x | Server state / API data | [VERIFIED: pnpm store] |
| zustand | 5.0.x | Client state (auth, UI) | [VERIFIED: pnpm store] |
| tailwindcss | 4.3.x | Styling | [VERIFIED: pnpm store] |
| @dnd-kit/core | 6.3.1 | Drag-and-drop (web-admin already) | [VERIFIED: pnpm store] NOT needed for Phase 6 (D-11: no DnD in v1) |
| drizzle-orm | 1.0.0-rc.3 | ORM (backend) | [VERIFIED: pnpm store] |
| jose | 6.2.3 | JWT signing/verify | [VERIFIED: pnpm store] |
| argon2 | 0.44.0 | Password hashing | [VERIFIED: pnpm store] AdminAuthService + updated VendorAuthService use this |
| nodemailer | 8.0.10 | Email (staff invites) | [VERIFIED: pnpm store] Existing mailer module; no new install needed |
| bullmq | 5.77.6 | Job queue (ProductIndexJob trigger from pricing updates) | [VERIFIED: pnpm store] |

### Packages Needing Installation (web-vendor only)

web-vendor currently has NO react-router-dom in its package.json (confirmed). It needs:

```
react-router-dom (already workspace-level, just add to web-vendor/package.json)
```

**No new npm packages** are required for Phase 6. All dependencies are already installed workspace-wide or available via existing packages. The analytics charts (ADM-01 D-10: line chart, bar chart) should use an existing lightweight charting approach. Since recharts or similar are NOT in the pnpm store [ASSUMED based on grep finding no results], the planner has two options: (a) use a small inline SVG chart component, or (b) add recharts. The planner should check this decision point.

> **Note on charting:** recharts is [ASSUMED] not installed. Given the small chart requirement (one line chart, one bar chart in v1 admin dashboard), the planner may choose to implement minimal SVG charts inline rather than adding a new dependency. This is in Claude's Discretion territory.

### Packages NOT Needed

- No new backend packages — all services use existing deps (argon2, jose, nodemailer, drizzle, ioredis, bullmq)
- No new frontend packages beyond potentially react-router-dom for web-vendor (which is a workspace dep anyway)

---

## Package Legitimacy Audit

> slopcheck was unavailable at research time (installation was denied by auto-mode classifier). All packages below are [VERIFIED: pnpm store] — they are already installed workspace-wide from prior phases and have not been newly introduced.

| Package | Registry | Installed Version | Source Repo | Status |
|---------|----------|------------------|-------------|--------|
| react-router-dom | npm | 7.16.0 | github.com/remix-run/react-router | Already installed Phase 2/4 — Approved |
| framer-motion | npm | 12.40.0 | github.com/framer/motion | Already installed Phase 4 — Approved |
| @tanstack/react-query | npm | 5.100.x | github.com/TanStack/query | Already installed Phase 4 — Approved |
| zustand | npm | 5.0.x | github.com/pmndrs/zustand | Already installed Phase 4 — Approved |
| argon2 | npm | 0.44.0 | github.com/ranisalt/node-argon2 | Already installed Phase 3 — Approved |
| nodemailer | npm | 8.0.10 | github.com/nodemailer/nodemailer | Already installed Phase 4 — Approved |
| bullmq | npm | 5.77.6 | github.com/taskforcesh/bullmq | Already installed Phase 3 — Approved |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none

*No net-new packages are introduced in Phase 6. The planner must add a `checkpoint:human-verify` task only if a charting library is proposed as a new addition.*

---

## Architecture Patterns

### System Architecture Diagram

```
┌─────────────────────────────────────────────────────────────────┐
│                     apps/web-vendor (Vite SPA)                  │
│  Login Page → VendorAuthStore (Zustand + httpOnly cookie)        │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PanelLayout: Sidebar + Header + AnimatePresence Outlet     │ │
│  │  ├── VendorProtectedRoute (role check)                     │ │
│  │  │    ├── DashboardPage (React Query → GET /vendor/...)    │ │
│  │  │    ├── ProductsPage / InventoryPage / OrdersPage        │ │
│  │  │    ├── ReturnsPage (→ POST /vendor/returns/:id/approve) │ │
│  │  │    ├── EarningsPage (→ GET /vendor/earnings)            │ │
│  │  │    ├── CouponsPage (feature-flagged nav item)           │ │
│  │  │    ├── TeamPage (owner only → POST /vendor/team/invite) │ │
│  │  │    ├── StoreProfilePage (→ PATCH /vendor/profile)       │ │
│  │  │    └── SettingsPage (return policy, payout info)        │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
                              │ fetch + httpOnly cookie
                              ▼
┌─────────────────────────────────────────────────────────────────┐
│                    apps/api (Fastify + Awilix)                   │
│                                                                  │
│  POST /vendor/auth/login → VendorAuthService (vendor_users)     │
│  POST /admin/auth/login  → AdminAuthService  (admin_users)      │
│                                                                  │
│  Vendor routes (/vendor/*) → requireVendorAuth middleware       │
│    → VendorAuthService.verifyToken() → {sub=vendorUserId,       │
│       vendorId, role} → role guard per route                    │
│                                                                  │
│  Admin routes (/admin/*) → requireAdminAuth middleware          │
│                                                                  │
│  Service Layer:                                                  │
│   VendorAuthService → vendor_users table (migrated from Phase 3)│
│   AdminAuthService  → admin_users table (new)                   │
│   SettingsService   → marketplace_settings (Redis-first)        │
│   AuditService      → audit_log table (append-only writes)      │
│   CommissionService → commission_rules (existing + cache inval) │
│   ReturnService     → return_requests (existing approveReturn()) │
│   HomepageService   → invalidateBlocks() on CMS mutations       │
│   FeatureFlagService→ toggle + invalidate (existing)            │
│                                                                  │
│  DB writes: vendor_users migration, vendor_payouts INSERT,      │
│  audit_log INSERT, marketplace_settings UPSERT,                 │
│  vendor_staff_invites INSERT/UPDATE, admin_users INSERT          │
└─────────────────────────────────────────────────────────────────┘
                              │
┌─────────────────────────────────────────────────────────────────┐
│                     apps/web-admin (Vite SPA)                   │
│  Login Page (new) → AdminAuthStore (Zustand + httpOnly cookie)   │
│  ┌────────────────────────────────────────────────────────────┐ │
│  │ PanelLayout: Sidebar + Header + AnimatePresence Outlet     │ │
│  │  ├── AdminProtectedRoute (role=admin check)                │ │
│  │  │    ├── DashboardPage (KPIs + charts)                    │ │
│  │  │    ├── VendorsPage (approve/suspend/configure)          │ │
│  │  │    ├── CatalogModerationPage (approve/reject products)  │ │
│  │  │    ├── CommissionRulesPage                              │ │
│  │  │    ├── PayoutManagementPage (per-vendor ledger)         │ │
│  │  │    ├── CmsPage (homepage blocks)                        │ │
│  │  │    ├── FeatureFlagsPage (toggle list)                   │ │
│  │  │    ├── SettingsPage (marketplace_settings)              │ │
│  │  │    ├── AuditLogPage (filterable table)                  │ │
│  │  │    └── /categories/* (Phase 2 existing — UNCHANGED)     │ │
│  └────────────────────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────────────────────┘
```

### Recommended Project Structure

**Backend (apps/api/src/modules — NEW modules for Phase 6):**
```
apps/api/src/modules/
├── vendor-auth/           # UPDATE: migrate to vendor_users table
│   ├── VendorAuthService.ts  # UPDATE: authenticate against vendor_users
│   └── index.ts
├── admin-auth/            # NEW: AdminAuthService (mirrors VendorAuthService)
│   ├── AdminAuthService.ts
│   └── index.ts
├── settings/              # NEW: SettingsService (marketplace_settings)
│   ├── SettingsService.ts
│   └── index.ts
├── audit/                 # NEW: AuditService (audit_log writes)
│   ├── AuditService.ts
│   └── index.ts
├── vendor-management/     # NEW: VendorManagementService (approve/suspend)
│   ├── VendorManagementService.ts
│   └── index.ts
├── vendor-staff/          # NEW: VendorStaffService (invite/role management)
│   ├── VendorStaffService.ts
│   └── index.ts
├── analytics/             # NEW: AnalyticsService (admin + vendor dashboards)
│   ├── AnalyticsService.ts
│   └── index.ts
└── vendor-profile/        # NEW: VendorProfileService (store profile, payout info)
    ├── VendorProfileService.ts
    └── index.ts
```

**Backend schema additions (apps/api/src/db/schema — NEW files):**
```
apps/api/src/db/schema/
├── vendor-users.ts          # NEW (D-03)
├── vendor-staff-invites.ts  # NEW (D-04)
├── vendor-payout-info.ts    # NEW (D-02)
├── vendor-payouts.ts        # NEW (D-07)
├── admin-users.ts           # NEW (D-21)
├── marketplace-settings.ts  # NEW (D-19)
└── audit-log.ts             # NEW (D-13)
```
And modifications to:
```
├── vendors.ts               # EXTEND: store_name, store_description, logo_url, banner_url,
│                            #   contact_email, contact_phone, address, onboarding_status pgEnum
└── coupons.ts               # EXTEND: created_by_type TEXT, created_by_id TEXT
```

**Frontend (apps/web-vendor/src — NEW from scratch):**
```
apps/web-vendor/src/
├── lib/
│   ├── apiClient.ts         # credentials:'include' fetch wrapper
│   └── queryClient.ts       # TanStack Query client
├── stores/
│   ├── vendorAuthStore.ts   # Zustand — JWT payload + logout
│   └── uiStore.ts           # sidebar collapsed state
├── components/
│   └── layout/
│       ├── PanelLayout.tsx  # Sidebar + Header + AnimatePresence Outlet
│       ├── Sidebar.tsx      # Left sidebar (collapses on tablet)
│       └── ProtectedVendorRoute.tsx
├── pages/
│   ├── auth/
│   │   ├── LoginPage.tsx
│   │   └── AcceptInvitePage.tsx  # /accept-invite?token=XXX
│   ├── DashboardPage.tsx
│   ├── ProductsPage.tsx
│   ├── InventoryPage.tsx
│   ├── OrdersPage.tsx
│   ├── ReturnsPage.tsx
│   ├── EarningsPage.tsx
│   ├── CouponsPage.tsx
│   ├── TeamPage.tsx
│   ├── StoreProfilePage.tsx
│   └── SettingsPage.tsx  # return policy + payout info
└── router.tsx
```

**Frontend (apps/web-admin/src — EXTEND existing):**
```
apps/web-admin/src/
├── lib/
│   └── apiClient.ts         # UPDATE: replace X-Internal-Admin-Token with cookie credentials
├── stores/
│   └── adminAuthStore.ts    # NEW: Zustand admin auth state
├── components/
│   └── layout/
│       ├── PanelLayout.tsx  # NEW: replaces the inline header in App.tsx
│       ├── Sidebar.tsx      # NEW
│       └── ProtectedAdminRoute.tsx  # NEW
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx    # NEW (D-21)
│   ├── categories/          # EXISTING — unchanged
│   ├── DashboardPage.tsx    # NEW (ADM-01)
│   ├── VendorsPage.tsx      # NEW (ADM-02)
│   ├── CatalogModerationPage.tsx  # NEW (ADM-07)
│   ├── CommissionRulesPage.tsx    # NEW (ADM-03)
│   ├── PayoutManagementPage.tsx   # NEW (MKT-04)
│   ├── CmsPage.tsx          # NEW (ADM-04)
│   ├── FeatureFlagsPage.tsx # NEW (ADM-06)
│   ├── SettingsPage.tsx     # NEW (ADM-05)
│   └── AuditLogPage.tsx     # NEW (ADM-07)
└── App.tsx                  # UPDATE: wrap in PanelLayout, add ProtectedAdminRoute, add all new routes
```

### Pattern 1: Panel Layout with Persistent Sidebar (NEW — Claude's Discretion)

**What:** Both panels use a three-zone layout: fixed left sidebar + fixed top header + scrollable main content. The sidebar collapses to icon-only on tablet.

**When to use:** All authenticated panel pages.

**Key implementation notes (verified from existing code):**
- Use `AnimatePresence mode="wait"` for page transitions (same as storefront `AppLayout.tsx` pattern)
- `framer-motion` import from `motion/react` in web-vendor (since vite alias is set), from `framer-motion` in web-admin (CLAUDE.md says framer-motion is the package name; storefront uses `motion/react`; web-admin uses `framer-motion` — check vite.config to confirm alias)
- Sidebar collapsed state lives in Zustand `uiStore` (same pattern as storefront)

```typescript
// Source: apps/web-storefront/src/components/layout/AppLayout.tsx (verified pattern)
// Adapt for panel layout with sidebar
import { AnimatePresence } from 'motion/react'; // web-vendor
// OR: import { AnimatePresence } from 'framer-motion'; // web-admin (verify alias)
import { Outlet, useLocation } from 'react-router-dom';

export function PanelLayout() {
  const location = useLocation();
  return (
    <div className="flex min-h-screen">
      <Sidebar />
      <div className="flex flex-1 flex-col">
        <Header />
        <main className="flex-1 overflow-auto p-6">
          <AnimatePresence mode="wait">
            <div key={location.pathname}><Outlet /></div>
          </AnimatePresence>
        </main>
      </div>
    </div>
  );
}
```

### Pattern 2: VendorAuthService Migration (CRITICAL)

**What:** Phase 3 VendorAuthService reads from `vendors.email` + `vendors.passwordHash`. Phase 6 migrates to `vendor_users` table.

**Existing login flow (from `VendorAuthService.ts`, verified):**
```typescript
// CURRENT (Phase 3):
const rows = await db.select().from(vendors).where(eq(vendors.email, email)).limit(1);
// JWT: { sub: vendor.id, role: 'vendor', vendorId: vendor.id }

// PHASE 6 UPDATED:
const rows = await db.select().from(vendorUsers).where(eq(vendorUsers.email, email)).limit(1);
// JWT: { sub: vendorUser.id, role: vendorUser.role, vendorId: vendorUser.vendorId, email: vendorUser.email }
```

**Impact on existing vendor middleware:** All existing vendor routes that extract `request.vendor.id` must be updated. After migration, the JWT `sub` is `vendorUsers.id` (not `vendors.id`). The `vendorId` claim provides the vendor's FK. Any query that uses `request.vendor.id` as a vendor FK must switch to `request.vendorUser.vendorId`.

### Pattern 3: SettingsService (Follows FeatureFlagService exactly)

**What:** `SettingsService` wraps `marketplace_settings` (key-value JSONB) with Redis-first caching. Redis key pattern: `"settings:<key>"`.

```typescript
// Source: FeatureFlagService.ts (verified pattern)
// SettingsService is identical pattern; redis key: "settings:<key>"
async getSetting(key: string): Promise<unknown | null> {
  const cached = await redis.get(`settings:${key}`);
  if (cached !== null) return JSON.parse(cached);
  const rows = await db.select().from(marketplaceSettings).where(eq(marketplaceSettings.key, key)).limit(1);
  if (!rows[0]) return null;
  await redis.setex(`settings:${key}`, env.FEATURE_FLAG_TTL_SECONDS, JSON.stringify(rows[0].value));
  return rows[0].value;
}
async updateSetting(key: string, value: unknown): Promise<void> {
  await db.insert(marketplaceSettings).values({ key, value }).onConflictDoUpdate({
    target: marketplaceSettings.key,
    set: { value, updatedAt: new Date() }
  });
  await redis.del(`settings:${key}`);
}
```

### Pattern 4: AuditService (append-only log writes from service layer)

**What:** A thin service that inserts `audit_log` rows. All meaningful admin/vendor actions call this service. NOT middleware.

```typescript
// Source: CONTEXT.md D-13 (design decision)
export class AuditService {
  async log(params: {
    actorType: 'admin' | 'vendor' | 'system';
    actorId: string;
    actorEmail: string;
    action: string;          // e.g., 'vendor.approved', 'commission_rule.created'
    entityType: string;
    entityId: string;
    before?: unknown;
    after?: unknown;
    ipAddress?: string;
  }): Promise<void> {
    await db.insert(auditLog).values({ ...params, createdAt: new Date() });
  }
}
```

### Pattern 5: Admin panel apiClient upgrade

The existing `apps/web-admin/src/lib/apiClient.ts` (verified) uses an `X-Internal-Admin-Token` header — a Phase 2 dev placeholder. Phase 6 replaces this with the httpOnly cookie pattern (Phase 4 D-09). The new admin apiClient must:
1. Remove the `X-Internal-Admin-Token` header
2. Add `credentials: 'include'` to all fetch calls
3. Handle 401 responses by redirecting to `/auth/login`

This matches the customer storefront apiClient pattern from Phase 4.

### Pattern 6: ProtectedRoute with role check (extends storefront pattern)

```typescript
// Source: apps/web-storefront/src/components/layout/ProtectedRoute.tsx (verified)
// Extension for panel routes with role awareness
export function ProtectedVendorRoute({ requiredRole }: { requiredRole?: VendorRole }) {
  const { isAuthenticated, user, isLoading } = useVendorAuth();
  const location = useLocation();
  if (isLoading) return null;
  if (!isAuthenticated) return <Navigate to="/auth/login" replace state={{ from: location.pathname }} />;
  if (requiredRole && !hasRole(user.role, requiredRole)) return <Navigate to="/" replace />;
  return <Outlet />;
}
```

### Pattern 7: Vendor Payout Outstanding Balance Query

**Source: CONTEXT.md D-08 specifics section (verified design)**

```sql
-- Outstanding balance for a vendor (net owed minus settled)
SELECT
  COALESCE(SUM(CASE WHEN vce.status = 'earned' THEN vce.commission_amount_minor ELSE 0 END), 0) AS total_earned,
  COALESCE(SUM(CASE WHEN vce.status = 'reversed' THEN vce.commission_amount_minor ELSE 0 END), 0) AS total_reversed,
  COALESCE((SELECT SUM(vp.amount_minor) FROM vendor_payouts vp WHERE vp.vendor_id = $vendorId), 0) AS total_settled
FROM vendor_commission_entries vce
JOIN vendor_orders vo ON vce.vendor_order_id = vo.id
WHERE vo.vendor_id = $vendorId;
-- outstanding = total_earned - total_reversed - total_settled
```

### Anti-Patterns to Avoid

- **Using `vendors.email` / `vendors.password_hash` for new auth code:** After Phase 6 migration, all auth flows read from `vendor_users`. The old columns remain in the schema but are dead code.
- **Modifying existing `vendor_commission_entries` rows on return approval:** `ReturnService.approveReturn()` already correctly inserts a new `reversed` row; the vendor returns page calls this existing method. Never update existing commission rows.
- **Trusting client-provided role in vendor API requests:** Role must come from the JWT payload, never from request body.
- **Deleting commission rules with `scope='global'`:** The single global rule must be PIN-protected (no delete button in UI, 403 response on DELETE endpoint for global scope).
- **Storing float/decimal for `vendor_payouts.amount_minor`:** BIGINT mode:number per Pitfall 1. The admin settlement form collects a decimal amount display value (e.g., ₹500.00) but the service converts to minor units before inserting.
- **Calling HomepageService.invalidateBlocks() before the DB write succeeds:** Invalidation must happen AFTER the DB write. If it happens before, a concurrent read repopulates cache from stale DB state.
- **Admin panel routing: replacing existing category routes:** Phase 2 category pages at `/categories` and `/categories/:id` must remain unchanged. Phase 6 adds new routes alongside them, not replacing them.
- **New vendor panel importing from `framer-motion` directly without checking vite alias:** The web-storefront uses `motion/react` (via Vite alias). Web-vendor should use the same pattern; verify its `vite.config.ts` has the same alias before coding pages.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Commission rate caching | Custom Redis TTL code | Follow CommissionService.resolveRate() pattern (verified) | Redis-first cache + DB fallback already proven with FEATURE_FLAG_TTL_SECONDS TTL |
| Password hashing for AdminAuthService | Custom crypto | `argon2.hash()` / `argon2.verify()` (already installed, 0.44.0) | Argon2id is the existing pattern in VendorAuthService and CustomerAuthService |
| JWT issuance for AdminAuthService | Custom JWT | `SignJWT` / `jwtVerify` from `jose@6.2.3` (already installed) | Exact same pattern as VendorAuthService — copy the pattern |
| Commission balance arithmetic | Custom subtraction | SQL `SUM()` aggregation in AnalyticsService | BIGINT arithmetic in SQL is exact; avoid JS number arithmetic on large sums |
| Staff invite token generation | Custom UUID | `crypto.randomUUID()` (Node built-in) | No new package needed |
| Homepage block JSONB validation | Custom validator | `MerchandisingBlockSchema.parse()` from `@grovio/contracts` (Phase 4) | Already built and validated in HomepageService |
| Redis cache invalidation strategy | Custom pub/sub | Simple `redis.del(key)` (consistent with all existing services) | Write-through invalidation pattern is established across the project |
| Vendor payout balance | Manual JS reduce | Server-side SQL SUM with BIGINT columns | BIGINT SQL arithmetic is exact; JS number overflow risk on large amounts |

**Key insight:** This phase is mostly assembly of established patterns (Redis-first service, argon2+jose auth, append-only ledger, BullMQ job trigger). The planner should not propose new patterns for problems already solved in the codebase.

---

## Common Pitfalls

### Pitfall 1: vendor_users Migration Breaking Existing Vendor Routes

**What goes wrong:** After migrating auth from `vendors` to `vendor_users`, the JWT `sub` changes from `vendors.id` to `vendor_users.id`. All existing Phase 3/4/5 vendor routes that extract the vendor's ID from the JWT and use it as a FK for `vendors.id` will query with the wrong value.

**Why it happens:** The current `VendorTokenPayload` has `sub = vendor.id` AND `vendorId = vendor.id` (they're the same value). After migration, `sub = vendorUser.id` (different from `vendors.id`) and `vendorId = vendorUser.vendorId` (the FK to `vendors`). Route middleware that reads `request.vendor.id` expecting a `vendors.id` FK will get a `vendor_users.id` UUID instead.

**How to avoid:** Before writing any Phase 6 feature code, audit every existing vendor route handler for `request.vendor.id` usage. After migration, the correct value for FK queries is `request.vendorUser.vendorId`. Update all existing route handlers and their tests as Wave 0.

**Warning signs:** Existing Phase 5 vendor tests start failing after the migration is applied.

### Pitfall 2: Admin Panel apiClient Token Bypass

**What goes wrong:** The existing `apps/web-admin/src/lib/apiClient.ts` sends `X-Internal-Admin-Token` from `VITE_INTERNAL_ADMIN_TOKEN`. If Phase 6 adds protected routes but doesn't update this apiClient, admin API calls will fail (token rejected once real admin JWT middleware is active).

**Why it happens:** The `apiClient.ts` comment explicitly says "Phase 4 replaces with JWT" but Phase 4 didn't actually build the admin JWT — that's Phase 6. The Phase 2 placeholder survived 4 phases.

**How to avoid:** Early in Phase 6, update `apps/web-admin/src/lib/apiClient.ts` to use `credentials: 'include'` and remove the admin token header. This must happen before any admin UI page is built.

### Pitfall 3: HomepageService Cache Not Invalidated After CMS Writes

**What goes wrong:** Admin creates/updates/deletes/reorders a homepage block, but the storefront still shows the old content for up to `HOMEPAGE_BLOCKS_TTL_SECONDS` (default 300s = 5 minutes).

**Why it happens:** HomepageService has an `invalidateBlocks()` method, but if the admin route handler doesn't call it after every write, the cache is stale.

**How to avoid:** Every admin endpoint handler that writes to `homepage_blocks` MUST call `homepageService.invalidateBlocks()` after the DB write succeeds. Verify this in the plan task checklist.

### Pitfall 4: Commission Rule Cache Not Invalidated After Rule Changes

**What goes wrong:** Admin updates a commission rate, but new orders still use the old cached rate for up to 60s (FEATURE_FLAG_TTL_SECONDS).

**Why it happens:** `CommissionService.resolveRate()` caches rates in Redis with key `commission:rate:{vendorId}:{categoryId}`. The admin commission rule endpoints must invalidate the relevant cache keys on mutation.

**How to avoid:** When a commission rule is created/updated/deleted, call `CommissionService.invalidateRateCache(vendorId?, categoryId?)` or delete the pattern `commission:rate:*` from Redis. The simplest approach: on any commission rule mutation, delete all `commission:rate:*` keys (acceptable for v1 given low mutation frequency).

### Pitfall 5: vendor_payouts amount_minor BIGINT vs JavaScript Number

**What goes wrong:** The admin settlement form shows a currency input (e.g., "₹5000.00"). If the frontend sends this directly as `5000.00` (float) or the backend stores it as NUMERIC/FLOAT, rounding drift occurs.

**Why it happens:** Frontend forms collect decimal values; minor-unit conversion must happen server-side.

**How to avoid:** Frontend sends the display value as a string (e.g., `"5000.00"`). Backend service converts: `Math.round(parseFloat(amount) * 100)` for INR paise. Store as BIGINT. Never accept `amountMinor` from client directly.

### Pitfall 6: Vendor JWT Invalidation After Migration

**What goes wrong:** Vendors logged in before the Phase 6 migration deploy have JWTs with `sub=vendors.id`. After migration, the middleware validates against `vendor_users`, but the old JWT `sub` value won't match any `vendor_users.id`.

**Why it happens:** JWT tokens are self-contained; the backend can't proactively revoke them.

**How to avoid:** D-06 specifies "refresh token rotation forces re-login after migration deploy." The simplest implementation: bump the `JWT_SECRET` value in production env as part of the migration deploy. This invalidates all outstanding JWTs (both vendor and customer — communicate this to the admin deploying). Alternatively, add a `jti` (JWT ID) blacklist in Redis, but the secret rotation approach is simpler for v1.

### Pitfall 7: React Router v7 (not v6) — import paths

**What goes wrong:** Phase 6 code uses React Router v6 imports (e.g., `import { Route } from 'react-router-dom'`) but the installed version is react-router-dom@7.16.0. The API is mostly compatible but some patterns differ (e.g., `createBrowserRouter` is preferred; `<Routes>` + `<Route>` still works but some v7 features may be used).

**Why it happens:** Training data and documentation mention React Router v6; the installed package is v7. The storefront uses `createBrowserRouter` (verified in `router.tsx`), which is the correct v7 pattern.

**How to avoid:** Both panels use `createBrowserRouter` from `react-router-dom` (not the older `<BrowserRouter>` + `<Routes>` pattern). The existing admin `App.tsx` uses `<Routes>` (Phase 2 pattern) — Phase 6 should migrate it to `createBrowserRouter` when rebuilding with the full layout.

---

## Code Examples

### Admin Auth Service (new — mirrors VendorAuthService)

```typescript
// Source: apps/api/src/modules/vendor-auth/VendorAuthService.ts (verified pattern)
// AdminAuthService follows the same argon2 + jose pattern

export class AdminAuthService {
  private readonly TTL_SECONDS = 28800; // 8h for admin sessions

  async login(email: string, password: string): Promise<{ accessToken: string; expiresIn: number }> {
    const rows = await db.select().from(adminUsers).where(eq(adminUsers.email, email)).limit(1);
    const admin = rows[0];
    if (!admin) throw new InvalidCredentialsError();
    const isValid = await argon2.verify(admin.passwordHash, password);
    if (!isValid) throw new InvalidCredentialsError();
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new SignJWT({ sub: admin.id, role: 'admin' as const, email: admin.email })
      .setProtectedHeader({ alg: 'HS256' })
      .setIssuedAt()
      .setExpirationTime(`${this.TTL_SECONDS}s`)
      .sign(secret);
    return { accessToken, expiresIn: this.TTL_SECONDS };
  }

  async verifyToken(token: string): Promise<AdminTokenPayload> {
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const { payload } = await jwtVerify(token, secret);
    if (payload['role'] !== 'admin') throw new Error('Token does not carry admin role.');
    return { sub: payload['sub'] as string, role: 'admin', email: payload['email'] as string };
  }
}
```

### Updated VendorAuthService.login (Phase 6 migration)

```typescript
// Source: apps/api/src/modules/vendor-auth/VendorAuthService.ts (verified — base to modify)
// After migration: authenticate against vendor_users table (D-03/D-06)

async login(email: string, password: string): Promise<VendorLoginResult> {
  const rows = await db.select().from(vendorUsers)
    .where(and(eq(vendorUsers.email, email), isNull(vendorUsers.archivedAt)))
    .limit(1);
  const vendorUser = rows[0];
  if (!vendorUser) throw new InvalidCredentialsError();
  // Check vendor is not suspended (D-17)
  const vendorRows = await db.select({ status: vendors.onboardingStatus })
    .from(vendors).where(eq(vendors.id, vendorUser.vendorId)).limit(1);
  if (vendorRows[0]?.status === 'suspended') throw new InvalidCredentialsError();
  const isValid = await argon2.verify(vendorUser.passwordHash, password);
  if (!isValid) throw new InvalidCredentialsError();
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  const accessToken = await new SignJWT({
    sub: vendorUser.id,           // NOTE: now vendor_users.id, not vendors.id
    role: vendorUser.role,        // owner | manager | staff (D-06)
    vendorId: vendorUser.vendorId, // FK to vendors.id (D-06)
    email: vendorUser.email,
  }).setProtectedHeader({ alg: 'HS256' }).setIssuedAt().setExpirationTime(`${this.TTL_SECONDS}s`).sign(secret);
  return { accessToken, expiresIn: this.TTL_SECONDS };
}
```

### FeatureFlagService.toggle (Phase 6 adds write path)

```typescript
// Source: apps/api/src/modules/feature-flags/FeatureFlagService.ts (verified — extend this class)
// Phase 6 adds toggle() to the existing read-only service

async toggleFlag(key: string, enabled: boolean): Promise<void> {
  await db.update(featureFlags)
    .set({ isEnabled: enabled, updatedAt: new Date() })
    .where(eq(featureFlags.key, key));
  await this.invalidateFlag(key);  // existing method
}
```

### Drizzle migration file pattern (vendor_users example)

```typescript
// Source: apps/api/src/db/schema/vendors.ts + vendor-commission-entries.ts (verified patterns)
// New schema file: apps/api/src/db/schema/vendor-users.ts

import { pgEnum, pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';
import { vendors } from './vendors.js';

export const vendorUserRoleEnum = pgEnum('vendor_user_role', ['owner', 'manager', 'staff']);

export const vendorUsers = pgTable('vendor_users', {
  id: uuid('id').defaultRandom().primaryKey(),
  vendorId: uuid('vendor_id').notNull().references(() => vendors.id),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  role: vendorUserRoleEnum('role').notNull(),
  invitedBy: uuid('invited_by'), // self-referential FK added after table creation
  acceptedAt: timestamp('accepted_at', { withTimezone: true }),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

### Migration SQL: copy vendor owners to vendor_users

```sql
-- Migration: copy existing vendor owner accounts to vendor_users
-- Run as part of the Phase 6 db:migrate step
INSERT INTO vendor_users (id, vendor_id, email, password_hash, role, created_at, updated_at)
SELECT gen_random_uuid(), id, email, password_hash, 'owner', created_at, NOW()
FROM vendors
WHERE email IS NOT NULL AND password_hash IS NOT NULL;
-- The email and password_hash columns on vendors are retained but no longer used for auth.
```

This migration runs as a SQL file within drizzle-kit or as a custom migration in the migration sequence.

### Vendor panel router.tsx skeleton

```typescript
// Source: apps/web-storefront/src/router.tsx (verified — adapt for vendor panel)
import { createBrowserRouter } from 'react-router-dom';
import { PanelLayout } from './components/layout/PanelLayout.js';
import { ProtectedVendorRoute } from './components/layout/ProtectedVendorRoute.js';

export const router = createBrowserRouter([
  {
    path: '/auth/login',
    element: <LoginPage />,
  },
  {
    path: '/accept-invite',
    element: <AcceptInvitePage />,
  },
  {
    path: '/',
    element: <ProtectedVendorRoute />,
    children: [{
      element: <PanelLayout />,
      children: [
        { index: true, element: <Navigate to="/dashboard" replace /> },
        { path: 'dashboard', element: <DashboardPage /> },
        { path: 'products', element: <ProductsPage /> },
        { path: 'inventory', element: <InventoryPage /> },
        { path: 'orders', element: <OrdersPage /> },
        { path: 'returns', element: <ReturnsPage /> },
        { path: 'earnings', element: <EarningsPage /> },
        { path: 'coupons', element: <CouponsPage /> },   // feature-flagged nav item
        { path: 'team', element: <TeamPage /> },          // owner-only
        { path: 'store-profile', element: <StoreProfilePage /> },
        { path: 'settings', element: <SettingsPage /> },
      ],
    }],
  },
]);
```

---

## Runtime State Inventory

> This section covers the vendor auth migration — a rename/migration of auth identity.

| Category | Items Found | Action Required |
|----------|-------------|------------------|
| Stored data | `vendors` table rows contain `email` + `password_hash` (Phase 3 created owner accounts). Migration must copy these to `vendor_users` as `role='owner'` rows. | Data migration: INSERT INTO vendor_users SELECT from vendors (SQL migration file in drizzle-kit migration sequence) |
| Live service config | `FeatureFlagService` Redis keys `ff:*` — `COUPONS_ENABLED` flag already seeded in Phase 5 (05-04). No action needed — these keys survive. | None |
| OS-registered state | None — no task scheduler, pm2, or systemd units in this project. | None — verified by codebase inspection |
| Secrets/env vars | `JWT_SECRET` — vendor JWTs issued with current secret. After migration, old vendor JWTs (with `sub=vendors.id`) become invalid when secret is rotated. Must communicate to deployer. New env vars needed: no additional secrets (AdminAuthService reuses `JWT_SECRET`). | Coordinate JWT_SECRET rotation with migration deploy (D-06). Document in `.env.example`. |
| Build artifacts | None specific to auth migration. `apps/web-admin/src/` compiled artifacts will be stale after App.tsx rewrite but `pnpm build` handles this. | Rebuild web-admin after Phase 6 changes |

**Nothing found in category:** OS-registered state — none found (confirmed by codebase inspection; no task scheduler config in repo).

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| React Router v6 `<BrowserRouter>` + `<Routes>` | React Router v7 `createBrowserRouter` | Phase 4/5 (storefront) | Both panels should use `createBrowserRouter` pattern; web-admin currently uses `<Routes>` (Phase 2 — must be migrated in Phase 6) |
| X-Internal-Admin-Token (Phase 2 placeholder) | httpOnly cookie JWT (Phase 4 D-09 pattern) | Phase 6 | Admin apiClient MUST be updated to `credentials: 'include'` in Phase 6 |
| Single vendor = single account (Phase 3) | vendor_users multi-member model (Phase 6) | Phase 6 | Breaking change to vendor JWT shape and VendorAuthService |
| `framer-motion` import (Phase 2 web-admin) | `motion/react` import (Phase 4+ storefront) | Phase 4 | Web-admin currently uses `framer-motion` import; check if Vite alias is configured to keep consistent |

**Deprecated/outdated in Phase 6:**
- `X-Internal-Admin-Token` header in `web-admin/apiClient.ts`: removed, replaced by cookie auth
- `vendors.email` and `vendors.passwordHash` as auth fields: dead code post-migration (cols retained but unused)
- Phase 2 admin panel `App.tsx` header-only layout: replaced by full `PanelLayout` with sidebar

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | A charting library (recharts or similar) is NOT currently installed in the workspace (found no charting packages in node_modules/.pnpm/) | Standard Stack | Low — if it IS installed, planner doesn't need to add it; if NOT, planner must add `recharts` or choose inline SVG charts for admin dashboard |
| A2 | Web-vendor's vite.config.ts needs the `motion/react → framer-motion` alias (same as storefront) to use `import { motion } from 'motion/react'` syntax | Architecture Patterns | Medium — if alias is absent, vendor panel pages importing `motion/react` will fail at build time |
| A3 | The `onboarding_status` pgEnum on vendors will be called `vendor_onboarding_status` to avoid naming conflicts with existing enums | Standard Stack | Low — planner should verify enum naming convention with existing pgEnums (all use `{domain}Enum` in TypeScript, `{snake_case}` in Postgres) |

**If this table is empty:** All claims in this research were verified or cited.

---

## Open Questions

1. **Charting library for admin dashboard (ADM-01)**
   - What we know: `recharts` is not in the pnpm store; D-10 requires a line chart and bar chart
   - What's unclear: Should Phase 6 add recharts, or use minimal inline SVG?
   - Recommendation: The planner should add a `checkpoint:human-verify` task before any charting package install. Inline SVG is viable for simple v1 charts given the small number of data points.

2. **web-vendor `vite.config.ts` — motion/react alias**
   - What we know: The storefront vite.config.ts has a `motion/react → framer-motion` alias (mentioned in STATE.md). web-vendor's App.tsx currently imports from `motion/react` (verified).
   - What's unclear: Whether the alias is already present in web-vendor's vite.config.ts
   - Recommendation: Planner must add a Wave 0 task to verify/add this alias before any vendor panel pages are written.

3. **JWT_SECRET rotation strategy during migration**
   - What we know: D-06 says refresh token rotation forces re-login. The simplest v1 approach is rotating JWT_SECRET.
   - What's unclear: Whether rotating JWT_SECRET also invalidates customer JWTs (it does), causing customer re-login
   - Recommendation: Accept the customer re-login side effect (customers stay logged in for max 1h anyway per CustomerAuthService TTL). Document in migration deploy notes.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | Backend runtime | ✓ | v24.16.0 | — |
| PostgreSQL (Neon) | All DB operations | ✓ | Connected (Phase 5 ran migrations) | — |
| Redis (Upstash) | SettingsService, FeatureFlagService cache | ✓ | Connected (Phase 5 operational) | — |
| argon2 | AdminAuthService, VendorAuthService | ✓ | 0.44.0 (native bindings compiled) | — |
| react-router-dom | web-admin + web-vendor routing | ✓ | 7.16.0 (workspace) | — |
| framer-motion | Panel animations | ✓ | 12.40.0 (workspace) | — |
| nodemailer | Staff invite emails | ✓ | 8.0.10 (workspace) | Dev fallback: log invite link to console |
| bullmq | ProductIndexJob trigger on price update | ✓ | 5.77.6 (workspace) | — |
| Charting library | Admin dashboard charts (ADM-01) | ✗ | — | Inline SVG (viable for simple charts) |

**Missing dependencies with no fallback:** None that block execution.

**Missing dependencies with fallback:** Charting library (recharts or similar) — inline SVG chart components are a viable fallback for the small number of v1 charts.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `apps/api/vitest.config.ts` (verified) |
| Quick run command | `pnpm --filter @grovio/api test --run` |
| Full suite command | `pnpm --filter @grovio/api test --run --reporter=verbose` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| VEN-05 | Vendor staff invite token generation and expiry | unit | `pnpm --filter @grovio/api test --run -- VendorStaffService` | ❌ Wave 0 |
| VEN-04 | Return approval triggers commission reversal (extends Phase 5 ReturnService) | unit | `pnpm --filter @grovio/api test --run -- ReturnService` | Partial (ReturnService tests may exist from Phase 5) |
| MKT-04/05 | Outstanding balance calculation (earned - reversed - settled = outstanding) | unit | `pnpm --filter @grovio/api test --run -- AnalyticsService` | ❌ Wave 0 |
| ADM-06 | Feature flag toggle invalidates Redis cache | unit | `pnpm --filter @grovio/api test --run -- FeatureFlagService` | Partial (read-path tests exist; write-path tests new) |
| ADM-05 | SettingsService Redis-first read + cache invalidation on update | unit | `pnpm --filter @grovio/api test --run -- SettingsService` | ❌ Wave 0 |
| D-03 | VendorAuthService migration — login against vendor_users (not vendors) | unit | `pnpm --filter @grovio/api test --run -- VendorAuthService` | Partial (update existing tests) |
| D-21 | AdminAuthService login + JWT role=admin | unit | `pnpm --filter @grovio/api test --run -- AdminAuthService` | ❌ Wave 0 |
| D-13 | AuditService inserts correct log row | unit | `pnpm --filter @grovio/api test --run -- AuditService` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grovio/api test --run`
- **Per wave merge:** `pnpm --filter @grovio/api test --run --reporter=verbose`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/admin-auth/AdminAuthService.test.ts` — covers D-21
- [ ] `apps/api/src/modules/settings/SettingsService.test.ts` — covers ADM-05
- [ ] `apps/api/src/modules/audit/AuditService.test.ts` — covers D-13
- [ ] `apps/api/src/modules/analytics/AnalyticsService.test.ts` — covers MKT-04/05 balance query
- [ ] `apps/api/src/modules/vendor-staff/VendorStaffService.test.ts` — covers VEN-05

---

## Security Domain

### Applicable ASVS Categories (ASVS Level 1)

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | Yes | argon2id (existing pattern) + jose HS256 JWT. AdminAuthService + updated VendorAuthService. No plaintext passwords stored. |
| V3 Session Management | Yes | httpOnly cookie pattern (Phase 4 D-09). Admin JWTs are httpOnly cookies. Vendor JWTs same. CORS `credentials: true` with specific origins only. |
| V4 Access Control | Yes | Role-based: `owner > manager > staff` enforced server-side on every vendor route. `admin` role enforced on admin routes. Frontend hides UI elements but is not the authority. |
| V5 Input Validation | Yes | Zod 4.x validates all request bodies on backend routes (existing pattern). CMS block payloads validated against MerchandisingBlockSchema. |
| V6 Cryptography | Yes | argon2id for password hashing (OWASP-recommended, existing). JWT HS256 (jose). Never hand-roll crypto. |

### Known Threat Patterns for Admin/Vendor Panels

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Privilege escalation via role claim forgery | Tampering | Role is extracted from JWT payload verified with `jose.jwtVerify()`, never from request body. JWT secret is server-side only. |
| IDOR — vendor accessing another vendor's data | Elevation of Privilege | All vendor queries scope by `request.vendorUser.vendorId` (from JWT). Backend never trusts `vendorId` from request body for data scoping. |
| Audit log bypass — admin taking action without log | Repudiation | Audit writes happen in service layer, not middleware. Every action that requires audit is implemented with an explicit `auditService.log()` call. |
| Commission rule deletion (global rule) | Tampering | `DELETE /admin/commission-rules/:id` returns 403 when `scope='global'`. UI has no delete button for global rule. |
| Mass payout settlement — admin records inflated settlement | Tampering | `vendor_payouts` is append-only; admin email is stored on each row; audit_log captures the action with before/after. No mechanism to modify existing settlement records. |
| Staff invite token replay | Elevation of Privilege | `vendor_staff_invites.invite_token` is UUID v4 (48h expiry, `accepted_at` set on accept). Second accept attempt finds `accepted_at` already set → reject. |
| Admin panel accessible without auth (Phase 2 was dev-only) | Authentication bypass | Phase 6 adds real admin JWT middleware. ALL admin routes gated by `requireAdminAuth`. The old `X-Internal-Admin-Token` bypass is removed. |

---

## Sources

### Primary (HIGH confidence — verified in codebase)
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — exact auth pattern to migrate and replicate for AdminAuthService
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — exact Redis-first cache pattern for SettingsService
- `apps/api/src/modules/commissions/CommissionService.ts` — Redis cache pattern + commission rate resolution
- `apps/api/src/modules/returns/ReturnService.ts` — existing `approveReturn()` implementation (already handles commission reversal)
- `apps/api/src/modules/homepage/HomepageService.ts` — invalidateBlocks() pattern
- `apps/api/src/db/schema/vendor-commission-entries.ts` — append-only ledger verified
- `apps/api/src/db/schema/return-requests.ts` — return status enum verified
- `apps/api/src/container.ts` — Awilix registration pattern for new services
- `apps/web-admin/src/App.tsx` — existing admin routing structure (must be extended not replaced)
- `apps/web-admin/src/lib/apiClient.ts` — existing API client (must be upgraded from token to cookie auth)
- `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` — ProtectedRoute pattern to replicate
- `apps/web-storefront/src/components/layout/AppLayout.tsx` — AnimatePresence layout pattern to adapt
- `apps/web-storefront/src/router.tsx` — createBrowserRouter pattern verified as the correct v7 pattern
- `apps/web-vendor/src/App.tsx` — confirmed: vendor panel is currently a placeholder shell only
- `apps/api/src/config/env.ts` — all existing env vars; Phase 6 adds none

### Secondary (MEDIUM confidence — from CONTEXT.md decisions + verified schema patterns)
- CONTEXT.md D-01 through D-21: locked decisions for all schema extensions and behavior
- `apps/api/src/db/schema/vendors.ts` — current vendors schema; Phase 6 extends it
- `apps/api/src/db/schema/coupons.ts` — current coupons schema; Phase 6 adds two columns
- CLAUDE.md §"Recommended Stack" — version matrix confirmed against pnpm store

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — all packages verified from pnpm store; no new packages required
- Architecture: HIGH — all patterns verified directly from Phase 3/4/5 implementations in codebase
- Migration path: HIGH — both current schema (vendors.ts) and target pattern (VendorAuthService.ts) verified
- Pitfalls: HIGH — derived from actual code reading, not training data assumptions
- Charting: LOW — recharts or alternative not confirmed installed; charting approach is in Claude's Discretion

**Research date:** 2026-06-04
**Valid until:** 2026-07-04 (stable library versions; Phase 5 codebase may continue evolving)
