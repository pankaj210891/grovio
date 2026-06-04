import { z } from "zod";

/**
 * Vendor earnings and payout settlement contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per D-09: Vendor earnings page mirrors admin payout view but omits settlement entry
 *   form and other vendors' data. Vendor sees: net earnings, outstanding balance
 *   (to be paid by admin), commission entries for their own sub-orders,
 *   and the list of settlements received.
 *
 * Per D-08: Outstanding balance calculation:
 *   SUM(earned commission entries) - SUM(reversed entries) - SUM(vendor_payouts.amount_minor)
 *
 * Per MKT-04: Admin records manual settlements; vendor views received settlements.
 * Per MKT-05: Vendor views their own earnings summary.
 *
 * Per Pitfall 1: All money fields are BIGINT minor units (integer z.number()).
 *   Named with *Minor suffix for clarity. JSON serialization uses number (not bigint).
 *
 * CommissionEntry status values ("earned"|"reversed") align with Phase 5 D-12 pgEnum.
 */

// ---------------------------------------------------------------------------
// Vendor Earnings Summary (D-08, D-09, MKT-05)
// ---------------------------------------------------------------------------

/**
 * Aggregate earnings summary for a vendor.
 *
 * Canonical outstanding balance formula (D-08):
 *   outstandingBalanceMinor = totalEarnedMinor - totalReversedMinor - totalSettledMinor
 *
 * All fields are minor currency units (integers).
 */
export const VendorEarningsSummarySchema = z.object({
  /**
   * Sum of all "earned" commission entries (minor units).
   * Gross commission before reversals.
   */
  totalEarnedMinor: z.number().int(),
  /**
   * Sum of all "reversed" commission entry amounts (minor units).
   * Commission reversed due to return approvals (MKT-03, D-15).
   */
  totalReversedMinor: z.number().int(),
  /**
   * Net commission = totalEarnedMinor - totalReversedMinor (minor units).
   * Platform's earned commission from this vendor.
   */
  netCommissionMinor: z.number().int(),
  /**
   * Sum of all vendor_payouts.amount_minor rows for this vendor (minor units).
   * Total amount already manually settled by admin.
   */
  totalSettledMinor: z.number().int(),
  /**
   * Outstanding balance owed to vendor = netCommissionMinor - totalSettledMinor (minor units).
   * This is the amount the admin still needs to pay out.
   */
  outstandingBalanceMinor: z.number().int(),
});

/** TypeScript type inferred from VendorEarningsSummarySchema */
export type VendorEarningsSummary = z.infer<typeof VendorEarningsSummarySchema>;

// ---------------------------------------------------------------------------
// Commission Ledger Entry (D-09, MKT-05)
// ---------------------------------------------------------------------------

/**
 * A single vendor commission ledger entry for display in the earnings/payout view.
 * Sourced from vendor_commission_entries table (Phase 5 D-12, append-only).
 *
 * All money fields are minor currency units (integers).
 */
export const VendorCommissionLedgerEntrySchema = z.object({
  /** Commission entry row ID (UUID) */
  id: z.string().uuid(),
  /** FK to the vendor sub-order (UUID) */
  vendorOrderId: z.string().uuid(),
  /** Human-readable order display ID (e.g. "ORD-00123") */
  orderDisplayId: z.string(),
  /**
   * Status of this commission entry.
   * "earned" on order finalization; "reversed" on return approval (MKT-03, D-15).
   */
  status: z.enum(["earned", "reversed"]),
  /** Commission rate applied (percentage, e.g. 10.00 = 10%) */
  ratePercent: z.number(),
  /**
   * Vendor sub-order subtotal that the rate was applied to (minor units).
   */
  subtotalMinor: z.number().int(),
  /**
   * Commission amount computed for this entry (minor units).
   * For "reversed" entries, this is the amount reversed (positive number).
   */
  commissionAmountMinor: z.number().int(),
  /** ISO-8601 timestamp when this entry was created */
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from VendorCommissionLedgerEntrySchema */
export type VendorCommissionLedgerEntry = z.infer<typeof VendorCommissionLedgerEntrySchema>;

// ---------------------------------------------------------------------------
// Settlement Record (D-07, D-08, D-09, MKT-04)
// ---------------------------------------------------------------------------

/**
 * A single settlement payout record.
 * Sourced from vendor_payouts table (append-only, per D-07).
 *
 * amount field is minor currency units (integer).
 */
export const VendorSettlementRecordSchema = z.object({
  /** vendor_payouts row ID (UUID) */
  id: z.string().uuid(),
  /**
   * Settlement amount in minor currency units (BIGINT in DB).
   * Per Pitfall 1: stored as BIGINT, serialized as number in JSON.
   */
  amountMinor: z.number().int(),
  /** Bank transfer ID or other settlement reference */
  settlementReference: z.string(),
  /** Optional admin note for this settlement (nullable) */
  note: z.string().nullable(),
  /** ISO-8601 timestamp when the settlement was recorded */
  settledAt: z.string().datetime(),
});

/** TypeScript type inferred from VendorSettlementRecordSchema */
export type VendorSettlementRecord = z.infer<typeof VendorSettlementRecordSchema>;

// ---------------------------------------------------------------------------
// Vendor Earnings Response (D-09, MKT-05)
// ---------------------------------------------------------------------------

/**
 * Full earnings response returned by GET /vendor/earnings.
 * Combines the aggregate summary with the commission ledger and settlement history.
 */
export const VendorEarningsResponseSchema = z.object({
  /** Aggregate earnings summary */
  summary: VendorEarningsSummarySchema,
  /** Commission ledger entries (append-only; newest first) */
  commissionEntries: z.array(VendorCommissionLedgerEntrySchema),
  /** Settlement records received from admin (newest first) */
  settlements: z.array(VendorSettlementRecordSchema),
});

/** TypeScript type inferred from VendorEarningsResponseSchema */
export type VendorEarningsResponse = z.infer<typeof VendorEarningsResponseSchema>;
