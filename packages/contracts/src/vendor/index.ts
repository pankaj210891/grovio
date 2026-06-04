/**
 * @grovio/contracts — vendor domain barrel export
 *
 * Re-exports all vendor contract types and Zod schemas for Phase 6.
 * Consumers import from "@grovio/contracts" (via root index.ts) or directly
 * from "@grovio/contracts/vendor" if tree-shaking is a concern.
 *
 * Domains covered:
 * - profile.ts: VendorRole, VendorOnboardingStatus, VendorStoreProfile, VendorPayoutInfo, VendorReturnPolicy
 * - staff.ts: VendorStaffMember, InviteVendorStaffInput, AcceptVendorInviteInput, VendorStaffInvite
 * - earnings.ts: VendorEarningsSummary, VendorCommissionLedgerEntry, VendorSettlementRecord, VendorEarningsResponse
 * - dashboard.ts: VendorDashboardSummary, VendorDashboardPeriod
 */

export * from "./profile.js";
export * from "./staff.js";
export * from "./earnings.js";
export * from "./dashboard.js";
