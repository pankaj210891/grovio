# Phase 3: Catalog & Search - Pattern Map

**Mapped:** 2026-05-31
**Files analyzed:** 29 new/modified files
**Analogs found:** 27 / 29

---

## File Classification

| New / Modified File | Role | Data Flow | Closest Analog | Match Quality |
|---------------------|------|-----------|----------------|---------------|
| `apps/api/src/db/schema/vendors.ts` | model | CRUD | `apps/api/src/db/schema/categories.ts` | role-match |
| `apps/api/src/db/schema/products.ts` | model | CRUD | `apps/api/src/db/schema/attribute-definitions.ts` | role-match |
| `apps/api/src/db/schema/product-variants.ts` | model | CRUD | `apps/api/src/db/schema/filter-schema-definitions.ts` | role-match |
| `apps/api/src/db/schema/product-images.ts` | model | CRUD | `apps/api/src/db/schema/filter-schema-definitions.ts` | role-match |
| `apps/api/src/db/schema/index.ts` | config | CRUD | `apps/api/src/db/schema/index.ts` | exact |
| `apps/api/src/modules/vendor-auth/VendorAuthService.ts` | service | request-response | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` | test | request-response | `apps/api/src/modules/categories/CategoryService.test.ts` | exact |
| `apps/api/src/modules/vendor-auth/index.ts` | config | — | `apps/api/src/modules/categories/index.ts` | exact |
| `apps/api/src/modules/catalog/ProductService.ts` | service | CRUD | `apps/api/src/modules/categories/CategoryService.ts` | exact |
| `apps/api/src/modules/catalog/ProductService.test.ts` | test | CRUD | `apps/api/src/modules/categories/CategoryService.test.ts` | exact |
| `apps/api/src/modules/catalog/ImageService.ts` | service | file-I/O | `apps/api/src/modules/categories/CategoryService.ts` | role-match |
| `apps/api/src/modules/catalog/ImageService.test.ts` | test | file-I/O | `apps/api/src/modules/categories/CategoryService.test.ts` | role-match |
| `apps/api/src/modules/catalog/index.ts` | config | — | `apps/api/src/modules/categories/index.ts` | exact |
| `apps/api/src/modules/search/SearchService.ts` | service | request-response | `apps/api/src/modules/filter-schema/FilterSchemaService.ts` | role-match |
| `apps/api/src/modules/search/SearchService.test.ts` | test | request-response | `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts` | role-match |
| `apps/api/src/modules/search/opensearch-client.ts` | utility | request-response | `apps/api/src/plugins/redis.ts` | partial-match |
| `apps/api/src/modules/search/index.ts` | config | — | `apps/api/src/modules/categories/index.ts` | exact |
| `apps/api/src/modules/jobs/queues.ts` | utility | event-driven | `apps/api/src/plugins/redis.ts` | partial-match |
| `apps/api/src/modules/jobs/workers.ts` | utility | event-driven | `apps/api/src/plugins/redis.ts` | partial-match |
| `apps/api/src/modules/jobs/product-index-job.ts` | service | event-driven | `apps/api/src/modules/filter-schema/FilterSchemaService.ts` | partial-match |
| `apps/api/src/modules/jobs/product-index-job.test.ts` | test | event-driven | `apps/api/src/modules/categories/CategoryService.test.ts` | role-match |
| `apps/api/src/modules/jobs/index.ts` | config | — | `apps/api/src/modules/categories/index.ts` | exact |
| `apps/api/src/plugins/opensearch.ts` | middleware | request-response | `apps/api/src/plugins/redis.ts` | exact |
| `apps/api/src/routes/vendor/products.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | exact |
| `apps/api/src/routes/admin/products.ts` | route | CRUD | `apps/api/src/routes/admin/categories.ts` | exact |
| `apps/api/src/routes/search.ts` | route | request-response | `apps/api/src/routes/categories.ts` | role-match |
| `apps/api/src/container.ts` | config | CRUD | `apps/api/src/container.ts` | exact |
| `packages/contracts/src/catalog/product.ts` | model | CRUD | `packages/contracts/src/category/attribute-definition.ts` | exact |
| `packages/contracts/src/catalog/variant.ts` | model | CRUD | `packages/contracts/src/category/filter-schema.ts` | exact |
| `packages/contracts/src/catalog/image.ts` | model | file-I/O | `packages/contracts/src/category/attribute-definition.ts` | role-match |
| `packages/contracts/src/catalog/index.ts` | config | — | `packages/contracts/src/category/index.ts` | exact |
| `packages/contracts/src/search/query.ts` | model | request-response | `packages/contracts/src/category/filter-schema.ts` | role-match |
| `packages/contracts/src/search/suggest.ts` | model | request-response | `packages/contracts/src/category/filter-schema.ts` | role-match |
| `packages/contracts/src/search/filter.ts` | model | request-response | `packages/contracts/src/category/filter-schema.ts` | role-match |
| `packages/contracts/src/search/index.ts` | config | — | `packages/contracts/src/category/index.ts` | exact |
| `packages/contracts/src/index.ts` | config | — | `packages/contracts/src/index.ts` | exact |
| `apps/api/src/config/env.ts` | config | — | `apps/api/src/config/env.ts` | exact |
| `apps/api/src/app.ts` | config | — | `apps/api/src/app.ts` | exact |
| `apps/api/src/types/fastify.d.ts` | config | — | `apps/api/src/types/fastify.d.ts` | exact |

---

## Pattern Assignments

### `apps/api/src/db/schema/vendors.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/categories.ts`

**Imports pattern** (lines 1-9 of categories.ts):
```typescript
import {
  AnyPgColumn,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
```

**Core schema pattern** (lines 25-78 of categories.ts) — pgTable + uuid PK + timestamps + InferInsert/InferSelect exports:
```typescript
export const categories = pgTable("categories", {
  id: uuid("id").defaultRandom().primaryKey(),
  // ... columns
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertCategory = typeof categories.$inferInsert;
export type SelectCategory = typeof categories.$inferSelect;
```

**Adaptation for vendors.ts:** Replace `categories` with `vendors`. Add `email text NOT NULL UNIQUE`, `passwordHash text NOT NULL`, `name text NOT NULL`, `archivedAt timestamp`. No pgEnum needed. Reference the categories.ts column naming convention (`camelCase` property → `snake_case` column name string).

---

### `apps/api/src/db/schema/products.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/attribute-definitions.ts`

**Imports pattern** (lines 1-13 of attribute-definitions.ts):
```typescript
import {
  boolean,
  integer,
  jsonb,
  pgEnum,
  pgTable,
  text,
  timestamp,
  unique,
  uuid,
} from "drizzle-orm/pg-core";
import type { AttributeOption } from "@grovio/contracts";
import { categories } from "./categories.js";
```

**pgEnum pattern** (lines 22-29 of attribute-definitions.ts) — used for `productStatusEnum`:
```typescript
export const attrTypeEnum = pgEnum("attr_type", [
  "text",
  "textarea",
  "number",
  "boolean",
  "enum",
  "multi_select",
]);
```
Copy this pattern for:
```typescript
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);
```

**JSONB column with typed .$type()** (lines 83 of attribute-definitions.ts):
```typescript
options: jsonb("options").$type<AttributeOption[]>(),
```
Apply same pattern to `attributes` column:
```typescript
attributes: jsonb("attributes").$type<Record<string, unknown>>().notNull().default({}),
```

**FK with cascade** (lines 57-59 of attribute-definitions.ts):
```typescript
categoryId: uuid("category_id")
  .notNull()
  .references(() => categories.id, { onDelete: "cascade" }),
```

**Adaptation for products.ts:**
- Add `productStatusEnum` for `status` column
- Add `basePriceMinor: bigint("base_price_minor", { mode: "number" })` (BIGINT for money — never DECIMAL/FLOAT per CLAUDE.md)
- Add `slug text NOT NULL UNIQUE`
- Add `archivedAt` for soft-delete
- Add `rejectionReason text` (nullable; non-null only when status = "rejected")
- FK to `vendors.id` (cascade delete) and `categories.id` (cascade delete)
- GIN index on `attributes` JSONB: `.withGinIndex()` or raw DDL in migration

---

### `apps/api/src/db/schema/product-variants.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/filter-schema-definitions.ts`

**Pattern** (lines 46-84 of filter-schema-definitions.ts) — child table with FK + unique constraint:
```typescript
export const filterSchemaDefinitions = pgTable(
  "filter_schema_definitions",
  {
    id: uuid("id").defaultRandom().primaryKey(),
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),
    attributeDefId: uuid("attribute_def_id")
      .notNull()
      .references(() => attributeDefinitions.id, { onDelete: "cascade" }),
    displayType: filterDisplayTypeEnum("display_type").notNull(),
    sortOrder: integer("sort_order").notNull().default(0),
    createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  },
  (t) => [unique().on(t.categoryId, t.attributeDefId)]
);
```

**Adaptation for product-variants.ts:**
- FK: `productId` → `products.id` with `{ onDelete: "cascade" }`
- Columns: `sku text NOT NULL`, `priceMinor bigint NOT NULL`, `optionValues jsonb NOT NULL`, `sortOrder integer`
- Add `updatedAt timestamp` (unlike filter-schema-definitions which has no updatedAt)
- No unique constraint needed (variants are positional, not logically unique)

---

### `apps/api/src/db/schema/product-images.ts` (model, file-I/O)

**Analog:** `apps/api/src/db/schema/filter-schema-definitions.ts`

**Pattern:** Same child-table-with-FK pattern. Copy from filter-schema-definitions.ts.

**Adaptation for product-images.ts:**
- FK: `productId` → `products.id` with `{ onDelete: "cascade" }`
- Columns: `url text NOT NULL`, `sortOrder integer NOT NULL DEFAULT 0`, `altText text`
- No `updatedAt` (images are create-then-delete, not updated)

---

### `apps/api/src/db/schema/index.ts` (config, CRUD)

**Analog:** `apps/api/src/db/schema/index.ts` (lines 1-27)

**Pattern** (the entire existing file):
```typescript
// Category domain — exported in FK-dependency order (categories first)
export * from "./categories.js";
export * from "./attribute-definitions.js";
// ...other exports
```

**Adaptation:** Add new exports in FK-dependency order:
```typescript
// Catalog domain — vendors before products (FK dependency)
export * from "./vendors.js";
export * from "./products.js";
export * from "./product-variants.js";
export * from "./product-images.js";
```
Insert after the category domain block, before `export * from "./feature-flags.js"`.

---

### `apps/api/src/modules/vendor-auth/VendorAuthService.ts` (service, request-response)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts`

**Deps interface pattern** (lines 7-12 of FeatureFlagService.ts):
```typescript
interface FeatureFlagServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}
```

**Class + constructor pattern** (lines 28-29 of FeatureFlagService.ts):
```typescript
export class FeatureFlagService {
  constructor(private deps: FeatureFlagServiceDeps) {}
```

**Domain error pattern** (lines 22-31 of CategoryService.ts) — copy for `VendorNotFoundError`, `InvalidCredentialsError`:
```typescript
export class CategoryDepthError extends Error {
  readonly code = "CATEGORY_DEPTH_EXCEEDED";
  constructor(message = "...") {
    super(message);
    this.name = "CategoryDepthError";
  }
}
```

**Adaptation for VendorAuthService.ts:**
- Deps: `{ db, env }` (no Redis — JWT is stateless in Phase 3)
- Methods: `register(email, password, name)`, `login(email, password)`, `verifyToken(token)`
- Uses `argon2.hash()` / `argon2.verify()` for password (new package, Phase 3)
- Uses `jose` `SignJWT` / `jwtVerify` for JWT issuance/verification
- JWT payload follows `packages/contracts/src/auth.ts` `JwtPayloadSchema`: `{ sub, role: 'vendor', vendorId }`
- Token TTL: 1 hour (discretion area from CONTEXT.md — follows Phase 1 pattern)

---

### `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` (test, request-response)

**Analog:** `apps/api/src/modules/categories/CategoryService.test.ts`

**Test structure pattern** (lines 1-37 of CategoryService.test.ts):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectCategory } from "../../db/schema/index.js";
import { CategoryService, CategoryDepthError } from "./CategoryService.js";

function makeDbMock(rows: SelectCategory[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: SelectCategory[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  const db = { select: vi.fn().mockReturnValue(awaitableChain) };
  return db;
}
```

**Test describe/it pattern** (lines 128-130 of CategoryService.test.ts):
```typescript
describe("CategoryService", () => {
  describe("getTree", () => {
    it("returns cached tree on Redis hit — no DB query", async () => {
```

**Adaptation for VendorAuthService.test.ts:**
- Mock DB with `select().from().where().limit(1)` chain for vendor lookups
- Mock DB with `insert().values().returning()` for vendor registration
- No Redis mock needed (VendorAuthService is stateless)
- Test cases: register creates vendor with hashed password, login returns JWT, login fails on wrong password, verifyToken returns payload, verifyToken throws on invalid token

---

### `apps/api/src/modules/catalog/ProductService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/categories/CategoryService.ts` — **primary analog**

**Deps interface pattern** (lines 37-42 of CategoryService.ts):
```typescript
interface CategoryServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}
```

**Domain error pattern** (lines 22-31 of CategoryService.ts):
```typescript
export class CategoryDepthError extends Error {
  readonly code = "CATEGORY_DEPTH_EXCEEDED";
  constructor(message = "...") {
    super(message);
    this.name = "CategoryDepthError";
  }
}
```

**Slug resolution pattern** (lines 399-449 of CategoryService.ts):
```typescript
private async resolveSlug(source: string, excludeId?: string): Promise<string> {
  const base = this.slugify(source);
  let candidate = base;
  let suffix = 2;
  while (true) {
    const rows = await db.select().from(categories).where(eq(categories.slug, candidate)).limit(1);
    const existing = rows[0];
    if (!existing || existing.id === excludeId) return candidate;
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
}
```

**Soft-delete pattern** (lines 234-249 of CategoryService.ts):
```typescript
async archiveCategory(id: string): Promise<SelectCategory | null> {
  const rows = await db.update(categories)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(eq(categories.id, id))
    .returning();
  const row = rows[0] ?? null;
  if (row) await this.invalidateTree();
  return row;
}
```

**Transaction pattern for multi-row writes** (lines 270-282 of CategoryService.ts):
```typescript
await db.transaction(async (tx) => {
  for (let i = 0; i < orderedIds.length; i++) {
    await tx.update(categories).set({ sortOrder: i, updatedAt: new Date() }).where(eq(categories.id, orderedIds[i]!));
  }
});
```

**Adaptation for ProductService.ts:**
- Deps: `{ db, redis, env, featureFlagService }` — add featureFlagService for `CATALOG_AUTO_APPROVE` check
- Domain errors: `ProductStateError`, `ProductOwnershipError`, `ProductNotFoundError`
- Methods: `createProduct`, `updateProduct` (with pending_review → draft reset), `submitProduct` (with auto-approve flag check), `approveProduct`, `rejectProduct` (rejection_reason required), `archiveProduct`, `getProductById`, `listVendorProducts` (cursor pagination)
- `updateProduct` must check `if (product.status === 'pending_review') set status = 'draft'` before applying updates (D-06)
- `submitProduct` / `approveProduct` must enqueue BullMQ job with `{ productId, action: 'index' }` (D-14)
- `rejectProduct` / `archiveProduct` must enqueue BullMQ job with `{ productId, action: 'delete' }` (D-13)
- All mutations: `updatedAt: new Date()` pattern from CategoryService
- Vendor ownership check: `eq(products.vendorId, authedVendorId)` on every mutation
- Vendor-category restriction check in `createProduct`: check `categories.isRestricted` and `vendor_category_restrictions` (D-18)

---

### `apps/api/src/modules/catalog/ImageService.ts` (service, file-I/O)

**Analog:** `apps/api/src/modules/categories/CategoryService.ts` (structure) + RESEARCH.md Pattern 6 (S3 logic)

**Deps interface pattern** (lines 37-42 of CategoryService.ts):
```typescript
interface CategoryServiceDeps {
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}
```

**DB insert + returning pattern** (lines 183-192 of CategoryService.ts):
```typescript
const [row] = await db.insert(categories).values(insertValues).returning();
return row!;
```

**Adaptation for ImageService.ts:**
- Deps: `{ db, env }` (no Redis needed)
- Methods: `generatePresignedUpload(productId, contentType, vendorId)`, `confirmUpload(productId, key, url, altText)`, `reorderImages(productId, orderedImageIds)`, `deleteImage(imageId, productId)`
- `generatePresignedUpload` validates `MAX_IMAGES_PER_PRODUCT` count (env var, default 8) before returning URL
- `generatePresignedUpload` returns `{ uploadUrl, cdnUrl, key }` — only `confirmUpload` writes to DB
- Ownership check: load product row and verify `vendorId` matches before any mutation
- S3 client initialized from env vars: `S3_BUCKET_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`, `S3_BUCKET_NAME`, `S3_PUBLIC_URL`

---

### `apps/api/src/modules/search/SearchService.ts` (service, request-response)

**Analog:** `apps/api/src/modules/filter-schema/FilterSchemaService.ts` (structure) + RESEARCH.md Pattern 5 (query logic)

**Deps interface pattern** (lines 15-18 of FilterSchemaService.ts):
```typescript
interface FilterSchemaServiceDeps {
  db: NodePgDatabase<any>;
}
```

**Service with joined query pattern** (lines 67-103 of FilterSchemaService.ts):
```typescript
async getFilterSchema(categoryId: string): Promise<FilterSchemaDef[]> {
  const rows = await db.select({ ... }).from(filterSchemaDefinitions)
    .innerJoin(attributeDefinitions, eq(...))
    .where(eq(filterSchemaDefinitions.categoryId, categoryId))
    .orderBy(asc(filterSchemaDefinitions.sortOrder));
  return rows.map((row) => ({ ... }));
}
```

**Redis cache pattern** (lines 39-58 of FeatureFlagService.ts):
```typescript
const cached = await redis.get(this.redisKey(key));
if (cached !== null) return JSON.parse(cached) as ...;
// DB fallback
await redis.setex(this.redisKey(key), env.FEATURE_FLAG_TTL_SECONDS, JSON.stringify(value));
```

**Adaptation for SearchService.ts:**
- Deps: `{ db, redis, env, opensearch }` (opensearch = Client from `@opensearch-project/opensearch`)
- Methods: `search(params)`, `suggest(q)`, `buildFacetQuery(categoryId)`, `getFilterSchema(categoryId)` (Redis-cached under `category_filter_schema:{categoryId}`)
- `search()` uses `post_filter` pattern from RESEARCH.md Pattern 5 for faceted filtering
- `suggest()` queries `search_as_you_type` fields on both product name and category name
- Graceful degradation: if `opensearch` dep is `null`/`undefined`, return empty results with a 503 flag
- Cache invalidation: `invalidateFilterSchemaCache(categoryId)` called by FilterSchemaService after `replaceFilterSchema()`

---

### `apps/api/src/plugins/opensearch.ts` (middleware, request-response)

**Analog:** `apps/api/src/plugins/redis.ts` — **exact pattern**

**Complete pattern** (entire redis.ts, lines 1-65):
```typescript
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const redisPlugin = fp(
  async (fastify) => {
    // conditional check (optional dependency)
    const redis = new Redis(env.REDIS_URL, { lazyConnect: true, ... });
    try {
      await redis.connect();
      await redis.ping();
    } catch (err) {
      await redis.quit();
      throw err;
    }
    fastify.decorate("redis", redis);
    fastify.addHook("onClose", async () => { await redis.quit(); });
    fastify.log.info(`Redis client connected (tls=${isTls})`);
  },
  { name: "redis" },
);
export default redisPlugin;
```

**Adaptation for opensearch.ts:**
```typescript
import fp from "fastify-plugin";
import { Client } from "@opensearch-project/opensearch";
import { env } from "../config/env.js";

const opensearchPlugin = fp(async (fastify) => {
  if (!env.OPENSEARCH_URL) {
    fastify.log.warn("OPENSEARCH_URL not set — search features disabled");
    fastify.decorate("opensearch", null);
    return;
  }
  const client = new Client({ node: env.OPENSEARCH_URL });
  fastify.decorate("opensearch", client);
  fastify.addHook("onClose", async () => { await client.close(); });
  fastify.log.info("OpenSearch client connected");
}, { name: "opensearch" });
export default opensearchPlugin;
```

Key difference from redis.ts: `OPENSEARCH_URL` is optional (boots without it), so the plugin decorates with `null` instead of throwing. This matches the existing `env.ts` where `OPENSEARCH_URL` is `z.string().url().optional()`.

---

### `apps/api/src/modules/jobs/queues.ts` (utility, event-driven)

**Analog:** `apps/api/src/plugins/redis.ts` (connection pattern) + RESEARCH.md Pitfall 1 (separate ioredis connection)

**Connection config pattern** (lines 28-39 of redis.ts) — adapted for BullMQ:
```typescript
const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: false,
  ...(isTls ? { tls: { rejectUnauthorized: env.NODE_ENV === "production" } } : {}),
});
```

**Critical BullMQ adaptation (RESEARCH.md Pitfall 1):** The BullMQ connection MUST be a separate ioredis instance with `maxRetriesPerRequest: null`. Do NOT pass `fastify.redis` to `new Queue()`.

```typescript
// CRITICAL: separate connection, not fastify.redis
const bullRedis = new Redis(env.REDIS_URL, {
  maxRetriesPerRequest: null,   // required by BullMQ blocking commands
  enableReadyCheck: false,
  ...(isTls ? { tls: { rejectUnauthorized: env.NODE_ENV === "production" } } : {}),
});
export const productIndexQueue = new Queue("product-index-queue", {
  connection: bullRedis,
});
```

---

### `apps/api/src/modules/jobs/workers.ts` (utility, event-driven)

**Analog:** RESEARCH.md Pattern 3 (BullMQ Worker pattern) + `apps/api/src/plugins/redis.ts` (connection lifecycle)

**Worker instantiation pattern** from RESEARCH.md:
```typescript
const worker = new Worker("product-index-queue", processProductIndexJob, {
  connection: bullRedis,   // same separate connection as queues.ts
  concurrency: 3,
});
worker.on("failed", (job, err) => { logger.error({ jobId: job?.id }, err.message); });
```

**Start-after-listen pattern** (RESEARCH.md Open Question 1): Worker is started in `main.ts` after `fastify.listen()`, not in `buildApp()`, so HTTP server starts cleanly first.

---

### `apps/api/src/modules/jobs/product-index-job.ts` (service, event-driven)

**Analog:** `apps/api/src/modules/filter-schema/FilterSchemaService.ts` (DB read with join) + RESEARCH.md Pattern 3

**Join query pattern** (lines 67-103 of FilterSchemaService.ts) — read product + variants + searchable attributes:
```typescript
const rows = await db.select({ ... })
  .from(filterSchemaDefinitions)
  .innerJoin(attributeDefinitions, eq(...))
  .where(eq(...))
  .orderBy(asc(...));
```

**Adaptation for product-index-job.ts:**
- Function signature: `async function processProductIndexJob(job: Job): Promise<void>`
- Reads `job.data: { productId: string, action: 'index' | 'delete' }`
- For `action: 'delete'`: call `opensearch.delete({ index, id: productId })`
- For `action: 'index'`: query product + variants + category's `attributeDefinitions` where `isSearchable=true` only (Anti-Pattern 6 guard from ARCHITECTURE.md)
- Build document from filtered attributes only — never from raw `product.attributes` JSONB keys
- Index name: `grovio-products-${env.NODE_ENV}`

---

### `apps/api/src/routes/vendor/products.ts` (route, CRUD)

**Analog:** `apps/api/src/routes/admin/categories.ts` — **exact pattern**

**Plugin function signature** (line 41-43 of admin/categories.ts):
```typescript
export async function adminCategoryRoutes(fastify: FastifyInstance): Promise<void> {
```

**preHandler guard pattern** (lines 59-82 of admin/categories.ts):
```typescript
fastify.addHook("preHandler", async (request, reply) => {
  const isProd = process.env["NODE_ENV"] === "production";
  if (!isProd) { fastify.log.warn(...); return; }
  const adminToken = process.env["INTERNAL_ADMIN_TOKEN"];
  const headerToken = request.headers["x-internal-admin-token"];
  if (!adminToken || headerToken !== adminToken) {
    return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", ... } });
  }
});
```

**Route handler pattern with Zod parse + service call + error mapping** (lines 86-101 of admin/categories.ts):
```typescript
fastify.post("/admin/categories", async (request, reply) => {
  const body = CreateCategoryInputSchema.parse(request.body);
  const categoryService = fastify.diContainer.resolve<CategoryService>("categoryService");
  try {
    const created = await categoryService.createCategory(body);
    return reply.status(201).send({ success: true, data: created });
  } catch (err) {
    if (err instanceof CategoryDepthError) {
      return reply.status(422).send({ success: false, error: { code: err.code, message: err.message } });
    }
    throw err;
  }
});
```

**404 not-found pattern** (lines 104-123 of admin/categories.ts):
```typescript
if (!updated) {
  return reply.status(404).send({ success: false, error: { code: "CATEGORY_NOT_FOUND", message: "..." } });
}
```

**Adaptation for routes/vendor/products.ts:**
- Replace admin token guard with vendor JWT `preHandler` that calls `jwtVerify()` and sets `request.vendorId`
- All routes prefixed `/vendor/products`
- Routes: `POST /vendor/products`, `PATCH /vendor/products/:id`, `PUT /vendor/products/:id/submit`, `DELETE /vendor/products/:id/archive`, `GET /vendor/products`, `GET /vendor/products/:id`
- Image sub-routes: `POST /vendor/products/:id/images/presign`, `POST /vendor/products/:id/images/confirm`, `DELETE /vendor/products/:id/images/:imageId`, `PATCH /vendor/products/:id/images/reorder`
- Variant sub-routes: `POST /vendor/products/:id/variants`, `PATCH /vendor/products/:id/variants/:variantId`, `DELETE /vendor/products/:id/variants/:variantId`
- Error code mapping: `ProductStateError` → 422, `ProductOwnershipError` → 403, `ProductNotFoundError` → 404

---

### `apps/api/src/routes/admin/products.ts` (route, CRUD)

**Analog:** `apps/api/src/routes/admin/categories.ts` — **exact pattern**

**Admin guard pattern** (lines 46-82 of admin/categories.ts): identical admin token guard. Copy verbatim.

**Route handler pattern**: Copy the Zod parse + resolve + service call + domain error mapping structure.

**Adaptation for routes/admin/products.ts:**
- Routes: `GET /admin/products` (moderation queue, status=pending_review), `POST /admin/products/:id/approve`, `POST /admin/products/:id/reject`
- `reject` requires body `{ rejectionReason: string }` (D-08) — Zod: `z.object({ rejectionReason: z.string().min(1) })`
- Resolve `productService` from DI container (same `fastify.diContainer.resolve` pattern)

---

### `apps/api/src/routes/search.ts` (route, request-response)

**Analog:** `apps/api/src/routes/categories.ts` — **exact pattern** (public read routes)

**Plugin function + GET handler pattern** (lines 26-57 of categories.ts):
```typescript
export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.get("/categories", async (_request, reply) => {
    const categoryService = fastify.diContainer.resolve<CategoryService>("categoryService");
    const tree = await categoryService.getTree();
    return reply.send({ success: true, data: { tree } });
  });
}
```

**Query param pattern** (lines 38-57 of categories.ts) — single route, no body:
```typescript
fastify.get<{ Params: { id: string } }>("/categories/:id", async (request, reply) => {
```

**Adaptation for routes/search.ts:**
- Routes: `GET /search`, `GET /search/suggest`, `GET /categories/:id/filters` (extends existing categories.ts)
- Query params validated via Zod before passing to SearchService: `z.object({ q: z.string().optional(), categoryId: z.string().uuid().optional(), filters: z.string().optional(), sort: z.string().optional(), limit: z.coerce.number().default(20), cursor: z.string().optional() })`
- Graceful degradation: if `searchService.isAvailable()` is false, return 503 with `{ success: false, error: { code: 'SEARCH_UNAVAILABLE', message: '...' } }`
- `GET /categories/:id/filters` should be added to the EXISTING `apps/api/src/routes/categories.ts` (not a new file), resolving `searchService` for the Redis-cached filter schema

---

### `apps/api/src/container.ts` (config, CRUD)

**Analog:** `apps/api/src/container.ts` (entire file, lines 1-52) — **extend in place**

**Registration pattern** (lines 30-47 of container.ts):
```typescript
container.register({
  db: asValue(fastify.db),
  redis: asValue(fastify.redis),
  logger: asValue(fastify.log),
  env: asValue(env),
});

container.register({
  featureFlagService: asClass(FeatureFlagService).singleton(),
  categoryService: asClass(CategoryService).singleton(),
  // ...
});
```

**Adaptation:** Add to the infrastructure values block:
```typescript
opensearch: asValue(fastify.opensearch),  // null if OPENSEARCH_URL not set
productIndexQueue: asValue(productIndexQueue),  // BullMQ Queue instance from modules/jobs/queues.ts
```
Add to the domain services block:
```typescript
vendorAuthService: asClass(VendorAuthService).singleton(),
productService: asClass(ProductService).singleton(),
imageService: asClass(ImageService).singleton(),
searchService: asClass(SearchService).singleton(),
```

---

### `apps/api/src/config/env.ts` (config, extend in place)

**Analog:** `apps/api/src/config/env.ts` (entire file, lines 1-107)

**Env var pattern** (lines 55-70 of env.ts) — optional URL with comment:
```typescript
OPENSEARCH_URL: z.string().url().optional(),
```

**Coerce number with default pattern** (lines 84-97 of env.ts):
```typescript
FEATURE_FLAG_TTL_SECONDS: z.coerce.number().default(60),
CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300),
```

**Adaptation:** Add to envSchema:
```typescript
// S3 / Cloudflare R2 — required for image upload flow (Phase 3)
S3_BUCKET_URL: z.string().url().optional(),
S3_ACCESS_KEY_ID: z.string().optional(),
S3_SECRET_ACCESS_KEY: z.string().optional(),
S3_REGION: z.string().default("auto"),
S3_BUCKET_NAME: z.string().optional(),
S3_PUBLIC_URL: z.string().url().optional(),
// Image upload constraints
MAX_IMAGES_PER_PRODUCT: z.coerce.number().default(8),
MAX_IMAGE_SIZE_BYTES: z.coerce.number().default(5242880),
// Filter schema cache TTL (Redis)
FILTER_SCHEMA_TTL_SECONDS: z.coerce.number().default(300),
```

---

### `apps/api/src/types/fastify.d.ts` (config, extend in place)

**Analog:** `apps/api/src/types/fastify.d.ts` (entire file, lines 1-26)

**Declaration pattern** (lines 12-25 of fastify.d.ts):
```typescript
declare module "fastify" {
  interface FastifyInstance {
    db: NodePgDatabase<any>;
    redis: Redis;
    diContainer: AwilixContainer<any>;
  }
}
```

**Adaptation:** Add:
```typescript
import type { Client as OpenSearchClient } from "@opensearch-project/opensearch";
// In FastifyInstance:
opensearch: OpenSearchClient | null;  // null when OPENSEARCH_URL not configured
```
Also consider adding `vendorId?: string` to `FastifyRequest` for vendor JWT augmentation:
```typescript
declare module "fastify" {
  interface FastifyRequest {
    vendorId?: string;  // set by vendor JWT preHandler
  }
}
```

---

### `apps/api/src/app.ts` (config, extend in place)

**Analog:** `apps/api/src/app.ts` (entire file, lines 1-78)

**Plugin registration order pattern** (lines 33-41 of app.ts):
```typescript
await fastify.register(drizzlePlugin);
await fastify.register(redisPlugin);
await fastify.register(awilixPlugin);
// routes
await fastify.register(healthRoutes);
```

**Adaptation:** Add after `redisPlugin`, before `awilixPlugin`:
```typescript
await fastify.register(opensearchPlugin);  // new — must run before awilix
```
Add routes:
```typescript
await fastify.register(vendorProductRoutes);
await fastify.register(adminProductRoutes);
await fastify.register(searchRoutes);
```

---

### `packages/contracts/src/catalog/product.ts` (model, CRUD)

**Analog:** `packages/contracts/src/category/attribute-definition.ts` — **exact pattern**

**Zod schema pattern** (lines 1-93 of attribute-definition.ts):
```typescript
import { z } from "zod";

export const AttrTypeSchema = z.enum([...]);
export type AttrType = z.infer<typeof AttrTypeSchema>;

export const AttributeDefinitionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  key: z.string().min(1),
  // ...
});
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

export const CreateAttributeInputSchema = z.object({
  key: z.string().min(1),
  // ...
});
export type CreateAttributeInput = z.infer<typeof CreateAttributeInputSchema>;
```

**Adaptation for catalog/product.ts:**
- `ProductStatusSchema = z.enum(["draft", "pending_review", "approved", "rejected"])`
- `ProductSchema` with all product fields including `basePriceMinor: z.number().int()` (integer, never float)
- `CreateProductInputSchema` (omit id, status, createdAt, updatedAt, rejectionReason)
- `UpdateProductInputSchema` (all fields optional, omit status — status is changed via named methods)
- `SubmitProductResponseSchema`, `ApproveProductResponseSchema`, `RejectProductInputSchema` (requires `rejectionReason`)

---

### `packages/contracts/src/catalog/variant.ts` (model, CRUD)

**Analog:** `packages/contracts/src/category/filter-schema.ts`

**Embedded sub-object pattern** (lines 39-57 of filter-schema.ts):
```typescript
export const FilterSchemaDefSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  attribute: AttributeDefinitionSchema.pick({ key: true, label: true, attrType: true, options: true }),
  // ...
});
```

**Adaptation for catalog/variant.ts:**
- `ProductVariantSchema` with `priceMinor: z.number().int()`, `optionValues: z.record(z.string(), z.unknown())`
- `CreateVariantInputSchema` (omit id, productId, createdAt, updatedAt)
- `UpdateVariantInputSchema` (all fields optional)

---

### `packages/contracts/src/catalog/image.ts` (model, file-I/O)

**Analog:** `packages/contracts/src/category/attribute-definition.ts`

**Adaptation for catalog/image.ts:**
- `ProductImageSchema` with `url`, `sortOrder`, `altText` fields
- `PresignImageInputSchema` with `contentType: z.string()` (MIME type), `fileSizeBytes: z.number().int().positive()`
- `PresignImageResponseSchema` with `uploadUrl: z.string().url()`, `cdnUrl: z.string().url()`, `key: z.string()`
- `ConfirmImageUploadInputSchema` with `key: z.string()`, `altText: z.string().optional()`

---

### `packages/contracts/src/catalog/index.ts` (config)

**Analog:** `packages/contracts/src/category/index.ts` (lines 1-16)

**Barrel pattern** (entire file):
```typescript
export * from "./blocks.js";
export * from "./tree.js";
// ...
```

**Adaptation:**
```typescript
export * from "./product.js";
export * from "./variant.js";
export * from "./image.js";
```

---

### `packages/contracts/src/search/query.ts`, `suggest.ts`, `filter.ts` (model, request-response)

**Analog:** `packages/contracts/src/category/filter-schema.ts`

**Pattern:** Zod object + inferred TypeScript type + input schema. Copy the `z.object({ ... })` + `export type X = z.infer<typeof XSchema>` pattern.

**Adaptation for search/query.ts:**
- `SearchQuerySchema`: `{ q, categoryId, filters, sort, limit, cursor }` — all optional
- `SearchHitSchema`: `{ id, name, slug, basePriceMinor, categoryId, vendorId, imageUrl }`
- `SearchResponseSchema`: `{ hits: SearchHitSchema[], total, facets, nextCursor }`
- `FacetSchema`: `{ key, label, values: [{ value, count }][] }`

**Adaptation for search/suggest.ts:**
- `SuggestQuerySchema`: `{ q: z.string().min(2) }`
- `SuggestResponseSchema`: `{ products: [{ id, name, slug }][], categories: [{ id, name, slug }][] }`

**Adaptation for search/filter.ts:**
- `FilterRequestSchema`: `{ categoryId, appliedFilters: [{ key, value }][] }`
- `FacetResultSchema`: wraps existing `FilterSchemaDef` with active counts from OpenSearch aggregations

---

### `packages/contracts/src/index.ts` (config, extend in place)

**Analog:** `packages/contracts/src/index.ts` (lines 1-20)

**Barrel addition pattern** (lines 19 of index.ts):
```typescript
export * from "./category/index.js";
```

**Adaptation:** Add after existing exports:
```typescript
export * from "./catalog/index.js";
export * from "./search/index.js";
```

---

### Module `index.ts` files for vendor-auth, catalog, search, jobs

**Analog:** `apps/api/src/modules/categories/index.ts`

Read `apps/api/src/modules/categories/index.ts` to get the exact re-export pattern (it is a short barrel file). All new module index.ts files follow the same pattern: `export * from "./ServiceName.js"`.

---

### Test files (VendorAuthService.test.ts, ProductService.test.ts, ImageService.test.ts, SearchService.test.ts, product-index-job.test.ts)

**Analog:** `apps/api/src/modules/categories/CategoryService.test.ts` (entire file)

**Key mock helper patterns** (lines 17-80 of CategoryService.test.ts):

```typescript
// SELECT chain mock
function makeDbMock(rows: T[]) {
  return { select: vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve) => resolve(rows), catch: vi.fn(), finally: vi.fn(),
      }),
    }),
  })};
}

// INSERT chain mock
function makeInsertDbMock(returnRow: T) {
  return { insert: vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  })};
}

// UPDATE chain mock
function makeUpdateDbMock(returnRow: T | null) {
  return { update: vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnRow ? [returnRow] : []),
      }),
    }),
  })};
}
```

**Test structure** (lines 128-130 of CategoryService.test.ts):
```typescript
describe("ProductService", () => {
  describe("submitProduct — auto-approve flag", () => {
    it("transitions to approved when CATALOG_AUTO_APPROVE is true", async () => {
```

---

## Shared Patterns

### Vendor JWT preHandler (applies to all `/vendor/*` routes)

**Source:** `packages/contracts/src/auth.ts` (JwtPayloadSchema) + RESEARCH.md Code Examples

**Apply to:** `apps/api/src/routes/vendor/products.ts`

Pattern to copy into `vendor/products.ts` as a module-level function or separate `middleware/vendor-auth.ts`:
```typescript
// apps/api/src/middleware/vendorAuth.ts (new utility)
import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

export async function requireVendorAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Bearer token required" } });
  }
  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload["role"] !== "vendor") throw new Error("Not a vendor token");
    request.vendorId = payload["vendorId"] as string;
  } catch {
    return reply.status(401).send({ success: false, error: { code: "UNAUTHORIZED", message: "Invalid or expired token" } });
  }
}
```

Use as `fastify.addHook("preHandler", requireVendorAuth)` at the top of vendor route plugin.

---

### Admin Token Guard (applies to all `/admin/*` routes)

**Source:** `apps/api/src/routes/admin/categories.ts` lines 46-82

**Apply to:** `apps/api/src/routes/admin/products.ts`

Copy verbatim — the startup assertion + preHandler pattern is identical for all admin route plugins.

---

### Response Envelope

**Source:** `packages/contracts/src/envelope.ts` + all existing routes

**Apply to:** All new route handlers

Success: `reply.status(201).send({ success: true, data: result })`
Error: `reply.status(4xx).send({ success: false, error: { code: "ERROR_CODE", message: "..." } })`
Re-throw unknowns: `throw err` (app.ts error handler catches all unhandled errors)

---

### Drizzle BIGINT for money columns

**Source:** CLAUDE.md "What NOT to Use" + CONTEXT.md D-01, D-04

**Apply to:** `products.base_price_minor`, `product_variants.price_minor`

In Drizzle schema:
```typescript
import { bigint } from "drizzle-orm/pg-core";
// Use bigint with { mode: "number" } for JS compatibility (safe up to Number.MAX_SAFE_INTEGER)
// or { mode: "bigint" } for native BigInt. Prefer "number" for ease unless amounts exceed 2^53.
basePriceMinor: bigint("base_price_minor", { mode: "number" }).notNull(),
```
Never use `numeric()`, `decimal()`, or `real()` for price columns.

---

### Soft-delete via `archivedAt`

**Source:** `apps/api/src/db/schema/categories.ts` line 64 + `apps/api/src/modules/categories/CategoryService.ts` lines 234-249

**Apply to:** `products.ts` schema + `ProductService.archiveProduct()`

```typescript
// Schema column
archivedAt: timestamp("archived_at", { withTimezone: true }),

// Service method
async archiveProduct(id: string, vendorId: string): Promise<SelectProduct | null> {
  const rows = await this.deps.db.update(products)
    .set({ archivedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(products.id, id), eq(products.vendorId, vendorId)))
    .returning();
  return rows[0] ?? null;
}
```

---

### Cascade FK delete

**Source:** `apps/api/src/db/schema/attribute-definitions.ts` lines 57-59

**Apply to:** All child tables (`product_variants`, `product_images` → `products.id`)

```typescript
productId: uuid("product_id").notNull().references(() => products.id, { onDelete: "cascade" }),
```

---

### Redis cache key naming convention

**Source:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` line 31 (`ff:<key>`), `apps/api/src/modules/categories/CategoryService.ts` line 91 (`cat:tree`)

**Apply to:** `SearchService.ts` filter schema cache

Follow the established pattern: `category_filter_schema:{categoryId}` (documented in RESEARCH.md; consistent with CONTEXT.md code insights).

---

### Awilix DI service registration

**Source:** `apps/api/src/container.ts` lines 39-47

**Apply to:** All new services (VendorAuthService, ProductService, ImageService, SearchService)

```typescript
// Infrastructure values (before domain services)
container.register({
  opensearch: asValue(fastify.opensearch),
  productIndexQueue: asValue(productIndexQueue),
});
// Domain services
container.register({
  vendorAuthService: asClass(VendorAuthService).singleton(),
  productService: asClass(ProductService).singleton(),
  imageService: asClass(ImageService).singleton(),
  searchService: asClass(SearchService).singleton(),
});
```

---

### pgEnum for status / typed columns

**Source:** `apps/api/src/db/schema/attribute-definitions.ts` lines 22-29

**Apply to:** `apps/api/src/db/schema/products.ts` for `productStatusEnum`

```typescript
export const productStatusEnum = pgEnum("product_status", [
  "draft",
  "pending_review",
  "approved",
  "rejected",
]);
```

Values must exactly match `ProductStatusSchema` in `packages/contracts/src/catalog/product.ts`.

---

### Write-through cache invalidation

**Source:** `apps/api/src/modules/categories/CategoryService.ts` lines 288-290 (`invalidateTree()`) + `apps/api/src/modules/filter-schema/FilterSchemaService.ts` line 197 (note in RESEARCH.md)

**Apply to:** `FilterSchemaService.replaceFilterSchema()` → invalidate `category_filter_schema:{categoryId}` in Redis (RESEARCH.md Pitfall 6)

Add to `FilterSchemaService.replaceFilterSchema()` after the DB writes:
```typescript
await this.deps.redis.del(`category_filter_schema:${categoryId}`);
```

---

## No Analog Found

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/api/src/modules/jobs/queues.ts` | utility | event-driven | No BullMQ Queue exists yet in the codebase; RESEARCH.md Pattern 3 + Pitfall 1 are the primary references |
| `apps/api/src/modules/jobs/workers.ts` | utility | event-driven | No BullMQ Worker exists yet; same reason |

For these two files, the planner should use RESEARCH.md Pitfall 1 (separate ioredis connection with `maxRetriesPerRequest: null`) and the redis.ts plugin lifecycle pattern as structural guides.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `packages/contracts/src/`
**Files read (unique):** 27
**Pattern extraction date:** 2026-05-31
