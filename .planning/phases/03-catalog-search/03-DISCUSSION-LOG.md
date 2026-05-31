# Phase 3: Catalog & Search - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-31
**Phase:** 3-Catalog & Search
**Areas discussed:** Variant modeling, Moderation workflow, Image handling, Search indexing + vendor auth

---

## Variant Modeling

| Option | Description | Selected |
|--------|-------------|----------|
| Full variant table (per-variant pricing/SKU) | product_variants table: own SKU, own price (BIGINT), option_values JSONB. Phase 5 inventory tracks per-variant. | ✓ |
| Variant options only (flat JSONB) | Variants as label+option combinations in JSONB. Single price on product. Simpler schema; Phase 5 inventory tracks at product level only. | |

**User's choice:** Full variant table

| Option | Description | Selected |
|--------|-------------|----------|
| Category schema drives variant axes | Admin marks attribute_definitions with is_variant=true. Consistent with existing attribute system. | ✓ |
| Free-form per product | Vendor defines variant option names/values freely. No schema validation. | |
| Hybrid: category suggests, vendor can add | Category provides suggested axes; vendor adds product-specific options. Most flexible, most complex. | |

**User's choice:** Category schema drives it

| Option | Description | Selected |
|--------|-------------|----------|
| SKU + price + option values | Each variant: own SKU, price_minor BIGINT, option_values JSONB. | ✓ |
| SKU + price + option values + images | Same plus per-variant image overrides. | |

**User's choice:** SKU + price + option values (per-variant images deferred)

| Option | Description | Selected |
|--------|-------------|----------|
| Optional — variant-free products allowed | No variant rows when category has no is_variant=true attributes. Uses base_price_minor. | ✓ |
| Always required — at least one 'default' variant | Uniform data model; inventory always queries variants. Overhead for simple products. | |

**User's choice:** Variants are optional

---

## Moderation Workflow

| Option | Description | Selected |
|--------|-------------|----------|
| draft → pending_review → approved / rejected | Four states. Vendor submits; admin approves or rejects with reason. | ✓ |
| draft → pending_review → approved / rejected → archived | Same + vendors can archive approved products. | |

**User's choice:** Four-state machine (draft, pending_review, approved, rejected)

| Option | Description | Selected |
|--------|-------------|----------|
| Edit freely in both states — editing pending resets to draft | Vendor can edit draft or rejected freely. Editing pending moves back to draft (prevents stale approval). | ✓ |
| Edit rejected only — pending is locked | Admin reviews the submitted version unchanged. | |
| Edit anytime, admin reviews latest version | No state change on edit. Admin sees current version. | |

**User's choice:** Edit freely in both; editing pending resets to draft

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — feature-flagged auto-approve (CATALOG_AUTO_APPROVE) | Feature flag bypasses manual review. Default OFF. | ✓ |
| No — always manual review | Admin must approve every product. | |

**User's choice:** Feature-flagged auto-approval

| Option | Description | Selected |
|--------|-------------|----------|
| Required rejection reason | Admin must provide text reason. Stored on product, shown to vendor. | ✓ |
| Optional rejection reason | Admin can reject without reason. | |

**User's choice:** Rejection reason is required

---

## Image Handling

| Option | Description | Selected |
|--------|-------------|----------|
| URL-only storage | Vendors provide external URLs. No upload API, no object storage. | |
| Cloudinary upload (free tier) | Unsigned upload preset. CLOUDINARY_* env vars. 25 credits/mo free. | |
| S3-compatible upload (e.g. Cloudflare R2) | Presigned URL flow. Backend generates upload URL, vendor uploads directly, backend stores result. | ✓ |

**User's choice:** S3-compatible presigned URL flow

| Option | Description | Selected |
|--------|-------------|----------|
| Max 8 images, 5MB each | Reasonable defaults enforced at presigned URL generation. | |
| Max 5 images, 2MB each | Tighter limits. | |
| Configurable via env vars only | MAX_IMAGES_PER_PRODUCT and MAX_IMAGE_SIZE_BYTES. Buyers set own limits. | ✓ |

**User's choice:** Configurable via env vars (defaults: 8 images, 5MB each)

| Option | Description | Selected |
|--------|-------------|----------|
| Cloudflare R2 (documented default) | Free tier: 10GB, zero egress, S3-compatible. | ✓ |
| AWS S3 | Standard. IAM complexity. No permanent free tier. | |
| Provider-agnostic S3 env vars | S3_BUCKET_URL/KEY/SECRET. Buyer chooses provider. | |

**User's choice:** Cloudflare R2 as documented default (implementation is provider-agnostic)

---

## Search Indexing + Vendor Auth

| Option | Description | Selected |
|--------|-------------|----------|
| Index only on approval | Products enter OpenSearch when status → approved only. Draft/pending/rejected never appear. | ✓ |
| Index on every save, filter at query time | All products indexed; query filters by status. Simpler indexing, complex queries. | |

**User's choice:** Index only on approval (remove from index on de-approval)

| Option | Description | Selected |
|--------|-------------|----------|
| Async via BullMQ job | Approval triggers ProductIndexJob. Decoupled, retry-safe, consistent with ARCHITECTURE.md. | ✓ |
| Synchronous write-through | Direct OpenSearch call in approve handler. Simpler, but blocks API response. | |

**User's choice:** Async via BullMQ

| Option | Description | Selected |
|--------|-------------|----------|
| Name + description + approved searchable attributes | OpenSearch indexes name, description, and is_searchable=true attribute values. Type-ahead: product names + category names. | ✓ |
| Name + description only | Simpler mapping. Loses attribute-value search (e.g., 'leather', '128GB'). | |

**User's choice:** Name + description + searchable attributes; type-ahead covers products + categories

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 3 includes minimal vendor auth | vendors table + vendor JWT. Catalog APIs properly gated. Clean boundary with Phase 4 (customer auth). | ✓ |
| Phase 4 owns all auth — Phase 3 auth-ready but not gated | Catalog APIs accept vendor_id without enforcement. Faster Phase 3, messy boundary. | |

**User's choice:** Phase 3 includes minimal vendor auth

---

## Claude's Discretion

- OpenSearch index name and mapping template structure
- BullMQ queue name and concurrency settings for ProductIndexJob
- JWT access token TTL for vendor tokens
- Product slug generation strategy (auto-derived from name + unique suffix)
- Pagination strategy for vendor product list and admin moderation queue (cursor recommended)
- product_images sort_order reordering API design

## Deferred Ideas

- Per-variant image overrides (considered during variants discussion; deferred to post-v1)
- Vendor panel UI for product creation/management — Phase 6
- Admin moderation panel UI — Phase 6
- Bulk product import / CSV upload — post-v1
- Product reviews and ratings — post-v1
- Price history / price change audit log — post-v1
- OpenSearch mapping migration tooling — post-v1
