---
phase: 02-category-engine
plan: "07"
subsystem: web-admin-category-ui
tags: [react, typescript, dnd-kit, react-router-dom, react-query, zustand, framer-motion, tailwind, category-engine, admin-ui]

# Dependency graph
requires:
  - 02-06-api-wiring  # admin API routes must exist before UI calls them

provides:
  - web-admin category tree CRUD UI (CategoryListPage, CategoryDetailPage, CategoryTree, CategoryTreeNode)
  - dnd-kit drag-and-drop tree reorder wired to POST /admin/categories/:id/reorder
  - Zustand persist store for tree expand/collapse (categoryUiStore)
  - typed API client with envelope unwrapping (apiClient.ts)
  - React Router + React Query + BrowserRouter scaffold for web-admin
  - Tab container scaffold in CategoryDetailPage for plan 02-08

affects:
  - 02-08-editors  # CategoryDetailPage tab container is the mount point

# Tech tracking
tech-stack:
  added:
    - "@dnd-kit/core@^6.3.1 — drag-and-drop context + sensors (PointerSensor, KeyboardSensor)"
    - "@dnd-kit/sortable@^10.0.0 — SortableContext + useSortable hook + arrayMove"
    - "@dnd-kit/utilities@^3.2.2 — CSS.Transform.toString for draggable element styles"
    - "react-router-dom@^7.16.0 — BrowserRouter + Routes + Route + useNavigate + useParams"
  patterns:
    - "flat-list-with-indentation DnD: DndContext wraps SortableContext of flat items with depth-based pl-0/pl-8/pl-16"
    - "optimistic update pattern: onMutate cancels queries + sets data; onError rolls back; onSuccess invalidates"
    - "Zustand persist with custom storage: Set<string> serialized to string[] for localStorage"
    - "framer-motion AnimatePresence + motion.div for slide-over panels (slide from right)"
    - "NodeNext module resolution: relative imports use .js extensions in all new files"
    - "framer-motion import (not motion/react): installed package is framer-motion@12; motion/react is not available"

key-files:
  created:
    - apps/web-admin/src/lib/apiClient.ts
    - apps/web-admin/src/stores/categoryUiStore.ts
    - apps/web-admin/src/components/categories/CategoryTree.tsx
    - apps/web-admin/src/components/categories/CategoryTreeNode.tsx
    - apps/web-admin/src/pages/categories/CategoryListPage.tsx
    - apps/web-admin/src/pages/categories/CategoryDetailPage.tsx
    - apps/web-admin/.gitignore
  modified:
    - apps/web-admin/package.json
    - apps/web-admin/src/App.tsx
    - apps/web-admin/src/main.tsx
    - pnpm-lock.yaml

key-decisions:
  - "Use framer-motion direct import instead of motion/react — the 'motion' package providing motion/react is not installed; framer-motion@12 is the installed package"
  - "Relative imports require .js extension due to NodeNext moduleResolution in tsconfig.base.json"
  - "Zustand persist with custom storage adapter to handle Set<string> serialization to localStorage"
  - "Flat list DnD (not nested SortableContext): single DndContext manages all visible nodes; depth computed from tree structure"
  - "CategoryDetailPage tab scaffold: 'details' tab is functional; others show 'coming in plan 02-08' placeholder"

# Metrics
duration: ~4h (including worktree base reset, package install, typecheck iteration)
completed: 2026-05-30
tasks_completed: 3
files_created: 7
files_modified: 4
---

# Phase 02 Plan 07: Category Tree CRUD UI Summary

**web-admin category management UI scaffolded with React Router + React Query + dnd-kit drag-and-drop tree; router/query providers wired; typed API client and Zustand UI store created; category list/detail pages with create slide-over, edit form, archive action, and depth-error surfacing built and typechecking**

## Performance

- **Duration:** ~4 hours
- **Started:** 2026-05-30T07:00:00Z
- **Completed:** 2026-05-30T10:57:00Z
- **Tasks:** 3 (Task 1 pre-approved; Tasks 2 and 3 executed; Task 4 is human-verify checkpoint)
- **Files created:** 7 | **Files modified:** 4

## Accomplishments

- **Package install:** `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, `react-router-dom` added to `apps/web-admin/package.json`; pnpm install run in worktree; node_modules populated; pnpm-lock.yaml updated
- **`apps/web-admin/src/main.tsx`** — wrapped in `QueryClientProvider` (new `QueryClient` with 30s staleTime) and `BrowserRouter`
- **`apps/web-admin/src/App.tsx`** — converted to routed layout: `/` redirects to `/categories`, `/categories` → CategoryListPage, `/categories/:id` → CategoryDetailPage; motion.div nav header animation
- **`apps/web-admin/src/lib/apiClient.ts`** — typed fetch wrapper: JSON headers, `X-Internal-Admin-Token` from `VITE_INTERNAL_ADMIN_TOKEN` env var, envelope unwrapping `{ success, data }` | `{ success, error }`, throws `ApiError` on failure; `get`, `post`, `patch`, `put`, `del` helpers
- **`apps/web-admin/src/stores/categoryUiStore.ts`** — Zustand `persist` store (name `"category-ui-state"`) with custom storage adapter for `Set<string>` serialization; `toggleExpand`, `expand`, `collapse` actions
- **`apps/web-admin/src/components/categories/CategoryTree.tsx`** — `DndContext` (closestCenter, PointerSensor + KeyboardSensor) + `SortableContext` (verticalListSortingStrategy); `flattenTree()` flattens nested tree respecting expand state; `onDragEnd` → `computeNewOrder()` → `reorderMutation` (POST /admin/categories/:id/reorder); optimistic update with rollback
- **`apps/web-admin/src/components/categories/CategoryTreeNode.tsx`** — `useSortable` drag handle; depth-based `pl-0`/`pl-8`/`pl-16`; expand/collapse toggle via categoryUiStore; inline Edit (navigate), Archive (mutation), Add-sub (open create panel) actions
- **`apps/web-admin/src/pages/categories/CategoryListPage.tsx`** — `useQuery(['categories','tree'])` for tree; "New Category" button opens `AnimatePresence` slide-over; create mutation with parentId support; 422/depth error shown in slide-over error box
- **`apps/web-admin/src/pages/categories/CategoryDetailPage.tsx`** — `useQuery` for category detail; PATCH edit form (name/slug/sortOrder/isRestricted); archive action; tab container with Details (functional) + Attributes/Filters/Template/Metadata/Restrictions (scaffolded for 02-08)
- **`apps/web-admin/.gitignore`** — excludes `src/**/*.js` and `src/**/*.d.ts` compiled artifacts from `tsc -b`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Package legitimacy checkpoint (pre-approved) | — | — |
| 2 | Install packages + wire router, React Query provider, API client | 58d406a | package.json, App.tsx, main.tsx, pnpm-lock.yaml, apiClient.ts, categoryUiStore.ts |
| 3 | Category tree CRUD UI — list/detail pages + dnd-kit tree | e2e099d | CategoryTree.tsx, CategoryTreeNode.tsx, CategoryListPage.tsx, CategoryDetailPage.tsx, .gitignore |
| 4 | Human verification checkpoint | — | Awaiting human browser testing |

## Task 4: Human Verification Required

**Task 4 is a `checkpoint:human-verify` gate.** The executor cannot perform browser testing. The human must verify the following:

### Setup
1. Start the API: `docker-compose up -d` (postgres + redis), then `pnpm --filter @grovio/api dev` — confirm API runs on port 3000
2. Set the admin token env var for the web-admin (create `.env.local` in `apps/web-admin/`):
   ```
   VITE_API_BASE_URL=http://localhost:3000
   VITE_INTERNAL_ADMIN_TOKEN=<your-INTERNAL_ADMIN_TOKEN-value-from-apps/api/.env>
   ```
3. Start the admin app: `pnpm --filter @grovio/web-admin dev` — confirm it starts on port 5174 (or 5175 — check vite.config.ts)
4. Run DB migrations if not already done: `pnpm --filter @grovio/api db:migrate`

### Verification steps (Task 4 acceptance criteria)
1. **Open** http://localhost:5174/categories — confirm the page loads with the category tree header and "New Category" button
2. **Create root category:** Click "New Category", enter a name (e.g. "Electronics"), click Create — confirm it appears in the tree
3. **Create subcategory:** Click "+ Sub" on the root category, enter "Phones", click Create — confirm it appears indented under Electronics
4. **Create third-level leaf:** Click "+ Sub" on Phones, enter "Smartphones" — confirm it appears indented further
5. **Attempt 4th level:** Click "+ Sub" on Smartphones — confirm the error "Cannot create subcategory: maximum depth of 3 levels reached." appears in the slide-over
6. **Drag to reorder:** Drag a category to a new position among siblings — confirm the order persists after page refresh
7. **Edit:** Click "Edit" on a category — confirm navigation to `/categories/:id`; edit the name, click Save Changes — confirm the update is reflected
8. **Archive:** Click "Archive" on a category — confirm it disappears from the tree and navigation returns to /categories

### Verification command (typecheck)
```bash
pnpm --filter @grovio/web-admin typecheck
# Expected: exits 0 (no type errors)
```

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Worktree base required reset to deaa2a6**
- **Found during:** Task 2 setup
- **Issue:** The worktree was spawned at commit `341f63e` but the Phase 2 services and category contracts (plans 02-01 through 02-06) were committed to main after spawn. The worktree's working tree lacked the category contracts required by the UI.
- **Fix:** Applied `git reset --hard deaa2a665ee553518a81a7c66603ea9aa5fed9cf` as specified in the `<worktree_branch_check>` to advance the worktree base to include all prerequisite work.
- **Files modified:** N/A — worktree reset, no commit

**2. [Rule 1 - Bug] motion/react import not resolvable → use framer-motion**
- **Found during:** Task 2 (typecheck iteration)
- **Issue:** The plan and PATTERNS.md reference `import from 'motion/react'` (CLAUDE.md style). However, the installed package is `framer-motion@12.40.0` — the `motion` package (which provides `motion/react`) is not installed separately and `framer-motion` does not re-export `motion/react` as a package subpath. TypeScript resolves this to an error.
- **Fix:** Changed all `motion/react` imports to `framer-motion` in App.tsx, CategoryListPage.tsx, and CategoryDetailPage.tsx.
- **Files modified:** App.tsx, CategoryListPage.tsx, CategoryDetailPage.tsx
- **Commit:** 58d406a, e2e099d

**3. [Rule 1 - Bug] Relative imports need .js extension (NodeNext moduleResolution)**
- **Found during:** Task 2 (typecheck)
- **Issue:** `tsconfig.base.json` uses `"moduleResolution": "NodeNext"` which requires explicit `.js` extensions on all relative imports. The original App.tsx had no relative imports so it worked. All new files use relative imports.
- **Fix:** Added `.js` extensions to all relative imports across apiClient.ts, categoryUiStore.ts, CategoryTree.tsx, CategoryTreeNode.tsx, CategoryListPage.tsx, CategoryDetailPage.tsx, main.tsx, App.tsx.
- **Files modified:** All new files
- **Commit:** 58d406a, e2e099d

**4. [Rule 1 - Bug] exactOptionalPropertyTypes: body: string | undefined incompatible with RequestInit.body**
- **Found during:** Task 2 (typecheck)
- **Issue:** `exactOptionalPropertyTypes: true` in tsconfig.base.json means `body: string | undefined` is not assignable to `body?: BodyInit | null` in `RequestInit`. Setting the property to `undefined` is not the same as not setting it.
- **Fix:** Changed body assignment pattern in post/patch/put helpers to use `if (body !== undefined) init.body = JSON.stringify(body)` so body is only set when defined.
- **Files modified:** lib/apiClient.ts
- **Commit:** 58d406a

**5. [Rule 2 - Missing] Added web-admin .gitignore for compiled TypeScript artifacts**
- **Found during:** Task 3 (post-commit)
- **Issue:** Running `tsc -b` (part of the build script) generates `.js`, `.d.ts`, `.js.map`, `.d.ts.map` files in `src/`. These were appearing as untracked files after the build run.
- **Fix:** Created `apps/web-admin/.gitignore` to exclude `src/**/*.js`, `src/**/*.d.ts`, `src/**/*.js.map`, `src/**/*.d.ts.map`, `tsconfig.tsbuildinfo`.
- **Files modified:** apps/web-admin/.gitignore (created)
- **Commit:** e2e099d

**6. [Rule 2 - Missing] Zustand custom storage adapter for Set<string> serialization**
- **Found during:** Task 2 (implementation)
- **Issue:** Zustand's default JSON serializer cannot serialize `Set<string>` to localStorage. Persist would fail silently, losing expand state on refresh.
- **Fix:** Implemented custom `storage` adapter in `categoryUiStore.ts` that converts `Set<string>` to `string[]` for storage and back on rehydration.
- **Files modified:** stores/categoryUiStore.ts
- **Commit:** 58d406a

## Environment Notes

**Pre-existing Node version constraint:** The environment uses Node.js v18.20.4; project requires >=22.2.0.
- `pnpm --filter @grovio/web-admin build` fails in this environment (Vite 8 requires Node >=20.19): `ReferenceError: CustomEvent is not defined`
- `pnpm --filter @grovio/web-admin typecheck` (tsc 5.8) passes cleanly: exits 0
- Verification in Task 3 used typecheck (not build) as the automated gate, consistent with 02-06 SUMMARY precedent

## Known Stubs

**CategoryDetailPage non-detail tabs** — The Attributes, Filters, Template, Metadata, and Restrictions tabs in CategoryDetailPage render "coming in plan 02-08" placeholder content. This is intentional: the tab container is scaffolded for plan 02-08 to fill in. The Details tab (the primary purpose of this plan) is fully functional.

## Threat Surface Scan

New client-side network calls introduced:

| Flag | File | Description |
|------|------|-------------|
| threat_flag: admin_token_in_env | apps/web-admin/src/lib/apiClient.ts | VITE_INTERNAL_ADMIN_TOKEN exposed in client bundle via import.meta.env — same T-02-18 risk (accepted: dev-only placeholder; Phase 4 replaces with JWT) |
| threat_flag: depth_error_surfaced | apps/web-admin/src/pages/categories/CategoryListPage.tsx | 422 CategoryDepthError message from server shown to admin user — correct behavior (T-02-19 mitigation: depth guard is server-side, UI surfaces the message) |

No new threats beyond those already in the plan's threat model.

## Self-Check: PASSED

- [x] `apps/web-admin/src/lib/apiClient.ts` — FOUND
- [x] `apps/web-admin/src/stores/categoryUiStore.ts` — FOUND
- [x] `apps/web-admin/src/components/categories/CategoryTree.tsx` — FOUND
- [x] `apps/web-admin/src/components/categories/CategoryTreeNode.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/CategoryListPage.tsx` — FOUND
- [x] `apps/web-admin/src/pages/categories/CategoryDetailPage.tsx` — FOUND
- [x] `apps/web-admin/src/App.tsx` — FOUND (updated)
- [x] `apps/web-admin/src/main.tsx` — FOUND (updated)
- [x] Commit 58d406a — Task 2 (router/query/api/store) — FOUND
- [x] Commit e2e099d — Task 3 (tree CRUD UI) — FOUND
- [x] DndContext in CategoryTree.tsx — VERIFIED
- [x] SortableContext in CategoryTree.tsx — VERIFIED
- [x] pl-0/pl-8/pl-16 depth padding — VERIFIED
- [x] onDragEnd invalidates ['categories'] query key — VERIFIED
- [x] useQuery in CategoryListPage.tsx — VERIFIED
- [x] create slide-over with parentId support — VERIFIED
- [x] PATCH mutation in CategoryDetailPage.tsx — VERIFIED
- [x] archive mutation in CategoryDetailPage.tsx — VERIFIED
- [x] tab container scaffold for 02-08 — VERIFIED
- [x] 422 error surfaced to user — VERIFIED (createError state from mutation onError)
- [x] `pnpm --filter @grovio/web-admin typecheck` exits 0 — VERIFIED
- [x] QueryClientProvider + BrowserRouter in main.tsx — VERIFIED
- [x] Zustand persist name "category-ui-state" — VERIFIED
- [x] apiClient.ts unwraps { success, data } envelope — VERIFIED
- [x] No unexpected file deletions across all commits — VERIFIED
