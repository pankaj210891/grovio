import { eq, ilike } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import type { FeatureFlagService } from "../feature-flags/FeatureFlagService.js";
import { coupons } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when the COUPONS_ENABLED feature flag is off (D-17, CHK-06, T-05-CPN).
 *
 * Code COUPONS_DISABLED lets routes return a structured 400/422 response
 * without relying on error message string matching.
 *
 * This error short-circuits BEFORE any DB lookup — no coupon data is loaded
 * when coupons are globally disabled.
 */
export class CouponDisabledError extends Error {
  readonly code = "COUPONS_DISABLED";

  constructor(message = "Coupons are currently disabled.") {
    super(message);
    this.name = "CouponDisabledError";
  }
}

/**
 * Thrown when a coupon code fails any eligibility check (D-17, D-18, T-05-04).
 *
 * The `reason` field contains a human-readable description of the failure:
 *   - "NOT_FOUND": code does not exist or coupon is inactive
 *   - "EXPIRED": coupon has passed its expiresAt date
 *   - "MAX_REDEMPTIONS": coupon has reached its max redemption count
 *   - "MIN_ORDER_NOT_MET": order subtotal is below minOrderMinor
 *   - "SCOPE_MISMATCH": coupon scope does not match provided vendor/product/category IDs
 *
 * Security (T-05-04): Discount is NEVER taken from the client — it is always
 * recomputed server-side by validateCoupon(). CouponInvalidError prevents
 * invalid codes from being applied silently.
 */
export class CouponInvalidError extends Error {
  readonly code = "COUPON_INVALID";

  constructor(
    public readonly reason: string,
    message?: string
  ) {
    super(message ?? `Coupon is invalid: ${reason}`);
    this.name = "CouponInvalidError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface CouponServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
  featureFlagService: FeatureFlagService;
}

// ---------------------------------------------------------------------------
// Input/output types
// ---------------------------------------------------------------------------

export interface ValidateCouponParams {
  /** Coupon code entered by the customer (case-insensitive). */
  code: string;
  /** Order subtotal in minor currency units (backend-authoritative). */
  orderSubtotalMinor: number;
  /** IDs of vendors in the order. Used for vendor-scope matching (D-17). */
  vendorIds: string[];
  /** IDs of products in the order. Used for product-scope matching (D-17). */
  productIds: string[];
  /** IDs of categories in the order. Used for category-scope matching (D-17). */
  categoryIds: string[];
}

export interface CouponValidationResult {
  /** The validated coupon code. */
  code: string;
  /**
   * Computed discount in minor currency units (server-authoritative — Pitfall 6).
   * Never exceeds the eligible subtotal.
   * Flat: min(discountValue, orderSubtotalMinor).
   * Percentage: min(floor(orderSubtotalMinor * pct / 100), orderSubtotalMinor).
   */
  discountMinor: number;
  /** Human-readable scope description for order summary display. */
  scopeDescription: string;
}

// ---------------------------------------------------------------------------
// Redis key helper
// ---------------------------------------------------------------------------

const COUPON_CACHE_PREFIX = "coupon:code:";

// ---------------------------------------------------------------------------
// CouponService
// ---------------------------------------------------------------------------

/**
 * CouponService
 *
 * Server-authoritative coupon validation (CHK-06, D-17, D-18, Pitfall 6).
 *
 * Security model:
 * - Discount is ALWAYS recomputed from the coupons table — the client-provided
 *   discount amount is NEVER trusted (T-05-04, Pitfall 6).
 * - COUPONS_ENABLED feature flag is checked FIRST — no DB queries when disabled (D-17).
 * - Redis caches coupon rows by code (read path only). Write/redemption increments
 *   invalidate the cache. Default TTL driven by env.FEATURE_FLAG_TTL_SECONDS.
 *
 * Discount computation:
 * - Flat: discountMinor = min(discountValue, orderSubtotalMinor)
 * - Percentage: discountMinor = min(floor(orderSubtotalMinor * pct / 100), orderSubtotalMinor)
 *   Pure integer math (no floats) — Pitfall 1.
 *
 * Eligibility checks (D-18):
 * 1. isActive must be true
 * 2. expiresAt must be in the future (if set)
 * 3. redemptionCount < maxRedemptions (if maxRedemptions is set)
 * 4. orderSubtotalMinor >= minOrderMinor
 * 5. Scope match: vendor/product/category IDs must include coupon's scopeId (if scoped)
 *
 * Methods:
 * - validateCoupon(params) → {code, discountMinor, scopeDescription} or throws
 *
 * Covers CHK-06, D-17, D-18, T-05-04, T-05-CPN.
 */
export class CouponService {
  constructor(private deps: CouponServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Validate a coupon code and return the server-computed discount (CHK-06, D-17, D-18).
   *
   * Step 1: Check COUPONS_ENABLED feature flag — throw CouponDisabledError if off.
   * Step 2: Load coupon row (Redis cache → DB fallback).
   * Step 3: Run eligibility checks (isActive, expiry, redemptions, minOrder, scope).
   * Step 4: Compute discountMinor with integer math.
   * Step 5: Return {code, discountMinor, scopeDescription}.
   *
   * @throws CouponDisabledError — coupons feature is off
   * @throws CouponInvalidError  — code invalid or any eligibility check fails
   */
  async validateCoupon(
    params: ValidateCouponParams
  ): Promise<CouponValidationResult> {
    const { featureFlagService } = this.deps;

    // ── Step 1: Feature flag gate (CHK-06, D-17, T-05-CPN) ──────────────────
    // Short-circuit BEFORE any DB lookup when coupons are disabled.
    const flagValue = await featureFlagService.getFlag("COUPONS_ENABLED");
    if (flagValue === null) {
      throw new CouponDisabledError();
    }

    // ── Step 2: Load coupon row (Redis → DB) ─────────────────────────────────
    const coupon = await this.loadCoupon(params.code);
    if (!coupon) {
      throw new CouponInvalidError("NOT_FOUND", "Coupon code not found.");
    }

    // ── Step 3: Eligibility checks (D-18) ────────────────────────────────────

    // 3a. Active check
    if (!coupon.isActive) {
      throw new CouponInvalidError("NOT_FOUND", "Coupon code not found.");
    }

    // 3b. Expiry check
    if (coupon.expiresAt !== null && coupon.expiresAt <= new Date()) {
      throw new CouponInvalidError("EXPIRED", "This coupon has expired.");
    }

    // 3c. Redemption count check
    if (
      coupon.maxRedemptions !== null &&
      coupon.redemptionCount >= coupon.maxRedemptions
    ) {
      throw new CouponInvalidError(
        "MAX_REDEMPTIONS",
        "This coupon has reached its maximum number of uses."
      );
    }

    // 3d. Minimum order check
    if (params.orderSubtotalMinor < coupon.minOrderMinor) {
      throw new CouponInvalidError(
        "MIN_ORDER_NOT_MET",
        `A minimum order value of ${coupon.minOrderMinor} is required for this coupon.`
      );
    }

    // 3e. Scope match check (D-17)
    const scopeMatch = this.checkScopeMatch(coupon, params);
    if (!scopeMatch) {
      throw new CouponInvalidError(
        "SCOPE_MISMATCH",
        "This coupon is not applicable to the items in your order."
      );
    }

    // ── Step 4: Compute discount with integer math (Pitfall 1) ───────────────
    const discountMinor = this.computeDiscount(
      coupon.discountType,
      coupon.discountValue,
      params.orderSubtotalMinor
    );

    // ── Step 5: Build result ──────────────────────────────────────────────────
    const scopeDescription = this.buildScopeDescription(coupon.scopeType);

    return {
      code: coupon.code,
      discountMinor,
      scopeDescription,
    };
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Load a coupon row by code. Redis-first read path.
   * Cache key: "coupon:code:<normalised-code>"
   *
   * On a cache miss, queries the DB by code (case-insensitive via ilike).
   * On a DB hit, populates the Redis cache for subsequent reads.
   *
   * @returns the coupon row or null if not found
   */
  private async loadCoupon(
    code: string
  ): Promise<(typeof coupons.$inferSelect) | null> {
    const { db, redis, env } = this.deps;

    const normalised = code.toUpperCase().trim();
    const cacheKey = COUPON_CACHE_PREFIX + normalised;

    // Redis-first
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return JSON.parse(cached) as typeof coupons.$inferSelect;
    }

    // DB fallback — case-insensitive lookup
    const rows = await db
      .select()
      .from(coupons)
      .where(ilike(coupons.code, normalised))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Populate cache for subsequent reads
    const ttl =
      (env as { COUPON_CACHE_TTL_SECONDS?: number }).COUPON_CACHE_TTL_SECONDS ??
      env.FEATURE_FLAG_TTL_SECONDS;
    await redis.setex(cacheKey, ttl, JSON.stringify(row));

    return row;
  }

  /**
   * Check whether the coupon's scope matches the provided order context (D-17).
   *
   * Global scope (scopeId = null): always matches.
   * Vendor scope: coupon.scopeId must be in params.vendorIds.
   * Product scope: coupon.scopeId must be in params.productIds.
   * Category scope: coupon.scopeId must be in params.categoryIds.
   */
  private checkScopeMatch(
    coupon: typeof coupons.$inferSelect,
    params: ValidateCouponParams
  ): boolean {
    if (!coupon.scopeId) {
      return true; // global scope always matches
    }

    switch (coupon.scopeType) {
      case "vendor":
        return params.vendorIds.includes(coupon.scopeId);
      case "product":
        return params.productIds.includes(coupon.scopeId);
      case "category":
        return params.categoryIds.includes(coupon.scopeId);
      default:
        return false; // unknown scope type — reject for safety
    }
  }

  /**
   * Compute discount in minor currency units with integer math only (Pitfall 1).
   *
   * Flat: min(discountValue, orderSubtotalMinor)
   * Percentage: min(Math.floor(orderSubtotalMinor * pct / 100), orderSubtotalMinor)
   *   - Math.floor ensures no fractional minor units (integer math, Pitfall 1)
   *   - Cap at orderSubtotalMinor prevents negative order totals
   */
  private computeDiscount(
    discountType: string,
    discountValue: number,
    orderSubtotalMinor: number
  ): number {
    if (discountType === "flat") {
      return Math.min(discountValue, orderSubtotalMinor);
    }

    if (discountType === "percentage") {
      // Integer math: floor to avoid fractional minor units (Pitfall 1)
      const computed = Math.floor((orderSubtotalMinor * discountValue) / 100);
      return Math.min(computed, orderSubtotalMinor);
    }

    // Unknown discount type — no discount (safe fallback)
    return 0;
  }

  /**
   * Build a human-readable scope description for the order summary (D-17).
   */
  private buildScopeDescription(scopeType: string): string {
    switch (scopeType) {
      case "vendor":
        return "Applies to items from a specific vendor";
      case "product":
        return "Applies to a specific product";
      case "category":
        return "Applies to items in a specific category";
      default:
        return "Applies to your entire order";
    }
  }
}
