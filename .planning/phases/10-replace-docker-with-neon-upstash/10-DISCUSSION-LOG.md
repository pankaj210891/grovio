# Phase 10: Replace Docker with Neon + Upstash - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-05-30
**Phase:** 10-replace-docker-with-neon-upstash
**Areas discussed:** Buyer onboarding impact, Environment target, OpenSearch scope, docker-compose.yml fate

---

## Buyer Onboarding Impact

| Option | Description | Selected |
|--------|-------------|----------|
| Neon + Upstash only | Remove Docker from default setup. Buyers sign up for free accounts. | ✓ |
| Neon + Upstash as default, Docker as fallback | Keep docker-compose.yml as documented alternative. | |
| Side-by-side (both equally documented) | Both paths equally documented; buyer chooses. | |

**User's choice:** Neon + Upstash only — no Docker fallback.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Guide to free tier signup | Each buyer creates their own accounts. | ✓ |
| Include a placeholder demo connection string | Shared demo string for immediate evaluation. | |
| You decide | Planner chooses. | |

**User's choice:** Guide to free tier signup.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — update .env.example to Neon/Upstash format | DATABASE_URL and REDIS_URL show cloud URL formats. | ✓ |
| Keep localhost format, add a comment | Keep localhost, add cloud comment. | |
| You decide | Planner decides. | |

**User's choice:** Update .env.example to show Neon/Upstash URL formats.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Enforce SSL/TLS in the backend config | Auto-detect from URL scheme in Drizzle/ioredis init. | ✓ |
| Leave it to the connection string | Driver handles TLS from URL; no backend changes. | |
| You decide | Planner picks. | |

**User's choice:** Enforce SSL/TLS in backend config, auto-detected from URL scheme.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — step-by-step in README | README gets numbered checklist for Neon, Upstash, Bonsai. | ✓ |
| Link to Neon + Upstash docs instead | Point to official getting-started docs. | |
| You decide | Planner chooses documentation depth. | |

**User's choice:** Include step-by-step guide in README.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Same DATABASE_URL for app and migrations | Drizzle Kit uses same connection string. | ✓ |
| Separate migration URL (pooled vs direct) | drizzle-kit uses direct URL; app uses pooled URL. | |
| You decide | Planner handles Neon-specific URL config. | |

**User's choice:** Same DATABASE_URL for both app and migrations.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — pooled URL for app | DATABASE_URL uses Neon's pgbouncer pooled endpoint. | ✓ |
| Direct URL for everything | Use direct connection URL for both. | |
| You decide | Planner determines right URL type. | |

**User's choice:** Use Neon pooled URL for app connections.

---

## Environment Target

| Option | Description | Selected |
|--------|-------------|----------|
| All environments — local dev, CI, staging/prod | Neon + Upstash everywhere. Uniform config. | ✓ |
| Local dev only | CI and staging use separate infra. | |
| CI + local dev, staging/prod left to buyers | This phase handles local + CI only. | |

**User's choice:** All environments.

---

| Option | Description | Selected |
|--------|-------------|----------|
| GitHub Actions secrets — DATABASE_URL + REDIS_URL as repo secrets | CI reads from GH Actions secrets. | ✓ |
| Separate CI Neon branch / Upstash database | Dedicated CI Neon branch, separate Upstash DB. | |
| You decide | Planner chooses CI credential strategy. | |

**User's choice:** GitHub Actions secrets.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — update CI workflow in this phase | Remove Docker service containers from workflow. | ✓ |
| Leave CI workflow as-is for now | CI workflow update is a follow-on task. | |
| You decide | Planner determines CI scope. | |

**User's choice:** Update CI workflow in this phase.

---

## OpenSearch Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Keep OpenSearch on Docker | docker-compose.yml shrinks to OpenSearch-only. | |
| Move to a managed OpenSearch service | OpenSearch also moves to cloud. No Docker at all. | ✓ |
| Remove OpenSearch from docker-compose.yml and defer | Remove now; add back in Phase 3. | |

**User's choice:** Move OpenSearch to a managed service.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Bonsai (managed OpenSearch, free tier) | Sandbox free tier, OpenSearch API compatible. | ✓ |
| Elastic Cloud (Elasticsearch, free 14-day trial) | Free trial but Elasticsearch, not OpenSearch. | |
| OpenSearch Serverless (AWS) | No free tier, requires AWS account. | |
| You decide | Planner picks managed OpenSearch provider. | |

**User's choice:** Bonsai.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — OPENSEARCH_URL includes credentials | https://user:pass@xxx.bonsai.io — single env var. | ✓ |
| Separate OPENSEARCH_USERNAME + OPENSEARCH_PASSWORD | Separate vars. | |
| You decide | Planner picks env var structure. | |

**User's choice:** Credentials in OPENSEARCH_URL, consistent with DATABASE_URL/REDIS_URL pattern.

---

## docker-compose.yml Fate

| Option | Description | Selected |
|--------|-------------|----------|
| Delete it entirely | No services remain; clean removal. | ✓ |
| Keep it as an optional local fallback (commented) | Retain with all services commented out. | |
| Repurpose for future use | Keep for CI or integration test use. | |

**User's choice:** Delete entirely.

---

| Option | Description | Selected |
|--------|-------------|----------|
| Full sweep — remove all Docker references from docs and .env.example | Search and update all files mentioning Docker. | ✓ |
| Only update .env.example, leave README for Phase 9 | Phase 10 handles config; README is Phase 9's concern. | |
| You decide | Planner determines cleanup scope. | |

**User's choice:** Full sweep of all Docker references.

---

## Claude's Discretion

- Exact Drizzle connection config code for Neon SSL detection (condition logic, placement in init file)
- Whether to add `DATABASE_DIRECT_URL` for drizzle-kit if Neon pooled URL causes migration issues
- Specific GitHub Actions workflow changes (job structure, step ordering)
- Bonsai plan/tier selection and upgrade path documentation in README

## Deferred Ideas

None — discussion stayed within phase scope.
