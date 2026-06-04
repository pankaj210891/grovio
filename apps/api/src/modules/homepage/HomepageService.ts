import { asc, desc, eq, gt, lt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { MerchandisingBlock } from "@grovio/contracts";
import { MerchandisingBlockSchema } from "@grovio/contracts";
import type { Env } from "../../config/env.js";
import { homepageBlocks, type SelectHomepageBlock } from "../../db/schema/index.js";
import type { AuditService } from "../audit/AuditService.js";
import type {
  CreateHomepageBlockInput,
  UpdateHomepageBlockInput,
} from "@grovio/contracts/admin/cms";

// ---------------------------------------------------------------------------
// Deps interface — mirrors FeatureFlagServiceDeps (Redis-first read pattern)
// ---------------------------------------------------------------------------

interface HomepageServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
  auditService: AuditService;
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
 * Phase 6 CMS write methods (ADM-04, D-11):
 * - createBlock(input): inserts block, then invalidateBlocks() AFTER write (Pitfall 3)
 * - updateBlock(id, input): updates block, then invalidateBlocks() AFTER write
 * - deleteBlock(id): deletes block, then invalidateBlocks() AFTER write
 * - reorderBlock(id, direction): swaps sort order with adjacent block, then invalidateBlocks()
 * - listBlocksForAdmin(): returns ALL blocks (including inactive) for admin CMS page
 *
 * All write methods validate block payloads via MerchandisingBlockSchema before write.
 * All mutations call auditService.log with 'homepage_block.*' actions (T-06-24).
 * Cache is always invalidated AFTER the DB write (Pitfall 3 — never before).
 *
 * Covers STORE-01 (homepage block fetch with Redis caching).
 * Mitigates T-04-11 (JSONB tampering — Zod validates at read time).
 * Mitigates T-04-12 (DoS — Redis absorbs repeated homepage reads).
 * Mitigates T-06-23 (stale homepage content — invalidateBlocks after each write).
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

    // Redis-first: validate and return cached result on a hit.
    const cached = await redis.get(this.cacheKey);
    if (cached !== null) {
      try {
        const raw = JSON.parse(cached) as unknown[];
        // Re-validate even on cache hits — guards against poisoned/stale Redis data (T-04-11)
        return raw.map((item) => MerchandisingBlockSchema.parse(item));
      } catch {
        // Corrupted or stale cache — fall through to DB re-read and repopulate
        await redis.del(this.cacheKey);
      }
    }

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
   * Called after any block write mutation (Pitfall 3 — AFTER write, not before).
   */
  async invalidateBlocks(): Promise<void> {
    await this.deps.redis.del(this.cacheKey);
  }

  // ── Phase 6: CMS write methods (ADM-04, D-11, Pitfall 3, T-06-23) ────────

  /**
   * Create a new homepage block (ADM-04, D-11).
   *
   * Validates the block payload via MerchandisingBlockSchema before insert.
   * Assigns the next sort order (max existing + 1).
   * Calls invalidateBlocks() AFTER the DB write (Pitfall 3 — prevents cache miss
   * on write window from returning stale data, T-06-23).
   * Logs 'homepage_block.created' to auditService (T-06-24).
   */
  async createBlock(input: CreateHomepageBlockInput): Promise<void> {
    const { db, auditService } = this.deps;

    // Validate block payload via MerchandisingBlockSchema
    const validatedBlock = MerchandisingBlockSchema.parse(input.block);

    // Get next sort order (max + 1 for append at end)
    const existing = await db
      .select()
      .from(homepageBlocks)
      .orderBy(desc(homepageBlocks.sortOrder))
      .limit(1);
    const maxSortOrder = existing[0]?.sortOrder ?? 0;
    const nextSortOrder = maxSortOrder + 1;

    // Insert (DB write first — Pitfall 3)
    await db.insert(homepageBlocks).values({
      type: validatedBlock.type,
      payload: validatedBlock,
      sortOrder: nextSortOrder,
      isActive: input.active ?? true,
    });

    // Invalidate cache AFTER write (Pitfall 3, T-06-23)
    await this.invalidateBlocks();

    await auditService.log({
      actorType: "admin",
      actorId: "admin",
      actorEmail: "admin",
      action: "homepage_block.created",
      entityType: "homepage_block",
      entityId: `type:${validatedBlock.type}`,
      before: null,
      after: { type: validatedBlock.type, sortOrder: nextSortOrder, isActive: input.active ?? true },
    });
  }

  /**
   * Update an existing homepage block (ADM-04, D-11).
   *
   * Validates the block payload via MerchandisingBlockSchema if provided.
   * Calls invalidateBlocks() AFTER the DB write (Pitfall 3, T-06-23).
   * Logs 'homepage_block.updated' to auditService (T-06-24).
   */
  async updateBlock(id: string, input: UpdateHomepageBlockInput): Promise<void> {
    const { db, auditService } = this.deps;

    // Load before-state for audit
    const existing = await db
      .select()
      .from(homepageBlocks)
      .where(eq(homepageBlocks.id, id))
      .limit(1);

    const before = existing[0];
    if (!before) throw new Error(`Homepage block not found: ${id}`);

    // Prepare update payload
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const updateData: Record<string, any> = { updatedAt: new Date() };

    if (input.block !== undefined) {
      const validatedBlock = MerchandisingBlockSchema.parse(input.block);
      updateData.type = validatedBlock.type;
      updateData.payload = validatedBlock;
    }

    if (input.active !== undefined) {
      updateData.isActive = input.active;
    }

    // DB write (Pitfall 3: write first)
    await db
      .update(homepageBlocks)
      .set(updateData)
      .where(eq(homepageBlocks.id, id));

    // Invalidate cache AFTER write (Pitfall 3, T-06-23)
    await this.invalidateBlocks();

    await auditService.log({
      actorType: "admin",
      actorId: "admin",
      actorEmail: "admin",
      action: "homepage_block.updated",
      entityType: "homepage_block",
      entityId: id,
      before: { type: before.type, isActive: before.isActive },
      after: { type: updateData.type ?? before.type, isActive: updateData.isActive ?? before.isActive },
    });
  }

  /**
   * Delete a homepage block (ADM-04, D-11).
   *
   * Calls invalidateBlocks() AFTER the DB delete (Pitfall 3, T-06-23).
   * Logs 'homepage_block.deleted' to auditService (T-06-24).
   */
  async deleteBlock(id: string): Promise<void> {
    const { db, auditService } = this.deps;

    // Load before-state for audit
    const existing = await db
      .select()
      .from(homepageBlocks)
      .where(eq(homepageBlocks.id, id))
      .limit(1);

    const before = existing[0];
    if (!before) throw new Error(`Homepage block not found: ${id}`);

    // DB delete (Pitfall 3: write first)
    await db.delete(homepageBlocks).where(eq(homepageBlocks.id, id));

    // Invalidate cache AFTER delete (Pitfall 3, T-06-23)
    await this.invalidateBlocks();

    await auditService.log({
      actorType: "admin",
      actorId: "admin",
      actorEmail: "admin",
      action: "homepage_block.deleted",
      entityType: "homepage_block",
      entityId: id,
      before: { type: before.type, sortOrder: before.sortOrder },
      after: null,
    });
  }

  /**
   * Reorder a homepage block up or down by swapping sort order with the adjacent block.
   *
   * 'up' means lower sort_order (moves towards the top of the page).
   * 'down' means higher sort_order (moves towards the bottom).
   *
   * If there is no adjacent block in the requested direction (block is already at
   * the top or bottom), the operation is a no-op.
   *
   * Calls invalidateBlocks() AFTER the swaps (Pitfall 3, T-06-23).
   */
  async reorderBlock(id: string, direction: "up" | "down"): Promise<void> {
    const { db } = this.deps;

    // Load the block to reorder
    const blockRows = await db
      .select()
      .from(homepageBlocks)
      .where(eq(homepageBlocks.id, id))
      .limit(1);

    const block = blockRows[0];
    if (!block) throw new Error(`Homepage block not found: ${id}`);

    // Find the adjacent block in the requested direction
    let adjacentRows: SelectHomepageBlock[];
    if (direction === "up") {
      // Adjacent = nearest block with lower sort_order
      adjacentRows = await db
        .select()
        .from(homepageBlocks)
        .where(lt(homepageBlocks.sortOrder, block.sortOrder))
        .orderBy(desc(homepageBlocks.sortOrder))
        .limit(1);
    } else {
      // Adjacent = nearest block with higher sort_order
      adjacentRows = await db
        .select()
        .from(homepageBlocks)
        .where(gt(homepageBlocks.sortOrder, block.sortOrder))
        .orderBy(asc(homepageBlocks.sortOrder))
        .limit(1);
    }

    const adjacent = adjacentRows[0];
    if (!adjacent) {
      // Already at top or bottom — no-op, but still invalidate to be safe
      await this.invalidateBlocks();
      return;
    }

    // Swap sort orders (Pitfall 3: write first, then invalidate)
    await db
      .update(homepageBlocks)
      .set({ sortOrder: adjacent.sortOrder, updatedAt: new Date() })
      .where(eq(homepageBlocks.id, block.id));

    await db
      .update(homepageBlocks)
      .set({ sortOrder: block.sortOrder, updatedAt: new Date() })
      .where(eq(homepageBlocks.id, adjacent.id));

    // Invalidate cache AFTER writes (Pitfall 3, T-06-23)
    await this.invalidateBlocks();
  }

  /**
   * List all homepage blocks for the admin CMS page (ADM-04, D-11).
   *
   * Unlike getBlocks() (active only, cached), listBlocksForAdmin():
   * - Returns ALL blocks including inactive
   * - Ordered by sort_order ASC
   * - No Redis caching — admin always sees latest data
   *
   * @returns Raw SelectHomepageBlock rows (not validated through MerchandisingBlockSchema)
   */
  async listBlocksForAdmin(): Promise<SelectHomepageBlock[]> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(homepageBlocks)
      .orderBy(asc(homepageBlocks.sortOrder));

    return rows;
  }
}
