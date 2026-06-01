---
phase: 04-customer-storefront-web
plan: 06
subsystem: web-storefront
tags: [react-query, zustand, react-router, infinite-scroll, cookie-auth, url-state]

# Dependency graph
requires:
  - phase: 04-05
    provides: backend HTTP endpoints (/auth/*, /account/*, /homepage)

provides:
  - "apiClient: cookie-credentialed fetch wrapper (credentials:'include', D-09)"
  - "ApiError class with status + body for React Query retry discrimination"
  - "QueryClient with 2min staleTime; no retry on 401/403/404"
  - "useUiStore: Zustand store for filterDrawerOpen + toasts (D-06 boundary)"
  - "useFilterState: URL-serialized filter state via useSearchParams"
  - "useProductSearch: useInfiniteQuery with limit=24 (D-05, D-08)"
  - "useInfiniteScroll: react-intersection-observer sentinel"
  - "useAuth: session probe via GET /account/profile; never reads cookies (T-04-18)"

affects:
  - 04-06b-ui-kit-layout
  - 04-07-storefront-pages
  - 04-08-account-pages
  - phase-05-commerce-core

# Tech tracking
tech-stack:
  added:
    - "react-router-dom v7 (useSearchParams for URL filter state)"
    - "react-intersection-observer (useInView sentinel for infinite scroll)"
    - "zustand v5 (ui-store: filterDrawerOpen + toasts)"
    - "@tanstack/react-query useInfiniteQuery pattern"
    - "motion/react type shim (framer-motion v12 import path resolution)"
  patterns:
    - "credentials:'include' on all fetch calls (D-09 httpOnly cookie flow)"
    - "ApiError instanceof check in React Query retry (no retry on 401/403/404)"
    - "Single JSON-serialized 'filters' URL param (avoids URL explosion, RESEARCH.md Pattern 4)"
    - "All URL params in useInfiniteQuery queryKey (auto-reset to page 1 on filter change, Pitfall 1)"
    - "Session probe pattern: 200=authenticated, 401=unauthenticated (T-04-18)"
    - "Zustand holds ONLY ephemeral UI state; filter values live in URL (D-06)"

key-files:
  created:
    - apps/web-storefront/src/lib/api-client.ts
    - apps/web-storefront/src/lib/query-client.ts
    - apps/web-storefront/src/store/ui-store.ts
    - apps/web-storefront/src/hooks/useAuth.ts
    - apps/web-storefront/src/hooks/useFilterState.ts
    - apps/web-storefront/src/hooks/useProductSearch.ts
    - apps/web-storefront/src/hooks/useInfiniteScroll.ts
    - apps/web-storefront/src/motion-react.d.ts
  modified:
    - apps/web-storefront/src/main.tsx

key-decisions:
  - "Import from react-router-dom (not bare react-router) — react-router-dom v7 re-exports everything from react-router; using it as installed package avoids module resolution confusion"
  - "motion-react.d.ts shim maps motion/react → framer-motion for TypeScript; avoids installing separate 'motion' npm package"
  - "main.tsx .js extension added to App import — pre-existing NodeNext moduleResolution gap fixed as part of this plan to achieve typecheck exit 0"
  - "useAuth detects auth via session query / 401 responses, never document.cookie (T-04-18)"
  - "setSearchParams callbacks typed as URLSearchParams to avoid implicit any under strict mode"
  - "exactOptionalPropertyTypes: body uses null (not undefined) for BodyInit compatibility"

requirements-completed: [STORE-03, AUTH-02]

# Metrics
duration: 30min
completed: 2026-06-01
---

# Phase 4 Plan 06: Storefront Data Layer Summary

**Cookie-credentialed API client, React Query client, Zustand UI store, and four data hooks (useAuth, useFilterState, useProductSearch, useInfiniteScroll) — the data/contract foundation for the UI kit and Wave 6 pages**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-01
- **Tasks:** 1
- **Files created:** 9 (8 new + 1 modified)

## Accomplishments

- `api-client.ts`: fetch wrapper with `credentials: 'include'` on all methods (get/post/patch/delete); exports `ApiError` class carrying `status` and parsed error body; handles `exactOptionalPropertyTypes` compatibility by using `null` (not `undefined`) for optional body (D-09)
- `query-client.ts`: `QueryClient` with `staleTime: 2min`; retry function returns `false` for `ApiError` with 401/403/404 — definitive error codes never retry
- `ui-store.ts`: Zustand store with only `filterDrawerOpen` + `toasts` — no filter values (D-06 boundary strictly enforced)
- `useFilterState.ts`: `useSearchParams`-based hook; top-level params (q, categoryId, sort) + single JSON `filters` param for dynamic attribute filters; all mutations use `{ replace: true }` to avoid browser history pollution
- `useProductSearch.ts`: `useInfiniteQuery` with `limit=24` (D-08); queryKey includes all URL params so filter changes auto-reset to page 1 (Pitfall 1 guard)
- `useInfiniteScroll.ts`: wraps `react-intersection-observer` `useInView` (threshold 0.1); calls `fetchNextPage()` when `inView && hasNextPage && !isFetchingNextPage`; returns `sentinelRef`
- `useAuth.ts`: session probe via `GET /account/profile`; 401 → unauthenticated (not an error); never reads `document.cookie` (T-04-18); exposes `login`, `logout`, `signup` mutations
- `motion-react.d.ts`: type shim `declare module 'motion/react' { export * from 'framer-motion' }` — resolves pre-existing typecheck gap without an additional npm install
- `main.tsx`: fixed pre-existing `.js` extension on `App` import (NodeNext moduleResolution requirement)

## Task Commits

1. **Task 1: API client, query client, UI store, and data hooks** - `f06e8ea` (feat)

**Plan metadata:** _(docs commit — see below)_

## Files Created/Modified

- `apps/web-storefront/src/lib/api-client.ts` — cookie-credentialed fetch wrapper; ApiError class
- `apps/web-storefront/src/lib/query-client.ts` — QueryClient with staleTime + retry logic
- `apps/web-storefront/src/store/ui-store.ts` — Zustand store: filterDrawerOpen + toasts only
- `apps/web-storefront/src/hooks/useAuth.ts` — session probe; login/logout/signup mutations
- `apps/web-storefront/src/hooks/useFilterState.ts` — URL-serialized filter state
- `apps/web-storefront/src/hooks/useProductSearch.ts` — useInfiniteQuery with 24/page limit
- `apps/web-storefront/src/hooks/useInfiniteScroll.ts` — useInView sentinel
- `apps/web-storefront/src/motion-react.d.ts` — motion/react type shim
- `apps/web-storefront/src/main.tsx` — .js extension fix

## Decisions Made

- `react-router-dom` used as the import source (not bare `react-router`) — v7 re-exports everything; avoids module resolution edge cases with the installed package
- `motion-react.d.ts` type shim chosen over installing the `motion` npm package — keeps the dependency count minimal while achieving typecheck exit 0
- `exactOptionalPropertyTypes` required `body: null` (not `undefined`) in fetch calls — BodyInit type is `string | null`, not `string | undefined`
- `useAuth` typed `catch (err: unknown)` to satisfy strict TypeScript; instanceof guard on `ApiError` before accessing `.status`
- `setSearchParams` callback typed as `(prev: URLSearchParams) => URLSearchParams` to avoid implicit any under noImplicitAny

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed pre-existing typecheck failures blocking acceptance criterion**
- **Found during:** Task 1 verification
- **Issue:** `pnpm --filter @grovio/web-storefront typecheck` was already failing on App.tsx (`motion/react` module not found) and main.tsx (missing `.js` extension) before any plan changes
- **Fix:** Created `src/motion-react.d.ts` type shim; added `.js` extension to App import in main.tsx
- **Files modified:** `apps/web-storefront/src/motion-react.d.ts` (new), `apps/web-storefront/src/main.tsx`
- **Commit:** `f06e8ea`

**2. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes incompatibility in api-client.ts**
- **Found during:** Task 1 typecheck
- **Issue:** `body: body !== undefined ? JSON.stringify(body) : undefined` is incompatible with `BodyInit | null` under `exactOptionalPropertyTypes: true`
- **Fix:** Changed `undefined` to `null` for the empty-body case
- **Files modified:** `apps/web-storefront/src/lib/api-client.ts`
- **Commit:** `f06e8ea`

**3. [Rule 3 - Blocking] Used react-router-dom instead of react-router for imports**
- **Found during:** Task 1 typecheck
- **Issue:** `react-router` is not in the web-storefront's direct dependencies; `react-router-dom` is (and it re-exports everything from react-router in v7)
- **Fix:** Changed all hook imports to `react-router-dom`
- **Files modified:** `useFilterState.ts`, `useProductSearch.ts`
- **Commit:** `f06e8ea`

## Known Stubs

None — all data-layer modules call live endpoints or wrap real React Query / Zustand APIs.

## Threat Surface Scan

No new network endpoints or auth paths introduced. This plan is purely a frontend data layer. The threat mitigations from the plan's threat model are implemented:

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-04-18 | useAuth detects authentication via session query / 401; never reads document.cookie |
| T-04-19 | VITE_API_URL is build-time config; no business logic on the client |

## Self-Check: PASSED

- `apps/web-storefront/src/lib/api-client.ts` FOUND
- `apps/web-storefront/src/lib/query-client.ts` FOUND
- `apps/web-storefront/src/store/ui-store.ts` FOUND
- `apps/web-storefront/src/hooks/useAuth.ts` FOUND
- `apps/web-storefront/src/hooks/useFilterState.ts` FOUND
- `apps/web-storefront/src/hooks/useProductSearch.ts` FOUND
- `apps/web-storefront/src/hooks/useInfiniteScroll.ts` FOUND
- Commit `f06e8ea` FOUND
- `pnpm --filter @grovio/web-storefront typecheck` exits 0: CONFIRMED

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
