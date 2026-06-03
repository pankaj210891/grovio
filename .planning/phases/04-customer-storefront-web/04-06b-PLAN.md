---
phase: 04-customer-storefront-web
plan: 06b
type: execute
wave: 5
depends_on: [04-06]
files_modified:
  - apps/web-storefront/src/components/ui/Button.tsx
  - apps/web-storefront/src/components/ui/Input.tsx
  - apps/web-storefront/src/components/ui/Skeleton.tsx
  - apps/web-storefront/src/components/ui/FilterChip.tsx
  - apps/web-storefront/src/components/ui/ProductCard.tsx
  - apps/web-storefront/src/components/ui/Toast.tsx
  - apps/web-storefront/src/components/layout/Header.tsx
  - apps/web-storefront/src/components/layout/Footer.tsx
  - apps/web-storefront/src/components/layout/PageTransition.tsx
  - apps/web-storefront/src/components/layout/AppLayout.tsx
  - apps/web-storefront/src/components/layout/ProtectedRoute.tsx
  - apps/web-storefront/src/router.tsx
  - apps/web-storefront/src/main.tsx
autonomous: true
requirements: [STORE-05, STORE-06, AUTH-02]
must_haves:
  truths:
    - "The storefront boots through RouterProvider + QueryClientProvider with all Phase 4 routes registered"
    - "Shared UI components match the UI-SPEC color/spacing/typography/animation contract"
    - "AppLayout wraps routed pages in AnimatePresence mode=wait keyed by pathname"
  artifacts:
    - path: "apps/web-storefront/src/router.tsx"
      provides: "React Router v7 route tree"
      contains: "createBrowserRouter"
    - path: "apps/web-storefront/src/components/ui/ProductCard.tsx"
      provides: "PLP/homepage product card with hover lift"
      contains: "whileHover"
    - path: "apps/web-storefront/src/components/layout/PageTransition.tsx"
      provides: "Shared page-transition wrapper"
      contains: "exit"
  key_links:
    - from: "apps/web-storefront/src/main.tsx"
      to: "router + queryClient"
      via: "RouterProvider inside QueryClientProvider"
      pattern: "RouterProvider"
    - from: "apps/web-storefront/src/components/layout/AppLayout.tsx"
      to: "routed pages"
      via: "AnimatePresence mode=wait keyed by location.pathname"
      pattern: "AnimatePresence"
    - from: "apps/web-storefront/src/components/layout/ProtectedRoute.tsx"
      to: "useAuth (from 04-06)"
      via: "Navigate redirect when unauthenticated"
      pattern: "Navigate"
---

<objective>
Build the storefront UI kit and layout shell on top of the 04-06 data layer: the shared UI component kit (Button, Input, Skeleton, FilterChip, ProductCard, Toast), the layout shell (Header, Footer, PageTransition, AppLayout, ProtectedRoute), and the router + main.tsx providers. This is the visual scaffold every page in Wave 6 mounts into.

Purpose: Encodes the UI-SPEC visual/animation contract and the route tree once, centrally, so the two Wave 6 page plans (04-07, 04-08) build against fixed component props and route paths without exploring. Depends on 04-06 for useAuth (ProtectedRoute, Header) and ui-store (Toast).
Output: ui components, layout components, router.tsx, main.tsx.
</objective>

<execution_context>
@$HOME/.claude/get-shit-done/workflows/execute-plan.md
@$HOME/.claude/get-shit-done/templates/summary.md
</execution_context>

<context>
@.planning/PROJECT.md
@.planning/STATE.md
@.planning/phases/04-customer-storefront-web/04-PATTERNS.md
@.planning/phases/04-customer-storefront-web/04-RESEARCH.md
@.planning/phases/04-customer-storefront-web/04-UI-SPEC.md
@apps/web-storefront/src/App.tsx
@apps/web-storefront/src/main.tsx
@apps/web-storefront/src/hooks/useAuth.ts
@apps/web-storefront/src/store/ui-store.ts
---
Note: useAuth.ts and store/ui-store.ts are produced by 04-06 (depends_on). Consume their exported shapes; do not redefine them here.
</context>

<tasks>

<task type="auto">
  <name>Task 1: Shared UI component kit (Button, Input, Skeleton, FilterChip, ProductCard, Toast)</name>
  <read_first>
    - apps/web-storefront/src/App.tsx (motion/react usage, Tailwind v4 design-token classes like bg-grovio-primary)
    - apps/web-storefront/src/store/ui-store.ts (toast list shape consumed by Toast — from 04-06)
    - .planning/phases/04-customer-storefront-web/04-UI-SPEC.md (§ Component Patterns, § Color, § Typography, § Spacing, § Animation Contract, § Accessibility Contract — exact classes and values)
    - .planning/phases/04-customer-storefront-web/04-PATTERNS.md (§ ProductCard.tsx, Pattern I, Pattern J)
  </read_first>
  <action>
    Build the hand-rolled component kit using Tailwind v4 design-token classes (never hardcode hex) and `motion/react` for animation. Use `lucide-react` for icons.

    `Button.tsx`: primary variant `bg-grovio-primary text-white rounded-md font-semibold text-base px-6 py-3` (48px tall), `hover:bg-grovio-primary-hover`, disabled `opacity-60 cursor-not-allowed`, loading state shows lucide `Loader2` with `animate-spin` + label; `focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2`. Support secondary and destructive variants.

    `Input.tsx`: `border border-grovio-border rounded-md bg-grovio-surface-raised text-grovio-text text-sm h-10`; `focus:outline-none focus:ring-2 focus:ring-grovio-primary`; error variant `border-grovio-error`; associates a `<label>` via htmlFor/id; renders an inline error message in `text-grovio-error text-sm` when provided.

    `Skeleton.tsx`: `bg-grovio-border rounded-md animate-pulse` (CSS pulse only — no JS animation per Don't-Hand-Roll); accepts a `className` for sizing; wrapper sets `aria-busy="true"`.

    `FilterChip.tsx`: active chip `bg-grovio-primary text-white rounded-full text-sm font-medium` with an `×` dismiss button (`aria-label="Remove [filter name] filter"`, `text-white/70 hover:text-white`); inactive variant `bg-grovio-surface border border-grovio-border text-grovio-text`.

    `ProductCard.tsx`: `motion.div` card `bg-grovio-surface-raised rounded-lg border border-grovio-border overflow-hidden`; `whileHover={{ y: -4, boxShadow: "0 8px 24px rgba(0,0,0,0.10)" }}` `transition={{ duration: 0.2 }}`; image `aspect-[4/5] object-cover rounded-t-lg` with `alt="[product name]"`; name (text-base semibold), price (text-base semibold text-grovio-primary), vendor name (text-sm text-grovio-text-muted). NO add-to-cart on the card. Wrap the card in a router `Link` to `/products/:slug`.

    `Toast.tsx`: `motion.div` with `role="status"` (info) / `role="alert"` (error), `aria-live="polite"`; slide-in `initial:{opacity:0,x:16}` → `animate:{opacity:1,x:0}` → `exit:{opacity:0,x:16}` `transition:{duration:0.2}`; rendered inside `AnimatePresence`; reads the toast list from the 04-06 ui-store.
  </action>
  <verify>
    <automated>pnpm --filter @grovio/web-storefront typecheck && pnpm --filter @grovio/web-storefront build</automated>
  </verify>
  <acceptance_criteria>
    - Button.tsx uses `bg-grovio-primary`, includes disabled `opacity-60 cursor-not-allowed` and a `focus-visible:ring-2` ring; loading uses lucide `Loader2`
    - Input.tsx has `focus:ring-2 focus:ring-grovio-primary`, an error variant with `border-grovio-error`, and label association
    - Skeleton.tsx uses `animate-pulse` (no motion/JS animation) and sets `aria-busy`
    - FilterChip.tsx active chip uses `bg-grovio-primary text-white rounded-full` with an `aria-label`-ed dismiss button
    - ProductCard.tsx uses `whileHover={{ y: -4` and `aspect-[4/5]`, image `alt` bound to product name, links to `/products/`
    - Toast.tsx uses `role="status"`/`role="alert"` and the slide-in `x:16` animation inside AnimatePresence
    - No hardcoded hex color values in any component (tokens only)
    - typecheck and build exit 0
  </acceptance_criteria>
  <done>The shared UI kit matches the UI-SPEC color/spacing/typography/animation/accessibility contracts; storefront builds.</done>
</task>

<task type="auto">
  <name>Task 2: Layout shell + router + providers</name>
  <read_first>
    - apps/web-storefront/src/main.tsx (current root render to replace)
    - apps/web-storefront/src/App.tsx (motion import; existing fade-in pattern)
    - apps/web-storefront/src/hooks/useAuth.ts (auth state for Header + ProtectedRoute — from 04-06)
    - apps/web-storefront/src/lib/query-client.ts (QueryClient instance — from 04-06)
    - .planning/phases/04-customer-storefront-web/04-PATTERNS.md (§ main.tsx, § router.tsx, § PageTransition.tsx)
    - .planning/phases/04-customer-storefront-web/04-RESEARCH.md (§ Pattern 5 — AnimatePresence page transitions; Pitfall 3)
    - .planning/phases/04-customer-storefront-web/04-UI-SPEC.md (§ Layout Shell, § Responsive Layout, § Animation Contract page transition, § Accessibility Contract landmarks)
  </read_first>
  <action>
    `components/layout/PageTransition.tsx`: a `motion.div` with `initial:{opacity:0,y:8}` → `animate:{opacity:1,y:0}` → `exit:{opacity:0,y:8}` `transition:{duration:0.25, ease:'easeOut'}` wrapping `children`. Every page in Wave 6 uses this as its root (Pitfall 3).

    `components/layout/Header.tsx`: semantic `<header>` with logo (Link to `/`), centered search bar on desktop (md+) that navigates to `/search?q=...` on submit, collapses to a search icon button on mobile (`aria-label="Search"`); account icon button (`aria-label="Account"`, links to `/account/profile` when authenticated via useAuth else `/auth/login`); cart placeholder icon button (`aria-label="View cart"`, non-interactive Phase 4). Use lucide icons. Touch targets `min-h-[48px]`. Container `max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8`, `bg-grovio-surface-raised`.

    `components/layout/Footer.tsx`: semantic `<footer>` with link columns and a copyright row, token colors.

    `components/layout/AppLayout.tsx`: renders `<Header />`, a `<main>` landmark wrapping an `AnimatePresence mode="wait"` whose keyed child is the routed `<Outlet />` content keyed by `location.pathname` (use the PageTransition-per-page approach: AppLayout provides `AnimatePresence`; each page supplies `<PageTransition>` — keep the keyed wrapper around Outlet per Pattern 5), and `<Footer />`. Render the Toast container here (reads the 04-06 ui-store toast list).

    `components/layout/ProtectedRoute.tsx`: uses useAuth; if not authenticated, `<Navigate to="/auth/login" replace />` (preserving intended path); else renders `<Outlet />`.

    `router.tsx`: `createBrowserRouter` with the route tree from PATTERNS.md § router.tsx — root `/` → AppLayout with children: index→HomePage, `category/:slug`→CategoryPage, `search`→SearchPage, `products/:slug`→ProductDetailPage, `auth/signup|login|forgot-password|reset-password`, and `account` → ProtectedRoute with children `profile`→ProfilePage and `addresses`→AddressesPage. The page components are produced by Wave 6 (04-07/04-08); create minimal stub page modules now ONLY where needed so the router typechecks, and note Wave 6 overwrites them.

    `main.tsx`: replace the current root render with `<React.StrictMode><QueryClientProvider client={queryClient}><RouterProvider router={router} /></QueryClientProvider></React.StrictMode>`, importing `./app.css` and the `queryClient` from `lib/query-client.ts` (04-06).
  </action>
  <verify>
    <automated>pnpm --filter @grovio/web-storefront typecheck && pnpm --filter @grovio/web-storefront build</automated>
  </verify>
  <acceptance_criteria>
    - PageTransition.tsx contains `exit={{ opacity: 0, y: 8 }}` and `motion.div`
    - Header.tsx is a `<header>` with `aria-label="Search"`, `aria-label="Account"`, `aria-label="View cart"` icon buttons and `max-w-screen-xl` container
    - AppLayout.tsx renders `<header>`, `<main>`, `<footer>` landmarks and `AnimatePresence mode="wait"` keyed by `location.pathname`
    - ProtectedRoute.tsx redirects unauthenticated users to `/auth/login`
    - router.tsx uses `createBrowserRouter` and registers all Phase 4 routes including the nested `account` ProtectedRoute children
    - main.tsx wraps `RouterProvider` in `QueryClientProvider`
    - typecheck and build exit 0
  </acceptance_criteria>
  <done>The storefront boots with the full route tree, animated page transitions, semantic layout landmarks, and protected account routes; build succeeds.</done>
</task>

</tasks>

<threat_model>
## Trust Boundaries

| Boundary | Description |
|----------|-------------|
| browser JS → auth state | JS must not read httpOnly cookies; auth state inferred from API responses via useAuth (04-06) |

## STRIDE Threat Register

| Threat ID | Category | Component | Disposition | Mitigation Plan |
|-----------|----------|-----------|-------------|-----------------|
| T-04-26 | Elevation of Privilege | ProtectedRoute client guard | mitigate | ProtectedRoute is a UX redirect only; the API enforces the customer role guard on every `/account/*` request server-side (04-05) — the client gate is not the authority |
| T-04-27 | Information Disclosure | rendered block/product UI | accept | Components render API data as escaped JSX (React escapes by default); no dangerouslySetInnerHTML for untrusted content |
</threat_model>

<verification>
- `pnpm --filter @grovio/web-storefront typecheck` exits 0
- `pnpm --filter @grovio/web-storefront build` exits 0
- Dev server boots; navigating routes triggers page transition animation
</verification>

<success_criteria>
- UI kit + layout shell + router contracts are fixed and consumable by Wave 6 pages (04-07, 04-08)
- The storefront boots with the full route tree, animated page transitions, semantic landmarks, and protected account routes
</success_criteria>

<output>
Create `.planning/phases/04-customer-storefront-web/04-06b-SUMMARY.md` when done
</output>
</content>
