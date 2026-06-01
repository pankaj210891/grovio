import { asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { MerchandisingBlock } from "@grovio/contracts";
import { MerchandisingBlockSchema } from "@grovio/contracts";
import type { Env } from "../../config/env.js";
import { homepageBlocks } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface — mirrors FeatureFlagServiceDeps (Redis-first read pattern)
// ---------------------------------------------------------------------------

interface HomepageServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}

/**
 * HomepageService
 *
 * Redis-first read path for homepage blocks (STORE-01).
 * On a cache hit, returns the parsed cached array without hitting the DB.
 * On a cache miss, queries homepage_blocks WHERE is_active = true,
 * ordered by sort_order ASC, validates each row's JSONB payload via
 * MerchandisingBlockSchema, populates the Redis cache with setex, and
 * returns the validated block array.
 *
 * Redis key: "homepage:blocks" (singleton — entire block list is one JSON value).
 * TTL: env.HOMEPAGE_BLOCKS_TTL_SECONDS (default 300s from Phase 4 env schema).
 *
 * Admin write-side (create/reorder/archive blocks) is Phase 6.
 * Phase 4 builds only the getBlocks() read path and invalidateBlocks().
 *
 * Covers STORE-01 (homepage block fetch with Redis caching).
 * Mitigates T-04-11 (JSONB tampering — Zod validates at read time).
 * Mitigates T-04-12 (DoS — Redis absorbs repeated homepage reads).
 */
export class HomepageService {
  /** The single Redis key holding the serialised homepage block list. */
  private readonly cacheKey = "homepage:blocks";

  constructor(private deps: HomepageServiceDeps) {}

  /**
   * Return all active homepage blocks in ascending sort_order.
   *
   * Redis-first: returns the cached block array immediately on a hit.
   * On miss: queries DB (is_active=true only, ordered by sort_order ASC),
   * validates each block's JSONB payload through MerchandisingBlockSchema,
   * writes the result to Redis with HOMEPAGE_BLOCKS_TTL_SECONDS TTL,
   * and returns the validated block array.
   *
   * @throws {ZodError} when a block's JSONB payload does not conform to
   *   its declared type schema (T-04-11 mitigation).
   */
  async getBlocks(): Promise<MerchandisingBlock[]> {
    const { db, redis, env } = this.deps;

    // Redis-first: return cached result immediately on a hit.
    const cached = await redis.get(this.cacheKey);
    if (cached !== null) return JSON.parse(cached) as MerchandisingBlock[];

    // DB fallback: only active blocks, ordered by sort_order ascending.
    const rows = await db
      .select()
      .from(homepageBlocks)
      .where(eq(homepageBlocks.isActive, true))
      .orderBy(asc(homepageBlocks.sortOrder));

    // Parse JSONB payload through MerchandisingBlockSchema (Zod validates at read).
    // Merges stored payload with the row's type discriminant so the schema can
    // dispatch to the correct sub-schema (BannerBlockSchema etc.).
    // Throws ZodError for malformed/unknown block types — T-04-11 mitigation.
    const blocks = rows.map((row) =>
      MerchandisingBlockSchema.parse({ ...row.payload as object, type: row.type })
    );

    // Populate cache. TTL driven by env var (consistent with CATEGORY_TREE_TTL_SECONDS pattern).
    await redis.setex(
      this.cacheKey,
      env.HOMEPAGE_BLOCKS_TTL_SECONDS,
      JSON.stringify(blocks)
    );

    return blocks;
  }

  /**
   * Invalidate the Redis cache for homepage blocks.
   * The next getBlocks() call will re-read from the DB.
   * Called by the Phase 6 admin mutation handlers after any block write.
   */
  async invalidateBlocks(): Promise<void> {
    await this.deps.redis.del(this.cacheKey);
  }
}
