import { z } from "zod";

/**
 * Commission contract schemas for Phase 5: Commerce Core.
 *
 * Per MKT-01: Commission computed per vendor sub-order using a priority chain
 *   (global → category → vendor; most-specific rate wins — D-14).
 * Per MKT-02: Commission splits use integer minor-unit allocation (no rounding drift).
 * Per MKT-03: Refunds generate proportional commission reversal entries (D-15).
 *
 * Per D-12: Phase 5 records commission entries only — no automated vendor payouts.
 *   Admin views and manually settles payouts in Phase 6 (MKT-04/MKT-05).
 *
 * Per D-01: All money fields are z.number().int() (minor units).
 * Per Pitfall 5: bigint is NEVER used in contracts — JSON serialization uses number.
 *
 * CommissionStatusSchema values MUST exactly match the commissionStatusEnum pgEnum (D-12).
 * CommissionScopeSchema values MUST exactly match the commissionScopeEnum pgEnum (D-14).
 */

/**
 * Status of a vendor commission entry.
 * Values MUST exactly match the commissionStatusEnum pgEnum defined in plan 05-02.
 *
 * Append-only pattern (same as wallet_entries — WAL-03 analogy):
 * - "earned": commission recorded when order is finalized (PAYMENT_CAPTURED)
 * - "reversed": proportional reversal entry when a return is approved (MKT-03, D-15)
 * - "net": net commission after reversal (computed view, not stored directly in Phase 5)
 */
export const CommissionStatusSchema = z.enum([
  "earned",
  "reversed",
  "net",
]);

/** TypeScript type inferred from CommissionStatusSchema */
export type CommissionStatus = z.infer<typeof CommissionStatusSchema>;

/**
 * Scope level for a commission rule in the priority chain (D-14).
 * Values MUST exactly match the commissionScopeEnum pgEnum defined in plan 05-02.
 *
 * Priority chain (most-specific wins):
 * - "vendor": vendor-level override (highest priority)
 * - "category": category-level override
 * - "global": global default rate (lowest priority)
 */
export const CommissionScopeSchema = z.enum([
  "global",
  "category",
  "vendor",
]);

/** TypeScript type inferred from CommissionScopeSchema */
export type CommissionScope = z.infer<typeof CommissionScopeSchema>;

/**
 * A vendor commission entry as returned by the API (MKT-01, D-12).
 * Records the commission amount for a specific vendor sub-order.
 *
 * Commission entries are append-only (no UPDATE on existing rows).
 * Reversals (MKT-03) are new rows with status="reversed", not modifications.
 *
 * All money fields are minor currency units, always integers (D-01).
 */
export const VendorCommissionEntrySchema = z.object({
  /** Commission entry row ID */
  id: z.string().uuid(),
  /** FK to the vendor sub-order this commission was computed for */
  vendorOrderId: z.string().uuid(),
  /**
   * Commission rate applied (percentage, e.g. 10.00 = 10%).
   * Stored as a number for display purposes.
   * Rate from the priority chain at the time of order finalization (D-14).
   */
  ratePercent: z.number(),
  /**
   * Vendor sub-order subtotal that the rate was applied to.
   * Minor currency units, always integer (D-01).
   * This is the vendor's portion of the order before commission deduction.
   */
  orderSubtotalMinor: z.number().int(),
  /**
   * Commission amount computed from ratePercent × orderSubtotalMinor.
   * Minor currency units, always integer (D-01).
   * Computed using allocate() for BIGINT residual distribution (MKT-02, D-15).
   */
  commissionAmountMinor: z.number().int(),
  /**
   * Status of this commission entry.
   * "earned" on order finalization; "reversed" on return approval (MKT-03).
   */
  status: CommissionStatusSchema,
});

/** TypeScript type inferred from VendorCommissionEntrySchema */
export type VendorCommissionEntry = z.infer<typeof VendorCommissionEntrySchema>;
