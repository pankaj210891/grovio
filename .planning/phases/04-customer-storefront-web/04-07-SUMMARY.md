---
phase: 04-customer-storefront-web
plan: 07
subsystem: web-storefront
tags: [react-query, auth, google-places, framer-motion, tailwind-v4, address-management, httpOnly-cookies]

# Dependency graph
requires:
  - phase: 04-06
    provides: "apiClient, useAuth, useUiStore, ApiError"
  - phase: 04-06b
    provides: "Button, Input, Skeleton, PageTransition, router, ProtectedRoute"

provides:
  - "SignupPage: POST /auth/signup; 409→email-exists; redirect / with toast"
  - "LoginPage: POST /auth/login; 401→generic message (T-04-20); redirect to intended path"
  - "ForgotPasswordPage: POST /auth/forgot-password; always shows Check-your-email (no enumeration)"
  - "ResetPasswordPage: reads token from URL (D-10); expired/used link detection; redirect /auth/login with toast"
  - "ProfilePage: GET+PATCH /account/profile; email read-only; form skeleton; success toast"
  - "AddressesPage: full address CRUD; empty state; PlacesAutocompleteInput on street field; delete dialog"
  - "PlacesAutocompleteInput: @googlemaps/js-api-loader v2 importLibrary API; StructuredAddress output; clearInstanceListeners cleanup; plain-input fallback without API key"

affects:
  - phase-05-commerce-core
  - 04-08-browse-pages

# Tech tracking
tech-stack:
  added:
    - "@googlemaps/js-api-loader v2 (setOptions + importLibrary API)"
    - "/// <reference types='@types/google.maps' /> triple-slash ref for global google namespace"
    - "AnimatePresence + motion.div for address form slide-in and delete dialog scale animation"
  patterns:
    - "T-04-20 compliance: single generic error 'Incorrect email or password' (no enumeration of which field)"
    - "T-04-21 compliance: reset token forwarded from URL param → server; never generated client-side"
    - "Forgot-password always shows success state (registered/unregistered emails indistinguishable)"
    - "exactOptionalPropertyTypes: optional props typed as 'string | undefined' (not just optional marker)"
    - "useEffect destroyed flag guards against async race on Autocomplete mount/unmount"
    - "React Query invalidateQueries after every mutation (no stale address/profile data)"

key-files:
  created:
    - apps/web-storefront/src/components/PlacesAutocompleteInput.tsx
  modified:
    - apps/web-storefront/src/pages/auth/SignupPage.tsx
    - apps/web-storefront/src/pages/auth/LoginPage.tsx
    - apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx
    - apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx
    - apps/web-storefront/src/pages/account/ProfilePage.tsx
    - apps/web-storefront/src/pages/account/AddressesPage.tsx
    - apps/web-storefront/src/components/ui/Input.tsx

key-decisions:
  - "@googlemaps/js-api-loader v2 uses setOptions()+importLibrary() not new Loader().load() — the Loader class is deprecated in v2 with no .load() method"
  - "Triple-slash reference types='@types/google.maps' on component file (not tsconfig types array) — minimal non-breaking approach when tsconfig types=['vite/client']"
  - "Forgot-password swallows server errors silently and always shows the confirmation — prevents email enumeration (T-04-20)"
  - "ForgotPasswordPage triggers success state in finally block (not in try) — ensures the UI always advances even on network error"
  - "AddressesPage.FieldErrors is a dedicated interface (not Partial<Record<keyof AddressFormValues, string>>) — required by exactOptionalPropertyTypes since lat/lng are number fields"
  - "PlacesAutocompleteInput.APIOptions uses .v not .version — @googlemaps/js-api-loader v2 types use the abbreviated key"

requirements-completed: [AUTH-01, AUTH-02, AUTH-03, AUTH-05, AUTH-06]

# Metrics
duration: 30min
completed: 2026-06-01
---

# Phase 4 Plan 07: Auth and Account Pages Summary

**Full customer auth and account experience: signup, login (httpOnly cookie session), forgot/reset password, profile editing, and address management with Google Places autocomplete**

## Performance

- **Duration:** ~30 min
- **Completed:** 2026-06-01
- **Tasks completed before checkpoint:** 3 of 3 (Task 4 is human verification)
- **Files created:** 1 (PlacesAutocompleteInput.tsx), **Modified:** 7

## Accomplishments

**Task 1 — Auth pages (signup, login, forgot-password, reset-password):**

- `SignupPage.tsx`: email + password (min 8) + name; CTA "Create Account"; on success → redirect `/` with success toast; 409 → "An account with this email already exists. Sign in instead."; weak password → "Password must be at least 8 characters."
- `LoginPage.tsx`: email + password; CTA "Sign In"; on success → redirect to intended path or `/` (preserves D-09 session state); 401 → "Incorrect email or password. Please try again." (T-04-20: single generic message, no field enumeration)
- `ForgotPasswordPage.tsx`: email field; CTA "Send Reset Link"; always shows "Check your email — we've sent a reset link to [email]" regardless of success/error (no enumeration; T-04-20)
- `ResetPasswordPage.tsx`: reads `token` from `useSearchParams` (D-10); CTA "Update Password"; on success → redirect `/auth/login` with toast "Password updated. You can now sign in."; expired/used → "This link has expired or has already been used. Request a new reset link." + link to `/auth/forgot-password`
- All pages: `<PageTransition>` root, single `<h1>`, `htmlFor`/`id` label association, inline errors (`border-grovio-error` / `text-grovio-error`), loading spinner with "Please wait…"

**Task 2 — PlacesAutocompleteInput component:**

- Uses `@googlemaps/js-api-loader` v2 functional API: `setOptions({ key, v:'weekly' })` + `importLibrary('places')` (not deprecated `Loader.load()`)
- Attaches `google.maps.places.Autocomplete` with `fields: ['address_components', 'geometry', 'place_id']`
- `parseAddressComponents()` extracts street/city/state/pincode/country/lat/lng/placeId from address_components
- `clearInstanceListeners` in useEffect cleanup (Pitfall 4 — prevents listener stacking on remount)
- `destroyed` flag guards against async race condition on unmount before importLibrary resolves
- Fallback: renders shared `Input` + `console.warn` when `VITE_GOOGLE_MAPS_API_KEY` is absent
- Exports `StructuredAddress` interface for Phase 5 checkout reuse

**Task 3 — Account pages (profile, addresses):**

- `ProfilePage.tsx`: React Query `GET /account/profile`; editable name/phone (email read-only, `aria-readonly`); form Skeleton while loading; `PATCH /account/profile` on save; success toast "Profile updated."; mutation clears both `['account','profile']` and `['session']` queries so Header reflects name changes
- `AddressesPage.tsx`: React Query `GET /account/addresses`; empty state "No saved addresses" / "Add your first address" button; loaded: address cards with Edit/Delete buttons; add/edit: `AnimatePresence`-driven slide-in form with `PlacesAutocompleteInput` on street field (selecting a place auto-fills city/state/pincode/country/lat/lng/placeId); `POST /account/addresses` on add, `PATCH /account/addresses/:id` on edit; delete: confirmation dialog "Delete this address?" / "Keep it" / "Delete" (destructive) → `DELETE /account/addresses/:id`; loading: address card Skeletons

## Task Commits

1. **Task 1: Auth pages** - `26738b2` (feat)
2. **Task 2: PlacesAutocompleteInput** - `ef15ba2` (feat)
3. **Task 3: Account pages** - `c66fc51` (feat)

**Plan metadata:** _(docs commit — see below)_

## Files Created/Modified

- `apps/web-storefront/src/pages/auth/SignupPage.tsx` — create-account form
- `apps/web-storefront/src/pages/auth/LoginPage.tsx` — sign-in form with from-state redirect
- `apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx` — send-reset-link form (no enumeration)
- `apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx` — token-gated new password form
- `apps/web-storefront/src/pages/account/ProfilePage.tsx` — editable profile (name/phone)
- `apps/web-storefront/src/pages/account/AddressesPage.tsx` — full address CRUD with Places autocomplete
- `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` — Google Places wrapper + fallback
- `apps/web-storefront/src/components/ui/Input.tsx` — error prop typed as `string | undefined`

## Decisions Made

- `@googlemaps/js-api-loader` v2 requires `setOptions()` + `importLibrary('places')` — the `Loader` class still exists in v2 but has no `.load()` method (deprecated API removed)
- Triple-slash `/// <reference types="@types/google.maps" />` used in the component file because the base tsconfig restricts `types: ["vite/client"]` — adding globally would affect all components
- `APIOptions.v` (not `version`) — the v2 type uses the abbreviated query param key name
- `ForgotPasswordPage` advances to submitted state in `finally` block, not `try` — network errors are silently absorbed to prevent email enumeration
- `AddressesPage` uses a dedicated `FieldErrors` interface instead of `Partial<Record<keyof AddressFormValues, string>>` to satisfy `exactOptionalPropertyTypes` (lat/lng are `number`, not `string`)

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed Input.tsx error prop type incompatibility under exactOptionalPropertyTypes**
- **Found during:** Task 1 typecheck
- **Issue:** `error?: string` was not assignable from `string | undefined` under `exactOptionalPropertyTypes: true` — passing `errors.email` (type `string | undefined`) to `error` prop failed typecheck
- **Fix:** Changed prop type to `error?: string | undefined` in InputProps interface
- **Files modified:** `apps/web-storefront/src/components/ui/Input.tsx`
- **Commit:** `26738b2`

**2. [Rule 1 - Bug] Used @googlemaps/js-api-loader v2 functional API instead of deprecated Loader class**
- **Found during:** Task 2 typecheck
- **Issue:** `new Loader().load()` fails typecheck — v2's `Loader` class has no `.load()` method (deprecated API removed in v2)
- **Fix:** Used `setOptions({ key, v: 'weekly' }) + importLibrary('places')` (the v2 functional API)
- **Files modified:** `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx`
- **Commit:** `ef15ba2`

**3. [Rule 1 - Bug] Added triple-slash google.maps type reference**
- **Found during:** Task 2 typecheck
- **Issue:** `google` namespace not found — `@types/google.maps` is installed but excluded because tsconfig has `types: ['vite/client']`
- **Fix:** Added `/// <reference types="@types/google.maps" />` at top of `PlacesAutocompleteInput.tsx`
- **Files modified:** `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx`
- **Commit:** `ef15ba2`

**4. [Rule 1 - Bug] Fixed exactOptionalPropertyTypes incompatibilities in ProfilePage and AddressesPage**
- **Found during:** Task 3 typecheck
- **Issue:** `phone: phone.trim() || undefined` not assignable to `phone?: string` under `exactOptionalPropertyTypes`. Also `Partial<Record<keyof AddressFormValues, string>>` incompatible with state type since lat/lng are number fields
- **Fix:** Built update body with conditional property assignment; introduced `FieldErrors` interface with explicit `string | undefined` union types
- **Files modified:** `apps/web-storefront/src/pages/account/ProfilePage.tsx`, `apps/web-storefront/src/pages/account/AddressesPage.tsx`
- **Commit:** `c66fc51`

## Known Stubs

None — all pages are fully implemented with real API calls. The only remaining open item is human verification (Task 4 checkpoint).

## Threat Surface Scan

| Threat ID | Mitigation Status |
|-----------|------------------|
| T-04-20 | LoginPage: single generic "Incorrect email or password" message (no field enumeration). ForgotPasswordPage: always shows success state regardless of whether email is registered |
| T-04-21 | ResetPasswordPage: token is read from URL and forwarded as-is to POST /auth/reset-password; not generated client-side |
| T-04-22 | VITE_GOOGLE_MAPS_API_KEY is a public Maps JS API key; HTTP-referrer restriction documented for buyers (accepted risk per threat register) |

## Self-Check: PASSED

- `apps/web-storefront/src/pages/auth/SignupPage.tsx` FOUND
- `apps/web-storefront/src/pages/auth/LoginPage.tsx` FOUND
- `apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx` FOUND
- `apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx` FOUND
- `apps/web-storefront/src/pages/account/ProfilePage.tsx` FOUND
- `apps/web-storefront/src/pages/account/AddressesPage.tsx` FOUND
- `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` FOUND
- Commit `26738b2` FOUND (Task 1)
- Commit `ef15ba2` FOUND (Task 2)
- Commit `c66fc51` FOUND (Task 3)
- `pnpm --filter @grovio/web-storefront typecheck` exits 0: CONFIRMED
- `pnpm --filter @grovio/web-storefront build` exits 0: CONFIRMED

---
*Phase: 04-customer-storefront-web*
*Completed: 2026-06-01*
