---
phase: 3
slug: catalog-search
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-31
---

# Phase 3 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grovio/api test -- --reporter=verbose --run` |
| **Full suite command** | `pnpm --filter @grovio/api test` |
| **Estimated runtime** | ~30 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grovio/api test -- --run src/modules/catalog`
- **After every plan wave:** Run `pnpm --filter @grovio/api test`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 03-01 | catalog-contracts | 1 | PROD-01 | — | N/A | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ W0 | ⬜ pending |
| 03-02 | product-schema | 1 | PROD-03 | — | BIGINT price columns, no float | unit | `vitest run src/db/schema/products.test.ts` | ❌ W0 | ⬜ pending |
| 03-03 | vendor-auth | 2 | D-17 | T-3-01 | Argon2id hash, JWT role=vendor | unit | `vitest run src/modules/vendor-auth/VendorAuthService.test.ts` | ❌ W0 | ⬜ pending |
| 03-04 | product-service | 2 | PROD-01, PROD-02 | T-3-02 | vendorId ownership check | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ W0 | ⬜ pending |
| 03-05 | variant-service | 2 | PROD-04 | — | N/A | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ W0 | ⬜ pending |
| 03-06 | image-service | 2 | PROD-05 | T-3-03 | Count guard, max size enforced | unit | `vitest run src/modules/catalog/ImageService.test.ts` | ❌ W0 | ⬜ pending |
| 03-07 | moderation-service | 3 | PROD-06 | T-3-04 | Admin token guard, reject requires reason | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ W0 | ⬜ pending |
| 03-08 | opensearch-index | 3 | SRCH-04 | — | Only is_searchable attributes indexed | unit | `vitest run src/modules/jobs/product-index-job.test.ts` | ❌ W0 | ⬜ pending |
| 03-09 | search-service | 4 | SRCH-01, SRCH-02, SRCH-03 | — | N/A | integration (mocked OS) | `vitest run src/modules/search/SearchService.test.ts` | ❌ W0 | ⬜ pending |
| 03-10 | vendor-routes | 4 | PROD-01, PROD-02 | T-3-02 | JWT preHandler on /vendor/* routes | unit | `vitest run src/modules/catalog/ProductService.test.ts` | ❌ W0 | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

- [ ] `apps/api/src/modules/catalog/ProductService.test.ts` — stubs for PROD-01 through PROD-06
- [ ] `apps/api/src/modules/catalog/ImageService.test.ts` — stubs for PROD-05
- [ ] `apps/api/src/modules/search/SearchService.test.ts` — stubs for SRCH-01 through SRCH-03
- [ ] `apps/api/src/modules/jobs/product-index-job.test.ts` — stubs for SRCH-04
- [ ] `apps/api/src/modules/vendor-auth/VendorAuthService.test.ts` — stubs for D-17 vendor JWT issuance
- [ ] `apps/api/src/db/schema/products.test.ts` — schema shape assertions

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Vendor uploads image via presigned URL to R2 bucket | PROD-05 | Requires live S3-compatible bucket; cannot mock S3 in unit tests | Generate presigned URL, PUT file via curl, confirm CDN URL stored |
| BullMQ ProductIndexJob runs and document appears in OpenSearch | SRCH-01 | Requires live BullMQ + OpenSearch connection | Approve a product, confirm job runs, query OpenSearch index |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
