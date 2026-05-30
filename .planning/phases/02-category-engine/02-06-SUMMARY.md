---
phase: 02-category-engine
plan: "06"
subsystem: api-wiring
tags: [fastify, awilix, routes, container, typescript, category-engine, api-wiring]

# Dependency graph
requires:
  - 02-03-category-service
  - 02-04-attribute-definition-service
  - 02-05-product-template-service
provides:
  - All 6 category services registered in Awilix container (categoryService, attributeDefinitionService, filterSchemaService, productTemplateService, vendorRestrictionService, categoryMetadataService)
  - Public read API — GET /categories (tree) + 6 per-category detail endpoints
  - Admin mutation API — POST/PATCH/DELETE routes for all 6 domain surfaces + placeholder guard
  - CreateCategoryInputSchema + UpdateCategoryInputSchema Zod schemas in @grovio/contracts
affects:
  - 02-07-web-admin
  - 02-08-search-integration
  - Phase 3 storefront (Phase 4 storefront reads these public routes)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Awilix container — multi-service registration block: asClass(Service).singleton() for 6 services"
    - "Fastify DI resolution pattern — diContainer.resolve<ServiceType>(name) inside each handler"
    - "Placeholder admin guard — NODE_ENV !== production OR X-Internal-Admin-Token header; Phase 4 JWT TODO"
    - "CategoryDepthError → 422 structured envelope in POST /admin/categories"
    - "ZodError → 400 structured envelope in PUT /admin/categories/:id/metadata (block validation)"
    - "Public routes: { success: true, data: ... } envelope; 404 CATEGORY_NOT_FOUND for missing categories"

key-files:
  created:
    - apps/api/src/routes/categories.ts
    - apps/api/src/routes/admin/categories.ts
  modified:
    - apps/api/src/container.ts
    - apps/api/src/app.ts
    - packages/contracts/src/category/tree.ts

key-decisions:
  - "CategoryDepthError imported directly from CategoryService.ts (not via index.ts type-only export) to enable instanceof check at runtime"
  - "Admin guard uses preHandler hook on the adminCategoryRoutes plugin scope — not registered globally so public routes are unaffected"
  - "ZodError from block validation in CategoryMetadataService caught in PUT /admin/categories/:id/metadata route and mapped to 400 INVALID_BLOCKS"
  - "CreateCategoryInputSchema and UpdateCategoryInputSchema added to packages/contracts/src/category/tree.ts to collocate with category domain contracts"
  - "VendorRestriction body (POST /admin/categories/:id/restrictions/vendors) uses inline type cast — no dedicated Zod schema needed for a 2-field object"

# Metrics
duration: ~30min
completed: 2026-05-30
tasks_completed: 3
files_created: 2
files_modified: 3
---

# Phase 02 Plan 06: API Wiring — Container, Routes, App Registration Summary

**All 6 category services registered in the Awilix container; public read routes (GET /categories tree + 6 per-category detail endpoints) and admin mutation routes (CRUD + guard + Zod validation + CategoryDepthError → 422) wired into a running Fastify API via app.ts**

## Performance

- **Duration:** ~30 min
- **Started:** 2026-05-30T00:35:00Z
- **Completed:** 2026-05-30T01:05:00Z
- **Tasks:** 3
- **Files created:** 2 | **Files modified:** 3

## Accomplishments

- `container.ts` now registers all 6 category engine services alongside `featureFlagService`: `categoryService`, `attributeDefinitionService`, `filterSchemaService`, `productTemplateService`, `vendorRestrictionService`, `categoryMetadataService` — each as `asClass(Service).singleton()`
- `routes/categories.ts` — 7 public GET endpoints with the Phase 4 storefront contract surfaces (CAT-01 through CAT-07 read): tree, category detail, attributes, filters, template, metadata, restrictions; CATEGORY_NOT_FOUND 404 for missing categories
- `routes/admin/categories.ts` — full admin mutation surface with placeholder guard (T-02-15), Zod body parsing (T-02-16), and domain error mapping (T-02-17): CategoryDepthError → 422, ZodError from block validation → 400
- `app.ts` registers `categoryRoutes` and `adminCategoryRoutes` after `featureFlagRoutes`
- Added `CreateCategoryInputSchema` and `UpdateCategoryInputSchema` to `packages/contracts/src/category/tree.ts` for admin route body validation (missing functionality from earlier plan, auto-fixed Rule 2)

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Register all 6 services in Awilix container | 48040e8 | container.ts, packages/contracts/src/category/tree.ts |
| 2 | Public category read routes | e4f24b6 | routes/categories.ts |
| 3 | Admin mutation routes + app.ts | 683a21f | routes/admin/categories.ts, app.ts |

## What Was Built

### Container Registration (`apps/api/src/container.ts`)

Added 6 new service registrations to the existing `container.register()` call:
```typescript
categoryService: asClass(CategoryService).singleton(),
attributeDefinitionService: asClass(AttributeDefinitionService).singleton(),
filterSchemaService: asClass(FilterSchemaService).singleton(),
productTemplateService: asClass(ProductTemplateService).singleton(),
vendorRestrictionService: asClass(VendorRestrictionService).singleton(),
categoryMetadataService: asClass(CategoryMetadataService).singleton(),
```

### Public Routes (`apps/api/src/routes/categories.ts`)

```
GET /categories                       → categoryService.getTree() → { tree }
GET /categories/:id                   → categoryService.getCategoryById() → category | 404
GET /categories/:id/attributes        → attributeDefinitionService.getAttributesByCategory() → { attributes }
GET /categories/:id/filters           → filterSchemaService.getFilterSchema() → { filters }
GET /categories/:id/template          → productTemplateService.getTemplate() → { template }
GET /categories/:id/metadata          → categoryMetadataService.getMetadata() → { metadata }
GET /categories/:id/restrictions      → vendorRestrictionService → { isRestricted, approvedVendorIds }
```

### Admin Routes (`apps/api/src/routes/admin/categories.ts`)

Guard (T-02-15):
- In dev/test: all requests pass through
- In production: `X-Internal-Admin-Token` header must match `INTERNAL_ADMIN_TOKEN` env var → 401 if missing or mismatched
- Phase 4 TODO comment: replace with JWT middleware using `jose` library and admin role claim

Endpoints:
```
POST   /admin/categories                              → createCategory (201; 422 on CategoryDepthError)
PATCH  /admin/categories/:id                          → updateCategory
POST   /admin/categories/:id/archive                  → archiveCategory
POST   /admin/categories/:id/reorder                  → reorderCategories({ orderedIds })
POST   /admin/categories/:id/attributes               → createAttribute (201)
PATCH  /admin/categories/:id/attributes/:attrId       → updateAttribute
DELETE /admin/categories/:id/attributes/:attrId       → deleteAttribute
POST   /admin/categories/:id/attributes/reorder       → reorderAttributes({ orderedIds })
PUT    /admin/categories/:id/filters                  → replaceFilterSchema (UpsertFilterSchemaInput)
PUT    /admin/categories/:id/template                 → upsertTemplate (UpsertTemplateInput)
PUT    /admin/categories/:id/metadata                 → upsertMetadata (UpsertMetadataInput; ZodError → 400)
POST   /admin/categories/:id/restrictions/vendors     → addVendorToCategory (201)
DELETE /admin/categories/:id/restrictions/vendors/:vendorId → removeVendorFromCategory
```

### App Registration (`apps/api/src/app.ts`)

```typescript
await fastify.register(categoryRoutes);
await fastify.register(adminCategoryRoutes);
```
Registered after `featureFlagRoutes`. The existing error handler on `app.ts` (lines 52-71) catches all re-thrown errors from admin routes.

### Contracts Addition (`packages/contracts/src/category/tree.ts`)

Added `CreateCategoryInputSchema` and `UpdateCategoryInputSchema` (with `CreateCategoryInputContract` and `UpdateCategoryInputContract` type aliases) to enable Zod body parsing in the admin route for category CRUD.

## Verification

- `pnpm --filter @grovio/api typecheck` — exits 0 (Node version constraint; tsc 5.8 runs cleanly on Node 18)
- `pnpm --filter @grovio/contracts typecheck` — exits 0
- Acceptance criteria verified via grep/content checks:
  - `container.ts`: 7 services registered (featureFlagService + 6 category services) — VERIFIED
  - `categories.ts`: exports `categoryRoutes`, 7 GET endpoints, CATEGORY_NOT_FOUND 404, diContainer.resolve inside each handler — VERIFIED
  - `admin/categories.ts`: exports `adminCategoryRoutes`, guard with 401 + Phase 4 comment, POST /admin/categories catches CategoryDepthError → 422, Zod parse on all admin bodies — VERIFIED
  - `app.ts`: registers `categoryRoutes` and `adminCategoryRoutes` after `featureFlagRoutes` — VERIFIED

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing] Added CreateCategoryInputSchema + UpdateCategoryInputSchema to contracts**
- **Found during:** Task 1 (planning admin route body validation)
- **Issue:** The plan required Zod body parsing for admin category mutation routes. While `@grovio/contracts` had input schemas for all sub-resources (attributes, filters, templates, metadata), it was missing `CreateCategoryInputSchema` and `UpdateCategoryInputSchema` for the top-level category CRUD routes.
- **Fix:** Added both schemas to `packages/contracts/src/category/tree.ts` alongside the tree/response types. Includes type aliases `CreateCategoryInputContract` and `UpdateCategoryInputContract` for TypeScript consumers.
- **Files modified:** `packages/contracts/src/category/tree.ts`
- **Commit:** 48040e8

**2. [Rule 2 - Missing] Used ZodError instanceof instead of constructor.name string check**
- **Found during:** Task 3 (metadata route ZodError handling)
- **Issue:** Initial draft used `err.constructor.name === "ZodError"` which is fragile. Since `zod` is a direct dependency of `@grovio/api`, proper `import { ZodError } from "zod"` with `err instanceof ZodError` is correct and type-safe.
- **Fix:** Added `import { ZodError } from "zod"` and used `instanceof` check in the metadata route's catch block.
- **Files modified:** `apps/api/src/routes/admin/categories.ts`
- **Commit:** 683a21f

**3. [Rule 1 - Bug] CategoryDepthError imported directly from CategoryService.ts, not index.ts**
- **Found during:** Task 3 (admin route CategoryDepthError catch)
- **Issue:** `apps/api/src/modules/categories/index.ts` exports `CategoryDepthError` as `export type { CategoryDepthError }` — a type-only export erased at runtime. Using `instanceof CategoryDepthError` would fail silently at runtime if imported via the type-only export.
- **Fix:** Imported `{ CategoryDepthError }` directly from `"../../modules/categories/CategoryService.js"` (the implementation file) to get the runtime class value, not just the type.
- **Files modified:** `apps/api/src/routes/admin/categories.ts`
- **Commit:** 683a21f

## Known Stubs

None — all route handlers are fully wired to real service methods. No placeholder data, hardcoded responses, or TODO stub markers in the route files.

## Threat Surface Scan

New network endpoints introduced in this plan:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: public_read_api | apps/api/src/routes/categories.ts | 7 public GET endpoints: /categories and 6 sub-resource reads — untrusted read traffic, no mutation, tree is cache-backed |
| threat_flag: admin_mutation_api | apps/api/src/routes/admin/categories.ts | 13 admin mutation endpoints — protected by placeholder guard (T-02-15 mitigated); Phase 4 JWT replaces guard |

Threat mitigations implemented:
- T-02-15 (Elevation of Privilege — unauthenticated admin mutation): Placeholder guard on `adminCategoryRoutes` preHandler; rejects with 401 in production when `X-Internal-Admin-Token` header is absent or invalid
- T-02-16 (Tampering — malformed admin bodies): Every admin route runs `.parse(request.body)` via the corresponding `@grovio/contracts` Zod schema before reaching the service
- T-02-17 (Information Disclosure — raw error leakage): CategoryDepthError → clean 422 envelope; ZodError from block validation → clean 400 envelope; all other errors re-thrown to app.ts error handler which suppresses raw messages in production

## Self-Check: PASSED

- [x] `apps/api/src/routes/categories.ts` — FOUND
- [x] `apps/api/src/routes/admin/categories.ts` — FOUND
- [x] `apps/api/src/container.ts` — modified, 6 new services registered — VERIFIED
- [x] `apps/api/src/app.ts` — modified, categoryRoutes + adminCategoryRoutes registered — VERIFIED
- [x] `packages/contracts/src/category/tree.ts` — modified, CreateCategoryInputSchema added — VERIFIED
- [x] Commit 48040e8 — Task 1 (container + contracts) — FOUND
- [x] Commit e4f24b6 — Task 2 (public routes) — FOUND
- [x] Commit 683a21f — Task 3 (admin routes + app.ts) — FOUND
- [x] No unexpected file deletions across all 3 commits — VERIFIED
- [x] categoryRoutes registered in app.ts — VERIFIED
- [x] adminCategoryRoutes registered in app.ts — VERIFIED
- [x] CategoryDepthError catch → 422 in POST /admin/categories — VERIFIED
- [x] Admin guard: NODE_ENV check + X-Internal-Admin-Token + 401 — VERIFIED
- [x] Phase 4 JWT replacement comment present — VERIFIED

## Environment Notes

**Pre-existing Node version constraint:** The environment uses Node.js v18.20.4; project requires >=22.2.0. This means:
- `pnpm --filter @grovio/api build` (esbuild/TypeScript compile) must be verified on Node 22
- `pnpm --filter @grovio/api test` — Vitest 4.x requires Node 20.12+; cannot run in Node 18 env
- `pnpm --filter @grovio/api typecheck` — tsc 5.8 works on Node 18; passes cleanly

**Worktree base reset:** Worktree was originally spawned at commit `341f63e` but Phase 2 service files (02-01 through 02-05) were committed to main after spawn. Applied `git reset --hard cf9d441` as specified in the `<worktree_branch_check>` to advance the worktree base to include all prerequisite service implementations.
