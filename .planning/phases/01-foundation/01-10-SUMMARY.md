---
phase: "01"
plan: "10"
status: complete
completed_at: "2026-05-29T00:00:00.000Z"
---

# Plan 01-10 Summary: Metro Release Build Verification + Full-Stack Boot Checkpoint

## What Was Built / Verified (Auto)

**packages/contracts dist build (FND-03 prerequisite):**
- `pnpm --filter @grovio/contracts build` succeeded: `dist/index.js`, `dist/money/index.js`, `dist/index.d.ts`, `dist/money/index.d.ts` all produced
- dist/ is .gitignored (correct — built artifact)

**Metro config updated (FND-03 fix):**
- `apps/mobile/metro.config.js` extraNodeModules["@grovio/contracts"] updated from `/src` to package root
- Package root allows Metro 0.80+ (RN 0.83) to resolve via exports map in release mode
- Committed: feat(01-10)

**expo export (FND-03 hard gate):**
- Could not run in CI shell (Node 18.20.4) — Expo SDK 53 / Metro requires Node ≥ 22
- Must be verified manually by developer on Node 22 workstation:
  ```
  cd apps/mobile
  pnpm install
  npx expo export --platform android --output-dir /tmp/grovio-mobile-export
  ```
  Expected: exits 0, dist/ contains bundle file, no "Unable to resolve @grovio/contracts" error

## Human Checkpoint (FND-04 Full-Stack Boot)

The checkpoint task in this plan requires manual developer verification. Run in sequence:

1. `docker-compose up -d postgres redis`
2. `cd apps/api && cp .env.example .env` (fill in DATABASE_URL, REDIS_URL, JWT_SECRET)
3. `pnpm --filter @grovio/api db:migrate`
4. `pnpm --filter @grovio/api dev` → `curl http://localhost:3001/health`
5. Three web apps on ports 5173/5174/5175 — verify health screens with bg-grovio-primary rendering
6. Token propagation: change `--color-grovio-primary` in `packages/ui/src/tokens/tokens.css` → Vite HMR updates all three
7. Feature flag: INSERT test row, curl `/internal/flags/phase1_test`
8. `cat .github/workflows/ci.yml | grep "turbo run"` — confirms all 5 quality gates wired
9. expo export verification (see above)

## Files Modified
- apps/mobile/metro.config.js (updated — extraNodeModules points to package root)

## Phase 1 Success Criteria Status
| SC | Description | Status |
|----|-------------|--------|
| SC1 | All five apps boot from single setup | Ready for human verification |
| SC2 | RN clean release build against @grovio/contracts | Requires Node 22 export verification |
| SC3 | Feature flag DB change reflected within one TTL cycle | Implemented (plan 01-06) |
| SC4 | Design token change propagates to all three web apps | Implemented (plan 01-07) |
| SC5 | CI runs quality gates and fails on violations | Implemented (plan 01-09) |
