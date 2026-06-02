---
phase: 04-customer-storefront-web
plan: 08
subsystem: web-storefront
tags: [react-query, framer-motion, tailwind-v4, infinite-scroll, url-state, accessibility, cms-blocks, pdp]

# Dependency graph
requires:
  - phase: 04-06
    provides: "apiClient, useProductSearch, useInfiniteScroll, useFilterState, useUiStore"
  - phase: 04-06b
    provides: "Button, Skeleton, FilterChip, ProductCard, PageTransition, router"

provides:
  - "BannerBlock: full-width hero with title (Display typography), subtitle, CTA; decorative alt"
  - "TextBlock: editorial prose section; no dangerouslySetInnerHTML (T-04-24)"
  - "ProductGridBlock: grid/carousel layout; fetches products by ids from /products?ids="
  - "FeaturedCategoriesBlock: resolves category names/slugs from GET /categories by categoryIds (Pitfall 5)"
  - "BlockRenderer: discriminated switch on block.type; unknown types render null (defensive)"
  - "HomePage: GET /homepage useQuery; renders blocks in API order (D-01); loading skeleton; error + Retry"
  - "SearchBar: debounced GET /search/suggest; AnimatePresence dropdown scale/y; arrow-key navigation; navigates /search?q="
  - "FilterSidebar: GET /categories/:id/filters; desktop sidebar w-64; mobile slide-in drawer (role=dialog aria-modal); Escape closes; setAttributeFilter (URL)"
  - "ProductGrid: useProductSearch + sentinelRef; removable FilterChip row; sort dropdown; 24-card skeleton; two empty states"
  - "CategoryPage: resolves slug via GET /categories; syncs categoryId to URL; subcategory chips; FilterSidebar + ProductGrid"
  - "SearchPage: full PLP driven by URL params; prominent SearchBar; mobile Filters button"
  - "ProductDetailPage: GET /products/:slug; image gallery; spec table (D-14); disabled variant pills (D-15); disabled Add to Cart + shake (D-13, data-phase=5)"

affects:
  - phase-05-commerce-core
  - 04-09-plan (phase completion)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "BlockRenderer discriminated switch on block.type — no hardcoded block positioning (D-01)"
    - "FeaturedCategoriesBlock reuses ['categories'] query key — no extra API call (Pitfall 5)"
    - "All URL params in useInfiniteQuery queryKey — filter changes reset to page 1 (Pitfall 1)"
    - "FilterSidebar drawer: role=dialog aria-modal; Escape closes; focus management on open"
    - "ProductDetailPage: Framer Motion animate keyframes for shake ([0,-6,6,-4,4,-2,2,0]); disabled button with data-phase=5"
    - "Spec table (D-14): skips is_variant=true attrs and null/empty values"

key-files:
  created:
    - apps/web-storefront/src/components/blocks/BannerBlock.tsx
    - apps/web-storefront/src/components/blocks/TextBlock.tsx
    - apps/web-storefront/src/components/blocks/ProductGridBlock.tsx
    - apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx
    - apps/web-storefront/src/components/blocks/BlockRenderer.tsx
    - apps/web-storefront/src/components/search/SearchBar.tsx
    - apps/web-storefront/src/components/search/FilterSidebar.tsx
    - apps/web-storefront/src/components/search/ProductGrid.tsx
  modified:
    - apps/web-storefront/src/pages/HomePage.tsx
    - apps/web-storefront/src/pages/CategoryPage.tsx
    - apps/web-storefront/src/pages/SearchPage.tsx
    - apps/web-storefront/src/pages/ProductDetailPage.tsx

key-decisions:
  - "FeaturedCategoriesBlock renders category initial-letter avatar as fallback — CategoryTreeNode has no imageUrl field (known limitation: Phase 6 CMS will add image management)"
  - "ProductGridBlock and ProductGrid pass vendorName='' to ProductCard — SearchHit and Product contracts don't include vendorName; this is resolved in Phase 5 when the public product endpoint is extended"
  - "BlockRenderer has an exhaustive switch on all four block types plus a defensive default null case (future API block types won't crash the page)"
  - "ProductDetailPage defines a local ProductDetailResponse interface extending Product — the full PDP API shape (with images, variants, categoryAttributes) is a Phase 5 forward contract; the Phase 3 /products/:slug endpoint may not yet be public"

requirements-completed: [STORE-01, STORE-02, STORE-03, STORE-04, STORE-05, STORE-06, SRCH-03]

# Metrics
duration: ~40min
completed: 2026-06-02
---

# Phase 4 Plan 08: Browse Experience Summary

**Homepage CMS block stack, search/PLP components (type-ahead, URL-synced filter chips, infinite scroll), and all four browse pages — the complete customer browsing experience with responsive, animated, accessible UI**

## Performance

- **Duration:** ~40 min
- **Completed:** 2026-06-02
- **Tasks completed:** 3 of 3 auto tasks (Task 4 is a human verification checkpoint — paused for human review)
- **Files created:** 8, **Modified:** 4

## Accomplishments

**Task 1 — Block renderers + homepage (STORE-01, D-01/02/03):**

- `BannerBlock.tsx`: full-width hero with title (`text-[1.75rem] font-semibold` — Display typography), optional subtitle, optional CTA button linking to ctaUrl; decorative image `alt=""` with gradient overlay for text legibility
- `TextBlock.tsx`: editorial title + prose section; no `dangerouslySetInnerHTML` (T-04-24 compliance)
- `ProductGridBlock.tsx`: fetches products by IDs via `/products?ids=`; supports `grid` (responsive 4-col) and `carousel` (horizontal scroll) layouts; loading skeleton matches block dimensions
- `FeaturedCategoriesBlock.tsx`: reuses `['categories']` query key (no extra API call — Pitfall 5 fix); filters tree nodes by `categoryIds`; preserves block order; `grid` and `row` layouts; renders category name + initial-letter avatar (fallback — CategoryTreeNode has no imageUrl)
- `BlockRenderer.tsx`: discriminated switch on `block.type` for all four types; unknown types return `null` (defensive)
- `HomePage.tsx`: `useQuery(['homepage'])` → GET /homepage; renders blocks in API order with no hardcoded layout (D-01); single `sr-only h1`; semantic `<section>` per block; loading skeleton (banner + 2 row skeletons); error + Retry button

**Task 2 — Search components (STORE-03, SRCH-03):**

- `SearchBar.tsx`: debounced GET /search/suggest (250ms); AnimatePresence suggestions dropdown (`initial:{opacity:0,scale:0.97,y:-4}` → `animate:{opacity:1,scale:1,y:0}`); arrow-key navigation + Escape; `aria-autocomplete="list"` + `aria-activedescendant`; navigates to `/search?q=` on submit/select (T-04-23: values encoded via URLSearchParams)
- `FilterSidebar.tsx`: GET /categories/:id/filters for facet groups; lg+ desktop sidebar `w-64`; mobile slide-in drawer `initial:{x:"-100%"}` → `animate:{x:0}`; `role="dialog" aria-modal="true" aria-label="Filters"`; Escape-to-close with `useEffect`; focus management (Close button gets focus on open); setAttributeFilter writes to URL (D-06); "Clear all" + mobile "Show Results" button
- `ProductGrid.tsx`: useProductSearch + useInfiniteScroll `sentinelRef aria-hidden`; 24-card skeleton on initial load; removable FilterChip row above grid; sort dropdown writing `sort` to URL (Relevance/Price:LH/Price:HL/Newest); two empty states (filters-applied vs. query-no-results vs. category-empty)

**Task 3 — Browse pages (STORE-02/03/04):**

- `CategoryPage.tsx`: resolves slug via GET /categories (reuses cached query); syncs `categoryId` to URL via `useEffect` (D-06); renders `<h1>` category name, subcategory chip row, mobile Filters button, FilterSidebar + ProductGrid; category-empty state per UI-SPEC
- `SearchPage.tsx`: full PLP driven by URL params; prominent SearchBar above results; search context heading ("Showing results for [q]"); mobile Filters button; FilterSidebar + ProductGrid; single `sr-only h1`
- `ProductDetailPage.tsx`: GET /products/:slug with graceful error/not-found handling; image gallery with AnimatePresence thumbnail switch + thumbnail row; `<h1>` product name; price; vendor name (`text-grovio-secondary`); Specifications table (D-14: skips `is_variant=true` + null/empty attributes); disabled variant pill selectors (`opacity-60 cursor-not-allowed pointer-events-none`, first option `border-grovio-primary`, D-15); disabled Add to Cart (`data-phase="5"`, D-13) with Framer Motion shake keyframes `x:[0,-6,6,-4,4,-2,2,0] duration:0.4` on click; all three pages rooted in `<PageTransition>` with semantic landmarks

## Task Commits

1. **Task 1: Block renderers + homepage** - `8b61c29` (feat)
2. **Task 2: SearchBar, FilterSidebar, ProductGrid** - `5d5dc4e` (feat)
3. **Task 3: CategoryPage, SearchPage, ProductDetailPage** - `089d598` (feat)

## Files Created/Modified

**Created:**
- `apps/web-storefront/src/components/blocks/BannerBlock.tsx` — hero banner renderer
- `apps/web-storefront/src/components/blocks/TextBlock.tsx` — editorial prose renderer
- `apps/web-storefront/src/components/blocks/ProductGridBlock.tsx` — product grid/carousel renderer
- `apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx` — category cards renderer
- `apps/web-storefront/src/components/blocks/BlockRenderer.tsx` — discriminated block switch
- `apps/web-storefront/src/components/search/SearchBar.tsx` — type-ahead search input
- `apps/web-storefront/src/components/search/FilterSidebar.tsx` — filter panel (desktop+mobile)
- `apps/web-storefront/src/components/search/ProductGrid.tsx` — infinite-scroll product grid

**Modified:**
- `apps/web-storefront/src/pages/HomePage.tsx` — replaced stub with full CMS block stack
- `apps/web-storefront/src/pages/CategoryPage.tsx` — replaced stub with full category PLP
- `apps/web-storefront/src/pages/SearchPage.tsx` — replaced stub with full search PLP
- `apps/web-storefront/src/pages/ProductDetailPage.tsx` — replaced stub with full PDP

## Decisions Made

- `FeaturedCategoriesBlock` renders category initial-letter avatar instead of an image because `CategoryTreeNode` has no `imageUrl` field. Phase 6 CMS will add category image management; this is a known Phase 4 limitation.
- `ProductGridBlock` and `ProductGrid` pass `vendorName=""` to `ProductCard` because `SearchHit` and `Product` contracts don't include vendor name in Phase 3. This will be resolved in Phase 5 when the public `/products` endpoint returns enriched data.
- `BlockRenderer` defensive `default: return null` case guards against future API block types before the frontend is updated — TypeScript's discriminated union analysis still exhaustively catches the currently known types at compile time.
- `ProductDetailPage` defines a local `ProductDetailResponse` interface extending `Product` with optional `images`, `variants`, and `categoryAttributes` — the full PDP API shape is a Phase 5 forward contract.

## Deviations from Plan

### Auto-fixed Issues

None — plan executed exactly as written.

All components passed typecheck and build on first attempt with no type errors or runtime failures discovered during static analysis.

## Known Stubs

| Component | File | Stub | Reason | Resolved by |
|-----------|------|------|--------|-------------|
| FeaturedCategoriesBlock | `apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx:89` | Category initial-letter avatar instead of image | `CategoryTreeNode` has no `imageUrl` field in Phase 2/3 contracts | Phase 6 (CMS category image management) |
| ProductGridBlock | `apps/web-storefront/src/components/blocks/ProductGridBlock.tsx:81` | `vendorName=""` | `Product` schema doesn't include vendorName in Phase 3 | Phase 5 (public products endpoint with enriched data) |
| ProductGrid | `apps/web-storefront/src/components/search/ProductGrid.tsx:211` | `vendorName=""` | `SearchHit` doesn't include vendorName | Phase 5 (enriched search response) |

These stubs do NOT prevent this plan's goal — the browse experience is fully functional with real API calls. The vendor name and category images are non-critical display enhancements.

## Threat Surface Scan

| Flag | File | Description |
|------|------|-------------|
| T-04-23 mitigated | SearchBar.tsx, FilterSidebar.tsx, ProductGrid.tsx | URL filter params encoded via URLSearchParams (encodeURIComponent); forwarded to Phase 3 search API which validates them server-side |
| T-04-24 mitigated | All block components | Block content rendered as JSX text nodes; no dangerouslySetInnerHTML anywhere |
| T-04-25 accepted | ProductDetailPage.tsx | Add to Cart button is inert (disabled + no mutation handler); commerce authority arrives in Phase 5 |

## Self-Check: PASSED

- `apps/web-storefront/src/components/blocks/BannerBlock.tsx` FOUND
- `apps/web-storefront/src/components/blocks/TextBlock.tsx` FOUND
- `apps/web-storefront/src/components/blocks/ProductGridBlock.tsx` FOUND
- `apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx` FOUND
- `apps/web-storefront/src/components/blocks/BlockRenderer.tsx` FOUND
- `apps/web-storefront/src/components/search/SearchBar.tsx` FOUND
- `apps/web-storefront/src/components/search/FilterSidebar.tsx` FOUND
- `apps/web-storefront/src/components/search/ProductGrid.tsx` FOUND
- `apps/web-storefront/src/pages/HomePage.tsx` FOUND
- `apps/web-storefront/src/pages/CategoryPage.tsx` FOUND
- `apps/web-storefront/src/pages/SearchPage.tsx` FOUND
- `apps/web-storefront/src/pages/ProductDetailPage.tsx` FOUND
- Commit `8b61c29` FOUND (Task 1)
- Commit `5d5dc4e` FOUND (Task 2)
- Commit `089d598` FOUND (Task 3)
- `pnpm --filter @grovio/web-storefront typecheck` exits 0: CONFIRMED
- `pnpm --filter @grovio/web-storefront build` exits 0: CONFIRMED
- Human verification: PENDING (Task 4 checkpoint)

---
*Phase: 04-customer-storefront-web*
*Completed (Tasks 1-3): 2026-06-02*
