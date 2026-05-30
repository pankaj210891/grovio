# Phase 10: Replace Docker with Neon + Upstash - Context

**Gathered:** 2026-05-30
**Status:** Ready for planning

<domain>
## Phase Boundary

Eliminate Docker as a local dev dependency by replacing all three Docker-hosted infrastructure services with cloud-hosted, zero-install alternatives: PostgreSQL → Neon (serverless Postgres, free tier), Redis → Upstash (serverless Redis, free tier), OpenSearch → Bonsai (managed OpenSearch, free tier). Delete `docker-compose.yml` entirely. Update `.env.example`, CI workflow, and all docs to reflect the new setup. No feature development — pure infrastructure/config change.

</domain>

<decisions>
## Implementation Decisions

### Buyer Onboarding Path
- **D-01:** Neon + Upstash + Bonsai are the **only** supported dev setup path. No Docker fallback is provided or documented. Buyers must sign up for free accounts on all three services and copy their connection strings into `.env`.
- **D-02:** The README gets a step-by-step "Infrastructure Setup" section covering: (1) Create Neon project → copy DATABASE_URL, (2) Create Upstash Redis → copy REDIS_URL, (3) Create Bonsai account → copy OPENSEARCH_URL. No linking out to external docs — self-contained setup guidance.
- **D-03:** Buyer signs up for their own free-tier accounts. No shared demo connection strings are provided.

### Connection String Formats
- **D-04:** `DATABASE_URL` in `.env.example` is updated to show the Neon pooled connection string format: `postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require`. The pooled URL (pgbouncer endpoint) is used for the app server. Drizzle Kit migrations use the same `DATABASE_URL`.
- **D-05:** `REDIS_URL` in `.env.example` is updated to show the Upstash TLS format: `rediss://:token@xxx.upstash.io:6380`.
- **D-06:** `OPENSEARCH_URL` in `.env.example` is updated to include Bonsai credentials in the URL: `https://user:pass@xxx.bonsai.io`. Single env var carries the full connection string including auth — consistent with DATABASE_URL/REDIS_URL pattern.

### Backend SSL/TLS Configuration
- **D-07:** The backend enforces SSL/TLS automatically based on URL scheme rather than leaving it to buyer configuration:
  - Drizzle connection config sets `ssl: true` when `DATABASE_URL` contains `.neon.tech` or `sslmode=require`.
  - ioredis/BullMQ uses `tls: {}` when `REDIS_URL` starts with `rediss://`.
  - This auto-detection ensures both local (no TLS) and cloud (TLS required) work from the same codebase with only the URL changing.

### Environment Scope
- **D-08:** Neon + Upstash + Bonsai are used in **all environments**: local dev, CI, and staging/production. There is no environment-specific infra branching.
- **D-09:** CI (GitHub Actions) reads `DATABASE_URL`, `REDIS_URL`, and `OPENSEARCH_URL` from **GitHub Actions repository secrets**. The CI workflow is updated in this phase to remove any Docker service container definitions and rely entirely on secrets.

### docker-compose.yml
- **D-10:** `docker-compose.yml` is **deleted entirely**. No services remain once Postgres, Redis, and OpenSearch all move to cloud. No commented fallback is kept.
- **D-11:** A full sweep of Docker references is performed: `.env.example` comments referencing docker-compose.yml (e.g., "Local dev: use docker-compose.yml credentials") are replaced with Neon/Upstash/Bonsai equivalents. README setup steps and any other docs mentioning Docker are updated or removed.

### OpenSearch Provider
- **D-12:** Bonsai is the chosen managed OpenSearch provider (free Sandbox tier). It is API-compatible with the `@opensearch-project/opensearch` Node.js client already in the stack — no client changes required.

### Claude's Discretion
- The exact Drizzle connection config code for detecting Neon SSL vs local Postgres (condition logic, where to place it in the Drizzle init file).
- Whether to add a `DATABASE_DIRECT_URL` var for drizzle-kit if Neon's pooled URL causes issues with `CREATE INDEX CONCURRENTLY` or other migration-time commands. (Pooled URL is the default per D-04; planner adds the direct URL if evidence suggests it's needed.)
- Specific GitHub Actions workflow changes (job structure, step ordering) for removing Docker service containers.
- Bonsai plan/tier selection (Sandbox free tier is the default; planner documents the upgrade path in README comments).

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase Scope
- `.planning/ROADMAP.md` §"Phase 10: Replace Docker with Neon + Upstash" — goal and dependency chain
- `.planning/PROJECT.md` §"Constraints" — tech stack constraints that this phase must not violate

### Current Infrastructure Files (things being modified or deleted)
- `docker-compose.yml` — current Docker services being replaced (postgres:16-alpine, redis:7-alpine, opensearch:2.18); this file will be deleted
- `.env.example` — root env var file; DATABASE_URL, REDIS_URL, OPENSEARCH_URL comments must be updated
- `apps/api/.env.example` — API-specific env vars; check for Docker-related references
- `.github/workflows/` — CI workflow files; Docker service containers must be removed

### Technology Stack
- `CLAUDE.md` §"Core Backend" — confirms ioredis 5.x as BullMQ's Redis client (affects TLS config path)
- `CLAUDE.md` §"Database & Storage" — Drizzle ORM 0.45.x config reference; PostgreSQL 16+ requirement (Neon runs PG 16)

No external ADRs or design documents — all decisions captured in this context file.

</canonical_refs>

<code_context>
## Existing Code Insights

### Files Being Changed
- `docker-compose.yml` — deleted
- `.env.example` — DATABASE_URL, REDIS_URL, OPENSEARCH_URL values and comments updated
- `apps/api/.env.example` — scan for Docker references
- `.github/workflows/*.yml` — remove Docker service container blocks
- Backend Drizzle init file — add SSL auto-detection for Neon connections
- Backend Redis/ioredis init — add TLS auto-detection for Upstash (rediss:// scheme)

### Established Patterns
- Phase 1 D-07/D-08 established the root + per-app `.env.example` structure with documented comments per var. This phase updates comments within that structure — does not change the structure itself.
- Feature-flag TTL, JWT secret, Google SMTP, Google Maps vars are unaffected — only DATABASE_URL, REDIS_URL, and OPENSEARCH_URL change format.

### Integration Points
- BullMQ (background job queue) uses ioredis; TLS config affects BullMQ's Redis connection options as well as direct Redis client usage.
- Drizzle ORM's SSL config is set at the `drizzle()` initialization call, not in the connection string alone.

</code_context>

<specifics>
## Specific Ideas

- Neon URL format: `postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require` (pooler endpoint)
- Upstash URL format: `rediss://:token@xxx.upstash.io:6380` (TLS enforced, port 6380)
- Bonsai URL format: `https://user:pass@xxx.bonsai.io` (HTTPS with basic auth in URL)
- README "Infrastructure Setup" section should be a numbered checklist: Neon → Upstash → Bonsai, each with a direct signup link and the exact env var to fill in.

</specifics>

<deferred>
## Deferred Ideas

None — discussion stayed within phase scope.

</deferred>

---

*Phase: 10-replace-docker-with-neon-upstash*
*Context gathered: 2026-05-30*
