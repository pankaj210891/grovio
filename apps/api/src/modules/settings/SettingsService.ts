import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { marketplaceSettings } from "../../db/schema/index.js";

interface SettingsServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}

/**
 * SettingsService
 *
 * Redis-first read path: checks cache before hitting the DB.
 * On a cache miss, reads from marketplace_settings and populates the cache.
 * TTL is driven by FEATURE_FLAG_TTL_SECONDS env var (reused for settings — D-19).
 *
 * Redis key pattern: "settings:<key>"
 *
 * Write path (updateSetting): UPSERT into marketplace_settings, then invalidate
 * the Redis cache entry — cache invalidation happens AFTER the DB write (Pitfall 3
 * ordering, T-06-14).
 *
 * Mirrors FeatureFlagService design:
 * - Same deps interface shape (db, redis, env)
 * - Same Redis-first read / invalidate-on-write pattern
 * - Same TTL env var (FEATURE_FLAG_TTL_SECONDS)
 *
 * No isEnabled flag — all rows in marketplace_settings are live settings.
 * getAllSettings is uncached (admin-only, low-frequency access).
 *
 * Covers D-19, ADM-05, T-06-14.
 */
export class SettingsService {
  constructor(private deps: SettingsServiceDeps) {}

  private redisKey(key: string): string {
    return "settings:" + key;
  }

  /**
   * Get a single marketplace setting by key.
   * Returns null if the key does not exist.
   *
   * Redis-first: returns the cached value immediately if present.
   * On a cache miss, reads from the DB and populates the cache with setex.
   *
   * @param key - Canonical snake_case setting key (e.g., 'store_name')
   * @returns Parsed JSONB value, or null if the key is not found
   */
  async getSetting(key: string): Promise<unknown | null> {
    const { db, redis, env } = this.deps;

    // Redis-first: return cached value immediately if present.
    const cached = await redis.get(this.redisKey(key));
    if (cached !== null) return JSON.parse(cached);

    // DB fallback on cache miss.
    const rows = await db
      .select()
      .from(marketplaceSettings)
      .where(eq(marketplaceSettings.key, key))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Populate cache for subsequent reads.
    await redis.setex(
      this.redisKey(key),
      env.FEATURE_FLAG_TTL_SECONDS,
      JSON.stringify(row.value),
    );
    return row.value;
  }

  /**
   * Get all marketplace settings as a key→value record.
   *
   * Reads directly from the DB every time — not cached (admin settings page is
   * low-frequency access, no need for Redis overhead here).
   *
   * @returns Record mapping setting key to its JSONB value
   */
  async getAllSettings(): Promise<Record<string, unknown>> {
    const { db } = this.deps;

    const rows = await db.select().from(marketplaceSettings);

    const result: Record<string, unknown> = {};
    for (const row of rows) {
      result[row.key] = row.value;
    }
    return result;
  }

  /**
   * Upsert a marketplace setting and invalidate the Redis cache.
   *
   * Performs: INSERT ... ON CONFLICT (key) DO UPDATE SET value, updated_at
   * Then deletes the Redis cache key (write-through invalidation, T-06-14).
   * Cache invalidation happens AFTER the DB write — Pitfall 3 ordering.
   *
   * @param key - Canonical snake_case setting key
   * @param value - New setting value (any JSONB-serializable type)
   */
  async updateSetting(key: string, value: unknown): Promise<void> {
    const { db, redis } = this.deps;

    await db
      .insert(marketplaceSettings)
      .values({ key, value })
      .onConflictDoUpdate({
        target: marketplaceSettings.key,
        set: { value, updatedAt: new Date() },
      });

    await redis.del(this.redisKey(key));
  }

  /**
   * Invalidate the Redis cache entry for a single setting.
   * The next getSetting() call will re-read from the DB.
   *
   * @param key - Canonical snake_case setting key to invalidate
   */
  async invalidateSetting(key: string): Promise<void> {
    await this.deps.redis.del(this.redisKey(key));
  }
}
