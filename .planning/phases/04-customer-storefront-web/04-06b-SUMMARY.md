---
phase: 04-customer-storefront-web
plan: 06b
subsystem: web-storefront
tags: [react-router, framer-motion, tailwind-v4, zustand, ui-kit, layout-shell, animation]

# Dependency graph
requires:
  - phase: 04-06
    provides: "useAuth hook, ui-store (toasts), queryClient, apiClient"

provides:
  - "Button: primary/secondary/destructive; loading Loader2; focus-visible ring; no hardcoded hex"
  - "Input: label association; focus ring; error border + inline message; aria-invalid"
  - "Skeleton: CSS animate-pulse; aria-busy; no JS animation"
  - "FilterChip: active bg-grovio-primary rounded-full with dismiss button; inactive border variant"
  - "ProductCard: motion.div whileHover y:-4 shadow; aspect-[4/5]; links /products/:slug"
  - "Toast: AnimatePresence slide-in x:16; role=status/alert; reads from ui-store"
  - "PageTransition: motion.div fade+slide y:8; shared page root for AnimatePresence exit"
  - "Header: sticky; logo; desktop search bar; mobile search icon+expand; account/cart icons"
  - "Footer: link columns grid; copyright row; token colors"
  - "AppLayout: Header + AnimatePresence(mode=wait keyed by pathname) Outlet + Footer + ToastContainer"
  - "ProtectedRoute: session probe redirect to /auth/login with from state"
  - "router.tsx: createBrowserRouter full Phase 4 route tree"
  - "main.tsx: StrictMode > QueryClientProvider > RouterProvider"
  - "Stub pages: HomePage, CategoryPage, SearchPage, ProductDetailPage, auth/*, account/*"

affects:
  - 04-07-storefront-pages
  - 04-08-account-pages
  - phase-05-commerce-core

# Tech tracking
tech-stack:
  added:
    - "Vite alias: motion/react → framer-motion (Rolldown resolution fix)"
    - "react-router-dom createBrowserRouter (Phase 4 route tree)"
    - "AnimatePresence mode=wait keyed by location.pathname (page transitions)"
    - "Hand-rolled UI kit: Button, Input, Skeleton, FilterChip, ProductCard, Toast"
  patterns:
    - "All UI components use design-token Tailwind classes only (no hardcoded hex)"
    - "PageTransition as page root — required for AnimatePresence exit animation (Pitfall 3)"
    - "AppLayout provides AnimatePresence; pages provide PageTransition root (Pattern 5)"
    - "ProtectedRoute uses session probe isLoading guard to prevent auth flash"
    - "vite.config.ts alias resolves motion/react at bundle time (TypeScript shim alone insufficient)"

key-files:
  created:
    - apps/web-storefront/src/components/ui/Button.tsx
    - apps/web-storefront/src/components/ui/Input.tsx
    - apps/web-storefront/src/components/ui/Skeleton.tsx
    - apps/web-storefront/src/components/ui/FilterChip.tsx
    - apps/web-storefront/src/components/ui/ProductCard.tsx
    - apps/web-storefront/src/components/ui/Toast.tsx
    - apps/web-storefront/src/components/layout/PageTransition.tsx
    - apps/web-storefront/src/components/layout/Header.tsx
    - apps/web-storefront/src/components/layout/Footer.tsx
    - apps/web-storefront/src/components/layout/AppLayout.tsx
    - apps/web-storefront/src/components/layout/ProtectedRoute.tsx
    - apps/web-storefront/src/router.tsx
    - apps/web-storefront/src/pages/HomePage.tsx (stub)
    - apps/web-storefront/src/pages/CategoryPage.tsx (stub)
    - apps/web-storefront/src/pages/SearchPage.tsx (stub)
    - apps/web-storefront/src/pages/ProductDetailPage.tsx (stub)
    - apps/web-storefront/src/pages/auth/SignupPage.tsx (stub)
    - apps/web-storefront/src/pages/auth/LoginPage.tsx (stub)
    - apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx (stub)
    - apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx (stub)
    - apps/web-storefront/src/pages/account/ProfilePage.tsx (stub)
    - apps/web-storefront/src/pages/account/AddressesPage.tsx (stub)
  modified:
    - apps/web-storefront/src/main.tsx
    - apps/web-storefront/vite.config.ts
    - .gitignore

key-decisions:
  - "Vite alias motion/react → framer-motion required in vite.config.ts; the motion-react.d.ts TypeScript shim alone was insufficient for Rolldown to resolve the import at bundle time"
  - "AppLayout uses a wrapper div keyed by location.pathname inside AnimatePresence — each page's PageTransition motion.div is the actual animated element (Pattern 5)"
  - "ProtectedRoute returns null while isLoading to prevent auth flash before session probe resolves"
  - "tsc -b (called by vite build) emits .js/.d.ts files in-place (no outDir configured); added patterns to .gitignore to exclude compiled artifacts from source control"
  - "Stub page components are minimal <PageTransition> shells — Wave 6 (04-07/04-08) overwrites them"

requirements-completed: [STORE-05, STORE-06, AUTH-02]

# Metrics
duration: 25min
completed: 2026-06-01
---

# Phase 4 Plan 06b: UI Kit + Layout Shell Summary

**Shared UI component kit (Button, Input, Skeleton, FilterChip, ProductCard, Toast), layout shell (Header, Footer, PageTransition, AppLayout, ProtectedRoute), and router + main.tsx providers — the visual scaffold all Wave 6 pages mount into**

## Performance

- **Duration:** ~25 min
- **Completed:** 2026-06-01
- **Tasks:** 2
- **Files created:** 22 (all new), **Modified:** 3 (main.tsx, vite.config.ts, .gitignore)

## Accomplishments

**Task 1 — Shared UI component kit:**

- `Button.tsx`: primary (`bg-grovio-primary`), secondary, destructive variants; `opacity-60 cursor-not-allowed` disabled; `Loader2 animate-spin` loading state; `focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2` ring — all tokens, no hex
- `Input.tsx`: label association via `htmlFor`/`id`; `focus:ring-2 focus:ring-grovio-primary`; error variant `border-grovio-error` + inline `role="alert"` error message; `aria-invalid` + `aria-describedby`
- `Skeleton.tsx`: `bg-grovio-border animate-pulse` CSS-only; `aria-busy="true"` on wrapper; no JS animation
- `FilterChip.tsx`: active `bg-grovio-primary text-white rounded-full` with `aria-label="Remove [label] filter"` dismiss button; inactive `bg-grovio-surface border border-grovio-border`
- `ProductCard.tsx`: `motion.div` with `whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}` `transition={{ duration: 0.2 }}`; `aspect-[4/5] object-cover rounded-t-lg`; `alt` bound to product name; router `Link` to `/products/:slug`; no add-to-cart (Phase 5)
- `Toast.tsx`: `AnimatePresence mode="popLayout"` container; each toast is `motion.div` with `initial:{opacity:0,x:16}` → `animate:{opacity:1,x:0}` → `exit:{opacity:0,x:16}` `transition:{duration:0.2}`; `role="status"` (info/success) / `role="alert"` (error); reads from 04-06 `useUiStore`

**Task 2 — Layout shell + router + providers:**

- `PageTransition.tsx`: `motion.div` with `initial:{opacity:0,y:8}` → `animate:{opacity:1,y:0}` → `exit:{opacity:0,y:8}` `transition:{duration:0.25,ease:'easeOut'}`; used as root by all pages
- `Header.tsx`: sticky `<header>`; logo `Link to="/"` left; desktop `<form>` search bar with `h-12` input navigates to `/search?q=...`; mobile search icon button with `aria-label="Search"` that expands inline search bar; account `Link` to `/account/profile` (auth) or `/auth/login` (unauth) with `aria-label="Account"`; disabled cart button with `aria-label="View cart"`; `max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8`; all touch targets `min-h-[48px]`
- `Footer.tsx`: semantic `<footer>`; 3-column link grid; copyright row; token classes only
- `AppLayout.tsx`: `flex min-h-screen flex-col bg-grovio-surface`; `<Header />`; `<main className="flex-1">` with `AnimatePresence mode="wait"`; keyed `div` wrapper by `location.pathname`; `<Footer />`; `<ToastContainer />`
- `ProtectedRoute.tsx`: returns `null` while `isLoading`; `<Navigate to="/auth/login" replace state={{from:pathname}}>` when unauthenticated; `<Outlet />` when authenticated
- `router.tsx`: `createBrowserRouter` — root `/` → AppLayout with 10 child routes; `account` → ProtectedRoute with `profile` and `addresses` children
- `main.tsx`: `<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>`
- Stub pages (10): all use `<PageTransition>` as root; Wave 6 overwrites with full implementations

## Task Commits

1. **Task 1: Shared UI component kit** - `e768ce8` (feat)
2. **Task 2: Layout shell + router + providers + deviation fixes** - `53eaacc` (feat)

## Files Created/Modified

- `apps/web-storefront/src/components/ui/Button.tsx` — primary/secondary/destructive button
- `apps/web-storefront/src/components/ui/Input.tsx` — label-associated input with error state
- `apps/web-storefront/src/components/ui/Skeleton.tsx` — CSS-only shimmer
- `apps/web-storefront/src/components/ui/FilterChip.tsx` — active/inactive filter chip
- `apps/web-storefront/src/components/ui/ProductCard.tsx` — hover-lift product card
- `apps/web-storefront/src/components/ui/Toast.tsx` — animated toast container + single toast
- `apps/web-storefront/src/components/layout/PageTransition.tsx` — page-level motion wrapper
- `apps/web-storefront/src/components/layout/Header.tsx` — site header with search + nav icons
- `apps/web-storefront/src/components/layout/Footer.tsx` — site footer with link columns
- `apps/web-storefront/src/components/layout/AppLayout.tsx` — shell with AnimatePresence
- `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` — auth redirect guard
- `apps/web-storefront/src/router.tsx` — Phase 4 route tree
- `apps/web-storefront/src/main.tsx` — provider hierarchy (modified)
- `apps/web-storefront/vite.config.ts` — motion/react alias (modified)
- `.gitignore` — tsc -b compiled output exclusions (modified)
- 10 stub page files under `pages/`

## Decisions Made

- Vite alias `'motion/react': 'framer-motion'` added to `vite.config.ts` — the TypeScript shim in `motion-react.d.ts` satisfied `tsc --noEmit` but Rolldown requires a resolver-level alias to bundle the import correctly at build time
- `AppLayout` uses a plain `<div key={location.pathname}>` wrapper inside `AnimatePresence` rather than making `Outlet` itself the animated element — this satisfies React Router v7's rendering contract while giving AnimatePresence the keyed child it needs to detect route changes
- `ProtectedRoute` returns `null` (not a loading spinner) while `isLoading === true` — prevents an auth flash that would briefly show protected content before the session probe resolves
- Stub pages are minimal `<PageTransition>` wrappers only — Wave 6 (04-07, 04-08) overwrites them entirely; stub pattern ensures router typechecks without importing non-existent implementations

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Added motion/react Vite alias to resolve Rolldown build failure**
- **Found during:** Task 2 build verification
- **Issue:** `pnpm --filter @grovio/web-storefront build` failed with "Rolldown failed to resolve import 'motion/react'". The `motion-react.d.ts` shim from 04-06 only satisfies `tsc --noEmit` (TypeScript type checking); it does not affect Vite/Rolldown module resolution at bundle time
- **Fix:** Added `'motion/react': 'framer-motion'` alias to `vite.config.ts` `resolve.alias`
- **Files modified:** `apps/web-storefront/vite.config.ts`
- **Commit:** `53eaacc`

**2. [Rule 2 - Missing Critical Config] Added tsc compiled output to .gitignore**
- **Found during:** Task 2 build verification (git status after build)
- **Issue:** `tsc -b` (called by `pnpm build`) emits `.js`, `.js.map`, `.d.ts`, `.d.ts.map` files alongside `.ts` source files in `src/` because no `outDir` is configured. These are build artifacts and should not be committed alongside source files
- **Fix:** Added `apps/web-storefront/src/**/*.js`, `.js.map`, `.d.ts`, `.d.ts.map` patterns to `.gitignore`
- **Files modified:** `.gitignore`
- **Commit:** `53eaacc`

## Known Stubs

The following page stubs are intentional and will be replaced by Wave 6 plans (04-07, 04-08):

| File | Status | Resolved by |
|------|--------|-------------|
| `pages/HomePage.tsx` | Stub — renders heading only | 04-07 |
| `pages/CategoryPage.tsx` | Stub — renders heading only | 04-07 |
| `pages/SearchPage.tsx` | Stub — renders heading only | 04-07 |
| `pages/ProductDetailPage.tsx` | Stub — renders heading only | 04-07 |
| `pages/auth/SignupPage.tsx` | Stub — renders heading only | 04-08 |
| `pages/auth/LoginPage.tsx` | Stub — renders heading only | 04-08 |
| `pages/auth/ForgotPasswordPage.tsx` | Stub — renders heading only | 04-08 |
| `pages/auth/ResetPasswordPage.tsx` | Stub — renders heading only | 04-08 |
| `pages/account/ProfilePage.tsx` | Stub — renders heading only | 04-08 |
| `pages/account/AddressesPage.tsx` | Stub — renders heading only | 04-08 |

These stubs do NOT prevent this plan's goal — the router, layout shell, and UI kit are fully functional. The page content is the responsibility of Wave 6.

## Threat Surface Scan

No new network endpoints, auth paths, or schema changes introduced. This plan is purely a frontend UI/layout layer.

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-04-26 | ProtectedRoute is a UX redirect only; note added in component JSDoc that API enforces customer role guard server-side |
| T-04-27 | All components render escaped JSX (React default); no dangerouslySetInnerHTML used anywhere |

## Self-Check: PASSED

- `apps/web-storefront/src/components/ui/Button.tsx` FOUND
- `apps/web-storefront/src/components/ui/Input.tsx` FOUND
- `apps/web-storefront/src/components/ui/Skeleton.tsx` FOUND
- `apps/web-storefront/src/components/ui/FilterChip.tsx` FOUND
- `apps/web-storefront/src/components/ui/ProductCard.tsx` FOUND
- `apps/web-storefront/src/components/ui/Toast.tsx` FOUND
- `apps/web-storefront/src/components/layout/PageTransition.tsx` FOUND
- `apps/web-storefront/src/components/layout/Header.tsx` FOUND
- `apps/web-storefront/src/components/layout/Footer.tsx` FOUND
- `apps/web-storefront/src/components/layout/AppLayout.tsx` FOUND
- `apps/web-storefront/src/components/layout/ProtectedRoute.tsx` FOUND
- `apps/web-storefront/src/router.tsx` FOUND
- `apps/web-storefront/src/main.tsx` FOUND (modified)
- Commit `e768ce8` FOUND (Task 1)
- Commit `53eaacc` FOUND (Task 2)
- `pnpm --filter @grovio/web-storefront typecheck` exits 0: CONFIRMED
- `pnpm --filter @grovio/web-storefront build` exits 0: CONFIRMED

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
