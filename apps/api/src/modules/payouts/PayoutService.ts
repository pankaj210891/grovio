import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { vendorPayouts } from "../../db/schema/index.js";
import type { AuditService } from "../audit/AuditService.js";
import type { AdminVendorPayoutResponse } from "@grovio/contracts/admin/payouts";

// ---------------------------------------------------------------------------
// AnalyticsService interface (minimal — full AnalyticsService is Phase 6 plan 06-09)
// ---------------------------------------------------------------------------

export interface AdminVendorPayoutProvider {
  getAdminVendorPayout(vendorId: string): Promise<AdminVendorPayoutResponse>;
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface PayoutServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  auditService: AuditService;
  analyticsService: AdminVendorPayoutProvider;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface RecordSettlementParams {
  /** Settlement amount as a decimal string (e.g., "5000.00"). Server converts to minor units. */
  amount: string;
  /** Bank transfer ID, NEFT/IMPS reference, or other settlement identifier */
  settlementReference: string;
  /** Optional note for the settlement record */
  note?: string;
}

// ---------------------------------------------------------------------------
// PayoutService
// ---------------------------------------------------------------------------

/**
 * PayoutService
 *
 * Admin-side manual settlement recording and payout view (D-07, MKT-04, T-06-20).
 *
 * Design constraints:
 * - vendor_payouts is append-only: only INSERT, never UPDATE (D-07, T-06-03).
 * - Amount input is a decimal string (e.g., "5000.00"), converted server-side to
 *   minor units via Math.round(parseFloat(amount)*100). Never accepts amountMinor
 *   from the client (T-06-20 mitigation — prevents minor-unit injection, Pitfall 5).
 * - Non-positive amounts are rejected (validates after conversion).
 *
 * Methods:
 * - recordSettlement(vendorId, params, adminEmail) — append-only payout insert + audit
 * - getVendorPayout(vendorId) — payout view delegated to analyticsService
 *
 * Covers D-07, MKT-04, T-06-20.
 */
export class PayoutService {
  constructor(private deps: PayoutServiceDeps) {}

  /**
   * Record a manual vendor settlement payout (D-07, MKT-04, T-06-20).
   *
   * Converts the decimal string `amount` to minor units:
   *   amountMinor = Math.round(parseFloat(amount) * 100)
   *
   * Validation:
   * - Rejects non-positive amounts (amountMinor <= 0 → Error)
   *
   * Append-only: inserts a new vendor_payouts row. NEVER updates existing rows (D-07, T-06-03).
   *
   * Audit: writes 'payout.settled' with { vendorId, amountMinor, settlementReference } (T-06-24).
   *
   * @param vendorId - UUID of the vendor receiving this settlement
   * @param params - Settlement input (amount as decimal string, reference, optional note)
   * @param adminEmail - Email of the admin recording this settlement (denormalized)
   * @throws Error if amount converts to a non-positive minor unit value
   */
  async recordSettlement(
    vendorId: string,
    params: RecordSettlementParams,
    adminEmail: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    // Server-side minor-unit conversion (T-06-20, Pitfall 5)
    // Math.round handles floating-point representation issues (e.g., 999.99 → 99999)
    const amountMinor = Math.round(parseFloat(params.amount) * 100);

    // Reject non-positive amounts (amount="0" → 0, amount="-100.00" → -10000)
    if (amountMinor <= 0) {
      throw new Error(
        `Settlement amount must be positive. Got: ${params.amount} (${amountMinor} minor units)`
      );
    }

    // Append-only insert into vendor_payouts (D-07, T-06-03)
    await db.insert(vendorPayouts).values({
      vendorId,
      amountMinor,
      settlementReference: params.settlementReference,
      note: params.note ?? null,
      settledByAdminEmail: adminEmail,
      settledAt: new Date(),
    });

    // Audit log (T-06-24)
    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "payout.settled",
      entityType: "vendor",
      entityId: vendorId,
      before: null,
      after: {
        amountMinor,
        settlementReference: params.settlementReference,
        note: params.note ?? null,
        settledByAdminEmail: adminEmail,
      },
    });
  }

  /**
   * Get the full admin payout view for a vendor.
   *
   * Delegates to analyticsService.getAdminVendorPayout which aggregates:
   * - Summary (earned, reversed, net, settled, outstanding balance)
   * - Commission ledger entries
   * - Settlement records
   * - Vendor payout info (bank details)
   *
   * @param vendorId - UUID of the vendor
   * @returns Full AdminVendorPayoutResponse
   */
  async getVendorPayout(vendorId: string): Promise<AdminVendorPayoutResponse> {
    return this.deps.analyticsService.getAdminVendorPayout(vendorId);
  }
}
