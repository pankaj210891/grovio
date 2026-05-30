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
   * PostgreSQL connection string.
   * Format: postgresql://USER:PASSWORD@HOST:PORT/DATABASE
   * Obtain: run docker-compose up postgres, then use the credentials in docker-compose.yml
   */
  DATABASE_URL: z.string().url(),

  /**
   * Redis connection string.
   * Format: redis://HOST:PORT or redis://:PASSWORD@HOST:PORT
   * Obtain: run docker-compose up redis
   */
  REDIS_URL: z.string().url(),

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
