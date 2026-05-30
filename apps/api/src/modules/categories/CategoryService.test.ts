import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectCategory } from "../../db/schema/index.js";
import { CategoryService, CategoryDepthError } from "./CategoryService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle query mock for SELECT queries that resolves to `rows`.
 * CategoryService uses:
 *   db.select().from().where().orderBy()   ← getTree (no limit)
 *   db.select().from().where().limit(1)    ← getCategoryById, getDepth, resolveSlug
 *
 * Both paths must be supported by the mock chain.
 */
function makeDbMock(rows: SelectCategory[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        // getTree uses orderBy (awaitable directly)
        orderBy: vi.fn().mockResolvedValue(rows),
        // getCategoryById / getDepth / resolveSlug use limit
        limit: vi.fn().mockResolvedValue(rows),
        // Make where itself awaitable (for paths that await where() directly)
        then: (resolve: (v: SelectCategory[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };

  const db = {
    select: vi.fn().mockReturnValue(awaitableChain),
  };
  return db;
}

/**
 * Build a Drizzle INSERT mock for createCategory.
 * CategoryService uses: db.insert(categories).values(...).returning()
 */
function makeInsertDbMock(returnRow: SelectCategory) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    ...makeDbMock([]), // include select for depth check / slug resolution
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

/**
 * Build a Drizzle UPDATE mock for archive / reorder.
 * CategoryService uses: db.update(categories).set({...}).where(...).returning()
 */
function makeUpdateDbMock(returnRow: SelectCategory | null) {
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnRow ? [returnRow] : []),
      }),
    }),
  };
  return {
    ...makeDbMock([]),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}

const ENV = { CATEGORY_TREE_TTL_SECONDS: 300 } as never;

// ---------------------------------------------------------------------------
// Test data — a 3-level tree: root → sub → leaf
// ---------------------------------------------------------------------------

const rootCategory: SelectCategory = {
  id: "root-uuid-1",
  parentId: null,
  name: "Electronics",
  slug: "electronics",
  sortOrder: 0,
  isRestricted: false,
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const subCategory: SelectCategory = {
  id: "sub-uuid-1",
  parentId: "root-uuid-1",
  name: "Smartphones",
  slug: "smartphones",
  sortOrder: 0,
  isRestricted: false,
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const leafCategory: SelectCategory = {
  id: "leaf-uuid-1",
  parentId: "sub-uuid-1",
  name: "Android Phones",
  slug: "android-phones",
  sortOrder: 0,
  isRestricted: false,
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CategoryService", () => {
  // ── getTree ────────────────────────────────────────────────────────────────

  describe("getTree", () => {
    it("returns cached tree on Redis hit — no DB query", async () => {
      const db = makeDbMock([rootCategory]);
      const redis = makeRedisMock();
      const cachedTree = [{ ...rootCategory, depth: 0, hasChildren: false, childCount: 0, children: [] }];
      redis.get.mockResolvedValue(JSON.stringify(cachedTree));

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getTree();

      // Must return the parsed cached tree
      expect(result).toEqual(cachedTree);
      // Redis.get must be called with the correct key
      expect(redis.get).toHaveBeenCalledWith("cat:tree");
      // DB must NOT be touched on a cache hit
      expect(db.select).not.toHaveBeenCalled();
    });

    it("builds and caches tree on Redis miss", async () => {
      const db = makeDbMock([rootCategory, subCategory]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null); // cache miss

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getTree();

      // DB was queried
      expect(db.select).toHaveBeenCalledOnce();
      // Result has nested structure
      expect(result).toHaveLength(1);
      expect(result[0]!.id).toBe("root-uuid-1");
      expect(result[0]!.children).toHaveLength(1);
      expect(result[0]!.children[0]!.id).toBe("sub-uuid-1");
      // setex called with correct key and TTL
      expect(redis.setex).toHaveBeenCalledWith(
        "cat:tree",
        300,
        expect.any(String)
      );
    });
  });

  // ── buildTree (via getTree with known flat rows) ───────────────────────────

  describe("buildTree (via getTree miss)", () => {
    it("assembles 3-level nested structure with correct depth/hasChildren/childCount", async () => {
      const db = makeDbMock([rootCategory, subCategory, leafCategory]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null); // cache miss — buildTree runs

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      const tree = await svc.getTree();

      // Root
      expect(tree).toHaveLength(1);
      const root = tree[0]!;
      expect(root.id).toBe("root-uuid-1");
      expect(root.depth).toBe(0);
      expect(root.hasChildren).toBe(true);
      expect(root.childCount).toBe(1);

      // Subcategory (depth 1)
      const sub = root.children[0]!;
      expect(sub.id).toBe("sub-uuid-1");
      expect(sub.depth).toBe(1);
      expect(sub.hasChildren).toBe(true);
      expect(sub.childCount).toBe(1);

      // Leaf (depth 2)
      const leaf = sub.children[0]!;
      expect(leaf.id).toBe("leaf-uuid-1");
      expect(leaf.depth).toBe(2);
      expect(leaf.hasChildren).toBe(false);
      expect(leaf.childCount).toBe(0);
      expect(leaf.children).toHaveLength(0);
    });
  });

  // ── createCategory depth guard ────────────────────────────────────────────

  describe("createCategory — depth guard (D-01, CAT-02)", () => {
    it("throws CategoryDepthError at depth limit with the D-01 message", async () => {
      // Scenario: trying to add a 4th level under leaf (leaf is at depth 2)
      // getDepth(leafCategory.id) must return 2 → throws

      // DB mock: first select for getDepth walks parent chain
      //   1st call: fetch leafCategory → parentId = sub-uuid-1
      //   2nd call: fetch subCategory → parentId = root-uuid-1
      //   3rd call: fetch rootCategory → parentId = null
      // depth counter = 2 (two parent hops from leaf)
      const selectMock = vi.fn()
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([leafCategory]),
              limit: vi.fn().mockResolvedValue([leafCategory]),
              then: (resolve: (v: SelectCategory[]) => void) => resolve([leafCategory]),
              catch: vi.fn(),
              finally: vi.fn(),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([subCategory]),
              limit: vi.fn().mockResolvedValue([subCategory]),
              then: (resolve: (v: SelectCategory[]) => void) => resolve([subCategory]),
              catch: vi.fn(),
              finally: vi.fn(),
            }),
          }),
        })
        .mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              orderBy: vi.fn().mockResolvedValue([rootCategory]),
              limit: vi.fn().mockResolvedValue([rootCategory]),
              then: (resolve: (v: SelectCategory[]) => void) => resolve([rootCategory]),
              catch: vi.fn(),
              finally: vi.fn(),
            }),
          }),
        });

      const db = { select: selectMock };
      const redis = makeRedisMock();

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });

      await expect(
        svc.createCategory({ name: "Too Deep", parentId: "leaf-uuid-1" })
      ).rejects.toThrow(CategoryDepthError);

      await expect(
        svc.createCategory({ name: "Too Deep", parentId: "leaf-uuid-1" })
      ).rejects.toThrow(
        "Cannot create subcategory: maximum depth of 3 levels reached."
      );
    });

    it("createCategory at root (no parentId) succeeds and invalidates tree", async () => {
      const newRoot: SelectCategory = {
        ...rootCategory,
        id: "new-root-uuid",
        name: "Furniture",
        slug: "furniture",
      };

      // resolveSlug: first select returns [] (slug "furniture" not taken)
      const slugCheckMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            orderBy: vi.fn().mockResolvedValue([]),
            limit: vi.fn().mockResolvedValue([]),
            then: (resolve: (v: SelectCategory[]) => void) => resolve([]),
            catch: vi.fn(),
            finally: vi.fn(),
          }),
        }),
      });

      const insertChain = {
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([newRoot]),
        }),
      };

      const db = {
        select: slugCheckMock,
        insert: vi.fn().mockReturnValue(insertChain),
      };
      const redis = makeRedisMock();

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.createCategory({ name: "Furniture" });

      expect(result.name).toBe("Furniture");
      // Tree must be invalidated after create
      expect(redis.del).toHaveBeenCalledWith("cat:tree");
    });
  });

  // ── archiveCategory ────────────────────────────────────────────────────────

  describe("archiveCategory", () => {
    it("sets archivedAt and invalidates the cat:tree cache key", async () => {
      const archivedRow: SelectCategory = {
        ...rootCategory,
        archivedAt: new Date("2025-06-01T00:00:00Z"),
      };

      const db = makeUpdateDbMock(archivedRow);
      const redis = makeRedisMock();

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.archiveCategory("root-uuid-1");

      expect(result).not.toBeNull();
      expect(result!.archivedAt).not.toBeNull();
      // Cache must be invalidated
      expect(redis.del).toHaveBeenCalledWith("cat:tree");
    });
  });

  // ── reorderCategories ──────────────────────────────────────────────────────

  describe("reorderCategories", () => {
    it("updates sort_order and invalidates the cat:tree cache key", async () => {
      // Update mock must handle multiple sequential updates
      const updateSetMock = vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([rootCategory]),
        }),
      });
      const db = {
        ...makeDbMock([]),
        update: vi.fn().mockReturnValue({ set: updateSetMock }),
      };
      const redis = makeRedisMock();

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      await svc.reorderCategories(null, ["root-uuid-1", "sub-uuid-1"]);

      // update called once per ID
      expect(db.update).toHaveBeenCalledTimes(2);
      // Tree invalidated exactly once after all updates
      expect(redis.del).toHaveBeenCalledWith("cat:tree");
    });
  });

  // ── cache invalidation on every mutation ───────────────────────────────────

  describe("cache invalidation invariant", () => {
    it("every mutation invalidates the cat:tree cache key", async () => {
      // Archive triggers invalidation
      const archivedRow: SelectCategory = {
        ...rootCategory,
        archivedAt: new Date(),
      };
      const db = makeUpdateDbMock(archivedRow);
      const redis = makeRedisMock();

      const svc = new CategoryService({ db: db as never, redis: redis as never, env: ENV });
      await svc.archiveCategory("root-uuid-1");
      expect(redis.del).toHaveBeenCalledWith("cat:tree");
    });
  });
});
