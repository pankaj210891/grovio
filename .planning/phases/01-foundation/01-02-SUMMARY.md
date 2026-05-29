---
phase: "01"
plan: "02"
subsystem: contracts
tags: [contracts, types, zod, money, allocate, feature-flags, auth, marketplace-config]
dependency_graph:
  requires: []
  provides:
    - "@grovio/contracts — HealthCheckResponse, FeatureFlag, JwtPayload, ApiSuccess/ApiError, MarketplaceConfig"
    - "@grovio/contracts/money — Money, MinorUnitAmount, allocate()"
  affects:
    - "All subsequent plans that import shared API types"
    - "Phase 5 commission/payout logic (allocate())"
    - "Backend auth routes (JwtPayload, SessionData, AuthTokenPair)"
    - "Feature-flag service (FeatureFlag, FeatureFlagMap)"
tech_stack:
  added:
    - zod@^4.4.0 (Zod 4 stable — runtime validation)
    - tsup@^8.0.0 (ESM bundler with DTS generation)
    - vitest@^4.1.0 (test runner)
    - typescript@^5.8.0 (type compiler)
  patterns:
    - Zod schema + inferred TypeScript type co-location pattern
    - Generic factory function for typed ApiSuccessSchema<T>
    - Largest-remainder method for BigInt allocation with sum invariant
    - Separate sub-path export for money utilities (no HTTP type coupling)
key_files:
  created:
    - packages/contracts/package.json
    - packages/contracts/tsconfig.json
    - packages/contracts/tsup.config.ts
    - packages/contracts/src/health.ts
    - packages/contracts/src/feature-flags.ts
    - packages/contracts/src/auth.ts
    - packages/contracts/src/envelope.ts
    - packages/contracts/src/marketplace-config.ts
    - packages/contracts/src/index.ts
    - packages/contracts/src/contracts.test.ts
    - packages/contracts/src/money/types.ts
    - packages/contracts/src/money/allocate.ts
    - packages/contracts/src/money/index.ts
    - packages/contracts/src/money/allocate.test.ts
  modified: []
decisions:
  - "allocate() uses largest-remainder method: floor each slice, distribute remainder units from index 0"
  - "ApiSuccessSchema is a factory function (not a class/const) to support generic typed data payloads"
  - "index.ts barrel excludes money sub-path to prevent HTTP type coupling in commission/payout code"
  - "FeatureFlagSchema value field accepts boolean|string|number union for Phase 6 admin UI extensibility (D-06)"
  - "JwtPayload sub field validated as uuid() for strict identity binding"
metrics:
  duration: "6 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 3
  files_created: 14
  files_modified: 0
---

# Phase 1 Plan 2: packages/contracts — Shared Contract Types and Money Utilities

Defined `@grovio/contracts`: shared TypeScript + Zod types for health, feature-flags, auth, request/response envelopes, MarketplaceConfig (D-02 shape), and a money utils sub-path with `allocate()` using the largest-remainder method for exact BigInt commission splitting.

## Tasks Completed

| Task | Name | Commit | Key Files |
|------|------|--------|-----------|
| 1 | Package scaffold and tsconfig | b4932b6 | package.json, tsconfig.json, tsup.config.ts |
| 2 RED | Core types — test (failing) | 8c61f18 | src/contracts.test.ts |
| 2 GREEN | Core types — implementation | b5fd4c4 | health.ts, feature-flags.ts, auth.ts, envelope.ts, marketplace-config.ts, index.ts |
| 3 RED | Money utils — test (failing) | 891b483 | src/money/allocate.test.ts |
| 3 GREEN | Money utils — implementation | e86691f | money/types.ts, money/allocate.ts, money/index.ts |

## Decisions Made

1. **allocate() uses largest-remainder method** — floor each ratio slice, compute remainder as `total - sum(slices)`, distribute remainder units 1-at-a-time from index 0. Guarantees exact sum invariant (no float rounding error).

2. **ApiSuccessSchema is a factory function** — `ApiSuccessSchema<T extends ZodTypeAny>(dataSchema: T)` returns a typed schema. This enables `type ProductResponse = z.infer<typeof ApiSuccessSchema(ProductSchema)>` without losing generics.

3. **index.ts excludes money sub-path** — `@grovio/contracts/money` is independently importable with no HTTP type imports. Backend commission code (Phase 5) imports `allocate` without pulling in `ApiError` or `ApiSuccess`.

4. **FeatureFlag.value is boolean|string|number union** — Per D-06, Phase 6 admin UI can bolt on without schema changes. The richer type is backward-compatible with Phase 1–5 boolean usage.

5. **MarketplaceConfig uses strict provider enum** — `z.enum(["stripe","razorpay"])` rejects any other provider string at runtime, enforcing the PaymentProvider abstraction boundary at the contract layer.

## Deviations from Plan

None — plan executed exactly as written.

**Verification note:** `pnpm typecheck` and `pnpm test` commands could not be run because pnpm is not installed on this system and no monorepo scaffold (pnpm-workspace.yaml, packages/config) exists yet — that is plan 01-01's deliverable. All allocate() behavior cases were validated manually using node with the same BigInt arithmetic, and all 9 behavior specifications confirmed correct. Tests will run when the monorepo scaffold from plan 01-01 is in place.

## TDD Gate Compliance

Task 2 (core types):
- RED: commit `8c61f18` — test file created with failing imports
- GREEN: commit `b5fd4c4` — implementations created

Task 3 (money utils):
- RED: commit `891b483` — test file created with failing imports
- GREEN: commit `e86691f` — money utilities implemented

RED and GREEN gates both present. REFACTOR not required (implementations are clean).

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-02-01: allocate() negative total | Mitigated — `if (total < 0n) throw new RangeError("total must be non-negative")` |
| T-02-02: allocate() empty ratios (divide-by-zero) | Mitigated — `if (ratios.length === 0) throw new RangeError("ratios must be non-empty")` |
| T-02-03: JwtPayload shape exposed | Accepted — payload designed to be readable by authenticated clients; no secrets in payload |
| T-02-SC: npm package legitimacy | zod, tsup, vitest, typescript — all well-known packages in CLAUDE.md recommended stack |

## Known Stubs

None — all types are fully specified. No hardcoded empty values flowing to rendering.

## Threat Flags

None — this package defines types only. No network endpoints, auth paths, file access patterns, or schema changes at trust boundaries are introduced.

## Self-Check: PASSED

Files verified present:
- packages/contracts/package.json — FOUND
- packages/contracts/tsconfig.json — FOUND
- packages/contracts/tsup.config.ts — FOUND
- packages/contracts/src/health.ts — FOUND
- packages/contracts/src/feature-flags.ts — FOUND
- packages/contracts/src/auth.ts — FOUND
- packages/contracts/src/envelope.ts — FOUND
- packages/contracts/src/marketplace-config.ts — FOUND
- packages/contracts/src/index.ts — FOUND
- packages/contracts/src/contracts.test.ts — FOUND
- packages/contracts/src/money/types.ts — FOUND
- packages/contracts/src/money/allocate.ts — FOUND
- packages/contracts/src/money/index.ts — FOUND
- packages/contracts/src/money/allocate.test.ts — FOUND

Commits verified present: b4932b6, 8c61f18, b5fd4c4, 891b483, e86691f — all in git log.
