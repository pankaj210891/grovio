---
phase: 5
slug: commerce-core
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-02
---

# Phase 5 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `vitest.config.ts` (root) |
| **Quick run command** | `pnpm --filter @grovio/api test --run` |
| **Full suite command** | `pnpm --filter @grovio/api test --run && pnpm --filter @grovio/contracts test --run` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grovio/api test --run`
- **After every plan wave:** Run `pnpm --filter @grovio/api test --run && pnpm --filter @grovio/contracts test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 60 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 05-xx-01 | TBD | TBD | CHK-01 | — | N/A | unit | `pnpm --filter @grovio/api test --run src/modules/basket` | ❌ W0 | ⬜ pending |
| 05-xx-02 | TBD | TBD | CHK-05 | T-05-01 | Inventory not reserved on basket add, only on checkout initiation | unit | `pnpm --filter @grovio/api test --run src/modules/inventory` | ❌ W0 | ⬜ pending |
| 05-xx-03 | TBD | TBD | PAY-03 | T-05-02 | Duplicate webhook delivery returns 200 without double-processing | unit | `pnpm --filter @grovio/api test --run src/modules/payment` | ❌ W0 | ⬜ pending |
| 05-xx-04 | TBD | TBD | WAL-05 | T-05-03 | Wallet is append-only; no balance direct-edit | unit | `pnpm --filter @grovio/api test --run src/modules/wallet` | ❌ W0 | ⬜ pending |
| 05-xx-05 | TBD | TBD | MKT-02 | — | Commission splits produce no rounding drift via allocate() | unit | `pnpm --filter @grovio/contracts test --run src/money` | ✅ | ⬜ pending |
| 05-xx-06 | TBD | TBD | MKT-03 | — | Partial-refund commission reversal uses item-level proration | unit | `pnpm --filter @grovio/api test --run src/modules/commission` | ❌ W0 | ⬜ pending |
| 05-xx-07 | TBD | TBD | ORD-02 | — | Multi-vendor order splits into correct vendor sub-orders | unit | `pnpm --filter @grovio/api test --run src/modules/order` | ❌ W0 | ⬜ pending |
| 05-xx-08 | TBD | TBD | CHK-03 | T-05-04 | Server-side totals cannot be overridden by client | unit | `pnpm --filter @grovio/api test --run src/routes/checkout` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/basket/__tests__/BasketService.test.ts` — stubs for CHK-01, CHK-02
- [ ] `apps/api/src/modules/inventory/__tests__/InventoryService.test.ts` — stubs for CHK-05, CHK-06 reservation timing
- [ ] `apps/api/src/modules/payment/__tests__/PaymentEventService.test.ts` — stubs for PAY-03 idempotency
- [ ] `apps/api/src/modules/wallet/__tests__/WalletService.test.ts` — stubs for WAL-01 through WAL-05
- [ ] `apps/api/src/modules/order/__tests__/OrderService.test.ts` — stubs for ORD-01, ORD-02 multi-vendor splitting
- [ ] `apps/api/src/modules/commission/__tests__/CommissionService.test.ts` — stubs for MKT-01, MKT-02, MKT-03

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Stripe PaymentElement renders in checkout payment step | PAY-01 | Requires browser + real Stripe test key | Load `/checkout/payment`, verify PaymentElement mounts, submit test card 4242 4242 4242 4242 |
| Razorpay checkout modal opens | PAY-02 | Requires browser + Razorpay CDN script load | Load `/checkout/payment`, click Razorpay option, verify modal opens |
| Guest basket merges on login | CHK-02 | Requires browser session state | Add items as guest, log in, verify basket contains guest items |
| Wallet credit applied correctly at checkout | WAL-03 | Requires browser + wallet balance | Apply partial wallet credit, verify card charge = total - wallet credit |
| 15-min reservation expiry releases stock | CHK-05 | Requires time-based BullMQ job | Create reservation, wait 15 min (or reduce TTL in test env), verify stock returns |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 60s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
