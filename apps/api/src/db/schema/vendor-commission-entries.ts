import {
  bigint,
  numeric,
  pgEnum,
  pgTable,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendorOrders } from "./vendor-orders.js";

/**
 * commissionStatusEnum — status values for vendor commission entries (D-12, MKT-03).
 *
 * Values MUST exactly match CommissionStatusSchema in packages/contracts/src/commissions/types.ts.
 *
 * Append-only pattern (analogous to wallet_entries — WAL-03):
 * - earned: commission recorded when order payment is captured (PAYMENT_CAPTURED webhook)
 * - reversed: proportional reversal entry appended when a return is approved (MKT-03, D-15)
 * - net: net commission after reversal (computed/reporting view; not stored directly in Phase 5)
 */
export const commissionStatusEnum = pgEnum("commission_status", [
  "earned",
  "reversed",
  "net",
]);

/**
 * vendor_commission_entries table — append-only commission ledger (D-12, MKT-01, MKT-02, MKT-03)
 *
 * Records commission amounts per vendor sub-order. Append-only: existing rows are
 * never modified. Reversals (MKT-03) are new rows with status='reversed', not updates
 * to existing rows (analogous to wallet_entries WAL-03 pattern).
 *
 * Key design decisions:
 * - NO updatedAt column — append-only, no modifications. Consistent with wallet_entries.
 * - ratePercent: NUMERIC(5,2) — rate at the time of order finalization (D-14).
 *   Rate may change over time; storing it on the entry preserves the historical rate.
 * - orderSubtotalMinor / commissionAmountMinor: BIGINT minor units (Pitfall 1).
 *   commissionAmountMinor is computed using allocate() for BIGINT residual distribution (MKT-02).
 * - For MKT-03 partial refund reversals: a new 'reversed' entry is inserted with the
 *   prorated commission amount (via allocate() item-level proration per D-15).
 *   The original 'earned' entry is left untouched.
 *
 * Phase 6 admin panel reads this table for commission reporting and payout settlement.
 *
 * Covers MKT-01 (commission per sub-order), MKT-02 (BIGINT allocation), MKT-03 (reversal).
 */
export const vendorCommissionEntries = pgTable("vendor_commission_entries", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor sub-order this commission entry is for.
   * Non-null — every commission entry is tied to a specific vendor sub-order.
   */
  vendorOrderId: uuid("vendor_order_id")
    .notNull()
    .references(() => vendorOrders.id),

  /**
   * Commission rate applied (percentage) at the time of order finalization (D-14).
   * NUMERIC(5,2) — stored for historical accuracy (rate may change post-order).
   * Example: 10.00 = 10% commission.
   * NOT the commission amount — that is commissionAmountMinor.
   */
  ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }).notNull(),

  /**
   * Vendor sub-order subtotal that the rate was applied to.
   * BIGINT minor units (Pitfall 1). Equals vendorOrders.vendorSubtotalMinor at finalization.
   * Stored for audit — commission amount can be verified as: ratePercent * orderSubtotalMinor / 100.
   */
  orderSubtotalMinor: bigint("order_subtotal_minor", {
    mode: "number",
  }).notNull(),

  /**
   * Commission amount computed from ratePercent × orderSubtotalMinor using allocate().
   * BIGINT minor units (Pitfall 1, MKT-02).
   * The allocate() function from packages/contracts/money ensures no rounding drift.
   * For 'reversed' entries, this is the prorated reversal amount (MKT-03, D-15).
   */
  commissionAmountMinor: bigint("commission_amount_minor", {
    mode: "number",
  }).notNull(),

  /**
   * Status of this commission entry.
   * 'earned': created when payment is captured (PAYMENT_CAPTURED webhook).
   * 'reversed': created when a return is approved (MKT-03); proportional to refunded items.
   * 'net': reserved for computed/reporting purposes; not created directly in Phase 5.
   * Append-only: new rows for reversals, never updates to existing rows.
   */
  status: commissionStatusEnum("status").notNull().default("earned"),

  /**
   * Entry creation timestamp.
   * NO updatedAt — append-only (consistent with wallet_entries WAL-03 pattern).
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor commission entry row */
export type InsertVendorCommissionEntry =
  typeof vendorCommissionEntries.$inferInsert;

/** TypeScript type for selecting a vendor commission entry row */
export type SelectVendorCommissionEntry =
  typeof vendorCommissionEntries.$inferSelect;
