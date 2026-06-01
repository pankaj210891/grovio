---
phase: 03-catalog-search
plan: "03"
subsystem: db-schema
tags: [drizzle, schema, catalog, vendors, products, variants, images, env, s3]
dependency_graph:
  requires:
    - "03-01 (ProductStatusSchema values — 4 values match Drizzle productStatusEnum)"
    - "02-02 (categories, attribute_definitions tables as FK targets)"
  provides:
    - "apps/api/src/db/schema/vendors.ts — vendors table with email unique + password_hash"
    - "apps/api/src/db/schema/products.ts — products table + productStatusEnum + GIN index on attributes"
    - "apps/api/src/db/schema/product-variants.ts — product_variants table with BIGINT price_minor + option_values JSONB"
    - "apps/api/src/db/schema/product-images.ts — product_images table with cascade delete + alt_text"
    - "apps/api/src/db/schema/attribute-definitions.ts — is_variant boolean column added (D-02)"
    - "apps/api/src/db/schema/index.ts — catalog domain exports in FK-dependency order"
    - "apps/api/src/config/env.ts — S3/image/filter-cache env vars with defaults"
  affects:
    - "apps/api/src/db/schema/attribute-definitions.ts (is_variant column added)"
    - "apps/api/src/db/schema/index.ts (catalog exports added)"
    - "apps/api/src/config/env.ts (S3 + image constraint + filter cache TTL vars added)"
    - "apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts (isVariant field added to fixture)"
tech_stack:
  added: []
  patterns:
    - "BIGINT minor units for all money columns (base_price_minor, price_minor) — no FLOAT/DECIMAL/NUMERIC (T-03-S2, D-01, D-04)"
    - "pgEnum productStatusEnum with 4 values matching ProductStatusSchema from 03-01 contracts (T-03-S1, D-05)"
    - "GIN index on products.attributes JSONB via index().using('gin', ...) in table extras callback (PROD-03)"
    - "FK cascade delete chain: vendors → products → product_variants / product_images (D-12)"
    - "Soft-delete via archivedAt nullable timestamp (vendors, products — matching categories.ts pattern)"
    - "is_variant boolean flag on attribute_definitions (D-02, mutually exclusive with is_filterable — service enforces)"
    - "S3 env vars optional with defaults — backend boots without them (D-10, D-11)"
    - "z.coerce.number().default() pattern for MAX_IMAGES_PER_PRODUCT, MAX_IMAGE_SIZE_BYTES, FILTER_SCHEMA_TTL_SECONDS"
key_files:
  created:
    - apps/api/src/db/schema/vendors.ts
    - apps/api/src/db/schema/products.ts
    - apps/api/src/db/schema/product-variants.ts
    - apps/api/src/db/schema/product-images.ts
  modified:
    - apps/api/src/db/schema/attribute-definitions.ts
    - apps/api/src/db/schema/index.ts
    - apps/api/src/config/env.ts
    - apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts
decisions:
  - "productStatusEnum values (draft/pending_review/approved/rejected) match ProductStatusSchema from plan 03-01 — single source of truth per D-05"
  - "GIN index uses named index('products_attributes_gin_idx').using('gin', t.attributes) — makes index identifiable in migration and query plans"
  - "products_slug_idx: separate index name for slug uniqueness even though .unique() already creates one — improves query plan visibility"
  - "product_images has no updatedAt — images are create-then-delete, never updated in place (D-12)"
  - "is_variant mutual exclusivity with is_filterable documented in schema comment; DB constraint deferred to service layer (plan 03-04)"
  - "FILTER_SCHEMA_TTL_SECONDS added alongside S3 vars as cohesive Phase 3 env group"
metrics:
  duration: "~7 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_created: 4
  files_modified: 4
---

# Phase 3 Plan 03: Drizzle DB Schema Summary

**One-liner:** Drizzle schema tables for vendors, products (productStatusEnum + GIN index), product_variants, product_images, is_variant extension to attribute_definitions, schema barrel, and S3/image/filter-cache env vars.

## What Was Built

Three tasks executed atomically:

**Task 1 — vendors and products schema**
- `vendors.ts`: uuid PK, email (text UNIQUE), password_hash (text notNull), name, archivedAt (soft-delete), timestamps. Exports InsertVendor / SelectVendor.
- `products.ts`: `productStatusEnum = pgEnum("product_status", ["draft","pending_review","approved","rejected"])` (matches ProductStatusSchema from 03-01 — T-03-S1, D-05). Products table: vendorId FK (cascade), categoryId FK (cascade), slug (unique), basePriceMinor (`bigint("base_price_minor", { mode: "number" })` — BIGINT per T-03-S2/D-01), attributes (jsonb.$type\<Record\<string,unknown\>\>() with GIN index via `index().using("gin", t.attributes)`), rejectionReason (nullable — D-08), archivedAt (soft-delete), timestamps. Exports productStatusEnum, InsertProduct, SelectProduct.

**Task 2 — product_variants, product_images, is_variant extension**
- `product-variants.ts`: uuid PK, productId FK → products.id (cascade), sku (text), priceMinor (`bigint("price_minor", { mode: "number" })` — D-04), optionValues (jsonb.$type\<Record\<string,unknown\>\>() default {}), sortOrder, timestamps. Exports InsertProductVariant / SelectProductVariant.
- `product-images.ts`: uuid PK, productId FK → products.id (cascade — D-12), url (text), sortOrder, altText (nullable), createdAt only (no updatedAt). Exports InsertProductImage / SelectProductImage.
- `attribute-definitions.ts`: added `isVariant: boolean("is_variant").notNull().default(false)` after isSearchable column (D-02). Documented mutual exclusivity with isFilterable — service guard in plan 03-04.

**Task 3 — schema barrel + env schema**
- `schema/index.ts`: added catalog domain block after category domain, in FK-dependency order: vendors.js → products.js → product-variants.js → product-images.js. Updated file header comment to mention Plan 03-03.
- `config/env.ts`: added S3_BUCKET_URL (url optional), S3_ACCESS_KEY_ID (optional), S3_SECRET_ACCESS_KEY (optional), S3_REGION (default "auto"), S3_BUCKET_NAME (optional), S3_PUBLIC_URL (url optional), MAX_IMAGES_PER_PRODUCT (coerce number default 8 — D-11), MAX_IMAGE_SIZE_BYTES (coerce number default 5242880 — D-11), FILTER_SCHEMA_TTL_SECONDS (coerce number default 300).

## Verification

- `pnpm --filter @grovio/api typecheck` — exits 0 (all 3 tasks verified)
- Barrel check: `node -e` confirms vendors.js, products.js, product-variants.js, product-images.js all present in schema/index.ts
- `products.ts` contains `productStatusEnum` with exactly 4 values matching contracts
- `products.ts` contains `bigint("base_price_minor"` — no NUMERIC/DECIMAL/REAL
- `products.ts` contains GIN index using "gin" on attributes column
- `product-variants.ts` contains `bigint("price_minor"` and option_values JSONB
- `attribute-definitions.ts` contains `is_variant` boolean with default false
- `env.ts` contains all 9 new env vars with correct defaults

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Updated AttributeDefinitionService.test.ts fixture to include isVariant**
- **Found during:** Task 2 (adding is_variant column to attribute_definitions caused typecheck failure)
- **Issue:** The existing `AttributeDefinitionService.test.ts` mock fixture `baseAttr` had type `SelectAttributeDefinition`. After adding `isVariant` as a non-nullable required field, the fixture was missing the new field, causing `TS2741: Property 'isVariant' is missing`.
- **Fix:** Added `isVariant: false` to the `baseAttr` fixture. This is a non-semantic change — the test behavior is unchanged; only the fixture type is now complete.
- **Files modified:** `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts`
- **Commit:** 1c599bd

No other deviations — plan executed as written.

## Threat Surface Scan

No new network endpoints or auth paths introduced. These are pure schema definitions.

Threat register mitigations applied per plan:
- T-03-S1 (Tampering — products.status): `productStatusEnum` pgEnum constrains status to 4 values at the DB level. Invalid status values are rejected even if service-layer validation is bypassed.
- T-03-S2 (Tampering — money columns): `base_price_minor` and `price_minor` both use `bigint()` — integer-only storage, no float rounding drift.
- T-03-S3 (Tampering — JSONB attributes): GIN index added; `dynamic: false` mapping guard applied in OpenSearch (downstream in plan 03-04/03-05).
- T-03-S4 (Repudiation): createdAt/updatedAt timestamps on all tables.

## Known Stubs

None. This plan creates schema definitions only — no service logic, no API routes, no UI. No stub patterns present.

## Self-Check

### Created files exist:
- apps/api/src/db/schema/vendors.ts — FOUND
- apps/api/src/db/schema/products.ts — FOUND
- apps/api/src/db/schema/product-variants.ts — FOUND
- apps/api/src/db/schema/product-images.ts — FOUND

### Modified files have expected content:
- attribute-definitions.ts contains is_variant — FOUND
- schema/index.ts exports vendors.js, products.js, product-variants.js, product-images.js — FOUND (barrel-ok)
- env.ts contains S3_BUCKET_URL, MAX_IMAGES_PER_PRODUCT (8), MAX_IMAGE_SIZE_BYTES (5242880), FILTER_SCHEMA_TTL_SECONDS — FOUND

### Commits exist:
- 83f785f: feat(03-03): add vendors and products Drizzle schema tables — FOUND
- 1c599bd: feat(03-03): add product_variants, product_images schema + is_variant to attribute_definitions — FOUND
- f96241e: feat(03-03): wire catalog schema barrel + extend env with S3/image/filter-cache vars — FOUND

## Self-Check: PASSED
