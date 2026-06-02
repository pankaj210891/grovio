---
phase: 05-commerce-core
plan: 02
subsystem: payments
tags: [stripe, razorpay, payments, sdk, npm, pnpm]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: pnpm workspace monorepo structure, apps/api and apps/web-storefront packages
provides:
  - stripe@22.2.0 backend SDK in apps/api
  - razorpay@2.9.6 backend SDK in apps/api
  - "@stripe/stripe-js@9.7.0 browser SDK in apps/web-storefront"
  - "@stripe/react-stripe-js@6.5.0 React wrapper in apps/web-storefront"
affects: [05-03, 05-04, 05-05, 05-commerce-core]

# Tech tracking
tech-stack:
  added:
    - stripe@22.2.0 (api)
    - razorpay@2.9.6 (api)
    - "@stripe/stripe-js@9.7.0 (web-storefront)"
    - "@stripe/react-stripe-js@6.5.0 (web-storefront)"
  patterns:
    - Razorpay frontend uses CDN checkout.js — no npm package for browser
    - Payment provider SDKs isolated to apps/api; storefront only gets Stripe Elements

key-files:
  created: []
  modified:
    - apps/api/package.json
    - apps/web-storefront/package.json
    - pnpm-lock.yaml
    - packages/config/package.json (restored from git — pre-existing missing file)

key-decisions:
  - "Razorpay frontend checkout uses CDN script (https://checkout.razorpay.com/v1/checkout.js) — no npm package exists for browser"
  - "All four packages confirmed official SDKs via human-verify blocking gate before install"

patterns-established:
  - "Payment packages verified via blocking human checkpoint before any install (supply-chain mitigation)"

requirements-completed: [PAY-01, PAY-02, PAY-04]

# Metrics
duration: 15min
completed: 2026-06-03
---

# Phase 5 Plan 02: Install Payment SDKs Summary

**stripe@22.2.0 + razorpay@2.9.6 installed in api; @stripe/stripe-js@9.7.0 + @stripe/react-stripe-js@6.5.0 installed in web-storefront; both workspaces typecheck clean**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-06-03T00:00:00Z
- **Completed:** 2026-06-03T00:15:00Z
- **Tasks:** 1 (Task 1 was human-verified checkpoint, completed prior session; Task 2 executed here)
- **Files modified:** 4

## Accomplishments

- stripe@22.2.0 and razorpay@2.9.6 added to apps/api dependencies (backend payment infrastructure adapters only)
- @stripe/stripe-js@9.7.0 and @stripe/react-stripe-js@6.5.0 added to apps/web-storefront (Stripe Elements for checkout UI)
- No Razorpay frontend npm package added — Razorpay browser checkout loads from CDN per plan spec
- Both workspaces typecheck exit 0 after install

## Task Commits

Each task was committed atomically:

1. **Task 1: Package legitimacy verification** - APPROVED by human (prior session, no commit needed)
2. **Task 2: Install verified packages** - `cfeaf8a` (feat)

**Plan metadata:** (pending docs commit)

## Files Created/Modified

- `apps/api/package.json` - Added stripe@22.2.0 and razorpay@2.9.6 to dependencies
- `apps/web-storefront/package.json` - Added @stripe/stripe-js@9.7.0 and @stripe/react-stripe-js@6.5.0 to dependencies
- `pnpm-lock.yaml` - Updated lockfile reflecting all four new packages
- `packages/config/package.json` - Restored from git (was missing from disk, pre-existing issue)

## Decisions Made

- Razorpay browser checkout uses CDN script `https://checkout.razorpay.com/v1/checkout.js` — no npm package exists for the browser integration. This is the official Razorpay approach; only the server-side SDK (razorpay@2.9.6) is installed via npm.
- All four packages confirmed legitimate via human blocking gate before any install (supply-chain threat T-05-SC mitigation).

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Restored packages/config/package.json missing from disk**
- **Found during:** Task 2 (Install verified packages)
- **Issue:** `packages/config/` directory was empty on disk despite all files being tracked in git HEAD. pnpm rejected the install with `ERR_PNPM_WORKSPACE_PKG_NOT_FOUND: @grovio/config` because the package.json was absent. The remaining tracked files (eslint-preset.js, tsconfig files) were also missing.
- **Fix:** Wrote packages/config/package.json from git HEAD content, then used `git checkout -- packages/config/eslint-preset.js packages/config/tsconfig*.json packages/config/tsconfig/` to restore all remaining tracked files. Then ran `pnpm install --force` to rebuild node_modules symlinks (also partially cleared).
- **Files modified:** packages/config/package.json (restored)
- **Verification:** pnpm install succeeded; both workspace typechecks passed
- **Committed in:** cfeaf8a (part of task commit)

---

**Total deviations:** 1 auto-fixed (blocking)
**Impact on plan:** Required to unblock the install. Pre-existing environment issue (packages/config files deleted from working tree, not by this plan). No scope creep.

## Issues Encountered

- pnpm node_modules were also partially stale (typescript symlink pointed to empty directory). Resolved with `pnpm install --force` which rebuilt all symlinks from the pnpm content-addressable store. No packages needed to be downloaded — all were already in the store.

## User Setup Required

External services require manual configuration before payment flows can be tested:

**Stripe:**
- `STRIPE_SECRET_KEY` — Stripe Dashboard > Developers > API keys (test mode)
- `STRIPE_PUBLISHABLE_KEY` — Stripe Dashboard > Developers > API keys (test mode)
- `STRIPE_WEBHOOK_SECRET` — Stripe Dashboard > Developers > Webhooks > signing secret

**Razorpay:**
- `RAZORPAY_KEY_ID` — Razorpay Dashboard > Settings > API Keys (test mode)
- `RAZORPAY_KEY_SECRET` — Razorpay Dashboard > Settings > API Keys (test mode)
- `RAZORPAY_WEBHOOK_SECRET` — Razorpay Dashboard > Settings > Webhooks > secret

These are required by subsequent plans (05-03 PaymentProvider interface, 05-04 Stripe adapter, 05-05 Razorpay adapter).

## Next Phase Readiness

- Payment SDKs available — ready for 05-03 (PaymentProvider interface + DI registration)
- Stripe Elements components available in web-storefront — ready for 05-10 or later checkout UI plan
- No blockers; both workspaces typecheck clean

---
*Phase: 05-commerce-core*
*Completed: 2026-06-03*

## Self-Check: PASSED

- apps/api/package.json includes stripe and razorpay: FOUND
- apps/web-storefront/package.json includes @stripe/stripe-js and @stripe/react-stripe-js: FOUND
- No razorpay in apps/web-storefront/package.json: CONFIRMED (grep -c returns 0)
- pnpm-lock.yaml updated: FOUND
- Commit cfeaf8a: FOUND
- Both typechecks exit 0: CONFIRMED
