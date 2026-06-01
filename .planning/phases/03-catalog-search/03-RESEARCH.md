# Phase 3: Catalog & Search - Research

**Researched:** 2026-05-31
**Domain:** Product catalog management, vendor auth, S3 presigned uploads, OpenSearch indexing, BullMQ async jobs, faceted search
**Confidence:** HIGH

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Variant Modeling**
- D-01: Products use a dedicated `product_variants` table — NOT flat JSONB variants. Each variant row carries its own SKU (text), `price_minor` (BIGINT), and `option_values` JSONB.
- D-02: Variant axes are driven by the category schema. An `is_variant: boolean` flag is added to `attribute_definitions` in Phase 3.
- D-03: Variants are optional. Variant-free products and variant products coexist in the same table.
- D-04: `product_variants` schema: `{ id, product_id (FK), sku, price_minor BIGINT, option_values JSONB, sort_order, created_at, updated_at }`.

**Product Moderation Workflow**
- D-05: Product status state machine: `draft → pending_review → approved | rejected`. Four values as a Drizzle pgEnum.
- D-06: Editing rules: vendors can edit `draft` and `rejected` freely. Editing a `pending_review` product resets it to `draft`. Enforced at service layer, not just route handler.
- D-07: `CATALOG_AUTO_APPROVE` feature flag (DB-backed, Redis-cached via Phase 1 FeatureFlagService pattern). When enabled, `draft → pending_review` immediately advances to `approved` and queues an index job.
- D-08: Rejection requires a reason (`rejection_reason text` on product row). Never null when status is `rejected`.

**Image Handling**
- D-09: Product images use S3-compatible presigned PUT URL flow. Backend generates URL; vendor uploads directly; vendor confirms; backend stores CDN URL.
- D-10: Default provider is Cloudflare R2. Implementation is provider-agnostic via env vars: `S3_BUCKET_URL`, `S3_ACCESS_KEY_ID`, `S3_SECRET_ACCESS_KEY`, `S3_REGION`.
- D-11: Image constraints via env vars: `MAX_IMAGES_PER_PRODUCT` (default 8), `MAX_IMAGE_SIZE_BYTES` (default 5242880 = 5MB). Validated at presigned URL generation time.
- D-12: `product_images` table: `{ id, product_id (FK), url, sort_order, alt_text, created_at }`. Cascade delete on product delete.

**Search Indexing**
- D-13: Only `approved` products enter the OpenSearch index. Non-approved products are removed from index when status reverts.
- D-14: OpenSearch sync is async via BullMQ: approval triggers a `ProductIndexJob`. Retry-safe; decoupled from API response.
- D-15: OpenSearch document covers: `name`, `description`, and attribute values where `is_searchable=true` only. Only approved attributes project into the document (Anti-Pattern 6 from ARCHITECTURE.md).
- D-16: Type-ahead covers product names AND category names. Minimum 2 characters. Returns `{ products: [...], categories: [...] }` in single response.

**Vendor Auth Scope**
- D-17: Phase 3 includes minimal vendor auth: `vendors` table + email/password (hashed) + JWT for vendor role. Catalog APIs are auth-gated with vendor JWT middleware. Phase 4 adds full auth UX.
- D-18: Phase 3 migration adds the deferred FK: `ALTER TABLE vendor_category_restrictions ADD CONSTRAINT vcr_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id)`.

### Claude's Discretion
- OpenSearch index name convention and mapping template structure
- BullMQ queue name for product indexing jobs and concurrency settings
- JWT access token TTL for vendor tokens (following Phase 1 pattern)
- Slug generation for products (auto-derived from name + unique suffix)
- Pagination strategy for vendor product list and admin moderation queue (cursor vs offset — recommend cursor for large catalogs)
- `product_images` sort_order reordering API design (patch-array vs individual move endpoints)

### Deferred Ideas (OUT OF SCOPE)
- Vendor panel UI (Phase 6)
- Admin panel moderation UI (Phase 6)
- Bulk product import / CSV upload (post-v1)
- Per-variant image overrides (post-v1)
- Product reviews and ratings (post-v1)
- Price history / audit log (post-v1)
- OpenSearch mapping migration tooling (post-v1)
- Full vendor profile management (Phase 6)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| PROD-01 | Vendor can create a product whose fields are driven by the selected category's attribute schema/template | Category schema reading patterns established; vendor auth scope (D-17) covers API gating; attribute validation against schema registry is the key pattern |
| PROD-02 | Vendor can edit and archive their own products | State machine transitions (D-05, D-06); `archived_at IS NULL` soft-delete pattern (existing in categories); edit-resets-pending rule enforced at service layer |
| PROD-03 | Product attributes stored queryable for filtering and search (JSONB + indexed) | GIN index on `attributes` JSONB column; only `is_searchable` attributes project to OpenSearch (D-15, Anti-Pattern 6) |
| PROD-04 | Vendor can manage product variants/options where the category defines them | `product_variants` table (D-01 through D-04); `is_variant` boolean on `attribute_definitions` (D-02) |
| PROD-05 | Vendor can upload and manage product images | S3 presigned PUT URL flow (D-09 through D-12); `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner`; Cloudflare R2 compatible |
| PROD-06 | Admin can moderate (approve/reject) vendor products before they go live | Status state machine (D-05); rejection reason required (D-08); auto-approve feature flag (D-07); index on approval (D-13, D-14) |
| SRCH-01 | Customer can full-text search products with type-ahead suggestions | OpenSearch full-text query; completion suggester or `search_as_you_type` field; BullMQ async indexing; 2-char minimum for type-ahead |
| SRCH-02 | Customer can filter a product list using dynamic, category-specific facets | OpenSearch terms/range aggregations; facets derived from `filter_schema_definitions`; per-category filter schema cached in Redis |
| SRCH-03 | Customer can apply and remove filters via filter chips and sort results | `post_filter` pattern for contextual facets; sort by relevance/price/name; filter combination as boolean must query |
| SRCH-04 | Search/index only exposes attributes the category schema marks as searchable/filterable | `is_searchable=true` guard on OpenSearch document projection (D-15, Anti-Pattern 6) |
</phase_requirements>

---

## Summary

Phase 3 delivers the complete product catalog and search layer as a backend-only API suite. It builds on the category attribute schema from Phase 2 and introduces six interconnected subsystems: product/variant/image persistence, a vendor identity layer with JWT auth, a product moderation state machine, async OpenSearch indexing via BullMQ, a full-text search API, and a dynamic faceted filter API.

The codebase is in excellent condition for Phase 3. Phase 2 established the Drizzle/Fastify/Awilix/Redis patterns that all Phase 3 services follow. The `attribute_definitions` table already carries `is_searchable` and `is_filterable` flags. The `filter_schema_definitions` table already drives the facet schema. The `vendor_category_restrictions` table is schema-ready for the deferred FK constraint. The `auth.ts` contract already defines `JwtPayload` with a `vendor` role and `vendorId` field.

The most technically complex area is the OpenSearch integration: the index mapping must be generated from the category's approved `attribute_definitions` at indexing time (not from arbitrary JSONB keys), and the BullMQ `ProductIndexJob` must read the full product + variants + category data to produce the document. The faceted filter query must use `post_filter` so aggregation counts remain accurate when a filter is applied.

**Primary recommendation:** Follow the exact patterns established in Phase 2 (Awilix DI registration, Fastify route plugins, Redis-first caching with write-through invalidation, Drizzle pgEnum for status) and extend them with three new infrastructure concerns: the `@opensearch-project/opensearch` client registered as a Fastify plugin, a BullMQ `Queue` + `Worker` pair for `ProductIndexJob`, and the `@aws-sdk/client-s3` + `@aws-sdk/s3-request-presigner` pair for presigned upload URLs.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Product/variant/image CRUD | API / Backend (catalog module) | Database / Storage | Products are authoritative in PostgreSQL; search is a projection only |
| JSONB attribute validation | API / Backend (catalog module) | — | Service-layer validation against `attribute_definitions` schema registry before any DB write |
| Vendor identity and JWT issuance | API / Backend (vendor-auth module) | — | Matches existing `auth.ts` contract role=vendor; Phase 4 extends with full UX |
| S3 presigned URL generation | API / Backend (catalog module) | CDN / Static (Cloudflare R2) | Backend generates URL and final CDN URL; vendor uploads directly to R2 — backend is never on the upload path |
| Product moderation state machine | API / Backend (catalog module) | — | Status transitions guarded at service layer, not route handler |
| CATALOG_AUTO_APPROVE feature flag | API / Backend (feature-flags module) | Redis | Same FeatureFlagService pattern from Phase 1 |
| OpenSearch document indexing | API / Backend (search module via BullMQ) | External (OpenSearch/Bonsai) | Async; decoupled from API response latency; only approved products indexed |
| BullMQ ProductIndexJob queue | API / Backend (queue infrastructure) | Redis | Redis is BullMQ transport; Worker reads from queue; Queue is enqueued on approval |
| Full-text search query | API / Backend (search module) | External (OpenSearch/Bonsai) | Search module owns query building; OpenSearch executes |
| Type-ahead suggestions | API / Backend (search module) | External (OpenSearch/Bonsai) | Completion suggester or search_as_you_type field on product name + category name |
| Faceted filter query | API / Backend (search module) | Database / Storage | Filter schema read from PostgreSQL (Redis-cached); facet query executed in OpenSearch |
| Vendor-category restriction enforcement | API / Backend (catalog module) | Database / Storage | Check `vendor_category_restrictions` + `categories.isRestricted` at product creation |
| Deferred FK constraint | Database / Storage | — | Migration-only; no application code; adds FK from vendor_category_restrictions.vendor_id to vendors.id |

---

## Standard Stack

### Core — New in Phase 3

| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@opensearch-project/opensearch` | 3.6.x | OpenSearch Node.js client — index management, document upsert, search queries | Official client; auto-updated from OpenSearch API spec; full TypeScript types in v3; matches CLAUDE.md |
| `bullmq` | 5.77.x | Background job queue for `ProductIndexJob` | Already specified in CLAUDE.md; Redis-backed; TypeScript-native; used for async indexing (D-14) |
| `@aws-sdk/client-s3` | 3.x | S3 client for presigned URL generation | Official AWS SDK v3; required for `PutObjectCommand`; compatible with Cloudflare R2 via endpoint override |
| `@aws-sdk/s3-request-presigner` | 3.x | `getSignedUrl` utility for generating presigned PUT URLs | Companion package to `@aws-sdk/client-s3`; provides `getSignedUrl(s3Client, command, { expiresIn })` |
| `argon2` | latest | Password hashing for vendor accounts (D-17) | OWASP-recommended for new code; Argon2id default; TypeScript types built-in; memory-hard vs bcrypt |

### Already Installed — Used in Phase 3

| Library | Version | Purpose |
|---------|---------|---------|
| `drizzle-orm` | 1.0.0-rc.3 (installed as `drizzle-orm`) | Product/variant/image schemas; migration generation |
| `fastify` | 5.8.x | HTTP framework; all route plugins follow existing pattern |
| `awilix` | 13.x | DI registration for ProductService, SearchService, VendorAuthService, ImageService |
| `jose` | 6.x | JWT signing/verification for vendor role tokens (D-17) — see auth.ts contract |
| `ioredis` | 5.11.x | BullMQ Redis transport + existing Redis client |
| `zod` | 4.4.x | Request validation; shared contracts in `packages/contracts/src/catalog/` and `packages/contracts/src/search/` |
| `@grovio/contracts` | workspace | Product/variant/image/search contract shapes added in Phase 3 |

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| `argon2` | `bcrypt` | bcrypt is fine but lacks memory-hardness; argon2 is OWASP priority for new code |
| `@aws-sdk/client-s3` | `aws4` (manual signing) | Manual signing is error-prone; AWS SDK v3 handles Signature V4, R2 endpoint overrides, presigner |
| BullMQ `Worker` in API process | Separate worker process | For v1, running Worker in the same process is acceptable and simpler; a separate worker binary is a phase 6+ concern |
| OpenSearch completion suggester | `search_as_you_type` field | `search_as_you_type` is simpler to set up and supports infix matches; completion suggester is faster for prefix-only but requires more setup; recommend `search_as_you_type` for v1 |

**Installation (Phase 3 new packages):**
```bash
pnpm add @opensearch-project/opensearch bullmq @aws-sdk/client-s3 @aws-sdk/s3-request-presigner argon2 --filter @grovio/api
```

---

## Package Legitimacy Audit

> slopcheck was not available at research time. All packages are marked `[ASSUMED]`. The planner must gate each install behind a `checkpoint:human-verify` task before the install step.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| `@opensearch-project/opensearch` | npm | ~4 yrs | ~50K/wk | github.com/opensearch-project/opensearch-js | [ASSUMED] | Flagged — planner must add checkpoint |
| `bullmq` | npm | ~4 yrs | ~2M/wk | github.com/taskforcesh/bullmq | [ASSUMED] | Flagged — planner must add checkpoint |
| `@aws-sdk/client-s3` | npm | ~3 yrs | ~10M/wk | github.com/aws/aws-sdk-js-v3 | [ASSUMED] | Flagged — planner must add checkpoint |
| `@aws-sdk/s3-request-presigner` | npm | ~3 yrs | ~5M/wk | github.com/aws/aws-sdk-js-v3 | [ASSUMED] | Flagged — planner must add checkpoint |
| `argon2` | npm | ~8 yrs | ~850K/wk | github.com/ranisalt/node-argon2 | [ASSUMED] | Flagged — planner must add checkpoint |

**Packages removed due to slopcheck [SLOP] verdict:** none
**Packages flagged as suspicious [SUS]:** none flagged by manual review — all are well-known packages from authoritative organizations

*All packages above are tagged `[ASSUMED]` because slopcheck was unavailable. The planner must gate each install behind a `checkpoint:human-verify` task.*

---

## Architecture Patterns

### System Architecture Diagram

```text
                         Vendor Client
                              │  POST /vendor/products   (Bearer vendor JWT)
                              │  PATCH /vendor/products/:id
                              │  POST /vendor/products/:id/images/presign
                              │  PUT   /vendor/products/:id/submit
                              ▼
              ┌──────────────────────────────┐
              │      Fastify API Server       │
              │  vendor JWT middleware         │
              │  Zod body validation          │
              └────────────┬─────────────────┘
                           │
             ┌─────────────┼─────────────────┐
             ▼             ▼                  ▼
      VendorAuthService  ProductService  SearchService
      (vendors table,    (products,       (query builder,
       jose JWT)         variants,        facet aggregation)
                         images)               │
             │             │                  │
             └──────┬──────┘                  │
                    ▼                         │
             PostgreSQL (Neon)                │
        products, variants, images            │
        GIN index on attributes               │
        pgEnum product_status                 │
                                              │
  On product approval:                        │
  ProductService ──► BullMQ Queue ──► Worker ─┤
                   (product-index-queue)       │
                                              ▼
                                       OpenSearch (Bonsai)
                                  grovio-products-{env} index
                                  name, description, is_searchable attrs
                                  completion/search_as_you_type fields

  Customer Client
       │  GET /search?q=...&category=...&filters=...
       │  GET /search/suggest?q=...
       │  GET /categories/:id/filters
       ▼
  Fastify API → SearchService → OpenSearch query
                              + filter_schema read (Redis-cached)
```

### Recommended Project Structure

```
apps/api/src/
├── modules/
│   ├── vendor-auth/           # NEW: vendors table, VendorAuthService, JWT issuance
│   │   ├── VendorAuthService.ts
│   │   ├── VendorAuthService.test.ts
│   │   └── index.ts
│   ├── catalog/               # NEW: ProductService, ImageService, variant management
│   │   ├── ProductService.ts
│   │   ├── ProductService.test.ts
│   │   ├── ImageService.ts
│   │   ├── ImageService.test.ts
│   │   └── index.ts
│   ├── search/                # NEW: SearchService, OpenSearch query builder
│   │   ├── SearchService.ts
│   │   ├── SearchService.test.ts
│   │   ├── opensearch-client.ts     # Shared OpenSearch client singleton
│   │   └── index.ts
│   └── jobs/                  # NEW: BullMQ queue + worker for ProductIndexJob
│       ├── queues.ts           # Queue instantiation (product-index-queue)
│       ├── workers.ts          # Worker registration and processor
│       ├── product-index-job.ts   # Job processor logic
│       └── index.ts
├── db/schema/
│   ├── vendors.ts             # NEW: vendors table
│   ├── products.ts            # NEW: products table + productStatusEnum
│   ├── product-variants.ts    # NEW: product_variants table
│   ├── product-images.ts      # NEW: product_images table
│   └── index.ts               # Add new exports in FK-dependency order
├── plugins/
│   └── opensearch.ts          # NEW: Fastify plugin decorating fastify.opensearch
├── routes/
│   ├── vendor/                # NEW: /vendor/products, /vendor/products/:id, etc.
│   │   └── products.ts
│   ├── admin/
│   │   ├── categories.ts      # EXISTING
│   │   └── products.ts        # NEW: /admin/products/:id/approve, /admin/products/:id/reject
│   ├── search.ts              # NEW: /search, /search/suggest
│   └── categories.ts          # EXISTING + add /categories/:id/filters route
└── db/migrations/
    └── 20260531000000_catalog_search_phase3/
        └── migration.sql
```

```
packages/contracts/src/
├── catalog/                   # NEW domain subfolder
│   ├── product.ts             # ProductSchema, CreateProductInputSchema, etc.
│   ├── variant.ts             # ProductVariantSchema, CreateVariantInputSchema
│   ├── image.ts               # ProductImageSchema, PresignImageInputSchema
│   └── index.ts               # barrel re-export
├── search/                    # NEW domain subfolder
│   ├── query.ts               # SearchQuerySchema, SearchResponseSchema
│   ├── suggest.ts             # SuggestQuerySchema, SuggestResponseSchema
│   ├── filter.ts              # FilterRequestSchema, FacetResultSchema
│   └── index.ts               # barrel re-export
├── category/                  # EXISTING — extend attribute-definition.ts with is_variant
└── index.ts                   # Add: export * from "./catalog/index.js"; export * from "./search/index.js";
```

### Pattern 1: ProductService Service Layer Pattern

**What:** All product business logic (create, update, submit, approve, reject, archive) lives in `ProductService`. The service enforces all state machine transitions (D-05, D-06), the `is_variant` mutual-exclusivity rule, vendor-category restriction checks, attribute validation against the schema registry, and the auto-approve feature flag check.

**When to use:** All product mutations.

**Example (state machine + auto-approve check):**
```typescript
// Source: Inferred from Phase 2 patterns (CategoryService, FeatureFlagService)
async submitProduct(productId: string, vendorId: string): Promise<SelectProduct> {
  const product = await this.getProduct(productId, vendorId); // throws if not found/unauthorized
  if (product.status !== 'draft') throw new ProductStateError('Only draft products can be submitted');

  const autoApprove = await this.deps.featureFlagService.getFlag('CATALOG_AUTO_APPROVE');

  const newStatus = autoApprove === 'true' ? 'approved' : 'pending_review';
  const [updated] = await this.deps.db.update(products)
    .set({ status: newStatus, updatedAt: new Date() })
    .where(eq(products.id, productId))
    .returning();

  if (newStatus === 'approved') {
    await this.deps.productIndexQueue.add('index', { productId }, {
      attempts: 3, backoff: { type: 'exponential', delay: 1000 }
    });
  }
  return updated!;
}
```

### Pattern 2: OpenSearch Plugin + Client Registration

**What:** `@opensearch-project/opensearch` client is initialized as a Fastify plugin (same pattern as `redis.ts` plugin) and decorated onto the Fastify instance as `fastify.opensearch`. The `SearchService` receives it via Awilix DI.

**When to use:** All OpenSearch operations (index management, document upsert, search, suggest).

**Example:**
```typescript
// Source: [CITED: https://docs.opensearch.org/latest/clients/javascript/index/]
// apps/api/src/plugins/opensearch.ts
import fp from 'fastify-plugin';
import { Client } from '@opensearch-project/opensearch';
import { env } from '../config/env.js';

const opensearchPlugin = fp(async (fastify) => {
  if (!env.OPENSEARCH_URL) return; // Optional — backend boots without it

  const client = new Client({ node: env.OPENSEARCH_URL });
  fastify.decorate('opensearch', client);
  fastify.addHook('onClose', async () => { await client.close(); });
}, { name: 'opensearch' });

export default opensearchPlugin;
```

### Pattern 3: BullMQ ProductIndexJob

**What:** On product approval, `ProductService` enqueues a `ProductIndexJob`. The Worker runs in the same API process (acceptable for v1) and reads the full product + variants + category attributes (filtering to `is_searchable=true` only) before upserting the OpenSearch document.

**When to use:** Every approval transition (approval, re-approval after edit-and-resubmit).

**Example (index-only approach for approved products; deletion for reverted):**
```typescript
// Source: [CITED: https://docs.bullmq.io/readme-1] + [CITED: ARCHITECTURE.md D-15]
// apps/api/src/modules/jobs/product-index-job.ts
async function processProductIndexJob(job: Job): Promise<void> {
  const { productId, action } = job.data as { productId: string; action: 'index' | 'delete' };
  
  if (action === 'delete') {
    await opensearchClient.delete({ index: 'grovio-products-dev', id: productId });
    return;
  }

  // Read full product + variants + searchable attributes only
  const product = await db.query.products.findFirst({
    where: eq(products.id, productId),
    with: { variants: true, category: { with: { attributeDefinitions: {
      where: eq(attributeDefinitions.isSearchable, true)
    }}}}
  });

  const doc = buildSearchDocument(product); // extracts only is_searchable attrs
  
  await opensearchClient.index({
    index: 'grovio-products-dev',
    id: productId,
    body: doc,
  });
}
```

### Pattern 4: OpenSearch Index Mapping (Category-Derived)

**What:** The `grovio-products-{env}` index uses a static mapping created at startup (or via migration). Searchable attribute values are stored under a top-level `attributes` object with nested `keyword` fields for faceting and `text` fields for full-text. Product name uses `search_as_you_type` for type-ahead.

**Why `search_as_you_type` over completion suggester:** Simpler setup; supports infix as well as prefix matching; does not require re-indexing suggestions separately; performs well for v1 catalog sizes.

**Example mapping (REST body, applied once at index creation):**
```json
// Source: [CITED: https://docs.opensearch.org/latest/mappings/]
{
  "mappings": {
    "properties": {
      "name":         { "type": "search_as_you_type" },
      "description":  { "type": "text" },
      "categoryId":   { "type": "keyword" },
      "vendorId":     { "type": "keyword" },
      "status":       { "type": "keyword" },
      "basePriceMinor": { "type": "long" },
      "categoryName": { "type": "search_as_you_type" },
      "attributes": {
        "type": "object",
        "dynamic": false,
        "properties": {
          "color":    { "type": "keyword" },
          "size":     { "type": "keyword" },
          "brand":    { "type": "keyword", "copy_to": "attr_text" },
          "material": { "type": "keyword", "copy_to": "attr_text" }
        }
      },
      "attr_text": { "type": "text" }
    }
  }
}
```

**CRITICAL:** `"dynamic": false` on the `attributes` object prevents arbitrary JSONB key expansion into OpenSearch (Anti-Pattern 6). Only pre-declared properties are indexed. The initial mapping is derived from the seeded category attribute definitions; re-mapping for new attributes is post-v1.

### Pattern 5: Faceted Search Query with `post_filter`

**What:** The `/search` endpoint reads the category's `filter_schema_definitions` (Redis-cached under `category_filter_schema:{categoryId}`), translates applied filter params into a `post_filter` bool clause, and adds `terms`/`range` aggregations for all filter attributes. Using `post_filter` ensures facet counts remain accurate when a filter is applied.

**Example:**
```typescript
// Source: [CITED: https://docs.opensearch.org/latest/tutorials/faceted-search/]
const searchBody = {
  query: { multi_match: { query: q, fields: ['name', 'description', 'attr_text'] } },
  aggs: {
    colors: { terms: { field: 'attributes.color' } },
    sizes:  { terms: { field: 'attributes.size'  } },
    price:  { range: { field: 'basePriceMinor', ranges: [
      { to: 50000 }, { from: 50000, to: 200000 }, { from: 200000 }
    ]}}
  },
  post_filter: {
    bool: {
      must: appliedFilters.map(f => ({ term: { [`attributes.${f.key}`]: f.value } }))
    }
  },
  sort: resolveSortParam(sort),
};
```

### Pattern 6: S3 Presigned PUT URL Generation

**What:** Backend generates a presigned `PutObject` URL using `@aws-sdk/s3-request-presigner`. The response includes both the `uploadUrl` (the presigned PUT URL) and the `cdnUrl` (the final public URL to store after upload confirms). The vendor uploads directly to R2/S3 — the backend never proxies the file.

**Example:**
```typescript
// Source: [CITED: https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/]
// Source: [CITED: https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/]
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3 = new S3Client({
  region: env.S3_REGION ?? 'auto',
  endpoint: env.S3_BUCKET_URL,
  credentials: {
    accessKeyId: env.S3_ACCESS_KEY_ID,
    secretAccessKey: env.S3_SECRET_ACCESS_KEY,
  },
});

async function generatePresignedUpload(key: string, contentType: string) {
  const command = new PutObjectCommand({
    Bucket: env.S3_BUCKET_NAME,
    Key: key,
    ContentType: contentType,
    ContentLength: /* from validated size constraint */,
  });
  const uploadUrl = await getSignedUrl(s3, command, { expiresIn: 300 }); // 5 min
  const cdnUrl = `${env.S3_PUBLIC_URL}/${key}`; // pre-constructed, not from signed URL
  return { uploadUrl, cdnUrl };
}
```

### Anti-Patterns to Avoid

- **Indexing arbitrary JSONB keys:** Do NOT build OpenSearch document from raw `product.attributes` JSONB keys. Build from `attribute_definitions` rows with `is_searchable=true` only. (Anti-Pattern 6, D-15)
- **Putting search sync on the API response path:** Never `await opensearchClient.index(...)` inside the HTTP handler that approves a product. Always enqueue to BullMQ. (D-14)
- **Storing processed file uploads on backend:** Never proxy the multipart upload through the backend. Vendor uploads directly to R2/S3 using the presigned URL. (D-09)
- **Enforcing edit-pending-resets-to-draft in routes only:** The `editing a pending_review product resets to draft` rule (D-06) must live in `ProductService.updateProduct()` — not in the route handler — so it applies regardless of API path. (D-06 Specifics note)
- **Hard-coding vendor-category check in product creation route:** The `isRestricted + vendor_category_restrictions` check (D-18, CAT-06) must be in `ProductService.createProduct()` at the service layer.
- **Not setting `maxRetriesPerRequest: null` for BullMQ:** BullMQ uses Redis blocking commands (`BLPOP`). ioredis defaults cause it to throw on blocked commands if `maxRetriesPerRequest` is not `null`. The existing `redis.ts` plugin must expose a separate connection for BullMQ (or the existing connection must be configured with this option).

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Presigned S3 URL generation | Custom Signature V4 HMAC implementation | `@aws-sdk/s3-request-presigner` | Signature V4 has 8 signing steps, canonical request formatting, date handling, and session token support — hand-rolling causes subtle security bugs |
| Background job queue with retry + persistence | Custom Redis pub/sub retry loop | BullMQ 5.x | BullMQ handles exactly-once semantics, exponential backoff, job state machine, dead-letter queue, and Redis key cleanup |
| Password hashing | Custom crypto.scrypt loop | `argon2` | Argon2id memory-hardness requires carefully chosen parameters; the library handles salt generation, encoding, and verification format |
| Full-text search with faceting | PostgreSQL `tsvector` + JSONB filter | OpenSearch | tsvector does not support aggregation-based facet counts; JSONB GIN is for exact-match filtering, not relevance ranking or type-ahead |
| JWT signing/verification | Manual HMAC | `jose` (already installed) | Already in the codebase; Web Crypto API based; handles HS256 algorithm |
| Slug uniqueness collision loop | Custom slug generator | Follow `CategoryService.resolveSlug()` pattern (already in codebase) | The exact same slug collision pattern from CategoryService must be replicated in ProductService |

**Key insight:** OpenSearch is not a replacement for PostgreSQL — products remain authoritative in PostgreSQL. OpenSearch is a read-only projection for search and faceting only. Writes always go to PostgreSQL first; OpenSearch is eventually consistent via BullMQ.

---

## Common Pitfalls

### Pitfall 1: BullMQ ioredis Connection Sharing

**What goes wrong:** BullMQ `Worker` and `Queue` share the existing `fastify.redis` ioredis connection. BullMQ uses blocking commands (`BRPOPLPUSH`, `BLPOP`). When `maxRetriesPerRequest` is not `null`, ioredis throws `MaxRetriesPerRequestError` on these blocking calls. This kills the Worker.

**Why it happens:** The existing `redis.ts` plugin creates a connection without `maxRetriesPerRequest: null`. BullMQ requires this option.

**How to avoid:** Create a **separate** ioredis connection for BullMQ — do NOT pass `fastify.redis` to `new Queue()` or `new Worker()`. Register a `fastify.bullRedis` value in the DI container with `maxRetriesPerRequest: null`.

**Warning signs:** Worker starts then immediately throws `MaxRetriesPerRequestError`; jobs are never picked up.

### Pitfall 2: OpenSearch Mapping Explosion via Dynamic Mapping

**What goes wrong:** Product JSONB attribute values are sent directly to OpenSearch without explicit field mapping. OpenSearch's `dynamic: true` default creates a new field for every unique key, mapping explosion occurs, index performance degrades, and the cluster can hit the default field limit (1000).

**Why it happens:** It's tempting to `JSON.stringify(product.attributes)` and send the entire blob to OpenSearch. This bypasses the schema registry guard.

**How to avoid:** Set `"dynamic": false` on the `attributes` object in the mapping. Build the index document from `attribute_definitions` rows with `is_searchable=true` — never from raw JSONB keys. (Anti-Pattern 6, D-15)

**Warning signs:** OpenSearch index field count grows unboundedly; admin adds a new attribute and old documents have unmapped fields; `keyword` vs `text` type conflicts on the same field name.

### Pitfall 3: Product State Machine Bypass

**What goes wrong:** A vendor edits a `pending_review` product via a direct PATCH to field values, bypassing the "editing pending_review resets to draft" rule. Admin then approves the original version while the vendor is looking at a different version.

**Why it happens:** The status reset logic lives only in the "submit" route handler, not in the general `updateProduct` service method.

**How to avoid:** In `ProductService.updateProduct()`, check if the current status is `pending_review` before applying updates. If so, first set `status = 'draft'`. This is enforced at the service layer regardless of which API path triggered the update. (D-06)

**Warning signs:** Vitest test that patches a `pending_review` product field directly (not via the submit endpoint) and checks the resulting status — if it stays `pending_review`, the guard is missing.

### Pitfall 4: Race Condition on concurrent image presign + upload + confirm

**What goes wrong:** Vendor requests 3 presigned URLs simultaneously, uploads all 3, then confirms them. The backend inserts all 3 image rows. But a concurrent delete request (or a failed upload) leaves orphaned `product_images` rows pointing to non-existent S3 objects.

**Why it happens:** No confirmation step validation; the backend stores the `url` without verifying the object exists in S3.

**How to avoid:** The confirm-upload endpoint should be the only path that writes to `product_images`. The presign endpoint returns `{ uploadUrl, cdnUrl, key }` but writes nothing. The confirm endpoint writes the row. Do not validate object existence via S3 `HeadObject` (too slow; R2 billing concern) — instead use a short presigned URL TTL (5 min) and treat unconfirmed uploads as client responsibility. Apply `MAX_IMAGES_PER_PRODUCT` check at the presign step.

**Warning signs:** `product_images` rows exist for products that were never submitted; image count exceeds `MAX_IMAGES_PER_PRODUCT`.

### Pitfall 5: is_variant and is_filterable are Not Mutually Exclusive

**What goes wrong:** A category attribute has both `is_variant=true` and `is_filterable=true`. The product creation form shows it as both a variant axis AND a filter chip. The search index projects it as a facet attribute AND the variant selection uses it for option display. Inconsistent behavior in both search and storefront.

**Why it happens:** No database constraint prevents both flags being true simultaneously.

**How to avoid:** Enforce mutual exclusivity in `AttributeDefinitionService.createAttribute()` and `updateAttribute()`: if `is_variant=true`, force `is_filterable=false` (and vice versa). Add a service-layer test for this. The Specifics note in CONTEXT.md explicitly calls this out. (Note: the DB constraint can be a CHECK constraint in migration or a service-layer guard — the service-layer guard is simpler and still correct.)

**Warning signs:** A size/color attribute appears in both the filter panel and the variant selector on a product page.

### Pitfall 6: Facet Cache Stale After Attribute Schema Change

**What goes wrong:** Admin changes a category's filter schema (adds/removes a filterable attribute). The Redis-cached `category_filter_schema:{categoryId}` still serves the old schema. Customers see stale facet controls for up to the TTL period.

**Why it happens:** Phase 2's `FilterSchemaService.replaceFilterSchema()` writes to the DB but does not invalidate any downstream cache.

**How to avoid:** When `replaceFilterSchema()` is called (in `FilterSchemaService` or the admin route), also call `redis.del(`category_filter_schema:${categoryId}`)`. This is the same write-through invalidation pattern used for `cat:tree` in `CategoryService`.

**Warning signs:** Admin changes filter schema; customer immediately searches the category and still sees old facets; the Redis TTL has not expired.

### Pitfall 7: Search Index Out of Sync After Product Status Reverts

**What goes wrong:** A product is approved and indexed. An admin then rejects it. The product remains in the OpenSearch index and appears in customer search results even though it is rejected. Violation of D-13.

**Why it happens:** The BullMQ job only handles `action: 'index'` (on approval). No delete action is enqueued when status reverts from `approved` to `rejected` (or when a product is archived).

**How to avoid:** Whenever `ProductService` transitions a product OUT of `approved` status (to `rejected`, back to `draft` via the edit-reset rule, or to `archived`), enqueue a `ProductIndexJob` with `action: 'delete'`. The Worker calls `opensearchClient.delete(...)`. (D-13)

**Warning signs:** A rejected product appears in `/search` results; vitest integration test that rejects an approved product and then checks the index.

---

## Code Examples

### Vendor JWT Issuance (following Phase 1 pattern)

```typescript
// Source: [CITED: packages/contracts/src/auth.ts — role='vendor', vendorId field]
// Source: [CITED: CLAUDE.md — jose 6.x for JWT]
import { SignJWT } from 'jose';

const ttlSeconds = 3600; // 1h — discretion area, following Phase 1 pattern
const secret = new TextEncoder().encode(env.JWT_SECRET);

const token = await new SignJWT({
  sub: vendor.userId,
  role: 'vendor',
  vendorId: vendor.id,
})
  .setProtectedHeader({ alg: 'HS256' })
  .setIssuedAt()
  .setExpirationTime(`${ttlSeconds}s`)
  .sign(secret);
```

### Vendor JWT Middleware (route preHandler pattern)

```typescript
// Source: [CITED: CLAUDE.md — jose 6.x; existing admin guard pattern in admin/categories.ts]
import { jwtVerify } from 'jose';

async function requireVendorAuth(request: FastifyRequest, reply: FastifyReply) {
  const authHeader = request.headers.authorization;
  if (!authHeader?.startsWith('Bearer ')) {
    return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Bearer token required' } });
  }
  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(env.JWT_SECRET);
  try {
    const { payload } = await jwtVerify(token, secret);
    if (payload['role'] !== 'vendor') throw new Error('Not a vendor token');
    request.vendorId = payload['vendorId'] as string; // augment request type
  } catch {
    return reply.status(401).send({ success: false, error: { code: 'UNAUTHORIZED', message: 'Invalid or expired token' } });
  }
}
```

### Cursor Pagination for Vendor Product List

```typescript
// Source: [CITED: https://orm.drizzle.team/docs/guides/cursor-based-pagination]
// Recommended over offset pagination for large catalogs (discretion area from CONTEXT.md)
const nextPage = await db.select().from(products)
  .where(
    cursor
      ? or(
          lt(products.createdAt, cursor.createdAt),
          and(eq(products.createdAt, cursor.createdAt), lt(products.id, cursor.id))
        )
      : undefined
  )
  .orderBy(desc(products.createdAt), desc(products.id))
  .limit(pageSize);
// Return cursor: { createdAt: lastRow.createdAt, id: lastRow.id }
```

### Argon2 Password Hashing

```typescript
// Source: [CITED: https://www.npmjs.com/package/argon2 — TypeScript built-in]
import * as argon2 from 'argon2';

// Hash on registration
const hash = await argon2.hash(password); // Argon2id default

// Verify on login
const isValid = await argon2.verify(hash, password);
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| Elasticsearch (SSPL license) | OpenSearch (Apache 2.0) | OpenSearch forked 2021; Linux Foundation 2024 | Apache 2.0 is cleaner for a commercially-sold starter kit |
| OpenSearch JS client v2 (manual types) | v3 (API-spec-generated types) | Released ~2024 | Full TypeScript types; breaking change: camelCase → snake_case params |
| Completion suggester for type-ahead | `search_as_you_type` field type | OpenSearch 1.x+ | Simpler setup; supports infix; no separate suggestion indexing step |
| bcrypt for new password hashing | argon2 (Argon2id) | OWASP recommendation 2023+ | Memory-hard; GPU-resistant; built-in TypeScript types |
| AWS SDK v2 for S3 | AWS SDK v3 (`@aws-sdk/client-s3`) | SDK v3 GA 2020 | Modular; tree-shakeable; works with R2 via endpoint override |

**Deprecated/outdated:**
- `elasticsearch` npm package: Use `@opensearch-project/opensearch` (Apache 2.0 license; API-compatible)
- OpenSearch JS client 2.x: Upgrading to 3.x brings spec-generated types but requires camelCase → snake_case migration in query params
- `bcryptjs` for new code: Works but lacks memory-hardness; use `argon2` for new projects

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@opensearch-project/opensearch` version 3.6.x is current | Standard Stack | Minor — planner uses `@opensearch-project/opensearch@latest` or pins latest verified version |
| A2 | BullMQ 5.77.x is current (already in CLAUDE.md) | Standard Stack | Low — CLAUDE.md has verified this against npm |
| A3 | `@aws-sdk/client-s3` and `@aws-sdk/s3-request-presigner` v3.x are compatible with Cloudflare R2 via endpoint override | Standard Stack | Low — Cloudflare R2 docs explicitly confirm AWS SDK v3 compatibility |
| A4 | `argon2` package TypeScript types are built-in (no `@types/argon2` needed) | Standard Stack | Low — confirmed in multiple 2025 sources |
| A5 | `search_as_you_type` is preferred over completion suggester for v1 | Standard Stack | Low — tradeoff is clear; either works; planner can reverse if needed |
| A6 | `maxRetriesPerRequest: null` must be set on the BullMQ-specific ioredis connection | Common Pitfalls | HIGH — if wrong, Worker silently fails on first job; easy to test |
| A7 | OpenSearch `dynamic: false` on attributes object prevents field explosion | Architecture Patterns | Medium — behavior is standard OpenSearch but worth verifying at index creation time |

---

## Open Questions

1. **BullMQ Worker process boundary**
   - What we know: Running Worker in the API process is acceptable for v1; CLAUDE.md recommends BullMQ 5.x
   - What's unclear: Should the Worker be started in `buildApp()` alongside route registration, or in `main.ts` after `fastify.listen()`?
   - Recommendation: Start Worker in `main.ts` after `fastify.listen()` so the HTTP server starts cleanly first; Worker failures do not block API startup. Planner discretion.

2. **OpenSearch index name convention**
   - What we know: CONTEXT.md leaves index naming to Claude's discretion
   - What's unclear: Should it be `grovio-products-dev`, `grovio-products-${env.NODE_ENV}`, or something else?
   - Recommendation: Use `grovio-products-${env.NODE_ENV}` so dev/test/prod are isolated automatically. The Worker reads `env.NODE_ENV` when building the index name.

3. **Filter schema Redis cache invalidation**
   - What we know: SearchService caches `category_filter_schema:{categoryId}` in Redis. FilterSchemaService (Phase 2) does not currently invalidate this key because it didn't exist yet.
   - What's unclear: Should Phase 3 patch `FilterSchemaService.replaceFilterSchema()` to add invalidation, or add it in the admin route handler?
   - Recommendation: Add `redis.del(`category_filter_schema:${categoryId}`)` in `FilterSchemaService.replaceFilterSchema()` — keeps the invalidation co-located with the mutation (same pattern as CategoryService).

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js | API runtime | ✓ | 24.16.0 | — |
| PostgreSQL (Neon) | Product data | ✓ | cloud | — |
| Redis (Upstash) | BullMQ transport, feature flags cache | ✓ | cloud | — |
| OpenSearch (Bonsai) | Search index | ✓ | cloud (OPENSEARCH_URL in env) | Backend boots without it per existing env.ts |

**Missing dependencies with no fallback:** None

**Missing dependencies with fallback:**
- OpenSearch: Backend boots without `OPENSEARCH_URL` (existing `env.ts` marks it optional). SearchService routes return 503 or empty results when OpenSearch is unavailable; planner should add a graceful degradation guard in SearchService.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `apps/api/vitest.config.ts` (exists) |
| Quick run command | `pnpm --filter @grovio/api test -- --reporter=verbose --run` |
| Full suite command | `pnpm --filter @grovio/api test` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| PROD-01 | Vendor creates product; attributes validated against schema | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ Wave 0 |
| PROD-02 | Archive product sets `archived_at`; edit-pending resets to draft | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ Wave 0 |
| PROD-03 | Product attributes stored as JSONB; GIN index on `attributes` column | unit/smoke | `vitest run src/db/schema/products.test.ts` | ❌ Wave 0 |
| PROD-04 | Variant created with SKU + price_minor + option_values | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ Wave 0 |
| PROD-05 | Presign returns `{ uploadUrl, cdnUrl }`; count guard enforced | unit | `vitest run src/modules/catalog/ImageService.test.ts` | ❌ Wave 0 |
| PROD-06 | Approve transitions to approved + enqueues index job; reject requires reason | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ Wave 0 |
| SRCH-01 | Search query returns hits ranked by relevance | integration (mocked OS) | `vitest run src/modules/search/SearchService.test.ts` | ❌ Wave 0 |
| SRCH-02 | Filter request returns facets from category filter schema | integration (mocked OS) | `vitest run src/modules/search/SearchService.test.ts` | ❌ Wave 0 |
| SRCH-03 | `post_filter` applied when filters present; facet counts unchanged | unit | `vitest run src/modules/search/SearchService.test.ts` | ❌ Wave 0 |
| SRCH-04 | Index document contains only `is_searchable=true` attribute values | unit | `vitest run src/modules/jobs/product-index-job.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `pnpm --filter @grovio/api test -- --run src/modules/catalog`
- **Per wave merge:** `pnpm --filter @grovio/api test`
- **Phase gate:** Full suite green before `/gsd-verify-work`

### Wave 0 Gaps
- [ ] `apps/api/src/modules/catalog/ProductService.test.ts` — covers PROD-01 through PROD-06
- [ ] `apps/api/src/modules/catalog/ImageService.test.ts` — covers PROD-05
- [ ] `apps/api/src/modules/search/SearchService.test.ts` — covers SRCH-01 through SRCH-03
- [ ] `apps/api/src/modules/jobs/product-index-job.test.ts` — covers SRCH-04
- [ ] `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` — covers D-17 vendor JWT issuance

---

## Security Domain

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | yes | `argon2` Argon2id for password hashing; `jose` HS256 JWT for vendor tokens; existing `JwtPayloadSchema` with role claim |
| V3 Session Management | partial | Vendor JWT access token short-lived (1h); Phase 4 adds refresh tokens; no session store in Phase 3 |
| V4 Access Control | yes | Vendor JWT middleware preHandler on all `/vendor/*` routes; `product.vendorId === authed vendorId` ownership check in `ProductService`; admin token guard on `/admin/products/*` routes |
| V5 Input Validation | yes | Zod schemas in `packages/contracts/src/catalog/` for all product/variant/image request bodies; attribute value validation against `attribute_definitions` schema registry in `ProductService` |
| V6 Cryptography | yes | `argon2` (Argon2id, memory-hard); `jose` HS256 JWT; presigned URL uses AWS Signature V4 via SDK |

### Known Threat Patterns for This Stack

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Vendor tampers with another vendor's product ID | Tampering | `ProductService` ownership check: `eq(products.vendorId, authedVendorId)` on every mutation |
| Vendor submits arbitrary JSONB attribute values not in schema | Tampering | Service-layer validation: attribute keys validated against `attribute_definitions` for the category; `Zod.parse()` on request body before reaching service |
| Vendor bypasses moderation by directly setting `status = 'approved'` | Tampering | Status transitions only via named methods (submit, approve, reject) — never via direct field update in the generic `updateProduct()` |
| Oversized image upload (bypassing S3 content-length check) | DoS | `MAX_IMAGE_SIZE_BYTES` validated at presign time; `ContentLength` set on `PutObjectCommand` so R2/S3 rejects oversize PUT requests |
| OpenSearch injection via unsanitized search query `q` param | Tampering | Use structured queries (`multi_match`) not raw query string DSL; `q` param is a text value, not a JSON object |
| JWT with role=admin crafted by vendor | Elevation of Privilege | JWT signed with `JWT_SECRET`; verify with `jwtVerify(token, secret)` and check `payload.role` claim |
| Race condition: vendor simultaneously submits a product while admin is approving | Race Condition | Drizzle `.update().where(eq(products.id, id).and(eq(products.status, 'pending_review')))` — update returns 0 rows if status already changed; service returns conflict error |

---

## Project Constraints (from CLAUDE.md)

- **Money columns:** All price fields use BIGINT minor units (`price_minor` naming). No FLOAT, DECIMAL, NUMERIC(12,2). Enforced in `products.base_price_minor` and `product_variants.price_minor`.
- **No EAV:** Product attributes stored as JSONB with GIN index, validated against schema registry. No `(entity_id, key, value)` tables.
- **Drizzle ORM:** Use Drizzle 0.45.x + drizzle-kit beta for all schema definitions and migrations.
- **OpenSearch:** Use `@opensearch-project/opensearch` 3.6.x (Apache 2.0); not the Elasticsearch client.
- **BullMQ:** Use BullMQ 5.77.x + ioredis 5.x for async job queue.
- **jose:** Use `jose` 6.x for all JWT operations (already installed). Not `jsonwebtoken`.
- **Zod 4.x:** All request validation and shared contracts use Zod 4.
- **Tailwind v4 / Vite 8:** Not applicable — Phase 3 is backend-only.
- **No PaymentProvider in Phase 3:** Phase 3 has no payment code.
- **Feature flags:** `CATALOG_AUTO_APPROVE` must be DB-backed + Redis-cached via existing `FeatureFlagService`. Not hardcoded.

---

## Sources

### Primary (HIGH confidence)
- `CLAUDE.md` §Recommended Stack — all version-pinned packages including BullMQ 5.77.x, ioredis 5.11.x, jose 6.2.x, Zod 4.4.x
- `apps/api/src/db/schema/attribute-definitions.ts` — existing `is_searchable`, `is_filterable` flags; Phase 3 adds `is_variant`
- `apps/api/src/db/schema/vendor-category-restrictions.ts` — deferred FK documented in schema comment
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis-first cache pattern for `CATALOG_AUTO_APPROVE`
- `apps/api/src/modules/categories/CategoryService.ts` — slug collision pattern, soft-delete pattern, write-through cache invalidation
- `packages/contracts/src/auth.ts` — `JwtPayload` with `role: 'vendor'` and `vendorId` field already defined
- `apps/api/src/config/env.ts` — `OPENSEARCH_URL` already optional; `JWT_SECRET` already required
- `.planning/research/ARCHITECTURE.md` §Anti-Pattern 6 — searchable attribute projection guardrail
- `.planning/phases/03-catalog-search/03-CONTEXT.md` — all locked decisions (D-01 through D-18)

### Secondary (MEDIUM confidence)
- [OpenSearch JS client 3.0 blog](https://opensearch.org/blog/introducing-opensearch-js-client-3-0/) — v3 breaking changes; spec-generated types
- [OpenSearch Autocomplete docs](https://docs.opensearch.org/latest/search-plugins/searching-data/autocomplete/) — `search_as_you_type` vs completion suggester comparison
- [OpenSearch Faceted Search tutorial](https://docs.opensearch.org/latest/tutorials/faceted-search/) — `post_filter` + `aggs` pattern
- [Cloudflare R2 AWS SDK v3 docs](https://developers.cloudflare.com/r2/examples/aws/aws-sdk-js-v3/) — R2 endpoint + credential config for `@aws-sdk/client-s3`
- [AWS S3 Request Presigner docs](https://docs.aws.amazon.com/AWSJavaScriptSDK/v3/latest/Package/-aws-sdk-s3-request-presigner/) — `getSignedUrl` API
- [BullMQ Quick Start](https://docs.bullmq.io/readme-1) — `maxRetriesPerRequest: null` requirement; Queue/Worker pattern
- [Drizzle ORM cursor pagination](https://orm.drizzle.team/docs/guides/cursor-based-pagination) — composite cursor pattern

### Tertiary (LOW confidence)
- WebSearch results on argon2 vs bcrypt 2025 — confirmed against OWASP Password Storage Cheat Sheet recommendation for new code

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — all packages confirmed from CLAUDE.md (already locked versions) and official npm pages
- Architecture: HIGH — patterns directly observed in Phase 2 codebase; OpenSearch query patterns from official docs
- Pitfalls: HIGH — derived from direct code inspection + official BullMQ docs + Anti-Pattern 6 from ARCHITECTURE.md

**Research date:** 2026-05-31
**Valid until:** 2026-07-01 (30 days — stack is stable; OpenSearch client 3.x active development but non-breaking)
