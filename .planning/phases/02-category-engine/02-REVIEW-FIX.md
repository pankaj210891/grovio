---
phase: 02-category-engine
fixed_at: 2026-05-30T00:00:00Z
review_path: .planning/phases/02-category-engine/02-REVIEW.md
iteration: 1
findings_in_scope: 16
fixed: 16
skipped: 0
status: all_fixed
---

# Phase 02: Code Review Fix Report

**Fixed at:** 2026-05-30T00:00:00Z
**Source review:** .planning/phases/02-category-engine/02-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 16 (8 Critical + 8 Warning)
- Fixed: 16
- Skipped: 0

## Fixed Issues

### CR-01 + CR-02: API response-shape mismatch — all 5 editor pages used wrong generic types

**Files modified:**
- `apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx`
- `apps/web-admin/src/pages/categories/FilterSchemaPage.tsx`
- `apps/web-admin/src/pages/categories/ProductTemplatePage.tsx`
- `apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx`
- `apps/web-admin/src/pages/categories/VendorRestrictionsPage.tsx`

**Commit:** e098f30
**Applied fix:** Changed all `queryFn` calls from `get<FlatType>(url)` to `async () => { const data = await get<{ wrappedKey: WrappedType }>(url); return data.wrappedKey; }` matching the actual API envelope shape. For VendorRestrictionsPage (CR-02), changed the query type from `VendorCategoryRestriction[]` to `string[]` (approvedVendorIds), removed the stale `VendorCategoryRestriction` import, fixed the duplicate check from `r.vendorId === trimmed` to `approvedVendorIds?.includes(trimmed)`, and rewrote the render loop to map over string IDs instead of full restriction row objects.

---

### CR-03: Reorder mutation sent active node's own ID instead of parent's ID

**Files modified:** `apps/web-admin/src/components/categories/CategoryTree.tsx`
**Commit:** b58c989
**Applied fix:** Changed `categoryId: activeId` to `categoryId: newOrder.parentId ?? activeId` in `handleDragEnd`. `computeNewOrder` already returns the `parentId` of the sibling group — this value is now used as the `:categoryId` URL parameter, matching the API contract. Falls back to `activeId` only for root-level reorders where `parentId` is null.

---

### CR-04: Admin guard had no startup warning on absent INTERNAL_ADMIN_TOKEN

**Files modified:** `apps/api/src/routes/admin/categories.ts`
**Commit:** af77a6b
**Applied fix:** Added a startup-time assertion that throws immediately if `NODE_ENV === "production"` and `INTERNAL_ADMIN_TOKEN` is not set. This prevents a silent production lockout where every admin request would receive a 401 with no startup-time warning. Also added `fastify.log.warn(...)` in the development bypass path so the open-auth mode is visible in logs.

---

### CR-05 + CR-06: Missing Zod validation on reorder and vendor restriction routes

**Files modified:** `apps/api/src/routes/admin/categories.ts`
**Commit:** da7b14b
**Applied fix:**
- Added `z` to the existing `zod` import.
- Category reorder route: replaced `request.body as { orderedIds: string[] }` with `ReorderInputSchema.parse(request.body)` where `ReorderInputSchema = z.object({ orderedIds: z.array(z.string().uuid()) })`. Missing or non-array `orderedIds` now returns 400.
- Attribute reorder route: same pattern with `AttributeReorderInputSchema`.
- Vendor restriction POST route: replaced `request.body as { vendorId: string; createdByAdminId: string }` with `AddVendorInputSchema.parse(request.body)` where `vendorId` is `z.string().uuid()` (required) and `createdByAdminId` is `z.string().uuid().optional()` (Phase 2 has no real auth; Phase 4 JWT provides this). The placeholder UUID `"00000000-0000-0000-0000-000000000000"` is used when `createdByAdminId` is absent.

---

### CR-07: VITE_INTERNAL_ADMIN_TOKEN exposed in browser bundle without documentation

**Files modified:** `apps/web-admin/src/lib/apiClient.ts`
**Commit:** e332e55
**Applied fix:** Added a prominent `SECURITY NOTE` comment above the `ADMIN_TOKEN` declaration explaining that `VITE_*` variables are inlined at build time and visible in DevTools — this is a Phase 2 dev-only placeholder and must not be deployed externally before Phase 4 JWT. Added a `console.warn` for when the token is absent so misconfigured deployments surface the issue immediately.

---

### CR-08: getDepth() had no iteration cap — infinite loop on parentId cycle

**Files modified:** `apps/api/src/modules/categories/CategoryService.ts`
**Commit:** 1b3e7c0
**Applied fix:** Added `const MAX_DEPTH = 4` and changed `while (currentId !== null)` to `while (currentId !== null && depth <= MAX_DEPTH)`. The cap is set to 4 (one above the allowed depth of 3) so any legitimate depth violation is still detected. A self-referencing parentId cycle or longer chain is now terminated safely.

---

### WR-01 + WR-02: Math.random() radio name + stale rawIds in ProductGridBlockForm

**Files modified:** `apps/web-admin/src/components/categories/BlockEditor.tsx`
**Commit:** 0a1a852
**Applied fix:**
- WR-01: Added `localId: string` prop to `ProductGridBlockFormProps` and changed `name={`layout_${Math.random()}`}` to `name={`layout_${localId}`}`. Updated `BlockItem` to pass `localId={item.localId}` to `ProductGridBlockForm`.
- WR-02: Replaced `const [rawIds, setRawIds] = useState(block.productIds.join('\n'))` with a derived variable `const rawIds = block.productIds.join('\n')` computed directly from props. The separate `setRawIds` call in `handleIdsChange` was removed. The textarea now always reflects the current `block.productIds` state regardless of how the block was updated externally.

---

### WR-03: CategoryMetadataPage.handleSave() silently omitted cleared SEO fields

**Files modified:**
- `apps/web-admin/src/pages/categories/CategoryMetadataPage.tsx`
- `packages/contracts/src/category/metadata.ts`

**Commit:** 60aaf97
**Applied fix:** Changed `handleSave()` from conditional spread (only including non-empty fields) to always including every field with `null` for cleared inputs (`seoTitle.trim() || null`). Updated `UpsertMetadataInputSchema` in contracts to accept `z.string().nullable().optional()` for text fields (so null is a valid clear signal), and `z.string().url().nullable().optional().or(z.literal(''))` for URL fields. Updated the mutation payload type in the page to match. The service already handled `input.seoTitle !== undefined` correctly — null now passes the check and gets written to the DB.

---

### WR-04: CategoryDetailPage.useEffect overwrote unsaved form edits on refetch

**Files modified:** `apps/web-admin/src/pages/categories/CategoryDetailPage.tsx`
**Commit:** 992aec4
**Applied fix:** Added `const hasInitialized = useRef(false)` and changed the `useEffect` to only populate form state when `!hasInitialized.current`. This prevents `updateMutation.onSuccess` → `queryClient.setQueryData` → new `category` reference → effect re-run → silent form reset. Added `useRef` to the existing React import.

---

### WR-05: reorderCategories issued N sequential DB updates without a transaction

**Files modified:** `apps/api/src/modules/categories/CategoryService.ts`
**Commit:** 02ef474
**Applied fix:** Wrapped the `for` loop in `reorderCategories` inside `await db.transaction(async (tx) => { ... })`. All `db.update` calls now use the transaction `tx`. Cache invalidation still runs after the transaction commits, so concurrent reads see the old (consistent) cached values rather than a partially updated state.

---

### WR-06: AttributeBuilderPage.handleSave() deleted before creating — risked data loss

**Files modified:** `apps/web-admin/src/pages/categories/AttributeBuilderPage.tsx`
**Commit:** fa16576
**Applied fix:** Moved the delete phase to run after the create/update phase. The sequence is now: (1) create/update all rows, (2) delete removed rows, (3) reorder. If creates/updates fail midway, no existing server data has been deleted yet. The comment block explains the ordering rationale.

---

### WR-07: reorderByIds did not update sortOrder on optimistically reordered nodes

**Files modified:** `apps/web-admin/src/components/categories/CategoryTree.tsx`
**Commit:** 957038c
**Applied fix:** Changed `return node ? [node] : []` to `return node ? [{ ...node, sortOrder: i }] : []` in `reorderByIds`, passing the index `i` as the new `sortOrder`. The optimistic cache now reflects the updated sort positions so a re-sort before fresh server data arrives does not flash nodes back to their pre-drag order.

---

### WR-08: buildTree() promoted orphaned nodes to depth=0 causing misleading UI

**Files modified:** `apps/api/src/modules/categories/CategoryService.ts`
**Commit:** f1a31f5
**Applied fix:** Replaced the "treat as root" block (`node.depth = 0; roots.push(node)`) with `continue`, excluding orphaned nodes (those whose parent is archived/absent) from the tree entirely. This prevents depth-2 nodes from appearing as top-level categories and prevents the `+ Sub` button from offering invalid subcategory creation.

---

_Fixed: 2026-05-30T00:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
