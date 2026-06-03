import {
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendors } from "./vendors.js";

/**
 * vendor_return_policies table
 *
 * Per-vendor return policy configuration (D-22, ORD-04).
 *
 * Key design decisions (D-22):
 * - One row per vendor (unique vendorId FK).
 *   If no row exists for a vendor, ReturnService falls back to the global default:
 *   return_window_days=7, is_returnable=true, conditions='Standard return policy applies'.
 *   This allows Phase 5 to implement the full return eligibility check without requiring
 *   vendors to have configured their policy (Phase 6 adds the vendor panel UI).
 * - returnWindowDays: number of days from delivery within which a return is eligible.
 *   ReturnService checks: order.deliveredAt + returnWindowDays >= NOW().
 * - isReturnable: global toggle. false = vendor does not accept returns for any items.
 * - conditions: optional free-text description of return conditions shown to customers
 *   on the order detail page and return request flow.
 *
 * Phase 6 adds the vendor panel UI for configuring this table. Phase 5 creates the table
 * and uses it in ReturnService.checkEligibility() for the self-serve return flow.
 *
 * Covers D-22, ORD-04.
 */
export const vendorReturnPolicies = pgTable("vendor_return_policies", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor whose return policy this row configures.
   * UNIQUE: one policy row per vendor.
   * Phase 6 vendor panel creates/updates this row.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .unique()
    .references(() => vendors.id),

  /**
   * Number of calendar days from delivery date within which returns are accepted (D-22).
   * Default 7 days. ReturnService uses this for eligibility check.
   * 0 = returns not accepted after delivery (use isReturnable=false instead for clarity).
   */
  returnWindowDays: integer("return_window_days").notNull().default(7),

  /**
   * Optional free-text description of return conditions shown to customers.
   * Example: "Items must be unopened in original packaging."
   * null = no additional conditions beyond the return window.
   */
  conditions: text("conditions"),

  /**
   * Whether this vendor accepts returns at all (D-22).
   * false = ReturnService rejects return requests immediately, regardless of window.
   * true = return eligibility is determined by returnWindowDays and order status.
   */
  isReturnable: boolean("is_returnable").notNull().default(true),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor return policy row */
export type InsertVendorReturnPolicy = typeof vendorReturnPolicies.$inferInsert;

/** TypeScript type for selecting a vendor return policy row */
export type SelectVendorReturnPolicy = typeof vendorReturnPolicies.$inferSelect;
