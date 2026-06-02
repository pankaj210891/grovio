---
phase: 04-customer-storefront-web
fixed_at: 2026-06-02T12:00:00Z
review_path: .planning/phases/04-customer-storefront-web/04-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 14
skipped: 0
status: all_fixed
---

# Phase 04: Code Review Fix Report

**Fixed at:** 2026-06-02T12:00:00Z
**Source review:** .planning/phases/04-customer-storefront-web/04-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (7 Critical, 8 Warning — note WR-03 and WR-08 addressed together)
- Fixed: 14 commits (WR-03 and WR-08 combined into one commit, both issues resolved)
- Skipped: 0

---

## Fixed Issues

### CR-01: Archived customers are not blocked from logging in

**Files modified:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts`
**Commit:** `b06ed18`
**Applied fix:** Added `if (customer.archivedAt !== null) { throw new InvalidCredentialsError(); }` in `login()` immediately after the null check for the customer row, before the argon2 hash verification. Uses the same `InvalidCredentialsError` to prevent account-existence enumeration (T-04-05).

---

### CR-02: Homepage Redis cache is trusted without re-validation

**Files modified:** `apps/api/src/modules/homepage/HomepageService.ts`
**Commit:** `52aa012`
**Applied fix:** Replaced the raw `JSON.parse(cached) as MerchandisingBlock[]` cast with a try/catch block that runs `raw.map((item) => MerchandisingBlockSchema.parse(item))`. On Zod parse failure, the corrupted cache key is deleted with `redis.del` and code falls through to the DB re-read path, enforcing T-04-11 on every code path.

---

### CR-03: `secure` cookie flag reads raw `process.env` instead of validated `env`

**Files modified:** `apps/api/src/routes/customer/auth.ts`
**Commit:** `f5bdb4a`
**Applied fix:** Added `import { env } from "../../config/env.js"` at the top of the route file. Replaced both `process.env["NODE_ENV"] === "production"` usages (in the login and refresh handlers) with `env.NODE_ENV === "production"`, using the validated config object as the single source of truth for this security-sensitive flag.

---

### CR-04: Password reset token expiry reuses the access-token TTL constant

**Files modified:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts`
**Commit:** `f0a9ae3`
**Applied fix:** Added a dedicated `private readonly RESET_TOKEN_TTL_SECONDS = 3600` class field with a JSDoc comment referencing D-10. Replaced the `forgotPassword()` expiry calculation to use `this.RESET_TOKEN_TTL_SECONDS` instead of `this.ACCESS_TTL_SECONDS`. The two constants share the same numeric value today but are now independently maintainable.

---

### CR-05: `PlacesAutocompleteInput` captures stale `onChange` and `onAddressSelect` in the Autocomplete closure

**Files modified:** `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx`
**Commit:** `892b812`
**Applied fix:** Added `onAddressSelectRef` and `onChangeRef` refs (using `useRef`) initialized to the initial prop values, with two `useEffect` hooks that keep each ref in sync with the current prop. The `place_changed` listener now calls `onChangeRef.current(...)` and `onAddressSelectRef.current(...)` instead of the closure-captured props, ensuring the latest callback is always invoked regardless of parent re-renders.

---

### CR-06: `CategoryPage` fires spurious search before categoryId syncs to URL

**Files modified:** `apps/web-storefront/src/pages/CategoryPage.tsx`
**Commit:** `e054149`
**Applied fix:** Added `const isGridReady = category != null && filters.categoryId === category.id;` derived value after the category resolution. Wrapped the `<ProductGrid>` render with `{isGridReady && <ProductGrid ... />}` so the search query is not issued until the URL's `categoryId` param matches the resolved category, eliminating the spurious uncategorized search on first render.

---

### CR-07: `mailer` silent no-op on partial SMTP configuration

**Files modified:** `apps/api/src/modules/mailer/mailer.ts`
**Commit:** `baeb392`
**Applied fix:** Refactored the SMTP detection to count configured vars (`configuredCount = smtpVars.filter(Boolean).length`). When `configuredCount > 0 && configuredCount < 3` (partial config), a `console.warn` is emitted at startup with a clear message naming all three required vars. The `isSmtpConfigured` flag now uses `configuredCount === 3` for clarity.

---

### WR-01: `customerId` non-null assertions without runtime safety guard

**Files modified:** `apps/api/src/routes/account/addresses.ts`, `apps/api/src/routes/account/profile.ts`
**Commit:** `e6a996d`
**Applied fix:** Added a `getCustomerId(request)` helper function in each route file that throws an `Error` with a descriptive message if `request.customerId` is falsy. All `request.customerId!` non-null assertions (4 in addresses.ts, 2 in profile.ts) were replaced with `getCustomerId(request)` calls.

---

### WR-02: Schema comment claims single-default enforcement that doesn't exist

**Files modified:** `apps/api/src/db/schema/customer-addresses.ts`
**Commit:** `df04c50`
**Applied fix:** Updated the `isDefault` column JSDoc comment to accurately state that multiple addresses may have `isDefault=true` in Phase 4, and that single-default enforcement is deferred to Phase 5. Removes the misleading claim that `CustomerAddressService` enforces this constraint.

---

### WR-03: `useAuth` logout does not clear user-specific cached queries

**Files modified:** `apps/web-storefront/src/hooks/useAuth.ts`
**Commit:** `ebd1e02`
**Applied fix:** Combined with WR-08 fix (same code block). Added `qc.removeQueries({ queryKey: ['account'] })` to the logout `onSuccess` handler, clearing all React Query cache entries under the `['account']` prefix (covers `['account', 'profile']` and `['account', 'addresses']`). This prevents stale account data from a previous session being briefly shown to a new user.

---

### WR-04: `BannerBlock` uses `<Link>` for CTA allowing open redirect to external URLs

**Files modified:** `apps/web-storefront/src/components/blocks/BannerBlock.tsx`
**Commit:** `e03ada6`
**Applied fix:** Added an external URL detection check: if `block.ctaUrl` starts with `http://` or `https://`, the CTA renders as `<a href={block.ctaUrl} rel="noopener noreferrer" target="_blank">`. Internal relative paths continue to use `<Link to={block.ctaUrl}>`. A JSX comment documents the security intent.

---

### WR-05: `ResetPasswordPage` submits form with empty token

**Files modified:** `apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx`
**Commit:** `e67f7ee`
**Applied fix:** Added `if (!hasToken) return;` as the first statement in `handleSubmit` after `e.preventDefault()`. This prevents a POST to `/auth/reset-password` with `token: ''` if the form is somehow submitted without a valid URL token.

---

### WR-06: `FilterSidebar` renders filter content in two DOM locations

**Files modified:** `apps/web-storefront/src/components/search/FilterSidebar.tsx`
**Commit:** `ed27b44`
**Applied fix:** Added `aria-hidden={filterDrawerOpen}` to the desktop `<aside>` element. When the mobile drawer is open, the desktop sidebar is hidden from the accessibility tree, preventing screen readers from encountering duplicate filter content. The mobile drawer already uses `role="dialog" aria-modal="true"` for correct modal semantics. A JSX comment documents the rationale.

---

### WR-07: `Skeleton` component sets nested `aria-busy="true"` duplicating announcements

**Files modified:** `apps/web-storefront/src/components/ui/Skeleton.tsx`
**Commit:** `7ebb85f`
**Applied fix:** Replaced the two-div wrapper structure (outer div with `aria-busy="true"` and `aria-label="Loading…"`, inner div with the pulse class) with a single `<div aria-hidden="true" className="... animate-pulse" />`. This removes the duplicated `aria-busy` from individual skeletons while keeping the element inert to screen readers. Calling pages retain responsibility for wrapping skeleton groups with `aria-busy="true"`.

---

### WR-08: `useAuth` logout triggers spurious re-fetch via `invalidateQueries`

**Files modified:** `apps/web-storefront/src/hooks/useAuth.ts`
**Commit:** `ebd1e02`
**Applied fix:** Combined with WR-03 fix (same code block). Removed the `void qc.invalidateQueries({ queryKey: ['session'] })` call from the logout `onSuccess` handler. `removeQueries` alone is sufficient — `invalidateQueries` was redundantly marking the session stale and triggering a background GET to `/account/profile` that immediately returns 401 after cookie clearing.

---

## Skipped Issues

None — all in-scope findings were successfully fixed.

---

_Fixed: 2026-06-02T12:00:00Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
