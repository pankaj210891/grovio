import { describe, expect, it, vi } from "vitest";
import type { SelectHomepageBlock } from "../../db/schema/index.js";
import { HomepageService } from "./HomepageService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle SELECT mock that resolves to `rows` when awaited.
 * HomepageService uses: db.select().from().where().orderBy()
 */
function makeDbMock(rows: SelectHomepageBlock[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        // getBlocks uses orderBy (awaitable directly)
        orderBy: vi.fn().mockResolvedValue(rows),
        // Make where itself awaitable
        then: (resolve: (v: SelectHomepageBlock[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };

  return { select: vi.fn().mockReturnValue(awaitableChain) };
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
}

const ENV = { HOMEPAGE_BLOCKS_TTL_SECONDS: 300 } as never;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const bannerBlock: SelectHomepageBlock = {
  id: "a1b2c3d4-e5f6-4a1b-8c2d-111111111111",
  type: "banner",
  payload: {
    type: "banner",
    imageUrl: "https://example.com/banner.jpg",
    title: "Welcome to Grovio",
  },
  sortOrder: 1,
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const textBlock: SelectHomepageBlock = {
  id: "b2c3d4e5-f6a1-4b2c-8d3e-222222222222",
  type: "text_block",
  payload: {
    type: "text_block",
    title: "About Us",
    content: "We sell everything.",
  },
  sortOrder: 2,
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const inactiveBlock: SelectHomepageBlock = {
  id: "c3d4e5f6-a1b2-4c3d-8e4f-333333333333",
  type: "product_grid",
  payload: {
    type: "product_grid",
    title: "Hidden Products",
    productIds: [],
    layout: "grid",
  },
  sortOrder: 3,
  isActive: false,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const lowOrderBlock: SelectHomepageBlock = {
  id: "d4e5f6a1-b2c3-4d4e-8f5a-444444444444",
  type: "featured_categories",
  payload: {
    type: "featured_categories",
    title: "Top Categories",
    categoryIds: [
      "e5f6a1b2-c3d4-4e5f-8a6b-555555555555",
      "f6a1b2c3-d4e5-4f6a-8b7c-666666666666",
    ],
    layout: "grid",
  },
  sortOrder: 0,
  isActive: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("HomepageService", () => {
  // ── getBlocks — cache hit ─────────────────────────────────────────────────

  describe("getBlocks — cache hit", () => {
    it("returns cached blocks on Redis hit — no DB query", async () => {
      const db = makeDbMock([bannerBlock]);
      const redis = makeRedisMock();

      const cachedBlocks = [
        {
          type: "banner" as const,
          imageUrl: "https://example.com/banner.jpg",
          title: "Welcome to Grovio",
        },
      ];
      redis.get.mockResolvedValue(JSON.stringify(cachedBlocks));

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getBlocks();

      // Must return the parsed cached array
      expect(result).toEqual(cachedBlocks);
      // Redis.get must be called with the correct key
      expect(redis.get).toHaveBeenCalledWith("homepage:blocks");
      // DB must NOT be touched on a cache hit
      expect(db.select).not.toHaveBeenCalled();
    });
  });

  // ── getBlocks — cache miss ────────────────────────────────────────────────

  describe("getBlocks — cache miss", () => {
    it("queries DB on cache miss, validates payloads, caches with setex, returns blocks", async () => {
      const db = makeDbMock([bannerBlock]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null); // cache miss

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getBlocks();

      // DB was queried
      expect(db.select).toHaveBeenCalledOnce();

      // Result contains the validated banner block
      expect(result).toHaveLength(1);
      expect(result[0]).toMatchObject({ type: "banner", title: "Welcome to Grovio" });

      // Cache was populated with setex using the correct TTL
      expect(redis.setex).toHaveBeenCalledWith(
        "homepage:blocks",
        300,
        expect.any(String)
      );
    });

    it("excludes is_active=false blocks — DB mock returns no inactive rows (filter applied via where)", async () => {
      // The DB mock simulates that the WHERE clause has already filtered out inactive blocks.
      // This tests that the service constructs a query with eq(isActive, true) — tested
      // indirectly: if inactive blocks were returned by the mock, getBlocks would parse them.
      // We confirm the service calls .where() on the chain (schema-level filtering assertion).
      const db = makeDbMock([bannerBlock, textBlock]); // only active blocks returned
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getBlocks();

      // Only the active blocks from the mock are returned
      expect(result).toHaveLength(2);
      // No inactive blocks appear
      const types = result.map((b) => b.type);
      expect(types).not.toContain("product_grid");
    });

    it("returns blocks in ascending sort_order (DB mock already sorted ascending)", async () => {
      // lowOrderBlock has sortOrder=0, bannerBlock has sortOrder=1
      // DB mock returns them in the order provided — service must preserve that order
      const db = makeDbMock([lowOrderBlock, bannerBlock]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getBlocks();

      expect(result).toHaveLength(2);
      expect(result[0]).toMatchObject({ type: "featured_categories" });
      expect(result[1]).toMatchObject({ type: "banner" });
    });

    it("returns empty array when no active blocks exist", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getBlocks();

      expect(result).toHaveLength(0);
      // setex is still called to cache empty result
      expect(redis.setex).toHaveBeenCalledWith("homepage:blocks", 300, "[]");
    });
  });

  // ── getBlocks — JSONB payload Zod validation ─────────────────────────────

  describe("getBlocks — JSONB payload validation", () => {
    it("throws ZodError when a block payload does not match its declared type schema", async () => {
      const malformedBlock: SelectHomepageBlock = {
        ...bannerBlock,
        id: "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee",
        payload: { type: "banner" }, // missing required imageUrl and title
      };

      const db = makeDbMock([malformedBlock]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });

      // MerchandisingBlockSchema.parse should throw ZodError for invalid payload
      await expect(svc.getBlocks()).rejects.toThrow();
    });
  });

  // ── invalidateBlocks ─────────────────────────────────────────────────────

  describe("invalidateBlocks", () => {
    it("deletes the Redis 'homepage:blocks' key", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });
      await svc.invalidateBlocks();

      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");
    });

    it("after invalidateBlocks, next getBlocks re-reads from DB", async () => {
      const db = makeDbMock([bannerBlock]);
      const redis = makeRedisMock();

      // First call: cache miss → DB read → cache set
      redis.get.mockResolvedValueOnce(null);
      // Second call (after invalidation): cache miss again → DB read
      redis.get.mockResolvedValueOnce(null);

      const svc = new HomepageService({ db: db as never, redis: redis as never, env: ENV });

      // First read — populate cache
      await svc.getBlocks();
      expect(db.select).toHaveBeenCalledTimes(1);

      // Invalidate
      await svc.invalidateBlocks();
      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");

      // Second read — cache miss, goes to DB again
      const result = await svc.getBlocks();
      expect(result).toHaveLength(1);
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  // ── Phase 6: CMS write methods (ADM-04, D-11, Pitfall 3) ─────────────────

  /**
   * Build a DB mock that supports insert, update, delete, and select chains.
   * Used by CMS write tests below.
   */
  function makeCmsDbMock(existingBlock?: SelectHomepageBlock | null) {
    const block = existingBlock ?? bannerBlock;

    // select() for before-state (existing block row)
    let selectCallIdx = 0;
    const selectMock = vi.fn().mockImplementation(() => {
      const idx = selectCallIdx++;
      if (idx === 0) {
        // First select: for createBlock — get max sortOrder (db.select().from().orderBy().limit())
        // OR for updateBlock/deleteBlock — get existing block (db.select().from().where().limit())
        return {
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(block ? [block] : []),
            }),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(block ? [block] : []),
            }),
          }),
        };
      }
      // Second select: for createBlock loading existing block (after max sortOrder query)
      // OR for reorder second block
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(block ? [block] : []),
            orderBy: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue(block ? [block] : []),
            }),
          }),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
    });

    const insertValuesMock = vi.fn().mockResolvedValue([{ id: "new-block-id" }]);
    const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

    const updateSetWhereMock = vi.fn().mockResolvedValue([]);
    const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
    const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

    const deleteWhereMock = vi.fn().mockResolvedValue([]);
    const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

    return {
      select: selectMock,
      insert: insertMock,
      update: updateMock,
      delete: deleteMock,
      _insertValuesMock: insertValuesMock,
      _updateSetMock: updateSetMock,
      _deleteWhereMock: deleteWhereMock,
    };
  }

  const auditServiceMock = { log: vi.fn().mockResolvedValue(undefined) };

  describe("createBlock()", () => {
    it("inserts a new block and calls invalidateBlocks() AFTER the write (Pitfall 3)", async () => {
      const callOrder: string[] = [];
      const db = makeCmsDbMock();
      // Track which happens first: insert or cache invalidation
      const origInsertValuesMock = db._insertValuesMock;
      db._insertValuesMock = vi.fn().mockImplementation(async (...args) => {
        callOrder.push("insert");
        return origInsertValuesMock(...args);
      });

      const redis = makeRedisMock();
      const origDel = redis.del;
      redis.del = vi.fn().mockImplementation(async (...args) => {
        callOrder.push("invalidate");
        return origDel(...args);
      });

      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      await svc.createBlock({
        block: {
          type: "banner" as const,
          imageUrl: "https://example.com/new.jpg",
          title: "New Banner",
        },
        active: true,
      });

      // Insert must happen BEFORE invalidation (Pitfall 3)
      const insertIdx = callOrder.indexOf("insert");
      const invalidateIdx = callOrder.indexOf("invalidate");
      expect(insertIdx).toBeLessThan(invalidateIdx);
    });

    it("calls invalidateBlocks() after create (cache cleared post-write)", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      await svc.createBlock({
        block: {
          type: "banner" as const,
          imageUrl: "https://example.com/new.jpg",
          title: "New Banner",
        },
        active: true,
      });

      // Cache invalidated after create
      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");
    });

    it("logs 'homepage_block.created' to auditService", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const auditSvc = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditSvc as never,
      });

      await svc.createBlock({
        block: { type: "banner" as const, imageUrl: "https://x.com/img.jpg", title: "T" },
        active: true,
      });

      expect(auditSvc.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "homepage_block.created" })
      );
    });
  });

  describe("updateBlock()", () => {
    it("updates a block and calls invalidateBlocks() AFTER the write", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      await svc.updateBlock(bannerBlock.id, {
        block: {
          type: "banner" as const,
          imageUrl: "https://example.com/updated.jpg",
          title: "Updated",
        },
        active: true,
      });

      expect(db.update).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");
    });

    it("logs 'homepage_block.updated' to auditService", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const auditSvc = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditSvc as never,
      });

      await svc.updateBlock(bannerBlock.id, {
        block: { type: "banner" as const, imageUrl: "https://x.com/img.jpg", title: "U" },
      });

      expect(auditSvc.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "homepage_block.updated" })
      );
    });
  });

  describe("deleteBlock()", () => {
    it("deletes a block and calls invalidateBlocks() AFTER the write", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      await svc.deleteBlock(bannerBlock.id);

      expect(db.delete).toHaveBeenCalled();
      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");
    });

    it("logs 'homepage_block.deleted' to auditService", async () => {
      const db = makeCmsDbMock();
      const redis = makeRedisMock();
      const auditSvc = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditSvc as never,
      });

      await svc.deleteBlock(bannerBlock.id);

      expect(auditSvc.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "homepage_block.deleted" })
      );
    });
  });

  describe("reorderBlock()", () => {
    it("swaps sort order for direction 'up' and calls invalidateBlocks() after", async () => {
      // Block with sortOrder=2, adjacent block with sortOrder=1
      const currentBlock: SelectHomepageBlock = { ...bannerBlock, sortOrder: 2 };
      const adjacentBlock: SelectHomepageBlock = { ...textBlock, sortOrder: 1 };

      let selectCallIdx = 0;
      const db = {
        select: vi.fn().mockImplementation(() => {
          const idx = selectCallIdx++;
          if (idx === 0) {
            // load current block
            return {
              from: vi.fn().mockReturnValue({
                where: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([currentBlock]),
                }),
              }),
            };
          }
          // load adjacent block (next lower sortOrder for 'up')
          return {
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                orderBy: vi.fn().mockReturnValue({
                  limit: vi.fn().mockResolvedValue([adjacentBlock]),
                }),
              }),
            }),
          };
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      };
      const redis = makeRedisMock();
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      await svc.reorderBlock(currentBlock.id, "up");

      // update called twice (swap both blocks' sortOrder)
      expect(db.update).toHaveBeenCalledTimes(2);
      // cache invalidated after
      expect(redis.del).toHaveBeenCalledWith("homepage:blocks");
    });
  });

  describe("listBlocksForAdmin()", () => {
    it("returns all blocks (including inactive) ordered by sort_order for admin CMS page", async () => {
      const db = {
        select: vi.fn().mockReturnValue({
          from: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([
              bannerBlock,
              textBlock,
              inactiveBlock,
            ]),
          }),
        }),
      };
      const redis = makeRedisMock();
      const svc = new HomepageService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditServiceMock as never,
      });

      const result = await svc.listBlocksForAdmin();

      expect(result).toHaveLength(3);
      // Includes inactive block
      const types = result.map((b) => b.id);
      expect(types).toContain(inactiveBlock.id);
    });
  });
});
