/**
 * @grovio/contracts — admin domain barrel export
 *
 * Re-exports all admin contract types and Zod schemas for Phase 6.
 * Consumers import from "@grovio/contracts" (via root index.ts) or directly
 * from "@grovio/contracts/admin" if tree-shaking is a concern.
 *
 * Domains covered:
 * - auth.ts: AdminLoginInput, AdminProfile (D-21)
 * - vendors.ts: AdminVendorListItem, AdminVendorListResponse, SuspendVendorInput, ApproveVendorInput, ReinstateVendorInput, ConfigureVendorInput (ADM-02, D-17)
 * - commission-rules.ts: CommissionRule, CommissionRuleScope, CommissionRulesResponse, CreateCommissionRuleInput, UpdateCommissionRuleInput (ADM-03, D-18)
 * - payouts.ts: RecordSettlementInput, AdminPayoutSummary, AdminVendorPayoutResponse (MKT-04, D-07/D-08)
 * - settings.ts: MarketplaceSettingKey, UpdateSettingInput, MarketplaceSettingsResponse (ADM-05, D-19)
 * - audit.ts: AuditActorType, AuditLogEntry, AuditLogQuery, AuditLogResponse (ADM-07, D-13)
 * - analytics.ts: AnalyticsPeriod, AdminAnalyticsSummary, OrdersByDayPoint, TopVendorByGmv, GmvByCategoryPoint, AdminAnalyticsResponse (ADM-01, D-10)
 * - cms.ts: CreateHomepageBlockInput, UpdateHomepageBlockInput, ReorderHomepageBlockInput (ADM-04, D-11)
 */

export * from "./auth.js";
export * from "./vendors.js";
export * from "./commission-rules.js";
export * from "./payouts.js";
export * from "./settings.js";
export * from "./audit.js";
export * from "./analytics.js";
export * from "./cms.js";
