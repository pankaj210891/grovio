---
phase: 03-catalog-search
reviewed: 2026-06-01T00:00:00Z
depth: standard
files_reviewed: 11
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/container.ts
  - apps/api/src/main.ts
  - apps/api/src/middleware/vendorAuth.ts
  - apps/api/src/modules/catalog/ProductService.ts
  - apps/api/src/routes/admin/products.ts
  - apps/api/src/routes/categories.ts
  - apps/api/src/routes/search.ts
  - apps/api/src/routes/vendor/auth.ts
  - apps/api/src/routes/vendor/products.ts
  - apps/api/src/types/fastify.d.ts
findings:
  critical: 4
  warning: 6
  info: 3
  total: 13
status: issues_found
---

# Phase 03: Code Review Report

**Reviewed:** 2026-06-01T00:00:00Z
**Depth:** standard
**Files Reviewed:** 11
**Status:** issues_found

## Summary

This phase delivers vendor auth, product management, OpenSearch indexing, and search routes. The overall structure is sound: JWT verification uses `jose` correctly, ownership checks are consistently applied per operation, Zod schemas guard all request bodies, and the BullMQ queue uses a dedicated Redis connection with `maxRetriesPerRequest: null`. However, four critical defects were found that can cause incorrect behavior in production: a missing state-machine guard in `rejectProduct` that allows rejecting already-rejected or archived products, a pagination cursor direction bug in `listForModeration` that skips pages, an unhandled `shutdown` error path that can leave the process running after a failed `worker.close()`, and a ZodError that surfaces raw validation details in production through the global error handler instead of a structured 400 response.

---

## Critical Issues

### CR-01: `rejectProduct` lacks a state guard — can reject any product status

**File:** `apps/api/src/modules/catalog/ProductService.ts:399-434`

**Issue:** `rejectProduct` checks `wasApproved = product.status === "approved"` to decide whether to enqueue an OpenSearch delete job, but it never validates that the product is actually in `pending_review` status before writing. An admin can call `POST /admin/products/:id/reject` on a product that is `draft`, `rejected`, or `archived`, silently overwriting the status to `rejected` with a new rejection reason, with no `ProductStateError` thrown and no `400`/`422` response. Contrast with `approveProduct` at line 367 which correctly guards `if (product.status !== "pending_review")`.

The `wasApproved` branch is also wrong on its face: if an `approved` product (already indexed) is somehow directly sent to `rejectProduct`, the delete job fires, which is the only correct path — but the intent stated in the JSDoc and D-13 is that `rejectProduct` handles `pending_review → rejected`. An `approved` product is not in the moderation queue and this transition is logically invalid. The route has no safeguard either: `adminProductRoutes` at line 131 passes `request.params.id` to `rejectProduct` directly after only validating the body.

**Fix:**
```typescript
const product = rows[0];
if (!product) throw new ProductNotFoundError();

// Guard: only pending_review products can be rejected (D-08, state machine)
if (product.status !== "pending_review") {
  throw new ProductStateError(
    `Only pending_review products can be rejected. Current status: ${product.status}`
  );
}
```

---

### CR-02: `listForModeration` pagination cursor uses `DESC` ordering but `lt` (less-than) predicate — pages do not advance

**File:** `apps/api/src/modules/catalog/ProductService.ts:548-576`

**Issue:** The JSDoc at line 524 states the queue is "Ordered by createdAt ASC so oldest submissions appear first." However the query at line 565 uses `.orderBy(desc(products.createdAt), desc(products.id))`. This inconsistency alone is a documentation bug, but the cursor predicate is the critical defect.

When ordering `DESC`, a cursor at position `(createdAt=T, id=X)` must fetch rows where `createdAt < T OR (createdAt = T AND id < X)` — which is exactly what lines 556-561 implement with `lt`. For `DESC` ordering and moving forward through pages, this is correct. However, the JSDoc says ASC. Picking one or the other creates two sub-bugs:

1. **If intent is ASC (oldest first — correct for a moderation queue):** The query must use `.orderBy(asc(products.createdAt), asc(products.id))` and the cursor predicate must use `gt` (greater-than), not `lt`. With the current `DESC` + `lt`, the caller always receives the newest pending items first, then each subsequent page goes further back in time — which is functionally backward for a review queue where admins should see the oldest submissions first.

2. **If intent is DESC (newest first):** The JSDoc and the comment at line 524 are wrong, but the implementation is internally consistent.

The practical consequence: if `CATALOG_AUTO_APPROVE` is off and many products pile up, the oldest items are never surfaced on page 1. The moderation queue exhibits LIFO instead of FIFO behavior, meaning the oldest-submitted products never get reviewed.

**Fix (FIFO — oldest first, consistent with JSDoc):**
```typescript
import { asc, and, eq, gt, or } from "drizzle-orm";

// In listForModeration, cursor predicate:
cursorObj
  ? and(
      eq(products.status, "pending_review"),
      or(
        gt(products.createdAt, cursorObj.createdAt),
        and(
          eq(products.createdAt, cursorObj.createdAt),
          gt(products.id, cursorObj.id)
        )
      )
    )
  : eq(products.status, "pending_review")

// Order:
.orderBy(asc(products.createdAt), asc(products.id))
```

---

### CR-03: `shutdown` error in `worker.close()` or `fastify.close()` causes unhandled rejection — process stays alive

**File:** `apps/api/src/main.ts:50-65`

**Issue:** The `shutdown` function is declared `async` and registered via `process.on("SIGINT", () => { void shutdown("SIGINT"); })`. The `void` keyword discards the returned promise entirely. If `worker.close()` (line 55) or `fastify.close()` (line 59) rejects — for example when Redis is unreachable at shutdown time, or BullMQ times out draining in-flight jobs — the error propagates into the discarded promise as an unhandled rejection. Node.js 22 treats unhandled promise rejections as fatal by default (exits with code 1), but the `process.exit(0)` at line 61 is never reached, which means:

- On platforms that do NOT crash on unhandled rejection, the process stays alive in a half-closed state (HTTP server closed but process still running), blocking port reuse.
- The `worker.close()` call has no timeout, so if jobs are stuck the process hangs indefinitely at shutdown.

Additionally, a second SIGTERM arriving during shutdown starts a second concurrent `shutdown()` invocation because there is no guard, which can call `fastify.close()` twice.

**Fix:**
```typescript
let shuttingDown = false;

const shutdown = async (signal: string) => {
  if (shuttingDown) return;
  shuttingDown = true;
  fastify.log.info(`Received ${signal} — shutting down gracefully`);
  try {
    if (worker) {
      await worker.close();
      fastify.log.info("ProductIndexWorker closed");
    }
    await fastify.close();
    fastify.log.info("Server closed");
    process.exit(0);
  } catch (err) {
    fastify.log.error(err, "Error during shutdown — forcing exit");
    process.exit(1);
  }
};

process.on("SIGINT", () => { void shutdown("SIGINT"); });
process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
```

---

### CR-04: ZodError thrown from route handlers reaches `app.ts` global error handler and leaks full validation detail in production

**File:** `apps/api/src/app.ts:73-92` / `apps/api/src/routes/vendor/products.ts:94` / `apps/api/src/routes/admin/products.ts:126`

**Issue:** Route handlers call `Schema.parse(request.body)` (e.g., `CreateProductInputSchema.parse(request.body)` at vendor/products.ts:94, `RejectProductInputSchema.parse(request.body)` at admin/products.ts:126, and all Zod `.parse()` calls in vendor/auth.ts and search.ts). When Zod validation fails, a `ZodError` is thrown. The Fastify error handler in `app.ts` at line 73 receives a `FastifyError`, not a `ZodError`. A `ZodError` does not have `.statusCode`, so the handler falls through to status 500 (line 87-89: `error.statusCode` is `undefined`, condition is false), and in production the message is suppressed to "An unexpected error occurred" — which returns 500 for what should be 400.

Worse: in non-production, the raw `error.message` of a `ZodError` contains the full validation path tree (field names, expected types, received values). This leaks internal schema structure. More critically, the 500 status code for bad client input violates HTTP semantics and will confuse clients.

The `admin/categories.ts` already has a local `ZodError` catch pattern (line 307) but the Phase 3 routes do not follow it.

**Fix — add ZodError handling in the global error handler in `app.ts`:**
```typescript
import { ZodError } from "zod";

fastify.setErrorHandler((error: FastifyError | ZodError, _req, reply) => {
  fastify.log.error(error);
  const isProd = process.env["NODE_ENV"] === "production";

  // ZodError: bad client input — always 400, structured message
  if (error instanceof ZodError) {
    return reply.status(400).send({
      success: false,
      error: {
        code: "VALIDATION_ERROR",
        message: isProd
          ? "Invalid request parameters"
          : error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
      },
    });
  }

  // ... existing FastifyError handling
});
```

---

## Warnings

### WR-01: `vendorId` extracted from JWT is cast without validation — `undefined` silently propagates if JWT payload is malformed

**File:** `apps/api/src/middleware/vendorAuth.ts:49`

**Issue:** `request.vendorId = payload["vendorId"] as string;` casts whatever is in the payload. If a JWT was issued without a `vendorId` claim (e.g., a manually crafted token with a valid signature but missing the field), `payload["vendorId"]` is `undefined` and gets stored as `undefined` on `request.vendorId`. The TypeScript type is `string | undefined`, so all route handlers using `request.vendorId!` (non-null assertion) suppress this silently. The Drizzle `eq(products.vendorId, vendorId)` query then receives `undefined`, which may generate a runtime query error or match no rows, causing confusing 403/404 responses instead of a clean 401.

**Fix:**
```typescript
const rawVendorId = payload["vendorId"];
if (typeof rawVendorId !== "string" || rawVendorId.length === 0) {
  throw new Error("Token is missing vendorId claim.");
}
request.vendorId = rawVendorId;
```

---

### WR-02: `Number(query.limit)` produces `NaN` for non-numeric strings — `Math.min(Math.max(1, NaN), 100)` returns `NaN`

**File:** `apps/api/src/routes/vendor/products.ts:111` / `apps/api/src/routes/admin/products.ts:78`

**Issue:** Both list endpoints cast query params with `Number(query.limit)`. When `query.limit` is a non-numeric string (e.g., `?limit=abc`), `Number("abc")` is `NaN`. `Math.min(Math.max(1, NaN), 100)` evaluates to `NaN` because any comparison with `NaN` returns `false` and `Math.max` short-circuits. The `NaN` limit is then passed to `productService.listVendorProducts(…, NaN)` or `listForModeration(NaN)`. Inside the service, `Math.min(Math.max(1, NaN), 100)` again produces `NaN`, and Drizzle's `.limit(NaN)` either throws or sends a malformed SQL query.

**Fix:**
```typescript
const rawLimit = Number(query.limit);
const limit = Number.isFinite(rawLimit)
  ? Math.min(Math.max(1, rawLimit), 100)
  : 20;
```

---

### WR-03: `archiveProduct` enqueues a delete index job even for products that were never approved/indexed

**File:** `apps/api/src/modules/catalog/ProductService.ts:464-470`

**Issue:** `archiveProduct` always enqueues `{ action: "delete" }` to the product index queue, regardless of whether the product was ever `approved` and indexed in OpenSearch. A product that is still in `draft` or `rejected` status has never been indexed. This creates unnecessary noise in the queue and wasted BullMQ job executions. While `processProductIndexJob` handles 404 from OpenSearch gracefully (line 141-144 in `product-index-job.ts`), the jobs consume worker capacity and inflate queue metrics. More critically, this is inconsistent with how `rejectProduct` correctly gates the enqueue on `wasApproved`.

**Fix:**
```typescript
const [updated] = await db
  .update(products)
  .set({ archivedAt: new Date(), updatedAt: new Date() })
  .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
  .returning();

// Only enqueue delete if product was ever approved (i.e., indexed in OpenSearch)
if (product.status === "approved") {
  await productIndexQueue.add(
    "index",
    { productId: id, action: "delete" },
    { attempts: 3, backoff: { type: "exponential", delay: 1000 } }
  );
}
```

---

### WR-04: `resolveSlug` is a busy-loop with no iteration cap — a burst of similarly-named products causes indefinite looping

**File:** `apps/api/src/modules/catalog/ProductService.ts:762-784`

**Issue:** `resolveSlug` uses `while (true)` with no upper bound. Each iteration performs a database roundtrip. If two concurrent `createProduct` calls collide on the same slug after the loop has already advanced (TOCTOU race: both see `slug-2` as available, both insert, one succeeds, the loser restarts at `slug-2`, then checks `slug-3`, etc.), the loop can iterate many times in a high-concurrency burst. For a shared product name popular across many vendors (e.g., "iPhone Case"), this loop could run for a very long time.

There is also no database-level uniqueness guarantee backing the check: if two transactions both read "no row with slug X" and both proceed to insert, one will hit a unique constraint violation that propagates as an unhandled exception since `createProduct` does not catch unique slug violations.

**Fix:** Add an iteration cap and catch the unique constraint error:
```typescript
private async resolveSlug(source: string, excludeId?: string): Promise<string> {
  const { db } = this.deps;
  const base = this.slugify(source);
  let candidate = base;
  let suffix = 2;
  const MAX_ATTEMPTS = 100;

  while (suffix <= MAX_ATTEMPTS + 2) {
    const rows = await db.select().from(products)
      .where(eq(products.slug, candidate)).limit(1);
    const existing = rows[0];
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }

  // Fallback: append a random suffix to guarantee uniqueness
  candidate = `${base}-${Math.random().toString(36).slice(2, 8)}`;
  return candidate;
}
```

---

### WR-05: `workers.ts` uses `console.error` instead of the structured logger

**File:** `apps/api/src/modules/jobs/workers.ts:55`

**Issue:** The `failed` event handler uses `console.error(...)` which bypasses the Fastify/Pino structured logger. In production, this produces unformatted output that won't be captured by log aggregators expecting JSON. The worker was designed to be started with `fastify.log` available (the `db` and `opensearch` dependencies are passed from the fastify instance), but the logger is not threaded through.

**Fix:** Pass `logger` in `ProductIndexWorkerDeps` and use it:
```typescript
interface ProductIndexWorkerDeps {
  db: NodePgDatabase<any>;
  opensearch: Client;
  env: Pick<Env, "NODE_ENV">;
  logger: FastifyBaseLogger;
}

// In the event handler:
worker.on("failed", (job, err) => {
  deps.logger.error(
    { jobId: job?.id, error: err.message },
    "[ProductIndexWorker] Job failed"
  );
});
```

---

### WR-06: `productIndexQueue` is instantiated at module load time in `queues.ts` — BullMQ connects to Redis before Fastify's Redis plugin initialises

**File:** `apps/api/src/modules/jobs/queues.ts:54`

**Issue:** `export const productIndexQueue = new Queue(...)` executes when the module is first imported. `container.ts` imports from `./modules/jobs/queues.js` at line 10, which runs before `createAppContainer` is called. This means BullMQ attempts a Redis connection at import time, before the Fastify Redis plugin has verified connectivity. If `REDIS_URL` is misconfigured, the error surface is a top-level module initialisation failure rather than a clean startup error with context. More subtly, the queue holds an ioredis connection independent of `fastify.redis` and is never explicitly closed during shutdown — `main.ts` closes the `worker` but not `productIndexQueue` itself.

**Fix:** Close the queue in `shutdown`:
```typescript
// In main.ts shutdown():
if (worker) {
  await worker.close();
}
await productIndexQueue.close(); // drain queue connection
await fastify.close();
```

---

## Info

### IN-01: Admin token guard is evaluated on every request via `process.env` lookup — should cache once at startup

**File:** `apps/api/src/routes/admin/products.ts:56`

**Issue:** The `preHandler` hook reads `process.env["INTERNAL_ADMIN_TOKEN"]` and `process.env["NODE_ENV"]` on every request. In production environments with many admin requests, repeated `process.env` access is not free (it involves a native V8 lookup per invocation). The startup assertion at line 33 already validates that the token is present, so the per-request lookup is redundant. The same pattern exists in `admin/categories.ts`.

**Fix:** Capture the values once during plugin initialisation:
```typescript
const adminToken = process.env["INTERNAL_ADMIN_TOKEN"];
const isProd = process.env["NODE_ENV"] === "production";

fastify.addHook("preHandler", async (request, reply) => {
  if (!isProd) { /* dev bypass */ return; }
  if (!adminToken || request.headers["x-internal-admin-token"] !== adminToken) {
    return reply.status(401).send({ ... });
  }
});
```

---

### IN-02: `submitProduct` feature flag comparison uses fragile string equality `=== "true"`

**File:** `apps/api/src/modules/catalog/ProductService.ts:327`

**Issue:** `autoApproveFlag === "true"` means the flag must be the exact string `"true"`. If the flag value is stored as `"1"`, `"yes"`, `"TRUE"`, or a boolean-coerced value, auto-approve silently fails and all products go through manual review with no error or warning. Other feature flag reads in the codebase may differ in semantics. This is a correctness risk that is invisible at runtime.

**Fix:** Normalise comparison:
```typescript
const newStatus = autoApproveFlag?.toLowerCase() === "true" ? "approved" : "pending_review";
```

---

### IN-03: `search.ts` silently drops invalid `filters` JSON — caller receives no feedback

**File:** `apps/api/src/routes/search.ts:49-58`

**Issue:** When `params.filters` contains syntactically invalid JSON, the catch block at line 56 ignores it silently and proceeds with `appliedFilters = []`. From the caller's perspective, passing `?filters=notjson` returns successful results with no filters applied, with no indication that the filters were ignored. This is likely to cause silent debugging sessions for API consumers.

**Fix:** Return a 400 error for unparseable filter JSON:
```typescript
if (params.filters) {
  try {
    const parsed = JSON.parse(params.filters) as Record<string, string>;
    appliedFilters = Object.entries(parsed).map(([key, value]) => ({ key, value }));
  } catch {
    return reply.status(400).send({
      success: false,
      error: { code: "INVALID_FILTERS", message: "filters must be a valid JSON object string." },
    });
  }
}
```

---

_Reviewed: 2026-06-01T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
