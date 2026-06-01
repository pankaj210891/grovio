---
phase: 04-customer-storefront-web
plan: "02"
subsystem: database, api
tags: [drizzle-orm, postgresql, migrations, zod, env, customers, password-reset, addresses, homepage-blocks]

# Dependency graph
requires:
  - phase: 04-customer-storefront-web
    plan: "01"
    provides: "@fastify/cors, @fastify/cookie, nodemailer installed; FeaturedCategoriesBlockSchema in contracts"
provides:
  - customers table in Neon DB (email, passwordHash, phone, archivedAt)
  - password_reset_tokens table with SHA-256 tokenHash, expiresAt, FK cascade to customers
  - customer_addresses table with structured cols, lat/lng/placeId, isDefault, FK cascade to customers
  - homepage_blocks table with type/payload(jsonb)/sortOrder/isActive
  - Phase 4 env vars validated: STOREFRONT_ORIGIN, SMTP_*, HOMEPAGE_BLOCKS_TTL_SECONDS
affects:
  - 04-03 (CustomerAuthService reads/writes customers + password_reset_tokens)
  - 04-04 (app.ts uses STOREFRONT_ORIGIN for CORS; @fastify/cookie reads access_token cookie)
  - 04-05 (CustomerAddressService reads/writes customer_addresses)
  - 04-06 (HomepageService reads homepage_blocks, uses HOMEPAGE_BLOCKS_TTL_SECONDS)
  - 04-07 (SMTP vars consumed by nodemailer transport in CustomerAuthService)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Drizzle pgTable uuid PK + withTimezone timestamps + $inferInsert/$inferSelect (Pattern F)
    - FK dependency ordering in schema barrel (customers exported before FK dependents)
    - tokenHash stores SHA-256 of raw token, never raw token (T-04-02 mitigation)
    - Zod optional() for graceful-degradation infra vars (SMTP_*); default() for safe dev values
    - db:generate RangeError is a non-fatal drizzle-kit 1.0.0-rc.4 internal warning; output is correct

key-files:
  created:
    - apps/api/src/db/schema/customers.ts
    - apps/api/src/db/schema/password-reset-tokens.ts
    - apps/api/src/db/schema/customer-addresses.ts
    - apps/api/src/db/schema/homepage-blocks.ts
    - apps/api/src/db/migrations/20260601132218_open_randall/migration.sql
    - apps/api/src/db/migrations/20260601132218_open_randall/snapshot.json
  modified:
    - apps/api/src/db/schema/index.ts
    - apps/api/src/config/env.ts

key-decisions:
  - "STOREFRONT_ORIGIN uses z.string().url() not z.string() — prevents accidental wildcard and ensures CORS is always a valid URL (T-04-04)"
  - "SMTP vars are all optional() — API boots without email configured; CustomerAuthService logs reset link to console in dev (Wave 3)"
  - "No pgEnum for homepage_blocks.type — Zod validates at application layer, new block types require no DB migration"
  - "tokenHash uses .unique() at DB level — prevents hash collision from two concurrent resets producing identical hashes"
  - "RangeError from drizzle-kit collectLeaves is a known non-fatal internal issue in 1.0.0-rc.4; migration SQL output is correct and was verified before applying"

patterns-established:
  - "Pattern: customers schema — exact vendors.ts column set + phone col; same uuid/timestamp/archivedAt/inferType convention"
  - "Pattern: FK-safe barrel order — customers exported in index.ts before password-reset-tokens and customer-addresses"
  - "Pattern: SHA-256 token storage — password_reset_tokens.token_hash stores hash only; raw token sent in email never stored"

requirements-completed: [AUTH-01, AUTH-03, AUTH-05, STORE-01]

# Metrics
duration: 12min
completed: "2026-06-01"
---

# Phase 4 Plan 02: Schema Tables + Env Extension + DB Migration Summary

**Four Drizzle schema tables (customers, password_reset_tokens, customer_addresses, homepage_blocks) created, Phase 4 env vars validated, and migration applied to Neon DB**

## Performance

- **Duration:** ~12 min
- **Started:** 2026-06-01T13:20:00Z
- **Completed:** 2026-06-01T13:32:00Z
- **Tasks:** 3
- **Files modified:** 8

## Accomplishments
- Four schema files created following vendors.ts/products.ts conventions exactly; barrel re-exports in FK-safe dependency order
- Six Phase 4 env vars added to envSchema with correct optional/default behavior: STOREFRONT_ORIGIN (url default), SMTP_* (all optional), HOMEPAGE_BLOCKS_TTL_SECONDS (coerce.number default 300)
- Migration generated (20260601132218_open_randall) and applied to Neon; all four tables created with FK constraints from password_reset_tokens.customer_id and customer_addresses.customer_id to customers.id (CASCADE)

## Task Commits

Each task was committed atomically:

1. **Task 1: Create four Phase 4 schema files + barrel exports** — `530ebbd` (feat)
2. **Task 2: Extend env schema with Phase 4 vars** — `8bb8bbb` (feat)
3. **Task 3: db:generate + db:migrate** — `6ce7de9` (chore)

**Plan metadata:** (see final docs commit)

## Files Created/Modified
- `apps/api/src/db/schema/customers.ts` — customers table; email/passwordHash/name/phone/archivedAt; InsertCustomer/SelectCustomer types
- `apps/api/src/db/schema/password-reset-tokens.ts` — password_reset_tokens table; tokenHash (SHA-256, unique), expiresAt, FK cascade to customers; InsertPasswordResetToken/SelectPasswordResetToken types
- `apps/api/src/db/schema/customer-addresses.ts` — customer_addresses table; structured address cols + doublePrecision lat/lng/placeId/isDefault + FK cascade to customers; InsertCustomerAddress/SelectCustomerAddress types
- `apps/api/src/db/schema/homepage-blocks.ts` — homepage_blocks table; type/payload(jsonb)/sortOrder/isActive; InsertHomepageBlock/SelectHomepageBlock types
- `apps/api/src/db/schema/index.ts` — barrel: customers exported before FK dependents; homepage-blocks added; header comment updated
- `apps/api/src/config/env.ts` — six new Phase 4 env vars: STOREFRONT_ORIGIN, SMTP_HOST, SMTP_USER, SMTP_PASS, SMTP_FROM, HOMEPAGE_BLOCKS_TTL_SECONDS
- `apps/api/src/db/migrations/20260601132218_open_randall/migration.sql` — SQL with CREATE TABLE for all four tables and two FK constraints
- `apps/api/src/db/migrations/20260601132218_open_randall/snapshot.json` — drizzle-kit schema snapshot

## Decisions Made
- `STOREFRONT_ORIGIN` uses `z.string().url()` to prevent accidental wildcard `*` values, enforcing T-04-04 mitigation at schema parse time
- All SMTP vars are `.optional()` so the API boots without email configured; CustomerAuthService will log reset links to console in dev (Wave 3 fallback)
- No `pgEnum` for `homepage_blocks.type` — Zod validates at the application layer; new block types can be added by extending the discriminated union without a DB migration
- `tokenHash` has `.unique()` at DB level in addition to the application-layer uniqueness, preventing race conditions from two concurrent reset requests

## Deviations from Plan

None — plan executed exactly as written.

Pre-existing typecheck error (`product-index-job.test.ts(178,3): error TS2304: Cannot find name 'beforeEach'`) was already present before this plan's changes; confirmed pre-existing per 04-01-SUMMARY.md. All new schema files introduce zero TypeScript errors.

The `RangeError: Invalid array length` printed by `drizzle-kit generate` / `db:migrate` is a known non-fatal internal issue in `drizzle-kit@1.0.0-rc.4-ca0f029` (`PostgresCommutativity.collectLeaves`). Migration SQL output is correct and was verified before applying; `db:migrate` exits 0 with "migrations applied successfully".

## Issues Encountered
- drizzle-kit 1.0.0-rc.4 prints a non-fatal `RangeError` from `PostgresCommutativity.collectLeaves` on projects with many tables. Does not affect migration correctness. Logged to deferred-items (out of scope — pre-existing to this plan, affects all prior migrations).

## User Setup Required
None — schema changes and migration are internal. New SMTP and STOREFRONT_ORIGIN vars have safe defaults for dev. Buyers who want email on password reset will configure SMTP_* in `.env` before production deployment.

## Next Phase Readiness
- All four Phase 4 tables exist in Neon DB — Wave 3 service tests (CustomerAuthService, CustomerAddressService, HomepageService) can query and insert into real tables
- `STOREFRONT_ORIGIN` env var is validated — `@fastify/cors` registration in Plan 04-04 can reference `env.STOREFRONT_ORIGIN` directly
- `HOMEPAGE_BLOCKS_TTL_SECONDS` env var is validated — `HomepageService.getBlocks()` in Plan 04-06 can reference `env.HOMEPAGE_BLOCKS_TTL_SECONDS` for Redis TTL
- SMTP vars are typed as optional strings in `Env` — `CustomerAuthService` mailer setup in Plan 04-03 can check for presence gracefully

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
