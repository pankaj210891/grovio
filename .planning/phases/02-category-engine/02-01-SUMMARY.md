---
phase: 02-category-engine
plan: 01
subsystem: contracts
tags: [zod, typescript, category, discriminated-union, contracts, types]

# Dependency graph
requires: []
provides:
  - MerchandisingBlockSchema discriminated union (banner/product_grid/text_block) per D-14
  - CategoryTreeNodeSchema with recursive z.lazy() and nav-only fields per D-04
  - AttrTypeSchema z.enum with exactly 6 values per D-05/D-06
  - AttributeDefinitionSchema and CreateAttributeInputSchema per CAT-03
  - DisplayTypeSchema (checkbox/radio/range_slider/toggle) and FilterSchemaDefSchema per CAT-04
  - TemplateFieldSchema and ProductTemplateSchema (key-referenced, not id) per CAT-05
  - VendorCategoryRestrictionSchema (id/categoryId/vendorId/createdAt/createdByAdminId) per D-10, CAT-06
  - CategoryMetadataSchema with flat SEO columns + blocks array per D-12/D-13, CAT-07
  - blocks.test.ts Vitest assertions for block validation
  - "@grovio/contracts" re-exports all category types from root barrel
affects: [02-02-database-schema, 02-03-category-service, 02-04-routes, 02-05-category-metadata-service, 02-06-filter-schema-service, 02-07-web-admin, 02-08-vendor-restrictions, phase-03-catalog, phase-04-storefront]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Zod discriminated union for typed block model (z.discriminatedUnion)"
    - "Recursive Zod schema with z.lazy() and explicit TypeScript type declaration"
    - "z.enum for exhaustive attr type constraint (exactly 6 values)"
    - "AttributeDefinitionSchema.pick() for inline attribute embed in FilterSchemaDefSchema"
    - "Category domain subfolder pattern under packages/contracts/src/category/"

key-files:
  created:
    - packages/contracts/src/category/blocks.ts
    - packages/contracts/src/category/blocks.test.ts
    - packages/contracts/src/category/tree.ts
    - packages/contracts/src/category/attribute-definition.ts
    - packages/contracts/src/category/filter-schema.ts
    - packages/contracts/src/category/product-template.ts
    - packages/contracts/src/category/vendor-restriction.ts
    - packages/contracts/src/category/metadata.ts
    - packages/contracts/src/category/index.ts
  modified:
    - packages/contracts/src/index.ts

key-decisions:
  - "TemplateField references attribute_definition.key (text) not id — survives attribute delete+recreate, avoids FK complexity on JSONB column (Open Question 2 resolution)"
  - "CategoryTreeNode uses TypeScript type declaration before Zod schema to resolve recursive z.lazy() circular reference"
  - "MerchandisingBlockSchema uses z.discriminatedUnion('type', [...]) — provides exhaustive type narrowing and runtime validation simultaneously (D-14)"
  - "AttrTypeSchema z.enum is exactly 6 values — forbids free-form type strings upstream (T-02-02 mitigation)"

patterns-established:
  - "Pattern: z.discriminatedUnion('type', [...]) for typed block model — import from @grovio/contracts"
  - "Pattern: z.lazy() + explicit TypeScript type declaration for recursive Zod schemas"
  - "Pattern: Schema.pick({ key: true, ... }) for embedding a subset of fields in a related schema"
  - "Pattern: Category domain barrel re-exported from root @grovio/contracts"

requirements-completed: [CAT-03, CAT-04, CAT-05, CAT-06, CAT-07]

# Metrics
duration: 35min
completed: 2026-05-30
---

# Phase 02 Plan 01: Category Contracts Summary

**Zod contract types for 7 category sub-domains (blocks, tree, attributes, filters, templates, vendor-restrictions, metadata) exported from @grovio/contracts with discriminated union block model and exhaustive 6-value attr_type enum**

## Performance

- **Duration:** ~35 min
- **Started:** 2026-05-30T00:00:00Z
- **Completed:** 2026-05-30T00:35:00Z
- **Tasks:** 3
- **Files modified:** 10 (9 created, 1 modified)

## Accomplishments

- Created `packages/contracts/src/category/` domain subfolder — single source of truth for all Phase 2 TypeScript types
- `MerchandisingBlockSchema` discriminated union validates 3 valid block types and rejects unknown/malformed per D-14 (T-02-01 mitigated)
- `AttrTypeSchema` z.enum locked to exactly 6 values — prevents free-form type strings upstream per D-06 (T-02-02 mitigated)
- `CategoryTreeNodeSchema` uses z.lazy() for recursive children with nav-only fields per D-04
- All 7 category schemas + barrel wired to root `@grovio/contracts` export; package builds and typechecks cleanly

## Task Commits

Each task was committed atomically:

1. **Task 1: Create block + tree + attribute-definition contracts** - `404ee7b` (feat)
2. **Task 2: Create filter-schema + product-template + vendor-restriction + metadata contracts** - `5ce1196` (feat)
3. **Task 3: Wire category barrel and root export** - `8a99db3` (feat)

## Files Created/Modified

- `packages/contracts/src/category/blocks.ts` - MerchandisingBlockSchema discriminated union (BannerBlock, ProductGridBlock, TextBlock) per D-14
- `packages/contracts/src/category/blocks.test.ts` - 5 Vitest assertions: 3 accept valid types, 2 reject invalid/malformed
- `packages/contracts/src/category/tree.ts` - CategoryTreeNodeSchema (z.lazy recursive), CategoryTreeResponseSchema, nav-only fields per D-04
- `packages/contracts/src/category/attribute-definition.ts` - AttrTypeSchema (6 values), AttributeDefinitionSchema, CreateAttributeInputSchema per D-05/D-06
- `packages/contracts/src/category/filter-schema.ts` - DisplayTypeSchema, FilterSchemaDefSchema (with .pick()), UpsertFilterSchemaInputSchema per CAT-04
- `packages/contracts/src/category/product-template.ts` - TemplateFieldSchema (key-referenced), ProductTemplateSchema, UpsertTemplateInputSchema per CAT-05
- `packages/contracts/src/category/vendor-restriction.ts` - VendorCategoryRestrictionSchema (5 fields: id, categoryId, vendorId, createdAt, createdByAdminId) per D-10
- `packages/contracts/src/category/metadata.ts` - CategoryMetadataSchema (flat SEO columns + blocks array), UpsertMetadataInputSchema per D-12/D-13
- `packages/contracts/src/category/index.ts` - Category domain barrel re-exporting all 7 files
- `packages/contracts/src/index.ts` - Appended `export * from "./category/index.js"` after marketplace-config

## Decisions Made

- **TemplateField uses `key` not `id`:** Open Question 2 from RESEARCH.md — `key` (text) survives attribute delete+recreate, avoids FK complexity on JSONB column. Human-readable for admin inspection.
- **Explicit TypeScript type before Zod schema for recursive:** TypeScript requires the type to be declared before `z.lazy()` references it in `CategoryTreeNodeSchema`. Pattern established for any future recursive schema.
- **Blocks as discriminated union not open union:** `z.discriminatedUnion("type", [...])` vs `z.union([...])` — discriminated union provides better error messages and is exhaustive at parse time.

## Deviations from Plan

None — plan executed exactly as written. All schemas match the shapes specified in PATTERNS.md and RESEARCH.md.

## Known Stubs

None — all schemas are fully defined with no placeholder values.

## Threat Flags

No new threat surface introduced. This plan creates TypeScript/Zod type definitions only — no network endpoints, auth paths, file access patterns, or schema changes at trust boundaries. Threat mitigations T-02-01 and T-02-02 are implemented as planned.

## Environment Notes

**Pre-existing Node version constraint:** The environment uses Node.js v18.20.4, but the project's monorepo requires Node 22.2+ (pinned in `.nvmrc` and `package.json` engines). Vitest 4.x requires `node:util.styleText` (available in Node 20.12+), causing `pnpm --filter @grovio/contracts test` to fail with a startup error in this environment. This is a **pre-existing constraint** — the `pnpm --filter @grovio/contracts typecheck` and `pnpm --filter @grovio/contracts build` commands both exit 0. The test file logic is correct; it will run successfully when the project is run with Node 22 (the correct runtime for this codebase).

## Self-Check: PASSED

- [x] `packages/contracts/src/category/blocks.ts` — FOUND
- [x] `packages/contracts/src/category/blocks.test.ts` — FOUND
- [x] `packages/contracts/src/category/tree.ts` — FOUND
- [x] `packages/contracts/src/category/attribute-definition.ts` — FOUND
- [x] `packages/contracts/src/category/filter-schema.ts` — FOUND
- [x] `packages/contracts/src/category/product-template.ts` — FOUND
- [x] `packages/contracts/src/category/vendor-restriction.ts` — FOUND
- [x] `packages/contracts/src/category/metadata.ts` — FOUND
- [x] `packages/contracts/src/category/index.ts` — FOUND
- [x] Commit 404ee7b — FOUND (Task 1)
- [x] Commit 5ce1196 — FOUND (Task 2)
- [x] Commit 8a99db3 — FOUND (Task 3)
- [x] `pnpm --filter @grovio/contracts typecheck` — exits 0
- [x] `pnpm --filter @grovio/contracts build` — exits 0, dist/index.js 11.24 KB
