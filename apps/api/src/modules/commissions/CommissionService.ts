import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { allocate } from "@grovio/contracts/money";
import {
  commissionRules,
  vendorCommissionEntries,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface CommissionServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
}

// ---------------------------------------------------------------------------
// Input/output types
// ---------------------------------------------------------------------------

export interface ComputeCommissionParams {
  vendorOrderId: string;
  vendorId: string;
  categoryId: string;
  subtotalMinor: bigint;
}

export interface CommissionResult {
  /** Platform commission amount in minor units (paise/cents). */
  commissionMinor: bigint;
  /** Vendor net amount in minor units after commission deducted. */
  netVendorMinor: bigint;
}

// ---------------------------------------------------------------------------
// CommissionService
// ---------------------------------------------------------------------------

/**
 * CommissionService
 *
 * Resolves commission rates and computes commissions with zero rounding drift.
 *
 * Rate resolution (D-14, MKT-01):
 *   Priority chain: vendor override > category override > global default.
 *   The most-specific rule wins. Rates are cached in Redis with FEATURE_FLAG_TTL_SECONDS.
 *
 * Commission computation (MKT-02, T-05-07):
 *   Uses allocate() from @grovio/contracts/money to split subtotalMinor into
 *   [commissionMinor, netVendorMinor] using the largest-remainder method.
 *   The sum commissionMinor + netVendorMinor === subtotalMinor EXACTLY for all
 *   amounts, including awkward values like 10001 at 33%.
 *
 * No floating-point arithmetic — no float commission math anywhere (Pitfall 1, Pitfall 7).
 *
 * Methods:
 * - resolveRate(vendorId, categoryId) → rate as integer (e.g. 10 = 10%)
 * - computeCommission(params) → {commissionMinor, netVendorMinor}; inserts earned entry
 *
 * Covers MKT-01, MKT-02, D-14, T-05-07.
 */
export class CommissionService {
  constructor(private deps: CommissionServiceDeps) {}

  // ── Redis key ─────────────────────────────────────────────────────────────

  private rateRedisKey(vendorId: string, categoryId: string): string {
    return `commission:rate:${vendorId}:${categoryId}`;
  }

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Resolve the commission rate for a vendor+category combination (MKT-01, D-14).
   *
   * Priority chain (most-specific wins):
   *   1. Vendor-scoped rule (scope='vendor', matching vendorId)
   *   2. Category-scoped rule (scope='category', matching categoryId)
   *   3. Global rule (scope='global')
   *
   * Redis cache: checks Redis first. On a cache miss, queries the DB and caches the
   * resolved rate with FEATURE_FLAG_TTL_SECONDS TTL (same pattern as FeatureFlagService).
   *
   * @returns integer rate (e.g., 10 for 10%) — converted from NUMERIC(5,2) string "10.00"
   */
  async resolveRate(vendorId: string, categoryId: string): Promise<number> {
    const { db, redis, env } = this.deps;

    const cacheKey = this.rateRedisKey(vendorId, categoryId);

    // Redis-first: return cached rate immediately if present
    const cached = await redis.get(cacheKey);
    if (cached !== null) {
      return parseInt(cached, 10);
    }

    // DB fallback: priority chain (vendor > category > global)

    // 1. Vendor-specific rule
    const vendorRows = await db
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.scope, "vendor"),
          eq(commissionRules.vendorId, vendorId)
        )
      )
      .limit(1);

    if (vendorRows[0]) {
      const rate = Math.round(parseFloat(vendorRows[0].ratePercent));
      await redis.setex(cacheKey, env.FEATURE_FLAG_TTL_SECONDS, String(rate));
      return rate;
    }

    // 2. Category-specific rule
    const categoryRows = await db
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.scope, "category"),
          eq(commissionRules.categoryId, categoryId)
        )
      )
      .limit(1);

    if (categoryRows[0]) {
      const rate = Math.round(parseFloat(categoryRows[0].ratePercent));
      await redis.setex(cacheKey, env.FEATURE_FLAG_TTL_SECONDS, String(rate));
      return rate;
    }

    // 3. Global fallback
    const globalRows = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.scope, "global"))
      .limit(1);

    if (globalRows[0]) {
      const rate = Math.round(parseFloat(globalRows[0].ratePercent));
      await redis.setex(cacheKey, env.FEATURE_FLAG_TTL_SECONDS, String(rate));
      return rate;
    }

    // No commission rules at all — default to 0% (safe fallback for new installs)
    const defaultRate = 0;
    await redis.setex(cacheKey, env.FEATURE_FLAG_TTL_SECONDS, String(defaultRate));
    return defaultRate;
  }

  /**
   * Compute commission for a vendor sub-order and insert an 'earned' entry (MKT-01, MKT-02).
   *
   * Uses allocate() from @grovio/contracts/money for the commission/net split.
   * allocate() uses the largest-remainder method to guarantee:
   *   commissionMinor + netVendorMinor === subtotalMinor EXACTLY (T-05-07, Pitfall 1/7).
   *
   * Algorithm:
   *   rate = resolveRate(vendorId, categoryId)    // integer, e.g. 10
   *   [commissionMinor, netVendorMinor] = allocate(subtotalMinor, [rate, 100 - rate])
   *   insert vendor_commission_entries with status='earned'
   *
   * No float multiplication anywhere — commission math is pure BIGINT (Pitfall 1).
   *
   * @returns {commissionMinor, netVendorMinor} as bigint values
   */
  async computeCommission(
    params: ComputeCommissionParams
  ): Promise<CommissionResult> {
    const { db } = this.deps;

    const rate = await this.resolveRate(params.vendorId, params.categoryId);

    // Split subtotal into [commission, net] using allocate() (T-05-07, MKT-02)
    // Parts: [rate, 100 - rate] — e.g., [10, 90] for a 10% commission
    // allocate() guarantees parts sum exactly to subtotalMinor (no rounding drift)
    const rateParts = [rate, 100 - rate] as const;
    const [commissionMinor, netVendorMinor] = allocate(
      params.subtotalMinor,
      rateParts
    );

    // Type guard: allocate always returns exactly 2 elements for 2 ratio inputs
    if (commissionMinor === undefined || netVendorMinor === undefined) {
      throw new Error("allocate() returned unexpected result");
    }

    // Insert append-only commission entry with status='earned' (D-12, MKT-01)
    await db.insert(vendorCommissionEntries).values({
      vendorOrderId: params.vendorOrderId,
      ratePercent: rate.toFixed(2),
      orderSubtotalMinor: Number(params.subtotalMinor),
      commissionAmountMinor: Number(commissionMinor),
      status: "earned",
    });

    return { commissionMinor, netVendorMinor };
  }
}
