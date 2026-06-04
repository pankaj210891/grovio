import { z } from "zod";

/**
 * Admin commission rule management contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-03, D-18: Three-section commission config UI:
 *   1. Global rate — always exactly one row; cannot be deleted
 *   2. Category overrides — table of category → rate %
 *   3. Vendor overrides — table of vendor → rate %
 *
 * Per D-14 (Phase 5): Commission priority chain: vendor override > category override > global.
 *   Most-specific rate wins. Phase 6 adds the admin UI to manage these rules.
 *
 * CommissionRuleScope values MUST exactly match the commissionScopeEnum pgEnum
 *   defined in plan 05-02 (Phase 5 commission_rules schema).
 *
 * All mutations to commission rules are logged to audit_log (D-18, ADM-07).
 */

// ---------------------------------------------------------------------------
// Commission Rule Scope (D-14, D-18, ADM-03)
// ---------------------------------------------------------------------------

/**
 * Scope level for a commission rule in the priority chain.
 * Values MUST exactly match the commissionScopeEnum pgEnum (Phase 5 plan 05-02).
 *
 * Priority chain (most-specific wins — D-14):
 * - "vendor": vendor-level override (highest priority)
 * - "category": category-level override
 * - "global": global default rate (lowest priority)
 */
export const CommissionRuleScopeSchema = z.enum([
  "global",
  "category",
  "vendor",
]);

/** TypeScript type inferred from CommissionRuleScopeSchema */
export type CommissionRuleScope = z.infer<typeof CommissionRuleScopeSchema>;

// ---------------------------------------------------------------------------
// Commission Rule (D-18, ADM-03)
// ---------------------------------------------------------------------------

/**
 * A single commission rule record.
 * Returned in the CommissionRulesResponse.
 */
export const CommissionRuleSchema = z.object({
  /** commission_rules row ID (UUID) */
  id: z.string().uuid(),
  /** Scope level for this rule */
  scope: CommissionRuleScopeSchema,
  /** Category UUID if scope is "category" (null otherwise) */
  categoryId: z.string().uuid().nullable(),
  /** Vendor UUID if scope is "vendor" (null otherwise) */
  vendorId: z.string().uuid().nullable(),
  /** Commission rate percentage (e.g. 10.00 = 10%) */
  ratePercent: z.number().min(0).max(100),
});

/** TypeScript type inferred from CommissionRuleSchema */
export type CommissionRule = z.infer<typeof CommissionRuleSchema>;

// ---------------------------------------------------------------------------
// Commission Rule Mutations (D-18, ADM-03)
// ---------------------------------------------------------------------------

/**
 * Input for creating a new commission rule override (category or vendor scope).
 * Global rule cannot be created — it is seeded once and only the ratePercent is editable.
 */
export const CreateCommissionRuleInputSchema = z.object({
  /** Scope for the new rule — only "category" or "vendor" (not "global") */
  scope: z.enum(["category", "vendor"]),
  /** Category UUID — required when scope is "category" */
  categoryId: z.string().uuid().nullable(),
  /** Vendor UUID — required when scope is "vendor" */
  vendorId: z.string().uuid().nullable(),
  /** Commission rate percentage */
  ratePercent: z.number().min(0).max(100),
});

/** TypeScript type inferred from CreateCommissionRuleInputSchema */
export type CreateCommissionRuleInput = z.infer<typeof CreateCommissionRuleInputSchema>;

/**
 * Input for updating an existing commission rule.
 * The rule ID is a path param.
 */
export const UpdateCommissionRuleInputSchema = z.object({
  /** New commission rate percentage */
  ratePercent: z.number().min(0).max(100),
});

/** TypeScript type inferred from UpdateCommissionRuleInputSchema */
export type UpdateCommissionRuleInput = z.infer<typeof UpdateCommissionRuleInputSchema>;

// ---------------------------------------------------------------------------
// Commission Rules Response (D-18, ADM-03)
// ---------------------------------------------------------------------------

/**
 * Full commission rules response returned by GET /admin/commission-rules.
 * Three sections as per the D-18 three-section UI:
 * - global: the one and only global default rule
 * - categoryOverrides: category-scoped override rules
 * - vendorOverrides: vendor-scoped override rules
 */
export const CommissionRulesResponseSchema = z.object({
  /**
   * The single global default commission rule.
   * Always present; cannot be deleted (only ratePercent is editable).
   * Visually distinguished in the UI as a pinned "Default" row.
   */
  global: CommissionRuleSchema,
  /** Category-level commission override rules (may be empty) */
  categoryOverrides: z.array(CommissionRuleSchema),
  /** Vendor-level commission override rules (may be empty) */
  vendorOverrides: z.array(CommissionRuleSchema),
});

/** TypeScript type inferred from CommissionRulesResponseSchema */
export type CommissionRulesResponse = z.infer<typeof CommissionRulesResponseSchema>;
