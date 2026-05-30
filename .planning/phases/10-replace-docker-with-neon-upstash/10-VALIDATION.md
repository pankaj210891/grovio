---
phase: 10
slug: replace-docker-with-neon-upstash
status: draft
nyquist_compliant: false
wave_0_complete: false
created: 2026-05-30
---

# Phase 10 — Validation Strategy

> Per-phase validation contract for feedback sampling during execution.

---

## Test Infrastructure

| Property | Value |
|----------|-------|
| **Framework** | Vitest 4.1.x |
| **Config file** | `apps/api/vitest.config.ts` |
| **Quick run command** | `pnpm --filter @grovio/api test` |
| **Full suite command** | `pnpm turbo run test -- --passWithNoTests` |
| **Estimated runtime** | ~15 seconds |

---

## Sampling Rate

- **After every task commit:** Run `pnpm --filter @grovio/api test`
- **After every plan wave:** Run `pnpm turbo run test -- --passWithNoTests`
- **Before `/gsd-verify-work`:** Full suite must be green
- **Max feedback latency:** 30 seconds

---

## Per-Task Verification Map

| Task ID | Plan | Wave | Requirement | Threat Ref | Secure Behavior | Test Type | Automated Command | File Exists | Status |
|---------|------|------|-------------|------------|-----------------|-----------|-------------------|-------------|--------|
| 10-01-01 | 01 | 1 | — | T-10-01 | `requiresSsl()` returns `true` for `.neon.tech` and `sslmode=require` URLs; `false` for `localhost` | unit | `pnpm --filter @grovio/api test` | ❌ W0 | ⬜ pending |
| 10-01-02 | 01 | 1 | — | T-10-02 | TLS detection returns `true` for `rediss://`; `false` for `redis://` | unit | `pnpm --filter @grovio/api test` | ❌ W0 | ⬜ pending |
| 10-01-03 | 01 | 1 | — | — | N/A — env schema change; type-checked by compiler | unit | `pnpm --filter @grovio/api typecheck` | ✅ | ⬜ pending |
| 10-01-04 | 01 | 1 | — | — | N/A — config file change; verified by `db:generate` dry-run | manual | Manual: `pnpm db:generate` | ✅ | ⬜ pending |
| 10-01-05 | 01 | 1 | — | — | N/A — env example update; no automated test | manual | Manual: visual inspection of `.env.example` | ✅ | ⬜ pending |
| 10-01-06 | 01 | 1 | — | T-10-03 | Secrets injected as env vars; no secrets echoed in CI logs | manual | Manual: inspect CI run after committing | ✅ | ⬜ pending |
| 10-01-07 | 01 | 1 | — | — | `docker-compose.yml` deleted; no Docker references remain in buyer-facing docs | manual | `grep -r "docker-compose" . --include="*.md" --exclude-dir=".planning"` | ✅ | ⬜ pending |

*Status: ⬜ pending · ✅ green · ❌ red · ⚠️ flaky*

---

## Wave 0 Requirements

The SSL/TLS detection helpers (`requiresSsl`, `isTls`) must be extracted as pure, exportable functions so they can be unit-tested without starting Fastify. Define them at module scope (not inside plugin closures).

- [ ] `apps/api/src/plugins/drizzle.test.ts` — unit tests for `requiresSsl()` pure function (Neon URL → true, localhost URL → false, sslmode=require → true)
- [ ] `apps/api/src/plugins/redis.test.ts` — unit tests for TLS scheme detection (`rediss://` → true, `redis://` → false)

---

## Manual-Only Verifications

| Behavior | Requirement | Why Manual | Test Instructions |
|----------|-------------|------------|-------------------|
| Backend starts and passes `/health` with live Neon + Upstash + Bonsai credentials | D-07, D-08 | Requires live cloud accounts; cannot be automated without real credentials in CI secrets | 1. Sign up for Neon, Upstash, Bonsai free tiers. 2. Copy connection strings to `.env`. 3. Run `pnpm --filter @grovio/api dev`. 4. `curl http://localhost:3000/health` returns 200. |
| `pnpm db:migrate` succeeds against Neon using `DATABASE_DIRECT_URL` | D-04 | Requires live Neon account with direct (non-pooled) connection URL | Set `DATABASE_DIRECT_URL` to Neon direct endpoint (hostname without `-pooler`). Run `pnpm db:migrate`. Verify migration runs without PgBouncer errors. |
| CI pipeline passes with secrets configured | D-09 | Requires GitHub repo secrets to be configured | Add `DATABASE_URL`, `DATABASE_DIRECT_URL`, `REDIS_URL`, `OPENSEARCH_URL` to GitHub Actions repo secrets. Push a commit and verify the CI workflow passes. |
| `docker-compose.yml` is gone and no buyer-facing doc references Docker | D-10, D-11 | File deletion and doc sweep are human-verifiable | Confirm `docker-compose.yml` does not exist. Run `grep -r "docker-compose" . --include="*.md" --exclude-dir=".planning"`. Zero matches expected. |
| Bonsai OPENSEARCH_URL connects without TLS errors | D-06, D-12 | Requires live Bonsai account; no client code exists yet in this phase | Phase 3 scope — not applicable in this phase. Validate in Phase 3. |

---

## Validation Sign-Off

- [ ] All tasks have `<automated>` verify or Wave 0 dependencies
- [ ] Sampling continuity: no 3 consecutive tasks without automated verify
- [ ] Wave 0 covers all MISSING references
- [ ] No watch-mode flags
- [ ] Feedback latency < 30s
- [ ] `nyquist_compliant: true` set in frontmatter

**Approval:** pending
