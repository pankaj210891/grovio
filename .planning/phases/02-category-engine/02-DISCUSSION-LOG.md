# Phase 2: Category Engine - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-29
**Phase:** 02-category-engine
**Areas discussed:** Category Depth + Public Tree Shape, Vendor Access Model, Attribute Type Set + Builder UI, Merchandising Blocks Schema

---

## Category Depth + Public Tree Shape

| Option | Description | Selected |
|--------|-------------|----------|
| 3 levels (Root → Subcategory → Leaf) | Matches Amazon/Flipkart/Walmart; covers all 5 demo verticals; OpenSearch mapping stays bounded | ✓ |
| 2 levels | Simpler but too shallow for grocery/electronics verticals | |
| Unlimited depth | Most flexible but admin tree UI gets complex and OpenSearch mapping harder to bound | |

**User's choice:** 3-level maximum depth enforced at API level

| Option | Description | Selected |
|--------|-------------|----------|
| Full tree in one response, Redis-cached | GET /categories returns full nested tree; Redis-cached; invalidated on admin writes; one call for storefront mega-nav | ✓ |
| Flat list with parent_id, client builds tree | Same one-call approach but shifts tree-building to every client | |
| Lazy — load children on expand | Lower first-payload but requires multiple round trips; better for 1000+ category catalogs | |

**User's choice:** Full nested tree in one GET /categories response, Redis-cached, invalidated on admin writes

**Notes:** User explicitly confirmed: do not propose unlimited depth. Keep tree shape aligned with a bounded, storefront-friendly structure. Navigation fields only in the full-tree response; per-category detail fetched lazily.

---

## Vendor Access Model

| Option | Description | Selected |
|--------|-------------|----------|
| Per-category restricted flag | Categories default open; admin marks specific categories as restricted and assigns approved vendors | ✓ |
| Allowlist — vendor must be approved for every category | Default-deny; high admin burden for marketplaces with many open categories | |
| Open — no restrictions in v1 | Simplest schema but doesn't satisfy CAT-06 success criterion | |

**User's choice:** Per-category restricted flag

**Notes:** User explicitly confirmed: categories default open, only specific categories can be marked restricted, restricted categories have approved vendors assigned. Do not use a full allowlist in v1.

---

## Attribute Type Set + Builder UI

| Option | Description | Selected |
|--------|-------------|----------|
| 6 core types (text, textarea, number, boolean, enum, multi_select) | Covers all 5 demo verticals with no gaps; range/date deferred to v1.x | ✓ |
| 8 types — include range + date | More expressive but adds admin builder and vendor form complexity in Phase 2 | |
| 4 core types only | Omits textarea and multi_select; insufficient for grocery and furniture demo presets | |

**User's choice:** 6 core types — text, textarea, number, boolean, enum, multi_select

| Option | Description | Selected |
|--------|-------------|----------|
| Simple form list with reorder | Row-based editing; up/down buttons or drag handle; fast to build; DnD reserved for category tree | ✓ |
| Visual drag-and-drop field palette | Drag-from-palette builder (Typeform-style); impressive but adds DnD complexity on top of category tree DnD | |
| You decide | Defer to Claude's discretion based on Phase 1 UI patterns | |

**User's choice:** Simple form list with reorder

**Notes:** User explicitly confirmed: row-based editing with key/label/type/required/sort-order fields. Drag-and-drop reserved for the category tree as the primary DnD surface.

---

## Merchandising Blocks Schema

| Option | Description | Selected |
|--------|-------------|----------|
| Typed block model, minimal v1 set | Discriminated union: banner | product_grid | text_block; SEO as flat columns; migration-safe for Phase 4 | ✓ |
| Freeform JSON blob per category | Fast to build but Phase 4 must accept same format or run a migration; no stable contract | |
| SEO fields only in v1, defer blocks to Phase 4 | Partially satisfies CAT-07; Phase 4 adds blocks table; split ownership across phases | |

**User's choice:** Typed block model with minimal v1 block types (banner, product_grid, text_block)

**Notes:** User explicitly confirmed: typed discriminated union, SEO fields as flat columns (not block types), schema must be compatible with Phase 4 CMS homepage blocks without requiring a migration. Block types defined in packages/contracts/src/category/blocks.ts.

---

## Claude's Discretion

- Category slug generation strategy (auto-derived vs admin-provided with auto-fallback)
- Filter schema `display_type` enum values (checkbox, radio, range_slider, toggle)
- Product template JSON structure (field defaults + hints per attribute_definition)
- Redis cache key naming for category tree
- Pagination strategy for admin category list endpoint

## Deferred Ideas

- Vendor restriction enforcement at product creation → Phase 3 (catalog module)
- OpenSearch mapping generation from attribute_definitions → Phase 3 decision (resolve during Phase 2 execution)
- Admin category analytics (view/product counts) → Phase 6
- Category-level commission overrides → Phase 5
- i18n per-category names/descriptions → v2
- Vendor-supplied category suggestions (propose + admin approve) → v1.x or later
