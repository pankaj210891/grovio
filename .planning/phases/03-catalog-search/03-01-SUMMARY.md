---
phase: 03-catalog-search
plan: "01"
subsystem: contracts
tags: [contracts, zod, catalog, search, product, variant, image, attribute]
dependency_graph:
  requires: []
  provides:
    - "@grovio/contracts ProductSchema, ProductStatusSchema, CreateProductInputSchema, UpdateProductInputSchema, RejectProductInputSchema"
    - "@grovio/contracts ProductVariantSchema, CreateVariantInputSchema, UpdateVariantInputSchema"
    - "@grovio/contracts ProductImageSchema, PresignImageInputSchema, PresignImageResponseSchema, ConfirmImageUploadInputSchema, ReorderImagesInputSchema"
    - "@grovio/contracts SearchQuerySchema, SearchHitSchema, SearchResponseSchema, FacetSchema, FacetValueSchema"
    - "@grovio/contracts SuggestQuerySchema, SuggestResponseSchema, SuggestProductSchema, SuggestCategorySchema"
    - "@grovio/contracts FilterRequestSchema, FacetResultSchema, AppliedFilterSchema"
    - "@grovio/contracts AttributeDefinitionSchema.isVariant, UpdateAttributeInputSchema (extended)"
  affects:
    - "packages/contracts/src/category/attribute-definition.ts (isVariant added)"
    - "packages/contracts/src/index.ts (catalog + search domains wired)"
tech_stack:
  added: []
  patterns:
    - "Zod enum with exhaustive values (ProductStatusSchema — 4 values match Drizzle pgEnum)"
    - "z.number().int() for all price/money fields (T-03-V2 mitigation, D-01, D-04)"
    - "status field omitted from create/update inputs (T-03-V1 mitigation, D-06)"
    - "Two-step presign+confirm image upload contract (PresignImageInputSchema → PresignImageResponseSchema)"
    - "Cursor-based pagination in SearchResponseSchema (nextCursor pattern)"
    - "Grouped suggest response (products + categories in one response — D-16)"
    - "Bounded q input in SuggestQuerySchema (min 2 chars — T-03-V3, D-16)"
    - "isVariant mutually exclusive with isFilterable — comment-documented, service enforces (plan 03-04)"
key_files:
  created:
    - packages/contracts/src/catalog/product.ts
    - packages/contracts/src/catalog/variant.ts
    - packages/contracts/src/catalog/image.ts
    - packages/contracts/src/catalog/index.ts
    - packages/contracts/src/search/query.ts
    - packages/contracts/src/search/suggest.ts
    - packages/contracts/src/search/filter.ts
    - packages/contracts/src/search/index.ts
  modified:
    - packages/contracts/src/category/attribute-definition.ts
    - packages/contracts/src/index.ts
decisions:
  - "ProductStatusSchema values (draft/pending_review/approved/rejected) match the Drizzle productStatusEnum in plan 03-03 — single source of truth per D-05"
  - "UpdateAttributeInputSchema added as a new export (was missing from Phase 2 implementation) — non-breaking addition"
  - "isVariant documented as mutually exclusive with isFilterable at contract level; enforcement delegated to service layer (plan 03-04)"
metrics:
  duration: "~8 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_created: 8
  files_modified: 2
---

# Phase 3 Plan 01: Catalog and Search Zod Contracts Summary

**One-liner:** Zod contracts for product/variant/image catalog domain and search/suggest/filter search domain, with isVariant extension to attribute-definition and root barrel wiring.

## What Was Built

Three tasks executed atomically:

**Task 1 — Catalog contract subfolder** (`packages/contracts/src/catalog/`)
- `product.ts`: `ProductStatusSchema` (4-value enum matching future Drizzle pgEnum), `ProductSchema` (full product shape), `CreateProductInputSchema` (omits status/id/timestamps — D-06), `UpdateProductInputSchema` (all optional, no status — D-06), `RejectProductInputSchema` (requires rejectionReason — D-08). All price fields typed as `z.number().int()` (T-03-V2, D-01).
- `variant.ts`: `ProductVariantSchema`, `CreateVariantInputSchema`, `UpdateVariantInputSchema`. `priceMinor: z.number().int()` throughout (D-01, D-04).
- `image.ts`: `ProductImageSchema`, `PresignImageInputSchema`, `PresignImageResponseSchema` (uploadUrl/cdnUrl/key), `ConfirmImageUploadInputSchema`, `ReorderImagesInputSchema`. Two-step presign+confirm upload contract.
- `index.ts`: Barrel re-exporting product.js, variant.js, image.js with `.js` extensions.

**Task 2 — Search contract subfolder** (`packages/contracts/src/search/`)
- `query.ts`: `SearchQuerySchema` (cursor pagination, coerce limit 1-100 default 20), `SearchHitSchema`, `FacetValueSchema`, `FacetSchema`, `SearchResponseSchema` (hits + facets + nextCursor — Pattern 5).
- `suggest.ts`: `SuggestQuerySchema` (`q: z.string().min(2)` — D-16, T-03-V3), `SuggestProductSchema`, `SuggestCategorySchema`, `SuggestResponseSchema` (grouped products + categories — D-16).
- `filter.ts`: `AppliedFilterSchema`, `FilterRequestSchema`, `FacetResultValueSchema`, `FacetResultSchema` (key/label/displayType/values with counts).
- `index.ts`: Barrel re-exporting query.js, suggest.js, filter.js.

**Task 3 — Attribute-definition extension + root barrel**
- Added `isVariant: z.boolean()` to `AttributeDefinitionSchema` (D-02).
- Added `isVariant: z.boolean().optional()` to `CreateAttributeInputSchema` (D-02).
- Added `UpdateAttributeInputSchema` (all fields optional, includes isVariant) — this was missing from Phase 2; added as a non-breaking extension.
- Added comment documenting that `isVariant` is mutually exclusive with `isFilterable` at the contract layer; service-layer guard enforced in plan 03-04.
- Updated `packages/contracts/src/index.ts` to `export * from "./catalog/index.js"` and `export * from "./search/index.js"`.

## Verification

- `pnpm --filter @grovio/contracts typecheck` — exits 0 (all 3 tasks verified)
- `pnpm --filter @grovio/contracts build` — clean build, dist/index.js ~21KB (up from ~12KB)
- Runtime import verification: all 8 required schemas importable from `dist/index.js`
- `ProductStatusSchema.options` = `["draft","pending_review","approved","rejected"]`
- `SuggestQuerySchema.shape.q.minLength === 2` confirmed

## Deviations from Plan

### Auto-added Missing Functionality

**1. [Rule 2 - Missing] Added UpdateAttributeInputSchema**
- **Found during:** Task 3
- **Issue:** The plan specified adding `isVariant` to `UpdateAttributeInputSchema` but the Phase 2 implementation of `attribute-definition.ts` never created this schema — only `CreateAttributeInputSchema` existed.
- **Fix:** Created `UpdateAttributeInputSchema` with all fields optional (including `isVariant`). This is a non-breaking addition since no consumers of the schema existed yet.
- **Files modified:** `packages/contracts/src/category/attribute-definition.ts`
- **Commit:** 012bf22

No other deviations — plan executed as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes at trust boundaries introduced in this plan. These are pure Zod contract definitions with no runtime behavior.

T-03-V1 (status field omitted from vendor-facing input schemas) — mitigated in `CreateProductInputSchema` and `UpdateProductInputSchema`.
T-03-V2 (price fields typed as `z.number().int()`) — mitigated in `ProductSchema.basePriceMinor`, `UpdateProductInputSchema.basePriceMinor`, `ProductVariantSchema.priceMinor`, and all variant input schemas.
T-03-V3 (SuggestQuerySchema.q bounded, min 2 chars) — mitigated in `SuggestQuerySchema`.

## Self-Check

### Created files exist:
- packages/contracts/src/catalog/product.ts — FOUND
- packages/contracts/src/catalog/variant.ts — FOUND
- packages/contracts/src/catalog/image.ts — FOUND
- packages/contracts/src/catalog/index.ts — FOUND
- packages/contracts/src/search/query.ts — FOUND
- packages/contracts/src/search/suggest.ts — FOUND
- packages/contracts/src/search/filter.ts — FOUND
- packages/contracts/src/search/index.ts — FOUND

### Commits exist:
- 031b9e5: feat(03-01): add catalog Zod contracts (product, variant, image) — FOUND
- d341a9e: feat(03-01): add search Zod contracts (query, suggest, filter) — FOUND
- 012bf22: feat(03-01): extend attribute-definition with isVariant flag + wire root barrel — FOUND

## Self-Check: PASSED
