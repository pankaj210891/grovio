import { z } from "zod";
import { VendorPayoutInfoSchema } from "../vendor/profile.js";
import {
  VendorCommissionLedgerEntrySchema,
  VendorSettlementRecordSchema,
} from "../vendor/earnings.js";

/**
 * Admin payout settlement contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per MKT-04, D-07: Admin records manual settlements.
 *   vendor_payouts table is append-only (no UPDATE ever — same ledger pattern as wallet_entries).
 *
 * Per D-08: Admin payout page per vendor shows:
 *   - Summary strip: earned, reversed, net, settled, outstanding balance
 *   - Commission ledger table (from vendor_commission_entries)
 *   - Settlements table (from vendor_payouts)
 *   - Vendor payout info (bank details, read-only reference)
 *
 * Per T-06-01 (Tampering mitigation): RecordSettlementInput.amount is a STRING
 *   (decimal display value, e.g. "1000.00" for INR 1000).
 *   Server-side converts to minor units per Pitfall 5. Contract intentionally has
 *   NO amountMinor field — clients cannot directly inject minor-unit values.
 *
 * Per Pitfall 1: All summary/response money fields are integer minor units (*Minor).
 * Per Pitfall 5: Settlement input uses string display amount, not minor units.
 */

// ---------------------------------------------------------------------------
// Record Settlement Input (D-07, MKT-04, T-06-01)
// ---------------------------------------------------------------------------

/**
 * Input for recording a manual vendor settlement payout.
 * Submitted by admin at POST /admin/vendors/:vendorId/payouts.
 *
 * SECURITY (T-06-01): amount is a string decimal display value (e.g., "1000.00"),
 *   NOT a minor-unit integer. Server converts to minor units using the marketplace
 *   currency config. This prevents client-side minor-unit injection (Pitfall 5).
 */
export const RecordSettlementInputSchema = z.object({
  /**
   * Settlement amount as a decimal string (e.g., "1000.00" for INR 1,000.00).
   * Converted to minor units server-side. Must be a valid positive decimal.
   * Per T-06-01: string type prevents minor-unit injection from clients.
   */
  amount: z.string().regex(/^\d+(\.\d{1,2})?$/, {
    message: "Amount must be a valid decimal string (e.g. '1000.00')",
  }),
  /** Bank transfer ID, NEFT/IMPS reference, or other settlement identifier */
  settlementReference: z.string().min(1),
  /** Optional note for the settlement record */
  note: z.string().optional(),
});

/** TypeScript type inferred from RecordSettlementInputSchema */
export type RecordSettlementInput = z.infer<typeof RecordSettlementInputSchema>;

// ---------------------------------------------------------------------------
// Admin Payout Summary (D-08, MKT-04)
// ---------------------------------------------------------------------------

/**
 * Aggregate payout summary for a vendor (admin view).
 * Same minor-unit shape as VendorEarningsSummary but used from the admin perspective.
 *
 * All fields are minor currency units (integers).
 */
export const AdminPayoutSummarySchema = z.object({
  /**
   * Sum of all "earned" commission entries (minor units).
   */
  totalEarnedMinor: z.number().int(),
  /**
   * Sum of all "reversed" commission entry amounts (minor units).
   */
  totalReversedMinor: z.number().int(),
  /**
   * Net commission = totalEarnedMinor - totalReversedMinor (minor units).
   */
  netCommissionMinor: z.number().int(),
  /**
   * Sum of all vendor_payouts.amount_minor rows for this vendor (minor units).
   */
  totalSettledMinor: z.number().int(),
  /**
   * Outstanding balance owed to vendor (minor units).
   * = netCommissionMinor - totalSettledMinor
   */
  outstandingBalanceMinor: z.number().int(),
});

/** TypeScript type inferred from AdminPayoutSummarySchema */
export type AdminPayoutSummary = z.infer<typeof AdminPayoutSummarySchema>;

// ---------------------------------------------------------------------------
// Admin Vendor Payout Response (D-08, MKT-04)
// ---------------------------------------------------------------------------

/**
 * Full admin payout response for a vendor.
 * Returned by GET /admin/vendors/:vendorId/payouts.
 *
 * Combines summary + commission ledger + settlements + bank details.
 */
export const AdminVendorPayoutResponseSchema = z.object({
  /** Aggregate payout summary */
  summary: AdminPayoutSummarySchema,
  /** Commission ledger entries (append-only; newest first) */
  commissionEntries: z.array(VendorCommissionLedgerEntrySchema),
  /** Settlement records (append-only; newest first) */
  settlements: z.array(VendorSettlementRecordSchema),
  /**
   * Vendor bank account details for manual reference (read-only panel in admin UI).
   * Null if vendor has not yet set up payout info.
   */
  payoutInfo: VendorPayoutInfoSchema.nullable(),
});

/** TypeScript type inferred from AdminVendorPayoutResponseSchema */
export type AdminVendorPayoutResponse = z.infer<typeof AdminVendorPayoutResponseSchema>;
