# Phase 2: Category Engine - Pattern Map

**Mapped:** 2026-05-29
**Files analyzed:** 35 new/modified files
**Analogs found:** 35 / 35 (all files have a codebase analog or direct derivation)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/db/schema/categories.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | exact |
| `apps/api/src/db/schema/attribute-definitions.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/filter-schema-definitions.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/product-templates.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/vendor-category-restrictions.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/category-metadata.ts` | model | CRUD | `apps/api/src/db/schema/feature-flags.ts` | role-match |
| `apps/api/src/db/schema/index.ts` | config | — | `apps/api/src/db/schema/index.ts` | exact |
| `apps/api/src/modules/categories/CategoryService.ts` | service | request-response + event-driven (Redis) | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | exact |
| `apps/api/src/modules/categories/CategoryService.test.ts` | test | — | `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` | exact |
| `apps/api/src/modules/categories/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/attribute-definitions/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/modules/filter-schema/FilterSchemaService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/filter-schema/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/modules/product-templates/ProductTemplateService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/product-templates/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/modules/vendor-restrictions/VendorRestrictionService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/vendor-restrictions/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/modules/category-metadata/CategoryMetadataService.ts` | service | CRUD | `apps/api/src/modules/feature-flags/FeatureFlagService.ts` | role-match |
| `apps/api/src/modules/category-metadata/index.ts` | config | — | `apps/api/src/modules/feature-flags/index.ts` | exact |
| `apps/api/src/routes/categories.ts` | route | request-response | `apps/api/src/routes/feature-flags.ts` | exact |
| `apps/api/src/routes/admin/categories.ts` | route | request-response | `apps/api/src/routes/feature-flags.ts` | role-match |
| `apps/api/src/container.ts` | config | — | `apps/api/src/container.ts` | exact |
| `apps/api/src/app.ts` | config | — | `apps/api/src/app.ts` | exact |
| `apps/api/src/config/env.ts` | config | — | `apps/api/src/config/env.ts` | exact |
| `packages/contracts/src/category/blocks.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/tree.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/attribute-definition.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/filter-schema.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/product-template.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/vendor-restriction.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/metadata.ts` | model | transform | `packages/contracts/src/feature-flags.ts` | role-match |
| `packages/contracts/src/category/index.ts` | config | — | `packages/contracts/src/index.ts` | exact |
| `packages/contracts/src/index.ts` | config | — | `packages/contracts/src/index.ts` | exact |
| `apps/web-admin/src/App.tsx` | component | request-response | `apps/web-admin/src/App.tsx` | exact |

---

## Pattern Assignments

### `apps/api/src/db/schema/categories.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

**Imports pattern** (lines 1):
```typescript
import { boolean, integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
```

**Core Drizzle table pattern** (lines 15-27 of analog — adapt column set):
```typescript
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertFeatureFlag = typeof featureFlags.$inferInsert;
export type SelectFeatureFlag = typeof featureFlags.$inferSelect;
```

**categories.ts must follow this shape exactly** with these columns per RESEARCH.md §Database Schema Design:
- `id`: uuid, defaultRandom, primaryKey
- `parentId`: uuid, references(() => categories.id), nullable (self-referential adjacency list)
- `name`: text, notNull
- `slug`: text, notNull, unique
- `sortOrder`: integer, notNull, default(0)
- `isRestricted`: boolean, notNull, default(false)
- `archivedAt`: timestamp with timezone, nullable (soft-delete)
- `createdAt` / `updatedAt`: timestamp with timezone, defaultNow, notNull

Export `InsertCategory` and `SelectCategory` via `$inferInsert` / `$inferSelect`.

---

### `apps/api/src/db/schema/attribute-definitions.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

**Additional imports needed** (not in analog — Drizzle pgEnum + unique constraint):
```typescript
import { boolean, integer, jsonb, pgEnum, pgTable, text, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories.js";
```

**pgEnum pattern** (derived from RESEARCH.md Pattern 3 — confirmed against Drizzle docs):
```typescript
export const attrTypeEnum = pgEnum("attr_type", [
  "text", "textarea", "number", "boolean", "enum", "multi_select",
]);
```

**JSONB typed column pattern** (RESEARCH.md Pattern 3):
```typescript
options: jsonb("options").$type<AttributeOption[]>(),
```

**Unique constraint on two columns** (table-level index — Drizzle syntax):
```typescript
export const attributeDefinitions = pgTable("attribute_definitions", {
  // ... columns ...
}, (t) => [
  unique().on(t.categoryId, t.key),
]);
```

**Type exports** (mirror analog lines 26-27):
```typescript
export type InsertAttributeDefinition = typeof attributeDefinitions.$inferInsert;
export type SelectAttributeDefinition = typeof attributeDefinitions.$inferSelect;
```

---

### `apps/api/src/db/schema/filter-schema-definitions.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

**Additional pgEnum for display_type** (new enum, same pattern as attrTypeEnum):
```typescript
export const filterDisplayTypeEnum = pgEnum("filter_display_type", [
  "checkbox", "radio", "range_slider", "toggle",
]);
```

Columns: `id`, `categoryId` (FK → categories), `attributeDefId` (FK → attribute_definitions), `displayType` (filterDisplayTypeEnum), `sortOrder`, `createdAt`. Plus `unique().on(t.categoryId, t.attributeDefId)` table constraint.

---

### `apps/api/src/db/schema/product-templates.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

Columns: `id`, `categoryId` (FK → categories, unique — one template per category), `templateFields` (jsonb, `.$type<TemplateField[]>()`, notNull, default `[]`), `createdAt`, `updatedAt`.

**unique on single FK** (simpler than two-column unique):
```typescript
categoryId: uuid("category_id").notNull().unique().references(() => categories.id, { onDelete: "cascade" }),
```

---

### `apps/api/src/db/schema/vendor-category-restrictions.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

Columns: `id`, `categoryId` (FK → categories, cascade), `vendorId` (uuid, notNull — no FK in Phase 2, vendors table doesn't exist yet), `createdAt`, `createdByAdminId` (uuid, notNull — no FK in Phase 2). Plus `unique().on(t.categoryId, t.vendorId)` table constraint.

---

### `apps/api/src/db/schema/category-metadata.ts` (model, CRUD)

**Analog:** `apps/api/src/db/schema/feature-flags.ts`

Uses `jsonb` column (already in analog) for `blocks`:
```typescript
blocks: jsonb("blocks").$type<MerchandisingBlock[]>().notNull().default([]),
```

Import `MerchandisingBlock` from `@grovio/contracts` (contracts package). Columns: `id`, `categoryId` (unique FK → categories, cascade), `seoTitle`, `seoDescription`, `seoKeywords`, `canonicalUrl` (all nullable text), `blocks` (typed jsonb array), `description` (nullable text), `imageUrl` (nullable text), `createdAt`, `updatedAt`.

---

### `apps/api/src/db/schema/index.ts` (config, barrel export)

**Analog:** `apps/api/src/db/schema/index.ts` (lines 1-17)

```typescript
// Current state — lines 1-17:
/**
 * Drizzle ORM schema barrel.
 * ...
 */
export * from "./feature-flags.js";
```

**Update pattern** — append new exports in FK dependency order (categories first):
```typescript
export * from "./categories.js";              // first — others reference it
export * from "./attribute-definitions.js";
export * from "./filter-schema-definitions.js";
export * from "./product-templates.js";
export * from "./vendor-category-restrictions.js";
export * from "./category-metadata.js";
export * from "./feature-flags.js";           // existing — keep
```

---

### `apps/api/src/modules/categories/CategoryService.ts` (service, request-response + Redis)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` (lines 1-99)

**Imports pattern** (analog lines 1-6):
```typescript
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { featureFlags, type SelectFeatureFlag } from "../../db/schema/index.js";
```

**Adapt for CategoryService:**
```typescript
import { asc, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { CategoryTreeNode } from "@grovio/contracts";
import type { Env } from "../../config/env.js";
import { categories, type InsertCategory, type SelectCategory } from "../../db/schema/index.js";
```

**Deps interface pattern** (analog lines 7-12):
```typescript
interface FeatureFlagServiceDeps {
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}
```

**Copy to CategoryServiceDeps** with same three fields: `db`, `redis`, `env`.

**Constructor injection pattern** (analog line 29):
```typescript
constructor(private deps: FeatureFlagServiceDeps) {}
```

**Redis key pattern** (analog lines 31-33):
```typescript
private redisKey(flagKey: string): string {
  return "ff:" + flagKey;
}
```

**Adapt for category tree** — single key, no parameterization:
```typescript
private readonly treeKey = "cat:tree";
```

**Redis-first read pattern** (analog lines 39-58):
```typescript
async getFlag(key: string): Promise<string | null> {
  const { db, redis, env } = this.deps;

  const cached = await redis.get(this.redisKey(key));
  if (cached !== null) return cached;

  const rows = await db
    .select()
    .from(featureFlags)
    .where(eq(featureFlags.key, key))
    .limit(1);

  const row = rows[0];
  if (!row || !row.isEnabled) return null;

  await redis.setex(this.redisKey(key), env.FEATURE_FLAG_TTL_SECONDS, row.value);
  return row.value;
}
```

**Adapt `getTree()` from this pattern:**
```typescript
async getTree(): Promise<CategoryTreeNode[]> {
  const { db, redis, env } = this.deps;

  const cached = await redis.get(this.treeKey);
  if (cached !== null) return JSON.parse(cached) as CategoryTreeNode[];

  const rows = await db
    .select()
    .from(categories)
    .where(isNull(categories.archivedAt))
    .orderBy(asc(categories.sortOrder));

  const tree = buildTree(rows);
  await redis.setex(this.treeKey, env.CATEGORY_TREE_TTL_SECONDS, JSON.stringify(tree));
  return tree;
}
```

**Write-through invalidation pattern** (analog lines 85-87):
```typescript
async invalidateFlag(key: string): Promise<void> {
  await this.deps.redis.del(this.redisKey(key));
}
```

**Adapt `invalidateTree()`:**
```typescript
async invalidateTree(): Promise<void> {
  await this.deps.redis.del(this.treeKey);
}
```

**Custom error class** (no analog — new for category engine):
```typescript
export class CategoryDepthError extends Error {
  readonly code = "CATEGORY_DEPTH_EXCEEDED";
  constructor(message = "Cannot create subcategory: maximum depth of 3 levels reached.") {
    super(message);
    this.name = "CategoryDepthError";
  }
}
```

**env.ts must add** `CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300)` following `FEATURE_FLAG_TTL_SECONDS` pattern (analog line 40).

---

### `apps/api/src/modules/categories/CategoryService.test.ts` (test)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` (lines 1-227)

**Test file structure** (analog lines 1-3):
```typescript
import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectFeatureFlag } from "../../db/schema/index.js";
import { FeatureFlagService } from "./FeatureFlagService.js";
```

**DB mock builder pattern** (analog lines 13-37):
```typescript
function makeDbMock(rows: SelectFeatureFlag[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: SelectFeatureFlag[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  const db = { select: vi.fn().mockReturnValue(awaitableChain) };
  return db;
}
```

**Redis mock builder pattern** (analog lines 40-47):
```typescript
function makeRedisMock() {
  return {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}
```

**ENV constant pattern** (analog line 49):
```typescript
const ENV = { FEATURE_FLAG_TTL_SECONDS: 60 } as never;
```

Adapt to: `const ENV = { CATEGORY_TREE_TTL_SECONDS: 300 } as never;`

**Service instantiation in test** (analog line 86):
```typescript
const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
```

**Cache hit assertion pattern** (analog lines 81-93):
```typescript
it("returns cached value on Redis hit — no DB query", async () => {
  const db = makeDbMock([enabledFlag]);
  const redis = makeRedisMock();
  redis.get.mockResolvedValue("true");

  const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
  const result = await svc.getFlag("new_checkout");

  expect(result).toBe("true");
  expect(redis.get).toHaveBeenCalledWith("ff:new_checkout");
  expect(db.select).not.toHaveBeenCalled();
});
```

**DB mock for CategoryService needs additional chaining** for `orderBy`. Extend `awaitableChain`:
```typescript
// CategoryService uses: db.select().from().where().orderBy()
where: vi.fn().mockReturnValue({
  orderBy: vi.fn().mockResolvedValue(rows),
  limit: vi.fn().mockResolvedValue(rows),
  then: (resolve: (v: SelectCategory[]) => void) => resolve(rows),
  catch: vi.fn(),
  finally: vi.fn(),
}),
```

Also need insert mock for `createCategory`:
```typescript
function makeInsertDbMock(returnRow: SelectCategory) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return { insert: vi.fn().mockReturnValue(insertChain) };
}
```

---

### `apps/api/src/modules/categories/index.ts` (config)

**Analog:** `apps/api/src/modules/feature-flags/index.ts` (line 1):
```typescript
export { FeatureFlagService } from "./FeatureFlagService.js";
```

**Pattern — copy verbatim, substitute class name:**
```typescript
export { CategoryService } from "./CategoryService.js";
export type { CategoryDepthError } from "./CategoryService.js";
```

---

### `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.ts` (service, CRUD)

**Analog:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts`

**Deps interface** — db only (no Redis, no env — attribute definitions are not cached in Phase 2):
```typescript
interface AttributeDefinitionServiceDeps {
  db: NodePgDatabase<any>;
}
```

**Core DB select pattern** (analog lines 47-51):
```typescript
const rows = await db
  .select()
  .from(featureFlags)
  .where(eq(featureFlags.key, key))
  .limit(1);
```

**Adapt for getAttributesByCategory:**
```typescript
async getAttributesByCategory(categoryId: string): Promise<SelectAttributeDefinition[]> {
  return await this.deps.db
    .select()
    .from(attributeDefinitions)
    .where(eq(attributeDefinitions.categoryId, categoryId))
    .orderBy(asc(attributeDefinitions.sortOrder));
}
```

**Business rule enforcement** — options validation before insert:
```typescript
async createAttribute(input: CreateAttributeInput): Promise<SelectAttributeDefinition> {
  const requiresOptions = input.attrType === "enum" || input.attrType === "multi_select";
  if (requiresOptions && (!input.options || input.options.length === 0)) {
    throw new Error(`Attribute type "${input.attrType}" requires at least one option.`);
  }
  if (!requiresOptions && input.options) {
    throw new Error(`Attribute type "${input.attrType}" must not have options.`);
  }
  const [row] = await this.deps.db
    .insert(attributeDefinitions)
    .values(input)
    .returning();
  return row!;
}
```

---

### `apps/api/src/routes/categories.ts` (route, request-response)

**Analog:** `apps/api/src/routes/feature-flags.ts` (lines 1-36)

**Imports pattern** (analog lines 1-2):
```typescript
import type { FastifyInstance } from "fastify";
import type { FeatureFlagService } from "../modules/feature-flags/index.js";
```

**Function signature pattern** (analog line 13):
```typescript
export async function featureFlagRoutes(fastify: FastifyInstance): Promise<void> {
```

**DI container resolution pattern** (analog line 16):
```typescript
const featureFlagService = fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
```

**Success response pattern** (analog line 17):
```typescript
return reply.send({ success: true, data: flags });
```

**404 error response pattern** (analog lines 26-31):
```typescript
return reply.status(404).send({
  success: false,
  error: {
    code: "FLAG_NOT_FOUND",
    message: "Feature flag not found",
  },
});
```

**Route with URL params pattern** (analog lines 22-35):
```typescript
fastify.get<{ Params: { key: string } }>("/internal/flags/:key", async (request, reply) => {
  const featureFlagService = fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
  const value = await featureFlagService.getFlag(request.params.key);
  // ...
});
```

**Adapt for categories.ts:**
```typescript
export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /categories
  fastify.get("/categories", async (_request, reply) => {
    const categoryService = fastify.diContainer.resolve<CategoryService>("categoryService");
    const tree = await categoryService.getTree();
    return reply.send({ success: true, data: { tree } });
  });

  // GET /categories/:id
  fastify.get<{ Params: { id: string } }>("/categories/:id", async (request, reply) => {
    const categoryService = fastify.diContainer.resolve<CategoryService>("categoryService");
    const category = await categoryService.getCategoryById(request.params.id);
    if (!category) {
      return reply.status(404).send({
        success: false,
        error: { code: "CATEGORY_NOT_FOUND", message: "Category not found" },
      });
    }
    return reply.send({ success: true, data: category });
  });
  // ... additional sub-resource routes follow same pattern
}
```

---

### `apps/api/src/routes/admin/categories.ts` (route, request-response)

**Analog:** `apps/api/src/routes/feature-flags.ts`

Same structure as public categories.ts route. Admin mutations use `POST`, `PATCH`, `DELETE` methods and resolve the same services. Body validation uses Zod schemas from `@grovio/contracts`:

```typescript
import { z } from "zod";
import { CreateCategoryInputSchema } from "@grovio/contracts";

// Body parsing pattern — Fastify route with typed Body generic:
fastify.post<{ Body: z.infer<typeof CreateCategoryInputSchema> }>(
  "/admin/categories",
  async (request, reply) => {
    const body = CreateCategoryInputSchema.parse(request.body);
    const categoryService = fastify.diContainer.resolve<CategoryService>("categoryService");
    const created = await categoryService.createCategory(body);
    return reply.status(201).send({ success: true, data: created });
  }
);
```

**Error catching for domain errors:**
```typescript
try {
  const created = await categoryService.createCategory(body);
  return reply.status(201).send({ success: true, data: created });
} catch (err) {
  if (err instanceof CategoryDepthError) {
    return reply.status(422).send({
      success: false,
      error: { code: err.code, message: err.message },
    });
  }
  throw err; // re-throw — app.ts error handler catches it (line 52-71 of app.ts)
}
```

**Placeholder admin guard** (dev-only mount — RESEARCH.md Security §Pitfall 8):
```typescript
// In app.ts, mount admin routes conditionally:
if (process.env["NODE_ENV"] !== "production") {
  await fastify.register(adminCategoryRoutes);
} else {
  // Phase 4 replaces this with JWT middleware
  await fastify.register(adminCategoryRoutes); // TODO: add auth middleware
}
```

---

### `apps/api/src/container.ts` (config, update)

**Analog:** `apps/api/src/container.ts` (lines 1-40, exact — update only)

**Import pattern** (analog lines 1-4):
```typescript
import { asClass, asValue, createContainer, InjectionMode } from "awilix";
import type { FastifyInstance } from "fastify";
import { env } from "./config/env.js";
import { FeatureFlagService } from "./modules/feature-flags/index.js";
```

**Service registration pattern** (analog lines 33-35):
```typescript
container.register({
  featureFlagService: asClass(FeatureFlagService).singleton(),
});
```

**Append new services following this exact pattern:**
```typescript
import { CategoryService } from "./modules/categories/index.js";
import { AttributeDefinitionService } from "./modules/attribute-definitions/index.js";
import { FilterSchemaService } from "./modules/filter-schema/index.js";
import { ProductTemplateService } from "./modules/product-templates/index.js";
import { VendorRestrictionService } from "./modules/vendor-restrictions/index.js";
import { CategoryMetadataService } from "./modules/category-metadata/index.js";

// Add to container.register() call:
container.register({
  featureFlagService: asClass(FeatureFlagService).singleton(),
  categoryService: asClass(CategoryService).singleton(),
  attributeDefinitionService: asClass(AttributeDefinitionService).singleton(),
  filterSchemaService: asClass(FilterSchemaService).singleton(),
  productTemplateService: asClass(ProductTemplateService).singleton(),
  vendorRestrictionService: asClass(VendorRestrictionService).singleton(),
  categoryMetadataService: asClass(CategoryMetadataService).singleton(),
});
```

---

### `apps/api/src/app.ts` (config, update)

**Analog:** `apps/api/src/app.ts` (lines 1-74, exact — update only)

**Route registration pattern** (analog lines 36-37):
```typescript
await fastify.register(healthRoutes);
await fastify.register(featureFlagRoutes);
```

**Append new route registrations after existing ones:**
```typescript
import { categoryRoutes } from "./routes/categories.js";
import { adminCategoryRoutes } from "./routes/admin/categories.js";

// After featureFlagRoutes:
await fastify.register(categoryRoutes);
await fastify.register(adminCategoryRoutes);
```

**Error handler is already in place** (analog lines 52-71) — domain errors that escape to this handler are formatted automatically. `CategoryDepthError` should be caught in the route, not here.

---

### `apps/api/src/config/env.ts` (config, update)

**Analog:** `apps/api/src/config/env.ts` (lines 1-51)

**Pattern for adding a new TTL env var** (analog line 40):
```typescript
FEATURE_FLAG_TTL_SECONDS: z.coerce.number().default(60),
```

**Add directly below this line:**
```typescript
/**
 * Redis TTL in seconds for the cached category tree.
 * Controls how quickly category tree changes propagate after admin writes.
 * Admin write-through invalidation means this TTL is a safety net only.
 * Defaults to 300 seconds (5 minutes).
 */
CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300),
```

---

### `packages/contracts/src/category/blocks.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts` (lines 1-30) for Zod + type-infer pattern

**Zod schema pattern** (analog lines 9-21):
```typescript
export const FeatureFlagSchema = z.object({
  key: z.string().min(1),
  value: z.union([z.boolean(), z.string(), z.number()]),
  description: z.string().optional(),
  enabled: z.boolean(),
});
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;
```

**Discriminated union pattern** (new — no direct analog in codebase, but auth.ts uses z.enum and z.object):
```typescript
import { z } from "zod";

export const BannerBlockSchema = z.object({
  type: z.literal("banner"),
  imageUrl: z.string().url(),
  title: z.string(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
});

export const ProductGridBlockSchema = z.object({
  type: z.literal("product_grid"),
  title: z.string(),
  productIds: z.array(z.string().uuid()),
  layout: z.enum(["grid", "carousel"]),
});

export const TextBlockSchema = z.object({
  type: z.literal("text_block"),
  title: z.string(),
  content: z.string(),
});

export const MerchandisingBlockSchema = z.discriminatedUnion("type", [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
]);

export type BannerBlock = z.infer<typeof BannerBlockSchema>;
export type ProductGridBlock = z.infer<typeof ProductGridBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
export type MerchandisingBlock = z.infer<typeof MerchandisingBlockSchema>;
```

---

### `packages/contracts/src/category/tree.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts`

File header with JSDoc comment (analog line 1 — all contracts files have a JSDoc header block). Schema + infer type pattern:

```typescript
import { z } from "zod";

export const CategoryTreeNodeSchema: z.ZodType<CategoryTreeNode> = z.lazy(() =>
  z.object({
    id: z.string().uuid(),
    name: z.string(),
    slug: z.string(),
    parentId: z.string().uuid().nullable(),
    sortOrder: z.number().int(),
    depth: z.number().int().min(0).max(2),
    hasChildren: z.boolean(),
    childCount: z.number().int(),
    children: z.array(CategoryTreeNodeSchema),
  })
);

export type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  hasChildren: boolean;
  childCount: number;
  children: CategoryTreeNode[];
};

export const CategoryTreeResponseSchema = z.object({
  tree: z.array(CategoryTreeNodeSchema),
});

export type CategoryTreeResponse = z.infer<typeof CategoryTreeResponseSchema>;
```

Note: recursive Zod schemas require `z.lazy()`. TypeScript type must be declared separately before the schema to resolve circular reference.

---

### `packages/contracts/src/category/attribute-definition.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts` for Zod enum + infer pattern, `packages/contracts/src/auth.ts` lines 7 for z.enum:

```typescript
// auth.ts line 7 — z.enum pattern:
const RoleSchema = z.enum(["customer", "vendor", "admin"]);
```

**Apply to attribute-definition.ts:**
```typescript
import { z } from "zod";

export const AttrTypeSchema = z.enum([
  "text", "textarea", "number", "boolean", "enum", "multi_select",
]);
export type AttrType = z.infer<typeof AttrTypeSchema>;

export const AttributeOptionSchema = z.object({
  value: z.string(),
  label: z.string(),
});
export type AttributeOption = z.infer<typeof AttributeOptionSchema>;

export const AttributeDefinitionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  key: z.string().min(1),
  label: z.string().min(1),
  attrType: AttrTypeSchema,
  options: z.array(AttributeOptionSchema).nullable(),
  isRequired: z.boolean(),
  isFilterable: z.boolean(),
  isSearchable: z.boolean(),
  sortOrder: z.number().int(),
});
export type AttributeDefinition = z.infer<typeof AttributeDefinitionSchema>;

export const CreateAttributeInputSchema = z.object({
  key: z.string().min(1),
  label: z.string().min(1),
  attrType: AttrTypeSchema,
  options: z.array(AttributeOptionSchema).optional(),
  isRequired: z.boolean().optional(),
  isFilterable: z.boolean().optional(),
  isSearchable: z.boolean().optional(),
  sortOrder: z.number().int().optional(),
});
export type CreateAttributeInput = z.infer<typeof CreateAttributeInputSchema>;
```

---

### `packages/contracts/src/category/filter-schema.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts`

```typescript
import { z } from "zod";
import { AttributeDefinitionSchema } from "./attribute-definition.js";

export const DisplayTypeSchema = z.enum(["checkbox", "radio", "range_slider", "toggle"]);
export type DisplayType = z.infer<typeof DisplayTypeSchema>;

export const FilterSchemaDefSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  attributeDefId: z.string().uuid(),
  attribute: AttributeDefinitionSchema.pick({ key: true, label: true, attrType: true, options: true }),
  displayType: DisplayTypeSchema,
  sortOrder: z.number().int(),
});
export type FilterSchemaDef = z.infer<typeof FilterSchemaDefSchema>;

export const UpsertFilterSchemaInputSchema = z.object({
  filters: z.array(z.object({
    attributeDefId: z.string().uuid(),
    displayType: DisplayTypeSchema,
    sortOrder: z.number().int(),
  })),
});
export type UpsertFilterSchemaInput = z.infer<typeof UpsertFilterSchemaInputSchema>;
```

---

### `packages/contracts/src/category/product-template.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts`

```typescript
import { z } from "zod";

export const TemplateFieldSchema = z.object({
  key: z.string().min(1),
  default: z.union([z.string(), z.number(), z.boolean()]).optional(),
  hint: z.string().optional(),
});
export type TemplateField = z.infer<typeof TemplateFieldSchema>;

export const ProductTemplateSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  templateFields: z.array(TemplateFieldSchema),
});
export type ProductTemplate = z.infer<typeof ProductTemplateSchema>;

export const UpsertTemplateInputSchema = z.object({
  templateFields: z.array(TemplateFieldSchema),
});
export type UpsertTemplateInput = z.infer<typeof UpsertTemplateInputSchema>;
```

---

### `packages/contracts/src/category/vendor-restriction.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts`

```typescript
import { z } from "zod";

export const VendorCategoryRestrictionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  vendorId: z.string().uuid(),
  createdAt: z.string().datetime(),
  createdByAdminId: z.string().uuid(),
});
export type VendorCategoryRestriction = z.infer<typeof VendorCategoryRestrictionSchema>;
```

---

### `packages/contracts/src/category/metadata.ts` (model, transform)

**Analog:** `packages/contracts/src/feature-flags.ts`

```typescript
import { z } from "zod";
import { MerchandisingBlockSchema } from "./blocks.js";

export const CategoryMetadataSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  seoTitle: z.string().nullable(),
  seoDescription: z.string().nullable(),
  seoKeywords: z.string().nullable(),
  canonicalUrl: z.string().url().nullable(),
  blocks: z.array(MerchandisingBlockSchema),
  description: z.string().nullable(),
  imageUrl: z.string().url().nullable(),
});
export type CategoryMetadata = z.infer<typeof CategoryMetadataSchema>;

export const UpsertMetadataInputSchema = z.object({
  seoTitle: z.string().optional(),
  seoDescription: z.string().optional(),
  seoKeywords: z.string().optional(),
  canonicalUrl: z.string().url().optional(),
  blocks: z.array(MerchandisingBlockSchema).optional(),
  description: z.string().optional(),
  imageUrl: z.string().url().optional(),
});
export type UpsertMetadataInput = z.infer<typeof UpsertMetadataInputSchema>;
```

---

### `packages/contracts/src/category/index.ts` (config, barrel)

**Analog:** `packages/contracts/src/index.ts` (lines 13-17)

```typescript
// packages/contracts/src/index.ts current barrel — use same export * pattern:
export * from "./health.js";
export * from "./feature-flags.js";
export * from "./auth.js";
export * from "./envelope.js";
export * from "./marketplace-config.js";
```

**Category barrel index.ts — same pattern:**
```typescript
export * from "./blocks.js";
export * from "./tree.js";
export * from "./attribute-definition.js";
export * from "./filter-schema.js";
export * from "./product-template.js";
export * from "./vendor-restriction.js";
export * from "./metadata.js";
```

---

### `packages/contracts/src/index.ts` (config, update)

**Analog:** `packages/contracts/src/index.ts` (lines 13-17)

**Append** after existing exports:
```typescript
export * from "./category/index.js";
```

---

### Admin UI files (components and pages)

**Analog:** `apps/web-admin/src/App.tsx` (lines 1-42)

**React component base pattern** (analog lines 1, 11-42):
```typescript
import type { SomeType } from '@grovio/contracts';
import { motion } from 'motion/react';

export default function ComponentName() {
  return (
    <motion.div
      className="..."
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      transition={{ duration: 0.5 }}
    >
      {/* content */}
    </motion.div>
  );
}
```

**Tailwind classes use design tokens** (analog line 24 — `bg-grovio-primary`, `text-white`):
```
bg-grovio-primary     → primary brand color
text-grovio-text      → main text color
text-grovio-text-muted → secondary text
bg-grovio-surface     → page background
bg-grovio-surface-raised → card background
border-grovio-border  → border color
text-grovio-error     → error state
text-grovio-success   → success state
```

**React Query data fetching pattern** — TanStack Query v5, no analog exists yet in web-admin. Use the standard pattern:
```typescript
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

// Query:
const { data, isLoading, error } = useQuery({
  queryKey: ['categories', 'tree'],
  queryFn: () => fetch('/api/categories').then(r => r.json()),
});

// Mutation with optimistic invalidation:
const queryClient = useQueryClient();
const mutation = useMutation({
  mutationFn: (input) => fetch('/api/admin/categories', { method: 'POST', body: JSON.stringify(input) }),
  onSuccess: () => {
    queryClient.invalidateQueries({ queryKey: ['categories'] });
  },
});
```

**Zustand store pattern** — no analog in web-admin yet. Standard v5 pattern for `categoryUiStore.ts`:
```typescript
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface CategoryUiState {
  expandedIds: Set<string>;
  toggleExpand: (id: string) => void;
}

export const useCategoryUiStore = create<CategoryUiState>()(
  persist(
    (set) => ({
      expandedIds: new Set<string>(),
      toggleExpand: (id) =>
        set((s) => {
          const next = new Set(s.expandedIds);
          next.has(id) ? next.delete(id) : next.add(id);
          return { expandedIds: next };
        }),
    }),
    { name: 'category-ui-state' }
  )
);
```

---

### `apps/web-admin/src/pages/categories/CategoryListPage.tsx` (component, request-response)

**Analog:** `apps/web-admin/src/App.tsx`

Page-level component. Uses `useQuery` for category tree, `useCategoryUiStore` for expand state, renders `<CategoryTree>`. Wrapped in `motion.div` with `initial={{ opacity: 0 }}` / `animate={{ opacity: 1 }}` for page enter animation (matches App.tsx pattern).

---

### `apps/web-admin/src/components/categories/CategoryTree.tsx` (component, event-driven)

**Analog:** `apps/web-admin/src/App.tsx` for component structure. dnd-kit is new — no codebase analog.

**dnd-kit SortableContext pattern** (from RESEARCH.md §Admin UI Component Strategy):
```typescript
import { DndContext, closestCenter, type DragEndEvent } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';

// Flat list with indentation — NOT nested SortableContext:
<DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
  <SortableContext items={flatItems.map(n => n.id)} strategy={verticalListSortingStrategy}>
    {flatItems.map(node => (
      <CategoryTreeNode key={node.id} node={node} depth={node.depth} />
    ))}
  </SortableContext>
</DndContext>
```

**Indentation via Tailwind padding** (depth-based):
```
depth 0 → pl-0
depth 1 → pl-8
depth 2 → pl-16
```

---

### `apps/web-admin/src/components/categories/AttributeRow.tsx` (component, CRUD)

**Analog:** `apps/web-admin/src/App.tsx`

Single attribute form row. Uses `useSortable` from dnd-kit for the drag handle. Renders conditionally: options editor visible only when `attrType === 'enum' || attrType === 'multi_select'`. Part of a form list — all rows share parent state until Save is clicked.

---

### `apps/web-admin/src/components/categories/BlockEditor.tsx` (component, CRUD)

**Analog:** `apps/web-admin/src/App.tsx`

Block list with `+` button. Each block type renders its own form fields based on `block.type`. Blocks are reorderable via `@dnd-kit/sortable`. On save, the entire `blocks` array is sent as `PUT /admin/categories/:id/metadata` body.

---

### `apps/web-admin/package.json` (config, update)

**Analog:** `apps/web-admin/package.json` (lines 1-32)

**New dependencies to add** (per RESEARCH.md §Standard Stack — Admin UI):
```json
"@dnd-kit/core": "^6.0.0",
"@dnd-kit/sortable": "^8.0.0",
"@dnd-kit/utilities": "^3.0.0",
"react-router-dom": "^6.0.0"
```

Note: `@dnd-kit/sortable` has a different major version from `@dnd-kit/core` (core is v6, sortable is v8 in current npm). Verify exact versions with `npm view @dnd-kit/core version` and `npm view @dnd-kit/sortable version` before install. Per RESEARCH.md §Package Legitimacy Audit, insert a `checkpoint:human-verify` task before installing these packages.

**react-router-dom** is not currently in package.json (confirmed line 13-20 — not present). Must be added.

---

## Shared Patterns

### Redis-First Caching with Write-Through Invalidation
**Source:** `apps/api/src/modules/feature-flags/FeatureFlagService.ts` lines 39-87
**Apply to:** `CategoryService.ts` (getTree / invalidateTree methods)

Core contract:
1. `redis.get(key)` → return immediately on non-null
2. On null: DB query → build result → `redis.setex(key, ttlSeconds, JSON.stringify(result))`
3. After every DB mutation: `redis.del(key)` (write-through, not TTL expiry)

```typescript
// Write-through invalidation — call after EVERY mutation:
await this.deps.redis.del(this.treeKey);
```

### Awilix DI Constructor Injection Pattern
**Source:** `apps/api/src/container.ts` lines 19-38
**Apply to:** All new service classes (CategoryService, AttributeDefinitionService, etc.)

Services declare a typed `deps` interface and receive it via constructor. Container resolves by property name automatically in PROXY mode:
```typescript
interface ServiceDeps {
  db: NodePgDatabase<any>;
  redis?: Redis;    // optional — only for cached services
  env?: Env;        // optional — only for services reading TTL env vars
}
export class SomeService {
  constructor(private deps: ServiceDeps) {}
}
// container.ts: someService: asClass(SomeService).singleton()
```

### Fastify Route DI Resolution Pattern
**Source:** `apps/api/src/routes/feature-flags.ts` lines 13-36
**Apply to:** `routes/categories.ts` and `routes/admin/categories.ts`

```typescript
// Always resolve from diContainer inside handler, not at module level:
const service = fastify.diContainer.resolve<ServiceType>("serviceName");
```

### API Response Envelope
**Source:** `packages/contracts/src/envelope.ts` lines 46-57
**Apply to:** All route handlers

```typescript
// Success:
reply.send({ success: true, data: payload })
// Error (4xx):
reply.status(4xx).send({ success: false, error: { code: "...", message: "..." } })
// Error (5xx): re-throw — app.ts error handler wraps it
```

### Zod Schema + Type Infer Pattern
**Source:** `packages/contracts/src/feature-flags.ts` lines 9-30
**Apply to:** All `packages/contracts/src/category/*.ts` files

```typescript
export const SomeSchema = z.object({ ... });
export type SomeType = z.infer<typeof SomeSchema>;
```

### Drizzle Table Export Pattern
**Source:** `apps/api/src/db/schema/feature-flags.ts` lines 15-27
**Apply to:** All `apps/api/src/db/schema/category*.ts` files

```typescript
export const tableName = pgTable("table_name", { /* columns */ });
export type InsertTableName = typeof tableName.$inferInsert;
export type SelectTableName = typeof tableName.$inferSelect;
```

### Vitest Mock Chain Pattern
**Source:** `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` lines 13-47
**Apply to:** All `*.test.ts` service files in Phase 2

All service tests mock `db`, `redis`, and `env` using `vi.fn()` chains. No real DB or Redis connection. Pattern is copy-and-adapt from `makeDbMock()` and `makeRedisMock()`.

### Framer Motion Page Enter Animation
**Source:** `apps/web-admin/src/App.tsx` lines 12-22
**Apply to:** All `pages/categories/*.tsx` page components

```typescript
<motion.div
  initial={{ opacity: 0 }}
  animate={{ opacity: 1 }}
  transition={{ duration: 0.5 }}
>
```

### Tailwind v4 + Design Token Classes
**Source:** `apps/web-admin/src/App.tsx` line 24, `packages/ui/src/tokens/tokens.css` lines 15-33
**Apply to:** All admin UI components and pages

Use `bg-grovio-primary`, `text-grovio-text`, `border-grovio-border`, etc. (defined in `tokens.css` via `@theme {}` block). No `tailwind.config.js` — v4 CSS-native config.

---

## No Analog Found

All files in Phase 2 have analogs or close role-matches from the existing codebase. The following are the lowest-confidence mappings (partial-match only):

| File | Role | Data Flow | Reason |
|------|------|-----------|--------|
| `apps/web-admin/src/components/categories/CategoryTree.tsx` | component | event-driven | No dnd-kit usage exists in codebase yet; uses library-specific APIs |
| `packages/contracts/src/category/tree.ts` | model | transform | Recursive Zod schema (`z.lazy()`) has no codebase precedent |
| `apps/web-admin/src/stores/categoryUiStore.ts` | store | event-driven | No Zustand stores exist in web-admin yet; standard Zustand v5 pattern applies |
| `apps/web-admin/src/pages/categories/*.tsx` | component | request-response | No React Router DOM usage exists in web-admin yet |

For these files, use the patterns from RESEARCH.md §Admin UI Component Strategy and the library documentation patterns captured in this document.

---

## Metadata

**Analog search scope:** `apps/api/src/`, `packages/contracts/src/`, `apps/web-admin/src/`
**Files scanned:** 14 source files read directly
**Pattern extraction date:** 2026-05-29
