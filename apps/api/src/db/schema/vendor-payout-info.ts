import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendors } from "./vendors.js";

/**
 * vendor_payout_info table — vendor banking details for manual settlement (D-02, MKT-04).
 *
 * Stores sensitive banking data in a separate, isolated table to prevent accidental
 * exposure in vendor profile API responses. The VendorProfileService NEVER joins
 * this table into profile responses (T-06-05 mitigation).
 *
 * Key design decisions:
 * - vendorId: UNIQUE — exactly one payout info row per vendor (one bank account per store).
 *   Created/updated by vendor owner via PUT /vendor/store-profile/payout-info.
 *   Admin views this data read-only on the payout management page (D-08).
 * - No id primary key alternative: id UUID is included for consistency and safe FK referencing
 *   from other tables if needed in future phases.
 * - bankAccountNumber / ifscOrRoutingCode: stored as plain text (no masking at DB level).
 *   Masking is handled at API response layer — service returns only last 4 digits of account number.
 * - updatedAt: only timestamp column (no createdAt) — captures most recent update.
 *   This is a single mutable row per vendor; the full update history is in audit_log.
 *
 * Security: T-06-05 — this table is never auto-joined to vendor profile queries.
 *   Explicit service methods (VendorProfileService.getPayoutInfo) require owner role.
 *
 * Covers D-02, MKT-04.
 */
export const vendorPayoutInfo = pgTable("vendor_payout_info", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor store this banking info belongs to.
   * UNIQUE: exactly one payout info row per vendor (D-02).
   * Non-null — payout info is always associated with a vendor.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .unique()
    .references(() => vendors.id),

  /**
   * Name of the account holder as it appears on the bank account.
   * Used by admin during manual settlement verification.
   */
  accountHolderName: text("account_holder_name").notNull(),

  /**
   * Bank account number (full number stored at rest).
   * API responses mask to last 4 digits for display (T-06-05).
   */
  bankAccountNumber: text("bank_account_number").notNull(),

  /**
   * IFSC code (India) or ABA routing number (US), depending on vendor region.
   * Stored as text; format validation handled at API layer.
   */
  ifscOrRoutingCode: text("ifsc_or_routing_code").notNull(),

  /** Name of the bank (e.g., "HDFC Bank", "State Bank of India"). */
  bankName: text("bank_name").notNull(),

  /**
   * Timestamp of the last update to this row.
   * Changes logged to audit_log by VendorProfileService.updatePayoutInfo() (D-13).
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor_payout_info row */
export type InsertVendorPayoutInfo = typeof vendorPayoutInfo.$inferInsert;

/** TypeScript type for selecting a vendor_payout_info row */
export type SelectVendorPayoutInfo = typeof vendorPayoutInfo.$inferSelect;
