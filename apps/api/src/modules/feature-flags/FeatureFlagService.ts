import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { featureFlags, type SelectFeatureFlag } from "../../db/schema/index.js";

interface FeatureFlagServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}

/**
 * FeatureFlagService
 *
 * Redis-first read path: checks cache before hitting the DB.
 * On a cache miss, reads from the DB and repopulates the cache.
 * TTL is driven by FEATURE_FLAG_TTL_SECONDS env var (default 60s).
 *
 * Redis key pattern: "ff:<flagKey>"
 *
 * isEnabled=false flags are treated as non-existent — getFlag() returns null,
 * getAllFlags() excludes them.
 *
 * Write path (CRUD) is intentionally absent; Phase 6 admin bolt-on will add it.
 */
export class FeatureFlagService {
  constructor(private deps: FeatureFlagServiceDeps) {}

  private redisKey(flagKey: string): string {
    return "ff:" + flagKey;
  }

  /**
   * Get a single feature flag value by key.
   * Returns null if the flag does not exist or is disabled.
   */
  async getFlag(key: string): Promise<string | null> {
    const { db, redis, env } = this.deps;

    // Redis-first: return cached value immediately if present.
    const cached = await redis.get(this.redisKey(key));
    if (cached !== null) return cached;

    // DB fallback on cache miss.
    const rows = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.key, key))
      .limit(1);

    const row = rows[0];
    if (!row || !row.isEnabled) return null;

    // Populate cache for subsequent reads.
    await redis.setex(this.redisKey(key), env.FEATURE_FLAG_TTL_SECONDS, row.value);
    return row.value;
  }

  /**
   * Get all enabled feature flags.
   * Each returned flag is also written into the Redis cache.
   */
  async getAllFlags(): Promise<SelectFeatureFlag[]> {
    const { db, redis, env } = this.deps;

    const rows = await db
      .select()
      .from(featureFlags)
      .where(eq(featureFlags.isEnabled, true));

    // Warm cache for every flag returned.
    for (const row of rows) {
      await redis.setex(this.redisKey(row.key), env.FEATURE_FLAG_TTL_SECONDS, row.value);
    }

    return rows;
  }

  /**
   * Invalidate the Redis cache entry for a single flag.
   * The next getFlag() call will re-read from the DB.
   */
  async invalidateFlag(key: string): Promise<void> {
    await this.deps.redis.del(this.redisKey(key));
  }

  /**
   * Invalidate all cached feature flags (keys matching "ff:*").
   * Subsequent reads will repopulate the cache from the DB.
   */
  async invalidateAllFlags(): Promise<void> {
    const keys = await this.deps.redis.keys("ff:*");
    if (keys.length > 0) {
      await this.deps.redis.del(...keys);
    }
  }
}
