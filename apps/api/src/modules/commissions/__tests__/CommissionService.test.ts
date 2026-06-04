import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// CommissionService tests — MKT-01, MKT-02, D-14, T-05-07
//
// TDD RED: tests are written first to define expected behavior.
// All DB + Redis interactions are mocked; no live infrastructure required.
//
// Key assertions:
// - resolveRate priority chain: vendor > category > global (MKT-01, D-14)
// - computeCommission uses allocate() for zero-drift splits (MKT-02, T-05-07)
// - commission + netVendor === subtotal exactly for all amounts including awkward values
// ---------------------------------------------------------------------------

import { CommissionService } from "../CommissionService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a Drizzle select mock that returns `rows` as the final resolved value. */
function makeSelectMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** Build a Drizzle insert mock. */
function makeInsertMock() {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue([{ id: "commission-entry-uuid-1" }]),
  });
}

/** Build a Redis mock with get/setex methods. */
function makeRedisMock(cachedValue: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(cachedValue),
    setex: vi.fn().mockResolvedValue("OK"),
  };
}

/** Build a mock env object with FEATURE_FLAG_TTL_SECONDS. */
function makeEnv() {
  return { FEATURE_FLAG_TTL_SECONDS: 60 };
}

// ---------------------------------------------------------------------------
// Commission rule fixtures
// ---------------------------------------------------------------------------

const VENDOR_ID = "vendor-uuid-1";
const CATEGORY_ID = "category-uuid-1";
const VENDOR_ORDER_ID = "vendor-order-uuid-1";

const globalRule = { id: "rule-global", scope: "global", vendorId: null, categoryId: null, ratePercent: "5.00" };
const categoryRule = { id: "rule-category", scope: "category", vendorId: null, categoryId: CATEGORY_ID, ratePercent: "8.00" };
const vendorRule = { id: "rule-vendor", scope: "vendor", vendorId: VENDOR_ID, categoryId: null, ratePercent: "12.00" };

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CommissionService", () => {
  // ── resolveRate ───────────────────────────────────────────────────────────

  describe("resolveRate()", () => {
    it("returns the vendor rate when a vendor-scoped rule exists (highest priority)", async () => {
      // DB returns vendor rule first when queried for vendor scope
      const db = {
        select: makeSelectMock([vendorRule]),
        insert: makeInsertMock(),
      };
      const redis = makeRedisMock(null); // cache miss — go to DB
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const rate = await svc.resolveRate(VENDOR_ID, CATEGORY_ID);

      expect(rate).toBe(12);
    });

    it("falls back to category rate when no vendor rule exists", async () => {
      // No vendor rule; category rule exists
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({ // vendor scope query → no rows
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          })
          .mockReturnValueOnce({ // category scope query → category rule
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([categoryRule]),
              }),
            }),
          }),
        insert: makeInsertMock(),
      };
      const redis = makeRedisMock(null);
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const rate = await svc.resolveRate(VENDOR_ID, CATEGORY_ID);

      expect(rate).toBe(8);
    });

    it("falls back to global rate when no vendor or category rule exists", async () => {
      // No vendor rule; no category rule; global rule exists
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({ // vendor scope query → no rows
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          })
          .mockReturnValueOnce({ // category scope query → no rows
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          })
          .mockReturnValueOnce({ // global scope query → global rule
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([globalRule]),
              }),
            }),
          }),
        insert: makeInsertMock(),
      };
      const redis = makeRedisMock(null);
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const rate = await svc.resolveRate(VENDOR_ID, CATEGORY_ID);

      expect(rate).toBe(5);
    });

    it("returns cached rate from Redis without DB queries (D-14)", async () => {
      // Redis returns a cached rate string
      const db = { select: vi.fn(), insert: makeInsertMock() };
      const redis = makeRedisMock("10"); // cached rate = 10%
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const rate = await svc.resolveRate(VENDOR_ID, CATEGORY_ID);

      expect(rate).toBe(10);
      // DB select was NOT called because Redis had the cached value
      expect(db.select).not.toHaveBeenCalled();
    });

    it("caches the resolved rate in Redis after a DB lookup", async () => {
      const db = {
        select: makeSelectMock([vendorRule]),
        insert: makeInsertMock(),
      };
      const redis = makeRedisMock(null);
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      await svc.resolveRate(VENDOR_ID, CATEGORY_ID);

      // setex should have been called to cache the resolved rate
      expect(redis.setex).toHaveBeenCalledWith(
        expect.stringContaining(VENDOR_ID),
        makeEnv().FEATURE_FLAG_TTL_SECONDS,
        "12"
      );
    });
  });

  // ── computeCommission ─────────────────────────────────────────────────────

  describe("computeCommission()", () => {
    it("computes 10% commission on subtotal 10000 → commission=1000, net=9000 (MKT-02)", async () => {
      // Redis returns cached rate 10
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("10");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 10000n,
      });

      expect(result.commissionMinor).toBe(1000n);
      expect(result.netVendorMinor).toBe(9000n);
    });

    it("commission + netVendor === subtotal exactly for clean subtotal (MKT-02 no-drift)", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("10");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 10000n,
      });

      expect(result.commissionMinor + result.netVendorMinor).toBe(10000n);
    });

    it("commission + netVendor === subtotal exactly for awkward amount 10001 at 10% (MKT-02, T-05-07)", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("10");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 10001n,
      });

      // allocate() must ensure exact reconciliation — no rounding drift
      expect(result.commissionMinor + result.netVendorMinor).toBe(10001n);
    });

    it("commission + netVendor === subtotal exactly for awkward amount 10001 at 33% (MKT-02, T-05-07)", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("33");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 10001n,
      });

      // 10001 * 33% = 3300.33 — allocate() must handle the residual without drift
      expect(result.commissionMinor + result.netVendorMinor).toBe(10001n);
    });

    it("commission + netVendor === subtotal exactly for a 7% rate on 9999 (additional drift check)", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("7");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 9999n,
      });

      expect(result.commissionMinor + result.netVendorMinor).toBe(9999n);
    });

    it("inserts a vendor_commission_entries row with status='earned' (MKT-01, D-12)", async () => {
      const insertValues = vi.fn().mockResolvedValue([{ id: "entry-1" }]);
      const insertMock = vi.fn().mockReturnValue({ values: insertValues });

      const db = { select: makeSelectMock([]), insert: insertMock };
      const redis = makeRedisMock("10");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 5000n,
      });

      expect(insertMock).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          vendorOrderId: VENDOR_ORDER_ID,
          status: "earned",
        })
      );
    });

    it("returns both commissionMinor and netVendorMinor as bigint values", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = makeRedisMock("10");
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never });

      const result = await svc.computeCommission({
        vendorOrderId: VENDOR_ORDER_ID,
        vendorId: VENDOR_ID,
        categoryId: CATEGORY_ID,
        subtotalMinor: 10000n,
      });

      expect(typeof result.commissionMinor).toBe("bigint");
      expect(typeof result.netVendorMinor).toBe("bigint");
    });
  });

  // ── Admin CRUD: getRules / createRule / updateRule / deleteRule ───────────
  // Added in Phase 6 Plan 07 (ADM-03, D-18, T-06-21, T-06-22)

  describe("getRules()", () => {
    it("returns { global, categoryOverrides, vendorOverrides } shape", async () => {
      const db = {
        select: vi.fn()
          // First call: all rules
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown[]) => void) => resolve([
                globalRule,
                categoryRule,
                vendorRule,
              ]),
              catch: vi.fn(),
              finally: vi.fn(),
            }),
          }),
        insert: makeInsertMock(),
      };
      const redis = makeRedisMock(null);
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      const result = await svc.getRules();

      expect(result).toHaveProperty("global");
      expect(result).toHaveProperty("categoryOverrides");
      expect(result).toHaveProperty("vendorOverrides");
      expect(result.global?.id).toBe("rule-global");
      expect(result.categoryOverrides).toHaveLength(1);
      expect(result.vendorOverrides).toHaveLength(1);
    });
  });

  describe("createRule()", () => {
    it("inserts a new category-scope rule, calls invalidateRateCache, and audits 'commission_rule.created'", async () => {
      const insertValues = vi.fn().mockResolvedValue([{ id: "new-rule-id" }]);
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              then: (resolve: (v: unknown[]) => void) => resolve([globalRule, categoryRule]),
              catch: vi.fn(),
              finally: vi.fn(),
            }),
          }),
        insert: vi.fn().mockReturnValue({ values: insertValues }),
      };
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue([]), del: vi.fn().mockResolvedValue(1) };
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.createRule(
        { scope: "category", categoryId: "cat-uuid-2", vendorId: null, ratePercent: 15 },
        "admin@example.com"
      );

      expect(db.insert).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({ scope: "category", categoryId: "cat-uuid-2" })
      );
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "commission_rule.created" })
      );
    });

    it("calls invalidateRateCache (clears commission:rate:* keys) on createRule", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            then: (resolve: (v: unknown[]) => void) => resolve([globalRule]),
            catch: vi.fn(),
            finally: vi.fn(),
          }),
        }),
        insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([{ id: "r2" }]) }),
      };
      const cacheKeys = ["commission:rate:vendor-1:cat-1", "commission:rate:vendor-2:cat-1"];
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue(cacheKeys), del: vi.fn().mockResolvedValue(2) };
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.createRule(
        { scope: "vendor", categoryId: null, vendorId: "vendor-uuid-new", ratePercent: 5 },
        "admin@example.com"
      );

      expect(redis.keys).toHaveBeenCalledWith("commission:rate:*");
      expect(redis.del).toHaveBeenCalled();
    });
  });

  describe("updateRule()", () => {
    it("updates rate, calls invalidateRateCache, and audits 'commission_rule.updated'", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([globalRule]),
            }),
          }),
        }),
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue([]), del: vi.fn().mockResolvedValue(0) };
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.updateRule("rule-global", { ratePercent: 12 }, "admin@example.com");

      expect(db.update).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "commission_rule.updated" })
      );
    });
  });

  describe("deleteRule()", () => {
    it("throws a coded error when the target rule scope is 'global' (T-06-21, D-18)", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([globalRule]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      };
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue([]), del: vi.fn().mockResolvedValue(0) };
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await expect(
        svc.deleteRule("rule-global", "admin@example.com")
      ).rejects.toThrow();

      // db.delete must NOT have been called (guard fires before delete)
      expect(db.delete).not.toHaveBeenCalled();
    });

    it("deletes a category-scope rule, calls invalidateRateCache, audits 'commission_rule.deleted'", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([categoryRule]),
            }),
          }),
        }),
        delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
      };
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue([]), del: vi.fn().mockResolvedValue(0) };
      const auditService = { log: vi.fn().mockResolvedValue(undefined) };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.deleteRule("rule-category", "admin@example.com");

      expect(db.delete).toHaveBeenCalled();
      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "commission_rule.deleted" })
      );
    });
  });

  describe("invalidateRateCache()", () => {
    it("calls redis.keys with 'commission:rate:*' and deletes all matching keys (T-06-22)", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const cacheKeys = [
        "commission:rate:vendor-1:cat-1",
        "commission:rate:vendor-2:cat-1",
      ];
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue(cacheKeys), del: vi.fn().mockResolvedValue(2) };
      const auditService = { log: vi.fn() };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.invalidateRateCache();

      expect(redis.keys).toHaveBeenCalledWith("commission:rate:*");
      expect(redis.del).toHaveBeenCalledWith(...cacheKeys);
    });

    it("does not call del when no commission:rate:* keys exist", async () => {
      const db = { select: makeSelectMock([]), insert: makeInsertMock() };
      const redis = { ...makeRedisMock(null), keys: vi.fn().mockResolvedValue([]), del: vi.fn() };
      const auditService = { log: vi.fn() };
      const svc = new CommissionService({ db: db as never, redis: redis as never, env: makeEnv() as never, auditService: auditService as never });

      await svc.invalidateRateCache();

      expect(redis.del).not.toHaveBeenCalled();
    });
  });
});
