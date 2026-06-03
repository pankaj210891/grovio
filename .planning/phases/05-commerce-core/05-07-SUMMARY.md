---
phase: 05-commerce-core
plan: "07"
subsystem: payments
tags: [payments, stripe, razorpay, payment-provider, webhook, idempotency, abstraction]

# Dependency graph
requires:
  - plan: "05-02"
    provides: "stripe@22.2.0 and razorpay@2.9.6 installed in apps/api"
  - plan: "05-04"
    provides: "payment_events table with unique(provider, provider_event_id) constraint"
  - plan: "05-01"
    provides: "packages/contracts/src/payments/types.ts with ProviderPaymentOrderSchema"
provides:
  - "PaymentProvider interface: CreatePaymentOrderParams, ProviderPaymentOrder, WebhookEvent, ProviderNotConfiguredError"
  - "StripeAdapter: the ONLY file importing stripe SDK; constructEvent + paymentIntents.create"
  - "RazorpayAdapter: the ONLY file importing razorpay SDK; HMAC timingSafeEqual + orders.create"
  - "PaymentService: getEnabledProviders, getProvider, createPaymentOrder, recordWebhookEvent"
  - "15 passing PaymentService tests covering PAY-01 SDK guard, PAY-02 selection, PAY-03 idempotency"
affects:
  - "05-08 (BasketService), 05-09 (CheckoutService) — depend on PaymentService via DI"
  - "05-10 (webhook routes) — StripeAdapter/RazorpayAdapter used by webhook route handlers"
  - "apps/api/src/container.ts — PaymentService registered in Awilix DI (Phase 5 DI wiring plan)"

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "PaymentProvider interface pattern (Pitfall 9): all business logic depends on interface, not SDKs"
    - "SDK imports confined: stripe only in StripeAdapter.ts, razorpay only in RazorpayAdapter.ts"
    - "Stripe webhook: stripe.webhooks.constructEvent(rawBuffer, sig, secret) — HMAC + timestamp tolerance"
    - "Razorpay webhook: crypto.createHmac('sha256', secret).update(rawBuffer) + crypto.timingSafeEqual"
    - "Razorpay Pitfall 4: orders.create() REQUIRED before modal; providerOrderRef returned"
    - "Webhook idempotency: db.insert(paymentEvents).onConflictDoNothing({target:[provider, eventId]})"
    - "FastifyBaseLogger used (not pino directly) — matches established codebase pattern"
    - "Drizzle onConflictDoNothing({target}) confirmed working (proven in 05-04 probe)"

key-files:
  created:
    - apps/api/src/modules/payments/PaymentProvider.ts
    - apps/api/src/modules/payments/StripeAdapter.ts
    - apps/api/src/modules/payments/RazorpayAdapter.ts
    - apps/api/src/modules/payments/PaymentService.ts
    - apps/api/src/modules/payments/__tests__/PaymentService.test.ts
    - apps/api/src/modules/payments/index.ts
  modified: []

key-decisions:
  - "FastifyBaseLogger used instead of pino.Logger — pino types not in node_modules of this workspace"
  - "PaymentProvider.ts comment updated to avoid grep false-positives on SDK boundary check (plan verification grep)"
  - "SDK abstraction test uses async function with fileURLToPath for cross-platform Windows path resolution"
  - "index.ts exports only Task 1 files in Task 1 commit; PaymentService export added in Task 2 commit"

patterns-established:
  - "Pattern: PaymentProvider interface as the only payment dependency for business logic"
  - "Pattern: Adapter constructor receives SDK keys directly (not env object) for explicit dependency declaration"
  - "Pattern: recordWebhookEvent returns boolean (true=new, false=duplicate) for caller-side routing"

requirements-completed: [PAY-01, PAY-02, PAY-03, PAY-04]

# Metrics
duration: "~10 minutes"
completed: "2026-06-03"
---

# Phase 5 Plan 07: PaymentProvider Abstraction + Adapters + PaymentService Summary

**PaymentProvider interface + StripeAdapter + RazorpayAdapter (SDK imports confined) + PaymentService with config-based provider selection and idempotent webhook recording, covering PAY-01..04**

## Performance

- **Duration:** ~10 min
- **Started:** 2026-06-03T00:23:22Z
- **Completed:** 2026-06-03T00:33:38Z
- **Tasks:** 2
- **Files created:** 6

## Accomplishments

- PaymentProvider interface defined with `CreatePaymentOrderParams`, `ProviderPaymentOrder`, `WebhookEvent` canonical union, and `interface PaymentProvider { createPaymentOrder, handleWebhook, initiateRefund }` — zero SDK imports (PAY-01)
- StripeAdapter: only file in codebase importing `stripe`; uses `stripe.webhooks.constructEvent()` for HMAC + timestamp tolerance webhook verification (Pattern 4); creates PaymentIntents with `automatic_payment_methods: { enabled: true }` for 3DS/SCA
- RazorpayAdapter: only file in codebase importing `razorpay`; HMAC-SHA256 + `crypto.timingSafeEqual()` for webhook verification (Pattern 5); creates Razorpay orders (Pitfall 4: `order_id` returned as `providerOrderRef` for checkout modal)
- PaymentService: config-based adapter construction — adapters lazily built when env keys present; `getEnabledProviders()` reflects configured keys (PAY-02); `recordWebhookEvent()` uses `onConflictDoNothing()` on `(provider, provider_event_id)` for DB-level webhook idempotency (PAY-03, D-10)
- 15 tests covering: provider selection logic (4 env permutations), `getProvider` success + error cases, `recordWebhookEvent` first-insert (true) + duplicate (false) + correct values + onConflictDoNothing call, SDK abstraction guard (PAY-01 source check)
- SDK boundary verified: `grep -rln 'from "stripe"...'` returns ONLY `StripeAdapter.ts`; same for razorpay → only `RazorpayAdapter.ts`

## Task Commits

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | PaymentProvider interface + Stripe & Razorpay adapters (PAY-01) | 78cdbc5 | PaymentProvider.ts, StripeAdapter.ts, RazorpayAdapter.ts, index.ts |
| 2 | PaymentService provider selection + webhook idempotency (PAY-02, PAY-03) | b24b4fe | PaymentService.ts, __tests__/PaymentService.test.ts, index.ts (updated), PaymentProvider.ts (comment fix) |

## Verification

- `pnpm --filter @grovio/api test -- src/modules/payments` — **15/15 tests pass**
- `pnpm --filter @grovio/api typecheck` — passes for all new payment files (pre-existing `@aws-sdk/client-s3` error in ImageService.ts unrelated to this plan, present in main repo)
- SDK boundary grep: `from "stripe"` → only StripeAdapter.ts; `from "razorpay"` → only RazorpayAdapter.ts

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Windows node_modules junction missing in worktree**
- **Found during:** Task 1 verification (typecheck failed with "tsc not found")
- **Issue:** apps/api/node_modules was not present in the worktree — same issue encountered in 05-01
- **Fix:** Created Windows junction: `New-Item -ItemType Junction -Path worktree/node_modules -Target main/node_modules`
- **Files modified:** None (infrastructure fix)
- **Commit:** Not separately committed — infrastructure fix, not a code change

**2. [Rule 1 - Bug] pino Logger type not available — used FastifyBaseLogger instead**
- **Found during:** Task 2 typecheck
- **Issue:** `import type { Logger } from "pino"` failed — pino types not directly available; codebase uses `FastifyBaseLogger` from `fastify` package
- **Fix:** Changed PaymentService.ts logger type to `FastifyBaseLogger` — matches `apps/api/src/modules/jobs/workers.ts` established pattern
- **Files modified:** PaymentService.ts
- **Commit:** Part of b24b4fe

**3. [Rule 1 - Bug] SDK abstraction guard test path resolution failed on Windows**
- **Found during:** Task 2 test run
- **Issue:** `new URL(".", import.meta.url).pathname` produced double-prefixed path on Windows; test function needed to be `async` for `await import("node:url")`
- **Fix:** Changed test to `async`, used `fileURLToPath()` from `node:url` for cross-platform path resolution
- **Files modified:** __tests__/PaymentService.test.ts
- **Commit:** Part of b24b4fe

**4. [Rule 1 - Bug] PaymentProvider.ts comment text matched grep boundary check**
- **Found during:** Post-task-2 plan verification grep
- **Issue:** Comment `import Stripe from "stripe"` in PaymentProvider.ts matched the plan's `grep -rln 'from "stripe"'` verification command, creating a false positive
- **Fix:** Updated comment to not contain the literal import syntax
- **Files modified:** PaymentProvider.ts
- **Commit:** Part of b24b4fe

## Known Stubs

None — all interfaces, adapters, and service methods are fully implemented. No placeholder data or TODO comments.

## Threat Flags

No new security-relevant surface beyond what the plan's threat model covers:
- T-05-05 (webhook spoofing): Mitigated — StripeAdapter uses `constructEvent()`, RazorpayAdapter uses `crypto.timingSafeEqual()`
- T-05-02 (webhook tampering/replay): Mitigated — `recordWebhookEvent()` uses `onConflictDoNothing` on `(provider, provider_event_id)`
- T-05-PAY (SDK coupling): Mitigated — SDK imports verified confined to adapter files only

## Self-Check: PASSED

- [x] `apps/api/src/modules/payments/PaymentProvider.ts` — EXISTS
- [x] `apps/api/src/modules/payments/StripeAdapter.ts` — EXISTS
- [x] `apps/api/src/modules/payments/RazorpayAdapter.ts` — EXISTS
- [x] `apps/api/src/modules/payments/PaymentService.ts` — EXISTS
- [x] `apps/api/src/modules/payments/__tests__/PaymentService.test.ts` — EXISTS
- [x] `apps/api/src/modules/payments/index.ts` — EXISTS
- [x] Commit 78cdbc5 — EXISTS (Task 1)
- [x] Commit b24b4fe — EXISTS (Task 2)
- [x] `pnpm --filter @grovio/api test -- src/modules/payments` exits 0 — 15/15 PASS
- [x] `pnpm --filter @grovio/api typecheck` — only pre-existing aws-sdk error, new files type-clean
- [x] stripe import confined to StripeAdapter.ts only — VERIFIED (grep)
- [x] razorpay import confined to RazorpayAdapter.ts only — VERIFIED (grep)
- [x] PaymentService.ts has no stripe/razorpay SDK imports — VERIFIED (test + grep)

---
*Phase: 05-commerce-core*
*Completed: 2026-06-03*
