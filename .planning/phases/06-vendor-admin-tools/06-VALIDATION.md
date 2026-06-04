---
phase: 06
slug: vendor-admin-tools
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-04
---

# Phase 06 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grovio/api test --run` |
| **Full suite command** | `pnpm turbo run test --filter=@grovio/api` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grovio/api test --run`
- **After every plan wave:** Run `pnpm turbo run test --filter=@grovio/api`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 06-01-01 | contracts | 1 | VEN-01,ADM-01 | — | N/A | unit | `pnpm --filter @grovio/contracts test --run` | ❌ W0 | ⬜ pending |
| 06-02-01 | schema | 2 | VEN-01..VEN-06,ADM-01..ADM-07 | — | N/A | unit | `pnpm --filter @grovio/api test --run` | ❌ W0 | ⬜ pending |
| 06-03-01 | migration | 3 | All | T-06-01 | vendor_users FK integrity enforced | integration | manual db check | ❌ W0 | ⬜ pending |
| 06-04-01 | vendor-auth-migration | 4 | VEN-01,VEN-05 | T-06-02 | JWT sub=vendor_users.id; suspended vendor login rejected | unit | `pnpm --filter @grovio/api test --run -- vendor-auth` | ❌ W0 | ⬜ pending |
| 06-05-01 | admin-auth | 4 | ADM-01 | T-06-03 | admin JWT role check enforced; no cross-role access | unit | `pnpm --filter @grovio/api test --run -- admin-auth` | ❌ W0 | ⬜ pending |
| 06-06-01 | settings-service | 4 | ADM-05 | — | Redis cache invalidated on update | unit | `pnpm --filter @grovio/api test --run -- settings` | ❌ W0 | ⬜ pending |
| 06-07-01 | vendor-services | 5 | VEN-01..VEN-06 | — | N/A | unit | `pnpm --filter @grovio/api test --run -- vendor` | ❌ W0 | ⬜ pending |
| 06-08-01 | admin-services | 5 | MKT-04,MKT-05,ADM-02..ADM-07 | — | Payout append-only; audit_log written on sensitive actions | unit | `pnpm --filter @grovio/api test --run -- admin` | ❌ W0 | ⬜ pending |
| 06-09-01 | vendor-routes | 6 | VEN-01..VEN-06 | T-06-02 | role scope enforced per endpoint; staff cannot access financial data | manual | curl vendor endpoints | — | ⬜ pending |
| 06-10-01 | admin-routes | 6 | MKT-04,MKT-05,ADM-01..ADM-07 | T-06-03 | admin JWT required; no vendor JWT accepted | manual | curl admin endpoints | — | ⬜ pending |
| 06-11-01 | vendor-panel-shell | 7 | VEN-01 | — | N/A | manual | browser human-verify | — | ⬜ pending |
| 06-12-01 | admin-panel-shell | 8 | ADM-01 | — | N/A | manual | browser human-verify | — | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/vendor-auth/__tests__/VendorAuthService.test.ts` — stubs for VEN-01 vendor_users auth
- [ ] `apps/api/src/modules/admin-auth/__tests__/AdminAuthService.test.ts` — stubs for ADM-01 admin auth
- [ ] `apps/api/src/modules/settings/__tests__/SettingsService.test.ts` — stubs for ADM-05 marketplace settings
- [ ] `apps/api/src/modules/vendor-services/__tests__/VendorDashboardService.test.ts` — stubs for VEN-01 dashboard

*Existing Vitest infrastructure covers all phase requirements — no new install needed.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vendor panel sidebar collapse/expand on tablet | VEN-01 | UI interaction | Resize browser to 768px, verify icon-bar collapse |
| Admin panel login redirect on expired JWT | ADM-01 | Auth flow | Expire JWT, navigate to protected page, verify redirect to login |
| Staff invite email received | VEN-05 | Email delivery | Send invite, check email with test SMTP credentials |
| Vendor suspended — login rejected | ADM-02 | Auth enforcement | Suspend vendor in admin panel, attempt vendor login, expect 403 |
| Homepage Redis cache invalidated after block edit | ADM-04 | Cache behavior | Edit block, verify next GET /homepage returns updated data |
| Payout record is append-only | MKT-04 | DB integrity | Record settlement, verify no UPDATE on vendor_payouts table |
| Return approval triggers commission reversal | VEN-04,MKT-03 | Multi-service flow | Approve return in vendor panel, verify commission_entries has 'reversed' row |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
