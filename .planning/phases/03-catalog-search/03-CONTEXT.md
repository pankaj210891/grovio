# Phase 3: Catalog & Search - Context

**Gathered:** 2026-05-31
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete product catalog and search layer: vendors create and manage products whose fields are driven by category attribute schemas, admin moderates products before they go live, and customers discover products via full-text search and dynamic category-specific faceted filters.

Specifically in scope: products table + GIN-indexed JSONB attributes, product_variants table, product_images table (S3-presigned upload flow), product moderation state machine, vendor identity (vendors table + minimal vendor auth/JWT), OpenSearch index + async BullMQ indexing job, full-text search API, type-ahead suggestions API, faceted filter API driven by filter_schema_definitions, and vendor-category restriction enforcement (deferred FK from Phase 2). Vendor panel UI and admin panel UI are NOT in scope (those are Phase 6). Phase 3 delivers backend APIs + contracts only.

</domain>

<decisions>
## Implementation Decisions

### Variant Modeling
- **D-01:** Products use a dedicated `product_variants` table — NOT flat JSONB variants. Each variant row carries its own SKU (text), `price_minor` (BIGINT), and `option_values` JSONB (e.g., `{ size: 'L', color: 'Red' }`). Phase 5 inventory tracks stock at the variant level.
- **D-02:** Variant axes (dimensions) are driven by the category schema. An `is_variant: boolean` flag is added to `attribute_definitions` in Phase 3. Only attributes with `is_variant=true` generate variant axes. This extends the existing Phase 2 attribute system consistently.
- **D-03:** Variants are optional. If a category defines no `is_variant=true` attributes, the product has no variant rows and uses its `base_price_minor` column directly. Variant-free products and variant products coexist in the same table.
- **D-04:** The `product_variants` table schema: `{ id, product_id (FK), sku, price_minor BIGINT, option_values JSONB, sort_order, created_at, updated_at }`. Phase 5 adds `inventory_items` linking to `product_variant_id` (or `product_id` for variant-free products).

### Product Moderation Workflow
- **D-05:** Product status state machine: `draft → pending_review → approved | rejected`. Four values as a Drizzle pgEnum.
- **D-06:** Editing rules: vendors can edit products in both `draft` and `rejected` states freely. Editing a `pending_review` product automatically resets it to `draft` (forces re-submission). This prevents admin from approving a version the vendor already changed.
- **D-07:** Auto-approval is feature-flagged: `CATALOG_AUTO_APPROVE` feature flag (stored in the FeatureFlags table, cached via Redis per the Phase 1 pattern). When enabled, submitting a product (moving from `draft` → `pending_review`) immediately advances status to `approved` and queues an index job. Admin-review flow is the default.
- **D-08:** When admin rejects a product, a rejection reason (text) is required. Stored as `rejection_reason text` on the products row. Surfaced to vendors in their panel. Never null when status is `rejected`.

### Image Handling
- **D-09:** Product images use an S3-compatible presigned URL upload flow. Backend generates a presigned PUT URL; vendor uploads directly to the bucket; vendor confirms upload; backend stores the resulting CDN/public URL.
- **D-10:** Cloudflare R2 is the documented default provider for buyers (free tier: 10GB storage, no egress fees, S3-compatible API). The implementation is provider-agnostic: env vars `S3_BUCKET_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION` cover R2, AWS S3, DigitalOcean Spaces, MinIO, etc.
- **D-11:** Image constraints are configurable via env vars: `MAX_IMAGES_PER_PRODUCT` (default: 8) and `MAX_IMAGE_SIZE_BYTES` (default: 5242880 = 5MB). Validated at presigned URL generation time.
- **D-12:** `product_images` table: `{ id, product_id (FK), url, sort_order, alt_text, created_at }`. Cascade delete when product is deleted.

### Search Indexing
- **D-13:** Products enter the OpenSearch index ONLY when status transitions to `approved`. Draft, pending_review, and rejected products are never indexed (and are removed from the index if they transition back to a non-approved state).
- **D-14:** OpenSearch sync is async via BullMQ: approval triggers a `ProductIndexJob` queued in BullMQ. The job reads the full product + variants + category data and upserts the OpenSearch document. Retry-safe; decoupled from API response latency.
- **D-15:** OpenSearch document covers: `name`, `description`, and values of all attributes where `is_searchable=true`. Search query runs against these fields. Only approved attributes (from the category's attribute_definitions) project into the document — no arbitrary JSONB key expansion (Anti-Pattern 6, ARCHITECTURE.md).
- **D-16:** Type-ahead suggestions cover product names AND category names. Minimum 2 characters to trigger suggestions. Suggestions endpoint returns both product results and category navigation hints.

### Vendor Auth Scope
- **D-17:** Phase 3 includes minimal vendor auth: `vendors` table + vendor user (email + password hashed with bcrypt/argon2) + JWT issuance for vendor role. Catalog APIs (`POST /vendor/products`, `PATCH /vendor/products/:id`, etc.) are properly auth-gated with vendor JWT middleware. Phase 4 adds customer auth, profile management, and full auth UX flows.
- **D-18:** Phase 3 also adds the deferred FK constraint from Phase 2: `ALTER TABLE vendor_category_restrictions ADD CONSTRAINT vcr_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id)`. This was documented as a Phase 3 responsibility in Phase 2 (D-11).

### Claude's Discretion
- OpenSearch index name convention and mapping template structure (following the Bonsai/OpenSearch client patterns from Phase 10)
- BullMQ queue name for product indexing jobs and concurrency settings
- JWT access token TTL for vendor tokens (following any pattern established in Phase 1)
- Slug generation for products (auto-derived from name + unique suffix)
- Pagination strategy for vendor product list and admin moderation queue (cursor vs offset — recommend cursor for large catalogs)
- `product_images` sort_order reordering API design (patch-array vs individual move endpoints)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §"Product Catalog" — PROD-01 through PROD-06
- `.planning/REQUIREMENTS.md` §"Search & Discovery" — SRCH-01 through SRCH-04
- `.planning/ROADMAP.md` §"Phase 3: Catalog & Search" — goal, success criteria (5 SCs), dependency on Phase 2

### Architecture Patterns
- `.planning/research/ARCHITECTURE.md` §"Dynamic Category / Attribute Schema Modeling" — JSONB + Schema Registry pattern; recommended SQL shape for products table; filtering flow (admin → vendor → backend validation → search projection)
- `.planning/research/ARCHITECTURE.md` §"Anti-Patterns to Avoid" — Anti-Pattern 3 (no EAV), Anti-Pattern 6 (only is_searchable attributes project to OpenSearch — CRITICAL for D-15)
- `.planning/research/ARCHITECTURE.md` §"Component Responsibilities" — `catalog` and `search` module boundaries; `vendor` module scope

### Phase 2 Schema Contracts (existing tables Phase 3 reads/extends)
- `apps/api/src/db/schema/attribute-definitions.ts` — existing schema; Phase 3 adds `is_variant` boolean column
- `apps/api/src/db/schema/filter-schema-definitions.ts` — existing schema; Phase 3 search module reads this to generate facet queries
- `apps/api/src/db/schema/vendor-category-restrictions.ts` — existing schema; Phase 3 adds the deferred vendor FK (D-18)
- `apps/api/src/db/schema/categories.ts` — FK target for products table
- `apps/api/src/db/schema/product-templates.ts` — read by vendor product creation API to pre-fill form defaults

### Phase 2 Service/Route Patterns to Follow
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis cache + DB fallback pattern; `CATALOG_AUTO_APPROVE` feature flag follows this exact pattern
- `apps/api/src/routes/feature-flags.ts` — Fastify route plugin pattern; Zod validation pattern
- `apps/api/src/container.ts` — Awilix DI registration; new services (ProductService, SearchService, VendorService) follow same pattern
- `packages/contracts/src/category/attribute-definition.ts` — AttrTypeSchema and attribute contract shape; Phase 3 adds `is_variant` to this contract
- `packages/contracts/src/index.ts` — barrel re-export; add `packages/contracts/src/catalog/` and `packages/contracts/src/search/` domain subfolders

### Technology Stack
- `CLAUDE.md` §"Recommended Stack" — all version-pinned packages; especially BullMQ 5.77.x + ioredis 5.x for async indexing (D-14), Drizzle ORM 0.45.x for schema, jose 6.x for JWT vendor auth (D-17), Zod 4.x for validation
- `CLAUDE.md` §"What NOT to Use" — no FLOAT/DECIMAL for price columns (D-01 uses BIGINT), no EAV

### Research Context
- `.planning/research/PITFALLS.md` §"Pitfall 8" — EAV schema (use JSONB + schema registry instead — already locked)
- `.planning/research/PITFALLS.md` §"Pitfall 9" — Payment provider tight coupling (not directly Phase 3 but informs architecture boundary awareness)
- `.planning/research/FEATURES.md` — review for catalog/search feature expectations

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts`: Redis cache + DB fallback pattern. The `CATALOG_AUTO_APPROVE` feature flag in Phase 3 is registered and consumed using this exact pattern — same TTL-backed approach, same write-invalidation strategy.
- `apps/api/src/modules/categories/CategoryService.ts`: DI-registered service pattern using Awilix `asClass()`. All Phase 3 services (ProductService, SearchService, VendorAuthService, etc.) follow this exact registration and injection pattern.
- `apps/api/src/routes/admin/categories.ts` + `apps/api/src/routes/categories.ts`: Fastify route plugin patterns for admin-scoped and public routes. Phase 3 admin moderation routes (`/admin/products/:id/approve`, `/admin/products/:id/reject`) follow the admin route plugin pattern.
- `packages/contracts/src/category/`: Subfolder-per-domain pattern with `index.ts` barrel. Phase 3 adds `packages/contracts/src/catalog/` (product shapes, variant shapes, image shapes) and `packages/contracts/src/search/` (query request/response shapes).

### Established Patterns
- **Money columns**: All price fields use BIGINT minor units (`price_minor` naming convention). No FLOAT, no DECIMAL, no NUMERIC(12,2). Confirmed across all Phase 2 schemas.
- **pgEnum for status/types**: `attrTypeEnum`, `filterDisplayTypeEnum` set the pattern. Phase 3 adds a `productStatusEnum` ("draft", "pending_review", "approved", "rejected") and the `is_variant` extension to attribute_definitions.
- **Soft delete via `archived_at`**: Phase 2 uses `archived_at` for categories. Phase 3 product "archive" (vendor takes product offline) should follow the same `archived_at IS NULL` filter pattern rather than hard deletion.
- **Cascade delete on category FK**: Phase 2 schemas all use `{ onDelete: 'cascade' }` on `category_id` FKs. Phase 3 products table follows the same convention.
- **Redis cache key naming**: `feature_flags:{key}` pattern (Phase 1). Phase 3 uses `category_filter_schema:{categoryId}` for cached filter schemas served to the search API.

### Integration Points
- `apps/api/src/db/schema/attribute-definitions.ts` — Phase 3 adds `is_variant: boolean` column via migration; re-export from `db/schema/index.ts` unchanged
- `apps/api/src/db/schema/vendor-category-restrictions.ts` — Phase 3 migration adds the deferred `vendor_id` FK pointing to new `vendors.id`
- Phase 5 (inventory) will reference `product_variants.id` as the FK target for `inventory_items`. The `product_variants` table schema must expose a stable UUID PK.
- Phase 4 (storefront) will call: `GET /search?q=...`, `GET /search/suggest?q=...`, `GET /products/:id`, `GET /categories/:id/filters`. These public API shapes are forward contracts once Phase 4 begins.

</code_context>

<specifics>
## Specific Ideas

- The `is_variant` flag on `attribute_definitions` should be documented as mutually exclusive with `is_filterable` for the same attribute — a dimension attribute (size, color) becomes a variant axis rather than a standalone filter chip. Planner should enforce this in AttributeDefinitionService validation.
- The `editing a pending_review product resets to draft` rule (D-06) must be enforced at the service layer (not just in route handler logic) so it applies regardless of which API path triggers the edit.
- `CATALOG_AUTO_APPROVE` feature flag should be `false` by default in seed data and `.env.example`, so the demo experience showcases the manual moderation flow (better for buyers evaluating the platform's admin features).
- The presigned URL generation endpoint should return both the upload URL and the resulting public CDN URL (the URL to store after upload completes) so the vendor client doesn't need to construct the final URL itself.
- Search type-ahead endpoint: returning both product names and category names in a single response (e.g., `{ products: [...], categories: [...] }`) enables the storefront search bar to show grouped suggestions — cleaner UX than separate calls.
- The `vendor-category restrictions` enforcement in Phase 3 should check both `is_restricted` (category must be unrestricted, OR vendor is in the approved list) at product creation time. This was the primary purpose of D-11 from Phase 2.

</specifics>

<deferred>
## Deferred Ideas

- **Vendor panel UI** (product creation form, product list, image uploader UI) — Phase 6. Phase 3 delivers backend APIs only.
- **Admin panel moderation UI** (review queue, approve/reject interface) — Phase 6. Phase 3 delivers admin moderation APIs only.
- **Bulk product import / CSV upload** — post-v1. Not in any phase requirement.
- **Per-variant image overrides** — user considered this and deferred. variant rows do not carry images in v1; product-level images apply to all variants.
- **Product reviews and ratings** — post-v1, not in any requirement.
- **Price history / price change audit log** — post-v1.
- **OpenSearch mapping migration tooling** (auto-generating mapping from attribute_definitions changes) — Phase 3 sets up the initial mapping; dynamic remapping tooling is post-v1.
- **Full vendor profile management** (bank details, store settings, branding) — Phase 6 (VEN-01 through VEN-06).

None of the above add scope to Phase 3. Discussion stayed within phase boundaries.

</deferred>

---

*Phase: 3-Catalog & Search*
*Context gathered: 2026-05-31*
