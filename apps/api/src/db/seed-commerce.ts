/**
 * Commerce Core seed script — Phase 5 (Plan 05-04)
 *
 * Idempotently seeds the two rows that Phase 5 services require at startup:
 *
 *   1. COUPONS_ENABLED feature flag — defaults to disabled (false).
 *      CHK-06: CouponService short-circuits immediately when this flag is off.
 *      Admin enables it via the Phase 6 admin panel (no customer-facing coupon
 *      path is active until the flag is turned on, per T-05-FF threat disposition).
 *
 *   2. Global commission rule — default 10% flat rate.
 *      MKT-01: CommissionService falls back to this row when no vendor- or
 *      category-scoped rule exists (D-14 priority chain: global → category → vendor).
 *      Ensures every order always has a valid commission rate without manual config.
 *
 * Both inserts are idempotent — safe to run multiple times.
 * The feature_flags row uses onConflictDoNothing on the unique `key` column.
 * The commission_rules row checks for an existing global rule before inserting.
 *
 * Run: pnpm --filter @grovio/api db:seed:commerce
 */

import { and, eq, isNull } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema/index.js";

const DATABASE_URL =
  process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error(
    "[seed:commerce] ERROR: DATABASE_URL or DATABASE_DIRECT_URL must be set."
  );
  process.exit(1);
}

const usesSsl =
  DATABASE_URL.includes(".neon.tech") ||
  DATABASE_URL.includes("sslmode=require");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(usesSsl ? { ssl: true } : {}),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzle({ client: pool }) as any;

async function seed() {
  console.log("[seed:commerce] Connecting to database...");
  await pool.query("SELECT 1");
  console.log("[seed:commerce] Connected.");

  // ---- 1. COUPONS_ENABLED feature flag ----
  // Inserts a disabled coupon feature flag row (CHK-06, T-05-FF).
  // Admin enables this in Phase 6 via the admin panel.
  // onConflictDoNothing targets the unique `key` column — idempotent on re-run.
  const flagResult = await db
    .insert(schema.featureFlags)
    .values({
      key: "COUPONS_ENABLED",
      value: "false",
      description:
        "Feature flag for the coupon engine (CHK-06). " +
        "When false, CouponService short-circuits and no coupon paths are active. " +
        "Enable via the Phase 6 admin panel. Default: off (T-05-FF).",
      isEnabled: false,
    })
    .onConflictDoNothing()
    .returning({ id: schema.featureFlags.id, key: schema.featureFlags.key });

  if (flagResult.length > 0) {
    console.log(
      `[seed:commerce] Inserted COUPONS_ENABLED feature flag (id=${flagResult[0]?.id})`
    );
  } else {
    console.log(
      "[seed:commerce] COUPONS_ENABLED flag already exists — skipped (idempotent)."
    );
  }

  // ---- 2. Global default commission rule ----
  // Inserts a global 10% commission rule (MKT-01 fallback, D-14).
  // Priority chain: vendor override > category override > global default.
  // CommissionService uses this row to compute commission amounts when no
  // vendor- or category-scoped rule exists for a sub-order.
  // Idempotency: check for existing global rule before inserting to avoid duplicates
  // (commission_rules has no unique constraint on scope alone — by design, to allow
  // multiple vendor/category overrides with the same scope value).
  const globalRules = await db
    .select({ id: schema.commissionRules.id })
    .from(schema.commissionRules)
    .where(
      and(
        eq(schema.commissionRules.scope, "global"),
        isNull(schema.commissionRules.vendorId),
        isNull(schema.commissionRules.categoryId)
      )
    );

  if (globalRules.length === 0) {
    const ruleResult = await db
      .insert(schema.commissionRules)
      .values({
        scope: "global",
        vendorId: null,
        categoryId: null,
        ratePercent: "10.00",
      })
      .returning({
        id: schema.commissionRules.id,
        scope: schema.commissionRules.scope,
        ratePercent: schema.commissionRules.ratePercent,
      });

    if (ruleResult[0]) {
      console.log(
        `[seed:commerce] Inserted global commission rule: scope=global, ratePercent=10.00 (id=${ruleResult[0].id})`
      );
    }
  } else {
    console.log(
      `[seed:commerce] Global commission rule already exists (id=${globalRules[0]?.id}) — skipped (idempotent).`
    );
  }

  console.log("[seed:commerce] Seed complete.");
}

seed()
  .catch((err) => {
    console.error("[seed:commerce] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
