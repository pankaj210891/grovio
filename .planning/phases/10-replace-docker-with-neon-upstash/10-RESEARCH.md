# Phase 10: Replace Docker with Neon + Upstash - Research

**Researched:** 2026-05-30
**Domain:** Infrastructure configuration — cloud-hosted PostgreSQL, Redis, OpenSearch; backend SSL/TLS auto-detection; GitHub Actions CI
**Confidence:** HIGH (codebase directly inspected; Neon/Upstash/BullMQ official sources verified)

---

<user_constraints>
## User Constraints (from CONTEXT.md)

### Locked Decisions

- **D-01:** Neon + Upstash + Bonsai are the **only** supported dev setup path. No Docker fallback is provided or documented. Buyers must sign up for free accounts on all three services and copy their connection strings into `.env`.
- **D-02:** The README gets a step-by-step "Infrastructure Setup" section covering: (1) Create Neon project → copy DATABASE_URL, (2) Create Upstash Redis → copy REDIS_URL, (3) Create Bonsai account → copy OPENSEARCH_URL. No linking out to external docs — self-contained setup guidance.
- **D-03:** Buyer signs up for their own free-tier accounts. No shared demo connection strings are provided.
- **D-04:** `DATABASE_URL` uses Neon pooled connection string format: `postgresql://user:pass@ep-xxx-pooler.neon.tech/grovio?sslmode=require`. Pooled URL is the default for the app server. Drizzle Kit migrations use the same `DATABASE_URL` per this decision (Drizzle's discretion item — see below).
- **D-05:** `REDIS_URL` uses Upstash TLS format: `rediss://:token@xxx.upstash.io:6380`.
- **D-06:** `OPENSEARCH_URL` includes Bonsai credentials in URL: `https://user:pass@xxx.bonsai.io`. Single env var carries full connection string including auth.
- **D-07:** Backend enforces SSL/TLS automatically based on URL scheme: Drizzle sets `ssl: true` when `DATABASE_URL` contains `.neon.tech` or `sslmode=require`; ioredis/BullMQ uses `tls: {}` when `REDIS_URL` starts with `rediss://`. Auto-detection ensures both local (no TLS) and cloud (TLS required) work from the same codebase with only the URL changing.
- **D-08:** Neon + Upstash + Bonsai are used in **all environments**: local dev, CI, and staging/production. No environment-specific infra branching.
- **D-09:** CI reads `DATABASE_URL`, `REDIS_URL`, and `OPENSEARCH_URL` from GitHub Actions repository secrets. CI workflow updated to remove Docker service container definitions.
- **D-10:** `docker-compose.yml` is **deleted entirely**. No commented fallback.
- **D-11:** Full sweep of Docker references in all docs, comments, and `.env.example` files.
- **D-12:** Bonsai is the chosen managed OpenSearch provider (free Sandbox tier).

### Claude's Discretion

- Exact Drizzle connection config code for detecting Neon SSL vs local Postgres (condition logic, placement in Drizzle init file).
- Whether to add a `DATABASE_DIRECT_URL` var for drizzle-kit if Neon's pooled URL causes issues with migrations.
- Specific GitHub Actions workflow changes (job structure, step ordering) for removing Docker service containers.
- Bonsai plan/tier selection (Sandbox free tier default; planner documents upgrade path in README comments).

### Deferred Ideas (OUT OF SCOPE)

None — discussion stayed within phase scope.

</user_constraints>

---

## Summary

This phase is a pure infrastructure/configuration migration. There is no feature code to write. The migration replaces three Docker-hosted services with cloud equivalents: PostgreSQL on Neon, Redis on Upstash, OpenSearch on Bonsai. The codebase currently uses `drizzle-orm/node-postgres`, ioredis directly, and has no OpenSearch client (OpenSearch is defined in docker-compose.yml but there is no `@opensearch-project/opensearch` client code yet — the stack is set up for it in Phase 3).

**Critical finding on BullMQ + Upstash:** BullMQ has historically been incompatible with Upstash due to Lua scripting and blocking command limitations. However, BullMQ v3/v5 removed the hard error-on-detection and Upstash now officially documents the BullMQ integration. The current project uses BullMQ 5.x (per CLAUDE.md), so the hard error is no longer thrown. The key remaining concern is cost: Upstash charges per command, and BullMQ polls Redis continuously even with no active jobs. Upstash's recommendation is to use a Fixed plan for BullMQ workloads.

**Critical finding on drizzle-kit + Neon pooled connection:** Neon's official documentation explicitly warns that using a pooled connection string for migrations can cause errors, and recommends using a direct (non-pooled) connection URL for drizzle-kit. The pooled URL uses PgBouncer in transaction mode, which does not support some features migration tools rely on (e.g., `SET` statements, persistent session state). A `DATABASE_DIRECT_URL` variable should be introduced for migration-time use.

**Finding on OpenSearch in this phase:** The codebase has no OpenSearch client code yet. `OPENSEARCH_URL` is only referenced in `.env.example` as a documented placeholder and in `docker-compose.yml`. This phase only needs to: (1) update `.env.example` with the Bonsai URL format, (2) update comments, and (3) delete the docker-compose OpenSearch service. The actual `@opensearch-project/opensearch` client initialization belongs in Phase 3.

**Primary recommendation:** Introduce `DATABASE_DIRECT_URL` for drizzle-kit migrations; use `DATABASE_URL` (pooled) for the app server. Auto-detect TLS in drizzle and ioredis plugins based on URL content. The CI workflow needs no structural changes — only add secret env var injection and confirm no Docker service containers were defined (none were, per inspection of `ci.yml`).

---

## Architectural Responsibility Map

| Capability | Primary Tier | Secondary Tier | Rationale |
|------------|-------------|----------------|-----------|
| PostgreSQL SSL auto-detection | API / Backend | — | Lives in `apps/api/src/plugins/drizzle.ts` — the Fastify plugin that initializes the Pool |
| Redis TLS auto-detection | API / Backend | — | Lives in `apps/api/src/plugins/redis.ts` — the Fastify plugin that initializes ioredis |
| OpenSearch URL format update | Config / Docs | — | No client code exists yet; only `.env.example` comment update |
| drizzle-kit migration URL | Build Tooling | — | `apps/api/drizzle.config.ts` reads `DATABASE_DIRECT_URL` for migration runs |
| CI secrets injection | CI / GitHub Actions | — | `.github/workflows/ci.yml` env block reads repository secrets |
| Docker reference sweep | Docs / Config | — | `.env.example`, `apps/api/.env.example`, planning docs |

---

## Standard Stack

No new packages are installed in this phase. All changes are configuration and code modifications within existing installed packages.

### Existing Packages Being Configured

| Package | Currently Installed | Change in This Phase |
|---------|--------------------|-----------------------|
| `drizzle-orm` (node-postgres adapter) | 0.45.x | Add SSL auto-detection in `drizzle.ts` plugin |
| `pg` (node-postgres) | 8.x | Pass `ssl: true` option to `Pool` when Neon URL detected |
| `ioredis` | 5.11.x | Pass `tls: {}` option when `REDIS_URL` starts with `rediss://` |
| `drizzle-kit` | 1.0.0-beta.x | Use `DATABASE_DIRECT_URL` instead of `DATABASE_URL` in `drizzle.config.ts` |
| `zod` | 4.4.x | Add `DATABASE_DIRECT_URL` (optional) to `envSchema` in `env.ts` |

### No Installation Required

This phase installs zero new packages. All needed libraries are already in the project.

---

## Package Legitimacy Audit

> No new packages are installed in this phase.

**Packages installed:** None.

---

## Architecture Patterns

### System Architecture Diagram

```
Developer / CI
     │
     ▼
.env file (DATABASE_URL, DATABASE_DIRECT_URL, REDIS_URL, OPENSEARCH_URL)
     │
     ├──► apps/api/src/config/env.ts (Zod envSchema parses + validates)
     │         │
     │         ├──► drizzle.ts plugin
     │         │       ├── detects ".neon.tech" or "sslmode=require" in DATABASE_URL
     │         │       └── Pool({ connectionString, ssl: true/false })
     │         │
     │         └──► redis.ts plugin
     │                 ├── detects "rediss://" prefix in REDIS_URL
     │                 └── new Redis(REDIS_URL, { tls: detectedTls })
     │
     └──► drizzle.config.ts  (uses DATABASE_DIRECT_URL for migrations)
               └── drizzle-kit migrate → Neon direct connection (non-pooled)

CI (GitHub Actions)
     │
     └── secrets.DATABASE_URL, secrets.REDIS_URL, secrets.OPENSEARCH_URL
              injected as env vars → same code path as local dev
```

### Recommended Project Structure Changes

No new directories are created. Changes are within existing files:

```
apps/api/
├── drizzle.config.ts        ← switch to DATABASE_DIRECT_URL
└── src/
    ├── config/
    │   └── env.ts           ← add DATABASE_DIRECT_URL to envSchema (optional)
    └── plugins/
        ├── drizzle.ts       ← add SSL auto-detection for Neon
        └── redis.ts         ← add TLS auto-detection for Upstash
.env.example                 ← update DATABASE_URL, REDIS_URL, OPENSEARCH_URL formats
apps/api/.env.example        ← sweep for docker references
.github/workflows/ci.yml     ← add env vars from secrets
docker-compose.yml           ← DELETE
```

### Pattern 1: SSL Auto-Detection in Drizzle Plugin

**What:** Detect Neon connection (via hostname or sslmode param) and pass `ssl: true` to `pg.Pool`.
**When to use:** Whenever `DATABASE_URL` points to Neon or any cloud Postgres requiring SSL.

```typescript
// apps/api/src/plugins/drizzle.ts
// Source: Neon docs (neon.com/docs/guides/drizzle) + pg package SSL option
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { env } from "../config/env.js";

function requiresSsl(connectionString: string): boolean {
  // Neon hostname or explicit sslmode=require query param
  return (
    connectionString.includes(".neon.tech") ||
    connectionString.includes("sslmode=require")
  );
}

const drizzlePlugin = fp(
  async (fastify) => {
    const ssl = requiresSsl(env.DATABASE_URL);
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ...(ssl ? { ssl: true } : {}),
    });

    await pool.query("SELECT 1");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: NodePgDatabase<any> = drizzle(pool);
    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await pool.end();
    });

    fastify.log.info(`Drizzle ORM connected to PostgreSQL (ssl=${ssl})`);
  },
  { name: "drizzle" },
);

export default drizzlePlugin;
```

**Note:** When `sslmode=require` is in the connection string, `pg` (node-postgres) respects it automatically without the explicit `ssl: true` option. Adding `ssl: true` explicitly is belt-and-suspenders and ensures it works even if the query param is stripped by a connection proxy. Both approaches are safe. [VERIFIED: neon.com/docs/guides/drizzle]

### Pattern 2: TLS Auto-Detection in Redis Plugin

**What:** Detect Upstash TLS connection (via `rediss://` scheme) and enable TLS on ioredis.
**When to use:** Whenever `REDIS_URL` uses the `rediss://` scheme (Upstash, AWS ElastiCache TLS).

```typescript
// apps/api/src/plugins/redis.ts
// Source: ioredis npm README + Upstash docs (upstash.com/docs/redis/integrations/bullmq)
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const redisPlugin = fp(
  async (fastify) => {
    const isTls = env.REDIS_URL.startsWith("rediss://");

    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
      ...(isTls ? { tls: {} } : {}),
    });

    await redis.connect();
    await redis.ping();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info(`Redis client connected (tls=${isTls})`);
  },
  { name: "redis" },
);

export default redisPlugin;
```

**Critical:** ioredis does parse `rediss://` and enables TLS automatically when passed as a URL string. Adding `tls: {}` explicitly is redundant but safe. However, some versions of ioredis have a bug where `parseRedisUrl()` internal helpers strip the TLS flag during URL parsing — the explicit `tls: {}` is the defensive fix. [VERIFIED: github.com/redis/ioredis + Upstash docs]

### Pattern 3: drizzle-kit Migration with Direct URL

**What:** Use a non-pooled Neon connection for drizzle-kit (avoids PgBouncer transaction-mode limitations during schema migration).
**When to use:** Whenever running `db:generate` or `db:migrate` against Neon.

```typescript
// apps/api/drizzle.config.ts
// Source: Neon docs (neon.com/docs/guides/drizzle-migrations)
import { defineConfig } from "drizzle-kit";

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    // DATABASE_DIRECT_URL: non-pooled Neon endpoint (no -pooler in hostname).
    // Required because drizzle-kit runs DDL statements that PgBouncer
    // transaction mode does not support.
    url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
```

**Note:** The `?? DATABASE_URL` fallback allows local dev (without Neon) to continue working if `DATABASE_DIRECT_URL` is not set — local Postgres does not need separate pool vs direct URLs.

### Pattern 4: OpenSearch Client Initialization (Phase 3 Preview)

**What:** Connect `@opensearch-project/opensearch` to Bonsai using credentials embedded in URL.
**When to use:** Phase 3 (Catalog & Search). Documented here for planning continuity.

```typescript
// future: apps/api/src/plugins/opensearch.ts
// Source: github.com/opensearch-project/opensearch-js USER_GUIDE.md
import { Client } from "@opensearch-project/opensearch";
import { env } from "../config/env.js";

// Bonsai uses publicly trusted CA certificates — no rejectUnauthorized:false needed.
// Credentials embedded in OPENSEARCH_URL: https://user:pass@cluster.bonsai.io
const client = new Client({
  node: env.OPENSEARCH_URL,
  ssl: {
    rejectUnauthorized: true, // Bonsai uses publicly trusted CA; default is fine
  },
});
```

**Note:** In this phase, no OpenSearch client code is written. Only the `OPENSEARCH_URL` format in `.env.example` is updated. The client initialization is Phase 3 scope.

### Pattern 5: GitHub Actions Secrets Injection

**What:** Pass cloud service credentials as environment variables from repository secrets.
**When to use:** CI workflow that needs DATABASE_URL, REDIS_URL, OPENSEARCH_URL without Docker service containers.

```yaml
# .github/workflows/ci.yml — env section addition
env:
  CI: "true"
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  DATABASE_DIRECT_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  REDIS_URL: ${{ secrets.REDIS_URL }}
  OPENSEARCH_URL: ${{ secrets.OPENSEARCH_URL }}
```

**Note:** The current `ci.yml` has NO Docker service containers defined — the current CI workflow only has lint/typecheck/format/test/build steps with no `services:` block. Removing Docker is therefore not a deletion from the workflow file, but an addition of the secrets-based env vars.

### Anti-Patterns to Avoid

- **Hardcoding `ssl: true` unconditionally in `drizzle.ts`:** Breaks local Postgres (which doesn't require SSL). Always detect from URL content.
- **Passing `rediss://` to ioredis without `tls: {}`:** Relies on ioredis URL parsing to set TLS, which has a documented bug in some versions. Always pair URL scheme detection with explicit `tls: {}`.
- **Using pooled DATABASE_URL for drizzle-kit migrations:** PgBouncer transaction mode does not support the session-level commands drizzle-kit uses during migration. Use `DATABASE_DIRECT_URL`.
- **Storing BullMQ connection on Upstash pay-per-request plan:** BullMQ polls Redis continuously (heartbeat, delayed job checks). This incurs unexpected costs on Upstash's pay-as-you-go plan. Document the Fixed plan recommendation in setup docs.
- **Setting `rejectUnauthorized: false` for Bonsai:** Not needed. Bonsai uses publicly trusted CA certificates. Using `false` weakens security unnecessarily.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| SSL detection in pg | Custom SSL cert loading logic | `ssl: true` on `pg.Pool` + `sslmode=require` in URL | node-postgres handles TLS handshake natively; no cert file needed for publicly trusted CAs |
| TLS detection in ioredis | Custom URL parser | `rediss://` scheme + `tls: {}` option | ioredis has built-in TLS support; explicit option is belt-and-suspenders for known parser bug |
| OpenSearch auth | Separate `auth` config object | Credentials embedded in node URL | `@opensearch-project/opensearch` parses Basic Auth from URL natively |

---

## Common Pitfalls

### Pitfall 1: Pooled URL for drizzle-kit Migrations

**What goes wrong:** `drizzle-kit migrate` hangs or fails with `SET` statement errors against Neon's pooled endpoint.
**Why it happens:** Neon's pooler (PgBouncer) runs in transaction mode. PgBouncer does not relay `SET` commands and does not maintain session state between transactions. Drizzle-kit (and migration tooling generally) relies on session-level state.
**How to avoid:** Introduce `DATABASE_DIRECT_URL` (Neon hostname without `-pooler`). Use it exclusively in `drizzle.config.ts`. Use `DATABASE_URL` (pooled) for the Fastify app server.
**Warning signs:** Migration hangs indefinitely; `ERROR: prepared statement "..." does not exist`; any PgBouncer error in migration output.

[CITED: neon.com/docs/guides/drizzle-migrations — "using a pooled connection string for migrations can lead to errors; use a direct (non-pooled) connection"]

### Pitfall 2: BullMQ Cost on Upstash Pay-Per-Request Plan

**What goes wrong:** Unexpectedly high Upstash bills from BullMQ background polling, even with no active jobs.
**Why it happens:** BullMQ checks for delayed jobs, stalled jobs, and heartbeats on a continuous timer. Each check is multiple Redis commands. On Upstash's pay-per-command pricing, this accumulates rapidly.
**How to avoid:** Use Upstash Fixed plan for any environment running BullMQ workers. Document this in the setup README.
**Warning signs:** Upstash command count in dashboard grows at ~1,000+ commands/minute even when no jobs are processed.

[CITED: upstash.com/docs/redis/integrations/bullmq — "BullMQ accesses Redis regularly, even when there is no queue activity... we recommend switching to a Fixed plan"]

### Pitfall 3: ioredis TLS Stripping on `rediss://` Parse

**What goes wrong:** ioredis connects without TLS even though `REDIS_URL` uses `rediss://`, causing connection reset.
**Why it happens:** In certain ioredis versions, internal `parseRedisUrl()` parses the URL into host/port/password components but reconstructs a config object without `tls: {}`, ignoring the `rediss://` scheme.
**How to avoid:** Always add explicit `tls: {}` when `REDIS_URL.startsWith("rediss://")` is true, in addition to passing the URL string. The two are not redundant — the explicit option is the safety net.
**Warning signs:** Upstash dashboard shows commands being counted (TCP connects) but the API throws `Connection reset by peer` or TLS handshake failures.

[CITED: github.com/docmost/docmost/issues/1681 — documented ioredis `parseRedisUrl` bug stripping TLS]

### Pitfall 4: BullMQ Upstash Incompatibility (Historical Context)

**What goes wrong:** Earlier versions of BullMQ (<v3) threw a hard error when detecting an Upstash hostname.
**Why it happened:** BullMQ requires Lua scripting and blocking commands (`BRPOPLPUSH`) which Upstash did not support.
**Current status:** BullMQ v3+ and v5+ removed the hard error. Upstash now officially documents BullMQ integration. The project uses BullMQ 5.x — the hard error is NOT thrown. However, full Lua scripting support on Upstash may still be limited; test queue functionality thoroughly before relying on it in CI.
**Warning signs:** BullMQ worker stalling, jobs not being processed, stalled job detection failures.

[CITED: upstash.com/docs/redis/integrations/bullmq + github.com/taskforcesh/bullmq/issues/1087]

### Pitfall 5: Bonsai Sandbox Shard Limit

**What goes wrong:** Bonsai Sandbox cluster rejects index creation or downgrades fail when shard count exceeds 10.
**Why it happens:** Bonsai's free Sandbox tier has a 10-shard limit. OpenSearch's default index creates 1 primary + 1 replica = 2 shards per index. With multiple indexes (products, categories, etc.) this can be reached.
**How to avoid:** Configure OpenSearch index creation with `number_of_replicas: 0` in Sandbox to halve shard usage. Document this in the Bonsai setup section of README.
**Warning signs:** Index creation returns 4xx errors; Bonsai dashboard shows shard count at limit.

[CITED: bonsai.io/faq — "Sandbox plan has a shard limit of 10"]

### Pitfall 6: Missing Docker Reference Sweep Scope

**What goes wrong:** Docker references survive in planning docs, test verification scripts, or SUMMARY files.
**Why it happens:** The sweep grep targets source code but misses markdown files in `.planning/phases/`.
**How to avoid:** Grep scope for Docker sweep must include: `*.env.example`, `.github/workflows/*.yml`, `*.md` (limited to non-planning docs), `apps/api/src/**/*.ts` comments. Planning phase docs (`.planning/phases/`) are historical artifacts and do NOT need to be updated — they are immutable execution records.
**Warning signs:** Buyer reads README or SUMMARY and sees `docker-compose up -d` instructions.

---

## Runtime State Inventory

> This is not a rename/refactor phase with stored runtime state. Omit.

---

## Files That Need to Change (Complete Inventory)

Derived from direct codebase inspection.

### Files to DELETE

| File | Current Content | Reason |
|------|----------------|---------|
| `docker-compose.yml` | postgres:16-alpine, redis:7-alpine, opensearch:2.18 services | D-10: deleted entirely |

### Files to MODIFY

| File | Current State | Required Change |
|------|--------------|-----------------|
| `apps/api/src/plugins/drizzle.ts` | `new Pool({ connectionString: env.DATABASE_URL })` — no SSL | Add `requiresSsl()` helper; pass `ssl: true` when Neon URL detected |
| `apps/api/src/plugins/redis.ts` | `new Redis(env.REDIS_URL, { lazyConnect, enableReadyCheck })` — no TLS | Add `isTls` detection; pass `tls: {}` when `rediss://` detected |
| `apps/api/src/config/env.ts` | Has `DATABASE_URL`, `REDIS_URL` — no `DATABASE_DIRECT_URL`, no `OPENSEARCH_URL` | Add `DATABASE_DIRECT_URL` (optional string with `.url()` validator); add `OPENSEARCH_URL` (optional string); update JSDoc comments to remove Docker references |
| `apps/api/drizzle.config.ts` | `url: process.env["DATABASE_URL"]!` | Change to `url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!` |
| `.env.example` | `DATABASE_URL=postgresql://grovio:grovio@localhost:5432/grovio` + docker-compose comments | Update to Neon pooled format; add `DATABASE_DIRECT_URL` example; update `REDIS_URL` to `rediss://` format; update `OPENSEARCH_URL` to Bonsai HTTPS format; replace all "docker-compose.yml" comment references |
| `apps/api/.env.example` | `DATABASE_URL=postgresql://grovio:grovio@localhost:5432/grovio` + docker-compose comments; `REDIS_URL=redis://localhost:6379` + docker-compose comments | Same URL format updates + Docker comment replacement; add `DATABASE_DIRECT_URL` |
| `.github/workflows/ci.yml` | Has `env: CI: "true"` only — NO Docker service containers (confirmed by inspection) | Add `DATABASE_URL`, `DATABASE_DIRECT_URL`, `REDIS_URL`, `OPENSEARCH_URL` to top-level `env:` block, reading from `${{ secrets.* }}` |

### Files to CREATE

| File | Content |
|------|---------|
| None | No new files required |

### Files with Docker References in Planning Docs (DO NOT MODIFY)

These are historical execution records — immutable artifacts. They reference Docker accurately for the time they were written:

- `.planning/phases/01-foundation/01-01-PLAN.md` — foundation plan that created docker-compose.yml
- `.planning/phases/01-foundation/01-08-PLAN.md` — foundation plan that wrote docker-compose references in .env.example
- `.planning/phases/01-foundation/01-10-PLAN.md`, `01-10-SUMMARY.md` — verification references Docker
- `.planning/phases/02-category-engine/02-03-SUMMARY.md`, `02-07-SUMMARY.md`, `02-08-SUMMARY.md` — summaries reference Docker for manual UAT steps
- `.planning/phases/02-category-engine/02-VERIFICATION.md`, `02-HUMAN-UAT.md` — verification instructions include Docker
- `.planning/ROADMAP.md` — references docker-compose in Phase 1 plan description

**Planner must decide:** Whether to update `ROADMAP.md` Phase 1 plan description to remove the `docker-compose infra` mention (since the file is now deleted). This is a "current docs" update, not a historical record. Recommend updating the one-liner in ROADMAP.md.

---

## Environment Availability Audit

This phase replaces local Docker with cloud services. No local tools are being added. The CI workflow already has Node.js 22 and pnpm configured.

| Dependency | Required By | Available Locally | Notes |
|------------|------------|-------------------|-------|
| Neon account + project | DATABASE_URL, DATABASE_DIRECT_URL | Not pre-provisioned | Buyer/developer must sign up at neon.com (free tier) |
| Upstash account + database | REDIS_URL | Not pre-provisioned | Buyer/developer must sign up at upstash.com (free tier) |
| Bonsai account + cluster | OPENSEARCH_URL | Not pre-provisioned | Buyer/developer must sign up at bonsai.io (free Sandbox) |
| GitHub Actions secrets | CI env vars | Not yet configured | Repository owner must add DATABASE_URL, DATABASE_DIRECT_URL, REDIS_URL, OPENSEARCH_URL to repo secrets before CI passes |

**Missing dependencies with no code fallback:**
- All three cloud accounts must be provisioned before the backend can start. This is by design (D-01).

---

## State of the Art

| Old Approach | Current Approach | Impact |
|--------------|------------------|--------|
| `docker-compose.yml` for local Postgres | Neon serverless Postgres (free tier) | No Docker Desktop required; always-on; instant provisioning |
| `docker-compose.yml` for local Redis | Upstash serverless Redis (free tier, TLS) | No Docker; `rediss://` scheme required; BullMQ Fixed plan recommended |
| `docker-compose.yml` for local OpenSearch | Bonsai managed OpenSearch (free Sandbox) | No Docker; HTTPS with basic auth in URL; 10-shard limit on Sandbox |
| Implicit no-SSL local connections | URL-scheme-based auto-detection | Same codebase works for local (plain) and cloud (TLS) with URL swap only |

**Deprecated / removed:**
- `docker-compose.yml` — deleted entirely per D-10.
- Docker Desktop requirement — eliminated as a prerequisite for local dev.
- Local credentials (`grovio/grovio`) — replaced by cloud-provisioned credentials.

---

## Validation Architecture

> `nyquist_validation: true` in config.json — validation section required.

### Test Framework

| Property | Value |
|----------|-------|
| Framework | Vitest 4.1.x |
| Config file | `apps/api/vitest.config.ts` (inferred — not directly inspected but standard for this stack) |
| Quick run command | `pnpm --filter @grovio/api test` |
| Full suite command | `pnpm turbo run test -- --passWithNoTests` |

### Phase Requirements → Test Map

This phase has no functional requirements (it is infrastructure/config only). There are no unit tests to write for URL-scheme detection logic beyond basic smoke tests of the startup sequence.

| Behavior | Test Type | Automated Command | Notes |
|----------|-----------|-------------------|-------|
| `requiresSsl()` returns `true` for Neon URL | Unit | `pnpm --filter @grovio/api test` | Add unit test in `drizzle.test.ts` or similar |
| `requiresSsl()` returns `false` for localhost URL | Unit | `pnpm --filter @grovio/api test` | Same file |
| `isTls` true for `rediss://` | Unit | `pnpm --filter @grovio/api test` | Add unit test in `redis.test.ts` or similar |
| `isTls` false for `redis://` | Unit | `pnpm --filter @grovio/api test` | Same file |
| Backend starts and passes `/health` with cloud creds | Manual / Integration | Manual (requires live cloud accounts) | Cannot automate without live credentials in CI |

### Wave 0 Gaps

The SSL/TLS detection helpers (`requiresSsl`, `isTls`) should be extracted to pure functions that can be unit-tested without starting Fastify. If they are defined as `const` inside the plugin closure, they cannot be tested. Extract them to the top of the plugin file (or a shared util) before writing tests.

- [ ] `apps/api/src/plugins/drizzle.test.ts` — covers `requiresSsl()` pure function
- [ ] `apps/api/src/plugins/redis.test.ts` — covers TLS scheme detection pure function

*(If no gaps are acceptable: "None — existing test infrastructure covers all phase requirements")*

---

## Security Domain

> `security_enforcement: true`, ASVS level 1.

### Applicable ASVS Categories

| ASVS Category | Applies | Standard Control |
|---------------|---------|-----------------|
| V2 Authentication | No | N/A — no new auth introduced |
| V3 Session Management | No | N/A |
| V4 Access Control | No | N/A |
| V5 Input Validation | Yes (partial) | `envSchema` (Zod) already validates `DATABASE_URL` and `REDIS_URL` as URLs; extend to `DATABASE_DIRECT_URL` and `OPENSEARCH_URL` |
| V6 Cryptography | Yes | TLS enforced for all cloud connections; never `rejectUnauthorized: false` on Bonsai |
| V9 Communication Security | Yes | All three services use TLS (Neon: sslmode=require, Upstash: rediss://, Bonsai: https://) |

### Known Threat Patterns

| Pattern | STRIDE | Standard Mitigation |
|---------|--------|---------------------|
| Credentials in URL (DATABASE_URL, REDIS_URL, OPENSEARCH_URL) | Information Disclosure | Never commit `.env` to git; `.gitignore` already covers `.env`; `.env.example` uses placeholder values only |
| TLS not enforced → man-in-the-middle | Tampering / Spoofing | URL-scheme auto-detection ensures TLS is active for all cloud connections |
| `rejectUnauthorized: false` in OpenSearch client | Spoofing | Do NOT use `false` for Bonsai — publicly trusted CA, full cert validation is correct |
| Secrets exposed in CI logs | Information Disclosure | GitHub Actions masks secrets in log output automatically; do not echo `DATABASE_URL` in CI steps |
| Local dev using cloud credentials (vs local Docker) | Data Exposure | `NODE_ENV=development` check for logging verbosity; warn buyers in README not to use production Neon/Upstash for load testing |

---

## Assumptions Log

| # | Claim | Section | Risk if Wrong |
|---|-------|---------|---------------|
| A1 | BullMQ 5.x does not throw a hard error for Upstash connections | Pitfall 4 | BullMQ workers would fail to start; would require a different Redis provider |
| A2 | Bonsai free Sandbox tier uses HTTPS with a publicly trusted CA (no self-signed cert) | Pattern 4, Security | `rejectUnauthorized: true` would fail; would need custom CA config |
| A3 | The current `ci.yml` has no Docker service containers (confirmed by file inspection) | Pattern 5 | If containers exist elsewhere, removing them would require more CI changes |
| A4 | `ioredis` parses `rediss://` URL and enables TLS — confirmed by npm README; explicit `tls: {}` is additive safety | Pattern 2 | Without explicit `tls: {}`, TLS could be silently dropped in some ioredis versions |

**Assumption A3 is CONFIRMED by inspection** — the `ci.yml` file has no `services:` block and no Docker-related steps. The CI workflow only runs lint, typecheck, format, test, and build steps. Adding env vars from secrets is purely additive.

---

## Open Questions

1. **DATABASE_DIRECT_URL in CI secrets**
   - What we know: Neon recommends direct URL for drizzle-kit migrations; `drizzle.config.ts` runs `db:migrate` and `db:generate` in CI via `pnpm turbo run ...`
   - What's unclear: Does the CI pipeline currently run `db:migrate` as part of the `test` turbo task? If not, `DATABASE_DIRECT_URL` is only needed locally for migration runs — not required as a CI secret yet.
   - Recommendation: Check `apps/api/package.json` `test` script — it runs `vitest run`, not `drizzle-kit`. So `DATABASE_DIRECT_URL` is needed locally for migrations but NOT as a CI secret for the current CI workflow. Add `DATABASE_DIRECT_URL` to `.env.example` with a comment that it is only needed when running `pnpm db:migrate`.

2. **Upstash Fixed vs Starter plan**
   - What we know: Upstash recommends Fixed plan for BullMQ to avoid per-command costs.
   - What's unclear: The free tier on Upstash is called "Free" not "Sandbox" — the Fixed plan costs money. The buyer README should document: use Free plan for initial setup/testing, upgrade to Fixed plan before putting BullMQ workers into production.
   - Recommendation: Document both tiers in README. Do not gate on Fixed plan — let buyer decide when worker load warrants the upgrade.

3. **OPENSEARCH_URL in env.ts envSchema**
   - What we know: `OPENSEARCH_URL` is in `.env.example` but NOT in `apps/api/src/config/env.ts` envSchema (verified by inspection). It was never added because no OpenSearch client code exists yet.
   - What's unclear: Should this phase add `OPENSEARCH_URL` to `envSchema`? Or leave it for Phase 3?
   - Recommendation: Add `OPENSEARCH_URL` as an optional (`.optional()`) field in `envSchema` in this phase, so the `.env.example` value is parsed and validated. This avoids a silent misconfiguration in Phase 3. Mark it optional because the backend currently starts fine without it (search is Phase 3).

4. **ROADMAP.md Phase 1 plan description**
   - What we know: ROADMAP.md `Phase 1` entry includes `"docker-compose infra"` in the `01-01-PLAN.md` description.
   - What's unclear: The planner must decide whether to update this historical description in ROADMAP.md.
   - Recommendation: Update the ROADMAP.md Phase 1 one-liner to remove `docker-compose infra` and replace with `cloud infra setup (Neon/Upstash/Bonsai)` — this is current-facing documentation, not an immutable execution record.

---

## Sources

### Primary (HIGH confidence)
- `apps/api/src/plugins/drizzle.ts` — direct codebase inspection; current `Pool` setup without SSL
- `apps/api/src/plugins/redis.ts` — direct codebase inspection; current ioredis setup without TLS
- `apps/api/src/config/env.ts` — direct codebase inspection; current envSchema fields
- `apps/api/drizzle.config.ts` — direct codebase inspection; current `DATABASE_URL` usage
- `.env.example` — direct codebase inspection; current docker-compose comment patterns
- `apps/api/.env.example` — direct codebase inspection; docker-compose references confirmed
- `.github/workflows/ci.yml` — direct codebase inspection; confirmed NO Docker services block
- `docker-compose.yml` — direct codebase inspection; postgres:16-alpine, redis:7-alpine, opensearch:2.18.0
- [neon.com/docs/connect/connect-from-any-app](https://neon.com/docs/connect/connect-from-any-app) — Neon SSL requirement; pooled vs direct distinction
- [neon.com/docs/connect/connection-pooling](https://neon.com/docs/connect/connection-pooling) — "schema migrations" must use direct connections
- [neon.com/docs/guides/drizzle-migrations](https://neon.com/docs/guides/drizzle-migrations) — "using a pooled connection string for migrations can lead to errors; use a direct (non-pooled) connection"
- [upstash.com/docs/redis/integrations/bullmq](https://upstash.com/docs/redis/integrations/bullmq) — BullMQ + Upstash official integration; TLS config; Fixed plan recommendation
- [github.com/taskforcesh/bullmq/issues/1087](https://github.com/taskforcesh/bullmq/issues/1087) — BullMQ Upstash incompatibility history; v3/v5 resolution

### Secondary (MEDIUM confidence)
- [github.com/opensearch-project/opensearch-js USER_GUIDE.md](https://github.com/opensearch-project/opensearch-js/blob/main/USER_GUIDE.md) — credentials-in-URL pattern; SSL config
- [bonsai.io/faq](https://bonsai.io/faq) — Sandbox tier: 10-shard limit; 1 sandbox per user
- [github.com/redis/ioredis npm README](https://www.npmjs.com/package/ioredis) — `rediss://` TLS auto-detection

### Tertiary (LOW confidence — flag for validation)
- [github.com/docmost/docmost/issues/1681](https://github.com/docmost/docmost/issues/1681) — ioredis `parseRedisUrl` TLS stripping bug (single source; may be version-specific)

---

## Metadata

**Confidence breakdown:**
- File change inventory: HIGH — all files inspected directly from codebase
- Neon connection config: HIGH — official Neon docs confirmed; drizzle-migrations guide explicitly covers this
- Upstash TLS / BullMQ: HIGH — official Upstash docs + BullMQ GitHub issue confirmed; v5 behavior verified
- Bonsai OpenSearch: MEDIUM — no Bonsai-specific Node.js client docs found; behavior extrapolated from opensearch-js USER_GUIDE + Bonsai blog
- CI workflow (no Docker services already): HIGH — confirmed by direct file inspection

**Research date:** 2026-05-30
**Valid until:** 2026-08-30 (infrastructure service APIs are stable; Bonsai tier limits and BullMQ compatibility worth re-checking if >3 months pass)
