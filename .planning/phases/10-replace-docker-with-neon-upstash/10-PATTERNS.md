# Phase 10: Replace Docker with Neon + Upstash - Pattern Map

**Mapped:** 2026-05-30
**Files analyzed:** 7 files (6 modified, 1 deleted)
**Analogs found:** 6 / 6 (docker-compose.yml is deletion-only — no pattern needed)

---

## File Classification

| New/Modified File | Role | Data Flow | Closest Analog | Match Quality |
|-------------------|------|-----------|----------------|---------------|
| `apps/api/src/plugins/drizzle.ts` | plugin/config | request-response | `apps/api/src/plugins/redis.ts` | exact (same plugin shape) |
| `apps/api/src/plugins/redis.ts` | plugin/config | request-response | `apps/api/src/plugins/drizzle.ts` | exact (same plugin shape) |
| `apps/api/src/config/env.ts` | config | — | `apps/api/src/config/env.ts` (self) | self-modification |
| `apps/api/drizzle.config.ts` | config/build-tool | — | `apps/api/drizzle.config.ts` (self) | self-modification |
| `.env.example` | config/docs | — | `apps/api/.env.example` | role-match (same var set) |
| `apps/api/.env.example` | config/docs | — | `.env.example` | role-match (same var set) |
| `.github/workflows/ci.yml` | CI config | — | `.github/workflows/ci.yml` (self) | self-modification |
| `docker-compose.yml` | infrastructure | — | — | DELETE — no pattern needed |

---

## Pattern Assignments

### `apps/api/src/plugins/drizzle.ts` (plugin, request-response)

**Analog:** `apps/api/src/plugins/redis.ts` (same Fastify plugin shape — `fp()` wrapper, `decorate`, `addHook("onClose")`, `fastify.log.info`)

**Current state** (full file, lines 1–33):
```typescript
import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { env } from "../config/env.js";

const drizzlePlugin = fp(
  async (fastify) => {
    const pool = new Pool({ connectionString: env.DATABASE_URL });

    await pool.query("SELECT 1");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: NodePgDatabase<any> = drizzle(pool);

    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await pool.end();
    });

    fastify.log.info("Drizzle ORM connected to PostgreSQL");
  },
  { name: "drizzle" },
);

export default drizzlePlugin;
```

**What changes:**
1. Add `requiresSsl(connectionString: string): boolean` pure function above the plugin closure (must be extractable for unit testing per RESEARCH.md Wave 0 Gaps).
2. Derive `ssl` from `requiresSsl(env.DATABASE_URL)`.
3. Spread `ssl: true` conditionally into the `Pool` constructor options.
4. Update `fastify.log.info` to include `(ssl=${ssl})`.

**Target state — core pattern to write:**
```typescript
// Exported so it can be unit-tested without starting Fastify.
export function requiresSsl(connectionString: string): boolean {
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
```

**Plugin structure analog** (from `apps/api/src/plugins/redis.ts` lines 11–33):
```typescript
const redisPlugin = fp(
  async (fastify) => {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
    });

    await redis.connect();
    await redis.ping();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info("Redis client connected");
  },
  { name: "redis" },
);
```

**Test file to create:** `apps/api/src/plugins/drizzle.test.ts`
- Import `requiresSsl` (named export, not default).
- Test: `requiresSsl("postgresql://user:pass@ep-xxx-pooler.neon.tech/db?sslmode=require")` → `true`
- Test: `requiresSsl("postgresql://grovio:grovio@localhost:5432/grovio")` → `false`
- Test: `requiresSsl("postgresql://user:pass@host/db?sslmode=require")` → `true` (sslmode only, no neon.tech)
- Follow the Vitest `describe/it/expect` pattern from `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` lines 1–3.

---

### `apps/api/src/plugins/redis.ts` (plugin, request-response)

**Analog:** `apps/api/src/plugins/drizzle.ts` (same Fastify plugin shape)

**Current state** (full file, lines 1–33):
```typescript
import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

const redisPlugin = fp(
  async (fastify) => {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
    });

    await redis.connect();
    await redis.ping();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info("Redis client connected");
  },
  { name: "redis" },
);

export default redisPlugin;
```

**What changes:**
1. Add `isTls` boolean derived from `env.REDIS_URL.startsWith("rediss://")` before the `Redis` constructor.
2. Spread `tls: {}` conditionally into the ioredis options object.
3. Update `fastify.log.info` to include `(tls=${isTls})`.
4. Extract the detection to a named export for unit testing: `export function detectRedisTls(url: string): boolean`.

**Target state — core pattern to write:**
```typescript
// Exported so it can be unit-tested without starting Fastify.
export function detectRedisTls(url: string): boolean {
  return url.startsWith("rediss://");
}

const redisPlugin = fp(
  async (fastify) => {
    const isTls = detectRedisTls(env.REDIS_URL);

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
```

**Test file to create:** `apps/api/src/plugins/redis.test.ts`
- Import `detectRedisTls` (named export).
- Test: `detectRedisTls("rediss://:token@xxx.upstash.io:6380")` → `true`
- Test: `detectRedisTls("redis://localhost:6379")` → `false`
- Test: `detectRedisTls("redis://:password@host:6379")` → `false`

---

### `apps/api/src/config/env.ts` (config, self-modification)

**Current state** (full file, lines 1–63): Already read above.

**What changes:**
1. Add `DATABASE_DIRECT_URL` as an optional field (`.optional()`) after `DATABASE_URL`. It is optional because local dev without Neon does not need a separate direct URL.
2. Add `OPENSEARCH_URL` as an optional field. Optional because Phase 3 has not shipped yet — the backend starts fine without it.
3. Update JSDoc comments on `DATABASE_URL` and `REDIS_URL` to replace "docker-compose.yml" references with Neon/Upstash equivalents.

**Existing envSchema field pattern to copy** (lines 14–26):
```typescript
/**
 * PostgreSQL connection string.
 * Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
 * Obtain: run docker-compose up postgres, then use the credentials in docker-compose.yml
 */
DATABASE_URL: z.string().url(),

/**
 * Redis connection string.
 * Format: redis://HOST:PORT  or  redis://:PASSWORD@HOST:PORT (authenticated)
 * Obtain: run docker-compose up redis
 */
REDIS_URL: z.string().url(),
```

**Target additions — fields to add after `DATABASE_URL`:**
```typescript
/**
 * PostgreSQL direct (non-pooled) connection string for drizzle-kit migrations.
 * Format: postgresql://USER:PASSWORD@ep-xxx.neon.tech/grovio  (no -pooler in hostname)
 * Required when running `pnpm db:migrate` or `pnpm db:generate` against Neon.
 * Not needed for local PostgreSQL (which has no pooler distinction).
 * Optional — falls back to DATABASE_URL in drizzle.config.ts if not set.
 */
DATABASE_DIRECT_URL: z.string().url().optional(),
```

**Target addition — field to add after `REDIS_URL` block:**
```typescript
/**
 * OpenSearch / Bonsai endpoint URL (with credentials).
 * Format: https://user:pass@xxx.bonsai.io
 * Required from Phase 3 (Catalog & Search) onwards. Optional until then.
 * Obtain: Create a free Sandbox cluster at bonsai.io → copy the cluster URL.
 */
OPENSEARCH_URL: z.string().url().optional(),
```

**Updated JSDoc for DATABASE_URL:**
```typescript
/**
 * PostgreSQL connection string (pooled endpoint for the app server).
 * Format: postgresql://USER:PASSWORD@ep-xxx-pooler.neon.tech/grovio?sslmode=require
 * Obtain: Create a Neon project at neon.com → Connection Details → Pooled connection string.
 * SSL is auto-detected: ssl:true is applied when hostname contains .neon.tech or URL contains sslmode=require.
 */
DATABASE_URL: z.string().url(),
```

**Updated JSDoc for REDIS_URL:**
```typescript
/**
 * Redis connection string.
 * Format (Upstash TLS): rediss://:TOKEN@xxx.upstash.io:6380
 * Obtain: Create a database at upstash.com → Details → ioredis connection string.
 * TLS is auto-detected: tls:{} is applied when URL starts with rediss://.
 */
REDIS_URL: z.string().url(),
```

---

### `apps/api/drizzle.config.ts` (config/build-tool, self-modification)

**Current state** (full file, lines 1–20): Already read above.

**What changes:**
- Line 18: change `url: process.env["DATABASE_URL"]!` to `url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!`
- Update JSDoc comment above `dbCredentials` to explain the pooled vs direct distinction.

**Target state — full replacement:**
```typescript
import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * - dialect: postgresql — Drizzle Kit generates PostgreSQL-flavoured SQL migrations.
 * - schema:  ./src/db/schema/index.ts — barrel that aggregates all table definitions.
 * - out:     ./src/db/migrations — migration files written here by `pnpm db:generate`.
 *
 * DATABASE_DIRECT_URL: non-pooled Neon connection string (hostname without -pooler).
 * Required for drizzle-kit because Neon's pooler (PgBouncer) runs in transaction mode
 * and does not support the session-level SET statements that migration tools rely on.
 * Falls back to DATABASE_URL if DATABASE_DIRECT_URL is not set (safe for local Postgres,
 * which has no pooler distinction).
 *
 * Set DATABASE_DIRECT_URL in your .env before running `pnpm db:migrate` against Neon.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
```

---

### `.env.example` (config/docs, self-modification)

**Current state** (full file, lines 1–85): Already read above.

**What changes — section by section:**

**Database section** (currently lines 18–22): Replace docker-compose comment and localhost URL.
```bash
# =============================================================
# Database
# =============================================================
# PostgreSQL pooled connection string (app server).
# Format: postgresql://USER:PASSWORD@ep-xxx-pooler.neon.tech/DATABASE?sslmode=require
# Obtain: neon.com → New Project → Connection Details → Pooled connection string.
# SSL is enforced automatically when the URL contains .neon.tech or sslmode=require.
DATABASE_URL=postgresql://user:pass@ep-cool-name-123456-pooler.neon.tech/grovio?sslmode=require

# PostgreSQL direct (non-pooled) connection string — used ONLY by drizzle-kit migrations.
# Format: postgresql://USER:PASSWORD@ep-xxx.neon.tech/DATABASE  (no -pooler in hostname)
# Obtain: neon.com → Connection Details → Direct connection string.
# Only required when running: pnpm db:migrate  or  pnpm db:generate
DATABASE_DIRECT_URL=postgresql://user:pass@ep-cool-name-123456.neon.tech/grovio?sslmode=require
```

**Redis section** (currently lines 27–32): Replace docker-compose comment and localhost URL.
```bash
# =============================================================
# Redis
# =============================================================
# Redis connection string (TLS required for Upstash).
# Format: rediss://:TOKEN@HOST:PORT  (note: rediss:// = TLS, redis:// = plain)
# Obtain: upstash.com → New Database → Details → ioredis connection string.
# TLS is enforced automatically when the URL starts with rediss://.
# Note: Use a Fixed plan (not pay-per-request) for environments running BullMQ workers.
REDIS_URL=rediss://:your-upstash-token@your-db.upstash.io:6380
```

**OpenSearch section** (currently lines 62–68): Replace docker-compose comment and localhost URL.
```bash
# =============================================================
# OpenSearch
# =============================================================
# OpenSearch / Bonsai endpoint URL (credentials embedded in URL).
# Format: https://USER:PASSWORD@CLUSTER.bonsai.io
# Obtain: bonsai.io → New Cluster (Sandbox free tier) → Access → Credentials.
# Required from Phase 3 (Catalog & Search) onwards. Leave the example value if not yet needed.
# Note: Bonsai Sandbox is limited to 10 shards — set number_of_replicas:0 on each index.
OPENSEARCH_URL=https://your-user:your-pass@your-cluster.bonsai.io
```

**Comment style analog** (from existing `.env.example` lines 42–48 for JWT — copy section header + multi-line comment pattern):
```bash
# =============================================================
# Authentication
# =============================================================
# Secret key for HS256 JWT signing and verification.
# Must be at least 32 characters. Never commit your real secret.
# Generate: openssl rand -hex 32
JWT_SECRET=ra/fOxTCs/T5mHwwvagol7RBZ4s8yjZRb//sbtkfjq0=
```

---

### `apps/api/.env.example` (config/docs, self-modification)

**Current state** (full file, lines 1–37): Already read above.

**What changes:**
1. Replace `DATABASE_URL` docker comment and localhost value with Neon pooled format.
2. Add `DATABASE_DIRECT_URL` block after `DATABASE_URL`.
3. Replace `REDIS_URL` docker comment and localhost value with Upstash TLS format.
4. Add `OPENSEARCH_URL` block (optional, Phase 3) after `REDIS_URL` or after `FEATURE_FLAG_TTL_SECONDS`.

**Target `DATABASE_URL` block:**
```bash
# PostgreSQL connection string (REQUIRED).
# Format: postgresql://USER:PASSWORD@ep-xxx-pooler.neon.tech/DATABASE?sslmode=require
# Obtain: neon.com → New Project → Connection Details → Pooled connection string.
# SSL is auto-detected from URL — no extra config needed.
DATABASE_URL=postgresql://user:pass@ep-cool-name-123456-pooler.neon.tech/grovio?sslmode=require

# PostgreSQL direct (non-pooled) connection string — used ONLY by drizzle-kit migrations.
# Format: postgresql://USER:PASSWORD@ep-xxx.neon.tech/DATABASE  (no -pooler in hostname)
# Only required when running: pnpm db:migrate  or  pnpm db:generate
DATABASE_DIRECT_URL=postgresql://user:pass@ep-cool-name-123456.neon.tech/grovio?sslmode=require
```

**Target `REDIS_URL` block:**
```bash
# Redis connection string (REQUIRED).
# Format: rediss://:TOKEN@HOST:PORT  (Upstash uses rediss:// — TLS enforced)
# Obtain: upstash.com → New Database → Details → ioredis connection string.
# TLS is auto-detected — no extra config needed.
# Note: Use a Fixed plan for environments running BullMQ workers to avoid per-command billing.
REDIS_URL=rediss://:your-upstash-token@your-db.upstash.io:6380
```

**Target `OPENSEARCH_URL` addition** (add at end, after FEATURE_FLAG_TTL_SECONDS):
```bash
# OpenSearch / Bonsai endpoint URL (OPTIONAL until Phase 3).
# Format: https://USER:PASSWORD@CLUSTER.bonsai.io
# Obtain: bonsai.io → New Cluster (Sandbox free tier) → Access → Credentials.
# Required from Phase 3 (Catalog & Search) onwards.
OPENSEARCH_URL=https://your-user:your-pass@your-cluster.bonsai.io
```

---

### `.github/workflows/ci.yml` (CI config, self-modification)

**Current state** (full file, lines 1–64): Already read above.

**What changes:**
- Extend the top-level `env:` block (currently lines 9–10) to add cloud service credentials from repository secrets.
- No `services:` block exists — confirmed by file inspection (assumption A3 in RESEARCH.md is CONFIRMED). This is a purely additive change.

**Current `env:` block** (lines 9–10):
```yaml
env:
  CI: "true"
```

**Target `env:` block:**
```yaml
env:
  CI: "true"
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  DATABASE_DIRECT_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  REDIS_URL: ${{ secrets.REDIS_URL }}
  OPENSEARCH_URL: ${{ secrets.OPENSEARCH_URL }}
```

**Pattern note:** `DATABASE_DIRECT_URL` is included even though the current CI `test` turbo task runs `vitest run` (not `drizzle-kit migrate`). Adding it now is forward-safe — it costs nothing and ensures `drizzle.config.ts` works if CI ever runs `db:migrate`. The RESEARCH.md open question recommends this approach.

---

### `docker-compose.yml` (DELETE — no pattern needed)

This file is deleted entirely per decision D-10. No analog pattern required.

The current file (lines 1–97) contains: `postgres:16-alpine`, `redis:7-alpine`, `opensearch:2.18.0` services plus named volumes. All three services are being replaced by Neon, Upstash, and Bonsai respectively.

---

## Shared Patterns

### Fastify Plugin Shape
**Source:** `apps/api/src/plugins/redis.ts` and `apps/api/src/plugins/drizzle.ts`
**Apply to:** Both plugin files (drizzle.ts and redis.ts modifications follow this exact shape)
```typescript
// Structure: fp(async (fastify) => { ... setup ... decorate ... addHook("onClose") ... log.info }, { name: "..." })
const plugin = fp(
  async (fastify) => {
    // 1. derive config from env
    // 2. initialize client
    // 3. verify connectivity (ping / SELECT 1)
    // 4. fastify.decorate(...)
    // 5. fastify.addHook("onClose", async () => { /* cleanup */ })
    // 6. fastify.log.info(...)
  },
  { name: "plugin-name" },
);
export default plugin;
```

### Zod envSchema Field Pattern
**Source:** `apps/api/src/config/env.ts` lines 7–53
**Apply to:** New fields `DATABASE_DIRECT_URL` and `OPENSEARCH_URL` in `env.ts`
```typescript
// Required string URL:
FIELD_NAME: z.string().url(),

// Optional string URL (field may be absent):
FIELD_NAME: z.string().url().optional(),

// Required string with minimum length:
FIELD_NAME: z.string().min(32),

// Coerced number with default:
FIELD_NAME: z.coerce.number().default(60),
```

### Env Example Comment Pattern
**Source:** `.env.example` lines 8–13 (NODE_ENV section), lines 18–22 (Database section), lines 27–32 (Redis section)
**Apply to:** All updated sections in both `.env.example` files
```bash
# =============================================================
# Section Name
# =============================================================
# Variable description.
# Format: <format hint>
# Obtain: <where to get the value>
VARIABLE_NAME=example-value
```

The `apps/api/.env.example` uses a slightly lighter format (no `=====` banners, just `#` prefix comments) — match the style already in each file rather than forcing the root format onto the API-specific file.

### Named Export for Testability
**Source:** `apps/api/src/modules/feature-flags/FeatureFlagService.test.ts` lines 1–3 (Vitest import pattern)
**Apply to:** `requiresSsl` in `drizzle.ts` and `detectRedisTls` in `redis.ts`
```typescript
// Pattern: export pure helper function from module top, before plugin closure
export function helperFn(input: string): boolean {
  // pure — no side effects, no Fastify deps
}
// Then the plugin default export follows
const plugin = fp(async (fastify) => { ... });
export default plugin;
```
This allows `import { requiresSsl } from "./drizzle.js"` in test files without instantiating Fastify.

---

## No Analog Found

All files have clear analogs or are self-modifications. No file in this phase requires a pattern from outside the codebase.

---

## Metadata

**Analog search scope:** `apps/api/src/plugins/`, `apps/api/src/config/`, `apps/api/drizzle.config.ts`, `.env.example`, `apps/api/.env.example`, `.github/workflows/ci.yml`, `apps/api/src/modules/*/` (test pattern)
**Files scanned:** 10 source files read directly
**Pattern extraction date:** 2026-05-30
