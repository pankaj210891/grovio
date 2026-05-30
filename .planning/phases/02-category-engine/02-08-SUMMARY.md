---
phase: 02-category-engine
plan: "08"
subsystem: web-admin-category-editors
tags: [react, typescript, dnd-kit, react-query, framer-motion, tailwind, category-engine, admin-ui, attribute-builder, filter-schema, product-template, vendor-restrictions, metadata]

# Dependency graph
requires:
  - 02-07-category-tree-ui  # CategoryDetailPage tab scaffold; apiClient.ts; dnd-kit packages already installed

provides:
  - AttributeRow.tsx component (6 AttrType values, conditional options editor, dnd-kit drag handle)
  - AttributeBuilderPage.tsx (reorderable attribute form list, single Save syncs POST/PATCH/DELETE/reorder)
  - FilterSchemaPage.tsx (filterable-only facets, Pattern-6 display type defaults, PUT .../filters)
  - ProductTemplatePage.tsx (template fields keyed by attribute key, PUT .../template)
  - VendorRestrictionsPage.tsx (toggle is_restricted, add/remove vendor UUIDs, Phase-3 enforcement note)
  - BlockEditor.tsx (3 block types: banner/product_grid/text_block, dnd-kit reorder, typed form fields)
  - CategoryMetadataPage.tsx (SEO fields + BlockEditor, surfaces server 400 validation)
  - CategoryDetailPage.tsx updated — all 5 editor tabs wired (Attributes, Filters, Template, Metadata, Restrictions)

affects:
  - 02-09  # if any — no known downstream dependencies in Phase 2

# Tech tracking
tech-stack:
  added: []  # no new packages — uses packages from plan 02-07 (dnd-kit, react-query, framer-motion)
  patterns:
    - "AttributeRow controlled form: all row state lives in parent; onChange/onRemove callbacks"
    - "Auto-derive key from label: slug-style auto-key until user manually edits key field"
    - "Single Save pattern (AttributeBuilderPage): compare server state → delete removed → create/update all → reorder"
    - "Pattern-6 display type mapping: number→range_slider, boolean→toggle, enum→radio, multi_select→checkbox"
    - "BlockEditor with per-type form fields: discriminated union rendered via block.type switch"
    - "Server 400 block validation surfaced in CategoryMetadataPage via ApiError.code + message"
    - "VendorRestrictionsPage reads is_restricted from React Query cache (avoids double fetch)"

key-files:
  created:
    - apps/web-admin/src/components/categories/AttributeRow.tsx
    - apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx
    - apps/web-admin/src/pages/categories/FilterSchemaPage.tsx
    - apps/web-admin/src/pages/categories/ProductTemplatePage.tsx
    - apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx
    - apps/web-admin/src/components/categories/BlockEditor.tsx
    - apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx
  modified:
    - apps/web-admin/src/pages/categories/CategoryDetailPage.tsx

key-decisions:
  - "Single Save in AttributeBuilderPage: compare prior server attrs vs current rows to determine delete/create/update/reorder in one user action (avoids per-row save complexity)"
  - "FilterSchemaPage only offers is_filterable attributes: enforces T-02-21 at UI level; server re-validates"
  - "VendorRestrictionsPage: reads is_restricted from cached category detail query to avoid a second round-trip on tab open"
  - "BlockEditor productIds: textarea with one UUID per line or comma-separated (no drag-from-catalog in v1)"
  - "CategoryMetadataPage save: uses spread of optional fields — only populated fields sent, consistent with UpsertMetadataInputSchema"
  - "Build skipped: pre-existing Node 18 vs Vite 8 incompatibility (CustomEvent not defined); typecheck (tsc --noEmit) exits 0 as the verified gate, consistent with 02-07 precedent"

# Metrics
duration: ~8m
completed: 2026-05-30
tasks_completed: 2
files_created: 7
files_modified: 1
---

# Phase 02 Plan 08: Category Configuration Editors Summary

**Full per-category configuration UI in web-admin: attribute builder (6 types + options editor), filter schema editor (filterable-only facets), product template editor (key-referenced fields), vendor restriction manager (allowlist + Phase-3 enforcement note), and metadata editor (SEO fields + typed merchandising blocks) — all wired as live tabs in CategoryDetailPage, typecheck passes**

## Performance

- **Duration:** ~8 minutes
- **Started:** 2026-05-30T11:19:03Z
- **Completed:** 2026-05-30T11:27:33Z
- **Tasks:** 2 of 3 auto tasks executed; Task 3 is human-verify checkpoint
- **Files created:** 7 | **Files modified:** 1

## Accomplishments

### Task 1 (commit e8d7897) — Attribute builder + filter schema editors (CAT-03, CAT-04)

- **`apps/web-admin/src/components/categories/AttributeRow.tsx`** — controlled form row for one attribute definition; dnd-kit `useSortable` drag handle; key/label/type fields (all 6 AttrType values in dropdown); required/filterable/searchable checkboxes; conditional options editor (only shown when attrType is `enum` or `multi_select`) with add/remove option pairs; `toRowData()` converter for server → local state; auto-derives key from label until key is manually edited
- **`apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx`** — `useQuery(['categories', id, 'attributes'])` loads server attrs into local form-list state; DnD reorder via dnd-kit SortableContext; add/remove row actions; single Save button: compares server state to current rows, DELETEs removed attrs, POSTs new attrs, PATCHes modified attrs, then POSTs reorder call; invalidates attributes query key on success
- **`apps/web-admin/src/pages/categories/FilterSchemaPage.tsx`** — loads attributes (filter to `is_filterable=true`) and current filter schema; shows active facets with dnd-kit reorder and display type selector; Pattern-6 default display type mapping; only offers `is_filterable` attributes as "add" options (security gate T-02-21); single Save via `PUT /admin/categories/:id/filters` with UpsertFilterSchemaInput

### Task 2 (commit 6d2e131) — Template/vendor/metadata/block editors + tab wiring (CAT-05..07)

- **`apps/web-admin/src/pages/categories/ProductTemplatePage.tsx`** — loads attributes and existing template; renders one row per attribute with default value and hint inputs; omits fields with no default/hint from the saved payload; Save via `PUT /admin/categories/:id/template`; template fields keyed by attribute `key` (not id) per CAT-05
- **`apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx`** — reads `is_restricted` from React Query category cache; toggle switch calls `PATCH /admin/categories/:id`; approved vendor list from `GET /categories/:id/restrictions`; add vendor form with UUID validation + duplicate check + `POST .../restrictions/vendors`; remove via `DELETE .../restrictions/vendors/:vendorId`; prominent Phase-3 enforcement note (D-11)
- **`apps/web-admin/src/components/categories/BlockEditor.tsx`** — reorderable block list (dnd-kit SortableContext); "+" button group for banner/product_grid/text_block; per-type form fields: banner (imageUrl/title/subtitle/ctaText/ctaUrl), product_grid (title/productIds textarea/layout radio), text_block (title/content); collapse/expand per block; no WYSIWYG per v1 decision
- **`apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx`** — loads `GET /categories/:id/metadata` (null if not yet created); flat SEO fields (seoTitle/seoDescription/seoKeywords/canonicalUrl/description/imageUrl); embeds BlockEditor; Save sends full payload to `PUT /admin/categories/:id/metadata`; surfaces `ApiError.code + message` on 400 (server-side MerchandisingBlockSchema validation); guidance note on invalid block patterns
- **`apps/web-admin/src/pages/categories/CategoryDetailPage.tsx`** — removed all "coming in plan 02-08" placeholders; removed `comingSoon` tab badge; added imports for all 5 editors; renders each editor inside the appropriate tab `activeTab` branch

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Attribute builder + filter schema editors (CAT-03, CAT-04) | e8d7897 | AttributeRow.tsx, AttributeBuilderPage.tsx, FilterSchemaPage.tsx |
| 2 | Template/vendor/metadata/block editors + tab wiring (CAT-05..07) | 6d2e131 | ProductTemplatePage.tsx, VendorRestrictionsPage.tsx, BlockEditor.tsx, CategoryMetadataPage.tsx, CategoryDetailPage.tsx |
| 3 | Human verification checkpoint | — | Awaiting browser testing |

## Task 3: Human Verification Required

**Task 3 is a `checkpoint:human-verify` gate.** The executor cannot perform browser testing. The human must verify the following end-to-end.

### Setup
1. Start Docker (postgres + redis): `docker-compose up -d`
2. Start the API: `pnpm --filter @grovio/api dev` — confirm on port 3000
3. Ensure `apps/web-admin/.env.local` has `VITE_API_BASE_URL=http://localhost:3000` and `VITE_INTERNAL_ADMIN_TOKEN=<value from apps/api/.env>`
4. Start the admin app: `pnpm --filter @grovio/web-admin dev` — confirm it starts (port 5174 or 5175)
5. Navigate to a category detail page: `http://localhost:5174/categories/:id` (use any existing category)

### Verification steps

1. **Attributes tab:** add a `text` attribute (key: `color`, label: `Color`) and an `enum` attribute (key: `size`, label: `Size`, add options S/M/L); mark the enum filterable; click Save — reload and confirm persistence
2. **Filters tab:** confirm only the `size` attribute (filterable) is offered — `color` should NOT appear; add size with display type `radio`; Save; reload and confirm
3. **Template tab:** set a default ("M") and hint ("Select the primary size") for the `size` attribute; Save; reload and confirm
4. **Vendor Restrictions tab:** toggle `is_restricted` on; add a test vendor UUID; confirm it appears in the list; remove it; confirm it disappears
5. **Metadata tab:** fill SEO Title + SEO Description + SEO Keywords; add a `banner` block (imageUrl: `https://example.com/b.jpg`, title: `Test Banner`); add a `product_grid` block; save — confirm success; then clear all productIds from the product_grid and save again — confirm the server returns a 400 validation error that the UI displays

### Verification command
```bash
pnpm --filter @grovio/web-admin typecheck
# Expected: exits 0
```

## Deviations from Plan

### None Required

All tasks executed exactly as specified. No bugs encountered, no architectural changes needed, no blocking issues.

**Noted pre-existing constraint (out of scope, same as 02-07):**
- `pnpm --filter @grovio/web-admin build` fails with `ReferenceError: CustomEvent is not defined` — Vite 8 requires Node.js >=20.19; environment has Node 18.20.4. Typecheck (tsc --noEmit) is the verified gate, consistent with 02-07 precedent.

## Known Stubs

None. All 5 editors are fully wired to their API endpoints. No hardcoded empty values or placeholders remain in the tab container.

## Threat Surface Scan

All threats addressed per the plan's threat model:

| Threat | File | Mitigation |
|--------|------|-----------|
| T-02-20 (malformed blocks) | CategoryMetadataPage.tsx | 400 from server surfaced via ApiError; BlockEditor constructs typed blocks only |
| T-02-21 (non-filterable facet) | FilterSchemaPage.tsx | UI only offers is_filterable attributes; server re-validates |
| T-02-22 (options omitted/extra) | AttributeBuilderPage.tsx | Client validates before save; server enforces via AttributeDefinitionService |

No new network surfaces introduced beyond those already in the plan's threat model.

## Self-Check: PASSED

- [x] `apps/web-admin/src/components/categories/AttributeRow.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/FilterSchemaPage.tsx` — FOUND
- [x] `apps/web-admin/src/components/categories/BlockEditor.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/ProductTemplatePage.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/CategoryDetailPage.tsx` — FOUND (updated)
- [x] Commit e8d7897 — Task 1 (attribute builder + filter schema) — FOUND
- [x] Commit 6d2e131 — Task 2 (template/vendor/metadata/blocks + tab wiring) — FOUND
- [x] AttributeRow renders 6 AttrType values in dropdown — VERIFIED
- [x] AttributeRow conditionally renders options editor for enum/multi_select only — VERIFIED
- [x] FilterSchemaPage only offers is_filterable attributes — VERIFIED
- [x] FilterSchemaPage saves via PUT .../filters — VERIFIED
- [x] ProductTemplatePage saves template fields keyed by attribute `key` — VERIFIED
- [x] VendorRestrictionsPage has Phase-3 enforcement note — VERIFIED
- [x] BlockEditor supports banner, product_grid, text_block with type-specific fields — VERIFIED
- [x] CategoryMetadataPage surfaces server 400 errors — VERIFIED (ApiError.code + message)
- [x] CategoryDetailPage renders all 5 editors as live tabs (no "coming soon") — VERIFIED
- [x] `pnpm --filter @grovio/web-admin typecheck` exits 0 — VERIFIED
- [x] No unexpected file deletions — VERIFIED
