---
phase: 03-catalog-search
plan: "02"
subsystem: api-dependencies
tags: [dependencies, opensearch, bullmq, s3, argon2, package-install]
dependency_graph:
  requires: []
  provides: [opensearch-client, bullmq-queue, s3-presigner, argon2-hashing]
  affects: [03-05-search-module, 03-06-image-upload, 03-07-vendor-auth]
tech_stack:
  added:
    - "@opensearch-project/opensearch@^3.6.0"
    - "bullmq@^5.77.6"
    - "@aws-sdk/client-s3@^3.1057.0"
    - "@aws-sdk/s3-request-presigner@^3.1057.0"
    - "argon2@^0.44.0"
  patterns: []
key_files:
  created: []
  modified:
    - apps/api/package.json
    - pnpm-lock.yaml
decisions:
  - "argon2 native bindings compiled successfully on Windows (Node 24.16.0 / node-gyp-build); no fallback needed"
  - "All five packages installed at their latest semver-compatible versions within the CLAUDE.md-specified ranges"
metrics:
  duration: "~16 minutes (including human verification checkpoint wait)"
  completed: "2026-05-31T16:12:14Z"
  tasks_completed: 2
  tasks_total: 2
---

# Phase 03 Plan 02: Install Phase 3 Runtime Dependencies — Summary

## One-liner

Five Phase 3 runtime packages installed in @grovio/api: OpenSearch client (3.6.0), BullMQ (5.77.6), AWS SDK S3 + presigner (3.1057.0), and argon2 (0.44.0) with native bindings compiled successfully.

## What Was Built

A dependency installation plan with a mandatory human legitimacy verification gate (blocking-human checkpoint) before any `pnpm add` ran. After the human approved all five packages, Task 2 executed `pnpm add` targeting `@grovio/api` and updated the lockfile.

### Packages Installed

| Package | Version Installed | Purpose |
|---------|------------------|---------|
| `@opensearch-project/opensearch` | ^3.6.0 | OpenSearch Node.js client for index management, document upsert, search queries |
| `bullmq` | ^5.77.6 | Background job queue for async `ProductIndexJob` on product approval |
| `@aws-sdk/client-s3` | ^3.1057.0 | S3 client for presigned PUT URL generation (Cloudflare R2 via endpoint override) |
| `@aws-sdk/s3-request-presigner` | ^3.1057.0 | `getSignedUrl` companion for generating presigned upload URLs |
| `argon2` | ^0.44.0 | Argon2id password hashing for vendor accounts; native bindings compiled |

## Commits

| Task | Commit | Description |
|------|--------|-------------|
| Task 1: Human legitimacy checkpoint | (no commit — gate only) | Human verified all 5 packages on npm registry pages |
| Task 2: Install packages | 8020657 | chore(03-02): install Phase 3 runtime dependencies |

## Verification

All five packages confirmed present via:
```
node -e "const p=require('./apps/api/package.json').dependencies; ['@opensearch-project/opensearch','bullmq','@aws-sdk/client-s3','@aws-sdk/s3-request-presigner','argon2'].forEach(k=>{if(!p[k]){console.error('MISSING '+k);process.exit(1)}}); console.log('all present')"
```
Output: `all present`

argon2 native build output confirmed: `node-gyp-build` completed without error.

BullMQ peer dependency (ioredis 5.x) satisfied — `ioredis@^5.11.0` already in `apps/api/package.json`.

## Deviations from Plan

None — plan executed exactly as written. Task 1 gate was satisfied by human approval (continuation agent resumed from checkpoint). Task 2 `pnpm add` ran without any native build failures or peer dependency conflicts related to the five installed packages.

Pre-existing peer dependency warning (`@vitejs/plugin-react` / vite 8) is unrelated to this plan and was present before this install.

## Auth Gates

None applicable to this plan.

## Known Stubs

None — this is a dependency installation plan only; no application code was written.

## Threat Flags

None beyond those in the plan's threat model (T-03-SC, T-03-SC2), both satisfied: blocking-human legitimacy gate completed before install, and argon2 native binary compiled from verified npm publisher (ranisalt).

## Self-Check: PASSED

- [x] apps/api/package.json contains all 5 packages
- [x] pnpm-lock.yaml updated (784 lines added in commit)
- [x] Commit 8020657 exists in git log
- [x] No file deletions in commit
- [x] argon2 native bindings compiled (no fallback required)
