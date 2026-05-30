---
phase: 10-replace-docker-with-neon-upstash
reviewed: 2026-05-30T18:14:27Z
depth: standard
files_reviewed: 10
files_reviewed_list:
  - .env.example
  - .github/workflows/ci.yml
  - README.md
  - apps/api/.env.example
  - apps/api/drizzle.config.ts
  - apps/api/src/config/env.ts
  - apps/api/src/plugins/drizzle.test.ts
  - apps/api/src/plugins/drizzle.ts
  - apps/api/src/plugins/redis.test.ts
  - apps/api/src/plugins/redis.ts
findings:
  critical: 3
  warning: 4
  info: 2
  total: 9
status: issues_found
---

# Phase 10: Code Review Report

**Reviewed:** 2026-05-30T18:14:27Z
**Depth:** standard
**Files Reviewed:** 10
**Status:** issues_found

## Summary

This phase replaces Docker-based local infrastructure with three cloud-hosted free-tier services (Neon PostgreSQL, Upstash Redis, Bonsai OpenSearch) and adds TLS-aware connection helpers in the Fastify plugin layer. The approach is architecturally sound and the pure-function / unit-test pattern for `requiresSsl` and `detectRedisTls` is correct. However, three defects require fixes before the code ships: a connection leak in the Drizzle plugin on startup failure, an identical leak in the Redis plugin, and a missing `JWT_SECRET` CI secret that will cause every CI test run to crash at env-parse time.

---

## Critical Issues

### CR-01: Pool connection leaked when startup connectivity check fails in drizzle plugin

**File:** `apps/api/src/plugins/drizzle.ts:31-45`

**Issue:** A `new Pool(...)` is created at line 31. At line 37, `pool.query("SELECT 1")` is awaited to verify connectivity. If this throws (wrong credentials, network error, DNS failure), execution exits the plugin body before reaching `fastify.addHook("onClose", ...)` at line 44. The `onClose` hook is therefore never registered, and `pool.end()` is never called. The pg `Pool` object holds open idle connections; on Neon these are real TCP connections to a remote host. The process exits eventually, but during any retry or graceful-shutdown path the pool is left open.

**Fix:** Wrap the startup check in a try/catch and end the pool on failure before re-throwing:

```typescript
const drizzlePlugin = fp(
  async (fastify) => {
    const ssl = requiresSsl(env.DATABASE_URL);
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ...(ssl ? { ssl: true } : {}),
    });

    try {
      await pool.query("SELECT 1");
    } catch (err) {
      await pool.end();
      throw err;
    }

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

---

### CR-02: Redis client leaked when startup connectivity check fails in redis plugin

**File:** `apps/api/src/plugins/redis.ts:31-48`

**Issue:** The `Redis` client is created at line 31. Lines 40-41 call `redis.connect()` then `redis.ping()`. If either throws — misconfigured URL, bad Upstash token, network timeout — execution exits the plugin before `fastify.addHook("onClose", ...)` at line 45, so `redis.quit()` is never called. ioredis holds a socket and an internal retry timer even on a failed connection attempt; this leaks both the socket descriptor and the timer, preventing clean process shutdown.

**Fix:** Wrap the startup sequence in try/catch and quit the client on failure:

```typescript
const redisPlugin = fp(
  async (fastify) => {
    const isTls = detectRedisTls(env.REDIS_URL);

    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
      ...(isTls ? { tls: {} } : {}),
    });

    try {
      await redis.connect();
      await redis.ping();
    } catch (err) {
      await redis.quit();
      throw err;
    }

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info(`Redis client connected (tls=${isTls})`);
  },
  { name: "redis" },
);
```

---

### CR-03: JWT_SECRET is absent from CI environment — all CI runs crash at env-parse time

**File:** `.github/workflows/ci.yml:9-14`

**Issue:** `apps/api/src/config/env.ts:77` declares `JWT_SECRET: z.string().min(32)` — it is **required** (no `.optional()`, no `.default()`). The module-level `envSchema.parse(process.env)` at line 107 throws a `ZodError` at import time if `JWT_SECRET` is missing. The CI `env:` block (lines 9-14) passes only `DATABASE_URL`, `DATABASE_DIRECT_URL`, `REDIS_URL`, and `OPENSEARCH_URL` from secrets; `JWT_SECRET` is absent. Any CI step that imports `env.ts` — which includes lint, typecheck, test, and build — will fail with an unhandled ZodError rather than a meaningful test failure. The README CI section (lines 151-156) also fails to document `JWT_SECRET` as a required secret.

**Fix:** Add `JWT_SECRET` to the CI `env:` block and document it in the README secrets table:

```yaml
# .github/workflows/ci.yml
env:
  CI: "true"
  DATABASE_URL: ${{ secrets.DATABASE_URL }}
  DATABASE_DIRECT_URL: ${{ secrets.DATABASE_DIRECT_URL }}
  REDIS_URL: ${{ secrets.REDIS_URL }}
  OPENSEARCH_URL: ${{ secrets.OPENSEARCH_URL }}
  JWT_SECRET: ${{ secrets.JWT_SECRET }}
```

Add to README.md "CI / GitHub Actions" secrets list:
```
- `JWT_SECRET` — HS256 signing secret (generate: `openssl rand -hex 32`)
```

---

## Warnings

### WR-01: drizzle.config.ts uses non-null assertion on DATABASE_URL — validation is bypassed outside Zod

**File:** `apps/api/drizzle.config.ts:26`

**Issue:** `process.env["DATABASE_URL"]!` uses a TypeScript non-null assertion. `drizzle.config.ts` is loaded by `drizzle-kit` directly (not by the Fastify server), so `env.ts` is not imported and Zod validation does not run. If both `DATABASE_DIRECT_URL` and `DATABASE_URL` are unset, the `!` assertion silences TypeScript but `undefined` is passed to `defineConfig`. The `drizzle-kit` CLI will then produce a misleading error about the connection rather than identifying the missing env var as the root cause.

**Fix:** Add an explicit guard:

```typescript
const migrationUrl =
  process.env["DATABASE_DIRECT_URL"] ??
  process.env["DATABASE_URL"];

if (!migrationUrl) {
  throw new Error(
    "DATABASE_DIRECT_URL (or DATABASE_URL as fallback) must be set before running drizzle-kit.\n" +
    "Copy apps/api/.env.example to apps/api/.env and fill in the Neon connection strings.",
  );
}

export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: { url: migrationUrl },
});
```

---

### WR-02: enableReadyCheck: true is incompatible with Upstash managed Redis

**File:** `apps/api/src/plugins/redis.ts:33`

**Issue:** `enableReadyCheck: true` causes ioredis to wait for Redis to emit a `READY` response after connecting. Upstash's serverless Redis does not support the `READY` check — Upstash's own documentation and the `@upstash/redis` package explicitly state that `enableReadyCheck` must be `false`. With `enableReadyCheck: true`, ioredis will time out or throw on the connection handshake when connecting to Upstash, making the Redis plugin fail for every Upstash user despite correct credentials.

**Fix:**

```typescript
const redis = new Redis(env.REDIS_URL, {
  lazyConnect: true,
  enableReadyCheck: false,   // must be false for Upstash managed Redis
  ...(isTls ? { tls: {} } : {}),
});
```

---

### WR-03: apps/api/.env.example is missing CATEGORY_TREE_TTL_SECONDS, GOOGLE_SMTP_USER, GOOGLE_SMTP_PASS, and GOOGLE_MAPS_API_KEY

**File:** `apps/api/.env.example` (full file)

**Issue:** `apps/api/src/config/env.ts` is the authoritative source of all env variables. It declares `CATEGORY_TREE_TTL_SECONDS` (line 96) with a default but no comment says it is optional; buyers have no visibility into it from `apps/api/.env.example`. The root `.env.example` carries `GOOGLE_SMTP_USER`, `GOOGLE_SMTP_PASS`, and `GOOGLE_MAPS_API_KEY`, but these may be needed by the API layer as the codebase grows and are silently absent from the API-specific file. The header of `apps/api/.env.example` says "All variables without defaults are REQUIRED" — which is accurate for the file as written, but a buyer who only reads that file has an incomplete picture. This creates a setup breakage risk when those variables are later consumed by API code.

**Fix:** Add the missing entries to `apps/api/.env.example` even if listed as optional:

```env
# Redis cache TTL in seconds for the category tree key.
# Safety-net TTL — CategoryService uses write-through invalidation.
CATEGORY_TREE_TTL_SECONDS=300

# Google SMTP (required when email sending is enabled — Phase 8+)
GOOGLE_SMTP_USER=your-gmail-address@gmail.com
GOOGLE_SMTP_PASS=your-16-character-gmail-app-password

# Google Maps / Places API key (required Phase 4+)
GOOGLE_MAPS_API_KEY=your-google-maps-api-key-here
```

---

### WR-04: requiresSsl does not trigger on sslmode=verify-full or sslmode=verify-ca

**File:** `apps/api/src/plugins/drizzle.ts:15-19`

**Issue:** The function checks only for `.neon.tech` or `sslmode=require`. The PostgreSQL SSL modes `sslmode=verify-full` and `sslmode=verify-ca` also require SSL. A buyer connecting to a non-Neon cloud Postgres (e.g., Supabase, Railway, AWS RDS) using `sslmode=verify-full` will receive `ssl: false` from `requiresSsl`, causing a plaintext connection attempt that will be rejected by the server, with no clear error about the mismatch.

**Fix:** Extend the check to cover all SSL-requiring modes:

```typescript
export function requiresSsl(connectionString: string): boolean {
  return (
    connectionString.includes(".neon.tech") ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("sslmode=verify-full") ||
    connectionString.includes("sslmode=verify-ca")
  );
}
```

Also add a test case for `sslmode=verify-full` in `drizzle.test.ts`.

---

## Info

### IN-01: NodePgDatabase typed as any — eslint-disable comment covers a real gap

**File:** `apps/api/src/plugins/drizzle.ts:39-40`

**Issue:** `const db: NodePgDatabase<any>` is an explicitly untyped Drizzle instance. The schema barrel at `./src/db/schema/index.ts` already exists in the codebase. Once the schema is imported, Drizzle can infer full query-result types. The `// eslint-disable-next-line @typescript-eslint/no-explicit-any` comment is a tracking signal that this is a known gap, but leaving it unaddressed means all query results across the entire app will resolve to `any`, defeating TypeScript strict-mode guarantees project-wide.

**Fix:** Import the schema type and parameterize the Drizzle instance:

```typescript
import * as schema from "../db/schema/index.js";
// ...
const db = drizzle(pool, { schema });
fastify.decorate("db", db);
```

Update `src/types/fastify.d.ts` to type the `db` decoration with the inferred `typeof db` or the exported Drizzle schema type.

---

### IN-02: Root .env.example and apps/api/.env.example duplicate five variables with no cross-reference

**File:** `.env.example` and `apps/api/.env.example`

**Issue:** `NODE_ENV`, `PORT`, `DATABASE_URL`, `DATABASE_DIRECT_URL`, and `REDIS_URL` appear in both files. The README setup section at line 107-108 tells buyers to copy and fill in both files with the same values, but there is no comment in either file explaining why the duplication exists or which file is the authoritative source for which variable. This creates a maintenance hazard — a future change to an example value in one file is silently missed in the other.

**Fix:** Add a comment near the top of `apps/api/.env.example` explaining the relationship:

```env
# Note: DATABASE_URL, DATABASE_DIRECT_URL, REDIS_URL, NODE_ENV, and PORT
# are also present in the root .env.example (shared infrastructure reference).
# apps/api reads its .env directly — keep both files in sync.
```

---

_Reviewed: 2026-05-30T18:14:27Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
