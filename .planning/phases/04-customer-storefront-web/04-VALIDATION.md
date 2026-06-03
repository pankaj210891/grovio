---
phase: 4
slug: customer-storefront-web
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-06-01
---

# Phase 4 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | vitest 4.x |
| **Config file** | `apps/api/vitest.config.ts` (backend), `apps/web-storefront/vite.config.ts` (frontend via vitest) |
| **Quick run command** | `pnpm --filter @grovio/api test --run` |
| **Full suite command** | `pnpm --filter @grovio/api test --run && pnpm --filter @grovio/web-storefront test --run` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grovio/api test --run`
- **After every plan wave:** Run `pnpm --filter @grovio/api test --run && pnpm --filter @grovio/web-storefront test --run`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 04-01-01 | 01 | 1 | AUTH-01 | — | N/A | unit | `pnpm --filter @grovio/api test --run` | ❌ W0 | ⬜ pending |
| 04-02-01 | 02 | 2 | AUTH-02 | — | CustomerAuthService rejects invalid credentials | unit | `pnpm --filter @grovio/api test --run` | ❌ W0 | ⬜ pending |
| 04-02-02 | 02 | 2 | AUTH-03 | — | Password reset token is single-use and expires | unit | `pnpm --filter @grovio/api test --run` | ❌ W0 | ⬜ pending |
| 04-03-01 | 03 | 2 | STORE-01 | — | N/A | unit | `pnpm --filter @grovio/api test --run` | ❌ W0 | ⬜ pending |
| 04-04-01 | 04 | 3 | STORE-02 | — | N/A | manual | — | N/A | ⬜ pending |
| 04-05-01 | 05 | 3 | STORE-03 | — | N/A | manual | — | N/A | ⬜ pending |
| 04-06-01 | 06 | 4 | STORE-04 | — | N/A | manual | — | N/A | ⬜ pending |
| 04-07-01 | 07 | 4 | STORE-05 | — | N/A | manual | — | N/A | ⬜ pending |
| 04-08-01 | 08 | 5 | AUTH-04 | — | N/A | manual | — | N/A | ⬜ pending |
| 04-09-01 | 09 | 5 | AUTH-05 | — | Google Places autocomplete output is a structured object | manual | — | N/A | ⬜ pending |
| 04-10-01 | 10 | 6 | STORE-06 | — | All pages pass keyboard navigation | manual | — | N/A | ⬜ pending |
| 04-10-02 | 10 | 6 | AUTH-06 | — | Auth pages pass keyboard navigation | manual | — | N/A | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/customer-auth/CustomerAuthService.test.ts` — unit tests for CustomerAuthService (argon2 hash, JWT sign/verify, token expiry) and AUTH-03 password reset token lifecycle (single-use + expiry)
- [ ] `apps/api/src/modules/homepage/HomepageService.test.ts` — unit tests for HomepageService (STORE-01: returns only `is_active=true` blocks in `sort_order` order)
- [ ] `apps/api/src/modules/customer-addresses/CustomerAddressService.test.ts` — unit tests for CustomerAddressService (AUTH-05: addresses isolated per requesting customer)

*Existing vitest infrastructure in `apps/api` covers the backend test runner. Frontend component tests will be added per-plan as components are built.*

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Homepage CMS blocks render correctly in browser | STORE-01 | Visual/layout verification | Visit `/`, confirm banner → product_grid → featured_categories → text_block order |
| PLP infinite scroll loads next page | STORE-02 | Scroll behavior requires browser | Scroll to bottom; confirm 24 more products load without explicit button |
| URL filter state preserved on back navigation | STORE-02 | Browser history behavior | Apply filters on PLP → click a PDP → press back → filters still active in URL |
| Type-ahead suggestions appear in search | STORE-03 | Requires browser + real API | Type 3+ chars in search bar; confirm dropdown suggestions appear |
| Dynamic attribute spec table on PDP | STORE-04 | Visual rendering of JSONB data | Open a PDP; confirm Specifications table shows category-specific attributes |
| Disabled Add to Cart button shake animation | STORE-05 | Visual animation feedback | Click disabled Add to Cart; confirm Framer Motion shake keyframes play |
| Google Places autocomplete on address form | AUTH-04 | Requires Google Maps API key | Open `/account/addresses`, add address, type street; confirm autocomplete suggestions |
| Session persists across browser refresh | AUTH-01 | Requires httpOnly cookie persistence | Log in; refresh page; confirm auth state retained in header |
| All pages pass keyboard navigation | STORE-06 | Manual tabbing required | Tab through each page; confirm focus rings visible and logical tab order |
| Contrast meets WCAG AA | STORE-06 | Visual inspection + contrast checker | Use browser DevTools accessibility check on muted text vs surface |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
</content>
