---
phase: 05-commerce-core
plan: 11
subsystem: ui
tags: [react, react-query, framer-motion, basket, cart, storefront]

requires:
  - phase: 05-10
    provides: Basket HTTP API (GET/POST/PATCH/DELETE /basket, POST /basket/merge, cookie-based guest session)
  - phase: 05-01
    provides: Basket/contracts types (Basket, BasketItem shapes from packages/contracts)
  - phase: 04-customer-storefront-web
    provides: ProductDetailPage with deferred Add to Cart (data-phase="5" placeholder), Header layout, router, UI kit, AnimatePresence patterns

provides:
  - useBasket React Query hook (server-authoritative basket state, itemCount convenience)
  - useAddToBasket / useUpdateBasketItem / useRemoveBasketItem / useMergeBasket mutations
  - BasketItem component (image, name, price, quantity stepper, animated removal)
  - OrderSummary component (subtotal, coupon input placeholder, wallet TODO marker, proceed-to-checkout CTA)
  - CartPage (vendor-grouped items, OrderSummary sidebar desktop / below mobile, loading/empty/error states)
  - /cart route wired in router.tsx
  - ProductDetailPage: Add to Cart fully active (variant selection, onClick → useAddToBasket, success/error toast)
  - Header: live cart badge (itemCount from useBasket, hidden when 0), /cart link

affects: [05-12, checkout, orders, wallet]

tech-stack:
  added: []
  patterns: ["React Query basket hook (useQuery + useMutation, optimistic itemCount bump, invalidate onSettled)", "AnimatePresence for list removal (motion.div exit collapse)", "Vendor-grouped cart section pattern (D-24/D-25)"]

key-files:
  created:
    - apps/web-storefront/src/hooks/useBasket.ts
    - apps/web-storefront/src/components/basket/BasketItem.tsx
    - apps/web-storefront/src/components/basket/OrderSummary.tsx
    - apps/web-storefront/src/pages/CartPage.tsx
  modified:
    - apps/web-storefront/src/pages/ProductDetailPage.tsx
    - apps/web-storefront/src/components/layout/Header.tsx
    - apps/web-storefront/src/router.tsx

key-decisions:
  - "Basket state is React Query only — no Zustand store (D-04); React Query cache is the single source of truth"
  - "OrderSummary renders wallet credit toggle as a TODO placeholder referencing 05-12 to avoid a circular dependency"
  - "Guest basket uses httpOnly grovio_basket_token cookie (httpOnly prevents XSS theft, T-05-06)"

patterns-established:
  - "useBasket pattern: useQuery(['basket']) returns null on 404; every mutation invalidates ['basket'] onSettled"
  - "CartPage vendor grouping: basket.groupedByVendor sections with AnimatePresence removal (D-24)"
  - "PDP variant guard: Add to Cart disabled until all variants selected, onClick → useAddToBasket mutation"

requirements-completed: [CHK-01, CHK-02, STORE-05]

duration: ~8min
completed: 2026-06-03
---

# Phase 05-11: Storefront Basket UI Summary

**useBasket React Query hook + vendor-grouped CartPage + active PDP Add to Cart + live Header cart badge — completes the customer-visible basket surface for Phase 5**

## Performance

- **Duration:** ~8 min (previous session)
- **Completed:** 2026-06-03
- **Tasks:** 2 auto (Task 3 is human-verify checkpoint — pending)
- **Files modified:** 7

## Accomplishments
- `useBasket.ts` — server-authoritative React Query hook with optimistic itemCount; full CRUD mutations (add/update/remove/merge) all invalidate `['basket']` onSettled
- `CartPage.tsx` — vendor-grouped cart with AnimatePresence removal animation, OrderSummary sidebar (desktop) / below (mobile), loading skeletons + empty + error states
- `ProductDetailPage.tsx` — removed `data-phase="5"` placeholder; Add to Cart wired to `useAddToBasket` with variant selection guard; variant pills are interactive with `aria-pressed`; success/error toasts on mutation result
- `Header.tsx` — live cart badge from `useBasket.itemCount`, hidden at 0, links to `/cart`
- `/cart` route added as child of AppLayout in `router.tsx`

## Task Commits

1. **Task 1: useBasket hook + basket components + CartPage + /cart route** — `5d63c5a` (feat)
2. **Task 2: Wire PDP Add to Cart + variant selectors + Header basket count** — `122b0e6` (feat)
3. **Task 3: Human verify checkpoint** — pending (browser verification required)

## Files Created/Modified
- `apps/web-storefront/src/hooks/useBasket.ts` — basket query + all mutations (207 lines)
- `apps/web-storefront/src/components/basket/BasketItem.tsx` — animated basket row (147 lines)
- `apps/web-storefront/src/components/basket/OrderSummary.tsx` — summary sidebar with coupon + wallet placeholders (158 lines)
- `apps/web-storefront/src/pages/CartPage.tsx` — vendor-grouped cart page (185 lines)
- `apps/web-storefront/src/pages/ProductDetailPage.tsx` — Add to Cart fully active (+131/-43 lines)
- `apps/web-storefront/src/components/layout/Header.tsx` — cart badge added (+23/-1 lines)
- `apps/web-storefront/src/router.tsx` — /cart route added

## Decisions Made
- Basket state is React Query only — no Zustand (D-04 honored exactly)
- Wallet credit in OrderSummary left as a TODO marker referencing 05-12 to avoid circular dependency
- `grovio_basket_token` cookie is httpOnly (set server-side in 05-10) — not accessible via JS (T-05-06)

## Deviations from Plan
None — plan executed exactly as written. All files, patterns, and acceptance criteria match.

## Issues Encountered
None — previous session executed both tasks cleanly; session ended before SUMMARY.md was written. Commits merged from orphaned worktree branch `worktree-agent-aab7a8a929be7ea30`.

## User Setup Required
None — no external service configuration required.

## Next Phase Readiness
- 05-12 can now build on `useBasket`, `CartPage`, and the activated PDP
- `useWallet` (05-12) will fill the wallet credit toggle placeholder in `OrderSummary`
- `CheckoutGuard` and the 4-step checkout wizard (05-12) depend on the `/cart` → `/checkout/address` CTA added here
- Human verification of the basket flow (Task 3 checkpoint) is pending — see checkpoint presented by orchestrator

## Self-Check: PASSED
- `data-phase="5"` count in ProductDetailPage.tsx = 0 ✓
- `useAddToBasket` wired in ProductDetailPage.tsx ✓
- CartPage vendor-grouped sections ✓
- Header cart badge hidden at 0 ✓
- All 7 declared `files_modified` present on disk ✓

---
*Phase: 05-commerce-core*
*Completed: 2026-06-03*
