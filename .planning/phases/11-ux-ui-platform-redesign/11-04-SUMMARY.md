---
phase: 11
plan: "04"
subsystem: web-storefront
tags: [ux-redesign, mobile-nav, plp, pdp, checkout, search, cart, seo, backend]
dependency_graph:
  requires: [11-01, 11-02, phase-05-commerce-backend]
  provides: [storefront-redesigned-ui, mobile-nav, comparison-tray, pdp-gallery, search-ux, one-page-checkout, order-timeline, seo-infrastructure]
  affects: [apps/web-storefront, apps/api]
tech_stack:
  added:
    - react-helmet-async@2.0.5 — SEO meta tags and JSON-LD
  patterns:
    - SeoHead component (react-helmet-async) for all pages
    - JSON-LD structured data (ProductJsonLd, BreadcrumbJsonLd)
    - Motion 12.x (motion/react) for all micro-interactions
    - useComparisonStore (Zustand) for comparison tray state
    - localStorage for user preferences (PLP view, pincode, search history)
    - Backend: Redis-cached recommendations (30min), popular_searches key
key_files:
  created:
    - apps/web-storefront/src/components/layout/BottomNav.tsx
    - apps/web-storefront/src/stores/useComparisonStore.ts
    - apps/web-storefront/src/components/ui/ComparisonTray.tsx
    - apps/web-storefront/src/components/pdp/ReviewsSection.tsx
    - apps/web-storefront/src/pages/checkout/CheckoutPage.tsx
    - apps/web-storefront/src/components/seo/SeoHead.tsx
    - apps/web-storefront/src/components/seo/JsonLd.tsx
    - apps/api/src/routes/coupons.ts
  modified:
    - apps/web-storefront/src/components/layout/AppLayout.tsx
    - apps/web-storefront/src/components/layout/Header.tsx
    - apps/web-storefront/src/components/search/FilterSidebar.tsx
    - apps/web-storefront/src/components/search/ProductGrid.tsx
    - apps/web-storefront/src/components/ui/ProductCard.tsx
    - apps/web-storefront/src/pages/CategoryPage.tsx
    - apps/web-storefront/src/pages/ProductDetailPage.tsx
    - apps/web-storefront/src/pages/SearchPage.tsx
    - apps/web-storefront/src/pages/CartPage.tsx
    - apps/web-storefront/src/pages/account/OrderDetailPage.tsx
    - apps/web-storefront/src/pages/account/OrdersPage.tsx
    - apps/web-storefront/src/pages/HomePage.tsx
    - apps/web-storefront/src/router.tsx
    - apps/web-storefront/src/components/checkout/CheckoutGuard.tsx
    - apps/web-storefront/src/main.tsx
    - apps/api/src/routes/products.ts
    - apps/api/src/routes/search.ts
    - apps/api/src/modules/search/SearchService.ts
    - apps/api/src/app.ts
decisions:
  - title: One-page checkout replaces multi-step flow
    rationale: Reduces checkout friction; accordion pattern tracks step completion in local state; old /checkout/* URLs redirect to /checkout
  - title: categoryIds empty in CartRecommendations (Wave 5a stub)
    rationale: BasketItemSchema has no categoryId field; recommendations query disabled with empty array; Wave 5a adds category context to basket
  - title: Serviceability endpoint is a stub returning all pincodes serviceable
    rationale: Real logistics provider API (Shiprocket/India Post) deferred to Wave 5a; endpoint shape is stable
metrics:
  duration: "~6 hours (across 2 sessions)"
  completed: "2026-06-08"
  tasks_completed: 10
  tasks_total: 10
  files_changed: 25
---

# Phase 11 Plan 04: Customer Storefront Redesign Summary

Redesigned the Grovio customer storefront from Phase 4's functional foundation into a conversion-optimized, mobile-first experience. Delivered all 10 tasks: mobile bottom navigation, PLP enhancements, product comparison tray, PDP visual redesign, enhanced search UX, cart coupon suggestions and recommendations, one-page checkout accordion, visual order timeline with reorder and invoice download, 5 backend endpoints, and full SEO infrastructure.

## Tasks Completed

| Task | Description | Commit |
|------|-------------|--------|
| T0 | Design pass (informational — no code) | — |
| T1 | Mobile bottom navigation (BottomNav 5-tab, cart badge, `md:hidden`) | d8f741b |
| T2 | PLP sticky filter sidebar + view toggle + active chip strip | bf80e89 |
| T3 | Product comparison tray (up to 3 products, comparison dialog) | ab202b9 |
| T4 | PDP visual redesign (gallery, variant swatches, delivery check, trust badges) | a796078 |
| T5 | Enhanced search UX (history, popular, category-grouped typeahead, camera/voice stubs) | 7036858 |
| T6 | Cart coupon suggestions + cart recommendations horizontal scroll | 7ea2dfd |
| T7 | One-page checkout accordion (replaces multi-step /checkout flow) | b267c8c |
| T8 | Visual order timeline + Reorder All + Invoice Download | b5905a0 |
| T9 | Backend endpoints (serviceability, popular searches, coupons/available, cart recs, suggest categoryName) | 83acd39 |
| T10 | SEO: react-helmet-async, SeoHead, ProductJsonLd, BreadcrumbJsonLd, per-page meta | 218e6df |

## Key Deliverables

### Mobile Bottom Navigation (T1)
- `BottomNav.tsx`: 5-tab fixed bar (`md:hidden`), cart badge, `motion.div whileTap` on icons
- Header wrapped in `hidden md:block` to avoid duplication on mobile
- `AppLayout.tsx`: `pb-16 md:pb-0` on main to avoid content overlap

### PLP Enhancements (T2)
- FilterSidebar: collapsible with `AnimatePresence width: 0→256`, sticky with `max-h-[calc(100vh-5rem)]` overflow
- View toggle: grid/list persisted to `localStorage pref_plp_view`
- Active chip strip: horizontal scroll from URL `activeFilters`
- Compare checkbox on ProductCard (up to 3 products, grays out when max reached)

### Comparison Tray (T3)
- `useComparisonStore.ts`: Zustand store, max 3 products enforced in `addProduct`
- `ComparisonTray.tsx`: `bottom-14 md:bottom-0`, slide-up animation, `useReducedMotion()` for a11y
- `ComparisonDialog`: side-by-side product attribute table with "Compare Now" disabled < 2 products

### PDP Visual Redesign (T4)
- `Lightbox`: keyboard navigation (Escape, ArrowLeft/Right), prev/next buttons
- Desktop gallery: main image + zoom affordance → lightbox
- Mobile gallery: `snap-x snap-mandatory` carousel with dot indicators
- Variant swatches: color circles for color attributes, size chips, pill buttons for others
- `DeliveryCheck`: POST /serviceability with `localStorage grovio_delivery_pincode`
- `TrustBadges`: ShieldCheck, RefreshCw, Package icons
- `FrequentlyBoughtTogether` + `RelatedProducts` stubs for Wave 5a

### Enhanced Search UX (T5)
- `SearchBar.tsx` rewritten: `localStorage search_history` (max 5 items), `Clock` icon for history
- `GET /search/popular` with 1-hour staleTime, `TrendingUp` icons for popular terms
- Category grouping: `categoryGroups: Record<string, GroupedSuggestion[]>` from `categoryName` on suggest results
- `flatItems` array for unified keyboard navigation
- Camera/Voice buttons → toast "coming soon"

### Cart Enhancements (T6)
- `CouponInputWithSuggestions`: dropdown on focus → `GET /coupons/available?cart_total_minor=X`
- `CartRecommendations`: `GET /products/recommendations/cart?category_ids[]=&exclude_ids[]=` horizontal scroll
- `categoryIds = []` stub (Wave 5a will add categoryId to BasketItem)

### One-Page Checkout (T7)
- `CheckoutPage.tsx`: 4-section `AccordionSection` (Address, Delivery, Payment, Review)
- Step indicator: check icon for completed, number for pending
- `AnimatePresence height: 0→auto` per section
- Router: `/checkout` (index) + legacy redirects from `/checkout/address|delivery|payment|review`

### Order Detail Enhancements (T8)
- `OrderTimeline`: vertical step list with animated icons, connector lines, `STATUS_TO_TIMELINE_INDEX` mapping
- Cancelled state: `XCircle` warning box instead of timeline
- `handleReorderAll`: `Promise.all` over order items → `POST /basket/items`, then navigates to `/cart`
- `handleDownloadInvoice`: `fetch GET /orders/:id/invoice` → blob anchor download; toasts if unavailable

### Backend Endpoints (T9)
- `GET /serviceability?pincode=XXX`: validates 6-digit pincode, returns `serviceable: true, estimatedDays: {min: 3, max: 5}` (stub)
- `GET /search/popular`: reads Redis `popular_searches` JSON array, returns up to 10 terms
- `GET /coupons/available`: filters by isActive, expiry, maxRedemptions, minOrderMinor, scope; returns public fields only (no scopeId)
- `GET /products/recommendations/cart`: Redis-cached 30min, category-scoped, max 8 products via random SQL sort
- `GET /search/suggest` now includes `categoryName` in product projection (SuggestResult type updated)

### SEO Infrastructure (T10)
- `react-helmet-async@2.0.5` installed, `HelmetProvider` wraps root in `main.tsx`
- `SeoHead.tsx`: title, meta description, Open Graph, Twitter Card, canonical, noindex
- `ProductJsonLd.tsx`: schema.org/Product with price, availability, brand, productID
- `BreadcrumbJsonLd.tsx`: schema.org/BreadcrumbList
- Pages with SEO: HomePage, SearchPage (noIndex for `?q=` queries), CategoryPage + breadcrumb, ProductDetailPage + product JSON-LD + breadcrumb
- Account pages (OrdersPage, OrderDetailPage): `noIndex=true`

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 2 - Missing functionality] BasketItem has no categoryId field**
- **Found during:** T6 (CartRecommendations)
- **Issue:** Plan assumed `i.categoryId` on basket items; `BasketItemSchema` has no such field
- **Fix:** Set `categoryIds = []` with comment "Wave 5a will add category context to basket items"; `CartRecommendations` has `enabled: categoryIds.length > 0` so it won't fetch with empty array
- **Files modified:** `apps/web-storefront/src/pages/CartPage.tsx`
- **Commit:** 7ea2dfd

**2. [Rule 1 - Bug] `ne` import in products.ts was unused**
- **Found during:** T9 review
- **Issue:** Imported `ne` from drizzle-orm but not used in any query
- **Fix:** Removed unused `ne` import
- **Files modified:** `apps/api/src/routes/products.ts`
- **Commit:** 83acd39

**3. [Rule 2 - Missing functionality] SearchService.SuggestResult type lacked categoryName**
- **Found during:** T9 implementation
- **Issue:** `SuggestResult.products` typed as `Array<{id, name, slug}>` — no `categoryName` field despite contract having it
- **Fix:** Added `categoryName?: string` to SuggestResult interface and product push
- **Files modified:** `apps/api/src/modules/search/SearchService.ts`
- **Commit:** 83acd39

## Known Stubs

| Stub | File | Reason |
|------|------|--------|
| `FrequentlyBoughtTogether` | `ProductDetailPage.tsx` | Requires Wave 5a purchase-pattern analytics endpoint |
| `RelatedProducts` | `ProductDetailPage.tsx` | Requires Wave 5a OpenSearch "more_like_this" query |
| `categoryIds = []` in CartRecommendations | `CartPage.tsx` | Wave 5a extends BasketItem with categoryId |
| `serviceability` all pincodes serviceable | `apps/api/src/routes/products.ts` | Wave 5a: integrate real logistics provider API |
| Camera/Voice search buttons → toast | `SearchBar.tsx` | Wave 5b: device camera + Web Speech API |
| `vendorName: ""` in cart recommendations | `apps/api/src/routes/products.ts` | Wave 5a: add vendor join to recommendations query |
| Invoice endpoint (fetch-only, toasts if 404) | `OrderDetailPage.tsx` | Wave 5a: implement GET /orders/:id/invoice PDF generation |

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: new_public_endpoint | `apps/api/src/routes/coupons.ts` | New public GET /coupons/available — no auth, no rate limiting. Low risk (read-only, no sensitive data), but should be rate-limited in Wave 5a |
| threat_flag: new_public_endpoint | `apps/api/src/routes/products.ts` | GET /products/recommendations/cart — no auth, no rate limiting. Redis cache mitigates DB load |
| threat_flag: new_public_endpoint | `apps/api/src/routes/products.ts` | GET /serviceability — no auth, no rate limiting. Pincode validation (6-digit regex) is the only guard |

## Self-Check: PASSED

**Files verified:**

- `apps/web-storefront/src/components/layout/BottomNav.tsx` — FOUND
- `apps/web-storefront/src/stores/useComparisonStore.ts` — FOUND
- `apps/web-storefront/src/components/ui/ComparisonTray.tsx` — FOUND
- `apps/web-storefront/src/components/pdp/ReviewsSection.tsx` — FOUND
- `apps/web-storefront/src/pages/checkout/CheckoutPage.tsx` — FOUND
- `apps/web-storefront/src/components/seo/SeoHead.tsx` — FOUND
- `apps/web-storefront/src/components/seo/JsonLd.tsx` — FOUND
- `apps/api/src/routes/coupons.ts` — FOUND

**Commits verified:**

- d8f741b (T1), bf80e89 (T2), ab202b9 (T3), a796078 (T4), 7036858 (T5), 7ea2dfd (T6), b267c8c (T7), b5905a0 (T8), 83acd39 (T9), 218e6df (T10) — all present in git log
