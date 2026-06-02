---
phase: 04-customer-storefront-web
reviewed: 2026-06-02T10:00:00Z
depth: standard
files_reviewed: 55
files_reviewed_list:
  - apps/api/src/app.ts
  - apps/api/src/config/env.ts
  - apps/api/src/container.ts
  - apps/api/src/db/schema/customer-addresses.ts
  - apps/api/src/db/schema/customers.ts
  - apps/api/src/db/schema/homepage-blocks.ts
  - apps/api/src/db/schema/index.ts
  - apps/api/src/db/schema/password-reset-tokens.ts
  - apps/api/src/middleware/customerAuth.ts
  - apps/api/src/modules/customer-addresses/CustomerAddressService.ts
  - apps/api/src/modules/customer-auth/CustomerAuthService.ts
  - apps/api/src/modules/homepage/HomepageService.ts
  - apps/api/src/modules/mailer/mailer.ts
  - apps/api/src/routes/account/addresses.ts
  - apps/api/src/routes/account/profile.ts
  - apps/api/src/routes/customer/auth.ts
  - apps/api/src/routes/homepage.ts
  - apps/web-storefront/src/components/PlacesAutocompleteInput.tsx
  - apps/web-storefront/src/components/blocks/BannerBlock.tsx
  - apps/web-storefront/src/components/blocks/BlockRenderer.tsx
  - apps/web-storefront/src/components/blocks/FeaturedCategoriesBlock.tsx
  - apps/web-storefront/src/components/blocks/ProductGridBlock.tsx
  - apps/web-storefront/src/components/blocks/TextBlock.tsx
  - apps/web-storefront/src/components/layout/AppLayout.tsx
  - apps/web-storefront/src/components/layout/Header.tsx
  - apps/web-storefront/src/components/layout/ProtectedRoute.tsx
  - apps/web-storefront/src/components/search/FilterSidebar.tsx
  - apps/web-storefront/src/components/search/ProductGrid.tsx
  - apps/web-storefront/src/components/search/SearchBar.tsx
  - apps/web-storefront/src/components/ui/Button.tsx
  - apps/web-storefront/src/components/ui/FilterChip.tsx
  - apps/web-storefront/src/components/ui/Input.tsx
  - apps/web-storefront/src/components/ui/ProductCard.tsx
  - apps/web-storefront/src/components/ui/Skeleton.tsx
  - apps/web-storefront/src/components/ui/Toast.tsx
  - apps/web-storefront/src/hooks/useAuth.ts
  - apps/web-storefront/src/hooks/useFilterState.ts
  - apps/web-storefront/src/hooks/useInfiniteScroll.ts
  - apps/web-storefront/src/hooks/useProductSearch.ts
  - apps/web-storefront/src/lib/api-client.ts
  - apps/web-storefront/src/lib/query-client.ts
  - apps/web-storefront/src/main.tsx
  - apps/web-storefront/src/pages/CategoryPage.tsx
  - apps/web-storefront/src/pages/HomePage.tsx
  - apps/web-storefront/src/pages/ProductDetailPage.tsx
  - apps/web-storefront/src/pages/SearchPage.tsx
  - apps/web-storefront/src/pages/account/AddressesPage.tsx
  - apps/web-storefront/src/pages/account/ProfilePage.tsx
  - apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx
  - apps/web-storefront/src/pages/auth/LoginPage.tsx
  - apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx
  - apps/web-storefront/src/pages/auth/SignupPage.tsx
  - apps/web-storefront/src/router.tsx
  - apps/web-storefront/src/store/ui-store.ts
findings:
  critical: 7
  warning: 8
  info: 4
  total: 19
status: issues_found
---

# Phase 04: Code Review Report

**Reviewed:** 2026-06-02T10:00:00Z
**Depth:** standard
**Files Reviewed:** 55
**Status:** issues_found

## Summary

This phase implements customer authentication (JWT httpOnly cookies, argon2id, password reset), customer address CRUD, homepage CMS blocks with Redis caching, and the React storefront (search, filter, PDP, auth pages, Google Places). The overall architecture is sound — auth isolation at the service layer, role-claim guards, no plaintext passwords — but several security-critical and correctness defects were found that must be addressed before shipping.

The most serious issues are: (1) the password reset TTL reuses the access-token TTL constant (effectively 1 hour not 1 hour, but this is a maintainability timebomb — the two are named identically), (2) the cookie `secure` flag is determined by a raw `process.env` read instead of the validated `env` object (inconsistency risk), (3) archived customers can still log in (the `archivedAt` field is never checked during login), (4) the homepage Redis cache deserialises stored JSON without re-validation (trusts Redis content), and (5) the `PlacesAutocompleteInput` keeps stale `onChange`/`onAddressSelect` callbacks inside the Autocomplete closure, so post-mount callback changes are silently dropped.

---

## Critical Issues

### CR-01: Archived customers are not blocked from logging in

**File:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts:192-210`
**Issue:** The `login()` method fetches the customer by email and verifies the password, but it never checks `customer.archivedAt`. A customer whose account has been soft-deleted can still obtain a valid JWT token pair. The schema documents the intent — "Archived customers cannot log in" — but the service does not enforce it.
**Fix:**
```typescript
const customer = rows[0];
if (!customer) {
  throw new InvalidCredentialsError();
}

// Enforce archived-account block (customers.archivedAt is set on soft-delete)
if (customer.archivedAt !== null) {
  throw new InvalidCredentialsError(); // same error — no enumeration
}

const isValid = await argon2.verify(customer.passwordHash, password);
```

---

### CR-02: Homepage Redis cache is trusted without re-validation

**File:** `apps/api/src/modules/homepage/HomepageService.ts:63`
**Issue:** On a cache hit the service returns `JSON.parse(cached) as MerchandisingBlock[]` directly — a raw cast with zero Zod validation. The design doc (T-04-11) states that Zod validation is the mitigation for JSONB tampering, but this protection only fires on a DB miss. If Redis is poisoned (compromised, corrupted, or a pre-migration cache from an old schema), the API silently serves malformed block data to every storefront visitor. The risk is real because Redis keys have a 300-second TTL and no integrity check.
**Fix:**
```typescript
const cached = await redis.get(this.cacheKey);
if (cached !== null) {
  try {
    const raw = JSON.parse(cached) as unknown[];
    // Re-validate to enforce T-04-11 even on cache hits
    return raw.map((item) => MerchandisingBlockSchema.parse(item));
  } catch {
    // Corrupted/stale cache — fall through to DB re-read
    await redis.del(this.cacheKey);
  }
}
```

---

### CR-03: `secure` cookie flag reads raw `process.env` instead of validated `env`

**File:** `apps/api/src/routes/customer/auth.ts:92,139`
**Issue:** Both the `/auth/login` and `/auth/refresh` handlers determine whether to set `secure: true` on cookies via `process.env["NODE_ENV"] === "production"`. The rest of the codebase reads from the validated `env` object (`import { env } from "../../config/env.js"`). If the environment is misconfigured (e.g. `NODE_ENV` is absent or misspelled), the two sources can diverge. More importantly, the `env` object is the single validated source of truth; bypassing it for a security-sensitive flag is inconsistent and fragile.
**Fix:**
```typescript
// In auth.ts — import env at the top
import { env } from "../../config/env.js";

// In handlers replace:
const isProduction = process.env["NODE_ENV"] === "production";
// With:
const isProduction = env.NODE_ENV === "production";
```

---

### CR-04: Password reset token expiry reuses the access-token TTL constant

**File:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts:287`
**Issue:** `forgotPassword()` computes the reset-token expiry as:
```typescript
const expiresAt = new Date(Date.now() + this.ACCESS_TTL_SECONDS * 1000);
```
`ACCESS_TTL_SECONDS` is `3600` (1 hour), so the current behaviour is accidentally correct. However, the code signals intent to use the access-token TTL for a completely different concern: password reset. A future engineer increasing `ACCESS_TTL_SECONDS` (e.g. to 4h or 8h) would silently extend reset token validity beyond the "1-hour expiry" documented everywhere in the schema and comments. This is a correctness bug waiting to happen.
**Fix:**
```typescript
/** Password reset token TTL: 1 hour (D-10). Separate from access token TTL. */
private readonly RESET_TOKEN_TTL_SECONDS = 3600;

// In forgotPassword():
const expiresAt = new Date(Date.now() + this.RESET_TOKEN_TTL_SECONDS * 1000);
```

---

### CR-05: `PlacesAutocompleteInput` captures stale `onChange` and `onAddressSelect` in the Autocomplete closure

**File:** `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx:97-104`
**Issue:** The `place_changed` event handler is attached once inside the `useEffect` that only runs when `apiKey` changes. It closes over the `onChange` and `onAddressSelect` props at mount time. These callbacks are intentionally excluded from the dependency array with an eslint-disable comment. If the parent re-renders and passes new callback instances (which is common — e.g. anonymous arrow functions in JSX), the stale closures are called. In `AddressesPage.tsx`, `handlePlaceSelect` is defined inside `AddressForm` which recreates it on every render. The result is that after the first render the autocomplete selection calls a stale `setValues` closure, silently discarding the selected address or applying it to an old component instance.
**Fix:** Use `useCallback` on `onAddressSelect` in the parent, OR use a ref to always call the latest callback:
```typescript
// In PlacesAutocompleteInput
const onAddressSelectRef = useRef(onAddressSelect);
const onChangeRef = useRef(onChange);
useEffect(() => { onAddressSelectRef.current = onAddressSelect; }, [onAddressSelect]);
useEffect(() => { onChangeRef.current = onChange; }, [onChange]);

// In the place_changed handler:
ac.addListener('place_changed', () => {
  const place = autocompleteRef.current?.getPlace();
  if (!place) return;
  const structured = parseAddressComponents(place);
  onChangeRef.current(structured.street);
  onAddressSelectRef.current(structured);
});
```

---

### CR-06: `CategoryPage` fires `setFilter('categoryId', …)` in an `useEffect` that triggers a search query before the URL is updated

**File:** `apps/web-storefront/src/pages/CategoryPage.tsx:60-64`
**Issue:** The `useEffect` syncs `category.id` into the URL's `categoryId` param. `useProductSearch` is running concurrently (via `ProductGrid`), reading `categoryId` from `useSearchParams`. On the first render after navigation to `/category/:slug`, the `categoryId` param is empty (the previous URL state), so `useProductSearch` fires a search with no `categoryId`. Only after the `useEffect` runs and `setSearchParams` triggers a re-render does the correct `categoryId` propagate to the search query. This causes a spurious uncategorized search request on every category page load — wrong data is fetched, then discarded.
**Fix:** Set `categoryId` in the URL at the navigation call site (in the `<Link>` or router push), or pass `categoryId` directly to `ProductGrid` as a prop rather than routing through URL state as a side-effect. Alternatively, render `ProductGrid` conditionally only after `categoryId` is in sync:
```typescript
// Only render the grid once the URL param is synced
const isReady = filters.categoryId === category?.id;
// ...
{isReady && <ProductGrid emptyStateType="category" categoryName={category.name} />}
```

---

### CR-07: `mailer` is typed as non-nullable `nodemailer.Transporter` in `CustomerAuthServiceDeps` but the transport is a no-op stub when SMTP is not configured

**File:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts:72` and `apps/api/src/modules/mailer/mailer.ts:46`
**Issue:** When SMTP is not configured, `createMailerTransport` returns a `jsonTransport` stub and `CustomerAuthService.forgotPassword()` guards with `isSmtpConfigured` before calling `mailer.sendMail`. However, the type annotation `mailer: nodemailer.Transporter` and the container registration `asValue(createMailerTransport(env))` create a non-null contract at the type level. Any future caller that skips the `isSmtpConfigured` guard and calls `mailer.sendMail()` directly will silently send no email. The `jsonTransport` stub returns the serialized message JSON as the `info` object — no error is thrown — making the silent failure very hard to detect.

More critically, if `SMTP_HOST` is set but `SMTP_USER` or `SMTP_PASS` is missing (partial config), the transport is still a no-op stub, but the code path enters `if (isSmtpConfigured)` only if all three are set, so the `sendMail` is never called. There is no warning that SMTP is partially configured.
**Fix:** Add a startup warning when partial SMTP config is detected:
```typescript
export function createMailerTransport(env: Env): Mailer {
  const smtpVars = [env.SMTP_HOST, env.SMTP_USER, env.SMTP_PASS];
  const configuredCount = smtpVars.filter(Boolean).length;
  if (configuredCount > 0 && configuredCount < 3) {
    // Partial SMTP config — warn loudly at startup
    console.warn(
      '[mailer] Partial SMTP configuration detected. ' +
      'SMTP_HOST, SMTP_USER, and SMTP_PASS must ALL be set for email to work. ' +
      'Email will not be sent until all three are configured.'
    );
  }
  // ... rest unchanged
}
```

---

## Warnings

### WR-01: `customerId` is asserted non-null with `!` in route handlers without a safety guard

**File:** `apps/api/src/routes/account/addresses.ts:66,78,103,105,129` and `apps/api/src/routes/account/profile.ts:46,76`
**Issue:** Every handler accesses `request.customerId!` with a non-null assertion. The `requireCustomerAuth` preHandler sets this field on successful auth and returns 401 otherwise. However, if someone accidentally removes the `addHook("preHandler", requireCustomerAuth)` line, or registers an additional route without the hook, TypeScript would not catch it — `customerId` would be `undefined` at runtime but the `!` assertion silences the type checker. The middleware correctly guards the happy path but the code provides no runtime fallback if the invariant is broken.
**Fix:** Add a defensive runtime check at the top of each handler or in a shared helper:
```typescript
function getCustomerId(request: FastifyRequest): string {
  if (!request.customerId) {
    throw new Error('requireCustomerAuth must run before this handler');
  }
  return request.customerId;
}
```

---

### WR-02: `HomepageService` comment claims single-default enforcement — schema/service contradict this

**File:** `apps/api/src/db/schema/customer-addresses.ts:81-83`
**Issue:** The schema comment states "CustomerAddressService ensures at most one address per customer has this flag set." This is false — `CustomerAddressService` has no such enforcement; the comment in `CustomerAddressService.ts` (line 66-68) explicitly documents that multiple `isDefault=true` addresses are allowed in Phase 4. The schema comment misleads future developers into thinking there is a DB or service constraint that does not exist, which could cause incorrect assumptions in the Phase 5 checkout flow.
**Fix:** Update the schema comment to match reality:
```typescript
/**
 * Whether this is the customer's default delivery address.
 * NOTE (Phase 4): Multiple addresses may have isDefault=true.
 * Single-default enforcement is deferred to Phase 5 / checkout flow.
 * Defaults to false.
 */
isDefault: boolean("is_default").notNull().default(false),
```

---

### WR-03: `useAuth` logout does not clear user-specific cached queries beyond `['session']`

**File:** `apps/web-storefront/src/hooks/useAuth.ts:99-103`
**Issue:** The logout `onSuccess` handler calls `qc.invalidateQueries({ queryKey: ['session'] })` and `qc.removeQueries({ queryKey: ['session'] })`. However, `['account', 'profile']` and `['account', 'addresses']` cached data (loaded in `ProfilePage` and `AddressesPage`) are not cleared. After logout, if a new user logs in, stale data from the previous session may briefly appear in the account pages before the re-fetch completes (React Query serves stale data until invalidated).
**Fix:**
```typescript
onSuccess: () => {
  qc.removeQueries({ queryKey: ['session'] });
  qc.removeQueries({ queryKey: ['account'] }); // clears profile + addresses
},
```

---

### WR-04: `BannerBlock` uses `Link to={block.ctaUrl}` which allows open redirects to external URLs

**File:** `apps/web-storefront/src/components/blocks/BannerBlock.tsx:49`
**Issue:** `block.ctaUrl` is a CMS-supplied string from the database (admin-inserted). `react-router-dom`'s `<Link to={…}>` accepts both relative paths and absolute URLs. If an admin inserts `https://malicious.com` as `ctaUrl`, the banner CTA button navigates users to an external site with no warning. While this requires admin access, it is worth auditing: for a commercially sold product, buyers' admins (or compromised admin accounts) could redirect customers to phishing sites via homepage banners.
**Fix:** Validate that `ctaUrl` is either a relative path or matches the allowed domain before rendering it as a `<Link>`. If external links are intentional, use `<a href=… rel="noopener noreferrer">` instead of `<Link>` to make the navigation intent explicit:
```typescript
const isExternal = block.ctaUrl.startsWith('http://') || block.ctaUrl.startsWith('https://');
// ...
{block.ctaText && block.ctaUrl && (
  isExternal
    ? <a href={block.ctaUrl} rel="noopener noreferrer"><Button variant="primary">{block.ctaText}</Button></a>
    : <Link to={block.ctaUrl}><Button variant="primary">{block.ctaUrl}</Button></Link>
)}
```

---

### WR-05: `ResetPasswordPage` submits the form when `token` is empty (no token guard before API call)

**File:** `apps/web-storefront/src/pages/auth/ResetPasswordPage.tsx:34,51-52`
**Issue:** `hasToken` is derived as `token.length > 0` and the form is not rendered when `!hasToken`. However the form submission logic in `handleSubmit` does not check `hasToken` — it directly posts `{ token, password }` where `token` is `''`. If a user navigates to the reset page without a token and manages to submit (e.g. the conditional rendering briefly shows the form during a state transition, or via automated testing), the API receives a valid-looking POST with an empty token string. The server will correctly return 400, but this is an unnecessary round-trip that should be guarded client-side.
**Fix:**
```typescript
async function handleSubmit(e: React.FormEvent) {
  e.preventDefault();
  if (!hasToken) return; // guard against edge-case submission with empty token
  // ...
}
```

---

### WR-06: `FilterSidebar` duplicates filter content into both desktop sidebar and mobile drawer, causing two copies of the same DOM

**File:** `apps/web-storefront/src/components/search/FilterSidebar.tsx:62-163`
**Issue:** `filterContent` is a JSX node that is rendered in two places: the desktop `<aside>` and the mobile drawer `<motion.div>`. Both are always in the DOM simultaneously on screens between `lg` breakpoint boundaries. Each copy independently calls `useQuery` (they share the same query key so React Query deduplicates the fetch, but both DOM trees are live). More importantly, the "Clear all" button, facet chips, and "Show Results" button appear twice in the DOM, meaning screen readers and tab navigation encounter them twice. The keyboard focus management only applies to the drawer copy.
**Fix:** Render only one copy at a time. Either use CSS `display: none` on the drawer when not mobile (and manage focus programmatically), or accept the current approach but use `aria-hidden="true"` on the desktop sidebar when the drawer is open and vice versa. The cleanest fix is to extract filter content into a separate component and render each instance only when it is the active view.

---

### WR-07: `Skeleton` component renders nested `aria-busy="true"` duplicating screen reader announcements

**File:** `apps/web-storefront/src/components/ui/Skeleton.tsx:15-16`
**Issue:** The `Skeleton` component itself sets `aria-busy="true"` on its outer `<div>`. In `ProfilePage`, `AddressesPage`, and `HomePage`, the parent loading containers also set `aria-busy="true"` on a wrapper div. This results in multiple nested `aria-busy` regions announcing simultaneously to assistive technology. Per ARIA spec, `aria-busy` on a container is sufficient — child elements should not repeat it.
**Fix:** Remove `aria-busy="true"` and `aria-label="Loading…"` from the `Skeleton` component itself. The calling page is already responsible for wrapping the skeleton group with `aria-busy`:
```typescript
export function Skeleton({ className = '' }: SkeletonProps) {
  return (
    <div
      className={`bg-grovio-border rounded-md animate-pulse ${className}`.trim()}
      aria-hidden="true"
    />
  );
}
```

---

### WR-08: `useAuth` logout `onSuccess` calls `invalidateQueries` AND `removeQueries` for `['session']` — `invalidateQueries` is redundant and triggers a background re-fetch of the deleted session

**File:** `apps/web-storefront/src/hooks/useAuth.ts:100-102`
**Issue:**
```typescript
void qc.invalidateQueries({ queryKey: ['session'] });
qc.removeQueries({ queryKey: ['session'] });
```
`invalidateQueries` marks the session query stale and triggers a background refetch. `removeQueries` then removes it from the cache. The order means React Query starts a `/account/profile` GET request (which will return 401 because the cookies are cleared) immediately after logout. This is a wasted request and a minor timing issue — on slow connections, the 401 could arrive before `removeQueries` completes, briefly marking auth state as errored rather than unauthenticated.
**Fix:** Remove the `invalidateQueries` call and keep only `removeQueries`:
```typescript
onSuccess: () => {
  qc.removeQueries({ queryKey: ['session'] });
  qc.removeQueries({ queryKey: ['account'] });
},
```

---

## Info

### IN-01: `console.log` in production path for dev fallback (password reset)

**File:** `apps/api/src/modules/customer-auth/CustomerAuthService.ts:315-319`
**Issue:** The dev SMTP fallback logs the raw reset link to the console via `console.log`. While intentional for local development, `console.log` in production code is a code quality concern — it should use `fastify.log` (injected as `logger` in the DI container) so the message goes through the structured logging pipeline with appropriate log levels. The `CustomerAuthService` already receives `env` via deps but not `logger`.
**Fix:** Add `logger` to `CustomerAuthServiceDeps` and use `this.deps.logger.info(...)` for the dev fallback, or accept the current approach as a known tradeoff with a comment.

---

### IN-02: `api-client.ts` sends `Content-Type: application/json` on GET requests

**File:** `apps/web-storefront/src/lib/api-client.ts:40`
**Issue:** The `get()` method sends `Content-Type: application/json` in the headers. GET requests have no body; this header is semantically meaningless and some strict servers/proxies may reject or log it as unusual. It is harmless in practice but is dead code.
**Fix:** Remove `'Content-Type': 'application/json'` from the `get()` and `delete()` methods where no body is sent.

---

### IN-03: `ProductGridBlock` hardcodes `en-IN` / `INR` currency locale

**File:** `apps/web-storefront/src/components/blocks/ProductGridBlock.tsx:32-38` and `apps/web-storefront/src/components/search/ProductGrid.tsx:30-35` and `apps/web-storefront/src/pages/ProductDetailPage.tsx:75-80`
**Issue:** Currency formatting is hardcoded to Indian Rupees (`INR`, `en-IN`) in three separate places. The project brief explicitly states this is a multi-vertical, rebrandable marketplace. Any buyer wanting to use USD, EUR, or GBP would need to manually find and patch all three formatting sites. This is a duplication and configurability concern.
**Fix:** Extract to a shared utility in `packages/contracts` or a storefront `lib/format.ts`:
```typescript
// lib/format.ts
export function formatPrice(priceMinor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(priceMinor / 100);
}
```
Long term, drive locale and currency from a config/feature-flag endpoint.

---

### IN-04: `ForgotPasswordPage` holds a dead state variable `generalError` / `setGeneralError` that is never set

**File:** `apps/web-storefront/src/pages/auth/ForgotPasswordPage.tsx:19,38`
**Issue:** `generalError` is declared as state and `setGeneralError('')` is called in the catch block, but it is never set to a non-empty string and the JSX rendering of `{generalError && ...}` can never show an error message. The catch block intentionally swallows all errors (by design, for non-enumeration). The dead state and the `generalError` display block are unreachable dead code that adds noise.
**Fix:** Remove `const [generalError, setGeneralError] = useState('')` and the `{generalError && ...}` JSX block. Remove the `setGeneralError('')` call in the catch block since all errors are intentionally silenced in this page.

---

_Reviewed: 2026-06-02T10:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
