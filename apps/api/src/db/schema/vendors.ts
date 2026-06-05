import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * vendorOnboardingStatusEnum — lifecycle status for vendor store accounts (D-01, ADM-02).
 *
 * Values MUST exactly match VendorOnboardingStatus in packages/contracts/src/vendor/profile.ts.
 *
 * - pending: vendor registered but not yet approved by admin (new registrations land here)
 * - approved: vendor is active and can operate their store
 * - suspended: vendor account suspended by admin; vendor_users cannot log in (D-17)
 *
 * Phase 6 extends: default is 'approved' so existing Phase 3 vendors remain active post-migration.
 */
export const vendorOnboardingStatusEnum = pgEnum("vendor_onboarding_status", [
  "pending",
  "approved",
  "suspended",
]);

/**
 * vendors table
 *
 * Stores vendor accounts for the marketplace. Each vendor has their own product
 * catalog and is subject to category restrictions enforced at product creation time.
 *
 * Phase 3: minimal vendor identity (email + password hash + name).
 * Phase 6 (D-01): extended with public store profile fields and onboarding_status.
 *
 * Soft-delete via archived_at: archiving a vendor does not hard-delete their products
 * (FK safety). Hard deletion is intentionally unavailable.
 *
 * Auth note (D-03): Phase 6 migrates vendor authentication from this table to vendor_users.
 * The email and password_hash columns are retained for data integrity but are no longer
 * used for authentication after the migration. VendorAuthService queries vendor_users instead.
 *
 * Onboarding status note (D-01, D-17): onboarding_status drives the admin approval workflow.
 * Suspended vendors cannot log in — VendorAuthService checks this status after credential validation.
 * Default 'approved' preserves existing Phase 3 vendor access post-migration.
 *
 * Note: vendor_category_restrictions.vendor_id receives its FK constraint in plan 03-04
 * migration (D-18 — deferred FK from Phase 2).
 *
 * Covers D-01 (Phase 6 store profile extension), D-17 (Phase 3 minimal vendor auth scope).
 */
export const vendors = pgTable("vendors", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Vendor login email. Must be unique across all vendor accounts.
   * Phase 3: used as the login identifier in vendor JWT issuance (D-17).
   * Phase 6: retained for data integrity but auth migrates to vendor_users (D-03).
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext.
   * Phase 3: used by VendorAuthService for login.
   * Phase 6: retained but replaced by vendor_users.password_hash for auth (D-03).
   */
  passwordHash: text("password_hash").notNull(),

  /** Vendor's owner display name (used in Phase 3 auth context). */
  name: text("name").notNull(),

  // -------------------------------------------------------------------------
  // Phase 6 store profile extension (D-01)
  // -------------------------------------------------------------------------

  /**
   * Public-facing store name displayed on the storefront and vendor panel (D-01).
   * Distinct from name (which is the owner's display name from Phase 3).
   * null until vendor sets it via PUT /vendor/store-profile.
   */
  storeName: text("store_name"),

  /**
   * Public store description shown on the vendor storefront page (D-01).
   * null until vendor sets it.
   */
  storeDescription: text("store_description"),

  /**
   * URL of the vendor's store logo image (D-01).
   * URL input only — no file upload infrastructure in v1.
   * null until vendor sets it.
   */
  logoUrl: text("logo_url"),

  /**
   * URL of the vendor's store banner image (D-01).
   * URL input only — no file upload infrastructure in v1.
   * null until vendor sets it.
   */
  bannerUrl: text("banner_url"),

  /**
   * Public contact email for the vendor store (D-01).
   * May differ from the owner's login email.
   * null until vendor sets it.
   */
  contactEmail: text("contact_email"),

  /**
   * Public contact phone number for the vendor store (D-01).
   * null until vendor sets it.
   */
  contactPhone: text("contact_phone"),

  /**
   * Vendor store address (D-01).
   * Used for display and return logistics context.
   * null until vendor sets it.
   */
  address: text("address"),

  /**
   * Vendor onboarding/lifecycle status (D-01, ADM-02).
   * pending → admin approves → approved; admin can suspend → suspended.
   * Default 'approved': existing Phase 3 vendors remain active post-migration (D-03).
   * Suspended vendors cannot log in — checked by VendorAuthService after credential validation.
   */
  onboardingStatus: vendorOnboardingStatusEnum("onboarding_status")
    .notNull()
    .default("approved"),

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
