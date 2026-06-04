# Phase 6: Vendor & Admin Tools - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 06-vendor-admin-tools
**Mode:** Auto (user: "Go ahead with best and recommended options — decide logically")
**Areas discussed:** Vendor schema extension, Vendor auth migration, Staff roles, Payout settlement, Admin dashboard KPIs, CMS block management, Feature flag UI, Audit log, Coupon management, Inventory & pricing, Return approval flow, Vendor management, Commission UI, Marketplace settings, Panel navigation

---

## Vendor Schema Extension

| Option | Description | Selected |
|--------|-------------|----------|
| Extend vendors table with profile columns | Add store_name, description, logo_url, banner_url, contact info, onboarding_status to vendors table | ✓ |
| Separate vendor_profiles table | Keep vendors table minimal, join to profile table | |

**Choice (auto):** Extend vendors table with profile columns + separate vendor_payout_info table for banking details.
**Notes:** Minimal vendors table is already public-facing; extending it is simpler than a join. Banking data isolated in vendor_payout_info for security. onboarding_status pgEnum drives the ADM-02 approval workflow.

---

## Vendor Auth Migration (Staff Support)

| Option | Description | Selected |
|--------|-------------|----------|
| vendor_users table (migrate existing) | New table for all vendor user accounts; migrate Phase 3 owner accounts via migration script | ✓ |
| vendor_staff junction (keep vendors as primary) | Keep vendors.email/password_hash for owner; add a staff table for additional members only | |

**Choice (auto):** vendor_users table with migration. Cleaner long-term model; prevents dual-path authentication logic.
**Notes:** Existing Phase 3 JWTs invalidated post-migration (forced re-login). VendorAuthService updated to auth against vendor_users. Staff invite flow via vendor_staff_invites table.

---

## Vendor Staff Roles

| Option | Description | Selected |
|--------|-------------|----------|
| Three roles (owner/manager/staff) | Fine-grained with clear scope boundaries enforced backend-side | ✓ |
| Two roles (owner/member) | Simpler but less useful for real vendor teams | |
| Custom permission bitfield | Maximum flexibility but high complexity | |

**Choice (auto):** Three roles — owner, manager, staff — with explicit permission scopes documented in D-05.

---

## Admin Payout Settlement

| Option | Description | Selected |
|--------|-------------|----------|
| Append-only vendor_payouts table | Admin records settlements; outstanding balance computed dynamically | ✓ |
| Payout status column on commission entries | Mark entries as "paid" per commission row | |

**Choice (auto):** Separate vendor_payouts table (append-only), consistent with wallet_entries and vendor_commission_entries append-only patterns. Outstanding = net commission − sum of settlements.

---

## Admin Dashboard KPIs

| Option | Description | Selected |
|--------|-------------|----------|
| On-demand server-side computation | All metrics computed per request from existing tables; no separate analytics DB | ✓ |
| Pre-computed/materialized views | Faster reads but adds migration complexity | |
| Third-party analytics service | Maximum power but external dependency not in stack | |

**Choice (auto):** On-demand server-side, 7d/30d/90d period toggle, manual refresh only. Simple, correct for v1 scale.

---

## CMS Block Management UI

| Option | Description | Selected |
|--------|-------------|----------|
| Structured forms + up/down reorder | Per-block-type form modal; up/down arrows for order; URL input for images | ✓ |
| WYSIWYG drag-and-drop editor | More intuitive but significantly more complex to build | |

**Choice (auto):** Structured forms with up/down arrow reorder. Matches admin panel's utility-first design; no drag-and-drop library dependency needed.

---

## Feature Flag Management

| Option | Description | Selected |
|--------|-------------|----------|
| Simple toggle list | Table of all feature_flags rows with on/off toggle per row | ✓ |
| Segmented rollout UI | Percentage rollout, user cohorts — complex but powerful | |

**Choice (auto):** Simple toggle list. Feature flags are pure boolean in v1 per Phase 1 architecture.

---

## Admin Audit Log

| Option | Description | Selected |
|--------|-------------|----------|
| audit_log table with action/entity schema | Semantic dot-namespaced actions, before/after JSONB, actor tracking | ✓ |
| Append to existing event tables | Distributed audit trail per entity — harder to query centrally | |

**Choice (auto):** Centralized audit_log table with action/entity/actor/before/after schema. Single query for the audit log page; full searchability.

---

## Vendor Coupon Management

| Option | Description | Selected |
|--------|-------------|----------|
| Extend coupons table with created_by columns | Add created_by_type + created_by_id; vendor-scoped coupons only | ✓ |
| Separate vendor_coupons table | Duplicate schema but cleaner separation | |

**Choice (auto):** Extend coupons table with created_by columns. Avoids duplication; vendor scope constraint enforced at service layer.

---

## Claude's Discretion

- Framer Motion animation specifics for sidebar collapse, page transitions
- Drizzle schema column ordering and index strategies beyond what's specified
- Empty/loading/error state component designs
- Admin analytics SQL query optimization (CTEs vs views vs multiple queries)
- Staff invite email template wording and layout
- Pagination strategy for audit log (offset OK for v1)
- Exact React Query cache invalidation timing for vendor dashboard

## Deferred Ideas

- Automated vendor payouts (Stripe Connect / Razorpay Route) — v2 PAY2-01
- Tiered commission rates — v2
- File upload infrastructure for images — v2 / Phase 9
- Rich text editor for CMS text blocks — v1.x
- Bulk CSV inventory import — v1.x
- Advanced vendor/admin analytics — v2
- Per-customer coupon use limit — v1.x
