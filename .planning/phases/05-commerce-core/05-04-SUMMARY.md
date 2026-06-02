---
phase: 05-commerce-core
plan: "04"
subsystem: database
tags: [migration, drizzle, seed, feature-flags, commission-rules, neon]
dependency_graph:
  requires: ["05-03"]
  provides: ["05-05", "05-06", "05-07", "05-08", "05-09", "05-10", "05-11", "05-12"]
  affects: ["all-phase-5-plans"]
tech_stack:
  added: []
  patterns:
    - "drizzle-kit generate + migrate for Phase 5 schema"
    - "seed-commerce.ts: idempotent inserts via onConflictDoNothing / existence check"
    - "Drizzle .for('update') confirmed working in drizzle-orm 1.0.0-rc.3"
    - "onConflictDoNothing({ target: [col1, col2] }) confirmed working in drizzle-orm 1.0.0-rc.3"
key_files:
  created:
    - apps/api/src/db/migrations/20260602194354_strange_whistler/migration.sql
    - apps/api/src/db/migrations/20260602194354_strange_whistler/snapshot.json
    - apps/api/src/db/migrations/20260602200000_add_feature_flags/migration.sql
    - apps/api/src/db/migrations/20260602200000_add_feature_flags/snapshot.json
    - apps/api/src/db/seed-commerce.ts
    - apps/api/src/db/probe-drizzle-features.ts
  modified:
    - apps/api/package.json
decisions:
  - "drizzle-orm 1.0.0-rc.3: .for('update') SUPPORTED natively — no raw SQL fallback needed (A2 resolved)"
  - "drizzle-orm 1.0.0-rc.3: onConflictDoNothing({ target }) SUPPORTED — webhook idempotency pattern confirmed"
  - "Global commission default rate: 10.00% (MKT-01 fallback, D-14)"
  - "COUPONS_ENABLED flag: defaults to false — admin enables in Phase 6 (T-05-FF)"
metrics:
  duration: "~25 minutes"
  completed: "2026-06-03"
  tasks: 2
  files: 7
---

# Phase 5 Plan 04: Migration + Seed Summary

**One-liner:** Applied Phase 5 Drizzle migration (13 new tables + wallet_balance_minor ALTER) to Neon, confirmed `.for('update')` and `onConflictDoNothing({ target })` work in drizzle-orm 1.0.0-rc.3, and seeded COUPONS_ENABLED feature flag + global 10% commission rule.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Generate + apply Phase 5 migration + probe Drizzle features | d562c4a | migration.sql, snapshot.json, probe-drizzle-features.ts, package.json |
| 2 | Seed COUPONS_ENABLED flag and global commission rate | 7966648 | seed-commerce.ts, fix migration (feature_flags) |

## Migration Details

### Generated Migration: `20260602194354_strange_whistler`

The migration creates all 13 Phase 5 commerce tables:

| Table | Purpose |
|-------|---------|
| `basket_sessions` | Guest + authenticated basket containers (D-01, CHK-01) |
| `basket_items` | Line items in a basket session (CHK-01) |
| `inventory_items` | Stock tracking at variant/product level (D-20, D-21, CHK-05) |
| `inventory_reservations` | Pending stock holds with 15-min TTL (D-06, D-07, CHK-05) |
| `orders` | Customer-facing order records (ORD-01, D-08) |
| `vendor_orders` | Per-vendor sub-orders (ORD-02, D-08) |
| `order_items` | Line items in a vendor sub-order (ORD-01) |
| `wallet_entries` | Append-only wallet ledger (WAL-02, WAL-03, WAL-04) |
| `payment_events` | Webhook idempotency table (PAY-03, D-10, T-05-02) |
| `commission_rules` | Rate priority chain (MKT-01, D-14) |
| `vendor_commission_entries` | Per-sub-order commission records (MKT-01, D-12) |
| `coupons` | Coupon definitions, feature-flagged (CHK-06, D-17, D-18) |
| `return_requests` | Customer return request records (ORD-04, D-23) |
| `vendor_return_policies` | Per-vendor return window + conditions (D-22) |

Also:
- **5 pgEnums** added: `order_status`, `wallet_entry_type`, `payment_provider`, `commission_status`, `return_status`
- **ALTER TABLE** `customers` ADD COLUMN `wallet_balance_minor BIGINT DEFAULT 0 NOT NULL` (WAL-01)
- **UNIQUE constraint** `payment_events_provider_event_uniq` on `(provider, provider_event_id)` (PAY-03, T-05-02)

All money columns: `BIGINT` (no FLOAT/DECIMAL). Rate columns: `NUMERIC(5,2)` only for `commission_rules.rate_percent`.

### Fix Migration: `20260602200000_add_feature_flags`

The `feature_flags` table was defined in the Drizzle schema (`feature-flags.ts`) and included in all drizzle-kit snapshots, but was never present in any applied migration's SQL. The drizzle-kit snapshot treated it as already-existing, so `db:generate` never generated a CREATE TABLE for it.

**Root cause:** A prior drizzle-kit snapshot was manually edited or `db:generate` was run without actually applying the SQL, leaving the snapshot and the live DB out of sync.

**Fix:** Added a separate fix migration that creates the table with `CREATE TABLE IF NOT EXISTS`, applied successfully.

## Drizzle Query Feature Probe Results

Both features confirmed working in `drizzle-orm 1.0.0-rc.3`:

| Feature | Status | Notes |
|---------|--------|-------|
| `.for('update')` | **SUPPORTED** | Works in `db.transaction()` as `tx.select().from(table).where(...).for('update')`. No raw SQL fallback needed. |
| `onConflictDoNothing({ target: [col1, col2] })` | **SUPPORTED** | Correctly returns empty array on duplicate (provider, providerEventId) — idempotency confirmed. |

**Implication for Plan 05-05 (InventoryService):** Use `.for('update')` directly in Drizzle transactions. No raw SQL `db.execute(sql\`SELECT ... FOR UPDATE\`)` fallback is needed.

## Seed Results

### COUPONS_ENABLED Feature Flag (CHK-06, T-05-FF)
- **Inserted:** `key='COUPONS_ENABLED'`, `value='false'`, `is_enabled=false`
- **Idempotent:** `onConflictDoNothing()` on the unique `key` column — re-running skips silently
- **Effect:** CouponService short-circuits immediately when this flag is off. No customer-facing coupon path is active until Phase 6 admin enables it.

### Global Commission Rule (MKT-01, D-14)
- **Inserted:** `scope='global'`, `vendor_id=null`, `category_id=null`, `rate_percent='10.00'`
- **Idempotent:** Existence check (`SELECT WHERE scope='global' AND vendor_id IS NULL AND category_id IS NULL`) before insert — re-running skips if row found
- **Effect:** Fallback rate for CommissionService when no vendor- or category-scoped rule exists (priority chain: vendor > category > global, D-14)

## Verification

- `pnpm --filter @grovio/api db:migrate` — exits 0 (both migrations applied)
- `pnpm --filter @grovio/api db:seed:commerce` — exits 0 on first run (inserts rows)
- `pnpm --filter @grovio/api db:seed:commerce` — exits 0 on second run (skips existing rows)
- `pnpm --filter @grovio/api db:probe` — exits 0, both features PASS

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] feature_flags table missing from live database**
- **Found during:** Task 2 (seed script run)
- **Issue:** `DrizzleQueryError: relation "feature_flags" does not exist` — the table was in the Drizzle snapshot but never in any migration SQL, leaving the DB out of sync
- **Fix:** Created `20260602200000_add_feature_flags/migration.sql` with `CREATE TABLE IF NOT EXISTS` and applied via `db:migrate`
- **Files modified:** `apps/api/src/db/migrations/20260602200000_add_feature_flags/`
- **Commit:** 7966648

## Known Stubs

None — this plan creates/applies SQL migrations and a seed script with no UI or stub data.

## Threat Flags

No new security-relevant surface introduced in this plan. The `payment_events_provider_event_uniq` constraint (T-05-02) and the COUPONS_ENABLED flag seeded as disabled (T-05-FF) are both as designed in the threat model.

## Pre-existing Issues (Out of Scope)

Two pre-existing test failures unrelated to this plan:
- `src/modules/category-metadata/CategoryMetadataService.test.ts` — `@grovio/contracts` package resolution error
- `src/modules/homepage/HomepageService.test.ts` — same `@grovio/contracts` package resolution error

158 tests pass. The failures pre-date Plan 05-04 and are unrelated to migration/seed work. Logged to deferred items.

## Self-Check: PASSED

- [x] `apps/api/src/db/migrations/20260602194354_strange_whistler/migration.sql` — EXISTS
- [x] `apps/api/src/db/migrations/20260602200000_add_feature_flags/migration.sql` — EXISTS
- [x] `apps/api/src/db/seed-commerce.ts` — EXISTS
- [x] `apps/api/src/db/probe-drizzle-features.ts` — EXISTS
- [x] Commit d562c4a — EXISTS (feat(05-04): generate and apply Phase 5 Drizzle migration)
- [x] Commit 7966648 — EXISTS (feat(05-04): seed COUPONS_ENABLED flag and global commission rate)
- [x] Migration applied to Neon — CONFIRMED (db:migrate exits 0)
- [x] COUPONS_ENABLED flag in database — CONFIRMED (seed output shows inserted id)
- [x] Global commission rule in database — CONFIRMED (seed output shows inserted id)
- [x] `.for('update')` — CONFIRMED SUPPORTED (probe exits 0)
- [x] `onConflictDoNothing({ target })` — CONFIRMED SUPPORTED (probe exits 0)
