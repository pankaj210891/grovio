---
phase: 02-category-engine
reviewed: 2026-05-30T00:00:00Z
depth: standard
files_reviewed: 31
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/container.ts
  - apps/api/src/modules/categories/CategoryService.ts
  - apps/api/src/modules/category-metadata/CategoryMetadataService.ts
  - apps/api/src/modules/category-metadata/CategoryMetadataService.test.ts
  - apps/api/src/modules/category-metadata/index.ts
  - apps/api/src/modules/product-templates/ProductTemplateService.ts
  - apps/api/src/modules/product-templates/ProductTemplateService.test.ts
  - apps/api/src/modules/product-templates/index.ts
  - apps/api/src/modules/vendor-restrictions/VendorRestrictionService.ts
  - apps/api/src/modules/vendor-restrictions/VendorRestrictionService.test.ts
  - apps/api/src/modules/vendor-restrictions/index.ts
  - apps/api/src/routes/admin/categories.ts
  - apps/api/src/routes/categories.ts
  - apps/web-admin/src/App.tsx
  - apps/web-admin/src/components/categories/AttributeRow.tsx
  - apps/web-admin/src/components/categories/BlockEditor.tsx
  - apps/web-admin/src/components/categories/CategoryTree.tsx
  - apps/web-admin/src/components/categories/CategoryTreeNode.tsx
  - apps/web-admin/src/lib/apiClient.ts
  - apps/web-admin/src/main.tsx
  - apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx
  - apps/web-admin/src/pages/categories/CategoryDetailPage.tsx
  - apps/web-admin/src/pages/categories/CategoryListPage.tsx
  - apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx
  - apps/web-admin/src/pages/categories/FilterSchemaPage.tsx
  - apps/web-admin/src/pages/categories/ProductTemplatePage.tsx
  - apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx
  - apps/web-admin/src/stores/categoryUiStore.ts
  - packages/contracts/src/category/tree.ts
findings:
  critical: 8
  warning: 8
  info: 3
  total: 19
status: issues_found
---

# Phase 02: Code Review Report

**Reviewed:** 2026-05-30T00:00:00Z
**Depth:** standard
**Files Reviewed:** 31
**Status:** issues_found

## Summary

The backend service layer (CategoryService, CategoryMetadataService, ProductTemplateService, VendorRestrictionService) is well-structured with clean domain separation, correct upsert semantics, and working block validation. The admin route file is also largely sound.

However, the frontend has a systemic API response-shape mismatch that will cause every data-fetching query to silently receive the wrong type at runtime. The `get<T>()` helper unwraps the `data` field of the API envelope, but most API routes return a nested object inside `data` (e.g., `{ attributes: [...] }`, `{ filters: [...] }`, `{ tree: [...] }`) rather than a bare array or primitive. The TypeScript generics hide this because they are typed as the expected result rather than the actual envelope shape. This is the most severe category of defect across the frontend.

Beyond that, the reorder route misuses the active drag item's ID as the `categoryId` parameter (the API expects the parent ID), the admin guard is bypassable in production, request body validation is missing on two admin routes, and there is a stale `rawIds` UI bug in the block editor.

---

## Critical Issues

### CR-01: Systemic API response-shape mismatch — attributes, filters, template, metadata, restrictions queries all receive wrong data

**Files:**
- `apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx:58`
- `apps/web-admin/src/pages/categories/FilterSchemaPage.tsx:133,139`
- `apps/web-admin/src/pages/categories/ProductTemplatePage.tsx:46,52`
- `apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx:50`
- `apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx:41`

**Issue:** The `get<T>()` client unwraps the `data` field from the API envelope and returns it directly as `T`. The backend routes return nested objects inside `data`:

| Route | `data` shape returned by API |
|---|---|
| `GET /categories/:id/attributes` | `{ attributes: AttributeDefinition[] }` |
| `GET /categories/:id/filters` | `{ filters: FilterSchemaDef[] }` |
| `GET /categories/:id/template` | `{ template: ProductTemplateMeta \| null }` |
| `GET /categories/:id/metadata` | `{ metadata: CategoryMetadata \| null }` |
| `GET /categories/:id/restrictions` | `{ isRestricted: boolean, approvedVendorIds: string[] }` |

Every `queryFn` is typed as if it receives a flat array/object (e.g., `get<AttributeDefinition[]>`, `get<FilterSchemaDef[]>`, `get<VendorCategoryRestriction[]>`), but it actually receives the wrapper object. At runtime, `attributes` in `AttributeBuilderPage` will be `{ attributes: [...] }`, not an array. All downstream `.map()` calls, `.length` checks, and `attrMap` construction will either throw or produce empty/undefined results — silently, because TypeScript is satisfied by the incorrect generic.

**Fix:** Either change the `queryFn` generics to match the actual nested shape and destructure, or change the API routes to return bare arrays. The least-breaking approach is to type and destructure correctly in the frontend:

```tsx
// AttributeBuilderPage.tsx — correct queryFn
queryFn: async () => {
  const data = await get<{ attributes: AttributeDefinition[] }>(
    `/categories/${categoryId}/attributes`
  );
  return data.attributes;
},

// FilterSchemaPage.tsx — correct for both queries
queryFn: async () => {
  const data = await get<{ attributes: AttributeDefinition[] }>(
    `/categories/${categoryId}/attributes`
  );
  return data.attributes;
},
queryFn: async () => {
  const data = await get<{ filters: FilterSchemaDef[] }>(
    `/categories/${categoryId}/filters`
  );
  return data.filters;
},

// ProductTemplatePage.tsx — template
queryFn: async () => {
  const data = await get<{ template: ProductTemplateMeta | null }>(
    `/categories/${categoryId}/template`
  );
  return data.template;
},

// CategoryMetadataPage.tsx — metadata
queryFn: async () => {
  const data = await get<{ metadata: CategoryMetadata | null }>(
    `/categories/${categoryId}/metadata`
  );
  return data.metadata;
},

// VendorRestrictionsPage.tsx — restrictions returns approvedVendorIds, not VendorCategoryRestriction[]
queryFn: async () => {
  const data = await get<{ isRestricted: boolean; approvedVendorIds: string[] }>(
    `/categories/${categoryId}/restrictions`
  );
  return data.approvedVendorIds; // and expose isRestricted separately
},
```

---

### CR-02: VendorRestrictionsPage queries wrong shape and iterates it incorrectly

**File:** `apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx:39-43,105,186-199`

**Issue:** This is a concrete consequence of CR-01 but deserves separate attention because the type contract is completely wrong. The API returns `{ isRestricted: boolean, approvedVendorIds: string[] }` but the page is typed as `VendorCategoryRestriction[]` (full row objects with `.id`, `.vendorId`, `.createdAt`). The component then renders `r.vendorId`, `r.id`, and `new Date(r.createdAt).toLocaleDateString()` — all of which will be `undefined` at runtime, rendering broken UI. Additionally, the duplicate-check `restrictions?.some((r) => r.vendorId === trimmed)` at line 105 will never match because `r.vendorId` is `undefined`.

**Fix:** Change the query type to match the actual API response. Since `approvedVendorIds` is just a `string[]`, either display bare UUIDs or add a separate query if full restriction row detail is needed:

```tsx
const { data: approvedVendorIds } = useQuery<string[]>({
  queryKey: ['categories', categoryId, 'restrictions'],
  queryFn: async () => {
    const data = await get<{ isRestricted: boolean; approvedVendorIds: string[] }>(
      `/categories/${categoryId}/restrictions`
    );
    return data.approvedVendorIds;
  },
  enabled: Boolean(categoryId),
});
// Duplicate check becomes: approvedVendorIds?.includes(trimmed)
// Render becomes: approvedVendorIds?.map((vendorId) => <li key={vendorId}>...)
```

---

### CR-03: Reorder mutation sends wrong `categoryId` — it sends the active dragged node's ID, not the parent's ID

**File:** `apps/web-admin/src/components/categories/CategoryTree.tsx:171-176`

**Issue:** The reorder route `POST /admin/categories/:id/reorder` expects `:id` to be the **parent** category ID (or any sibling — the server uses `_parentId` as informational context; however the `orderedIds` are the siblings being reordered). The `handleDragEnd` handler passes `categoryId: activeId` where `activeId` is the UUID of the node being dragged. This means the URL becomes `/admin/categories/<dragged-node-id>/reorder` rather than `/admin/categories/<parent-id>/reorder`. While the server's current implementation ignores `_parentId` and just processes `orderedIds`, if the route is tightened in future (e.g., validates that `:id` is the parent, or fetches children by parent for validation), this will break. More importantly it contradicts the stated API contract.

**Fix:**

```tsx
function handleDragEnd(event: DragEndEvent) {
  const { active, over } = event;
  if (!over || active.id === over.id) return;

  const activeId = String(active.id);
  const overId = String(over.id);
  const newOrder = computeNewOrder(flatItems, activeId, overId);
  if (!newOrder) return;

  // Use the parentId of the sibling group, not the active node's own ID
  reorderMutation.mutate({
    categoryId: newOrder.parentId ?? activeId, // fall back to activeId only if root
    orderedIds: newOrder.orderedIds,
  });
}
```

Since `newOrder.parentId` can be `null` for root nodes and the route requires an `:id` param, a separate root-reorder endpoint or a sentinel value needs to be decided — but at minimum the mutation variable `categoryId` must not be the active node's own ID.

---

### CR-04: Admin guard is completely absent in development — all admin routes are unprotected with no logging

**File:** `apps/api/src/routes/admin/categories.ts:46-64`

**Issue:** The preHandler returns immediately when `NODE_ENV !== "production"` without any logging or tracing. This is an intentional development shortcut, but it also means that if a developer or a CI environment accidentally has `NODE_ENV` unset or set to anything other than `"production"`, **all admin mutation endpoints are wide open** with no auth at all. An attacker who can reach the server and knows `NODE_ENV` is not `"production"` can call any admin endpoint, including `POST /admin/categories/:id/archive` (destructive) and `PUT /admin/categories/:id/metadata` (JSONB injection surface), with no credential.

More critically, the guard only applies in production via the `INTERNAL_ADMIN_TOKEN` header. This token is read from `process.env["INTERNAL_ADMIN_TOKEN"]` at **request time**, not at startup. If the env var is absent in production, `adminToken` will be `undefined`, and the check `!adminToken` causes a 401 for **every** request including legitimate ones — a complete lockout with no startup-time warning.

**Fix:**

```ts
// At startup (in awilixPlugin or app init), validate the token is present in production:
if (process.env['NODE_ENV'] === 'production' && !process.env['INTERNAL_ADMIN_TOKEN']) {
  throw new Error('INTERNAL_ADMIN_TOKEN must be set in production');
}

// In the preHandler, add logging for dev bypass:
fastify.addHook("preHandler", async (request, reply) => {
  const isProd = process.env["NODE_ENV"] === "production";
  if (!isProd) {
    fastify.log.warn({ path: request.url }, "Admin auth bypassed (non-production)");
    return;
  }
  // ... token check unchanged
});
```

---

### CR-05: Missing body validation on the reorder route — `orderedIds` is never validated

**File:** `apps/api/src/routes/admin/categories.ts:128-137`

**Issue:** `POST /admin/categories/:id/reorder` reads `const { orderedIds } = request.body as { orderedIds: string[] }`. Unlike other admin routes in the same file, this route does not call any Zod schema parse before using the value. If `orderedIds` is absent, not an array, or contains non-string items, `CategoryService.reorderCategories()` will iterate it silently. A missing `orderedIds` field yields `undefined`, and the `for` loop over `undefined` throws a runtime exception caught by the app-level error handler (leaking a 500). A non-array value (e.g., `null`) similarly throws. The body is type-cast with `as`, bypassing TypeScript's safety entirely.

```ts
// Same file, same pattern repeated at line 215 for attribute reorder
const { orderedIds } = request.body as { orderedIds: string[] };
```

**Fix:**

```ts
import { z } from 'zod';
const ReorderInputSchema = z.object({ orderedIds: z.array(z.string().uuid()) });

// In the route handler:
const { orderedIds } = ReorderInputSchema.parse(request.body);
```

---

### CR-06: Missing body validation on the vendor restriction POST route — `vendorId` and `createdByAdminId` are never validated

**File:** `apps/api/src/routes/admin/categories.ts:303-320`

**Issue:** `POST /admin/categories/:id/restrictions/vendors` reads `const { vendorId, createdByAdminId } = request.body as { vendorId: string; createdByAdminId: string }`. There is no Zod parse, no UUID format validation, and no check that either field is present. A request with no `vendorId` would insert `undefined` into the DB for the foreign-key column, either failing with a cryptic Postgres error or inserting a NULL depending on the column constraint. The `createdByAdminId` field is fully admin-controlled in Phase 2 (no real auth), so without validation an attacker can supply arbitrary values for audit trail fields.

**Fix:**

```ts
import { z } from 'zod';
const AddVendorInputSchema = z.object({
  vendorId: z.string().uuid(),
  createdByAdminId: z.string().uuid(),
});

// In the route handler:
const { vendorId, createdByAdminId } = AddVendorInputSchema.parse(request.body);
```

---

### CR-07: `VITE_INTERNAL_ADMIN_TOKEN` is read from frontend env and sent in every request, exposing it in the browser bundle

**File:** `apps/web-admin/src/lib/apiClient.ts:13,59`

**Issue:** `const ADMIN_TOKEN = import.meta.env['VITE_INTERNAL_ADMIN_TOKEN'] ?? ''` is compiled into the client-side JavaScript bundle. Any secret stored in a `VITE_*` variable is publicly visible in the browser's network tab, DevTools, and the bundled JS. The admin token is effectively a shared secret used to authenticate admin API requests; placing it in the frontend bundle renders it non-secret. Any user who can open the admin panel URL and inspect the bundle or network requests can extract the token and call admin APIs directly.

This is an accepted Phase 2 compromise (the comment acknowledges Phase 4 JWT replacement), but the current approach should be explicitly noted as a shipped security vulnerability until JWT is in place. If the admin panel is deployed to any non-localhost URL before Phase 4, the token is compromised.

**Fix (Phase 4 mitigations, but document the risk clearly):** Until JWT is implemented, do not deploy the admin panel to any externally accessible URL. For the code, at minimum add a startup assertion that the token is non-empty:

```ts
if (!ADMIN_TOKEN) {
  console.warn('[apiClient] VITE_INTERNAL_ADMIN_TOKEN is not set — admin mutations will be rejected by the server in production');
}
```

---

### CR-08: `CategoryService.getDepth()` performs up to 3 sequential DB round-trips in a loop with no cycle guard

**File:** `apps/api/src/modules/categories/CategoryService.ts:358-381`

**Issue:** `getDepth()` walks the parent chain with a `while (currentId !== null)` loop, issuing one DB query per ancestor. If data corruption or a future migration creates a cycle in `parentId` references, the loop will run indefinitely until the database connection is exhausted or the process is killed. There is no iteration cap beyond the comment "Max 3 iterations for the 3-level limit" — but the code does not enforce this limit. The loop only terminates when `currentId === null` (no more parent) or the row is not found. A malformed row with `parentId = own_id` (a self-cycle) would loop forever at `depth = 1`.

**Fix:** Add an explicit iteration cap matching the depth limit:

```ts
private async getDepth(categoryId: string): Promise<number> {
  const { db } = this.deps;
  let depth = 0;
  let currentId: string | null = categoryId;
  const MAX_DEPTH = 4; // one more than the allowed max to detect violations

  while (currentId !== null && depth <= MAX_DEPTH) {
    const rows = await db.select().from(categories).where(eq(categories.id, currentId)).limit(1);
    const row = rows[0];
    if (!row) break;
    currentId = row.parentId ?? null;
    if (currentId !== null) depth += 1;
  }

  return depth;
}
```

---

## Warnings

### WR-01: `ProductGridBlockForm` uses `Math.random()` as the radio `name` attribute — it changes on every render, breaking radio group exclusivity

**File:** `apps/web-admin/src/components/categories/BlockEditor.tsx:128`

**Issue:** `name={`layout_${Math.random()}`}` generates a new random value every render. Radio buttons sharing the same `name` attribute form a mutually exclusive group; if the `name` changes between renders (e.g., on any parent state update), the radio inputs no longer form a group and both can be checked simultaneously. This is both a functional bug and an accessibility violation (screen readers use `name` to identify radio groups).

**Fix:** Use the block's `localId` (available as `item.localId` in `BlockItem`), passed down to `ProductGridBlockForm`, for the name:

```tsx
// Pass localId into ProductGridBlockForm:
interface ProductGridBlockFormProps {
  block: ProductGridBlock;
  localId: string;  // add this
  onChange: (updated: ProductGridBlock) => void;
}

// In the form:
name={`layout_${localId}`}
```

---

### WR-02: `ProductGridBlockForm` has stale `rawIds` state — it does not sync when the block's `productIds` are updated externally

**File:** `apps/web-admin/src/components/categories/BlockEditor.tsx:87`

**Issue:** `const [rawIds, setRawIds] = useState(block.productIds.join('\n'))` initialises local state from props once. If the parent `BlockEditor` replaces the block (e.g., on reorder via dnd-kit drag end, which calls `arrayMove` then `onChange`), `rawIds` retains its stale value from the previous render. The textarea will display stale content while the underlying `block.productIds` is correct. This is the classic "initialise state from props" anti-pattern.

**Fix:** Use a `useEffect` to sync, or — better — make `rawIds` a pure derived display state calculated from `block.productIds` without being separately stored:

```tsx
function ProductGridBlockForm({ block, onChange }: ProductGridBlockFormProps) {
  // Derive display value from block, don't store it separately
  const rawIds = block.productIds.join('\n');

  function handleIdsChange(value: string) {
    const ids = value.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
    onChange({ ...block, productIds: ids });
  }

  return (
    <textarea
      value={rawIds}
      onChange={(e) => handleIdsChange(e.target.value)}
      ...
    />
  );
}
```

---

### WR-03: `CategoryMetadataPage.handleSave()` silently omits field values when the user clears them — cannot delete existing SEO fields

**File:** `apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx:98-106`

**Issue:** The save handler only includes a field in the payload when `trim()` is non-empty: `...(seoTitle.trim() ? { seoTitle: seoTitle.trim() } : {})`. If the admin loads a category with an existing `seoTitle` and clears the input to remove it, the field is simply omitted from the payload. The `upsertMetadata` service uses `PATCH`-style semantics: `undefined` means "do not change". So clearing a field and saving has no effect — the old value persists in the database. There is no way to intentionally null out an SEO field through the UI.

**Fix:** Always include the field in the payload, using `null` or `''` as the explicit "clear" value, and ensure the service and schema support nullable strings:

```ts
saveMutation.mutate({
  seoTitle: seoTitle.trim() || null,
  seoDescription: seoDescription.trim() || null,
  seoKeywords: seoKeywords.trim() || null,
  canonicalUrl: canonicalUrl.trim() || null,
  description: description.trim() || null,
  imageUrl: imageUrl.trim() || null,
  blocks: blocks.map((b) => b.block),
});
```

---

### WR-04: `CategoryDetailPage.useEffect` syncs form state from query data on every re-render of `category`, including after mutations — unsubmitted form edits are silently overwritten

**File:** `apps/web-admin/src/pages/categories/CategoryDetailPage.tsx:72-79`

**Issue:**

```ts
useEffect(() => {
  if (category) {
    setName(category.name);
    setSlug(category.slug);
    // ...
  }
}, [category]);
```

`updateMutation.onSuccess` calls `queryClient.setQueryData(['categories', id], updated)`, which updates the `category` query data object reference, triggering this `useEffect`. If the admin is mid-edit when a background refetch (or the mutation's own `invalidateQueries`) resolves, all unsaved form inputs are silently reset to the server values. This is a silent data-loss UX bug.

**Fix:** Use a `useRef` to track whether the form has been initialized from server data, and only sync on first load:

```ts
const hasInitialized = useRef(false);
useEffect(() => {
  if (category && !hasInitialized.current) {
    hasInitialized.current = true;
    setName(category.name);
    setSlug(category.slug);
    setSortOrder(category.sortOrder);
    setIsRestricted(category.isRestricted);
  }
}, [category]);
```

---

### WR-05: `CategoryService.reorderCategories()` issues N sequential DB updates instead of a single batch, with no transaction

**File:** `apps/api/src/modules/categories/CategoryService.ts:266-274`

**Issue:** The reorder loop issues one `UPDATE` per category ID:

```ts
for (let i = 0; i < orderedIds.length; i++) {
  await db.update(categories).set({ sortOrder: i }).where(eq(categories.id, orderedIds[i]!));
}
```

This is not inside a transaction. If the process crashes or the connection drops mid-loop, the sort orders are partially updated — some siblings have their new `sortOrder` and others have the old value. The category tree will be in a corrupt state until the next successful reorder. Additionally, the tree cache is invalidated **after** the loop, so a concurrent read during the partial update could receive and cache a corrupt tree.

**Fix:** Wrap in a transaction:

```ts
async reorderCategories(_parentId: string | null, orderedIds: string[]): Promise<void> {
  const { db } = this.deps;
  await db.transaction(async (tx) => {
    for (let i = 0; i < orderedIds.length; i++) {
      await tx.update(categories).set({ sortOrder: i, updatedAt: new Date() }).where(eq(categories.id, orderedIds[i]!));
    }
  });
  await this.invalidateTree();
}
```

---

### WR-06: `AttributeBuilderPage.handleSave()` performs sequential API calls with no transaction — partial save leaves data in inconsistent state

**File:** `apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx:105-179`

**Issue:** The save procedure is: (1) delete removed attributes, (2) create/update each row sequentially, (3) reorder. If step 2 fails midway (e.g., network error on the third `POST`), some attributes have been deleted and some have been created, but the remaining rows were not created and no reorder was sent. The UI shows an error and leaves the server-side attribute list partially updated. There is no rollback. Refreshing the page will show a different attribute list than what the admin had configured.

This is a fundamental multi-step mutation problem. The proper fix is a bulk upsert API endpoint, but as a short-term mitigation:

**Fix:** Run all creates/updates first, then deletes — so a failure before any delete preserves all existing data. Also wrap the delete and create phases so that if creates fail, deletes are not attempted:

```ts
// 1. Create/update first (no data loss if this fails)
const savedRows = await Promise.all(rows.map(async (row, i) => { ... }));
// 2. Delete only after all creates/updates succeed
await Promise.all(toDelete.map((id) => del(...)));
// 3. Reorder
await post(...);
```

---

### WR-07: `applyReorderToTree` in CategoryTree does not update `sortOrder` on the reordered nodes in the optimistic update cache

**File:** `apps/web-admin/src/components/categories/CategoryTree.tsx:217-239`

**Issue:** `reorderByIds` reconstructs the children array in the new order but does not update `node.sortOrder` to reflect the new positions. The optimistic tree will render in the correct visual order (because `flattenTree` reads array position, not `sortOrder`), but if the tree is then re-sorted by `sortOrder` anywhere (e.g., after a successful mutation triggers an invalidation and refetch before the server responds), the old `sortOrder` values will cause a visible flash back to the original order before the fresh data arrives.

**Fix:** Update `sortOrder` in `reorderByIds`:

```ts
function reorderByIds(nodes: CategoryTreeNode[], orderedIds: string[]): CategoryTreeNode[] {
  const map = new Map(nodes.map((n) => [n.id, n]));
  return orderedIds.flatMap((id, i) => {
    const node = map.get(id);
    return node ? [{ ...node, sortOrder: i }] : [];
  });
}
```

---

### WR-08: `CategoryService.buildTree()` depth calculation is incorrect for orphaned nodes promoted to roots

**File:** `apps/api/src/modules/categories/CategoryService.ts:336-341`

**Issue:** When a node's parent is not in the result set (archived), the node is treated as a root node with `depth = 0`. However, the `CategoryTreeNodeSchema` in `packages/contracts/src/category/tree.ts:53` constrains `depth` to `min(0).max(2)`. A node that was originally at depth 2 (a grandchild of an archived root) will have its depth reset to 0 in the tree response. This is not necessarily wrong for display, but the `CategoryTreeNode.depth` contract says depth represents position in the 3-level hierarchy. A depth-0 node with an archived parent being displayed as a root is misleading and may cause the "Add Sub" button to appear on it even though it cannot have children (its original depth was already 2). The `node.depth < 2` guard in `CategoryTreeNode.tsx:144` would then incorrectly allow `+ Sub` to be offered.

**Fix:** Document this edge case explicitly, or exclude orphaned nodes from the tree result instead of promoting them. The safest change is to exclude them:

```ts
// In buildTree pass 2: if parent not found, do not add to roots — skip the node
if (!parent) {
  // Parent is archived: skip this orphaned node from the tree
  continue; // or push to a separate orphanedNodes list for logging
}
```

---

## Info

### IN-01: `import { framer-motion }` — App.tsx uses `motion` from `framer-motion` directly instead of the `motion/react` import path

**File:** `apps/web-admin/src/App.tsx:1`

**Issue:** `import { motion } from 'framer-motion'` works but CLAUDE.md and the tech stack specification require importing from `motion/react` for framer-motion 12.x. All other motion usage in the codebase should use the `motion/react` import path per the project's own stack documentation.

**Fix:** `import { motion } from 'motion/react';`

---

### IN-02: `beforeEach` is imported but unused in `VendorRestrictionService.test.ts` and `ProductTemplateService.test.ts`

**Files:**
- `apps/api/src/modules/vendor-restrictions/VendorRestrictionService.test.ts:1`
- `apps/api/src/modules/product-templates/ProductTemplateService.test.ts:1`

**Issue:** Both test files import `beforeEach` from vitest but no `beforeEach` block is used anywhere in either file. Dead import.

**Fix:** Remove `beforeEach` from the import in both files:

```ts
import { describe, expect, it, vi } from "vitest";
```

---

### IN-03: `CategoryUiStore` custom `storage` adapter does not handle the `version` field in the Zustand persist serialization format

**File:** `apps/web-admin/src/stores/categoryUiStore.ts:66-88`

**Issue:** The custom `getItem` casts the raw localStorage value as `{ state: PersistedState }`, but Zustand's persist middleware serializes as `{ state: PersistedState, version: number }`. If the version field is used in a future `migrate` option, the custom adapter will silently lose it. Additionally, the `setItem` only serializes `state.expandedIds`, discarding any future top-level persist state fields. This is low risk now but fragile as the store grows.

**Fix:** Pass through `version` in the adapter:

```ts
getItem: (name) => {
  const raw = localStorage.getItem(name);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as { state: PersistedState; version?: number };
    return {
      state: { expandedIds: new Set(parsed.state.expandedIds ?? []) },
      version: parsed.version,
    };
  } catch { return null; }
},
setItem: (name, value) => {
  const serializable = {
    state: { expandedIds: Array.from((value.state as CategoryUiState).expandedIds) },
    version: value.version,
  };
  localStorage.setItem(name, JSON.stringify(serializable));
},
```

---

_Reviewed: 2026-05-30T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
