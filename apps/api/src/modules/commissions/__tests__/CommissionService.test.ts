import { describe, expect, it, vi, beforeEach } from "vitest";

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
});
