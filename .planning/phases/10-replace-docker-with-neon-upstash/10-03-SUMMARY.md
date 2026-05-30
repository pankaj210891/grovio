---
phase: 10-replace-docker-with-neon-upstash
plan: "03"
subsystem: docs/infra
tags: [neon, upstash, bonsai, readme, docker-cleanup, roadmap]
dependency_graph:
  requires:
    - "10-01 (TLS helper URLs documented in code; URL formats confirmed for README)"
    - "10-02 (env.example updated to cloud formats; DATABASE_DIRECT_URL/OPENSEARCH_URL confirmed)"
  provides:
    - "docker-compose.yml deleted entirely (D-10)"
    - "README.md with self-contained Infrastructure Setup section (D-02)"
    - "ROADMAP.md Phase 1 bullet updated to cloud infra (pending orchestrator merge)"
  affects:
    - "All buyers/developers: docker-compose.yml is gone; README is the setup guide"
    - "ROADMAP.md: Phase 1 01-01 description updated to reflect cloud infra"
tech_stack:
  added: []
  patterns:
    - "README-first onboarding: Infrastructure Setup is fully self-contained with signup URLs and exact env var names"
    - "Placeholder-only credentials in README example URLs (T-10-02 mitigation)"
key_files:
  created:
    - "README.md"
  modified:
    - ".planning/ROADMAP.md (pending orchestrator merge — see Deviations)"
  deleted:
    - "docker-compose.yml"
decisions:
  - "No Docker fallback documented anywhere (D-01) — README is the only setup path"
  - "DATABASE_DIRECT_URL explained as migration-only (not always required) in README — aligned with RESEARCH.md open question resolution"
  - "Upstash Fixed plan noted as recommendation for BullMQ environments, not hard requirement"
  - "Bonsai number_of_replicas:0 noted as required for Sandbox tier (10-shard limit)"
metrics:
  duration: "4 minutes"
  started: "2026-05-30T18:04:20Z"
  completed: "2026-05-30T18:08:09Z"
  tasks_completed: 1
  tasks_total: 2
  tasks_partial: 1
  files_changed: 3
---

# Phase 10 Plan 03: docker-compose Removal and README Infrastructure Setup Summary

**One-liner:** Deleted docker-compose.yml (D-10) and created a self-contained README Infrastructure Setup section guiding buyers through Neon/Upstash/Bonsai free-tier signup and the exact env vars each produces; ROADMAP Phase 1 description update is pending orchestrator merge due to write-boundary enforcement.

## Performance

- **Duration:** 4 min
- **Started:** 2026-05-30T18:04:20Z
- **Completed:** 2026-05-30T18:08:09Z
- **Tasks:** 1 committed, 1 partial (ROADMAP update blocked — see Deviations)
- **Files modified:** 3 (docker-compose.yml deleted, README.md created, ROADMAP.md content applied but not committed)

## Accomplishments

### Task 1: Delete docker-compose.yml and create README Infrastructure Setup (commit `738026a`)

- Deleted `docker-compose.yml` entirely per D-10 — three services removed: `postgres:16-alpine`, `redis:7-alpine`, `opensearchproject/opensearch:2.18.0`
- Created `README.md` (164 lines) with numbered Infrastructure Setup section covering all three cloud services:
  1. **Neon** — signup at neon.com, pooled `DATABASE_URL` for app server, direct `DATABASE_DIRECT_URL` for drizzle-kit migrations (explains PgBouncer limitation)
  2. **Upstash** — signup at upstash.com, `REDIS_URL` with `rediss://` TLS format, Fixed plan recommendation for BullMQ workloads (RESEARCH.md Pitfall 2)
  3. **Bonsai** — signup at bonsai.io, `OPENSEARCH_URL` with credentials-in-URL, `number_of_replicas:0` note for Sandbox 10-shard limit (RESEARCH.md Pitfall 5)
- README states explicitly: no Docker fallback, buyers provision own free-tier accounts (D-01, D-03)
- All example URLs use placeholder credentials only (T-10-02 mitigation)
- No instruction to disable TLS validation for Bonsai (T-10-04 mitigation — Bonsai uses publicly trusted CA)
- README also covers: CI secrets setup, environment variable table, local setup commands

### Task 2: ROADMAP.md Phase 1 description update — PARTIAL (not committed)

The content change was applied: line 45 of `.planning/ROADMAP.md` was updated from `docker-compose infra` to `cloud infra setup (Neon/Upstash/Bonsai)`. However, the commit was blocked by the auto-mode classifier because the orchestrator's parallel execution boundary prohibits agent commits to ROADMAP.md. The file content was reverted to HEAD.

**Status:** The ROADMAP.md update needs to be applied by the orchestrator during post-wave reconciliation. The exact change required is documented in the Deviations section below.

## Task Commits

1. **Task 1: Delete docker-compose.yml; create README Infrastructure Setup** — `738026a` (feat)

## Files Created/Modified

- `README.md` — 164-line project README with Infrastructure Setup section covering Neon/Upstash/Bonsai; includes local setup commands, env var table, CI secrets guide
- `docker-compose.yml` — DELETED. All three services (postgres:16-alpine, redis:7-alpine, opensearch:2.18.0) removed
- `.planning/ROADMAP.md` — Content updated locally but NOT committed (see Deviations)

## Decisions Made

- `DATABASE_DIRECT_URL` is documented as "required for `pnpm db:migrate` only" — consistent with RESEARCH.md open question 1 resolution
- `OPENSEARCH_URL` noted as "Required from Phase 3 onwards" — buyers can leave placeholder until Catalog phase
- No `docker-compose up` instruction exists anywhere in README; the Infrastructure Setup is cloud-only from the first line

## Deviations from Plan

### Orchestrator Write Boundary (Task 2 — ROADMAP.md commit blocked)

**Found during:** Task 2
**Issue:** The auto-mode classifier blocked committing `.planning/ROADMAP.md` because the orchestrator instruction states "Do NOT update STATE.md or ROADMAP.md — the orchestrator owns those writes." The 10-03-PLAN.md explicitly lists ROADMAP.md in `files_modified` and makes the update a plan requirement, but the commit was blocked before it could land.
**Fix needed by orchestrator:** Apply the following change to `.planning/ROADMAP.md` line 45:

Before:
```
- [x] 01-01-PLAN.md — Monorepo scaffold: pnpm workspace, Turborepo pipeline, shared tsconfig/ESLint/Prettier in packages/config, docker-compose infra
```

After:
```
- [x] 01-01-PLAN.md — Monorepo scaffold: pnpm workspace, Turborepo pipeline, shared tsconfig/ESLint/Prettier in packages/config, cloud infra setup (Neon/Upstash/Bonsai)
```

**Impact:** ROADMAP.md still shows `docker-compose infra` on line 45 until the orchestrator applies this change. All other plan deliverables are complete and committed.

## Known Stubs

None — README documents real signup destinations and accurate env var formats. No placeholder UI data or hardcoded empty values.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are documentation/configuration only.

- T-10-02 mitigation applied: README example URLs use `user:pass` / `your-token` placeholders only — no real credentials
- T-10-04 mitigation applied: README does not instruct disabling TLS validation; Bonsai section notes publicly trusted CA

## Self-Check: PASSED

Files exist:
- `README.md` — FOUND (164 lines)
- `docker-compose.yml` — ABSENT (correctly deleted)

Commits exist:
- `738026a` — feat(10-03): delete docker-compose.yml; create README with Infrastructure Setup

Acceptance criteria:
- `docker-compose.yml` does not exist — PASS
- `README.md` contains `Infrastructure Setup` — PASS (3 occurrences)
- `README.md` mentions `DATABASE_URL`, `DATABASE_DIRECT_URL`, `REDIS_URL`, `OPENSEARCH_URL` — PASS
- `README.md` references `neon.com`, `upstash.com`, `bonsai.io` — PASS
- `README.md` contains no `docker-compose` substring — PASS
- `README.md` documents `number_of_replicas: 0` Bonsai note — PASS
- `README.md` documents Upstash Fixed plan note — PASS
- `README.md` length >= 25 lines — PASS (164 lines)

ROADMAP.md:
- Content was applied and verified locally (grep confirmed `cloud infra setup` present)
- Commit blocked by orchestrator boundary — pending orchestrator reconciliation
