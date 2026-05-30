import { z } from "zod";

/**
 * Zod schema for all environment variables required by the API.
 * Any missing or malformed variable causes a parse error at startup — fail fast.
 */
export const envSchema = z.object({
  /** Application environment. Defaults to "development". */
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  /** Port the HTTP server listens on. Defaults to 3001. */
  PORT: z.coerce.number().default(3001),

  /**
   * PostgreSQL connection string — pooled endpoint for the application server.
   * Neon format: postgresql://USER:PASSWORD@ep-xxx-pooler.neon.tech/DBNAME?sslmode=require
   * Local format: postgresql://USER:PASSWORD@localhost:5432/DBNAME
   *
   * TLS is enabled automatically when the URL contains `.neon.tech` or `sslmode=require`
   * (see requiresSsl() in plugins/drizzle.ts). No code change required when switching
   * between local and cloud — only the URL needs to change.
   *
   * Obtain: Create a Neon project at neon.tech and copy the pooled connection string.
   */
  DATABASE_URL: z.string().url(),

  /**
   * PostgreSQL direct (non-pooled) connection string — used exclusively by drizzle-kit
   * for schema migrations and the db:generate / db:migrate commands.
   *
   * Neon format: postgresql://USER:PASSWORD@ep-xxx.REGION.aws.neon.tech/DBNAME?sslmode=require
   * (no `-pooler` in the hostname — a direct connection bypasses PgBouncer)
   *
   * Why separate from DATABASE_URL: Neon's pooler runs PgBouncer in transaction mode,
   * which does not support the SET statements and session-level state that drizzle-kit
   * migrations rely on. Using the pooled URL for migrations causes hangs or errors.
   *
   * Optional: backend boots without it. Required only when running pnpm db:migrate.
   * Local Postgres does not need a separate direct URL — omit this var locally.
   *
   * Obtain: In Neon dashboard, copy the "Direct connection" string (not the pooled one).
   */
  DATABASE_DIRECT_URL: z.string().url().optional(),

  /**
   * Redis connection string — TLS-enabled endpoint for Upstash or any rediss:// provider.
   * Upstash format: rediss://:TOKEN@HOST.upstash.io:6380
   * Local format:   redis://localhost:6379
   *
   * TLS is enabled automatically when the URL starts with `rediss://`
   * (see detectRedisTls() in plugins/redis.ts). No code change required when switching
   * between local and cloud — only the URL needs to change.
   *
   * Obtain: Create an Upstash Redis database at upstash.com and copy the rediss:// URL.
   */
  REDIS_URL: z.string().url(),

  /**
   * OpenSearch / Bonsai connection URL including credentials.
   * Bonsai format: https://USER:PASSWORD@CLUSTER.bonsai.io
   *
   * Credentials are embedded in the URL (Basic Auth). Bonsai uses publicly trusted CA
   * certificates — do not set rejectUnauthorized: false.
   *
   * Optional: backend boots without it. Required only when OpenSearch client is
   * initialized (Phase 3 — Catalog & Search).
   *
   * Obtain: Create a Bonsai Sandbox cluster at bonsai.io and copy the access URL.
   */
  OPENSEARCH_URL: z.string().url().optional(),

  /**
   * HS256 JWT signing secret. Minimum 32 characters.
   * Generate: node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
   * Never reuse across environments.
   */
  JWT_SECRET: z.string().min(32),

  /**
   * Redis TTL in seconds for cached feature flag values.
   * Controls how quickly feature flag changes propagate. Defaults to 60 seconds.
   * Per architecture decision D-05: feature flags are DB-backed + Redis-cached.
   */
  FEATURE_FLAG_TTL_SECONDS: z.coerce.number().default(60),

  /**
   * Redis TTL in seconds for the cached category tree (the "cat:tree" key).
   * Controls how quickly category tree changes propagate to consumers on a Redis miss.
   * Defaults to 300 seconds (5 minutes).
   *
   * Note: CategoryService uses write-through invalidation — every admin mutation
   * (create, update, archive, reorder) calls redis.del("cat:tree") immediately after
   * the DB write. This TTL is therefore a safety net only (handles rare crash/gap
   * scenarios), not the primary propagation mechanism (D-03).
   */
  CATEGORY_TREE_TTL_SECONDS: z.coerce.number().default(300),
});

/** TypeScript type inferred from envSchema */
export type Env = z.infer<typeof envSchema>;

/**
 * Parsed and validated environment configuration.
 * Throws a ZodError at module load time if any variable is missing or invalid.
 * Import this object instead of reading process.env directly.
 */
export const env: Env = envSchema.parse(process.env);
