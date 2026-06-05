import {
  bigint,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendors } from "./vendors.js";

/**
 * vendor_payouts table — append-only manual settlement ledger (D-07, MKT-04).
 *
 * Records each manual payout settlement made by an admin. This table is APPEND-ONLY:
 * existing rows are NEVER modified. New settlement rows are only ever INSERTed.
 * This makes the payout record tamper-evident and audit-friendly (T-06-03).
 *
 * Outstanding balance formula (D-08, D-09):
 *   Outstanding = SUM(earned commission entries) - SUM(reversed commission entries)
 *               - SUM(vendor_payouts.amount_minor WHERE vendor_id = ?)
 *
 * Key design decisions:
 * - NO updatedAt column — entries are APPEND-ONLY. Consistent with wallet_entries and
 *   vendor_commission_entries patterns (T-06-03 mitigation).
 * - amountMinor: BIGINT minor units (Pitfall 1). NEVER stored as FLOAT or DECIMAL.
 *   Admin enters a decimal string (e.g., "1500.00") at UI layer; API converts to minor units.
 *   RecordSettlementInput.amount is z.string() per T-06-01 / Pitfall 5.
 * - settlementReference: bank transfer ID, cheque number, or other reference from the
 *   admin's banking system. Stored for reconciliation.
 * - settledByAdminEmail: denormalized admin email for audit visibility without joining admin_users.
 *   Consistent with the audit_log actorEmail pattern (D-13).
 * - settledAt: when the settlement actually occurred (admin-provided, may differ from createdAt).
 * - createdAt: when this row was inserted (server-generated, immutable).
 *
 * Covers D-07, D-08, D-09, MKT-04, MKT-05, T-06-03.
 */
export const vendorPayouts = pgTable("vendor_payouts", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor receiving this payout settlement (D-07).
   * Non-null — every payout row is associated with a specific vendor.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),

  /**
   * Settlement amount in minor currency units (paise/cents).
   * BIGINT — no floating-point rounding drift (Pitfall 1, T-06-06).
   * Must always be a positive integer. Validated at service layer.
   */
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),

  /**
   * Bank transfer ID, cheque number, or other reference from the admin's banking system (D-07).
   * Used for reconciliation between this record and actual bank statements.
   */
  settlementReference: text("settlement_reference").notNull(),

  /**
   * Optional admin note about this settlement (D-07).
   * e.g., "Q1 2026 settlement", "Adjusted for disputed order ORD-1234".
   * null if no note provided.
   */
  note: text("note"),

  /**
   * Email of the admin who recorded this settlement (D-07, D-13).
   * Denormalized — stored directly to ensure audit trail is self-contained.
   * Does not change if the admin account is later deleted.
   */
  settledByAdminEmail: text("settled_by_admin_email").notNull(),

  /**
   * When the settlement actually occurred (D-07).
   * Admin-provided — may be in the past if recording a historical settlement.
   * Distinct from createdAt (when this DB row was created).
   */
  settledAt: timestamp("settled_at", { withTimezone: true }).notNull(),

  /**
   * Row creation timestamp.
   * NO updatedAt — append-only constraint (T-06-03, D-07).
   * This makes the ledger tamper-evident: once inserted, rows cannot be modified.
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  // NO updatedAt — intentionally absent (append-only constraint, T-06-03)
});

/** TypeScript type for inserting a new vendor_payout row */
export type InsertVendorPayout = typeof vendorPayouts.$inferInsert;

/** TypeScript type for selecting a vendor_payout row */
export type SelectVendorPayout = typeof vendorPayouts.$inferSelect;
