import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Env } from "../../config/env.js";
import { allocate } from "@grovio/contracts/money";
import {
  commissionRules,
  vendorCommissionEntries,
} from "../../db/schema/index.js";
import type { AuditService } from "../audit/AuditService.js";
import type {
  CommissionRulesResponse,
  CreateCommissionRuleInput,
  UpdateCommissionRuleInput,
} from "@grovio/contracts/admin/commission-rules";

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface CommissionServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  env: Env;
  auditService: AuditService;
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
// Coded error for global-rule deletion protection (T-06-21, D-18)
// ---------------------------------------------------------------------------

/**
 * CommissionRuleProtectedError
 *
 * Thrown by deleteRule when the target rule has scope='global'.
 * The global commission rule is undeletable — it is the final fallback
 * in the priority chain (D-18 anti-pattern, T-06-21 mitigation).
 *
 * HTTP layer maps this error to a 403 Forbidden response.
 */
export class CommissionRuleProtectedError extends Error {
  readonly code = "COMMISSION_RULE_PROTECTED";

  constructor(ruleId: string) {
    super(`Commission rule ${ruleId} cannot be deleted: global rules are protected`);
    this.name = "CommissionRuleProtectedError";
  }
}

// ---------------------------------------------------------------------------
// CommissionService
// ---------------------------------------------------------------------------

/**
 * CommissionService
 *
 * Resolves commission rates and computes commissions with zero rounding drift.
 * Phase 6 adds admin CRUD for commission rules with cache invalidation and
 * global-rule deletion protection.
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
 * Admin CRUD (ADM-03, D-18, Phase 6):
 *   - getRules() → { global, categoryOverrides[], vendorOverrides[] }
 *   - createRule(input, adminEmail) → inserts rule, invalidates cache, audits
 *   - updateRule(id, input, adminEmail) → updates rate, invalidates cache, audits
 *   - deleteRule(id, adminEmail) → deletes rule (throws if global), invalidates cache, audits
 *   - invalidateRateCache() → scans and deletes all commission:rate:* Redis keys
 *
 * Security:
 *   - T-06-21: deleteRule throws CommissionRuleProtectedError for global rules
 *   - T-06-22: every mutation calls invalidateRateCache() to prevent stale rates
 *   - T-06-24: every mutation calls auditService.log with matching 'commission_rule.*' action
 *
 * No floating-point arithmetic — no float commission math anywhere (Pitfall 1, Pitfall 7).
 *
 * Methods:
 * - resolveRate(vendorId, categoryId) → rate as integer (e.g. 10 = 10%)
 * - computeCommission(params) → {commissionMinor, netVendorMinor}; inserts earned entry
 * - getRules() → CommissionRulesResponse
 * - createRule(input, adminEmail) → void
 * - updateRule(id, input, adminEmail) → void
 * - deleteRule(id, adminEmail) → void (throws CommissionRuleProtectedError for global)
 * - invalidateRateCache() → void
 *
 * Covers MKT-01, MKT-02, D-14, T-05-07, ADM-03, D-18, T-06-21, T-06-22, T-06-24.
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

  // ── Admin CRUD (Phase 6, ADM-03, D-18) ───────────────────────────────────

  /**
   * Get all commission rules grouped by scope (ADM-03, D-18).
   *
   * Returns the three-section structure for the admin commission UI:
   *   { global, categoryOverrides, vendorOverrides }
   *
   * The global rule is always present (seeded at install time).
   */
  async getRules(): Promise<CommissionRulesResponse> {
    const { db } = this.deps;

    const rules = await db.select().from(commissionRules);

    const globalRule = rules.find((r) => r.scope === "global");
    const categoryOverrides = rules.filter((r) => r.scope === "category");
    const vendorOverrides = rules.filter((r) => r.scope === "vendor");

    if (!globalRule) {
      throw new Error("No global commission rule found — database may not be seeded");
    }

    const mapRule = (r: typeof globalRule) => ({
      id: r.id,
      scope: r.scope as "global" | "category" | "vendor",
      categoryId: r.categoryId ?? null,
      vendorId: r.vendorId ?? null,
      ratePercent: parseFloat(r.ratePercent),
    });

    return {
      global: mapRule(globalRule),
      categoryOverrides: categoryOverrides.map(mapRule),
      vendorOverrides: vendorOverrides.map(mapRule),
    };
  }

  /**
   * Create a new category or vendor commission rule override (ADM-03, D-18).
   *
   * Cannot create a second global rule (the global rule is seeded once — D-18).
   * After insert: invalidates the rate cache (T-06-22) and audits 'commission_rule.created' (T-06-24).
   */
  async createRule(
    input: CreateCommissionRuleInput,
    adminEmail: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    // Note: CreateCommissionRuleInput scope is limited to 'category' | 'vendor' by the contracts schema
    // (prevents accidentally creating a second global rule at the contract layer — extra safety here)

    await db.insert(commissionRules).values({
      scope: input.scope,
      categoryId: input.categoryId ?? null,
      vendorId: input.vendorId ?? null,
      ratePercent: input.ratePercent.toFixed(2),
    });

    // Invalidate all cached commission rates (T-06-22, Pitfall 4)
    await this.invalidateRateCache();

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "commission_rule.created",
      entityType: "commission_rule",
      entityId: `${input.scope}:${input.categoryId ?? input.vendorId ?? "unknown"}`,
      before: null,
      after: {
        scope: input.scope,
        categoryId: input.categoryId,
        vendorId: input.vendorId,
        ratePercent: input.ratePercent,
      },
    });
  }

  /**
   * Update the rate of an existing commission rule (ADM-03, D-18).
   *
   * Only ratePercent is editable (scope and FK columns are immutable after creation).
   * After update: invalidates the rate cache (T-06-22) and audits 'commission_rule.updated' (T-06-24).
   */
  async updateRule(
    id: string,
    input: UpdateCommissionRuleInput,
    adminEmail: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    // Load before-state for audit
    const existing = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.id, id))
      .limit(1);

    const before = existing[0];
    if (!before) throw new Error(`Commission rule not found: ${id}`);

    await db
      .update(commissionRules)
      .set({ ratePercent: input.ratePercent.toFixed(2), updatedAt: new Date() })
      .where(eq(commissionRules.id, id));

    // Invalidate all cached commission rates (T-06-22)
    await this.invalidateRateCache();

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "commission_rule.updated",
      entityType: "commission_rule",
      entityId: id,
      before: { ratePercent: parseFloat(before.ratePercent) },
      after: { ratePercent: input.ratePercent },
    });
  }

  /**
   * Delete a category or vendor commission rule override (ADM-03, D-18, T-06-21).
   *
   * THROWS CommissionRuleProtectedError if the rule scope is 'global'.
   * The global rule is the undeletable fallback in the priority chain — deleting
   * it would break commission resolution for all orders (T-06-21 mitigation, D-18).
   *
   * After delete: invalidates the rate cache (T-06-22) and audits 'commission_rule.deleted' (T-06-24).
   */
  async deleteRule(id: string, adminEmail: string): Promise<void> {
    const { db, auditService } = this.deps;

    // Load the rule to check scope and get before-state
    const existing = await db
      .select()
      .from(commissionRules)
      .where(eq(commissionRules.id, id))
      .limit(1);

    const rule = existing[0];
    if (!rule) throw new Error(`Commission rule not found: ${id}`);

    // Guard: global rules cannot be deleted (T-06-21, D-18 anti-pattern)
    if (rule.scope === "global") {
      throw new CommissionRuleProtectedError(id);
    }

    await db.delete(commissionRules).where(eq(commissionRules.id, id));

    // Invalidate all cached commission rates (T-06-22)
    await this.invalidateRateCache();

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "commission_rule.deleted",
      entityType: "commission_rule",
      entityId: id,
      before: {
        scope: rule.scope,
        categoryId: rule.categoryId,
        vendorId: rule.vendorId,
        ratePercent: parseFloat(rule.ratePercent),
      },
      after: null,
    });
  }

  /**
   * Invalidate all cached commission rates in Redis.
   *
   * Scans for all keys matching 'commission:rate:*' and deletes them.
   * Called after every rule mutation to prevent stale rates from being served
   * to CommissionService.resolveRate() callers (T-06-22, Pitfall 4).
   *
   * Simple v1 approach: KEYS pattern then DEL (acceptable at v1 rule-set size).
   * For larger deployments: SCAN + pipeline DEL for better memory efficiency.
   */
  async invalidateRateCache(): Promise<void> {
    const { redis } = this.deps;

    const keys = await redis.keys("commission:rate:*");
    if (keys.length > 0) {
      await redis.del(...keys);
    }
  }
}
