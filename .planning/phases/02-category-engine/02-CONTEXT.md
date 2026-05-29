# Phase 2: Category Engine - Context

**Gathered:** 2026-05-29
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete category engine: an admin-managed category taxonomy with nested trees (3 levels max), per-category typed attribute schemas, filter schemas, product templates, vendor-category access restrictions, and category metadata (banners, SEO, merchandising blocks). No product catalog, no storefront UI, no Phase 3+ features. The output of this phase is what makes Grovio vertical-agnostic at runtime — all downstream phases depend on the schema and API contracts locked here.

</domain>

<decisions>
## Implementation Decisions

### Category Tree Structure
- **D-01:** Maximum nesting depth is **3 levels**: Root → Subcategory → Leaf. Enforced at the API level (reject parent_id assignments that would exceed depth 3). This covers all 5 demo verticals (grocery, electronics, furniture, party supplies, tools) without the complexity of unlimited depth.
- **D-02:** Storage model: adjacency list with `parent_id` + `sort_order` columns. No nested sets or materialized paths — adjacency list is sufficient for 3-level trees with manual admin reordering.
- **D-03:** Public category tree API returns the full nested tree in a single response (`GET /categories`), Redis-cached using the same TTL-backed pattern as FeatureFlagService. Admin writes (create/update/archive/reorder) invalidate the cache immediately (write-through invalidation, not TTL expiry).
- **D-04:** The full tree response includes only tree navigation fields: `id`, `name`, `slug`, `parentId`, `sortOrder`, `depth`, `hasChildren`, `childCount`. Per-category detail (attributes, filter schema, metadata/SEO, merchandising blocks) is fetched lazily via per-category endpoints when navigating to that category.

### Attribute Type System
- **D-05:** v1 supports **6 core attribute types**: `text` (short text), `textarea` (long text), `number` (integer or decimal), `boolean` (yes/no), `enum` (single-select from a defined options list), `multi_select` (multi-select from a defined options list). `range` and `date` types are deferred to v1.x.
- **D-06:** The `attr_type` column is a Drizzle `pgEnum` covering these 6 values. This is the exhaustive v1 enum — no free-form type strings.
- **D-07:** Attribute definitions with `options` (enum/multi_select) store the options list as a `jsonb` column: `[{ value: string, label: string }]`. Ordering is preserved.
- **D-08:** Admin attribute-builder UI: **simple form list with reorder**. Each attribute is a row with fields: key, label, type dropdown (6 options), required checkbox, is_filterable checkbox, sort order. Reorder via up/down buttons or a simple drag handle per row. No drag-from-palette field builder in v1 — the category tree drag-and-drop (DnD) is the primary DnD surface.

### Vendor-Category Access Model
- **D-09:** Categories default to **open** (any approved vendor can create products in any category). Admin can mark specific categories as `is_restricted = true`. Restricted categories have an explicit `vendor_category_restrictions` table listing approved vendor IDs.
- **D-10:** The `vendor_category_restrictions` table stores `{ id, category_id, vendor_id, created_at, created_by_admin_id }`. It is a Phase 2 data contract — Phase 3 catalog enforcement reads from this table when checking whether a vendor may create a product in a given category.
- **D-11:** Restriction enforcement happens in Phase 3 (catalog module), not Phase 2. Phase 2 delivers: the schema, the admin CRUD API for managing approved vendors per restricted category, and the query API that returns restriction state per category.

### Merchandising Blocks Schema
- **D-12:** Category metadata uses a **typed block model** for merchandising blocks (stored as `jsonb[]` in a `blocks` column). v1 block union:
  - `{ type: 'banner', imageUrl: string, title: string, subtitle?: string, ctaText?: string, ctaUrl?: string }`
  - `{ type: 'product_grid', title: string, productIds: string[], layout: 'grid' | 'carousel' }`
  - `{ type: 'text_block', title: string, content: string }`
  Phase 4 CMS extends this union (adds new block types) without requiring a schema migration.
- **D-13:** SEO fields are flat columns on the `category_metadata` table, not block types: `seo_title`, `seo_description`, `seo_keywords`, `canonical_url`. This is the v1 shape; Phase 4 may add structured data fields.
- **D-14:** The typed block model is defined in `packages/contracts/src/category/blocks.ts` as TypeScript discriminated unions + Zod schemas. All consumers (admin panel, public API, Phase 4 CMS) import from contracts — no duplication.

### Claude's Discretion
- Category slug generation strategy (auto-derived from name vs. admin-provided with auto-fallback)
- Filter schema `display_type` enum values (checkbox, radio, range_slider, toggle — planner chooses set based on 6 attribute types)
- Product template JSON structure (field defaults + hints per attribute_definition)
- Redis cache key naming convention for category tree (following the pattern established in FeatureFlagService)
- Pagination strategy for admin category list endpoint (offset vs cursor — low priority given expected category counts)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §"Category Engine" — CAT-01 through CAT-07, the 7 Phase 2 requirements
- `.planning/ROADMAP.md` §"Phase 2: Category Engine" — goal, success criteria (5 SCs), and dependency on Phase 1

### Architecture Patterns
- `.planning/research/ARCHITECTURE.md` §"Dynamic Category / Attribute Schema Modeling" — JSONB + Schema Registry pattern (not EAV); the recommended SQL shape for `attribute_definitions`, `filter_schema_definitions`, and `products`; the filtering flow (admin → vendor → backend validation → search projection)
- `.planning/research/ARCHITECTURE.md` §"Monorepo Layout" — confirms `packages/contracts` as single source of truth; per-domain subfolder pattern
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns to Avoid" — Anti-Pattern 3: EAV Product Attributes (DO NOT use EAV; use JSONB + schema registry); Anti-Pattern 6: Search Mapping From Arbitrary Runtime Fields (only schema-approved searchable fields may map into OpenSearch — Phase 3 alignment)

### Technology Stack
- `CLAUDE.md` §"Recommended Stack" — definitive version-pinned stack; especially: Drizzle ORM 0.45.x + drizzle-kit 1.0.0-beta for schema/migrations, Fastify 5.8.x route patterns, Awilix 13.0.x DI registration, Tailwind CSS 4.3.x + `@tailwindcss/vite` for admin UI, React 19.2.x, Zod 4.4.x for schema validation
- `CLAUDE.md` §"What NOT to Use" — no EAV, no FLOAT/DECIMAL for money columns (not directly relevant here but BIGINT is still required for any price fields that appear in product templates)

### Phase 1 Patterns to Follow
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis cache + DB fallback pattern; TTL invalidation; Awilix registration pattern. Category tree caching follows this exactly.
- `apps/api/src/db/schema/feature-flags.ts` — Drizzle schema file structure; how to add a new schema file and re-export from `apps/api/src/db/schema/index.ts`
- `apps/api/src/routes/feature-flags.ts` — Fastify route registration pattern; Zod request validation pattern
- `apps/api/src/container.ts` — Awilix container registration; how to add new services
- `packages/contracts/src/index.ts` — contracts barrel export pattern; how to add new domain subfolders

### Research Context
- `.planning/research/FEATURES.md` §"1. Customer Storefront" — confirms dynamic category-specific faceted filters and category-specific attribute display on PDP are key differentiators; attribute schemas must support the Phase 4 storefront
- `.planning/research/PITFALLS.md` — review for any category-engine-specific pitfalls before planning

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts`: Redis cache + DB fallback service. Category tree cache service (`CategoryCacheService` or inline in `CategoryService`) follows the same pattern — same TTL env var approach, same write-invalidation strategy.
- `apps/api/src/db/schema/feature-flags.ts`: Drizzle schema file template. Each new table (categories, attribute_definitions, etc.) is a separate file added to `db/schema/` and re-exported from `db/schema/index.ts`.
- `apps/api/src/routes/health.ts` + `apps/api/src/routes/feature-flags.ts`: Fastify route registration examples with Zod schema validation. Admin category routes follow the same plugin/registration pattern.
- `packages/contracts/src/`: Subfolder-per-domain pattern. Phase 2 adds `packages/contracts/src/category/` with `index.ts`, `tree.ts`, `attribute-definition.ts`, `filter-schema.ts`, `product-template.ts`, `vendor-restriction.ts`, `blocks.ts`.
- `apps/web-admin/`: Phase 1 admin shell boots on port 5175 with Tailwind v4 + React 19. Phase 2 category management pages are added here.
- `packages/ui/src/tokens/tokens.css`: Design tokens for all three web apps. Admin category UI uses these tokens directly via Tailwind v4 classes.

### Established Patterns
- **DI registration**: Services registered in `apps/api/src/container.ts` using Awilix `asClass()` — downstream plans add CategoryService, AttributeDefinitionService, etc. the same way.
- **Route plugin pattern**: Fastify routes are registered as plugins in `apps/api/src/app.ts`. Admin routes mount under `/admin/*`, public routes under `/categories/*`.
- **Zod validation**: All request bodies and query params validated via Zod schemas imported from `@grovio/contracts`. No manual validation.
- **Redis TTL pattern**: `FEATURE_FLAG_TTL_SECONDS` env var pattern — Category tree cache TTL uses a new `CATEGORY_TREE_TTL_SECONDS` env var following the same convention.
- **TypeScript strict mode**: All files use strict TypeScript. No `any` in new code.

### Integration Points
- `apps/api/src/db/schema/index.ts` — barrel re-export; add `export * from './categories.js'`, `export * from './attribute-definitions.js'`, etc.
- Phase 3 (catalog) reads `attribute_definitions` and `vendor_category_restrictions` from Phase 2 schema — do not change these table names or key column names after Phase 2.
- Phase 4 (storefront) reads `GET /categories` tree + `GET /categories/:id/filters` — public API shapes are locked contracts once Phase 4 begins.
- Phase 4 (CMS/homepage) imports block types from `@grovio/contracts/category/blocks` — block discriminated union is a forward-compatible contract.

</code_context>

<specifics>
## Specific Ideas

- The 3-level depth enforcement should be a domain rule checked in the CategoryService use case (not just a DB constraint) so the error message is meaningful: `"Cannot create subcategory: maximum depth of 3 levels reached."`
- The `GET /categories` full-tree response should be the minimal navigation shape only (id, name, slug, parentId, sortOrder, depth, hasChildren). Per-category detail is always fetched per-category — this avoids a performance cliff as the catalog grows.
- `vendor_category_restrictions` is a Phase 2 data contract. Phase 3 catalog enforcement imports the query pattern but Phase 2 owns the schema and admin CRUD.
- The typed block model (`packages/contracts/src/category/blocks.ts`) should export both TypeScript types and Zod schemas. The Zod schema validates admin input server-side; the TypeScript type is what the admin panel and Phase 4 storefront import.
- `is_searchable` and `is_filterable` on `attribute_definitions` are distinct flags: `is_searchable` controls OpenSearch projection (Phase 3 concern); `is_filterable` controls whether the attribute appears in the filter schema builder (Phase 2 concern). Both flags live on the attribute definition, both default to false.

</specifics>

<deferred>
## Deferred Ideas

- **Vendor restriction enforcement at product creation** — Phase 3 (catalog module). Phase 2 only delivers the schema + admin CRUD + query API.
- **OpenSearch mapping generation from attribute_definitions** — Phase 3 blocker. Decide during Phase 2 execution while the schema is being finalized. Architectural constraint (ARCHITECTURE.md): only `is_searchable = true` attributes may project into OpenSearch.
- **Admin UI for category analytics** (view count per category, product count) — Phase 6 (admin dashboard, ADM-01).
- **Category-level commission override** (e.g., electronics carries 15% commission vs global 10%) — Phase 5 (commission engine, MKT-01). The `category_id` FK on commission rules table references Phase 2 categories — keep the `id` UUID stable.
- **i18n per-category names/descriptions** — deferred to v2 (INTL-01 in v2 requirements).
- **Vendor-supplied category suggestions** (vendor proposes a new category; admin approves) — not in v1 scope.

None of the above add scope to Phase 2. Discussion stayed within phase boundaries.

</deferred>

---

*Phase: 2-Category Engine*
*Context gathered: 2026-05-29*
