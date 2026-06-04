# Phase 6: Vendor & Admin Tools - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver two fully operational web panels: a complete vendor panel (`apps/web-vendor`) for store onboarding, product/inventory/pricing management, order handling, return approvals, earnings tracking, team management, and optional promotions; and a complete admin panel (`apps/web-admin`) for vendor management, commission configuration, payout settlement, CMS/homepage block management, catalog moderation, feature flag control, branding/settings, and audit log access. Supporting backend modules for vendor profiles, vendor staff roles, payout records, admin analytics, audit logging, and marketplace settings are all created in this phase.

**Also in scope (backend additions):**
- `vendor_users` table + migration from Phase 3 minimal vendor auth model
- `vendor_staff_invites` flow (email invite → accept → new vendor_user row)
- `vendor_payout_info` table (banking details for manual settlement)
- `vendor_payouts` table (manual settlement records — append-only)
- `marketplace_settings` table (key-value store for branding, email, general settings)
- `audit_log` table (action-level event log)
- All new admin CRUD endpoints (commission rules, payout, CMS, settings, feature flags, vendors, audit)
- All new vendor API endpoints (dashboard analytics, inventory CRUD, return management, earnings, team, store profile, coupons)

**Specifically NOT in scope:**
- Automated vendor payouts via Stripe Connect / Razorpay Route (v2 — PAY2-01)
- Tiered or fixed-fee commission structures (v2 — flat % only from Phase 5 D-14)
- File upload / image hosting infrastructure (URL input only in v1)
- React Native vendor/admin panels (not in roadmap — web panels only)
- Customer-facing order tracking pages (Phase 8 — FUL-01 through FUL-04)
- Full push notification delivery (Phase 8 — NOT-01/NOT-02)

</domain>

<decisions>
## Implementation Decisions

### Vendor Schema Extension

- **D-01:** Phase 6 extends the `vendors` table with public store profile fields: `store_name TEXT` (public display name, separate from `name` used in auth), `store_description TEXT`, `logo_url TEXT`, `banner_url TEXT`, `contact_email TEXT`, `contact_phone TEXT`, `address TEXT`, and `onboarding_status TEXT` (pgEnum: `pending` | `approved` | `suspended`). This replaces the implicit "active if not archived" model. `archived_at` is kept for soft-delete; `onboarding_status` drives the approval workflow (ADM-02, VEN-01). The `name` column from Phase 3 becomes the owner's display name; `store_name` is the public-facing store name.

- **D-02:** Sensitive payout banking data is stored in a separate `vendor_payout_info` table: `id`, `vendor_id FK` (unique — one per vendor), `account_holder_name TEXT`, `bank_account_number TEXT`, `ifsc_or_routing_code TEXT`, `bank_name TEXT`, `updated_at`. Isolated to prevent accidental exposure in vendor profile API responses.

### Vendor Auth Migration (Staff Support)

- **D-03:** Phase 3 embedded email + password_hash directly on the `vendors` table (one vendor = one user). Phase 6 introduces a `vendor_users` table to support multi-member vendor teams (VEN-05): `id UUID`, `vendor_id FK → vendors.id`, `email TEXT UNIQUE`, `password_hash TEXT`, `role TEXT` pgEnum (`owner` | `manager` | `staff`), `invited_by UUID FK → vendor_users.id nullable`, `accepted_at TIMESTAMP nullable`, `archived_at TIMESTAMP`, `created_at`, `updated_at`. A **migration** copies existing Phase 3 vendor owner accounts (email + password_hash) from the `vendors` table to `vendor_users` as `role='owner'` rows. VendorAuthService is updated to authenticate against `vendor_users` instead of `vendors`. The `email` and `password_hash` columns on `vendors` are retained but no longer used for auth (safe to remove in a future cleanup).

- **D-04:** Staff invite flow: vendor owner calls `POST /vendor/team/invite` with `{ email, role }` → backend creates a `vendor_staff_invites` row: `id`, `vendor_id FK`, `email TEXT`, `role TEXT`, `invite_token TEXT UNIQUE` (UUID), `invited_by FK → vendor_users.id`, `expires_at TIMESTAMP` (48h), `accepted_at`. Backend sends an invite email (via mailer module) with a link to `/vendor/accept-invite?token=XXX`. Invitee hits the link → creates their vendor_user account (sets password) → `vendor_staff_invites.accepted_at` set → `vendor_users` row created with the specified role.

### Vendor Staff Permission Scopes

- **D-05:** Three roles with explicit scope boundaries:
  - `owner`: full access to all vendor panel sections; can invite/remove team members; can configure store profile and payout info
  - `manager`: products (create/edit/archive), inventory management, pricing updates, orders (view/update status), returns (approve/reject), coupon management — no team management, no payout info, no store profile settings
  - `staff`: inventory levels (view/edit quantity_available only), orders (view + mark as shipped/delivered only) — no product CRUD, no return approvals, no financial data

  Permission enforcement is backend-side: each vendor API endpoint checks `request.vendorUser.role` from the JWT. Frontend hides UI elements for lower-privileged roles but does not rely on this for security.

- **D-06:** Vendor JWT payload extended to include `role` from `vendor_users.role`. VendorAuthService issues JWTs with `{ sub: vendorUserId, vendorId, role, email }`. Existing Phase 3 vendor JWTs (issued before migration) are invalidated — refresh token rotation forces re-login after the migration deploy.

### Admin Payout Settlement (MKT-04, MKT-05)

- **D-07:** New `vendor_payouts` table (append-only, like commission entries): `id UUID`, `vendor_id FK`, `amount_minor BIGINT`, `settlement_reference TEXT` (e.g., bank transfer ID), `note TEXT nullable`, `settled_by_admin_email TEXT`, `settled_at TIMESTAMP`, `created_at`. Admin selects "Record Settlement" from the vendor payout page, enters amount + reference, confirms → backend inserts a row. No updates to existing rows.

- **D-08:** Admin payout page per vendor shows:
  - **Summary strip:** Total earned (sum of `earned` commission entries), Total reversed (sum of `reversed` entries), Net commission, Total settled (sum of `vendor_payouts.amount_minor`), Outstanding balance (Net − Settled)
  - **Commission ledger table:** each `vendor_commission_entries` row — date, order display ID, status (earned/reversed), rate %, subtotal, commission amount
  - **Settlements table:** each `vendor_payouts` row — date, amount, reference, note, recorded by
  - Vendor payout info (bank details) shown as read-only reference panel alongside

- **D-09:** Vendor MKT-05 earnings page mirrors the admin payout view but omits settlement entry form and other vendors' data. Vendor sees: Net earnings, Outstanding balance (to be paid by admin), commission entries for their own sub-orders, and the list of settlements received.

### Admin Dashboard KPIs (ADM-01)

- **D-10:** Admin dashboard shows metrics for selectable periods: 7d / 30d / 90d toggle (default 30d). Metrics: Total GMV, Total Orders, Active Vendors, New Customers, Commission Earned, Pending Payouts (outstanding balance sum across all vendors). All computed on-demand server-side via `GET /admin/analytics/summary?period=30d` — no materialized views in v1. Dashboard also shows: Orders by day line chart (last N days), Top 5 vendors by GMV table, GMV by category bar chart. Manual refresh only — no polling/websocket.

### CMS Block Management UI (ADM-04)

- **D-11:** Structured form approach (not WYSIWYG). Admin sees an ordered list of homepage blocks. Each block shows: type badge, preview title, active toggle, Edit and Delete buttons, and Up/Down reorder arrows (no drag-and-drop in v1). Block type-specific edit modal with tailored form fields:
  - `banner`: title, subtitle, image URL, CTA label, CTA link
  - `product_grid`: title, source (manual product IDs or auto-fill by category), limit
  - `text_block`: title, body text (plain text input — no rich text editor in v1)
  - `featured_categories`: title, category multi-select
  - Image fields: URL input only — no file upload infrastructure in v1
- HomepageService Redis cache is invalidated on any block mutation (existing invalidation hook from Phase 4 D-04 pattern).

### Feature Flag Management (ADM-06)

- **D-12:** Simple toggle list. Admin sees all rows from the `feature_flags` table: flag key, description, current enabled state, last updated. Toggling calls `PATCH /admin/feature-flags/:key { enabled: boolean }`. FeatureFlagService invalidates the Redis cache on update (existing pattern). No complex conditions or rollout percentages in v1 — pure on/off.

### Admin Audit Log (ADM-07)

- **D-13:** New `audit_log` table: `id UUID`, `actor_type TEXT` (admin/vendor/system), `actor_id TEXT`, `actor_email TEXT`, `action TEXT` (dot-namespaced, e.g., `product.approved`, `vendor.suspended`, `commission_rule.updated`, `payout.settled`, `feature_flag.toggled`, `homepage_block.created`, `return_request.approved`), `entity_type TEXT`, `entity_id TEXT`, `before JSONB nullable`, `after JSONB nullable`, `ip_address TEXT`, `created_at TIMESTAMP`. Events are written by service-layer methods — not middleware — so only meaningful semantic actions are logged. Admin audit log page: filterable table (by actor, action type, entity type, date range).

### Vendor Coupon Management (VEN-06)

- **D-14:** Phase 5 `coupons` table gains two new columns: `created_by_type TEXT` (admin/vendor) and `created_by_id TEXT`. Vendor-created coupons are automatically scoped to their own store (`scope = 'vendor'`, vendor_id = creating vendor). Vendors cannot create category-scoped coupons (admin-only). Vendor coupon UI: list of own coupons + create form (code, discount type: flat/percent, discount value, minimum order amount, expiry date, max redemptions). Feature-gated: the vendor Coupons nav item is hidden when `COUPONS_ENABLED` feature flag is off.

### Vendor Inventory + Pricing (VEN-03)

- **D-15:** Single combined Inventory & Pricing table view: one row per product/variant showing product name, variant (if any), `quantity_available`, `quantity_reserved` (read-only), `base_price_minor` (editable). Inline edit via click-to-edit cells or a row-level edit modal. Quantity and price updates saved via `PATCH /vendor/inventory/:inventoryItemId` and `PATCH /vendor/products/:productId/pricing` (or per-variant endpoint). Price updates trigger an OpenSearch reindex job (`ProductIndexJob` — same BullMQ pattern from Phase 3). No bulk CSV import in v1.

### Return Approval Flow (VEN-04)

- **D-16:** Vendor returns page: list of `return_requests` for their sub-orders, filtered by status. Per-request actions: Approve (with optional note) or Reject (with rejection reason text, required). On approve: `ReturnService.approveReturn()` transitions status → `approved`, triggers `WalletService.credit()` or `PaymentService.refund()` based on `return_requests.refundPreference` (customer's choice from Phase 5 D-16), and emits commission reversal (MKT-03 via CommissionService). On reject: status → `rejected`, rejection reason stored. Both actions are logged to `audit_log`.

### Admin Vendor Management (ADM-02)

- **D-17:** Admin vendor list: paginated table of all vendors — name, email, `onboarding_status` badge, join date, GMV (last 30d), product count, category restriction count. Actions per row: Approve pending (sets `onboarding_status = 'approved'`; logged to audit_log), Suspend active (sets `onboarding_status = 'suspended'`; vendor_users cannot log in when vendor is suspended — auth check), Reinstate suspended, Configure (opens a side panel for category restrictions and commission override). No hard-delete — `archived_at` soft-delete for admin-initiated removal.

### Commission Engine Config UI (ADM-03)

- **D-18:** Three-section UI:
  1. **Global rate** — always exactly one row; inline edit of `rate_percent`; cannot be deleted
  2. **Category overrides** — table of category → rate %; Admin can Add Override (modal with category select + rate input), Edit, Delete
  3. **Vendor overrides** — table of vendor → rate %; same Add/Edit/Delete controls
  Endpoints: `GET /admin/commission-rules`, `POST /admin/commission-rules`, `PATCH /admin/commission-rules/:id`, `DELETE /admin/commission-rules/:id` (guarded: global rule cannot be deleted). All mutations logged to `audit_log`.

### Marketplace Settings (ADM-05)

- **D-19:** New `marketplace_settings` table: `key TEXT PRIMARY KEY`, `value JSONB`, `updated_at TIMESTAMP`. Settings are grouped into admin UI sections:
  - **General:** `store_name`, `default_currency` (e.g., "INR"), `timezone`, `default_return_window_days`
  - **Branding:** `primary_color` (hex), `logo_url`, `favicon_url`
  - **Email:** `smtp_sender_name`, `smtp_sender_email`
  - **Integration visibility:** Stripe publishable key (display only — show masked, no edit for secret keys), Razorpay key ID (same)
  A `SettingsService` wraps DB reads with Redis caching (same TTL/invalidation pattern as FeatureFlagService). Admin saves settings → DB updated → Redis cache invalidated.

### Panel Navigation Structure

- **D-20:** Both panels use a persistent left sidebar layout (collapses to icon bar on tablet, hamburger-revealed on mobile), top header bar with breadcrumbs + user avatar + logout, and a main content area.

  **Vendor panel sidebar nav:** Dashboard, Products, Inventory & Pricing, Orders, Returns, Earnings & Payouts, Coupons (hidden when `COUPONS_ENABLED` is off), Team, Store Profile, Settings

  **Admin panel sidebar nav:** Dashboard, Vendors, Catalog Moderation, Commission Rules, Payout Management, CMS / Homepage, Feature Flags, Settings & Branding, Audit Log (the existing Categories pages from Phase 2 remain under a `Catalog` or `Categories` section)

  Both panels extend the existing React Router v6 routing. Vendor panel: all protected routes require valid `vendor_users` JWT; permission-restricted routes check role. Admin panel: existing phase 2 category routes remain; Phase 6 adds all new admin routes. `ProtectedRoute` wrapper component checks JWT validity and role.

- **D-21:** Admin panel auth: admin accounts are managed separately from vendor/customer accounts. Phase 4 `VendorAuthService` JWT includes `role=vendor`; admin JWTs use `role=admin`. A minimal `AdminAuthService` and `admin_users` table (id, email, password_hash, created_at) handles admin login at `POST /admin/auth/login`. Admin panel login page added at `apps/web-admin/src/pages/auth/LoginPage.tsx`. Currently there is no admin user table — this is created in Phase 6.

### Claude's Discretion

- Exact Framer Motion animations for sidebar collapse/expand, page transitions between admin sections
- Drizzle schema column ordering and index choices beyond what's specified (follow Phase 5 patterns)
- Error state and empty state designs for all tables (no data, loading, error)
- Admin analytics query optimization (single SQL query vs multiple; views vs CTEs)
- Exact admin email template for vendor staff invites (follows nodemailer pattern from mailer module)
- Pagination strategy for audit log and vendor list (cursor-based vs offset; offset is fine for v1)
- Return window eligibility check details (Phase 5 D-22 created `vendor_return_policies` table; Phase 6 vendor UI for configuring it)
- React Query cache invalidation strategy for vendor dashboard metrics
- Order of sidebar items beyond what's specified above

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §"Multi-Vendor: Commissions & Payouts" — MKT-04, MKT-05 (2 requirements for Phase 6)
- `.planning/REQUIREMENTS.md` §"Vendor Panel (Web)" — VEN-01 through VEN-06 (6 requirements)
- `.planning/REQUIREMENTS.md` §"Admin Panel (Web)" — ADM-01 through ADM-07 (7 requirements)
- `.planning/ROADMAP.md` §"Phase 6: Vendor & Admin Tools" — goal, 5 success criteria, dependency on Phase 5

### Phase 5 Contracts (Phase 6 builds on these — CRITICAL)
- `.planning/phases/05-commerce-core/05-CONTEXT.md` — D-12 (commission entries, no automated payouts), D-14 (flat % commission rate chain), D-16 (refund preference — vendor triggers in Phase 6), D-22 (vendor_return_policies table — Phase 6 adds vendor UI), D-23 (return request flow — vendor approve/reject in Phase 6)
- `apps/api/src/db/schema/vendor-commission-entries.ts` — append-only commission ledger; Phase 6 admin payout management reads this
- `apps/api/src/db/schema/vendor-orders.ts` — vendor sub-orders; vendor panel order management reads these
- `apps/api/src/db/schema/return-requests.ts` — return_requests table + returnStatusEnum; Phase 6 vendor approve/reject transitions these
- `apps/api/src/db/schema/commission-rules.ts` — commission_rules schema; ADM-03 UI manages rows in this table
- `apps/api/src/modules/commissions/CommissionService.ts` — commission computation logic; Phase 6 adds commission reversal trigger on return approval

### Phase 3 Contracts (vendor schema root)
- `apps/api/src/db/schema/vendors.ts` — Phase 3 minimal vendor schema; Phase 6 extends with profile columns + onboarding_status + adds vendor_users migration
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — current vendor auth against vendors table; Phase 6 migrates to vendor_users table; planner must understand current auth pattern before migrating
- `apps/api/src/db/schema/coupons.ts` — Phase 5 coupons schema; Phase 6 adds created_by_type + created_by_id columns

### Phase 4 Contracts (admin panel foundation)
- `apps/web-admin/src/App.tsx` — existing React Router v6 routing in admin panel; Phase 6 adds all new routes alongside existing category routes
- `apps/api/src/db/schema/homepage-blocks.ts` — Phase 4 created this table with seed data; Phase 6 adds admin write endpoints; HomepageService Redis cache must be invalidated on mutations

### Architecture & Money Constraints (CRITICAL)
- `.planning/research/ARCHITECTURE.md` — backend-authoritative money, append-only ledger pattern, commission split architecture
- `.planning/research/PITFALLS.md` §"Pitfall 1" — BIGINT minor units for all money columns (vendor_payouts.amount_minor MUST be BIGINT)
- `packages/contracts/src/money/allocate.ts` — commission reversal proration (MKT-03) uses allocate() — already established in Phase 5

### Existing Patterns to Follow
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis cache + DB fallback pattern; SettingsService follows the same pattern for marketplace_settings
- `apps/api/src/modules/orders/OrderService.ts` — order management service; vendor order status updates extend this
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — argon2 + jose JWT pattern; AdminAuthService and updated VendorAuthService (vendor_users) follow the same
- `apps/api/src/modules/jobs/` — BullMQ job pattern; ProductIndexJob triggered by pricing updates (VEN-03)
- `apps/api/src/container.ts` — Awilix DI; all new services register here

### Technology Stack
- `CLAUDE.md` §"Recommended Stack" — React 19.2.x, Vite 8, Tailwind CSS 4.3.x, Motion 12.x (`motion/react` import), TanStack Query 5.x, Zustand 5.x, Drizzle ORM 0.45.x, jose 6.x, Fastify 5.x, nodemailer 8.x (staff invite emails)
- `CLAUDE.md` §"What NOT to Use" — no FLOAT/DECIMAL for money (vendor_payouts.amount_minor = BIGINT), no jsonwebtoken (use jose)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web-admin/src/App.tsx`: React Router v6 already set up with sidebar-style layout pattern. Phase 6 adds all new admin routes alongside the existing `/categories` routes.
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts`: argon2 + jose pattern to replicate for AdminAuthService and updated VendorAuthService (post-migration to vendor_users).
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts`: Redis cache + DB fallback pattern; SettingsService for marketplace_settings follows this exactly.
- `apps/api/src/modules/commissions/CommissionService.ts`: commission computation logic Phase 6 extends with reversal trigger via `CommissionService.reverseCommission(returnRequestId)`.
- `packages/contracts/src/money/allocate.ts`: already implemented and used by Phase 5; commission reversals in Phase 6 use the same call.
- `apps/api/src/modules/mailer/`: existing nodemailer module; vendor staff invite emails use the same mailer pattern.

### Established Patterns
- **Append-only ledgers**: `wallet_entries` and `vendor_commission_entries` are both append-only. `vendor_payouts` follows the same pattern — no UPDATE ever, only INSERT.
- **BIGINT minor units**: all money columns use `_minor BIGINT` naming (e.g., `amount_minor`, `vendor_subtotal_minor`). `vendor_payouts.amount_minor` must follow this.
- **pgEnum for status types**: `onboarding_status` on vendors, `role` on vendor_users — both use pgEnum consistent with Phase 3/5 patterns.
- **Soft-delete via `archived_at`**: vendor_users follows `archived_at` instead of hard delete.
- **httpOnly cookie auth**: Phase 4 D-09 pattern applies to admin panel login too. `credentials: 'include'` on fetch, `Access-Control-Allow-Credentials: true` on API.
- **Route plugins**: all new admin/vendor API routes mount as Fastify plugins. Admin routes under `/admin/*` (admin JWT required). Vendor routes under `/vendor/*` (vendor JWT + role check).
- **BullMQ jobs**: `ProductIndexJob` in `apps/api/src/modules/jobs/` — triggered by vendor price updates (VEN-03 D-15).

### Integration Points
- Phase 5 left `return_requests` with `status='return_requested'` for vendor action. Phase 6 closes the loop: vendor panel `ReturnService.approveReturn()` / `ReturnService.rejectReturn()` transition the state and trigger commission reversal + refund.
- Phase 4 built `GET /homepage` read endpoint and seeded `homepage_blocks`. Phase 6 adds `POST/PATCH/DELETE /admin/homepage-blocks` write endpoints and reorder endpoint. HomepageService Redis cache must be invalidated after each write.
- Phase 5 commission entries (`vendor_commission_entries`) were created by `CommissionService` at order finalization. Phase 6 admin payout page queries these with `SUM(commission_amount_minor) WHERE status='earned'` - `SUM WHERE status='reversed'` = net.
- Phase 3 vendor login issued JWTs against `vendors.email`. After Phase 6 migration to `vendor_users`, the JWT sub changes from `vendors.id` to `vendor_users.id`. All existing vendor API routes that extract `request.vendor.id` must be updated to use `request.vendorUser.vendorId`.

</code_context>

<specifics>
## Specific Ideas

- `vendor_payouts` outstanding balance query: `SUM(earned entries) - SUM(reversed entries) - SUM(vendor_payouts.amount_minor)` for a given `vendor_id`. This is the canonical "amount owed to vendor." Display as a highlighted card on both the admin payout page and the vendor earnings page.
- Admin vendor list should show `onboarding_status` as a colored badge: pending = amber, approved = green, suspended = red/orange, archived = gray. Matches the product approval status badge pattern from Phase 3.
- Commission rule UI: the Global rate row should be visually distinguished (e.g., a pinned top row with "Default" label) and the delete button should be absent or disabled. Category and vendor overrides are standard deletable rows.
- `audit_log` action namespace convention: `{entity}.{verb}` — e.g., `vendor.approved`, `vendor.suspended`, `product.approved`, `product.rejected`, `commission_rule.created`, `commission_rule.updated`, `commission_rule.deleted`, `payout.settled`, `feature_flag.toggled`, `homepage_block.created`, `homepage_block.updated`, `homepage_block.deleted`, `return_request.approved`, `return_request.rejected`.
- Vendor dashboard "Low stock alerts" section: products where `inventory_items.quantity_available ≤ 5` (configurable via marketplace_settings `low_stock_threshold`, default 5). Shows product name, current quantity, a link to Inventory & Pricing page.
- Staff invite email: sent via existing mailer module, template: "You've been invited to join [Store Name] on Grovio as a [role]. Click here to set up your account: [link]." Link points to `apps/web-vendor/accept-invite?token=XXX`.
- `marketplace_settings` key naming convention: snake_case string keys (e.g., `store_name`, `primary_color`, `default_return_window_days`). SettingsService exposes typed getters that parse `value JSONB` to the correct TypeScript type. Follows the same key-convention as `feature_flags.key`.

</specifics>

<deferred>
## Deferred Ideas

- **Automated vendor payouts via Stripe Connect / Razorpay Route** — v2 (PAY2-01). Phase 6 records manual settlements only.
- **Tiered commission rates** (GMV-based tiers, e.g., lower % at higher volume) — v2. Flat % with priority chain is sufficient for v1.
- **File upload for images** (logo, banner, block images) — URL-input only in v1; file upload infrastructure (S3 or equivalent) is a Phase 9/v2 concern.
- **Rich text editor for CMS text blocks** — plain text input in v1. WYSIWYG (e.g., TipTap) can be added in v1.x without schema changes.
- **Bulk CSV inventory import** — v1.x. Inline edit covers the v1 use case.
- **Vendor analytics beyond dashboard summary** — e.g., cohort analysis, product-level revenue breakdown. Deferred to v2.
- **Admin analytics beyond summary KPIs** — real-time dashboards, revenue forecasting, export. v2.
- **Per-customer coupon use limit** — v1.x extension (total usage cap + expiry covers v1 per Phase 5 D-18).
- **Vendor return policy UI** — Phase 5 D-22 created `vendor_return_policies` table. Phase 6 vendor Settings page includes a "Return Policy" section to configure this table. This IS in scope (completing the Phase 5 setup) — noted here as a reminder to planner to not miss it.

None of the above items add scope to Phase 6. The vendor return policy UI (last bullet) is explicitly in scope and is mentioned here as a planning reminder only.

</deferred>

---

*Phase: 6-Vendor & Admin Tools*
*Context gathered: 2026-06-04*
