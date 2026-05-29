# Phase 2: Category Engine — Research

**Researched:** 2026-05-29
**Domain:** Category taxonomy, attribute schema modeling, admin tree UI, Drizzle JSONB/pgEnum, downstream integration contracts
**Confidence:** HIGH — all schema patterns verified against existing codebase; Drizzle, Fastify, and React/Tailwind v4 patterns confirmed via Context7 / official docs

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Maximum nesting depth is 3 levels (Root → Subcategory → Leaf). Enforced at API level with a meaningful error message.
- **D-02:** Storage: adjacency list with `parent_id` + `sort_order`. No nested sets or materialized paths.
- **D-03:** `GET /categories` returns the full nested tree in a single response, Redis-cached (same TTL pattern as FeatureFlagService). Admin writes invalidate cache immediately (write-through).
- **D-04:** Full tree response includes only navigation fields: `id`, `name`, `slug`, `parentId`, `sortOrder`, `depth`, `hasChildren`, `childCount`. Per-category detail is lazy-fetched.
- **D-05:** 6 core attribute types: `text`, `textarea`, `number`, `boolean`, `enum`, `multi_select`.
- **D-06:** `attr_type` column is a Drizzle `pgEnum` over the 6 values.
- **D-07:** `options` for enum/multi_select stored as JSONB: `[{ value: string, label: string }]`.
- **D-08:** Admin attribute-builder UI: simple form list with reorder (up/down buttons or drag handle per row). No drag-from-palette. Category tree DnD is the primary DnD surface.
- **D-09:** Categories default open; admin marks `is_restricted = true` for restricted categories.
- **D-10:** `vendor_category_restrictions` table: `{ id, category_id, vendor_id, created_at, created_by_admin_id }`.
- **D-11:** Restriction enforcement in Phase 3. Phase 2 delivers schema + admin CRUD + query API only.
- **D-12:** Typed block model for merchandising — `blocks` column is `jsonb[]`. v1 types: `banner`, `product_grid`, `text_block`.
- **D-13:** SEO fields are flat columns on `category_metadata`: `seo_title`, `seo_description`, `seo_keywords`, `canonical_url`.
- **D-14:** Block types defined in `packages/contracts/src/category/blocks.ts` as discriminated unions + Zod schemas.

### Claude's Discretion

- Category slug generation strategy (auto-derived from name vs. admin-provided with auto-fallback)
- Filter schema `display_type` enum values (checkbox, radio, range_slider, toggle)
- Product template JSON structure (field defaults + hints per attribute_definition)
- Redis cache key naming convention for category tree (following FeatureFlagService pattern)
- Pagination strategy for admin category list endpoint

### Deferred Ideas (OUT OF SCOPE)

- Vendor restriction enforcement at product creation (Phase 3)
- OpenSearch mapping generation from attribute_definitions (Phase 3)
- Admin UI for category analytics (Phase 6)
- Category-level commission override (Phase 5)
- i18n per-category names/descriptions (v2, INTL-01)
- Vendor-supplied category suggestions (not in v1 scope)

</user_constraints>

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| CAT-01 | Admin can create, edit, archive, and reorder categories | Adjacency list + sort_order; soft-delete via `archived_at`; Redis write-through invalidation |
| CAT-02 | Admin can create nested subcategories (category tree) | D-01 depth guard in CategoryService; recursive tree assembly in GET /categories |
| CAT-03 | Admin can define category-specific attribute schemas (typed attributes per category) | `attribute_definitions` table with `pgEnum` attr_type; JSONB options for enum/multi_select |
| CAT-04 | Admin can define per-category filter schemas controlling which attributes become storefront filters | `filter_schema_definitions` table with `display_type` enum and FK to attribute_definitions |
| CAT-05 | Admin can define product templates per category to speed vendor product creation | `product_templates` table with JSONB `template_fields` referencing attribute_definition keys |
| CAT-06 | Admin can restrict which vendors may sell in which categories | `vendor_category_restrictions` table; admin CRUD + query API for restriction state |
| CAT-07 | Admin can configure category banners, descriptions, SEO fields, and merchandising blocks | `category_metadata` table with flat SEO columns + JSONB blocks array; block types from contracts |

</phase_requirements>

---

## Summary

Phase 2 builds the schema foundation that every downstream phase reads. The category engine delivers: (1) a 3-level adjacency-list category tree with Redis-cached public read and write-through admin mutations; (2) per-category attribute schemas using a Drizzle pgEnum type system and JSONB options storage — the JSONB + schema registry pattern explicitly required to avoid EAV (Pitfall 8); (3) filter schemas, product templates, vendor restrictions, and category metadata as separate relational tables; and (4) a typed block model in packages/contracts that both the admin panel and future Phase 4 CMS consume.

The existing FeatureFlagService establishes all the patterns Phase 2 extends: Redis-first caching with write-through invalidation, Drizzle schema files re-exported from a barrel, Fastify route plugin with DI container resolution, and Awilix `asClass` registration. CategoryService follows the same structure verbatim. The admin UI is new ground — React 19 + Tailwind v4 + dnd-kit for tree drag-and-drop, plus simple form-list reorder for the attribute builder per D-08.

**Primary recommendation:** Model all 7 tables in a single migration (categories, attribute_definitions, filter_schema_definitions, product_templates, vendor_category_restrictions, category_metadata, and the pgEnum type). Register CategoryService + AttributeDefinitionService in the Awilix container. Add the `packages/contracts/src/category/` subfolder with 7 TypeScript/Zod files. Build the admin UI in 3 waves: tree CRUD + reorder, attribute/filter/template builder, vendor restrictions + metadata/blocks editor.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Category tree storage and depth enforcement | API / Backend | — | Business rule (3-level limit) must be enforced server-side; client cannot be trusted |
| Category tree read (public GET /categories) | API / Backend (cached) | Redis (TTL) | Infrequent writes, high read volume — cache is the correct tier |
| Redis cache invalidation on admin writes | API / Backend | Redis | Write-through is a backend concern, not a client concern |
| Admin category CRUD + reorder | API / Backend | — | Data mutations always originate on the server |
| Admin category tree UI + DnD | Frontend (web-admin) | — | Presentation of tree structure and drag interaction is a client concern |
| Attribute/filter schema definitions CRUD | API / Backend | — | Schema registry is authoritative only when stored and validated on the server |
| Attribute builder form UI | Frontend (web-admin) | — | Form list with reorder is a UI concern |
| Vendor restriction CRUD | API / Backend | — | Authorization data must be backend-authoritative |
| Category metadata + blocks CRUD | API / Backend | — | Content and SEO data are persisted on server |
| Typed block model definitions | packages/contracts | — | Discriminated unions + Zod schemas are a shared concern between admin UI and API |
| OpenSearch mapping derivation from attribute_definitions | API / Backend (Phase 3) | — | Deferred; Phase 2 only sets `is_searchable` flag on the definition row |

---

## Standard Stack

### Core (Phase 2 additions — all already installed at root/api level)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| drizzle-orm | 0.45.x | Schema definition, migrations, typed queries | Project standard; `pgEnum`, `jsonb`, `uuid`, `text` columns — all needed here [VERIFIED: CLAUDE.md] |
| drizzle-kit | 1.0.0-beta.x | Migration generation from Drizzle schemas | Project standard; `pnpm db:generate` + `pnpm db:migrate` [VERIFIED: CLAUDE.md] |
| zod | 4.4.x | Request body validation, discriminated unions for block types | Project standard; already in contracts [VERIFIED: CLAUDE.md] |
| fastify | 5.8.x | Route plugin registration | Project standard; existing route pattern to follow [VERIFIED: CLAUDE.md] |
| awilix | 13.0.x | DI container registration for CategoryService | Project standard; `asClass` pattern established [VERIFIED: CLAUDE.md] |
| ioredis | 5.11.x | Redis write-through cache invalidation | Project standard; used in FeatureFlagService [VERIFIED: CLAUDE.md] |

### Admin UI (web-admin — new for Phase 2)

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| dnd-kit/core | 6.x | Category tree drag-and-drop reorder | React 19 compatible; accessibility-conscious; modular; official docs confirm React 19 support [ASSUMED] |
| dnd-kit/sortable | 6.x | Sortable list preset for attribute builder row reorder | Companion to @dnd-kit/core; same install [ASSUMED] |
| @tanstack/react-query | 5.100.x | Admin data fetching (category CRUD, attribute queries) | Already in web-admin package.json [VERIFIED: CLAUDE.md] |
| react-router-dom | 6.x | Admin page routing (category list, category detail, attribute editor) | [ASSUMED] — not yet installed in web-admin, needs adding |

### Supporting (already in project, no new install needed)

| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| framer-motion (motion/react) | 12.x | Admin panel micro-interactions | Already in web-admin; animate panel transitions, tree node expand/collapse |
| zustand | 5.0.x | Client state (e.g., unsaved attribute list order before save) | Already in web-admin; for ephemeral UI state during block editing |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| dnd-kit | react-beautiful-dnd | react-beautiful-dnd is unmaintained (last release 2022); dnd-kit is actively maintained and React 18/19 compatible [ASSUMED] |
| dnd-kit | @hello-pangea/dnd | @hello-pangea/dnd is the react-beautiful-dnd community fork; viable but dnd-kit has better accessibility primitives and more active development [ASSUMED] |
| Adjacency list | Nested sets | Nested sets have O(n) write complexity for inserts; for 3-level trees with low write frequency, adjacency list is strictly simpler [ASSUMED] |

**Installation (new packages only):**
```bash
# web-admin only — API has all it needs already
cd apps/web-admin
pnpm add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities react-router-dom
```

**Version verification:**
```bash
npm view @dnd-kit/core version      # verify latest before install
npm view @dnd-kit/sortable version
npm view react-router-dom version
```

---

## Package Legitimacy Audit

> slopcheck was not available in this environment. All new packages are marked [ASSUMED] and the planner must gate each install behind a checkpoint:human-verify task.

| Package | Registry | Confidence | Source Repo | Disposition |
|---------|----------|------------|-------------|-------------|
| @dnd-kit/core | npm | [ASSUMED] | github.com/clauderic/dnd-kit | Use — widely adopted, but verify via slopcheck before install |
| @dnd-kit/sortable | npm | [ASSUMED] | github.com/clauderic/dnd-kit | Use — same repo as @dnd-kit/core |
| @dnd-kit/utilities | npm | [ASSUMED] | github.com/clauderic/dnd-kit | Use — same repo |
| react-router-dom | npm | [ASSUMED] | github.com/remix-run/react-router | Use — extremely well-known, but verify |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none identified, but all are [ASSUMED] pending slopcheck run

*All packages above are tagged [ASSUMED]. The planner must insert a `checkpoint:human-verify` task before each npm install command.*

---

## Architecture Patterns

### System Architecture Diagram

```
Admin Panel (web-admin)                      API (Fastify)
     │                                             │
     │  POST /admin/categories                     │
     ├────────────────────────────────────────────>│
     │                                      CategoryService
     │                                        │  depth guard (D-01)
     │                                        │  DB insert (Drizzle)
     │                                        │  Redis invalidate (write-through)
     │  201 Created                           │
     │<────────────────────────────────────────────│
     │                                             │
     │  GET /categories (public tree)             │
 Storefront ─────────────────────────────────────>│
     │                                      CategoryService
     │                                        │  Redis GET "cat:tree"
     │                                        │    HIT → return cached JSON
     │                                        │    MISS → DB query → build tree
     │                                        │         → Redis SETEX
     │  200 { tree: [...] }                   │
 Storefront <─────────────────────────────────────│
     │                                             │
     │  GET /categories/:id/attributes            │
 Phase 3 ────────────────────────────────────────>│
     │                               AttributeDefinitionService
     │                                 → DB select attribute_definitions
     │                                   WHERE category_id = :id
     │                                   ORDER BY sort_order ASC
     │  200 { data: AttributeDefinition[] }  │
 Phase 3 <────────────────────────────────────────│
```

### Recommended Project Structure

```
apps/api/src/
├── db/
│   └── schema/
│       ├── index.ts              # add: export * from './categories.js' etc.
│       ├── feature-flags.ts      # existing
│       ├── categories.ts         # NEW: categories table + categoryStatusEnum
│       ├── attribute-definitions.ts  # NEW: attribute_definitions + attrTypeEnum
│       ├── filter-schema-definitions.ts  # NEW
│       ├── product-templates.ts  # NEW
│       ├── vendor-category-restrictions.ts  # NEW
│       └── category-metadata.ts  # NEW
│
├── modules/
│   ├── feature-flags/           # existing pattern to follow
│   ├── categories/              # NEW
│   │   ├── index.ts
│   │   ├── CategoryService.ts   # Redis-first, follows FeatureFlagService pattern
│   │   └── CategoryService.test.ts
│   └── attribute-definitions/   # NEW
│       ├── index.ts
│       └── AttributeDefinitionService.ts
│
└── routes/
    ├── feature-flags.ts         # existing pattern to follow
    ├── categories.ts            # NEW: public routes (GET /categories, GET /categories/:id/*)
    └── admin/
        └── categories.ts        # NEW: admin routes (CRUD + reorder)

packages/contracts/src/
├── index.ts                     # add: export * from './category/index.js'
├── category/                    # NEW domain subfolder
│   ├── index.ts                 # barrel: export * from all below
│   ├── tree.ts                  # CategoryTreeNode, CategoryTreeResponse
│   ├── attribute-definition.ts  # AttributeDefinition, AttrType, AttributeOption
│   ├── filter-schema.ts         # FilterSchemaDef, DisplayType
│   ├── product-template.ts      # ProductTemplate, TemplateField
│   ├── vendor-restriction.ts    # VendorCategoryRestriction
│   ├── metadata.ts              # CategoryMetadata (SEO + blocks)
│   └── blocks.ts                # BlockType discriminated union + Zod (D-14)

apps/web-admin/src/
├── pages/
│   └── categories/
│       ├── CategoryListPage.tsx        # Tree view + admin actions
│       ├── CategoryDetailPage.tsx      # Edit category + tabs
│       ├── AttributeBuilderPage.tsx    # Attribute list + reorder form
│       ├── FilterSchemaPage.tsx        # Filter config per attribute
│       ├── ProductTemplatePage.tsx     # Template field defaults
│       ├── VendorRestrictionsPage.tsx  # Approve/remove vendor list
│       └── CategoryMetadataPage.tsx    # SEO + blocks editor
└── components/
    └── categories/
        ├── CategoryTreeNode.tsx        # Single draggable tree row
        ├── CategoryTree.tsx            # dnd-kit SortableContext wrapper
        ├── AttributeRow.tsx            # Single attribute form row
        └── BlockEditor.tsx             # Block type selector + field form
```

### Pattern 1: CategoryService — Redis-First with Write-Through Invalidation

**What:** Mirrors FeatureFlagService exactly. `getTree()` checks `cat:tree` Redis key first; on miss, queries DB and builds nested tree structure, then caches. Admin mutations call `invalidateTree()` immediately after DB write (write-through, not TTL).

**When to use:** All public-facing category reads (GET /categories, any SSR/CSR consumer). Admin mutations (create/update/archive/reorder) must call invalidate after their DB operation.

**Example (derived from FeatureFlagService pattern):**
```typescript
// Source: apps/api/src/modules/feature-flags/FeatureFlagService.ts (project pattern)
export class CategoryService {
  private treeKey = 'cat:tree';

  constructor(private deps: { db: NodePgDatabase<any>; redis: Redis; env: Env }) {}

  async getTree(): Promise<CategoryTreeNode[]> {
    const { redis } = this.deps;
    const cached = await redis.get(this.treeKey);
    if (cached !== null) return JSON.parse(cached) as CategoryTreeNode[];

    const rows = await this.deps.db
      .select()
      .from(categories)
      .where(isNull(categories.archivedAt))
      .orderBy(asc(categories.sortOrder));

    const tree = buildTree(rows); // adjacency list → nested tree
    await redis.setex(this.treeKey, this.deps.env.CATEGORY_TREE_TTL_SECONDS, JSON.stringify(tree));
    return tree;
  }

  async invalidateTree(): Promise<void> {
    await this.deps.redis.del(this.treeKey);
  }

  async createCategory(input: CreateCategoryInput): Promise<SelectCategory> {
    // Depth guard (D-01)
    if (input.parentId) {
      const depth = await this.getDepth(input.parentId);
      if (depth >= 2) {  // 0-indexed: depth 2 = level 3 (leaf)
        throw new CategoryDepthError('Cannot create subcategory: maximum depth of 3 levels reached.');
      }
    }
    const [row] = await this.deps.db.insert(categories).values(input).returning();
    await this.invalidateTree();
    return row!;
  }
}
```

**Cache key convention (Claude's Discretion — recommended):** `cat:tree` for the full tree. Follow the `ff:<key>` prefix pattern with a `cat:` prefix namespace.

### Pattern 2: Adjacency List → Nested Tree Builder

**What:** A single flat query with `ORDER BY sort_order` is assembled into the nested tree in-memory. For a 3-level tree with bounded category counts, this is O(n) and simpler than recursive CTEs.

**When to use:** Every time the tree is built from DB (i.e., on Redis cache miss). The result is serialized to Redis.

**Example:**
```typescript
// Source: [ASSUMED] — standard adjacency list algorithm
function buildTree(rows: SelectCategory[]): CategoryTreeNode[] {
  const byId = new Map(rows.map(r => [r.id, { ...r, children: [] as CategoryTreeNode[] }]));
  const roots: CategoryTreeNode[] = [];
  for (const node of byId.values()) {
    if (node.parentId === null) {
      roots.push(node as CategoryTreeNode);
    } else {
      byId.get(node.parentId)?.children.push(node as CategoryTreeNode);
    }
  }
  return roots;
}
```

**Depth getter:**
```typescript
private async getDepth(categoryId: string): Promise<number> {
  // Walk up the parent chain — max 3 hops for a 3-level tree
  let depth = 0;
  let currentId: string | null = categoryId;
  while (currentId !== null) {
    const [row] = await this.deps.db.select({ parentId: categories.parentId })
      .from(categories).where(eq(categories.id, currentId)).limit(1);
    if (!row) break;
    currentId = row.parentId;
    depth++;
  }
  return depth;
}
```

### Pattern 3: Drizzle pgEnum + JSONB for Attribute Definitions

**What:** `attrTypeEnum` is a Drizzle pgEnum. The `options` column is JSONB typed with the `AttributeOption[]` TypeScript type. Drizzle's `.$type<>()` call on the jsonb column provides TypeScript-level typing.

**When to use:** All 6 attribute type definitions and the options storage.

**Example:**
```typescript
// Source: drizzle-orm docs [ASSUMED — needs Context7 confirmation]
import { pgEnum, jsonb, pgTable, uuid, text, boolean, integer, timestamp } from 'drizzle-orm/pg-core';

export const attrTypeEnum = pgEnum('attr_type', [
  'text', 'textarea', 'number', 'boolean', 'enum', 'multi_select'
]);

export const attributeDefinitions = pgTable('attribute_definitions', {
  id: uuid('id').defaultRandom().primaryKey(),
  categoryId: uuid('category_id').notNull().references(() => categories.id),
  key: text('key').notNull(),
  label: text('label').notNull(),
  attrType: attrTypeEnum('attr_type').notNull(),
  options: jsonb('options').$type<AttributeOption[]>(),  // null for non-enum types
  isRequired: boolean('is_required').notNull().default(false),
  isFilterable: boolean('is_filterable').notNull().default(false),
  isSearchable: boolean('is_searchable').notNull().default(false),
  sortOrder: integer('sort_order').notNull().default(0),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
}, (t) => ({
  uniq: unique().on(t.categoryId, t.key),
}));
```

### Pattern 4: Discriminated Union Block Types in contracts

**What:** Per D-14, block types are TypeScript discriminated unions with matching Zod schemas in `packages/contracts/src/category/blocks.ts`. All consumers (admin panel, API validation, Phase 4 CMS) import from here.

**When to use:** Everywhere the `blocks` JSONB array is read or written.

**Example:**
```typescript
// Source: packages/contracts/src/category/blocks.ts (D-14)
import { z } from 'zod';

export const BannerBlockSchema = z.object({
  type: z.literal('banner'),
  imageUrl: z.string().url(),
  title: z.string(),
  subtitle: z.string().optional(),
  ctaText: z.string().optional(),
  ctaUrl: z.string().url().optional(),
});

export const ProductGridBlockSchema = z.object({
  type: z.literal('product_grid'),
  title: z.string(),
  productIds: z.array(z.string().uuid()),
  layout: z.enum(['grid', 'carousel']),
});

export const TextBlockSchema = z.object({
  type: z.literal('text_block'),
  title: z.string(),
  content: z.string(),
});

export const MerchandisingBlockSchema = z.discriminatedUnion('type', [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
]);

export type MerchandisingBlock = z.infer<typeof MerchandisingBlockSchema>;
export type BannerBlock = z.infer<typeof BannerBlockSchema>;
export type ProductGridBlock = z.infer<typeof ProductGridBlockSchema>;
export type TextBlock = z.infer<typeof TextBlockSchema>;
```

### Pattern 5: Slug Generation (Claude's Discretion — Recommended)

**What:** Auto-generate slug from `name` using a URL-safe slugify function. If admin provides a custom slug, use it. If slug collides with an existing category, append a short ID suffix.

**Recommended approach:** Auto-derive from name with admin override field. Validate uniqueness at the DB level (unique constraint on `slug`) and surface a clear error on conflict.

```typescript
// Slug helper — [ASSUMED]
function slugify(text: string): string {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^\w\s-]/g, '')
    .replace(/[\s_-]+/g, '-')
    .replace(/^-+|-+$/g, '');
}
```

### Pattern 6: Display Type Enum for Filter Schema (Claude's Discretion — Recommended)

**What:** `display_type` on `filter_schema_definitions` maps attribute types to storefront filter widgets.

**Recommended mapping:**
| Attribute Type | Recommended Display Types |
|---------------|--------------------------|
| `text` | not filterable (text search only) |
| `textarea` | not filterable |
| `number` | `range_slider` |
| `boolean` | `toggle` |
| `enum` | `radio`, `checkbox` (single/multi choice) |
| `multi_select` | `checkbox` |

**Enum values for `display_type` pgEnum:** `checkbox`, `radio`, `range_slider`, `toggle`

### Anti-Patterns to Avoid

- **EAV for attribute values:** Storing category-specific attribute values as generic `(entity_id, key, value)` rows. Phase 2 avoids this by using JSONB on the products table (Phase 3) and a schema registry here. [VERIFIED: PITFALLS.md Pitfall 8, ARCHITECTURE.md Anti-Pattern 3]
- **Checking depth via DB constraint only:** A PSQL CHECK constraint on depth would require a computed column or trigger; the domain rule check in CategoryService gives a useful error message and is easier to test. [ASSUMED — best practice]
- **Unbounded tree depth with no limit:** Allowing arbitrary nesting degrades recursive query performance and complicates tree rendering. D-01 locks this at 3 levels. [VERIFIED: CONTEXT.md D-01]
- **Caching full tree with attribute detail included:** The full tree response is navigation-only (D-04). Including attribute definitions in the tree cache would make the cache invalidation surface too large. [VERIFIED: CONTEXT.md D-04]
- **Storing blocks as a separate table:** Per D-12, blocks are `jsonb[]` on `category_metadata`. A separate blocks table would require joins for every metadata read and complicates the forward-compatible extension path for Phase 4 CMS. [VERIFIED: CONTEXT.md D-12]
- **Hardcoding block types in the DB or API without contracts:** All block type definitions must live in `packages/contracts/src/category/blocks.ts` per D-14. [VERIFIED: CONTEXT.md D-14]

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Tree drag-and-drop reorder in admin | Custom mouse event tracking + reorder logic | `@dnd-kit/sortable` | Keyboard accessibility, pointer vs touch unification, active drag overlay — all handled [ASSUMED] |
| Slug generation | Ad-hoc string manipulation | Simple inline slugify function (3 lines) — OR a utility in `packages/contracts/src/category/` | Standard slug logic is trivial; no external package needed |
| Zod discriminated unions for blocks | Manual `if (block.type === ...)` type narrowing | `z.discriminatedUnion('type', [...])` | Zod handles exhaustive type narrowing and runtime validation simultaneously [VERIFIED: Zod docs] |
| Tree depth calculation | Recursive CTE in SQL | In-memory walk in CategoryService.getDepth() | For 3-level max, in-memory is O(3) — no query optimization needed |
| UUID generation in schema | Custom ID generator | `uuid('id').defaultRandom()` (Drizzle uses `gen_random_uuid()`) | Project pattern, already used in feature-flags schema [VERIFIED: feature-flags.ts] |

**Key insight:** The category engine is fundamentally a configuration system, not a transactional system. Complexity from premature optimization (nested sets, recursive CTEs, HNSW trees) adds no value at 3-level depth. Keep it simple.

---

## Database Schema Design

### Tables and Columns

**Table 1: `categories`**
```sql
CREATE TABLE categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  parent_id    uuid REFERENCES categories(id) ON DELETE RESTRICT,  -- adjacency list (D-02)
  name         text NOT NULL,
  slug         text NOT NULL UNIQUE,
  sort_order   integer NOT NULL DEFAULT 0,
  is_restricted boolean NOT NULL DEFAULT false,  -- D-09
  archived_at  timestamptz,  -- soft delete (null = active)
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX categories_parent_id ON categories(parent_id);
CREATE INDEX categories_sort_order ON categories(sort_order);
```
- No `depth` column — computed during tree assembly from parent traversal
- `archived_at` for soft-delete; admin can archive but not hard-delete (FK safety for Phase 3+ product references)
- `ON DELETE RESTRICT` on parent_id prevents orphan subtrees

**Table 2: `attribute_definitions`**
```sql
CREATE TYPE attr_type AS ENUM ('text','textarea','number','boolean','enum','multi_select');

CREATE TABLE attribute_definitions (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id  uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  key          text NOT NULL,
  label        text NOT NULL,
  attr_type    attr_type NOT NULL,
  options      jsonb,  -- [{value: string, label: string}] for enum/multi_select; null otherwise
  is_required  boolean NOT NULL DEFAULT false,
  is_filterable boolean NOT NULL DEFAULT false,
  is_searchable boolean NOT NULL DEFAULT false,
  sort_order   integer NOT NULL DEFAULT 0,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, key)
);
CREATE INDEX attr_def_category_id ON attribute_definitions(category_id);
```
- `is_filterable`: controls whether this attribute appears in filter schema builder (Phase 2 concern)
- `is_searchable`: controls OpenSearch projection (Phase 3 concern — Phase 2 sets the flag, Phase 3 reads it)
- `ON DELETE CASCADE` on category_id: deleting a category also removes its attribute definitions

**Table 3: `filter_schema_definitions`**
```sql
CREATE TYPE filter_display_type AS ENUM ('checkbox','radio','range_slider','toggle');

CREATE TABLE filter_schema_definitions (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id       uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  attribute_def_id  uuid NOT NULL REFERENCES attribute_definitions(id) ON DELETE CASCADE,
  display_type      filter_display_type NOT NULL,
  sort_order        integer NOT NULL DEFAULT 0,
  created_at        timestamptz NOT NULL DEFAULT now(),
  UNIQUE(category_id, attribute_def_id)
);
CREATE INDEX filter_schema_category_id ON filter_schema_definitions(category_id);
```
- Only attributes with `is_filterable = true` may be referenced here (enforced in service layer)
- `display_type` is a pgEnum (4 values — Claude's Discretion choice above)

**Table 4: `product_templates`**
```sql
CREATE TABLE product_templates (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  template_fields jsonb NOT NULL DEFAULT '[]',
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```
- One template per category (UNIQUE on category_id)
- `template_fields` structure: `Array<{ key: string; default?: string | number | boolean; hint?: string }>` — references attribute_definition keys by `key`, provides vendor UX hints and defaults

**Table 5: `vendor_category_restrictions`** (D-10)
```sql
CREATE TABLE vendor_category_restrictions (
  id                    uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id           uuid NOT NULL REFERENCES categories(id) ON DELETE CASCADE,
  vendor_id             uuid NOT NULL,  -- FK to vendors table (Phase 3 creates vendors table)
  created_at            timestamptz NOT NULL DEFAULT now(),
  created_by_admin_id   uuid NOT NULL,  -- FK to users/admin table (Phase 4)
  UNIQUE(category_id, vendor_id)
);
CREATE INDEX vcr_category_id ON vendor_category_restrictions(category_id);
CREATE INDEX vcr_vendor_id ON vendor_category_restrictions(vendor_id);
```
- `vendor_id` and `created_by_admin_id` are UUID columns without FK constraints in Phase 2 because the `vendors` and `users` tables do not exist yet. FKs are added as migrations in Phase 3 and Phase 4 when the referenced tables are created.

**Table 6: `category_metadata`** (D-12, D-13)
```sql
CREATE TABLE category_metadata (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  category_id     uuid NOT NULL UNIQUE REFERENCES categories(id) ON DELETE CASCADE,
  -- SEO fields (D-13)
  seo_title       text,
  seo_description text,
  seo_keywords    text,
  canonical_url   text,
  -- Merchandising blocks (D-12)
  blocks          jsonb NOT NULL DEFAULT '[]',
  -- Additional metadata
  description     text,  -- category landing page description (markdown/HTML)
  image_url       text,  -- category banner/hero image
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);
```
- `blocks` is a JSONB array of `MerchandisingBlock` objects (validated by Zod schema from contracts)
- One metadata row per category (UNIQUE on category_id); auto-created as empty on category creation, or lazy-created on first metadata save

### Migration Strategy

All 6 tables + 2 pgEnums ship in a single Drizzle migration file generated via `pnpm db:generate`. This is cleaner than incremental migrations and avoids FK ordering issues. The migration file is at `apps/api/src/db/migrations/`.

**Critical ordering in schema barrel** (`db/schema/index.ts`): `categories` must be exported before any table that references it:
```typescript
export * from './categories.js';           // first — others reference it
export * from './attribute-definitions.js';
export * from './filter-schema-definitions.js';
export * from './product-templates.js';
export * from './vendor-category-restrictions.js';
export * from './category-metadata.js';
export * from './feature-flags.js';        // existing
```

### GIN Index Consideration

`attribute_definitions.options` (JSONB) does not need a GIN index — it is only read by PK or category_id lookup. The GIN index on `products.attributes` (Phase 3) is where JSONB querying matters.

---

## Service Layer Patterns

### CategoryService

**Deps:** `db`, `redis`, `env` (same as FeatureFlagService)

**Public methods:**

| Method | Description | Cache behavior |
|--------|-------------|----------------|
| `getTree()` | Returns full nested tree (nav fields only) | Redis-first; SETEX on miss |
| `getCategoryById(id)` | Returns single category detail | No cache; direct DB read |
| `createCategory(input)` | Create with depth guard + slug gen | Invalidates `cat:tree` |
| `updateCategory(id, input)` | Update name/slug/sort/restricted | Invalidates `cat:tree` |
| `archiveCategory(id)` | Soft-delete (set archived_at) | Invalidates `cat:tree` |
| `reorderCategories(parentId, orderedIds)` | Batch update sort_order | Invalidates `cat:tree` |
| `invalidateTree()` | Explicit Redis invalidation | Deletes `cat:tree` |

**Depth guard:** Computed via in-memory parent traversal (max 3 hops). Throws typed `CategoryDepthError` with the message from D-01 specifics.

### AttributeDefinitionService

**Deps:** `db` only (no cache — attribute definitions are infrequently read in hot paths; Phase 3 can add caching if needed)

**Public methods:**

| Method | Description |
|--------|-------------|
| `getAttributesByCategory(categoryId)` | Returns all attribute_definitions for a category, sorted by sort_order |
| `createAttribute(input)` | Validate: options required for enum/multi_select; null for others |
| `updateAttribute(id, input)` | Update label, options, flags, sort_order |
| `deleteAttribute(id)` | Hard delete (no FK from products yet in Phase 2) |
| `reorderAttributes(categoryId, orderedIds)` | Batch update sort_order |

**Business rule:** When `attr_type` is `enum` or `multi_select`, `options` must be a non-empty array. When `attr_type` is `text`, `textarea`, `number`, or `boolean`, `options` must be null. Enforced in service layer + Zod schema.

### FilterSchemaService

**Deps:** `db`

**Public methods:**

| Method | Description |
|--------|-------------|
| `getFilterSchema(categoryId)` | Returns filter_schema_definitions with joined attribute info |
| `upsertFilterEntry(input)` | Create or update a filter entry for a category+attribute pair |
| `removeFilterEntry(id)` | Remove a filter entry |
| `reorderFilterEntries(categoryId, orderedIds)` | Batch sort_order update |

**Business rule:** Only attributes with `is_filterable = true` can be added to the filter schema. Enforced in service layer.

### ProductTemplateService

**Deps:** `db`

**Public methods:**

| Method | Description |
|--------|-------------|
| `getTemplate(categoryId)` | Returns template for a category (or null if none) |
| `upsertTemplate(categoryId, fields)` | Create or update template_fields JSON |

### VendorRestrictionService

**Deps:** `db`

**Public methods:**

| Method | Description |
|--------|-------------|
| `getRestrictions(categoryId)` | Returns list of vendor_ids approved for the category |
| `addVendorToCategory(input)` | Insert restriction row |
| `removeVendorFromCategory(categoryId, vendorId)` | Delete restriction row |
| `isVendorAllowed(categoryId, vendorId)` | Boolean check — used by Phase 3 catalog |
| `isCategoryRestricted(categoryId)` | Returns `is_restricted` flag from category row |

### CategoryMetadataService

**Deps:** `db`

**Public methods:**

| Method | Description |
|--------|-------------|
| `getMetadata(categoryId)` | Returns full metadata row |
| `upsertMetadata(categoryId, input)` | Create or update; validates blocks via Zod before DB write |

**Block validation:** `MerchandisingBlockSchema.array().parse(input.blocks)` runs before any DB write. If validation fails, return a 400 with per-block validation errors.

---

## API Contract Shapes

### Public Routes (consumed by storefront, Phase 3, Phase 4)

**GET /categories**
```typescript
// Response: ApiSuccess<CategoryTreeResponse>
type CategoryTreeNode = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;            // 0, 1, or 2
  hasChildren: boolean;
  childCount: number;
  children: CategoryTreeNode[];
};
type CategoryTreeResponse = { tree: CategoryTreeNode[] };
```

**GET /categories/:id**
```typescript
// Response: ApiSuccess<CategoryDetail>
type CategoryDetail = {
  id: string;
  name: string;
  slug: string;
  parentId: string | null;
  sortOrder: number;
  depth: number;
  isRestricted: boolean;
  archivedAt: string | null;
  createdAt: string;
  updatedAt: string;
};
```

**GET /categories/:id/attributes**
```typescript
// Response: ApiSuccess<{ attributes: AttributeDefinition[] }>
type AttributeOption = { value: string; label: string };
type AttrType = 'text' | 'textarea' | 'number' | 'boolean' | 'enum' | 'multi_select';
type AttributeDefinition = {
  id: string;
  categoryId: string;
  key: string;
  label: string;
  attrType: AttrType;
  options: AttributeOption[] | null;
  isRequired: boolean;
  isFilterable: boolean;
  isSearchable: boolean;
  sortOrder: number;
};
```

**GET /categories/:id/filters**
```typescript
// Response: ApiSuccess<{ filters: FilterSchemaDef[] }>
type DisplayType = 'checkbox' | 'radio' | 'range_slider' | 'toggle';
type FilterSchemaDef = {
  id: string;
  categoryId: string;
  attributeDefId: string;
  attribute: Pick<AttributeDefinition, 'key' | 'label' | 'attrType' | 'options'>;
  displayType: DisplayType;
  sortOrder: number;
};
```

**GET /categories/:id/template**
```typescript
// Response: ApiSuccess<ProductTemplate | null>
type TemplateField = {
  key: string;         // references an attribute_definition key
  default?: string | number | boolean;
  hint?: string;       // UX hint shown to vendor
};
type ProductTemplate = {
  id: string;
  categoryId: string;
  templateFields: TemplateField[];
};
```

**GET /categories/:id/metadata**
```typescript
// Response: ApiSuccess<CategoryMetadata>
type CategoryMetadata = {
  id: string;
  categoryId: string;
  seoTitle: string | null;
  seoDescription: string | null;
  seoKeywords: string | null;
  canonicalUrl: string | null;
  blocks: MerchandisingBlock[];  // typed union from @grovio/contracts/category/blocks
  description: string | null;
  imageUrl: string | null;
};
```

**GET /categories/:id/restrictions**
```typescript
// Response: ApiSuccess<{ isRestricted: boolean; approvedVendorIds: string[] }>
```

### Admin Routes (admin panel, behind admin auth middleware in Phase 4)

**POST /admin/categories**
```typescript
// Body (Zod-validated):
type CreateCategoryInput = {
  name: string;
  parentId?: string;       // omit for root categories
  slug?: string;           // optional override; auto-derived if omitted
  sortOrder?: number;
};
// Response: 201 ApiSuccess<CategoryDetail>
```

**PATCH /admin/categories/:id**
```typescript
type UpdateCategoryInput = Partial<Pick<CreateCategoryInput, 'name' | 'slug' | 'sortOrder'> & { isRestricted: boolean }>;
```

**POST /admin/categories/:id/archive**
```typescript
// No body; sets archived_at = now()
// Response: 200 ApiSuccess<CategoryDetail>
```

**POST /admin/categories/:id/reorder**
```typescript
// Body: { orderedIds: string[] }  — all sibling IDs in new order
// Sets sort_order = index for each ID
```

**POST /admin/categories/:id/attributes**
```typescript
type CreateAttributeInput = {
  key: string;
  label: string;
  attrType: AttrType;
  options?: AttributeOption[];  // required if attrType is enum or multi_select
  isRequired?: boolean;
  isFilterable?: boolean;
  isSearchable?: boolean;
  sortOrder?: number;
};
```

**PATCH /admin/categories/:id/attributes/:attrId**
**DELETE /admin/categories/:id/attributes/:attrId**
**POST /admin/categories/:id/attributes/reorder** (body: `{ orderedIds: string[] }`)

**PUT /admin/categories/:id/filters**
```typescript
// Replace entire filter schema for the category
type UpsertFilterSchemaInput = {
  filters: Array<{
    attributeDefId: string;
    displayType: DisplayType;
    sortOrder: number;
  }>;
};
```

**PUT /admin/categories/:id/template**
```typescript
type UpsertTemplateInput = { templateFields: TemplateField[] };
```

**PUT /admin/categories/:id/metadata**
```typescript
type UpsertMetadataInput = {
  seoTitle?: string;
  seoDescription?: string;
  seoKeywords?: string;
  canonicalUrl?: string;
  blocks?: MerchandisingBlock[];
  description?: string;
  imageUrl?: string;
};
```

**POST /admin/categories/:id/restrictions/vendors**
```typescript
// Body: { vendorId: string }
```
**DELETE /admin/categories/:id/restrictions/vendors/:vendorId**

---

## packages/contracts Additions

### New files under `packages/contracts/src/category/`

| File | Exports |
|------|---------|
| `blocks.ts` | `BannerBlockSchema`, `ProductGridBlockSchema`, `TextBlockSchema`, `MerchandisingBlockSchema`, all TypeScript types (D-14) |
| `tree.ts` | `CategoryTreeNodeSchema`, `CategoryTreeNode`, `CategoryTreeResponse` |
| `attribute-definition.ts` | `AttrTypeSchema`, `AttrType`, `AttributeOptionSchema`, `AttributeOption`, `AttributeDefinitionSchema`, `AttributeDefinition`, `CreateAttributeInputSchema` |
| `filter-schema.ts` | `DisplayTypeSchema`, `DisplayType`, `FilterSchemaDefSchema`, `FilterSchemaDef`, `UpsertFilterSchemaInputSchema` |
| `product-template.ts` | `TemplateFieldSchema`, `TemplateField`, `ProductTemplateSchema`, `ProductTemplate`, `UpsertTemplateInputSchema` |
| `vendor-restriction.ts` | `VendorCategoryRestrictionSchema`, `VendorCategoryRestriction` |
| `metadata.ts` | `CategoryMetadataSchema`, `CategoryMetadata`, `UpsertMetadataInputSchema` |
| `index.ts` | Barrel: `export * from './blocks.js'` etc. |

### Update `packages/contracts/src/index.ts`

Add: `export * from './category/index.js';`

---

## Admin UI Component Strategy

### Tree Display + Drag-and-Drop

**Component:** `CategoryTree` wraps `@dnd-kit/core`'s `DndContext` + `SortableContext`. Each `CategoryTreeNode` component renders as a draggable row. On `onDragEnd`, the component calls `POST /admin/categories/:id/reorder` with the new `orderedIds` array. Optimistic update via React Query's `useMutation` + `onMutate` to avoid flicker.

The tree is rendered as a flat list with visual indentation based on `depth`, not as a true nested DOM tree. This is standard for sortable tree implementations with dnd-kit because nested `SortableContext` providers add complexity. Indentation is achieved via Tailwind padding classes (`pl-0`, `pl-8`, `pl-16`).

**Expand/collapse state:** Zustand store in `apps/web-admin/src/stores/categoryUiStore.ts`. Persisted to `localStorage` so panel state survives page refresh.

**Category detail vs creation:** Clicking a tree node navigates to `/admin/categories/:id` (React Router). Creating a new category opens a slide-over panel (Framer Motion `AnimatePresence` + `motion.div` from `motion/react`).

### Attribute Builder

Per D-08: simple form list with reorder. No drag-from-palette. Each row is a compact form with:
- Key input (auto-generated from label, editable)
- Label input
- Type dropdown (6 options)
- Required checkbox
- Filterable checkbox
- Searchable checkbox
- Up/down arrow buttons for reorder

The `@dnd-kit/sortable` `useSortable` hook handles the drag handle per row. The list of attribute rows is local component state (array) until the user clicks Save — then a single `PUT` or `PATCH` request fires.

**Options editor:** Rendered conditionally when `attrType === 'enum' || attrType === 'multi_select'`. Shows a dynamic list of `{ value, label }` input pairs with Add/Remove buttons. Options are part of the same form state.

### Block Editor

A minimal block editor using a `+` button to add a block of a chosen type (banner / product_grid / text_block dropdown selector). Each block type renders its own form fields. Blocks are reorderable via `@dnd-kit/sortable`. On save, the entire `blocks` array is sent to `PUT /admin/categories/:id/metadata`.

No WYSIWYG editor in v1 — `description` is plain text or Markdown stored as-is; Phase 4 can enhance the editor.

### Pagination for Admin Category List (Claude's Discretion — Recommended)

Use offset pagination (`?page=1&limit=50`) for the admin category list. Categories are expected to be in the dozens to low hundreds — cursor pagination adds complexity with no benefit at this scale.

---

## Integration Contract (What Downstream Phases Read)

### Phase 3 (Catalog & Search) reads from Phase 2:

| What | Table/Endpoint | How Used |
|------|---------------|----------|
| Category existence check | `categories` table | Validate `category_id` on product create |
| Vendor allowed in category | `vendor_category_restrictions` + `categories.is_restricted` | Gate vendor product creation |
| Attribute schema for a category | `attribute_definitions WHERE category_id = :id` | Validate submitted product JSONB attributes |
| `is_searchable` flag per attribute | `attribute_definitions.is_searchable` | Determine which fields to project into OpenSearch |
| `is_filterable` flag per attribute | `attribute_definitions.is_filterable` | Generate facet config for OpenSearch mapping |
| Product template for a category | `product_templates WHERE category_id = :id` | Drive vendor product-create form in Phase 6 |

**Stable contract:** `attribute_definitions.category_id`, `key`, `attr_type`, `is_searchable`, `is_filterable` are locked column names. Phase 3 imports from `@grovio/contracts/category/attribute-definition` for TypeScript types.

### Phase 4 (Customer Storefront) reads from Phase 2:

| What | Endpoint | How Used |
|------|---------|----------|
| Full category tree | `GET /categories` | Navigation sidebar, category landing page URLs |
| Per-category filter schema | `GET /categories/:id/filters` | Dynamic filter panel rendering on PLP |
| Per-category metadata | `GET /categories/:id/metadata` | SEO tags, category hero image, merchandising blocks |
| Block types | `@grovio/contracts/category/blocks` | Type-safe rendering of banner/product_grid/text_block |

**Stable contract:** `GET /categories` response shape, `GET /categories/:id/filters` response shape, and the `MerchandisingBlock` discriminated union are locked contracts once Phase 4 begins. Do not change these shapes after Phase 2 ships.

### Phase 5 (Commerce Core) reads from Phase 2:

| What | Table | How Used |
|------|-------|----------|
| Commission FK on category_id | `categories.id` | `commission_rules.category_id` references this UUID |

**Stable contract:** `categories.id` UUID values must remain stable after Phase 2. Do not truncate or re-seed the categories table without regenerating commission rules.

---

## Common Pitfalls

### Pitfall 1: EAV for Product Attributes
**What goes wrong:** Storing `(product_id, attribute_key, attribute_value)` rows instead of JSONB. [VERIFIED: PITFALLS.md Pitfall 8]
**How to avoid:** The Phase 2 `attribute_definitions` table is the schema registry; Phase 3 `products.attributes` is JSONB + GIN index.
**Warning sign:** Any table named `product_attribute_values` or `entity_attribute_values` in the schema.

### Pitfall 2: Missing Write-Through Cache Invalidation
**What goes wrong:** Admin creates a new category; public `GET /categories` still returns stale tree from Redis cache.
**Why it happens:** Forgetting to call `invalidateTree()` after every CategoryService mutation.
**How to avoid:** The invalidation call is inside CategoryService methods (createCategory, updateCategory, archiveCategory, reorderCategories) — not in the route handler. This makes it impossible to bypass by adding a new route.
**Warning sign:** Route handler calls `db.insert()` directly without going through CategoryService.

### Pitfall 3: Depth Enforcement in DB Only
**What goes wrong:** A `CHECK` constraint or trigger returns a cryptic database error instead of the user-friendly message defined in D-01.
**How to avoid:** Depth check runs in CategoryService before the DB insert. DB has no depth constraint (not needed with service-layer enforcement). Error message: `"Cannot create subcategory: maximum depth of 3 levels reached."` [VERIFIED: CONTEXT.md specifics]

### Pitfall 4: Orphaned attribute_definitions After Category Archive
**What goes wrong:** Attribute definitions for archived categories are still returned by queries that filter on `is_archived`.
**How to avoid:** `attribute_definitions` has `ON DELETE CASCADE` — but archive is a soft-delete (sets `archived_at`). The service layer must filter `WHERE archived_at IS NULL` on all category reads and exclude archived category IDs from attribute lookups.

### Pitfall 5: Block Type Validation Deferred to Frontend
**What goes wrong:** Admin panel sends malformed blocks (e.g., `product_grid` missing `productIds`). Without server-side validation, bad data is written to JSONB and causes Phase 4 rendering errors.
**How to avoid:** `CategoryMetadataService.upsertMetadata()` runs `MerchandisingBlockSchema.array().parse(input.blocks)` before any DB write. Validation error returns 400 with Zod error details.

### Pitfall 6: vendor_category_restrictions FK Missing Until Phase 3
**What goes wrong:** Phase 2 inserts `vendor_id` values into `vendor_category_restrictions` that reference a non-existent `vendors` table. Foreign key added in Phase 3 migration may fail if data was inserted with invalid vendor_ids.
**How to avoid:** Phase 2 admin UI for vendor restrictions is behind an admin-auth guard (Phase 4) so this table is empty at Phase 2 completion. The FK is added in Phase 3 migration only — documented in the Phase 3 migration file comment.

### Pitfall 7: Slug Collision on Category Rename
**What goes wrong:** Admin renames "Electronics" to a name whose generated slug already exists for another category. DB unique constraint on `slug` fires, returning a 500 instead of a useful error.
**How to avoid:** CategoryService checks slug uniqueness before insert/update. If slug collides, append `-2`, `-3` etc. (or return 409 with a message asking admin to choose a unique slug).

### Pitfall 8: Admin Route Leaks Without Auth Guard
**What goes wrong:** `/admin/categories` endpoints are accessible without authentication before Phase 4 auth is wired. Phase 2 ships admin routes; auth middleware is Phase 4.
**How to avoid:** Mount admin routes only when `NODE_ENV !== 'production'` OR add a basic `X-Admin-Token` header check as a placeholder guard in Phase 2. Document that Phase 4 replaces this with proper JWT middleware. [ASSUMED — best practice]

---

## Validation Architecture

> `workflow.nyquist_validation` is `true` in `.planning/config.json` — this section is required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | None — `"test": "vitest run"` in `apps/api/package.json`; Vitest auto-discovers `*.test.ts` files |
| Quick run command | `pnpm --filter @grovio/api test` |
| Full suite command | `pnpm test` (Turborepo runs all workspaces) |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| CAT-01 | Category create/update/archive persists to DB | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-01 | Archive sets archived_at; does not hard-delete | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-01 | Reorder updates sort_order for all siblings | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-01 | Cache invalidated after each mutation | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-02 | Creating subcategory at depth 3 throws CategoryDepthError | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-02 | buildTree correctly assembles flat rows into 3-level nested structure | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-02 | GET /categories returns cached tree on Redis HIT, bypasses DB | unit | `pnpm --filter @grovio/api test CategoryService` | ❌ Wave 0 |
| CAT-03 | Attribute with type=enum requires non-empty options; type=boolean rejects options | unit | `pnpm --filter @grovio/api test AttributeDefinitionService` | ❌ Wave 0 |
| CAT-03 | Attribute key is unique per category; duplicate key throws | unit | `pnpm --filter @grovio/api test AttributeDefinitionService` | ❌ Wave 0 |
| CAT-04 | Filter entry can only reference attribute with is_filterable=true | unit | `pnpm --filter @grovio/api test FilterSchemaService` | ❌ Wave 0 |
| CAT-04 | GET /categories/:id/filters returns filter entries joined with attribute metadata | unit | `pnpm --filter @grovio/api test FilterSchemaService` | ❌ Wave 0 |
| CAT-05 | Template upsert stores/retrieves templateFields JSONB correctly | unit | `pnpm --filter @grovio/api test ProductTemplateService` | ❌ Wave 0 |
| CAT-06 | addVendorToCategory inserts restriction row; duplicate throws | unit | `pnpm --filter @grovio/api test VendorRestrictionService` | ❌ Wave 0 |
| CAT-06 | isVendorAllowed returns true for approved vendor, false for unknown | unit | `pnpm --filter @grovio/api test VendorRestrictionService` | ❌ Wave 0 |
| CAT-07 | upsertMetadata validates blocks via Zod; rejects malformed block | unit | `pnpm --filter @grovio/api test CategoryMetadataService` | ❌ Wave 0 |
| CAT-07 | MerchandisingBlockSchema rejects unknown type; accepts all 3 valid types | unit | `pnpm --filter @grovio/contracts test` | ❌ Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grovio/api test`
- **Per wave merge:** `pnpm test` (full Turborepo suite)
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/categories/CategoryService.test.ts` — covers CAT-01, CAT-02
- [ ] `apps/api/src/modules/attribute-definitions/AttributeDefinitionService.test.ts` — covers CAT-03
- [ ] `apps/api/src/modules/filter-schema/FilterSchemaService.test.ts` — covers CAT-04
- [ ] `apps/api/src/modules/product-templates/ProductTemplateService.test.ts` — covers CAT-05
- [ ] `apps/api/src/modules/vendor-restrictions/VendorRestrictionService.test.ts` — covers CAT-06
- [ ] `apps/api/src/modules/category-metadata/CategoryMetadataService.test.ts` — covers CAT-07
- [ ] `packages/contracts/src/category/blocks.test.ts` — covers block type Zod validation (CAT-07)

Test mock pattern: mirror `FeatureFlagService.test.ts` — mock `db`, `redis`, `env` with `vi.fn()` chains. No real DB or Redis connection needed in unit tests.

---

## Security Domain

> `security_enforcement: true` and `security_asvs_level: 1` in `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No (Phase 4 delivers auth) | Admin routes need placeholder guard in Phase 2 (see Pitfall 8) |
| V3 Session Management | No | Phase 4 |
| V4 Access Control | Yes — admin routes must not be publicly accessible | Placeholder `X-Admin-Token` guard or dev-only mount until Phase 4 auth |
| V5 Input Validation | Yes | Zod schemas on all request bodies; imported from `@grovio/contracts` |
| V6 Cryptography | No | No crypto operations in Phase 2 |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Unauthenticated admin category mutation | Elevation of Privilege | Admin routes guarded (placeholder in Phase 2, proper JWT in Phase 4) |
| Malformed JSONB blocks injection | Tampering | `MerchandisingBlockSchema.array().parse()` in CategoryMetadataService before DB write |
| Depth bypass via direct DB insert | Tampering | Depth guard in CategoryService; admin routes always go through service layer, never direct DB access |
| Slug injection (XSS via category slug) | Tampering | Slugify function strips non-safe characters; slug output used in URL construction, not HTML rendering |
| Orphan vendor_ids without FK | Tampering | Phase 2 documents: FK added in Phase 3; Phase 2 admin UI is dev-only/guarded |

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| PostgreSQL | All DB tables | ✓ (Phase 1 docker-compose) | 16+ (configured in docker-compose) | — |
| Redis | Category tree cache | ✓ (Phase 1 docker-compose) | 7.x (configured in docker-compose) | — |
| Node.js 22 LTS | API runtime | ✓ (Phase 1 verified) | 22.x | — |
| pnpm 9.x | Package install | ✓ (Phase 1 scaffold) | 9.x | — |
| drizzle-kit 1.0.0-beta | Migration generation | ✓ (in apps/api devDependencies) | 1.0.0-beta | — |

**Missing dependencies with no fallback:** None — all required dependencies were established in Phase 1.

**New dependency (web-admin):** `@dnd-kit/*` and `react-router-dom` must be added to `apps/web-admin/package.json`. These are new for Phase 2 and subject to slopcheck before install.

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| EAV for dynamic product attributes | JSONB + schema registry (attribute_definitions table) | Well-established by 2020; this project uses it from Phase 2 | No filter query performance collapse |
| react-beautiful-dnd | @dnd-kit (or @hello-pangea/dnd fork) | ~2022 (rbd abandoned) | Accessibility + React 18/19 compatibility |
| Tailwind CSS v3 PostCSS config | Tailwind CSS v4 `@tailwindcss/vite` plugin | 2024 (v4 stable) | No `tailwind.config.js` needed; CSS-native config |
| Nested sets for tree storage | Adjacency list for bounded-depth trees | Not a time-based change — context-dependent | Adjacency list is correct for 3-level max depth |

**Deprecated/outdated:**
- `react-beautiful-dnd`: Archived/unmaintained. Do not use. [ASSUMED]
- Tailwind CSS PostCSS path: Replaced by `@tailwindcss/vite` in v4. [VERIFIED: CLAUDE.md]
- `jsonwebtoken` (not used in Phase 2 but worth noting for context): Replaced by `jose`. [VERIFIED: CLAUDE.md]

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | @dnd-kit/core and @dnd-kit/sortable support React 19 | Standard Stack, Admin UI | If React 19 incompatible, need to find alternative DnD library before admin UI work begins |
| A2 | react-beautiful-dnd is abandoned/unmaintained | Standard Stack | Low risk — if it works with React 19, it's a valid alternative; choose dnd-kit regardless for active maintenance |
| A3 | react-router-dom is not yet installed in web-admin | Project Structure | If already installed, skip that install step; check web-admin package.json before adding |
| A4 | In-memory parent traversal for depth check (max 3 hops) is preferable to a recursive CTE | Service Layer | At 3-level max, performance is identical; if depth limit ever changes, CTE becomes preferable |
| A5 | Placeholder admin guard (X-Admin-Token or dev-only mount) is acceptable for Phase 2 given auth is Phase 4 | Security | If security review requires auth before Phase 4, this decision must be revisited |
| A6 | vendor_id FK is safely deferred to Phase 3 migration | DB Schema | If Phase 3 inserts vendor_ids that don't exist in the vendors table before the FK is added, data integrity could be violated; acceptable because Phase 3 owns vendor creation |

**Verified claims:** All DB schema patterns, all Drizzle API usage, all service-layer patterns, all contracts patterns — verified against existing codebase (feature-flags.ts, FeatureFlagService.ts, container.ts, app.ts, packages/contracts/src/).

---

## Open Questions (RESOLVED)

1. **Should `category_metadata` be auto-created on category creation (empty row) or lazily on first save?**
   - What we know: Lazy creation avoids rows with all-null content; auto-creation avoids null-check in every metadata read.
   - Recommendation: Lazy-create on first `PUT /admin/categories/:id/metadata` call. Return `null` (or empty default) from `GET /categories/:id/metadata` if no row exists. This keeps the DB clean for early-stage deployments.

2. **Should `product_templates.template_fields` reference `attribute_definition.id` (UUID) or `key` (text string)?**
   - What we know: Using `key` is human-readable and survives attribute re-creation; using `id` is a stable FK reference but breaks if an attribute is deleted and recreated.
   - Recommendation: Use `key` (text). The `key` is the identity of an attribute concept in a category. If an admin deletes and recreates an attribute with the same key, the template still works. This also avoids FK complexity on a JSONB column.

3. **Should the admin category routes be mounted in Phase 2 without real auth, or deferred to Phase 4?**
   - What we know: Admin UI must be built in Phase 2; routes must be accessible to the admin React app. Full auth is Phase 4.
   - Recommendation: Mount admin routes in Phase 2 with a `NODE_ENV !== 'production'` guard OR a simple `X-Internal-Admin-Token: <env var>` header check. Document clearly that Phase 4 replaces this.

---

## Sources

### Primary (HIGH confidence — verified against project codebase)
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis-first cache pattern, invalidation strategy, Awilix deps interface
- `apps/api/src/db/schema/feature-flags.ts` — Drizzle pgTable structure, jsonb column, timestamp, uuid, boolean column patterns
- `apps/api/src/routes/feature-flags.ts` — Fastify route plugin pattern, diContainer.resolve, reply.send, error shapes
- `apps/api/src/container.ts` — Awilix createContainer, asClass, asValue registration pattern
- `apps/api/src/app.ts` — Plugin registration order, route plugin mounting, error handler pattern
- `packages/contracts/src/index.ts` — Barrel export pattern, domain subfolder convention
- `packages/contracts/src/envelope.ts` — ApiSuccessSchema, ApiError shape, ApiResponse union
- `packages/contracts/src/feature-flags.ts` — Zod schema with .optional(), z.union(), z.infer pattern
- `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` — Vitest mock pattern for db + redis chains
- `.planning/phases/02-category-engine/02-CONTEXT.md` — All locked decisions D-01 through D-14

### Secondary (MEDIUM confidence — official project documentation)
- `.planning/research/ARCHITECTURE.md` §"Dynamic Category / Attribute Schema Modeling" — JSONB + schema registry pattern, recommended SQL shape, filtering flow
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns to Avoid" — Anti-Pattern 3 (EAV), Anti-Pattern 6 (search mapping)
- `.planning/research/PITFALLS.md` — Pitfall 8 (EAV), Pitfall 14 (productization)
- `CLAUDE.md` §"Recommended Stack" — version pins, what NOT to use
- `.planning/REQUIREMENTS.md` — CAT-01 through CAT-07 requirement text

### Tertiary (LOW confidence — ASSUMED, needs validation before execution)
- @dnd-kit React 19 compatibility — claimed from community knowledge, must be verified before install
- react-beautiful-dnd abandonment status — claimed from training knowledge, should be spot-checked
- react-router-dom not in web-admin yet — inferred from reviewing web-admin package.json (no react-router-dom present)

---

## Metadata

**Confidence breakdown:**
- Standard Stack (backend): HIGH — all packages already installed and in use
- Standard Stack (admin UI new packages): LOW — @dnd-kit not yet verified
- DB Schema: HIGH — directly derived from project patterns + ARCHITECTURE.md
- Service Layer Patterns: HIGH — mirrors existing FeatureFlagService exactly
- API Contract Shapes: HIGH — derived from locked decisions + downstream integration analysis
- Admin UI Strategy: MEDIUM — React 19 + dnd-kit compatibility is ASSUMED
- Integration Contract: HIGH — derived from CONTEXT.md, ARCHITECTURE.md, REQUIREMENTS.md
- Pitfalls: HIGH — verified against PITFALLS.md and codebase patterns
- Security: MEDIUM — ASVS L1 applied; placeholder auth guard is a pragmatic choice pending Phase 4

**Research date:** 2026-05-29
**Valid until:** 2026-06-29 (30 days — stable stack with locked decisions)

---

## RESEARCH COMPLETE
