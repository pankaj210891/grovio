import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// CouponService tests — CHK-06, D-17, D-18, T-05-04, T-05-CPN
//
// TDD RED: tests are written first to define expected behavior.
// All DB + Redis + featureFlagService interactions are mocked; no live infra required.
//
// Key assertions:
// - COUPONS_ENABLED gate short-circuits before any DB lookup (CHK-06)
// - Valid flat coupon returns discountValue as discountMinor (D-17)
// - Valid percentage coupon returns floor(subtotal*pct/100) as discountMinor (D-17)
// - Expired coupon throws CouponInvalidError (D-18)
// - Over-max-redemptions coupon throws CouponInvalidError (D-18)
// - Below-min-order coupon throws CouponInvalidError (D-18)
// - Scope-mismatch coupon throws CouponInvalidError (D-17)
// ---------------------------------------------------------------------------

import { CouponService, CouponDisabledError, CouponInvalidError } from "../CouponService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a Drizzle select mock that returns `rows` via limit(). */
function makeSelectMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** Build a Redis mock. */
function makeRedisMock(cachedValue: string | null = null) {
  return {
    get: vi.fn().mockResolvedValue(cachedValue),
    setex: vi.fn().mockResolvedValue("OK"),
  };
}

/** Build a mock env object. */
function makeEnv() {
  return { COUPON_CACHE_TTL_SECONDS: 60, FEATURE_FLAG_TTL_SECONDS: 60 };
}

/** Build a mock FeatureFlagService. */
function makeFeatureFlagService(flagValue: string | null) {
  return {
    getFlag: vi.fn().mockResolvedValue(flagValue),
  };
}

// ---------------------------------------------------------------------------
// Coupon fixtures
// ---------------------------------------------------------------------------

const VENDOR_ID_A = "vendor-uuid-a";
const VENDOR_ID_B = "vendor-uuid-b";
const PRODUCT_ID_A = "product-uuid-a";
const CATEGORY_ID_A = "category-uuid-a";

const now = new Date();
const future = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000); // 7 days from now
const past = new Date(now.getTime() - 24 * 60 * 60 * 1000); // 1 day ago

/** A valid active global flat coupon: ₹50 off, no min, unlimited */
const validFlatCoupon = {
  id: "coupon-flat-1",
  code: "FLAT50",
  discountType: "flat",
  discountValue: 5000, // 5000 minor units = ₹50
  scopeType: "global",
  scopeId: null,
  minOrderMinor: 0,
  maxRedemptions: null,
  redemptionCount: 0,
  expiresAt: null,
  isActive: true,
};

/** A valid active global percentage coupon: 10% off */
const validPercentageCoupon = {
  id: "coupon-pct-1",
  code: "PCT10",
  discountType: "percentage",
  discountValue: 10, // 10%
  scopeType: "global",
  scopeId: null,
  minOrderMinor: 0,
  maxRedemptions: null,
  redemptionCount: 0,
  expiresAt: null,
  isActive: true,
};

/** Vendor-scoped coupon: applies to VENDOR_ID_A only */
const vendorScopedCoupon = {
  id: "coupon-vendor-1",
  code: "VENDOR10",
  discountType: "flat",
  discountValue: 1000,
  scopeType: "vendor",
  scopeId: VENDOR_ID_A,
  minOrderMinor: 0,
  maxRedemptions: null,
  redemptionCount: 0,
  expiresAt: null,
  isActive: true,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CouponService", () => {
  // ── Feature flag gate ─────────────────────────────────────────────────────

  describe("COUPONS_ENABLED feature flag gate (CHK-06)", () => {
    it("throws CouponDisabledError when COUPONS_ENABLED flag is off (null)", async () => {
      const db = { select: vi.fn() }; // DB should NOT be called
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService(null); // flag off
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponDisabledError);
    });

    it("throws CouponDisabledError with code COUPONS_DISABLED when flag is off", async () => {
      const db = { select: vi.fn() };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService(null);
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      try {
        await svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CouponDisabledError);
        expect((err as CouponDisabledError).code).toBe("COUPONS_DISABLED");
      }
    });

    it("does NOT query DB when COUPONS_ENABLED flag is off (CHK-06)", async () => {
      const dbSelect = vi.fn();
      const db = { select: dbSelect };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService(null);
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponDisabledError);

      expect(dbSelect).not.toHaveBeenCalled();
    });

    it("proceeds to DB lookup when COUPONS_ENABLED flag is 'true'", async () => {
      const db = { select: makeSelectMock([validFlatCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true"); // flag on
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "FLAT50",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.code).toBe("FLAT50");
      expect(db.select).toHaveBeenCalled();
    });
  });

  // ── Valid flat coupon ─────────────────────────────────────────────────────

  describe("validateCoupon() — valid flat coupon", () => {
    it("returns discountMinor equal to discountValue for a flat coupon (D-17)", async () => {
      const db = { select: makeSelectMock([validFlatCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "FLAT50",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(5000);
      expect(result.code).toBe("FLAT50");
    });

    it("caps flat discount at eligible subtotal (discount cannot exceed order value)", async () => {
      const largeFlatCoupon = { ...validFlatCoupon, discountValue: 20000 }; // ₹200 off
      const db = { select: makeSelectMock([largeFlatCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "FLAT50",
        orderSubtotalMinor: 10000, // order is only ₹100
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(10000); // capped at eligible subtotal
    });

    it("returns scopeDescription for a global coupon", async () => {
      const db = { select: makeSelectMock([validFlatCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "FLAT50",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result).toHaveProperty("scopeDescription");
    });
  });

  // ── Valid percentage coupon ───────────────────────────────────────────────

  describe("validateCoupon() — valid percentage coupon", () => {
    it("returns floor(subtotal * pct / 100) for a percentage coupon (D-17)", async () => {
      const db = { select: makeSelectMock([validPercentageCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      // 10% of 10000 = 1000
      const result = await svc.validateCoupon({
        code: "PCT10",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(1000);
    });

    it("uses integer math (floor) for percentage discount — no floating point (Pitfall 1)", async () => {
      const db = { select: makeSelectMock([validPercentageCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      // 10% of 10001 = 1000.1 → floor = 1000
      const result = await svc.validateCoupon({
        code: "PCT10",
        orderSubtotalMinor: 10001,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(1000); // floored, not 1000.1
      expect(Number.isInteger(result.discountMinor)).toBe(true);
    });

    it("caps percentage discount at eligible subtotal (cannot exceed 100%)", async () => {
      const over100Coupon = { ...validPercentageCoupon, discountValue: 150 }; // 150%
      const db = { select: makeSelectMock([over100Coupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "PCT10",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(10000); // capped at eligible subtotal
    });
  });

  // ── CouponInvalidError cases ──────────────────────────────────────────────

  describe("validateCoupon() — CouponInvalidError cases (D-18)", () => {
    it("throws CouponInvalidError when coupon code does not exist", async () => {
      const db = { select: makeSelectMock([]) }; // no coupon found
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "NONEXISTENT",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("throws CouponInvalidError when coupon is inactive", async () => {
      const inactiveCoupon = { ...validFlatCoupon, isActive: false };
      const db = { select: makeSelectMock([inactiveCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("throws CouponInvalidError with code COUPON_INVALID and reason for expired coupon (D-18)", async () => {
      const expiredCoupon = { ...validFlatCoupon, expiresAt: past };
      const db = { select: makeSelectMock([expiredCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      try {
        await svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        });
        expect.fail("should have thrown");
      } catch (err) {
        expect(err).toBeInstanceOf(CouponInvalidError);
        expect((err as CouponInvalidError).code).toBe("COUPON_INVALID");
        expect((err as CouponInvalidError).reason).toBeTruthy();
      }
    });

    it("throws CouponInvalidError for over-redemption coupon (D-18)", async () => {
      const overUsedCoupon = {
        ...validFlatCoupon,
        maxRedemptions: 10,
        redemptionCount: 10, // at max
      };
      const db = { select: makeSelectMock([overUsedCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("throws CouponInvalidError when order subtotal is below minOrderMinor (D-18)", async () => {
      const minOrderCoupon = {
        ...validFlatCoupon,
        minOrderMinor: 20000, // min ₹200
      };
      const db = { select: makeSelectMock([minOrderCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "FLAT50",
          orderSubtotalMinor: 10000, // ₹100 < ₹200 min
          vendorIds: [],
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("throws CouponInvalidError when vendor-scoped coupon is used for wrong vendor (D-17)", async () => {
      const db = { select: makeSelectMock([vendorScopedCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "VENDOR10",
          orderSubtotalMinor: 10000,
          vendorIds: [VENDOR_ID_B], // WRONG vendor
          productIds: [],
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("succeeds when vendor-scoped coupon is used for the correct vendor (D-17)", async () => {
      const db = { select: makeSelectMock([vendorScopedCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "VENDOR10",
        orderSubtotalMinor: 10000,
        vendorIds: [VENDOR_ID_A], // CORRECT vendor
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(1000);
    });

    it("throws CouponInvalidError for product-scoped coupon with mismatched product (D-17)", async () => {
      const productScopedCoupon = {
        ...validFlatCoupon,
        id: "coupon-product-1",
        code: "PRODUCT10",
        scopeType: "product",
        scopeId: PRODUCT_ID_A,
      };
      const db = { select: makeSelectMock([productScopedCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "PRODUCT10",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: ["other-product-id"], // different product
          categoryIds: [],
        })
      ).rejects.toThrow(CouponInvalidError);
    });

    it("throws CouponInvalidError for category-scoped coupon with mismatched category (D-17)", async () => {
      const categoryScopedCoupon = {
        ...validFlatCoupon,
        id: "coupon-category-1",
        code: "CAT10",
        scopeType: "category",
        scopeId: CATEGORY_ID_A,
      };
      const db = { select: makeSelectMock([categoryScopedCoupon]) };
      const redis = makeRedisMock(null);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: db as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      await expect(
        svc.validateCoupon({
          code: "CAT10",
          orderSubtotalMinor: 10000,
          vendorIds: [],
          productIds: [],
          categoryIds: ["other-category-id"], // different category
        })
      ).rejects.toThrow(CouponInvalidError);
    });
  });

  // ── Redis cache ───────────────────────────────────────────────────────────

  describe("Redis caching behavior", () => {
    it("uses Redis-cached coupon when cache hit (avoids DB query)", async () => {
      // Cache holds the serialized coupon
      const cachedCoupon = JSON.stringify(validFlatCoupon);
      const dbSelect = vi.fn();
      const redis = makeRedisMock(cachedCoupon);
      const featureFlagService = makeFeatureFlagService("true");
      const svc = new CouponService({
        db: { select: dbSelect } as never,
        redis: redis as never,
        env: makeEnv() as never,
        featureFlagService: featureFlagService as never,
      });

      const result = await svc.validateCoupon({
        code: "FLAT50",
        orderSubtotalMinor: 10000,
        vendorIds: [],
        productIds: [],
        categoryIds: [],
      });

      expect(result.discountMinor).toBe(5000);
      expect(dbSelect).not.toHaveBeenCalled();
    });
  });
});
