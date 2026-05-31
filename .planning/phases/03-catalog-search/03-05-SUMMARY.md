---
phase: 03-catalog-search
plan: "05"
subsystem: services
tags: [vendor-auth, catalog, product-service, image-service, argon2, jose, bullmq, s3, state-machine, ownership]
dependency_graph:
  requires:
    - "03-01 (JwtPayloadSchema, CreateProductInputSchema, UpdateProductInputSchema, PresignImageInputSchema contracts)"
    - "03-03 (vendors, products, product_variants, product_images, attribute_definitions, vendor_category_restrictions schema)"
    - "03-04 (Phase 3 DB migration applied; tables live in Neon)"
  provides:
    - "VendorAuthService: register (argon2id), login (jose HS256 JWT role=vendor+vendorId, 1h TTL), verifyToken"
    - "VendorAlreadyExistsError, InvalidCredentialsError domain errors"
    - "ProductService: create/update/submit/approve/reject/archive + ownership + state machine + attribute validation + restriction check + auto-approve + index/delete enqueue"
    - "ProductStateError, ProductOwnershipError, ProductNotFoundError, ProductRestrictionError, ProductValidationError domain errors"
    - "ImageService: generatePresignedUpload/confirmUpload/reorderImages/deleteImage with S3 + ownership + size/count constraints"
    - "ImageLimitError, ImageOwnershipError, ImageSizeError domain errors"
    - "vendor-auth and catalog module barrels"
  affects:
    - "Plan 03-07 (vendor + admin routes will call these services directly)"
    - "Plan 03-08 (search routes use ProductService state transitions)"
tech_stack:
  added:
    - "jose 6.x added to @grovio/api package.json (was missing from api deps despite being in contracts)"
  patterns:
    - "VendorAuthService: argon2.hash/verify (Argon2id default) + jose SignJWT/jwtVerify HS256 (D-17, T-03-P1)"
    - "InvalidCredentialsError: same error for unknown email AND wrong password — no user enumeration (T-03-P1)"
    - "ProductService: status changes ONLY via named methods (submit/approve/reject) — updateProduct never writes status except pending_review->draft (D-06, Pitfall 3, T-03-P2)"
    - "ProductService: every vendor-scoped mutation includes eq(products.vendorId, vendorId) ownership filter (V4, T-03-P3)"
    - "ProductService: CATALOG_AUTO_APPROVE feature flag via featureFlagService.getFlag (D-07)"
    - "ProductService: BullMQ productIndexQueue.add action=index on approve; action=delete on reject/archive (D-13, D-14, Pitfall 7)"
    - "ProductService: vendor-category restriction via categories.isRestricted + vendor_category_restrictions lookup (D-18/CAT-06, T-03-P7)"
    - "ProductService: slug collision loop following CategoryService.resolveSlug pattern (RESEARCH.md)"
    - "ProductService: cursor pagination (createdAt DESC, id DESC composite cursor) for listVendorProducts"
    - "ImageService: S3 presigned PUT URL via PutObjectCommand + getSignedUrl (Pattern 6, D-09)"
    - "ImageService: generatePresignedUpload writes NOTHING to DB; confirmUpload is the only DB-write path (Pitfall 4, T-03-P6)"
    - "ImageService: MAX_IMAGE_SIZE_BYTES + MAX_IMAGES_PER_PRODUCT enforced at presign time (D-11, T-03-P5)"
    - "ImageService: cdnUrl pre-constructed as S3_PUBLIC_URL/key — backend never on upload path (D-09)"
    - "TDD: RED commit then GREEN commit per task; all service tests use mock-chain helpers"
key_files:
  created:
    - apps/api/src/modules/vendor-auth/VendorAuthService.ts
    - apps/api/src/modules/vendor-auth/VendorAuthService.test.ts
    - apps/api/src/modules/vendor-auth/index.ts
    - apps/api/src/modules/catalog/ProductService.ts
    - apps/api/src/modules/catalog/ProductService.test.ts
    - apps/api/src/modules/catalog/ImageService.ts
    - apps/api/src/modules/catalog/ImageService.test.ts
    - apps/api/src/modules/catalog/index.ts
  modified:
    - apps/api/package.json (added jose dependency)
    - pnpm-lock.yaml (updated with jose)
decisions:
  - "jose added to @grovio/api package.json — was missing from API's direct dependencies despite being used"
  - "TDD mock pattern: SignJWT and S3Client/PutObjectCommand mocked as ES classes (not vi.fn() factories) because they are used with `new`"
  - "ProductService accepts featureFlagService and productIndexQueue as injected deps typed as Pick<> — prevents import cycles"
  - "ImageService: S3ClientConfig constructed with spread to omit undefined optional properties (exactOptionalPropertyTypes)"
  - "rejectProduct enqueues delete job only when product WAS in approved status — pending_review rejections do not enqueue (D-13)"
metrics:
  duration: "~25 minutes"
  completed: "2026-05-31"
  tasks_completed: 3
  files_created: 8
  files_modified: 2
---

# Phase 3 Plan 05: VendorAuthService + ProductService + ImageService Summary

**One-liner:** VendorAuthService (argon2 register/login + jose vendor JWT), ProductService (full state machine + ownership + restriction + auto-approve + BullMQ enqueue), and ImageService (S3 presigned upload + confirm + reorder + delete) with 40 unit tests green.

## What Was Built

Three tasks executed in TDD (RED then GREEN) order:

**Task 1 — VendorAuthService + module barrel** (`apps/api/src/modules/vendor-auth/`)

- `VendorAuthService.ts`:
  - `register(email, password, name)`: `argon2.hash()` (Argon2id default), inserts vendors row, returns vendor WITHOUT passwordHash. Throws `VendorAlreadyExistsError` on PG error code `23505`.
  - `login(email, password)`: loads vendor by email, `argon2.verify()`, issues HS256 JWT via `jose SignJWT` with `{ sub: vendor.id, role: 'vendor', vendorId: vendor.id }` and 3600s TTL. Throws `InvalidCredentialsError` for BOTH unknown email and wrong password — no enumeration (T-03-P1).
  - `verifyToken(token)`: `jwtVerify` with JWT_SECRET, rejects non-vendor role payloads.
  - Domain errors: `VendorAlreadyExistsError` (code: VENDOR_ALREADY_EXISTS), `InvalidCredentialsError` (code: INVALID_CREDENTIALS).
- `index.ts`: barrel re-exporting service and error classes.
- `VendorAuthService.test.ts`: 11 unit tests covering all behaviors.

**Task 2 — ProductService + catalog module barrel** (`apps/api/src/modules/catalog/`)

- `ProductService.ts`:
  - `createProduct(vendorId, input)`: restriction check (D-18/CAT-06) → attribute validation → slug collision loop → inserts with status='draft'.
  - `updateProduct(id, vendorId, input)`: ownership guard → pending_review resets to draft before applying updates (D-06, Pitfall 3) → NEVER writes status directly.
  - `submitProduct(id, vendorId)`: reads `CATALOG_AUTO_APPROVE` → 'true' → approved + index job; 'false' → pending_review (D-07).
  - `approveProduct(id)`: pending_review → approved + `productIndexQueue.add` action='index' (D-14).
  - `rejectProduct(id, rejectionReason)`: requires non-empty reason (D-08) → rejected + stored reason → if was approved, enqueues delete job (D-13, Pitfall 7).
  - `archiveProduct(id, vendorId)`: ownership guard → archivedAt + delete job (Pitfall 7).
  - `listVendorProducts(vendorId, cursor?, limit?)`: cursor pagination (createdAt DESC, id DESC), vendor-scoped, non-archived.
- `ProductService.test.ts`: 17 unit tests with featureFlagMock and queueMock.

**Task 3 — ImageService** (`apps/api/src/modules/catalog/`)

- `ImageService.ts`:
  - `generatePresignedUpload(productId, vendorId, input)`: ownership → size guard (ImageSizeError) → count guard (ImageLimitError) → `getSignedUrl(s3, PutObjectCommand, { expiresIn: 300 })` → cdnUrl = `${S3_PUBLIC_URL}/${key}`. Returns `{ uploadUrl, cdnUrl, key }`. WRITES NOTHING to DB (Pitfall 4).
  - `confirmUpload(productId, vendorId, input)`: ownership check → inserts product_images row. Only DB-write method.
  - `reorderImages(productId, vendorId, orderedImageIds)`: ownership check → batch-update sortOrder.
  - `deleteImage(imageId, productId, vendorId)`: ownership check → hard-delete row.
- `ImageService.test.ts`: 12 unit tests; S3Client and PutObjectCommand mocked as ES classes; getSignedUrl mocked as vi.fn().

## Verification

- `pnpm --filter @grovio/api test -- --run src/modules/vendor-auth src/modules/catalog` — 3 test files, 40 tests: **PASS**
- `pnpm --filter @grovio/api test -- --run` — 12 test files, 116 tests: **PASS** (all prior tests still green)
- `pnpm --filter @grovio/api typecheck` — **exits 0**

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] jose package missing from @grovio/api dependencies**
- **Found during:** Task 1 typecheck after implementing VendorAuthService
- **Issue:** `jose` was accessible via hoisting during Phase 1/2 but was not in `apps/api/package.json`. TypeScript threw TS2307 "Cannot find module 'jose'" during typecheck.
- **Fix:** Ran `pnpm --filter @grovio/api add jose` to add it as a direct dependency.
- **Files modified:** `apps/api/package.json`, `pnpm-lock.yaml`
- **Commit:** 222a8b3

**2. [Rule 1 - Bug] Test mocks for class constructors (SignJWT, S3Client, PutObjectCommand)**
- **Found during:** Task 1 GREEN + Task 3 GREEN — `vi.fn().mockImplementation(() => ({...}))` caused "TypeError: is not a constructor".
- **Fix:** Mocked each as an ES class (`class MockSignJWT { ... }`) so `new` works correctly.
- **Files modified:** `VendorAuthService.test.ts`, `ImageService.test.ts`
- **Commits:** 222a8b3, 2129917

**3. [Rule 1 - Bug] S3ClientConfig undefined optional property incompatibility**
- **Found during:** Task 3 typecheck — `endpoint: string | undefined` not assignable under `exactOptionalPropertyTypes: true`.
- **Fix:** Changed to spread-based config construction to omit property when undefined.
- **Files modified:** `ImageService.ts`
- **Commit:** 2129917

**4. [Rule 1 - Bug] jwtVerify mock needed `as never` cast**
- **Found during:** Task 1 typecheck — mock object missing `key` field required by `ResolvedKey`.
- **Fix:** Added `as never` cast to the mock return value.
- **Files modified:** `VendorAuthService.test.ts`
- **Commit:** 222a8b3

## Threat Surface Scan

Routes not yet created (Plan 03-07). No new HTTP endpoints exposed in this plan.

| Flag | File | Description |
|------|------|-------------|
| threat_flag: vendor-jwt-issuance | VendorAuthService.ts | Vendor JWT issuance path — mitigated: argon2id hash verify, no enumeration (T-03-P1) |
| threat_flag: product-state-bypass | ProductService.ts | Product status mutation path — mitigated: only named methods change status (T-03-P2) |
| threat_flag: product-idor | ProductService.ts | Product ownership path — mitigated: all vendor mutations filter by vendorId (T-03-P3/V4) |
| threat_flag: image-size-dos | ImageService.ts | Image upload size path — mitigated: MAX_IMAGE_SIZE_BYTES check + ContentLength on PutObjectCommand (T-03-P5) |
| threat_flag: image-orphan | ImageService.ts | Image presign-but-no-confirm path — mitigated: presign writes nothing; 5min presign TTL (T-03-P6) |

## Known Stubs

None. Pure service implementations with no placeholder data, hardcoded values, or UI components.

## Self-Check

### Created files exist:
- apps/api/src/modules/vendor-auth/VendorAuthService.ts — FOUND
- apps/api/src/modules/vendor-auth/VendorAuthService.test.ts — FOUND
- apps/api/src/modules/vendor-auth/index.ts — FOUND
- apps/api/src/modules/catalog/ProductService.ts — FOUND
- apps/api/src/modules/catalog/ProductService.test.ts — FOUND
- apps/api/src/modules/catalog/ImageService.ts — FOUND
- apps/api/src/modules/catalog/ImageService.test.ts — FOUND
- apps/api/src/modules/catalog/index.ts — FOUND

### Commits exist:
- 8915ac7: test(03-05): add failing VendorAuthService tests (RED) — FOUND
- 222a8b3: feat(03-05): implement VendorAuthService with argon2 + jose JWT (GREEN) — FOUND
- ab4058b: test(03-05): add failing ProductService tests (RED) — FOUND
- 3405673: feat(03-05): implement ProductService with full state machine + ownership (GREEN) — FOUND
- d088a9f: test(03-05): add failing ImageService tests (RED) — FOUND
- 2129917: feat(03-05): implement ImageService with S3 presign + confirm flow (GREEN) — FOUND

### Test results:
- vendor-auth + catalog modules: 40 tests, 3 files — PASS
- Full suite: 116 tests, 12 files — PASS
- pnpm --filter @grovio/api typecheck — exits 0

## Self-Check: PASSED
