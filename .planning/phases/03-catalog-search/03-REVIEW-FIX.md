---
phase: 03-catalog-search
fixed_at: 2026-06-01T00:00:00Z
review_path: .planning/phases/03-catalog-search/03-REVIEW.md
iteration: 1
findings_in_scope: 10
fixed: 10
skipped: 0
status: all_fixed
---

# Phase 03: Code Review Fix Report

**Fixed at:** 2026-06-01T00:00:00Z
**Source review:** .planning/phases/03-catalog-search/03-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 10 (4 Critical + 6 Warning)
- Fixed: 10
- Skipped: 0

## Fixed Issues

### CR-01: `rejectProduct` lacks a state guard — can reject any product status

**Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
**Commit:** d8f27c0
**Applied fix:** Added an explicit `if (product.status !== "pending_review")` guard before the DB update in `rejectProduct`, throwing `ProductStateError` for any non-`pending_review` status. Matches the pattern already in `approveProduct`. Note: `wasApproved` will now always be `false` since only `pending_review` products reach that check — semantically correct since they were never indexed.

---

### CR-02: `listForModeration` pagination cursor uses `DESC` ordering but `lt` predicate — pages do not advance

**Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
**Commit:** 441cdc1
**Applied fix:** Changed `lt` cursor predicates to `gt` and changed `.orderBy(desc(...), desc(...))` to `.orderBy(asc(...), asc(...))` in `listForModeration` only. Also added `asc` and `gt` to the drizzle-orm imports. `listVendorProducts` is unchanged and still uses DESC + lt for newest-first ordering.

---

### CR-03: `shutdown` error in `worker.close()` or `fastify.close()` causes unhandled rejection — process stays alive

**Files modified:** `apps/api/src/main.ts`
**Commit:** ecfaa7a
**Applied fix:** Added `let shuttingDown = false` re-entrant guard. Wrapped the entire shutdown body in `try/catch` so errors from `worker.close()` or `fastify.close()` call `fastify.log.error()` and `process.exit(1)` instead of becoming unhandled rejections. Both SIGINT and SIGTERM are handled; the `void` dispatch remains since the guard prevents double-invocation.

---

### CR-04: ZodError thrown from route handlers reaches `app.ts` global error handler and leaks full validation detail in production

**Files modified:** `apps/api/src/app.ts`
**Commit:** 6740e0f
**Applied fix:** Added `import { ZodError } from "zod"` and updated the `setErrorHandler` signature to accept `FastifyError | ZodError`. Added an `instanceof ZodError` check at the top of the handler that returns 400 with `VALIDATION_ERROR` code. In production the message is generic; in non-production it joins `error.issues` paths and messages. The existing `FastifyError` handling path uses type assertions to remain compatible.

---

### WR-01: `vendorId` extracted from JWT is cast without validation — `undefined` silently propagates if JWT payload is malformed

**Files modified:** `apps/api/src/middleware/vendorAuth.ts`
**Commit:** 4c59bda
**Applied fix:** Replaced the direct cast `payload["vendorId"] as string` with an explicit type guard: reads into `rawVendorId`, checks `typeof rawVendorId !== "string" || rawVendorId.length === 0`, and throws `Error("Token is missing vendorId claim.")` if invalid. The thrown error is caught by the outer catch block which returns 401.

---

### WR-02: `Number()` NaN propagates to Drizzle limit() — `Math.min(Math.max(1, NaN), 100)` returns `NaN`

**Files modified:** `apps/api/src/routes/vendor/products.ts`, `apps/api/src/routes/admin/products.ts`
**Commit:** d89c703
**Applied fix:** In both list route handlers, replaced the single-expression limit computation with a two-step approach: read `rawLimit = Number(query.limit)`, then use `Number.isFinite(rawLimit)` to guard before clamping, falling back to 20 for non-finite values. Applied identically in both files.

---

### WR-03: `archiveProduct` enqueues a delete index job even for products that were never approved/indexed

**Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
**Commit:** 975e4c2
**Applied fix:** Wrapped the `productIndexQueue.add()` call in `archiveProduct` with `if (product.status === "approved")` check. Draft, `pending_review`, and `rejected` products have never been indexed in OpenSearch, so enqueueing a delete job for them is unnecessary. Consistent with how `rejectProduct` already gates on `wasApproved`.

---

### WR-04: `resolveSlug` busy-loop has no iteration cap — a burst of similarly-named products causes indefinite looping

**Files modified:** `apps/api/src/modules/catalog/ProductService.ts`
**Commit:** 28df402
**Applied fix:** Replaced `while (true)` with `while (suffix <= MAX_ATTEMPTS + 2)` where `MAX_ATTEMPTS = 100`. After exhausting attempts, appends a 6-character random alphanumeric suffix (`Math.random().toString(36).slice(2, 8)`) to guarantee uniqueness without further DB queries. Removed the `// eslint-disable-next-line no-constant-condition` comment.

---

### WR-05: `workers.ts` uses `console.error` instead of the structured logger

**Files modified:** `apps/api/src/modules/jobs/workers.ts`, `apps/api/src/main.ts`
**Commit:** 792fb2a
**Applied fix:** Added `FastifyBaseLogger` import from `fastify` and a `logger: FastifyBaseLogger` field to `ProductIndexWorkerDeps`. Replaced `console.error(...)` in the `failed` event handler with `deps.logger.error({ jobId, error: err.message }, "[ProductIndexWorker] Job failed")`. Updated `startProductIndexWorker` call in `main.ts` to pass `logger: fastify.log`.

---

### WR-06: `productIndexQueue` connection never closed during shutdown — BullMQ connects to Redis independently

**Files modified:** `apps/api/src/main.ts`
**Commit:** e9fc7e4
**Applied fix:** Added `import { productIndexQueue } from "./modules/jobs/queues.js"` to `main.ts` and inserted `await productIndexQueue.close()` in the shutdown `try` block between `worker.close()` and `fastify.close()`. This drains the BullMQ Queue's independent ioredis connection during graceful shutdown, preventing Redis connection abandonment.

---

_Fixed: 2026-06-01T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
