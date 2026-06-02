import {
  numeric,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { categories } from "./categories.js";
import { vendors } from "./vendors.js";

/**
 * commission_rules table
 *
 * Stores the commission rate configuration for the priority chain (D-14, MKT-01).
 *
 * Priority chain (most-specific rate wins):
 *   vendor override > category override > global default
 *
 * Each row represents one rule. CommissionService resolves the chain at order
 * finalization: look for vendor-specific first, then category, then global.
 * The service is responsible for ensuring at least one 'global' rule exists.
 *
 * Key design decisions:
 * - scope: text column with values 'global' / 'category' / 'vendor' (D-14).
 *   Values MUST exactly match CommissionScopeSchema in contracts/src/commissions/types.ts.
 * - vendorId / categoryId: nullable FKs — non-null based on scope:
 *     scope='global'   → both null
 *     scope='category' → categoryId non-null, vendorId null
 *     scope='vendor'   → vendorId non-null, categoryId null (or both for a vendor+category rule)
 *   Invariant enforced at service layer.
 * - ratePercent: NUMERIC(5,2) — the ONLY non-BIGINT money-adjacent column in Phase 5.
 *   Stores percentage values like 10.00 (= 10%). NUMERIC avoids float drift on percentages.
 *   This is NOT a price — it is a rate. All actual money computations use BIGINT + allocate().
 *
 * No money columns — this table stores rates only. Computed amounts live in
 * vendor_commission_entries.
 *
 * Covers MKT-01 (commission rate priority chain), D-14.
 */
export const commissionRules = pgTable("commission_rules", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Scope level for this commission rule (D-14).
   * Values: 'global' | 'category' | 'vendor'.
   * Values MUST exactly match CommissionScopeSchema in packages/contracts/src/commissions/types.ts.
   */
  scope: text("scope").notNull(),

  /**
   * FK to the vendor for vendor-scoped rules. null for global and category rules.
   */
  vendorId: uuid("vendor_id").references(() => vendors.id),

  /**
   * FK to the category for category-scoped rules. null for global and vendor rules.
   */
  categoryId: uuid("category_id").references(() => categories.id),

  /**
   * Commission rate as a percentage (D-14, D-14 data type note).
   * NUMERIC(5,2) — precision 5, scale 2. Stores values like 10.00 (= 10%).
   * This is the ONLY NUMERIC column in Phase 5 — used for rate storage only.
   * All actual commission computations are done in BIGINT using allocate().
   * Example: ratePercent = 10.00 means 10% of the vendor sub-order subtotal.
   */
  ratePercent: numeric("rate_percent", { precision: 5, scale: 2 }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new commission rule row */
export type InsertCommissionRule = typeof commissionRules.$inferInsert;

/** TypeScript type for selecting a commission rule row */
export type SelectCommissionRule = typeof commissionRules.$inferSelect;
