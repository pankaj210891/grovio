---
phase: 02-category-engine
plan: "02"
subsystem: database-schema
tags: [drizzle, postgresql, schema, jsonb, pgenum, category-engine]
dependency_graph:
  requires:
    - 01-foundation
  provides:
    - categories-table
    - attribute-definitions-table
    - filter-schema-definitions-table
    - product-templates-table
    - vendor-category-restrictions-table
    - category-metadata-table
    - AttrTypeEnum
    - FilterDisplayTypeEnum
    - contracts-category-domain
  affects:
    - 02-03-migration
    - 02-04-category-service
    - 02-05-attribute-service
    - 02-06-admin-routes
    - 02-07-contracts-tests
    - 02-08-admin-ui
tech_stack:
  added:
    - drizzle pgEnum (attrTypeEnum, filterDisplayTypeEnum)
    - JSONB .$type<T>() typed column pattern for options, blocks, templateFields
    - Composite unique() constraints (two-column table-level)
    - Self-referential adjacency list FK with ON DELETE RESTRICT
    - Deferred FK pattern (vendorId, createdByAdminId in vendor_category_restrictions)
  patterns:
    - pgTable + $inferInsert/$inferSelect type export (mirrors feature-flags.ts)
    - pgEnum for DB-level constraint enforcement (T-02-03)
    - jsonb.$type<T>() for typed JSONB columns without a separate table
    - unique().on(col1, col2) for composite unique constraints
    - Discriminated union MerchandisingBlock in @grovio/contracts (D-14)
    - z.lazy() recursive Zod schema for CategoryTreeNode
key_files:
  created:
    - apps/api/src/db/schema/categories.ts
    - apps/api/src/db/schema/attribute-definitions.ts
    - apps/api/src/db/schema/filter-schema-definitions.ts
    - apps/api/src/db/schema/product-templates.ts
    - apps/api/src/db/schema/vendor-category-restrictions.ts
    - apps/api/src/db/schema/category-metadata.ts
    - packages/contracts/src/category/attribute-definition.ts
    - packages/contracts/src/category/blocks.ts
    - packages/contracts/src/category/filter-schema.ts
    - packages/contracts/src/category/tree.ts
    - packages/contracts/src/category/product-template.ts
    - packages/contracts/src/category/vendor-restriction.ts
    - packages/contracts/src/category/metadata.ts
    - packages/contracts/src/category/index.ts
  modified:
    - apps/api/src/db/schema/index.ts
    - apps/api/src/config/env.ts
    - packages/contracts/src/index.ts
decisions:
  - "Self-referential parentId uses ON DELETE RESTRICT (not CASCADE) to prevent orphan subtrees"
  - "No depth column in categories table — depth is computed at tree assembly time"
  - "vendorId and createdByAdminId on vendor_category_restrictions are uuid without FK (vendors/users tables deferred to Phase 3/4)"
  - "templateFields uses attribute key (text) not UUID so template survives attribute delete+recreate"
  - "category_metadata lazy-created on first PUT — empty rows avoided in fresh deployments"
  - "blocks stored as JSONB array on category_metadata row (not a separate table per D-12 anti-pattern)"
  - "contracts/category/ subfolder created alongside schema files — AttrType/MerchandisingBlock types shared"
metrics:
  duration: "~20 minutes"
  completed: "2026-05-30"
  tasks_completed: 3
  files_created: 16
  files_modified: 3
---

# Phase 02 Plan 02: Database Schema — Drizzle Tables Summary

**One-liner:** Six Drizzle schema tables with 2 pgEnums (attrTypeEnum 6 values, filterDisplayTypeEnum 4 values), JSONB typed columns, adjacency-list self-referential FK, and @grovio/contracts category domain — the JSONB + schema registry pattern that makes Grovio vertical-agnostic (not EAV).

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create categories + attribute_definitions + filter_schema_definitions | c051674 | categories.ts, attribute-definitions.ts, filter-schema-definitions.ts, + 5 contracts files |
| 2 | Create product_templates + vendor_category_restrictions + category_metadata | facbd6f | product-templates.ts, vendor-category-restrictions.ts, category-metadata.ts, + 3 contracts files |
| 3 | Update schema barrel (FK order) and add CATEGORY_TREE_TTL_SECONDS env var | a58e8aa | schema/index.ts, config/env.ts |

## What Was Built

### Schema Files (6 tables + 2 pgEnums)

**`categories` (CAT-01, CAT-02)**
- Adjacency list: `parentId` → self-referential FK with `ON DELETE RESTRICT` (prevents orphan subtrees, T-02-04)
- Soft-delete: `archivedAt` timestamp (null = active; Phase 3+ product FK safety)
- `isRestricted` boolean (D-09) — enforced in Phase 3, flag set here
- Unique slug; no `depth` column (computed at tree-assembly time, D-02)

**`attribute_definitions` (CAT-03)**
- `attrTypeEnum` pgEnum with exactly 6 values: `text | textarea | number | boolean | enum | multi_select` (D-05, D-06, T-02-03)
- `options jsonb.$type<AttributeOption[]>()` — typed JSONB for enum/multi_select options, null otherwise (D-07)
- Table-level `unique().on(categoryId, key)` — prevents duplicate attribute keys per category
- `isFilterable`, `isSearchable` flags for Phase 4 filter panel and Phase 3 OpenSearch mapping

**`filter_schema_definitions` (CAT-04)**
- `filterDisplayTypeEnum` pgEnum with exactly 4 values: `checkbox | radio | range_slider | toggle` (T-02-03)
- FK to both categories and attributeDefinitions with cascade on both
- Table-level `unique().on(categoryId, attributeDefId)`

**`product_templates` (CAT-05)**
- `categoryId` unique FK (one template per category, `onDelete: "cascade"`)
- `templateFields jsonb.$type<TemplateField[]>()` with `.notNull().default([])`
- Uses attribute `key` (text), not UUID — template survives attribute delete+recreate

**`vendor_category_restrictions` (CAT-06)**
- `categoryId` FK with cascade; `vendorId` and `createdByAdminId` are uuid without FK (deferred FKs, T-02-05)
- In-file comments document Phase 3 (vendorId) and Phase 4 (createdByAdminId) FK migration commands
- Table-level `unique().on(categoryId, vendorId)` (D-10)

**`category_metadata` (CAT-07)**
- `categoryId` unique FK (one row per category, `onDelete: "cascade"`)
- Four flat SEO columns: `seoTitle`, `seoDescription`, `seoKeywords`, `canonicalUrl` (D-13)
- `blocks jsonb.$type<MerchandisingBlock[]>()` with `.notNull().default([])` (D-12)
- `description` and `imageUrl` as nullable text columns

### Schema Barrel (`apps/api/src/db/schema/index.ts`)

Updated to export in FK-dependency order: categories → attribute-definitions → filter-schema-definitions → product-templates → vendor-category-restrictions → category-metadata → feature-flags (existing, kept).

### Environment Variable (`apps/api/src/config/env.ts`)

Added `CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300)` directly below `FEATURE_FLAG_TTL_SECONDS`. JSDoc documents write-through invalidation semantics (D-03 — TTL is safety net only, not the primary propagation mechanism).

### Contracts (`packages/contracts/src/category/`)

New domain subfolder with 7 files:
- `blocks.ts`: `MerchandisingBlockSchema` discriminated union (banner | product_grid | text_block) per D-14
- `tree.ts`: `CategoryTreeNodeSchema` with `z.lazy()` for recursion; `CreateCategoryInputSchema`
- `attribute-definition.ts`: `AttrTypeSchema`, `AttributeOptionSchema`, `AttributeDefinitionSchema`, `CreateAttributeInputSchema`
- `filter-schema.ts`: `DisplayTypeSchema`, `FilterSchemaDefSchema`, `UpsertFilterSchemaInputSchema`
- `product-template.ts`: `TemplateFieldSchema`, `ProductTemplateSchema`, `UpsertTemplateInputSchema`
- `vendor-restriction.ts`: `VendorCategoryRestrictionSchema`, `CategoryRestrictionsResponseSchema`
- `metadata.ts`: `CategoryMetadataSchema`, `UpsertMetadataInputSchema`
- `index.ts`: barrel re-exporting all above

`packages/contracts/src/index.ts` updated to `export * from "./category/index.js"`.

## Verification

- `pnpm --filter @grovio/api typecheck` → exit 0 (checked after each task)
- `pnpm --filter @grovio/api build` → exit 0 (checked after Task 3)
- All 6 schema files present; schema barrel in FK order; env var added
- No unexpected file deletions across all 3 commits

## Deviations from Plan

### Auto-additions (Rule 2 — Missing Critical Functionality)

**1. [Rule 2 - Missing] Created packages/contracts/src/category/ subfolder**
- **Found during:** Task 1 — schema files import `AttributeOption`, `TemplateField`, `MerchandisingBlock` from `@grovio/contracts`
- **Issue:** Plan listed only schema files and index/env as file targets, but contracts types were a prerequisite (import would fail without them)
- **Fix:** Created all 7 contracts files + category barrel + updated root contracts index before writing the schema files
- **Files created:** All 7 `packages/contracts/src/category/*.ts` files + `packages/contracts/src/index.ts` update
- **Commits:** c051674 (blocks/tree/attribute-definition/filter-schema), facbd6f (product-template/vendor-restriction/metadata)

This was not an architectural change (contracts subfolder pattern already exists for money/), it was a required prerequisite for the schema files to compile.

## Known Stubs

None — all schema files contain complete column definitions. No placeholder text, hardcoded empty fields that flow to UI, or TODO/FIXME markers found.

## Threat Surface Scan

No new network endpoints, auth paths, or file access patterns introduced. All schema changes are at the PostgreSQL persistence boundary and are within the plan's threat model scope:
- T-02-03: pgEnum constraints on attrTypeEnum and filterDisplayTypeEnum — implemented
- T-02-04: ON DELETE RESTRICT on categories.parentId — implemented
- T-02-05: Deferred FK on vendor_category_restrictions.vendorId — accepted, documented in schema file

## Self-Check: PASSED

All files found:
- FOUND: apps/api/src/db/schema/categories.ts
- FOUND: apps/api/src/db/schema/attribute-definitions.ts
- FOUND: apps/api/src/db/schema/filter-schema-definitions.ts
- FOUND: apps/api/src/db/schema/product-templates.ts
- FOUND: apps/api/src/db/schema/vendor-category-restrictions.ts
- FOUND: apps/api/src/db/schema/category-metadata.ts
- FOUND: apps/api/src/db/schema/index.ts (FK order correct)
- FOUND: apps/api/src/config/env.ts (CATEGORY_TREE_TTL_SECONDS added)
- FOUND: packages/contracts/src/category/attribute-definition.ts
- FOUND: packages/contracts/src/category/blocks.ts
- FOUND: packages/contracts/src/category/filter-schema.ts
- FOUND: packages/contracts/src/category/tree.ts
- FOUND: packages/contracts/src/category/product-template.ts
- FOUND: packages/contracts/src/category/vendor-restriction.ts
- FOUND: packages/contracts/src/category/metadata.ts
- FOUND: packages/contracts/src/category/index.ts

All commits verified:
- c051674: Task 1 — categories, attribute-definitions, filter-schema-definitions + contracts
- facbd6f: Task 2 — product-templates, vendor-category-restrictions, category-metadata + contracts
- a58e8aa: Task 3 — schema barrel + env var
