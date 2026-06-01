---
phase: "03"
plan: "07"
subsystem: "api-routes"
tags: ["vendor-auth", "product-routes", "search-routes", "admin-moderation", "bullmq", "jwt", "di-container"]
dependency_graph:
  requires: ["03-05", "03-06"]
  provides: ["vendor-jwt-middleware", "vendor-auth-routes", "vendor-product-routes", "admin-moderation-routes", "search-routes", "di-container-wiring", "worker-startup"]
  affects: ["app.ts", "container.ts", "main.ts", "categories.ts"]
tech_stack:
  added: []
  patterns:
    - "Fastify preHandler hook for requireVendorAuth JWT guard"
    - "Admin token guard copied verbatim from admin/categories.ts"
    - "Graceful 503 degradation when searchService.isAvailable() is false"
    - "Worker-after-listen pattern for BullMQ ProductIndexWorker"
    - "Awilix PROXY injection for Phase 3 services"
key_files:
  created:
    - "apps/api/src/middleware/vendorAuth.ts"
    - "apps/api/src/routes/vendor/auth.ts"
    - "apps/api/src/routes/vendor/products.ts"
    - "apps/api/src/routes/admin/products.ts"
    - "apps/api/src/routes/search.ts"
  modified:
    - "apps/api/src/types/fastify.d.ts"
    - "apps/api/src/routes/categories.ts"
    - "apps/api/src/container.ts"
    - "apps/api/src/app.ts"
    - "apps/api/src/main.ts"
    - "apps/api/src/modules/catalog/ProductService.ts"
decisions:
  - "Worker started after fastify.listen() so HTTP boots cleanly independent of BullMQ health (T-03-W5, RESEARCH OQ1)"
  - "requireVendorAuth placed as preHandler hook at plugin level — all /vendor/* routes guarded in one declaration"
  - "GET /categories/:id/filters updated to resolve searchService first (Redis-cached), falling back to filterSchemaService when OpenSearch unavailable"
  - "ProductService.addVariant/updateVariant/deleteVariant/getVendorProductById added as Rule 2 auto-fix — required for route type safety"
  - "ProductService.listForModeration added as Rule 2 auto-fix — required for admin moderation queue route"
metrics:
  duration_minutes: 12
  completed_date: "2026-06-01"
  tasks_completed: 3
  files_created: 5
  files_modified: 6
---

# Phase 3 Plan 7: HTTP Route Wiring + DI Container + Worker Startup Summary

Vendor JWT middleware, vendor auth/product/variant/image routes, admin moderation routes, public search routes, DI container registration, app.ts plugin/route registration, and main.ts worker startup for the Phase 3 catalog and search API surface.

## What Was Built

### Task 1: Vendor JWT middleware + auth & product routes

**`apps/api/src/middleware/vendorAuth.ts`** — `requireVendorAuth` preHandler using `jose` `jwtVerify` with HS256 + JWT_SECRET. Reads Authorization Bearer token, verifies role === 'vendor', sets `request.vendorId`. Returns 401 coded envelope on any failure (T-03-W1, V4, T-03-W4).

**`apps/api/src/types/fastify.d.ts`** — Added `FastifyRequest.vendorId?: string` augmentation for TypeScript to resolve the property set by requireVendorAuth.

**`apps/api/src/routes/vendor/auth.ts`** — Public POST /vendor/auth/register (201) and POST /vendor/auth/login (200/401) wired to VendorAuthService. Maps `InvalidCredentialsError` → 401, `VendorAlreadyExistsError` → 409 (D-17, T-03-P1).

**`apps/api/src/routes/vendor/products.ts`** — Full CRUD product routes, variant sub-routes, and image sub-routes. `requireVendorAuth` registered as preHandler hook at plugin level. Error-status mapping: `ProductStateError`/`ProductValidationError`/`ImageLimitError`/`ImageSizeError` → 422, `ProductOwnershipError`/`ProductRestrictionError`/`ImageOwnershipError` → 403, `ProductNotFoundError` → 404.

### Task 2: Admin moderation routes + public search routes + filters extension

**`apps/api/src/routes/admin/products.ts`** — GET /admin/products (moderation queue, pending_review), POST /admin/products/:id/approve, POST /admin/products/:id/reject. Admin token guard copied verbatim from admin/categories.ts. Reject requires `RejectProductInputSchema` with `rejectionReason` (D-08). Startup assertion fails fast if INTERNAL_ADMIN_TOKEN is missing in production (T-03-W2).

**`apps/api/src/routes/search.ts`** — GET /search (SearchQuerySchema, graceful 503 SEARCH_UNAVAILABLE when `searchService.isAvailable()` is false) and GET /search/suggest (SuggestQuerySchema enforcing q.min(2), graceful 503). SRCH-01 through SRCH-04.

**`apps/api/src/routes/categories.ts`** — Updated GET /categories/:id/filters to resolve `searchService` first (Redis-cached, FILTER_SCHEMA_TTL_SECONDS), falling back to `filterSchemaService` DB query when OpenSearch is unavailable. Both paths return the same shape for clients.

### Task 3: DI container + app.ts + main.ts

**`apps/api/src/container.ts`** — Added `opensearch` and `productIndexQueue` as `asValue()` infrastructure registrations. Added `vendorAuthService`, `productService`, `imageService`, `searchService` as `asClass().singleton()` domain service registrations.

**`apps/api/src/app.ts`** — Added `opensearchPlugin` registration after `redisPlugin` and before `awilixPlugin` (correct dependency order). Registered `vendorAuthRoutes`, `vendorProductRoutes`, `adminProductRoutes`, `searchRoutes` after existing Phase 1-2 routes.

**`apps/api/src/main.ts`** — After `fastify.listen()` succeeds, starts `ProductIndexWorker` (only when OpenSearch is configured). On SIGINT/SIGTERM: closes worker first (drains in-flight jobs), then `fastify.close()`. HTTP availability is independent of queue health (T-03-W5, RESEARCH OQ1).

## Verification Results

- `pnpm --filter @grovio/api typecheck` — exits 0 (TypeScript strict mode, no errors)
- `pnpm --filter @grovio/api build` — exits 0 (tsc compilation succeeds)
- `pnpm --filter @grovio/api test` — 272/272 tests pass (28 test files)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing critical functionality] ProductService.addVariant/updateVariant/deleteVariant/getVendorProductById**
- **Found during:** Task 1 (vendor/products.ts route creation)
- **Issue:** Plan calls for variant sub-routes (`POST/PATCH/DELETE /vendor/products/:id/variants`) but ProductService from plan 03-05 only has the docstring mention, not the actual method implementations.
- **Fix:** Added `addVariant(productId, vendorId, input)`, `updateVariant(variantId, productId, vendorId, input)`, `deleteVariant(variantId, productId, vendorId)`, and `getVendorProductById(id, vendorId)` to ProductService following the existing CRUD pattern with ownership guards (eq(products.vendorId, vendorId)).
- **Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
- **Commit:** dd11a58

**2. [Rule 2 - Missing critical functionality] ProductService.listForModeration()**
- **Found during:** Task 2 (admin/products.ts route creation)
- **Issue:** Admin moderation queue route needs to list products by status=pending_review but ProductService had no such method.
- **Fix:** Added `listForModeration(limit, cursor)` returning `{ products, nextCursor }` with cursor pagination and status=pending_review filter.
- **Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
- **Commit:** 33501f3

**3. [Rule 1 - Bug] ImageService method signature mismatch**
- **Found during:** Task 1 (route wiring)
- **Issue:** ImageService methods have different argument orders than initially expected: `generatePresignedUpload(productId, vendorId, input: PresignImageInput)` (not separate contentType/fileSizeBytes), `confirmUpload(productId, vendorId, input: ConfirmImageUploadInput)`, `reorderImages(productId, vendorId, orderedImageIds)`.
- **Fix:** Routes updated to match actual ImageService method signatures exactly.
- **Files modified:** `apps/api/src/routes/vendor/products.ts`
- **Commit:** dd11a58

**4. [Rule 1 - Bug] contracts package not built in worktree**
- **Found during:** Task 1 typecheck
- **Issue:** `@grovio/contracts` exports point to `dist/` which didn't exist in the worktree's symlinked package (pnpm workspace install doesn't run `build`).
- **Fix:** Ran `pnpm --filter @grovio/contracts build` to generate dist. This is a worktree setup issue — the main repo has a pre-built dist.
- **Commit:** N/A (not committed — build artifact)

**5. [Rule 1 - Bug] exactOptionalPropertyTypes strict mode in search.ts**
- **Found during:** Task 2 typecheck
- **Issue:** Passing `{ q: string | undefined, ... }` to `SearchParams` fails under `exactOptionalPropertyTypes: true` — TypeScript requires properties to be omitted when undefined.
- **Fix:** Rebuilt `searchParams` object using conditional property assignment (`if (params.q !== undefined) searchParams.q = params.q`).
- **Files modified:** `apps/api/src/routes/search.ts`
- **Commit:** 33501f3

## Known Stubs

None — all routes are wired to actual service methods. No hardcoded empty values or placeholder text.

## Threat Flags

None — all new routes are covered by the plan's threat model (T-03-W1 through T-03-W5). No new network endpoints or auth paths outside the plan scope.

## Self-Check: PASSED

Files exist:
- apps/api/src/middleware/vendorAuth.ts — FOUND
- apps/api/src/routes/vendor/auth.ts — FOUND
- apps/api/src/routes/vendor/products.ts — FOUND
- apps/api/src/routes/admin/products.ts — FOUND
- apps/api/src/routes/search.ts — FOUND

Commits exist:
- dd11a58 — Task 1 (vendor middleware + auth + product routes + ProductService methods)
- 33501f3 — Task 2 (admin routes + search routes + categories.ts extension + listForModeration)
- e1fb795 — Task 3 (container + app.ts + main.ts worker startup)

Build: PASSED (272/272 tests)
