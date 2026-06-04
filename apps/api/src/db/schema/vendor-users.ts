import {
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendors } from "./vendors.js";

/**
 * vendorUserRoleEnum — role values for vendor team members (D-03, D-05, VEN-05).
 *
 * Values MUST exactly match VendorRole in packages/contracts/src/vendor/profile.ts.
 *
 * - owner: full access to all vendor panel sections; can invite/remove team members,
 *          configure store profile and payout info
 * - manager: products, inventory, pricing, orders, returns, coupons — no team management,
 *            no payout info, no store profile settings
 * - staff: inventory levels (view/edit quantity_available only), orders (view + mark shipped/delivered)
 *          — no product CRUD, no return approvals, no financial data
 *
 * Phase 6 multi-member vendor team support (VEN-05, D-03).
 */
export const vendorUserRoleEnum = pgEnum("vendor_user_role", [
  "owner",
  "manager",
  "staff",
]);

/**
 * vendor_users table — vendor team member accounts (D-03, VEN-05).
 *
 * Phase 3 embedded email + password_hash directly on the vendors table (one vendor = one user).
 * Phase 6 introduces this table to support multi-member vendor teams.
 *
 * Migration note (D-03): existing Phase 3 vendor owner accounts (email + password_hash) are
 * copied from the vendors table to vendor_users as role='owner' rows. VendorAuthService
 * is updated to authenticate against vendor_users instead of vendors.
 * The email and password_hash columns on vendors are retained but no longer used for auth.
 *
 * Key design decisions:
 * - email: UNIQUE across all vendor_users (not just per-vendor team).
 *   Ensures a person can only have one active vendor_user account globally.
 * - invitedBy: self-referential FK to vendor_users.id (nullable — owner accounts have no inviter).
 *   Loose FK (no inline .references()) to avoid circular reference issues at module load.
 * - archivedAt: soft-delete consistent with vendors.archived_at pattern (D-03).
 *   Archived vendor_users cannot log in.
 * - acceptedAt: set when the invitee completes the staff invite flow (D-04).
 *   null until the invite is accepted.
 * - onboarding_status suspension check: auth service checks vendors.onboarding_status === 'suspended'
 *   before issuing a JWT — suspended vendors cannot log in regardless of vendor_user state.
 *
 * Covers D-03, D-04, D-05, D-06, VEN-05.
 */
export const vendorUsers = pgTable("vendor_users", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor store this user belongs to.
   * Non-null — every vendor_user is associated with exactly one vendor.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),

  /**
   * Login email for this vendor user.
   * UNIQUE across all vendor_users — not scoped per vendor.
   * Used as the login identifier in VendorAuthService after Phase 6 migration.
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext.
   * Hashed by VendorAuthService using the argon2 library (OWASP-recommended).
   * Not returned in any API response.
   */
  passwordHash: text("password_hash").notNull(),

  /**
   * Team role controlling access scope (D-05).
   * owner | manager | staff — enforced at backend route level via JWT role claim.
   * Frontend hides UI elements for lower-privileged roles (defense-in-depth only).
   */
  role: vendorUserRoleEnum("role").notNull(),

  /**
   * UUID of the vendor_user who invited this member (D-04).
   * null for owner accounts created via the migration (no inviter).
   * Self-referential: references vendor_users.id — stored as loose text FK to avoid
   * Drizzle circular reference issues at schema load time.
   */
  invitedBy: uuid("invited_by"),

  /**
   * Timestamp when the staff invite was accepted and the account was activated (D-04).
   * null for owner accounts and pending invites.
   * Set by VendorStaffService.acceptInvite() when the invitee completes the flow.
   */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),

  /**
   * Soft-delete timestamp (D-03).
   * null = active vendor user; non-null = archived (deactivated by owner/admin).
   * Archived vendor_users cannot log in (VendorAuthService checks isNull(archivedAt)).
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor_user row */
export type InsertVendorUser = typeof vendorUsers.$inferInsert;

/** TypeScript type for selecting a vendor_user row */
export type SelectVendorUser = typeof vendorUsers.$inferSelect;
