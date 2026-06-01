# Phase 4: Customer Storefront (Web) - Context

**Gathered:** 2026-06-01
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver the complete customer-facing web browsing experience: homepage with configurable CMS blocks, category landing pages with dynamic faceted filters, infinite-scroll PLP, PDP with dynamic category-specific attribute display, full-text search with type-ahead and filter chips, and all customer authentication flows (signup, login, password reset, profile, saved addresses with Google Places). Backend adds the customer auth service + `GET /homepage` endpoint; frontend builds all storefront pages and routes in `apps/web-storefront`.

Specifically in scope: customer auth backend (customers table, CustomerAuthService, customer JWT, password reset tokens via email), `GET /homepage` public endpoint (read-only block fetch — admin write side is Phase 6), `featured_categories` block type added to contracts, all storefront pages (homepage, /category/:slug, /search, /products/:slug, /account/profile, /account/addresses, auth pages), URL-serialized filter state, infinite scroll, Google Places autocomplete for address entry, Framer Motion micro-interactions, responsive/mobile-first layout, accessibility baseline (keyboard nav, semantic HTML, contrast).

Specifically NOT in scope: basket/cart, checkout, orders, payments (Phase 5), admin/vendor panel UIs (Phase 6), admin block management UI (Phase 6), React Native app (Phase 7), tracking/delivery pages (Phase 8).

</domain>

<decisions>
## Implementation Decisions

### Homepage CMS

- **D-01:** Homepage renders as a **pure CMS block stack** — blocks display in whatever order admin has configured, with no hardcoded positional layout. This is the maximum-flexibility model aligned with the "configuration-first" core value.
- **D-02:** Phase 4 extends the Phase 2 block union (`packages/contracts/src/category/blocks.ts`) with **one new block type**: `featured_categories` — shape: `{ type: 'featured_categories', title: string, categoryIds: string[], layout: 'grid' | 'row' }`. The three Phase 2 types (banner, product_grid, text_block) remain unchanged.
- **D-03:** When no blocks are configured (fresh install), the homepage renders using **default seed data** (pre-seeded blocks that Phase 9 will provide). The storefront should not show a broken or empty state — it should look complete from first boot.
- **D-04:** Homepage block data is fetched from a **new public endpoint `GET /homepage`** that returns the ordered block array. Admin write-side management of homepage blocks is deferred to Phase 6. Phase 4 delivers the read endpoint and seeds initial data.

### PLP & Search Discovery

- **D-05:** PLP uses **infinite scroll** — products auto-load as user scrolls near the bottom, implemented via React Query's `useInfiniteQuery`. Filter/sort/category changes reset to page 1 automatically.
- **D-06:** **URL-serialized filter state** — filters, sort parameter, active category, and search query are all synced to URL query params. Links are shareable and bookmarkable; pressing back from a PDP returns to the same filter state.
- **D-07:** Filter panel layout: **left sidebar on desktop** (fixed column, product grid fills remaining width); **slide-in drawer on mobile** triggered by a "Filters" button above the product grid. Consistent with standard e-commerce conventions.
- **D-08:** Infinite scroll batch size: **24 products per page** (divisible by 2, 3, and 4 — keeps grid rows even at 2-col mobile, 3-col tablet, 4-col desktop).

### Authentication

- **D-09:** Customer tokens use **httpOnly + Secure + SameSite=Lax cookies** for both access token and refresh token. JavaScript cannot read these tokens — XSS-safe by construction. Silent token refresh happens server-side on each request. Requires CORS credentials config (`credentials: 'include'` on fetch; `Access-Control-Allow-Credentials: true` on the API).
- **D-10:** Password reset (AUTH-03) uses an **email link with a time-limited token**: customer submits `/forgot-password` form → backend generates a single-use UUID token, hashes it, stores it in a `password_reset_tokens` table with a 1-hour expiry, and sends a reset link via Google SMTP. Customer clicks link → `/reset-password?token=xxx` → backend verifies and deletes the token → customer sets new password.
- **D-11:** **Separate login per app** — the storefront `/login` page accepts customer credentials only. Vendors log in at the vendor panel (`apps/web-vendor`); admins at the admin panel (`apps/web-admin`). No role-routing or cross-app redirect from the storefront login.
- **D-12:** Customer address management lives on a **dedicated `/account/addresses` page** (separate from `/account/profile`). The address entry form uses a Google Places autocomplete input for the street address field. The account area is accessible from the header nav when logged in.

### PDP Design

- **D-13:** The PDP renders a **disabled "Add to Cart" button** in Phase 4. The button is visually complete (styled, positioned correctly) but non-interactive. Phase 5 activates it by wiring the basket API. This ensures demos and screenshots show a realistic product page.
- **D-14:** Dynamic category-specific attributes (STORE-04) render as a **key-value "Specifications" table** below the product description. Left column = attribute label; right column = formatted value. Works for all attribute types (text, number, enum, boolean, multi_select). Attributes shown are those the category schema marks as `is_filterable` or explicitly visible (not `is_variant`-only attributes).
- **D-15:** Product variant selectors (size, color, etc.) render as **disabled/read-only option pickers** in Phase 4 — buttons or dropdowns showing the available options but not interactive. Phase 5 activates them by wiring inventory and basket. Showing selectors in disabled state rather than hiding them makes the PDP look complete.

### Claude's Discretion

- Framer Motion animation scope: page transitions, product card hover lift/scale, filter panel open/close animation, skeleton-to-content transition, add-to-cart button shake/bounce on disabled click.
- React Router v6 route structure within `apps/web-storefront`
- API client implementation (React Query + fetch wrapper with cookie credentials)
- Skeleton loading state component design
- Google Places autocomplete component (wrapper around the Google Places JS API or a library like `@vis.gl/react-google-maps`)
- Customer auth service JWT access token TTL (following Phase 3 vendor auth TTL pattern)
- Slug strategy for product/category URLs

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Requirements
- `.planning/REQUIREMENTS.md` §"Customer Storefront (Web)" — STORE-01 through STORE-06 (6 requirements)
- `.planning/REQUIREMENTS.md` §"Authentication & Accounts" — AUTH-01 through AUTH-06 (6 requirements)
- `.planning/ROADMAP.md` §"Phase 4: Customer Storefront (Web)" — goal, success criteria (5 SCs), dependency on Phase 3

### Feature Expectations
- `.planning/research/FEATURES.md` §"1. Customer Storefront" — table stakes, differentiators, and anti-features for the storefront; confirms Framer Motion micro-interactions (hover, page transitions), URL-serialized filter chips, vendor mini-profile on PDP, and dynamic category attribute display as key differentiators
- `.planning/research/FEATURES.md` §"2. Search & Discovery" — faceted search, URL query param sync (explicitly called out), zero-results handling

### Auth Contracts (CRITICAL — read before designing customer auth)
- `packages/contracts/src/auth.ts` — RoleSchema (customer/vendor/admin), JwtPayload, SessionData, AuthTokenPair; customer auth backend MUST produce tokens conforming to these schemas
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — argon2 + jose JWT signing pattern; customer auth service follows the same argon2/jose pattern with role="customer"
- `apps/api/src/routes/vendor/auth.ts` — Fastify route plugin pattern for auth endpoints; customer auth routes (`/auth/signup`, `/auth/login`, `/auth/refresh`, `/auth/logout`, `/auth/forgot-password`, `/auth/reset-password`) follow the same plugin structure

### Phase 2 Block Contract (CRITICAL — Phase 4 extends this)
- `packages/contracts/src/category/blocks.ts` — discriminated union of Phase 2 block types; Phase 4 adds `featured_categories` to this union. Downstream agents must read the current union before adding the new type.

### Phase 3 API Contracts (storefront calls these)
- `.planning/phases/03-catalog-search/03-CONTEXT.md` — Phase 3 locked the following public API shapes (forward contracts): `GET /search?q=...`, `GET /search/suggest?q=...`, `GET /products/:id`, `GET /categories/:id/filters`; storefront calls these endpoints directly
- `packages/contracts/src/search/` — search query request/response shapes
- `packages/contracts/src/catalog/` — product, variant, and image shapes

### Technology Stack
- `CLAUDE.md` §"Recommended Stack" — React 19.2.x, Vite 8, Tailwind CSS 4.3.x + `@tailwindcss/vite`, TanStack Query 5.x (`useInfiniteQuery` for PLP), Zustand 5.x, Motion 12.x (`motion/react` import path), jose 6.x for JWT verification on the backend
- `CLAUDE.md` §"What NOT to Use" — no PostCSS path for Tailwind (use `@tailwindcss/vite`), no `jsonwebtoken` (use `jose`)

### Existing Patterns to Follow
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis cache + DB fallback pattern; customer session data uses the same Redis-backed pattern
- `apps/api/src/routes/categories.ts` — public Fastify route plugin pattern; `GET /homepage` follows this
- `apps/api/src/container.ts` — Awilix DI registration; CustomerAuthService, HomepageService register the same way
- `packages/ui/src/tokens/tokens.css` — design tokens for all three web apps; storefront uses these via Tailwind v4 classes

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web-storefront/src/App.tsx`: Current storefront shell. Phase 4 replaces this with a React Router router tree, layout components, and all pages. The existing Framer Motion fade-in pattern (initial/animate/transition) is the micro-interaction template.
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts`: argon2 password hashing + jose JWT signing/verification. `CustomerAuthService` is a parallel class following the same constructor injection (db, env), same argon2/jose methods, same error class patterns (`CustomerAlreadyExistsError`, `InvalidCredentialsError`).
- `packages/contracts/src/auth.ts`: JwtPayload and AuthTokenPair are the exact shapes the customer auth backend must emit and the storefront must handle.
- `packages/contracts/src/category/blocks.ts`: Phase 4 adds `featured_categories` block to the discriminated union here. Do not add it elsewhere — all consumers import from contracts.

### Established Patterns
- **httpOnly cookie auth**: D-09 requires `credentials: 'include'` on all API fetch calls; API must respond with `Access-Control-Allow-Origin: [specific origin]` (not `*`) and `Access-Control-Allow-Credentials: true`. This is a Fastify CORS config change in `apps/api/src/app.ts`.
- **pgEnum for status types**: Phase 3 added `productStatusEnum`. Phase 4 adds no new status types, but password reset tokens table needs an `expires_at` timestamp column following the existing `created_at/updated_at` column naming.
- **Soft delete via `archived_at`**: Password reset tokens are single-use and can be hard-deleted after use (not soft-deleted). Expired unused tokens are cleaned up via a BullMQ job or on-next-use check.
- **Route plugins**: All new API routes mount as Fastify plugins. Customer auth routes: `/auth/*` (public, no auth middleware). Profile/address routes: `/account/*` (auth-gated, customer role required).
- **URL state sync**: React Router v6's `useSearchParams` hook is the standard pattern for serializing filter state to the URL. Zustand is used only for ephemeral UI state (filter panel open/close), not for filter values that belong in the URL.

### Integration Points
- Phase 3 search API is a stable forward contract (`GET /search`, `GET /search/suggest`, `GET /products/:id`, `GET /categories/:id/filters`) — storefront consumes these with no changes to Phase 3 code
- Phase 5 (Commerce Core) will replace the disabled Add to Cart button and disabled variant selectors by wiring the basket API — Phase 4 must export these PDP components with clear extension points
- Phase 6 admin panel will add the write-side for `GET /homepage` block management — Phase 4 only builds the read endpoint; a `homepage_blocks` table is created in Phase 4 with seed data
- `packages/contracts/src/category/blocks.ts` is a shared contract — Phase 4's `featured_categories` addition must be a non-breaking extension (union member added, no existing types changed)

</code_context>

<specifics>
## Specific Ideas

- The `featured_categories` block renderer on the homepage should fetch category details (name, image, slug) from the existing `GET /categories` endpoint for the given `categoryIds`. It does not need its own data endpoint — it reuses the category tree API from Phase 2.
- The `GET /homepage` endpoint should return blocks in `sort_order` order. The `homepage_blocks` table schema: `{ id, type, payload JSONB, sort_order, is_active boolean, created_at, updated_at }`. `is_active=false` blocks are excluded from the public response. Admin Phase 6 manages this table.
- The disabled Add to Cart button (D-13) should use a `data-phase="5"` or similar attribute for easy identification during Phase 5 integration — makes handoff explicit.
- The spec table (D-14) should skip attributes where `value` is null or empty, and skip `is_variant=true` attributes (those render as variant selectors per D-15, not in the spec table).
- Google Places autocomplete: the simplest implementation is a controlled `<input>` that loads the Google Places JS API script and attaches an `Autocomplete` instance. The `@vis.gl/react-google-maps` package is an alternative if a React wrapper is preferred. Either way, the component should output a structured address object (street, city, state, pincode, lat/lng) — not just a raw string — for Phase 5 checkout reuse.
- The storefront's React Query client should be configured with `credentials: 'include'` at the fetch level so all API calls automatically include the httpOnly cookies.

</specifics>

<deferred>
## Deferred Ideas

- **Admin homepage block management UI** (create/reorder/archive blocks via admin panel) — Phase 6 (ADM-04). Phase 4 delivers only `GET /homepage` read endpoint.
- **Shopping basket / cart functionality** — Phase 5. The disabled Add to Cart button in Phase 4 is a visual placeholder only.
- **Checkout flow, payments, order placement** — Phase 5.
- **Order history and order detail pages** — Phase 5 (ORD-03).
- **Order tracking / delivery tracking page** — Phase 8 (FUL-01).
- **Product reviews and ratings display** — display-ready in v1 with seeded data (Phase 9); customer submission flow is v1.x.
- **Wishlist / save for later** — v1.x (ENG2-03 in v2 requirements).
- **Social login (Google/Facebook OAuth)** — v2 (ENG2-05). Email/password + password reset covers AUTH-01–AUTH-03.
- **Vendor mini-profile section on PDP** (store name, rating badge) — FEATURES.md lists this as a differentiator but it requires the vendor profile data from Phase 6 (VEN-01). Note: basic vendor name can still be shown in Phase 4 using the vendor info already on the product record from Phase 3.

None of the above add scope to Phase 4. Discussion stayed within phase boundaries.

</deferred>

---

*Phase: 4-Customer Storefront (Web)*
*Context gathered: 2026-06-01*
