---
phase: 10-replace-docker-with-neon-upstash
plan: "02"
subsystem: infrastructure/config
tags: [neon, upstash, bonsai, env-config, ci, credentials]
dependency_graph:
  requires: []
  provides:
    - "Root .env.example documents Neon pooled + direct, Upstash rediss://, Bonsai https URL formats"
    - "apps/api/.env.example documents DATABASE_DIRECT_URL and OPENSEARCH_URL"
    - "CI injects DATABASE_URL, DATABASE_DIRECT_URL, REDIS_URL, OPENSEARCH_URL from GitHub Actions secrets"
  affects:
    - ".env.example"
    - "apps/api/.env.example"
    - ".github/workflows/ci.yml"
tech_stack:
  added: []
  patterns:
    - "GitHub Actions top-level env block reading from ${{ secrets.* }}"
    - "Neon pooled/direct dual-URL pattern for app vs migration workloads"
    - "Upstash rediss:// TLS URL format with Fixed-plan BullMQ recommendation"
    - "Bonsai https URL format with Sandbox number_of_replicas:0 guidance"
key_files:
  created: []
  modified:
    - ".env.example"
    - "apps/api/.env.example"
    - ".github/workflows/ci.yml"
decisions:
  - "DATABASE_DIRECT_URL added to both env examples — required for drizzle-kit migrations against Neon pooler (PgBouncer transaction mode incompatibility)"
  - "OPENSEARCH_URL added to apps/api/.env.example as OPTIONAL until Phase 3 — forward-safe placeholder"
  - "CI DATABASE_DIRECT_URL included even though test task does not run db:migrate — forward-safe, costs nothing"
  - "BullMQ Fixed-plan note added to REDIS_URL comment to address T-10-05 (Upstash pay-per-request runaway cost)"
metrics:
  duration: "2 minutes"
  completed: "2026-05-30T17:38:57Z"
  tasks_completed: 2
  tasks_total: 2
  files_changed: 3
---

# Phase 10 Plan 02: Env Examples and CI Credentials Summary

**One-liner:** Updated both .env.example files to Neon pooled+direct/Upstash rediss://TLS/Bonsai https formats and injected four cloud credentials into CI via GitHub Actions repository secrets.

## What Was Built

### Task 1: Rewrite both .env.example files (commit `856bc79`)

Both `.env.example` files were updated to reflect cloud infrastructure URL formats:

**Root `.env.example`:**
- `DATABASE_URL` rewritten to Neon pooled placeholder (`ep-cool-name-123456-pooler.neon.tech`)
- New `DATABASE_DIRECT_URL` line added (non-pooled for drizzle-kit migrations)
- `REDIS_URL` rewritten to Upstash `rediss://` TLS format
- `OPENSEARCH_URL` rewritten to Bonsai `https://` format with Sandbox replica note
- All docker-compose comment references removed from Database, Redis, OpenSearch sections
- Section banner comment style preserved

**`apps/api/.env.example`:**
- `DATABASE_URL` rewritten to Neon pooled placeholder
- New `DATABASE_DIRECT_URL` block added after `DATABASE_URL`
- `REDIS_URL` rewritten to Upstash `rediss://` TLS format with Fixed-plan BullMQ note
- New `OPENSEARCH_URL` block added at end (marked optional until Phase 3)
- All docker-compose comment references removed
- Lighter plain-`#` comment style preserved (matching existing file style)

### Task 2: Inject CI credentials from repository secrets (commit `f46986e`)

`.github/workflows/ci.yml` top-level `env:` block extended:

```yaml
env:
  CI: "true"
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  DATABASE_DIRECT_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  REDIS_URL: ${{ secrets.REDIS_URL }}
  OPENSEARCH_URL: ${{ secrets.OPENSEARCH_URL }}
```

- Purely additive change — no `services:` block existed to remove (confirmed before editing)
- No CI step echoes any secret variable (GitHub auto-masking preserved; T-10-03 mitigation)
- All five existing run steps (lint, typecheck, format:check, test, build) unchanged

## Verification Results

- `grep -c "docker-compose" .env.example apps/api/.env.example` → `0` in each file
- Root `.env.example` contains `ep-cool-name-123456-pooler.neon.tech`, `DATABASE_DIRECT_URL=`, `rediss://`, `bonsai.io`
- `apps/api/.env.example` contains `rediss://`, `DATABASE_DIRECT_URL=`, `OPENSEARCH_URL=`
- CI `env:` block contains all four `secrets.*` mappings
- No real tokens, passwords, or non-placeholder credentials in either file
- No CI step echoes any of the four secret env vars

## Deviations from Plan

None - plan executed exactly as written.

## Threat Surface Scan

No new network endpoints, auth paths, file access patterns, or schema changes introduced. All changes are documentation/configuration only. T-10-02 (no real credentials in examples), T-10-03 (no CI secret echo), and T-10-05 (BullMQ Fixed-plan note) mitigations applied as specified.

## Known Stubs

None — both env examples are documentation files with intentional placeholder values. The placeholder format (`your-upstash-token`, `your-cluster`, `user:pass`) is the correct and expected content for `.env.example` files.

## Self-Check: PASSED

Files exist:
- `.env.example` — FOUND
- `apps/api/.env.example` — FOUND
- `.github/workflows/ci.yml` — FOUND

Commits exist:
- `856bc79` — chore(10-02): rewrite env examples to Neon/Upstash/Bonsai formats
- `f46986e` — chore(10-02): inject cloud credentials into CI from repository secrets
