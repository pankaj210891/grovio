import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * vendors table
 *
 * Stores vendor accounts for the marketplace. Each vendor has their own product
 * catalog and is subject to category restrictions enforced at product creation time.
 *
 * Minimal vendor identity for Phase 3: email + password hash + name.
 * Full vendor profile management (bank details, store settings) is deferred to Phase 6.
 *
 * Soft-delete via archived_at: archiving a vendor does not hard-delete their products
 * (FK safety). Hard deletion is intentionally unavailable.
 *
 * Note: vendor_category_restrictions.vendor_id receives its FK constraint in plan 03-04
 * migration (D-18 — deferred FK from Phase 2).
 *
 * Covers D-17 (Phase 3 minimal vendor auth scope).
 */
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Vendor login email. Must be unique across all vendor accounts.
   * Used as the login identifier in vendor JWT issuance (D-17).
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext.
   * Hashed by VendorAuthService using the argon2 library (OWASP-recommended).
   * Not returned in any API response.
   */
  passwordHash: text("password_hash").notNull(),

  /** Vendor's public display name shown on product listings and storefront. */
  name: text("name").notNull(),

  /**
   * Soft-delete timestamp. null = active vendor; non-null = archived.
   * Archived vendors cannot log in or create new products.
   * Their existing products remain in the DB for data integrity.
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor row */
export type InsertVendor = typeof vendors.$inferInsert;

/** TypeScript type for selecting a vendor row */
export type SelectVendor = typeof vendors.$inferSelect;
