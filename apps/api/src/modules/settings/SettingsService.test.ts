import { describe, expect, it, vi } from "vitest";
import type { SelectMarketplaceSetting } from "../../db/schema/index.js";
import { SettingsService } from "./SettingsService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle query mock for SELECT queries.
 * Supports: db.select().from().where().limit(n)
 *
 * Also supports db.select().from() (no where/limit) for getAllSettings.
 */
function makeDbMock(rows: SelectMarketplaceSetting[]) {
  const selectChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
      // Also awaitable directly (for getAllSettings — no where/limit)
      then: (resolve: (v: SelectMarketplaceSetting[]) => void) => resolve(rows),
      catch: vi.fn(),
      finally: vi.fn(),
    }),
  };

  const insertChain = {
    values: vi.fn().mockReturnValue({
      onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    }),
  };

  const db = {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
  };
  return db;
}

function makeRedisMock() {
  return {
    get: vi.fn(),
    setex: vi.fn().mockResolvedValue("OK"),
    del: vi.fn().mockResolvedValue(1),
  };
}

const ENV = { FEATURE_FLAG_TTL_SECONDS: 60 } as never;

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const storeName: SelectMarketplaceSetting = {
  key: "store_name",
  value: "Grovio Marketplace",
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const returnWindow: SelectMarketplaceSetting = {
  key: "default_return_window_days",
  value: 30,
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("SettingsService", () => {
  // -------------------------------------------------------------------------
  describe("getSetting", () => {
    it("returns parsed value from Redis on cache hit — DB NOT queried", async () => {
      const db = makeDbMock([storeName]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(JSON.stringify("Grovio Marketplace"));

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getSetting("store_name");

      expect(result).toBe("Grovio Marketplace");
      expect(redis.get).toHaveBeenCalledWith("settings:store_name");
      // DB must NOT be touched on cache hit
      expect(db.select).not.toHaveBeenCalled();
    });

    it("on cache miss, reads DB, populates Redis with setex, returns value", async () => {
      const db = makeDbMock([storeName]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null); // cache miss

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getSetting("store_name");

      expect(result).toBe("Grovio Marketplace");
      expect(db.select).toHaveBeenCalledOnce();
      expect(redis.setex).toHaveBeenCalledWith(
        "settings:store_name",
        60,
        JSON.stringify("Grovio Marketplace"),
      );
    });

    it("returns null when key absent in both Redis and DB", async () => {
      const db = makeDbMock([]); // no rows
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getSetting("nonexistent_key");

      expect(result).toBeNull();
      expect(redis.setex).not.toHaveBeenCalled();
    });
  });

  // -------------------------------------------------------------------------
  describe("updateSetting", () => {
    it("UPSERTs into marketplace_settings then deletes Redis key", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      await svc.updateSetting("store_name", "New Name");

      // insert was called with the right key/value
      expect(db.insert).toHaveBeenCalledOnce();
      const insertArg = db.insert.mock.calls[0][0];
      // verify it targets the marketplaceSettings table reference
      expect(insertArg).toBeDefined();

      // onConflictDoUpdate was called (UPSERT)
      const valuesChain = db.insert.mock.results[0].value;
      expect(valuesChain.values).toHaveBeenCalledWith({ key: "store_name", value: "New Name" });
      const conflictChain = valuesChain.values.mock.results[0].value;
      expect(conflictChain.onConflictDoUpdate).toHaveBeenCalledOnce();

      // Redis key invalidated AFTER DB write
      expect(redis.del).toHaveBeenCalledWith("settings:store_name");
    });
  });

  // -------------------------------------------------------------------------
  describe("getAllSettings", () => {
    it("returns record of all settings keyed by key", async () => {
      const db = makeDbMock([storeName, returnWindow]);
      const redis = makeRedisMock();

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getAllSettings();

      expect(result).toEqual({
        store_name: "Grovio Marketplace",
        default_return_window_days: 30,
      });
    });

    it("returns empty record when no settings exist", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      const result = await svc.getAllSettings();

      expect(result).toEqual({});
    });
  });

  // -------------------------------------------------------------------------
  describe("invalidateSetting", () => {
    it("deletes Redis key for the given setting", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      await svc.invalidateSetting("store_name");

      expect(redis.del).toHaveBeenCalledWith("settings:store_name");
    });
  });

  // -------------------------------------------------------------------------
  describe("redisKey prefix", () => {
    it("uses settings: prefix for all Redis keys", async () => {
      const db = makeDbMock([]);
      const redis = makeRedisMock();
      redis.get.mockResolvedValue(null);

      const svc = new SettingsService({ db: db as never, redis: redis as never, env: ENV });
      await svc.getSetting("some_key");

      expect(redis.get).toHaveBeenCalledWith("settings:some_key");
    });
  });
});
