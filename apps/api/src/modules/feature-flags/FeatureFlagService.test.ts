import { describe, expect, it, vi } from "vitest";
import type { SelectFeatureFlag } from "../../db/schema/index.js";
import { FeatureFlagService } from "./FeatureFlagService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle query mock that resolves to `rows` when awaited.
 * Supports: db.select().from().where().limit(n) and db.select().from() (direct await)
 */
function makeDbMock(rows: SelectFeatureFlag[]) {
  const fromChain = {
    where: vi.fn().mockReturnValue({
      limit: vi.fn().mockResolvedValue(rows),
      // Make `where` itself awaitable for getAllFlags (no .limit call)
      then: (resolve: (v: SelectFeatureFlag[]) => void) => resolve(rows),
      catch: vi.fn(),
      finally: vi.fn(),
    }),
    // Make `from` itself awaitable — for listFlags() which does db.select().from() directly
    then: (resolve: (v: SelectFeatureFlag[]) => void) => resolve(rows),
    catch: vi.fn(),
    finally: vi.fn(),
  };

  const awaitableChain = { from: vi.fn().mockReturnValue(fromChain) };
  const db = { select: vi.fn().mockReturnValue(awaitableChain) };
  return db;
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
    keys: vi.fn().mockResolvedValue([]),
  };
}

const ENV = { FEATURE_FLAG_TTL_SECONDS: 60 } as never;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const enabledFlag: SelectFeatureFlag = {
  id: "uuid-1",
  key: "new_checkout",
  value: "true",
  description: "Enable new checkout flow",
  isEnabled: true,
  metadata: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const disabledFlag: SelectFeatureFlag = {
  ...enabledFlag,
  id: "uuid-2",
  key: "old_feature",
  value: "on",
  isEnabled: false,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("FeatureFlagService", () => {
  // -------------------------------------------------------------------------
  describe("getFlag", () => {
    it("returns cached value on Redis hit — no DB query", async () => {
      const db = makeDbMock([enabledFlag]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue("true");

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getFlag("new_checkout");

      expect(result).toBe("true");
      expect(redis.get).toHaveBeenCalledWith("ff:new_checkout");
      // DB must NOT be touched on a cache hit
      expect(db.select).not.toHaveBeenCalled();
    });

    it("on Redis miss, reads from DB, caches with setex, returns value", async () => {
      const db = makeDbMock([enabledFlag]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null); // cache miss

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getFlag("new_checkout");

      expect(result).toBe("true");
      expect(db.select).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith("ff:new_checkout", 60, "true");
    });

    it("returns null for a nonexistent key (empty DB result)", async () => {
      const db = makeDbMock([]); // no rows
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getFlag("nonexistent");

      expect(result).toBeNull();
      expect(redis.setex).not.toHaveBeenCalled();
    });

    it("returns null for a disabled flag (isEnabled=false)", async () => {
      const db = makeDbMock([disabledFlag]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getFlag("old_feature");

      expect(result).toBeNull();
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("getAllFlags", () => {
    it("returns all enabled flags and caches each one in Redis", async () => {
      const flag2: SelectFeatureFlag = { ...enabledFlag, id: "uuid-3", key: "feature_b", value: "enabled" };
      const db = makeDbMock([enabledFlag, flag2]);
      const redis = makeRedisMock();

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const flags = await svc.getAllFlags();

      expect(flags).toHaveLength(2);
      expect(redis.setex).toHaveBeenCalledTimes(2);
      expect(redis.setex).toHaveBeenCalledWith("ff:new_checkout", 60, "true");
      expect(redis.setex).toHaveBeenCalledWith("ff:feature_b", 60, "enabled");
    });

    it("returns empty array when no flags exist", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      const flags = await svc.getAllFlags();

      expect(flags).toHaveLength(0);
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("invalidateFlag", () => {
    it("deletes the Redis key for the given flag", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      await svc.invalidateFlag("new_checkout");

      expect(redis.del).toHaveBeenCalledWith("ff:new_checkout");
    });
  });

  // -------------------------------------------------------------------------
  describe("invalidateAllFlags", () => {
    it("deletes all ff:* keys when some exist", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();
      redis.keys.mockResolvedValue(["ff:new_checkout", "ff:feature_b"]);

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      await svc.invalidateAllFlags();

      expect(redis.keys).toHaveBeenCalledWith("ff:*");
      expect(redis.del).toHaveBeenCalledWith("ff:new_checkout", "ff:feature_b");
    });

    it("does not call del when no ff:* keys exist", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();
      redis.keys.mockResolvedValue([]); // no keys

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });
      await svc.invalidateAllFlags();

      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("cache invalidation re-reads from DB", () => {
    it("after invalidateFlag, next getFlag re-reads from DB", async () => {
      const db = makeDbMock([enabledFlag]);
      const redis = makeRedisMock();

      // First call: cache miss → DB read → cache set
      redis.get.mockResolvedValueOnce(null);
      // Second call (after invalidation): cache miss again → DB read
      redis.get.mockResolvedValueOnce(null);

      const svc = new FeatureFlagService({ db: db as never, redis: redis as never, env: ENV });

      // First read — populate cache
      await svc.getFlag("new_checkout");
      expect(db.select).toHaveBeenCalledTimes(1);

      // Invalidate
      await svc.invalidateFlag("new_checkout");
      expect(redis.del).toHaveBeenCalledWith("ff:new_checkout");

      // Second read — cache miss, goes to DB again
      const result = await svc.getFlag("new_checkout");
      expect(result).toBe("true");
      expect(db.select).toHaveBeenCalledTimes(2);
    });
  });

  // ── Phase 6: toggleFlag + listFlags (ADM-06, D-12) ──────────────────────

  describe("toggleFlag()", () => {
    it("updates isEnabled in the DB and calls invalidateFlag(key) after the DB update", async () => {
      const db = makeDbMock([enabledFlag]);
      // Make update chain work
      const updateSetWhere = vi.fn().mockResolvedValue([]);
      const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });
      (db as { update: unknown }).update = vi.fn().mockReturnValue({ set: updateSet });

      const redis = makeRedisMock();

      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new FeatureFlagService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditService as never,
      });

      await svc.toggleFlag("new_checkout", false);

      // DB update should be called
      expect((db as { update: ReturnType<typeof vi.fn> }).update).toHaveBeenCalled();
      expect(updateSet).toHaveBeenCalledWith(
        expect.objectContaining({ isEnabled: false })
      );
      // Cache invalidated AFTER the DB update (Pitfall 3 ordering)
      expect(redis.del).toHaveBeenCalledWith("ff:new_checkout");
    });

    it("logs 'feature_flag.toggled' to auditService", async () => {
      const db = makeDbMock([enabledFlag]);
      const updateSetWhere = vi.fn().mockResolvedValue([]);
      const updateSet = vi.fn().mockReturnValue({ where: updateSetWhere });
      (db as { update: unknown }).update = vi.fn().mockReturnValue({ set: updateSet });
      const redis = makeRedisMock();
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new FeatureFlagService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditService as never,
      });

      await svc.toggleFlag("new_checkout", true);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "feature_flag.toggled" })
      );
    });
  });

  describe("listFlags()", () => {
    it("returns all feature flag rows (including disabled) for the admin toggle list", async () => {
      const db = makeDbMock([enabledFlag, disabledFlag]);
      const redis = makeRedisMock();
      const auditService = { log: vi.fn() };
      const svc = new FeatureFlagService({
        db: db as never,
        redis: redis as never,
        env: ENV,
        auditService: auditService as never,
      });

      const flags = await svc.listFlags();

      expect(flags).toHaveLength(2);
      // Must include both enabled and disabled flags
      const keys = flags.map((f) => f.key);
      expect(keys).toContain("new_checkout");
      expect(keys).toContain("old_feature");
    });
  });
});
