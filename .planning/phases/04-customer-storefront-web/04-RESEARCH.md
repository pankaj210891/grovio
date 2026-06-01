# Phase 4: Customer Storefront (Web) — Research

**Researched:** 2026-06-01
**Domain:** React 19 SPA storefront + Fastify customer auth backend + Google Places + Framer Motion
**Confidence:** HIGH (core stack verified against codebase; patterns verified against official docs)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

**Homepage CMS**
- D-01: Homepage renders as a pure CMS block stack — blocks display in admin-configured order; no hardcoded positional layout.
- D-02: Phase 4 extends the Phase 2 block union (`packages/contracts/src/category/blocks.ts`) with one new block type: `featured_categories` — shape: `{ type: 'featured_categories', title: string, categoryIds: string[], layout: 'grid' | 'row' }`. The three Phase 2 types remain unchanged.
- D-03: When no blocks are configured (fresh install), the homepage renders using default seed data (pre-seeded blocks that Phase 9 will provide). The storefront must never show a broken or empty state.
- D-04: Homepage block data is fetched from a new public endpoint `GET /homepage` that returns the ordered block array. Admin write-side is deferred to Phase 6. Phase 4 delivers the read endpoint and seeds initial data.

**PLP & Search Discovery**
- D-05: PLP uses infinite scroll — products auto-load as user scrolls near the bottom, implemented via React Query's `useInfiniteQuery`. Filter/sort/category changes reset to page 1 automatically.
- D-06: URL-serialized filter state — filters, sort parameter, active category, and search query are all synced to URL query params. Links are shareable and bookmarkable; pressing back from a PDP returns to the same filter state.
- D-07: Filter panel layout: left sidebar on desktop (fixed column, product grid fills remaining width); slide-in drawer on mobile triggered by a "Filters" button above the product grid.
- D-08: Infinite scroll batch size: 24 products per page.

**Authentication**
- D-09: Customer tokens use httpOnly + Secure + SameSite=Lax cookies for both access token and refresh token. JavaScript cannot read these tokens — XSS-safe by construction. Requires CORS credentials config (`credentials: 'include'` on fetch; `Access-Control-Allow-Credentials: true` on the API).
- D-10: Password reset uses an email link with a time-limited token: customer submits `/forgot-password` form → backend generates a single-use UUID token, hashes it, stores it in a `password_reset_tokens` table with a 1-hour expiry, and sends a reset link via Google SMTP. Customer clicks link → `/reset-password?token=xxx` → backend verifies and deletes the token → customer sets new password.
- D-11: Separate login per app — the storefront `/login` page accepts customer credentials only.
- D-12: Customer address management lives on a dedicated `/account/addresses` page. The address entry form uses a Google Places autocomplete input for the street address field. The account area is accessible from the header nav when logged in.

**PDP Design**
- D-13: The PDP renders a disabled "Add to Cart" button in Phase 4. The button is visually complete but non-interactive. Phase 5 activates it. Button must have `data-phase="5"` attribute.
- D-14: Dynamic category-specific attributes render as a key-value "Specifications" table below the product description. Skip attributes where value is null/empty or `is_variant=true`.
- D-15: Product variant selectors render as disabled/read-only option pickers in Phase 4 — buttons or dropdowns showing available options but not interactive. Phase 5 activates them.

### Claude's Discretion

- Framer Motion animation scope: page transitions, product card hover lift/scale, filter panel open/close animation, skeleton-to-content transition, add-to-cart button shake/bounce on disabled click.
- React Router v6/v7 route structure within `apps/web-storefront`
- API client implementation (React Query + fetch wrapper with cookie credentials)
- Skeleton loading state component design
- Google Places autocomplete component implementation (raw API vs. `@vis.gl/react-google-maps`)
- Customer auth service JWT access token TTL (following Phase 3 vendor auth TTL pattern)
- Slug strategy for product/category URLs

### Deferred Ideas (OUT OF SCOPE)

- Admin homepage block management UI — Phase 6 (ADM-04)
- Shopping basket/cart functionality — Phase 5
- Checkout flow, payments, order placement — Phase 5
- Order history and order detail pages — Phase 5 (ORD-03)
- Order tracking/delivery tracking page — Phase 8 (FUL-01)
- Product reviews and ratings display — Phase 9 / v1.x
- Wishlist/save for later — v1.x (ENG2-03)
- Social login (Google/Facebook OAuth) — v2 (ENG2-05)
- Vendor mini-profile full section on PDP — Phase 6 (basic vendor name from product record is OK in Phase 4)
</user_constraints>

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|------------------|
| STORE-01 | Customer can view a configurable homepage with merchandising/CMS blocks | GET /homepage endpoint + FeaturedCategoriesBlock extension + block renderer pattern |
| STORE-02 | Customer can view category landing pages with category-specific filters | GET /categories/:id/filters (Phase 3 contract) + URL-serialized filter state (D-06) |
| STORE-03 | Customer can view a product listing page with pagination/infinite scroll | useInfiniteQuery + IntersectionObserver sentinel + 24-per-page batch |
| STORE-04 | Customer can view a product detail page showing dynamic, category-specific attributes | GET /products/:id (Phase 3 contract) + Specifications table (D-14) |
| STORE-05 | Storefront is responsive/mobile-first and uses Framer Motion micro-interactions | Tailwind v4 breakpoints + motion/react 12.x animation contract (UI-SPEC) |
| STORE-06 | Storefront is accessibility-conscious (keyboard nav, semantic markup, contrast) | WCAG AA baseline, ARIA roles, focus rings (UI-SPEC accessibility contract) |
| AUTH-01 | Customer can sign up with email and password | CustomerAuthService.register() — argon2 hash + customers table |
| AUTH-02 | Customer can log in and session persists across refresh/app restart | httpOnly cookie access+refresh tokens + silent refresh endpoint |
| AUTH-03 | Customer can reset password via emailed link | password_reset_tokens table + nodemailer Google SMTP (D-10) |
| AUTH-04 | Vendor and admin users authenticate with role-appropriate access | Separate login pages; storefront login accepts customer role only (D-11) |
| AUTH-05 | Customer can manage profile and saved addresses | /account/profile + /account/addresses pages with customer_addresses table |
| AUTH-06 | Address entry uses Google Places autocomplete | @googlemaps/js-api-loader v2.0.2 + custom PlacesAutocompleteInput component |
</phase_requirements>

---

## Summary

Phase 4 is the first user-visible phase of the Grovio storefront. It spans two vertical concerns: a **customer auth backend** (new `customers` table, `CustomerAuthService`, httpOnly cookie auth, password reset via email) and the **complete web storefront UI** in `apps/web-storefront` (React Router routing tree, all storefront pages, Google Places address input, infinite scroll PLP, animated PDP). The phase is almost entirely additive — it does not modify existing Phase 2/3 services, only adds new routes alongside them in `apps/api/src/app.ts`.

The codebase is well-established with clear patterns to follow. The `VendorAuthService` is a direct template for `CustomerAuthService` (same argon2 + jose stack, same Awilix registration pattern, same route plugin structure). The `categories.ts` route plugin is the direct template for the new `GET /homepage` read route. The `app.css` already imports Tailwind v4 and the `@grovio/ui/tokens` design tokens, and `App.tsx` already demonstrates the `motion/react` import path and Framer Motion fade-in pattern. The storefront `package.json` already includes React 19, React Query 5, Zustand 5, and framer-motion 12 — only `react-router-dom` and `lucide-react` are new npm dependencies, plus `@fastify/cors` and optionally `@googlemaps/js-api-loader` on the backend/frontend respectively.

**Primary recommendation:** Follow existing patterns without deviation. `CustomerAuthService` mirrors `VendorAuthService` with role="customer". The storefront is built as a React Router v7 SPA; all navigation, URL state, infinite scroll, and animation patterns are well-established in the ecosystem and documented in the UI-SPEC that has already been approved.

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| Customer signup / login / logout | API / Backend | — | Passwords hashed server-side; tokens set as httpOnly cookies by the server; never trusted from client |
| Password reset token generation + email | API / Backend | — | Single-use UUID token hashed in DB; email dispatched from backend via Google SMTP; frontend submits form only |
| JWT access/refresh token lifecycle | API / Backend | Browser/Client (cookie storage) | Backend issues, signs, and verifies JWTs; browser stores passively via httpOnly cookie |
| Silent token refresh | API / Backend | Frontend Server (fetch interceptor) | React Query's API client re-triggers `/auth/refresh` on 401; backend rotates cookies |
| Customer profile + address CRUD | API / Backend | Frontend (form UI) | Data authoritative in PostgreSQL; frontend submits to `/account/*` routes |
| Homepage block rendering | Browser / Client | — | Purely read-only UI; GET /homepage returns ordered block array; no SSR |
| URL filter state | Browser / Client | — | `useSearchParams` owns filter state; React Query uses URL params as query key |
| Infinite scroll pagination | Browser / Client | — | `useInfiniteQuery` + IntersectionObserver sentinel; backend provides cursor-based pages |
| Google Places autocomplete | Browser / Client | — | Maps JS API loaded lazily via `@googlemaps/js-api-loader`; structured address object emitted to React state |
| Product search / facets | API / Backend (Phase 3) | — | Phase 3 search endpoints are stable contracts; storefront consumes them with no changes |
| Framer Motion animations | Browser / Client | — | GPU-accelerated CSS transforms; no server involvement |
| Design tokens / theming | Browser / Client (CSS) | — | `packages/ui/src/tokens/tokens.css` @theme block; imported in `app.css` already |

---

## Standard Stack

### Core (already in web-storefront package.json — no install needed)

| Library | Version | Purpose | Source |
|---------|---------|---------|--------|
| React | 19.2.x | UI framework | `package.json` — `^19.2.3` |
| Vite | 8.0.x | Build + dev server | `package.json` — `^8.0.0` |
| Tailwind CSS | 4.3.x | Utility-first styling | `package.json` — `^4.3.0` |
| @tailwindcss/vite | 4.3.x | Tailwind v4 Vite plugin | `package.json` — `^4.3.0` |
| framer-motion | 12.x | Animations and micro-interactions | `package.json` — `^12.0.0` |
| @tanstack/react-query | 5.100.x | Server state, infinite scroll | `package.json` — `^5.100.0` |
| zustand | 5.0.x | Ephemeral UI state (drawer open/close) | `package.json` — `^5.0.0` |
| @grovio/contracts | workspace:* | Shared API types + Zod schemas | `package.json` |
| @grovio/ui | workspace:* | Design tokens | `package.json` |

[VERIFIED: codebase — apps/web-storefront/package.json]

### New Frontend Dependencies (must install)

| Library | Version | Purpose | Evidence |
|---------|---------|---------|----------|
| react-router-dom | ^7.16.0 | Client-side routing, `useSearchParams` for URL filter state | [VERIFIED: npm registry — 7.16.0 published; Apache 2.0; Remix team; 13M+ weekly downloads] |
| lucide-react | ^1.17.0 | Tree-shakeable SVG icons | [VERIFIED: npm registry — 1.17.0; ISC license; 4M+ weekly downloads] |
| react-intersection-observer | ^10.0.3 | IntersectionObserver hook for infinite scroll sentinel | [VERIFIED: npm registry — 10.0.3; MIT; 4.6M weekly downloads; zero dependencies; Vitest-compatible] |

Note on `react-router-dom` v7: In v7, `react-router-dom` re-exports everything from the unified `react-router` package. The recommended import source is `react-router` (not `react-router-dom`), but installing `react-router-dom` pulls in both and all imports work from either. For a fresh project, `react-router@7.16.0` alone is sufficient. [CITED: reactrouter.com — v7 package consolidation note]

### New Frontend Optional Dependency

| Library | Version | Purpose | Evidence |
|---------|---------|---------|----------|
| @googlemaps/js-api-loader | ^2.0.2 | Official Google Maps JS API loader (lazy script load for Places Autocomplete) | [VERIFIED: npm registry — 2.0.2; Apache 2.0; official Google package at googlemaps/js-api-loader] |

### New Backend Dependencies (must install in apps/api)

| Library | Version | Purpose | Evidence |
|---------|---------|---------|----------|
| @fastify/cors | ^11.2.0 | CORS with credentials for httpOnly cookie cross-origin flow (D-09) | [VERIFIED: npm registry — 11.2.0; fastify/fastify-cors; v11.x targets Fastify 5.x] |
| nodemailer | ^8.0.x | Google SMTP for password reset email (D-10, AUTH-03) | [VERIFIED: codebase — listed as standard stack in CLAUDE.md; 15M+ weekly downloads] |

Note: `nodemailer` must also be installed in `apps/api`. CLAUDE.md confirms `nodemailer@8.0.x` as the standard stack. The API's existing `package.json` does not yet include it. [VERIFIED: CLAUDE.md recommended stack]

### Alternatives Considered

| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| react-router v7 | TanStack Router | TanStack Router has better TypeScript inference but requires a full paradigm shift; RR v7 is the industry standard and integrates directly with AnimatePresence key-based page transitions |
| react-intersection-observer | Native IntersectionObserver in useEffect | react-intersection-observer handles ref merging, cleanup, and SSR-safe behavior out of the box; saves 30+ lines of plumbing per usage |
| @googlemaps/js-api-loader | @vis.gl/react-google-maps | @vis.gl brings the full Maps SDK as React components — heavier than needed for a single autocomplete input; CONTEXT.md leaves this at Claude's discretion; lightweight loader + custom component is the right call |
| nodemailer | SendGrid / Mailgun SDK | Project spec mandates Google SMTP for all transactional email; nodemailer is the correct transport for Google SMTP |

**Installation (frontend):**
```bash
pnpm --filter @grovio/web-storefront add react-router-dom@^7.16.0 lucide-react@^1.17.0 react-intersection-observer@^10.0.3 @googlemaps/js-api-loader@^2.0.2
```

**Installation (backend):**
```bash
pnpm --filter @grovio/api add @fastify/cors@^11.2.0 nodemailer@^8.0.0
pnpm --filter @grovio/api add -D @types/nodemailer
```

---

## Package Legitimacy Audit

> slopcheck was unavailable in this environment (permission denied). All packages are tagged [ASSUMED] per the graceful degradation rule. Planner must add `checkpoint:human-verify` before each install.

| Package | Registry | Age | Downloads | Source Repo | slopcheck | Disposition |
|---------|----------|-----|-----------|-------------|-----------|-------------|
| react-router-dom | npm | ~10 yrs | 13M/wk | github.com/remix-run/react-router | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |
| lucide-react | npm | ~4 yrs | 4M/wk | github.com/lucide-icons/lucide | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |
| react-intersection-observer | npm | ~7 yrs | 4.6M/wk | github.com/thebuilder/react-intersection-observer | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |
| @googlemaps/js-api-loader | npm | ~5 yrs | 424 projects | github.com/googlemaps/js-api-loader | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |
| @fastify/cors | npm | ~7 yrs | high | github.com/fastify/fastify-cors | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |
| nodemailer | npm | ~12 yrs | 15M/wk | github.com/nodemailer/nodemailer | [ASSUMED] | Flagged — planner inserts checkpoint:human-verify |

**Packages removed due to slopcheck [SLOP] verdict:** none (slopcheck unavailable; no packages removed on that basis)
**Packages flagged as suspicious [SUS]:** none identified by manual review (all are well-known, long-lived packages with large download counts and known GitHub repos)

*slopcheck was unavailable at research time. All packages above are tagged [ASSUMED]. Planner must gate each install behind a `checkpoint:human-verify` task.*

---

## Architecture Patterns

### System Architecture Diagram

```
Browser (React SPA — apps/web-storefront)
    │
    │  GET /homepage (public)
    │  GET /categories (public, Phase 2)
    │  GET /search?q=&filters=&cursor= (public, Phase 3)
    │  GET /search/suggest?q= (public, Phase 3)
    │  GET /products/:id (public, Phase 3)
    │  GET /categories/:id/filters (public, Phase 3)
    │  POST /auth/signup (public) ──────────────────────────┐
    │  POST /auth/login (public) ───────────────────────────┤
    │  POST /auth/refresh (public) ─────────────────────────┤
    │  POST /auth/logout (auth-gated) ──────────────────────┤
    │  POST /auth/forgot-password (public) ─────────────────┤  Fastify API
    │  POST /auth/reset-password (public) ──────────────────┤  (apps/api)
    │  GET  /account/profile (customer role) ───────────────┤
    │  PATCH /account/profile (customer role) ──────────────┤
    │  GET  /account/addresses (customer role) ─────────────┤
    │  POST /account/addresses (customer role) ─────────────┤
    │  PATCH /account/addresses/:id (customer role) ─────────┤
    │  DELETE /account/addresses/:id (customer role) ────────┘
    │
    │  Google Maps JS API (lazy-loaded, places library)
    └──► Google Places Autocomplete (browser ↔ Google CDN)

Fastify API (apps/api)
    │
    ├── CustomerAuthService  (argon2 + jose, role="customer")
    │       ↓
    │   customers table (PostgreSQL)
    │   password_reset_tokens table (PostgreSQL)
    │       ↓
    │   nodemailer → Google SMTP (password reset email)
    │
    ├── HomepageService
    │       ↓
    │   homepage_blocks table (PostgreSQL, JSONB payload)
    │       ↓
    │   Redis cache ("homepage:blocks", TTL configurable)
    │
    └── CustomerAddressService
            ↓
        customer_addresses table (PostgreSQL)
```

### Recommended Project Structure (storefront)

```
apps/web-storefront/src/
├── router.tsx                    # React Router v7 createBrowserRouter() call
├── main.tsx                      # ReactDOM.createRoot + QueryClientProvider + RouterProvider
├── app.css                       # @import "tailwindcss"; @import "@grovio/ui/tokens";
│
├── components/                   # Shared/reusable UI components
│   ├── layout/
│   │   ├── Header.tsx            # Logo, search bar (desktop), account nav, cart placeholder
│   │   ├── Footer.tsx            # Link columns, copyright row
│   │   └── PageTransition.tsx    # Shared motion.div wrapper with initial/animate/exit
│   ├── ui/
│   │   ├── Skeleton.tsx          # Shimmer skeleton; accepts className for sizing
│   │   ├── FilterChip.tsx        # Active filter chip with × dismiss
│   │   ├── ProductCard.tsx       # PLP/homepage product card; whileHover lift
│   │   ├── Toast.tsx             # role="status"/"alert"; AnimatePresence slide-in
│   │   ├── Button.tsx            # Primary/secondary/destructive variants
│   │   └── Input.tsx             # Controlled input with error state
│   └── blocks/
│       ├── BannerBlock.tsx       # banner type renderer
│       ├── ProductGridBlock.tsx  # product_grid type renderer (grid or carousel)
│       ├── TextBlock.tsx         # text_block type renderer
│       └── FeaturedCategoriesBlock.tsx  # featured_categories renderer (new Phase 4)
│
├── pages/
│   ├── HomePage.tsx              # GET /homepage → block stack renderer
│   ├── CategoryPage.tsx          # /category/:slug — filter sidebar + PLP
│   ├── SearchPage.tsx            # /search — full PLP with all filter controls
│   ├── ProductDetailPage.tsx     # /products/:slug — PDP
│   ├── auth/
│   │   ├── SignupPage.tsx
│   │   ├── LoginPage.tsx
│   │   ├── ForgotPasswordPage.tsx
│   │   └── ResetPasswordPage.tsx
│   └── account/
│       ├── ProfilePage.tsx
│       └── AddressesPage.tsx
│
├── hooks/
│   ├── useAuth.ts                # Zustand auth slice + React Query session query
│   ├── useProductSearch.ts       # useInfiniteQuery wrapping GET /search
│   ├── useFilterState.ts         # useSearchParams → typed filter object
│   └── useInfiniteScroll.ts      # useInView sentinel + fetchNextPage orchestration
│
├── lib/
│   ├── api-client.ts             # fetch wrapper: credentials:'include', base URL from VITE_API_URL
│   └── query-client.ts           # QueryClient instantiation with defaults
│
└── store/
    └── ui-store.ts               # Zustand store: filterDrawerOpen, toasts[]
```

### Recommended Project Structure (new API modules)

```
apps/api/src/
├── db/schema/
│   ├── customers.ts              # customers table (mirrors vendors.ts pattern)
│   ├── password-reset-tokens.ts  # password_reset_tokens table
│   ├── customer-addresses.ts     # customer_addresses table
│   └── homepage-blocks.ts        # homepage_blocks table (JSONB payload, sort_order)
│
├── modules/
│   ├── customer-auth/
│   │   ├── CustomerAuthService.ts  # argon2 + jose; mirrors VendorAuthService
│   │   └── index.ts
│   ├── customer-addresses/
│   │   ├── CustomerAddressService.ts
│   │   └── index.ts
│   └── homepage/
│       ├── HomepageService.ts      # getBlocks() with Redis cache
│       └── index.ts
│
└── routes/
    ├── customer/
    │   └── auth.ts               # POST /auth/* (public)
    ├── account/
    │   ├── profile.ts            # /account/profile (customer role guard)
    │   └── addresses.ts          # /account/addresses (customer role guard)
    └── homepage.ts               # GET /homepage (public)
```

### Pattern 1: CustomerAuthService — Follow VendorAuthService Exactly

**What:** CustomerAuthService is a structural copy of VendorAuthService with `role:"customer"` and a `customers` table instead of `vendors`. All error classes, argon2 usage, jose JWT issuance, and Awilix registration patterns are identical.

**Key difference:** D-09 requires httpOnly cookies for the storefront, unlike VendorAuthService which returns the token in the JSON body. The route handler (not the service) sets the cookie via `reply.setCookie()`.

**Fastify cookie plugin required:** `@fastify/cookie` must be registered before the customer auth routes to enable `reply.setCookie()`. [ASSUMED — not yet in api/package.json; standard @fastify plugin]

```typescript
// Source: apps/api/src/modules/vendor-auth/VendorAuthService.ts (existing pattern)
// CustomerAuthService follows the same constructor injection and argon2/jose pattern:

export class CustomerAuthService {
  private readonly ACCESS_TTL_SECONDS = 3600;   // 1h — matches vendor auth TTL
  private readonly REFRESH_TTL_SECONDS = 604800; // 7d — long-lived refresh

  constructor(private deps: CustomerAuthServiceDeps) {}

  async register(email: string, password: string, name: string): Promise<RegisteredCustomer> {
    // same argon2.hash() + db.insert(customers) + 23505 → CustomerAlreadyExistsError pattern
  }

  async login(email: string, password: string): Promise<CustomerLoginResult> {
    // same argon2.verify() + SignJWT({ sub, role: "customer" }).sign(secret)
    // returns { accessToken, refreshToken, expiresIn }
    // route handler sets these as httpOnly cookies
  }

  async verifyToken(token: string): Promise<CustomerTokenPayload> {
    // same jwtVerify() + role guard (role !== "customer" throws)
  }
}
```

### Pattern 2: httpOnly Cookie Auth + CORS Configuration

**What:** D-09 requires httpOnly cookies. The API must set cookies on login/refresh and clear them on logout. The CORS config must allow credentials from the storefront origin.

**Critical:** `origin: '*'` with `credentials: true` is forbidden by the browser. Origin must be the exact storefront URL.

```typescript
// Source: @fastify/cors docs — fastify/fastify-cors README
// In apps/api/src/app.ts, register BEFORE all routes:

await fastify.register(cors, {
  origin: env.STOREFRONT_ORIGIN,  // e.g. "http://localhost:5173" in dev
  credentials: true,
  methods: ['GET', 'HEAD', 'PUT', 'PATCH', 'POST', 'DELETE'],
});

// In customer auth route handler — setting the cookie:
reply
  .setCookie('access_token', accessToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: ACCESS_TTL_SECONDS,
  })
  .setCookie('refresh_token', refreshToken, {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/auth/refresh',  // scoped: only sent to the refresh endpoint
    maxAge: REFRESH_TTL_SECONDS,
  })
  .send({ success: true, data: { expiresIn: ACCESS_TTL_SECONDS } });
```

[VERIFIED: @fastify/cors docs — github.com/fastify/fastify-cors; credentials + origin pattern]

### Pattern 3: Infinite Scroll with useInfiniteQuery + IntersectionObserver

**What:** D-05 requires infinite scroll implemented via `useInfiniteQuery`. The Phase 3 search contract already uses cursor-based pagination (`nextCursor`). This pattern threads the React Query cursor through the IntersectionObserver sentinel.

```typescript
// Source: TanStack Query official docs — tanstack.com/query/latest/docs/framework/react/guides/infinite-queries
// + react-intersection-observer docs — github.com/thebuilder/react-intersection-observer

import { useInfiniteQuery } from '@tanstack/react-query';
import { useInView } from 'react-intersection-observer';
import { useSearchParams } from 'react-router';

function ProductGrid() {
  const [searchParams] = useSearchParams();
  const q = searchParams.get('q') ?? '';
  const filters = searchParams.get('filters') ?? '';
  const sort = searchParams.get('sort') ?? 'relevance';

  const { ref: sentinelRef, inView } = useInView();

  const { data, fetchNextPage, hasNextPage, isFetchingNextPage, status } =
    useInfiniteQuery({
      queryKey: ['search', q, filters, sort],      // URL params drive re-fetch
      queryFn: ({ pageParam }) =>
        apiClient.get(`/search?q=${q}&filters=${filters}&sort=${sort}&limit=24&cursor=${pageParam ?? ''}`),
      initialPageParam: '',
      getNextPageParam: (lastPage) => lastPage.data.nextCursor ?? undefined,
    });

  useEffect(() => {
    if (inView && hasNextPage && !isFetchingNextPage) {
      fetchNextPage();
    }
  }, [inView, hasNextPage, isFetchingNextPage, fetchNextPage]);

  return (
    <>
      {data?.pages.flatMap(page => page.data.hits).map(hit => <ProductCard key={hit.id} product={hit} />)}
      <div ref={sentinelRef} aria-hidden="true" />
      {isFetchingNextPage && <LoadingSpinner />}
    </>
  );
}
```

[CITED: tanstack.com/query/latest/docs/framework/react/guides/infinite-queries]

### Pattern 4: URL-Serialized Filter State

**What:** D-06 requires all filter state in the URL. React Router v7's `useSearchParams` is the standard pattern. Zustand is used only for ephemeral UI state (drawer open/close) that does not belong in the URL.

**Critical rule from CONTEXT.md:** `useSearchParams` owns filter values; Zustand owns drawer open/closed state. Do not cross this boundary.

```typescript
// Source: React Router v7 docs — reactrouter.com
import { useSearchParams } from 'react-router';

function useFilterState() {
  const [searchParams, setSearchParams] = useSearchParams();

  const filters = useMemo(() => ({
    q: searchParams.get('q') ?? '',
    categoryId: searchParams.get('categoryId') ?? '',
    sort: searchParams.get('sort') ?? 'relevance',
    // Dynamic filter values stored as JSON in a single 'filters' param
    // to avoid URL explosion with many attributes
    activeFilters: JSON.parse(searchParams.get('filters') ?? '{}') as Record<string, string[]>,
  }), [searchParams]);

  const setFilter = useCallback((key: string, value: string | string[]) => {
    setSearchParams(prev => {
      const current = JSON.parse(prev.get('filters') ?? '{}');
      current[key] = value;
      prev.set('filters', JSON.stringify(current));
      return prev;
    }, { replace: true });  // replace: true — don't pollute browser history on each keypress
  }, [setSearchParams]);

  const clearFilters = useCallback(() => {
    setSearchParams(prev => {
      prev.delete('filters');
      return prev;
    });
  }, [setSearchParams]);

  return { filters, setFilter, clearFilters };
}
```

[CITED: reactrouter.com — useSearchParams API]

### Pattern 5: AnimatePresence Page Transitions

**What:** Framer Motion's `AnimatePresence` with `mode="wait"` enables page exit animations before the next page enters. The key to trigger re-animation is `location.pathname`.

**Critical gotcha:** `AnimatePresence` cannot directly wrap `<Outlet>` — it only detects direct children. Use a shared `<PageTransition>` wrapper component that each page mounts inside.

```typescript
// Source: motion/react docs + React Router v7 pattern
// In router.tsx:
import { createBrowserRouter, RouterProvider } from 'react-router';

// In App layout component:
import { useLocation } from 'react-router';
import { AnimatePresence } from 'motion/react';

function AppLayout() {
  const location = useLocation();
  return (
    <>
      <Header />
      <AnimatePresence mode="wait">
        <Routes location={location} key={location.pathname}>
          <Route index element={<HomePage />} />
          {/* ... */}
        </Routes>
      </AnimatePresence>
      <Footer />
    </>
  );
}

// PageTransition wrapper used by every page:
import { motion } from 'motion/react';

export function PageTransition({ children }: { children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 8 }}
      transition={{ duration: 0.25, ease: 'easeOut' }}
    >
      {children}
    </motion.div>
  );
}
```

[CITED: framer.com/motion/animate-presence — AnimatePresence mode="wait"]

### Pattern 6: Google Places Autocomplete (Lightweight)

**What:** AUTH-06 requires Google Places autocomplete for address entry. The recommended approach for Phase 4 is to use `@googlemaps/js-api-loader` (the official loader) to lazily load the Maps JS API with the `places` library, then attach a native `Autocomplete` instance to an `<input>` ref.

**Why not @vis.gl/react-google-maps:** That package is a full Maps SDK wrapper. For a single autocomplete input with no map display, `@googlemaps/js-api-loader` + a custom `PlacesAutocompleteInput` component is significantly lighter.

```typescript
// Source: developers.google.com/maps/documentation/javascript/load-maps-js-api
// + CONTEXT.md specifics note (structured address object output)

import { useEffect, useRef } from 'react';
import { Loader } from '@googlemaps/js-api-loader';

interface StructuredAddress {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  placeId: string;
}

interface PlacesAutocompleteInputProps {
  apiKey: string;
  onAddressSelect: (address: StructuredAddress) => void;
  value: string;
  onChange: (value: string) => void;
}

export function PlacesAutocompleteInput({ apiKey, onAddressSelect, value, onChange }: PlacesAutocompleteInputProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const autocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  useEffect(() => {
    const loader = new Loader({ apiKey, version: 'weekly', libraries: ['places'] });
    loader.load().then((google) => {
      if (!inputRef.current) return;
      autocompleteRef.current = new google.maps.places.Autocomplete(inputRef.current, {
        types: ['address'],
        fields: ['address_components', 'geometry', 'place_id'],
      });
      autocompleteRef.current.addListener('place_changed', () => {
        const place = autocompleteRef.current!.getPlace();
        // parse address_components into StructuredAddress
        onAddressSelect(parseAddressComponents(place));
      });
    });
    return () => google?.maps?.event?.clearInstanceListeners(autocompleteRef.current!);
  }, [apiKey]);

  return <input ref={inputRef} value={value} onChange={e => onChange(e.target.value)} />;
}
```

[CITED: developers.google.com/maps/documentation/javascript/load-maps-js-api]

### Pattern 7: homepage_blocks Table and GET /homepage

**What:** D-04 defines the `homepage_blocks` table and a public `GET /homepage` endpoint. The `HomepageService.getBlocks()` caches the result in Redis (same write-through invalidation pattern as `CategoryService.getTree()`).

```typescript
// Table schema (apps/api/src/db/schema/homepage-blocks.ts):
export const homepageBlocks = pgTable('homepage_blocks', {
  id: uuid('id').defaultRandom().primaryKey(),
  type: text('type').notNull(),         // 'banner' | 'product_grid' | 'text_block' | 'featured_categories'
  payload: jsonb('payload').notNull(),  // Validated against MerchandisingBlockSchema
  sortOrder: integer('sort_order').notNull().default(0),
  isActive: boolean('is_active').notNull().default(true),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});

// Route (apps/api/src/routes/homepage.ts):
// GET /homepage → HomepageService.getBlocks() → Redis cache → ordered is_active blocks
// Response: { success: true, data: { blocks: MerchandisingBlock[] } }
```

[ASSUMED — table design based on CONTEXT.md specifics and existing schema patterns]

### Anti-Patterns to Avoid

- **Filter values in Zustand:** Filter values belong in `useSearchParams` (URL). Zustand only holds ephemeral UI state (drawer open/closed, toast list). Mixing these causes back-navigation to not restore filter state — violating D-06.
- **`credentials: 'include'` without matching CORS config:** Setting `credentials: 'include'` on the frontend fetch without `Access-Control-Allow-Credentials: true` and a non-wildcard origin on the backend causes the browser to silently drop the cookie. The result is auth that works in development (same-origin) but fails in staging/production.
- **Hardcoded block positions on the homepage:** D-01 mandates the homepage renders blocks in admin-configured order. Any CSS that positions a specific block type (e.g., "banner always first") hardcodes layout and breaks the configuration-first model.
- **`origin: '*'` with `credentials: true` in CORS config:** The browser rejects this combination. [CITED: MDN — CORS with credentials]
- **`motion.div` wrapping `<Outlet>` for page transitions:** AnimatePresence only detects direct children. Use a `PageTransition` wrapper component inside each page route. [CITED: Framer Motion docs]
- **Storing filter state as JSON in multiple separate URL params:** Each attribute key as its own param causes URL explosion and makes clearing filters complex. Use a single `filters` param containing a JSON-serialized object.
- **Reading tokens from JavaScript after setting httpOnly cookie:** httpOnly cookies are intentionally unreadable by JS. The storefront should detect authentication state via a `/auth/me` endpoint (or by observing API 401 responses), not by reading cookie values.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| Intersection-based infinite scroll trigger | Custom useEffect + IntersectionObserver boilerplate | `react-intersection-observer` `useInView` | Handles ref merging, cleanup, disconnection, Vitest mock support |
| Google Maps script loading | Manual `<script>` injection in useEffect | `@googlemaps/js-api-loader` | Handles deduplication (safe to call `new Loader()` multiple times with same API key), Promise-based, version locking |
| Cookie manipulation in the browser | `document.cookie` parsing utils | httpOnly cookies via backend `Set-Cookie` — JS never touches them | httpOnly cookies are unreadable by JS by design; XSS protection |
| Password hashing in the frontend | Any client-side hash | Backend argon2 only — plain password in HTTPS POST body | Never hash on the client; salting and stretching are server-side concerns |
| Email sending | Custom SMTP client | `nodemailer` with Google SMTP | SMTP protocol handling, connection pooling, HTML/text part encoding |
| JWT verification in the browser | `jose` or `jsonwebtoken` in frontend code | Tokens in httpOnly cookies; backend verifies on each request | Client-side JWT verification is a security theater pattern; verification authority is always the server |
| Skeleton shimmer animation with JS | Framer Motion pulse | Tailwind `animate-pulse` CSS class | CSS animations run off the main thread; no JS overhead; UI-SPEC mandates this explicitly |
| URL state serialization | Custom history.pushState wrapper | `useSearchParams` from React Router | Handles encoding, decoding, browser history integration, SSR compatibility |

**Key insight:** The storefront has no genuine business logic on the client — it is a display and navigation layer. Every "smart" pattern (auth, pricing, search ranking, commission splits) lives in the backend. The client fetches, displays, and sends forms.

---

## Common Pitfalls

### Pitfall 1: useInfiniteQuery queryKey Stale on Filter Change

**What goes wrong:** When a user changes a filter or search query, the PLP shows the old infinite scroll results instead of resetting to page 1 with new results.
**Why it happens:** `useInfiniteQuery` only refetches from the beginning when its `queryKey` changes. If filter state is stored in Zustand (not in the URL / queryKey), the queryKey doesn't change when filters change.
**How to avoid:** Always include all filter parameters in the `queryKey` array: `queryKey: ['search', q, filters, categoryId, sort]`. Since these come from `useSearchParams`, URL changes automatically update the queryKey and trigger a reset.
**Warning signs:** PLP results don't update immediately when applying filters; old data lingers.

### Pitfall 2: CORS Credentials Misconfiguration

**What goes wrong:** Login succeeds on the API (returns 200), but the browser never stores the cookie. All subsequent authenticated requests fail with 401.
**Why it happens:** One of three things: (a) `origin: '*'` used with `credentials: true` — browser rejects this; (b) frontend fetch doesn't include `credentials: 'include'`; (c) `Access-Control-Allow-Credentials: true` header is missing from the API response.
**How to avoid:** The `@fastify/cors` registration must have `credentials: true` AND `origin: env.STOREFRONT_ORIGIN` (exact URL, not wildcard). Every fetch call from the storefront API client must include `credentials: 'include'` at the client level, not per-call.
**Warning signs:** Browser DevTools → Network tab shows `Set-Cookie` in response headers but no cookie appears in the Application tab cookies panel.

### Pitfall 3: AnimatePresence Exit Animations Not Firing

**What goes wrong:** Page transition only shows enter animation; exit animation is skipped. The new page instantly replaces the old.
**Why it happens:** `<AnimatePresence>` must be an ancestor of the element being removed AND the element must be a direct child of `AnimatePresence` with a stable `key` prop.
**How to avoid:** Pass `location` and `key={location.pathname}` to `<Routes>`. Use `mode="wait"` on `AnimatePresence`. Each page must use `<PageTransition>` (which is a `motion.div` with `initial`/`animate`/`exit`) as its root element.
**Warning signs:** Only fade-in, no fade-out; page jumps on navigation.

### Pitfall 4: Google Places Script Loaded Multiple Times

**What goes wrong:** Console error "You have included the Google Maps JavaScript API multiple times on this page." Google Maps API stops functioning.
**Why it happens:** If `PlacesAutocompleteInput` mounts/unmounts in rapid succession (e.g., address form in a sheet that opens/closes), each mount triggers a new `new Loader().load()` call.
**How to avoid:** `@googlemaps/js-api-loader` is designed to be called multiple times — it returns the same cached Promise if the API is already loaded. The deduplication is built in. However, always clean up the `place_changed` listener in `useEffect` cleanup to prevent memory leaks from multiple autocomplete instance listeners stacking up.
**Warning signs:** Console warnings about multiple script loads; place_changed event firing multiple times per selection.

### Pitfall 5: featured_categories Block Not Fetching Category Data

**What goes wrong:** `FeaturedCategoriesBlock` renders with empty or broken category cards because `categoryIds` in the block payload are not resolved to category names/images.
**Why it happens:** The `GET /homepage` endpoint returns `{ type: 'featured_categories', categoryIds: ['...'], ... }` — the block payload contains IDs, not resolved data. Category data must be fetched separately.
**How to avoid:** Per CONTEXT.md specifics note: `FeaturedCategoriesBlock` calls the existing `GET /categories` endpoint and filters by the IDs in the block payload. This can be a `useQuery(['categories'])` call that is already cached from the header category navigation — no extra API call in practice.
**Warning signs:** Category grid shows empty cards or UUID strings instead of names.

### Pitfall 6: Password Reset Token Cleanup Missing

**What goes wrong:** The `password_reset_tokens` table grows unboundedly with expired unused tokens.
**Why it happens:** Tokens are deleted on use but never cleaned up if the customer never clicks the link.
**How to avoid:** CONTEXT.md notes that expired tokens can be cleaned up either by a BullMQ periodic job OR by an on-next-use check (verify + delete if expired regardless of validity). The minimum viable approach is the on-next-use check (no separate job needed in Phase 4). A BullMQ cleanup job can be added in Phase 8 (notifications phase) when BullMQ is already wired.
**Warning signs:** `password_reset_tokens` table rows with `expires_at` in the past accumulating over time.

### Pitfall 7: httpOnly Refresh Token Path Scoping

**What goes wrong:** The refresh token cookie is sent with every API request (not just `/auth/refresh`), leaking the token surface area.
**Why it happens:** If `path: '/'` is set on the refresh token cookie, the browser sends it with all requests to the API origin.
**How to avoid:** Set `path: '/auth/refresh'` on the refresh token cookie. Only the refresh endpoint needs it. The access token can have `path: '/'` since it's needed for all authenticated routes.
**Warning signs:** DevTools shows `refresh_token` cookie sent in the `Cookie` header of non-refresh API requests.

### Pitfall 8: react-router v7 Import Path Confusion

**What goes wrong:** TypeScript errors: "Module 'react-router-dom' has no exported member 'useSearchParams'".
**Why it happens:** In react-router v7, `react-router-dom` simply re-exports from `react-router`. The canonical import source is now `react-router`. Both work at runtime, but type definitions may surface inconsistencies if mixing import paths.
**How to avoid:** Standardize on `import { ... } from 'react-router'` throughout the project. Install `react-router-dom` for backward compatibility but import from `react-router`.
**Warning signs:** TypeScript "has no exported member" errors on hooks that are clearly available at runtime.

---

## Code Examples

### API Client with Cookie Credentials

```typescript
// Source: CONTEXT.md established pattern + MDN fetch API
// apps/web-storefront/src/lib/api-client.ts

const BASE_URL = import.meta.env['VITE_API_URL'] as string;

export const apiClient = {
  async get<T>(path: string): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      credentials: 'include',    // D-09: sends httpOnly cookies with every request
      headers: { 'Content-Type': 'application/json' },
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  },

  async post<T>(path: string, body?: unknown): Promise<T> {
    const res = await fetch(`${BASE_URL}${path}`, {
      method: 'POST',
      credentials: 'include',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new ApiError(res.status, await res.json());
    return res.json();
  },
  // patch, delete follow same pattern
};
```

### extending the MerchandisingBlockSchema (packages/contracts/src/category/blocks.ts)

```typescript
// Source: packages/contracts/src/category/blocks.ts (existing file — D-02)
// Add FeaturedCategoriesBlock to the discriminated union — non-breaking extension

export const FeaturedCategoriesBlockSchema = z.object({
  type: z.literal('featured_categories'),
  title: z.string(),
  categoryIds: z.array(z.string().uuid()),
  layout: z.enum(['grid', 'row']),
});

export type FeaturedCategoriesBlock = z.infer<typeof FeaturedCategoriesBlockSchema>;

// Update the union (add to existing array — no other types changed):
export const MerchandisingBlockSchema = z.discriminatedUnion('type', [
  BannerBlockSchema,
  ProductGridBlockSchema,
  TextBlockSchema,
  FeaturedCategoriesBlockSchema,  // ← Phase 4 addition
]);
```

### Drizzle customers Table Schema

```typescript
// Source: apps/api/src/db/schema/vendors.ts (mirror pattern)
// apps/api/src/db/schema/customers.ts

import { pgTable, text, timestamp, uuid } from 'drizzle-orm/pg-core';

export const customers = pgTable('customers', {
  id: uuid('id').defaultRandom().primaryKey(),
  email: text('email').notNull().unique(),
  passwordHash: text('password_hash').notNull(),
  name: text('name').notNull(),
  archivedAt: timestamp('archived_at', { withTimezone: true }),
  createdAt: timestamp('created_at', { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp('updated_at', { withTimezone: true }).defaultNow().notNull(),
});
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| `react-router-dom` as separate package from `react-router` | v7: `react-router-dom` is a thin re-export; canonical source is `react-router` | RR v7 (Nov 2024) | Import from `react-router` for consistency |
| `exitBeforeEnter` on AnimatePresence | `mode="wait"` | Framer Motion v6 | Old prop is now a compile error — must use `mode="wait"` |
| PostCSS config for Tailwind | `@tailwindcss/vite` plugin (already set up in project) | Tailwind v4 | No `postcss.config.*` needed — already handled in `vite.config.ts` |
| `jsonwebtoken` for JWT | `jose` (already used in project for vendor auth) | Ongoing (training data is stale) | `jose` is already in use — no change needed |
| Webpack for web apps | Vite 8 (already set up) | Vite 8 / Rolldown | Already in place |

**Deprecated/outdated:**
- `framer-motion` package name: still published as `framer-motion@12.x` but import path is `motion/react` (not `framer-motion/react`). `App.tsx` already uses `import { motion } from 'motion/react'` correctly.
- `@googlemaps/loader` (old): deprecated in favor of `@googlemaps/js-api-loader`. Do not use the old package name.
- `react-router-dom` direct imports: still works but v7 canonical imports are from `react-router`.

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | `@fastify/cookie` is needed to enable `reply.setCookie()` in Fastify 5 | Pattern 2 / Standard Stack | If `@fastify/cookie` is already registered via another plugin, adding it again causes a duplicate plugin error |
| A2 | `STOREFRONT_ORIGIN` env var should be added to the API's `envSchema` to configure CORS origin | Pattern 2 | If the CORS origin is hardcoded instead, staging/production environments cannot be configured without code changes |
| A3 | `homepage_blocks` table uses `integer sort_order` — no pgEnum for block types | Pattern 7 | If block types need strict DB-level validation, a pgEnum or check constraint is needed; JSONB payload validation via Zod at the application layer is sufficient per existing patterns |
| A4 | The password reset email template can be a simple inline HTML string in Phase 4 | Pattern 1 | A more sophisticated template engine is not needed until Phase 9 |
| A5 | `nodemailer` needs `@types/nodemailer` as a dev dependency | Standard Stack | If `@types/nodemailer` ships bundled (unlikely for v8), the separate types install is unnecessary |
| A6 | `react-router-dom@7.16.0` / `react-router@7.16.0` — versions confirmed via WebSearch but not confirmed via official docs landing page with dated source | Standard Stack | Minor version may have advanced; planner should verify exact latest at install time |
| A7 | `lucide-react@1.17.0` — version confirmed via WebSearch | Standard Stack | Same caveat — verify at install time |

---

## Open Questions

1. **`@fastify/cookie` already registered?**
   - What we know: `apps/api/src/app.ts` shows only `drizzle`, `redis`, `opensearch`, and `awilix` plugins registered. No cookie plugin is visible.
   - What's unclear: Whether `@fastify/cookie` is already in `apps/api/package.json` as a transitive dependency or needs to be added explicitly.
   - Recommendation: Planner should add a task to verify/install `@fastify/cookie` before the customer auth route tasks.

2. **`STOREFRONT_ORIGIN` in API env config**
   - What we know: `apps/api/src/config/env.ts` does not currently have `STOREFRONT_ORIGIN`.
   - What's unclear: Whether to add a hard-coded dev default or require the env var.
   - Recommendation: Add `STOREFRONT_ORIGIN: z.string().url().default('http://localhost:5173')` to `envSchema` — matches the existing `PORT` defaulting pattern.

3. **`@types/nodemailer` bundled in nodemailer v8?**
   - What we know: CLAUDE.md states `nodemailer 8.0.x` as the standard; the package has `"MIT No Attribution" license, 15M+ weekly downloads`.
   - What's unclear: Whether `@types/nodemailer` is needed as a separate install or types are bundled in v8.
   - Recommendation: Planner should add a conditional task — install `@types/nodemailer` unless types are bundled.

---

## Environment Availability

| Dependency | Required By | Available | Version | Fallback |
|------------|------------|-----------|---------|----------|
| Node.js 22 LTS | Backend runtime | Verified in STATE.md | 24.16.0 (confirmed — argon2 note in STATE.md) | — |
| PostgreSQL | customer_addresses, customers, homepage_blocks tables | Verified via Neon (Phase 10 complete) | Cloud (Neon) | — |
| Redis | Homepage block cache, feature flags | Verified via Upstash (Phase 10 complete) | Cloud (Upstash) | — |
| Google Maps API Key | AUTH-06 Google Places autocomplete | Not checked — requires user to provide `GOOGLE_MAPS_API_KEY` | — | Skip address autocomplete if key not present; show plain text input with warning |
| Google SMTP credentials | AUTH-03 password reset email | Not checked — requires user to provide `SMTP_HOST`, `SMTP_USER`, `SMTP_PASS` | — | Log email to console in dev if SMTP not configured |

**Missing dependencies with no fallback:**
- None — all infrastructure (PostgreSQL, Redis) is confirmed operational from Phase 10.

**Missing dependencies with fallback:**
- Google Maps API Key: Required for AUTH-06. If not configured, `PlacesAutocompleteInput` falls back to a standard `<input type="text">` with a warning message. Planner should add a task to document `GOOGLE_MAPS_API_KEY` in `.env.example`.
- Google SMTP credentials: Required for AUTH-03. If not configured, nodemailer transport should log the reset link to the server console in non-production environments (dev-mode fallback). Planner should add this as a dev guard.

---

## Validation Architecture

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `apps/api/vitest.config.ts` (existing) |
| Quick run command | `pnpm --filter @grovio/api vitest run --reporter=dot` |
| Full suite command | `pnpm --filter @grovio/api vitest run` |

Note: No Vitest config exists for `apps/web-storefront` yet. Phase 4 backend tests follow the existing API test pattern. Frontend component tests are out of scope for Phase 4 (UI testing is manual via the running app per the UI-SPEC).

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| AUTH-01 | `CustomerAuthService.register()` hashes password, inserts customer, returns sanitized record | unit | `pnpm --filter @grovio/api vitest run src/modules/customer-auth/CustomerAuthService.test.ts` | Wave 0 |
| AUTH-01 | `CustomerAuthService.register()` throws `CustomerAlreadyExistsError` on duplicate email | unit | same file | Wave 0 |
| AUTH-02 | `CustomerAuthService.login()` verifies password + issues JWT with role="customer" | unit | same file | Wave 0 |
| AUTH-02 | `CustomerAuthService.login()` throws `InvalidCredentialsError` on wrong password (no enumeration) | unit | same file | Wave 0 |
| AUTH-02 | `CustomerAuthService.verifyToken()` rejects non-customer role tokens | unit | same file | Wave 0 |
| AUTH-03 | `CustomerAuthService` generates token, stores hash in `password_reset_tokens`, sends email | integration | `pnpm --filter @grovio/api vitest run src/modules/customer-auth/CustomerAuthService.test.ts` | Wave 0 |
| AUTH-03 | Reset endpoint rejects expired/used tokens | unit | same file | Wave 0 |
| STORE-01 | `HomepageService.getBlocks()` returns only `is_active=true` blocks in `sort_order` order | unit | `pnpm --filter @grovio/api vitest run src/modules/homepage/HomepageService.test.ts` | Wave 0 |
| AUTH-05 | `CustomerAddressService.listAddresses()` returns only addresses for the requesting customer | unit | `pnpm --filter @grovio/api vitest run src/modules/customer-addresses/CustomerAddressService.test.ts` | Wave 0 |

### Sampling Rate

- **Per task commit:** `pnpm --filter @grovio/api vitest run --reporter=dot` (fast; existing suite + new service tests)
- **Per wave merge:** `pnpm --filter @grovio/api vitest run` (full suite)
- **Phase gate:** Full backend suite green before `/gsd-verify-work`

### Wave 0 Gaps

- [ ] `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts` — covers AUTH-01, AUTH-02, AUTH-03
- [ ] `apps/api/src/modules/homepage/HomepageService.test.ts` — covers STORE-01
- [ ] `apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts` — covers AUTH-05 isolation

---

## Security Domain

> `security_enforcement: true`, `security_asvs_level: 1` per `.planning/config.json`.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | YES | argon2id password hashing (CustomerAuthService mirrors VendorAuthService); same InvalidCredentialsError for unknown email and wrong password (prevents user enumeration) |
| V3 Session Management | YES | httpOnly + Secure + SameSite=Lax cookies (D-09); refresh token scoped to `/auth/refresh` path; silent token rotation on refresh |
| V4 Access Control | YES | Customer role guard on `/account/*` routes; `verifyToken()` rejects non-customer role tokens; vendor/admin logins on separate apps (D-11) |
| V5 Input Validation | YES | All route body inputs validated via inline Zod schemas before reaching services (existing pattern from `vendor/auth.ts`) |
| V6 Cryptography | YES | `jose` HS256 JWT (already in use); argon2id for passwords; never `jsonwebtoken` (CLAUDE.md prohibition) |

### Known Threat Patterns for This Phase

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| User enumeration via auth error messages | Information Disclosure | `InvalidCredentialsError` thrown for both unknown email and wrong password — identical message and HTTP status (T-03-P1 pattern from VendorAuthService) |
| XSS token theft | Information Disclosure | httpOnly cookies — tokens unreadable by JavaScript (D-09) |
| CSRF on state-changing endpoints | Tampering | `SameSite=Lax` on cookies prevents most CSRF; `credentials: 'include'` requires explicit opt-in from the browser; consider `@fastify/csrf-protection` if strict ASVS L2 needed (out of scope for L1) |
| Expired reset token reuse | Elevation of Privilege | Single-use UUID tokens deleted on first use; `expires_at` check enforced before deletion (D-10) |
| Brute-force on `/auth/login` | Denial of Service | Not in scope for ASVS L1 Phase 4; note as pre-production concern; `@fastify/rate-limit` is the standard mitigation |
| Wildcard CORS with credentials | Information Disclosure | `origin` must be the exact storefront URL — never `*`; enforced in `@fastify/cors` registration |
| Stale access token after logout | Information Disclosure | Logout route must clear both `access_token` and `refresh_token` cookies via `reply.clearCookie()` with matching path/domain/sameSite attributes |
| Forged JWT role claim | Elevation of Privilege | `verifyToken()` enforces `role === "customer"` guard — vendor tokens cannot access customer routes |

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/modules/vendor-auth/VendorAuthService.ts` — argon2 + jose pattern (template for CustomerAuthService)
- `apps/api/src/routes/vendor/auth.ts` — Fastify route plugin pattern (template for customer auth routes)
- `apps/api/src/routes/categories.ts` — public route plugin pattern (template for GET /homepage)
- `apps/api/src/container.ts` — Awilix service registration pattern
- `apps/api/src/app.ts` — plugin registration order
- `packages/contracts/src/category/blocks.ts` — block discriminated union (Phase 4 extends this)
- `packages/contracts/src/auth.ts` — JwtPayload, AuthTokenPair schemas
- `packages/contracts/src/search/query.ts` — SearchResponse with nextCursor for useInfiniteQuery
- `apps/web-storefront/package.json` — confirmed existing dependencies
- `apps/web-storefront/vite.config.ts` — confirmed Tailwind v4 + @tailwindcss/vite setup
- `packages/ui/src/tokens/tokens.css` — confirmed @theme token definitions
- `.planning/phases/04-customer-storefront-web/04-UI-SPEC.md` — approved animation values, color classes, component patterns, accessibility contract

### Secondary (MEDIUM confidence)
- `@fastify/cors` v11.2.0 — confirmed via WebSearch + npm registry citation [CITED: npmjs.com/package/@fastify/cors]
- `react-router-dom` v7.16.0 — confirmed via WebSearch [CITED: npmjs.com/package/react-router-dom]
- `lucide-react` v1.17.0 — confirmed via WebSearch [CITED: npmjs.com/package/lucide-react]
- `react-intersection-observer` v10.0.3 — confirmed via WebSearch [CITED: npmjs.com/package/react-intersection-observer]
- `@googlemaps/js-api-loader` v2.0.2 — confirmed via WebSearch + Google Developers page [CITED: developers.google.com/maps/documentation/javascript/load-maps-js-api]
- TanStack Query `useInfiniteQuery` cursor pattern [CITED: tanstack.com/query/latest/docs/framework/react/guides/infinite-queries]
- Framer Motion AnimatePresence `mode="wait"` pattern [CITED: framer.com/motion/animate-presence]
- Google Places Autocomplete `field mask` + session token best practices [CITED: developers.google.com/maps/documentation/javascript/legacy/place-autocomplete]

### Tertiary (LOW confidence)
- `@fastify/cookie` needed for `reply.setCookie()` — [ASSUMED] based on Fastify ecosystem knowledge; verify before adding to package.json

---

## Metadata

**Confidence breakdown:**
- Standard Stack: HIGH — existing packages confirmed from `package.json`; new packages confirmed via WebSearch against npm registry
- Architecture: HIGH — all patterns derived directly from existing codebase code
- Auth patterns: HIGH — directly follows VendorAuthService template in same codebase
- Pitfalls: HIGH — derived from specific decisions (D-05, D-06, D-09) and cross-referenced against official docs
- Google Places integration: MEDIUM — `@googlemaps/js-api-loader` confirmed official; implementation detail is derived from official docs example

**Research date:** 2026-06-01
**Valid until:** 2026-07-01 (stable stack; 30-day window; react-router, framer-motion are fast-moving but breaking changes are unlikely within this window)
