import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { vendorUserRoleEnum } from "./vendor-users.js";
import { vendors } from "./vendors.js";

/**
 * vendor_staff_invites table — pending vendor team invitations (D-04, VEN-05).
 *
 * Stores invite tokens for the vendor staff invite flow:
 *   vendor owner → POST /vendor/team/invite → creates a row here + sends email
 *   invitee → hits invite link → POST /vendor/team/accept-invite?token=XXX
 *           → creates vendor_user row → marks acceptedAt on this row
 *
 * Key design decisions:
 * - inviteToken: UUID-based, UNIQUE — used as the URL token in the invite email link.
 *   The UNIQUE constraint at DB level prevents duplicate-token race conditions.
 * - expiresAt: 48h from invite creation. VendorStaffService checks expiry before processing.
 * - acceptedAt: set when the invite is accepted. null = pending. Used to prevent re-use
 *   of already-accepted invite links.
 * - vendorId: the vendor store the invitee will join (FK to vendors.id).
 * - role: the role the invitee will receive on acceptance. Restricted to manager|staff
 *   (owner role cannot be granted via invite — T-06-02 mitigation enforced at service layer
 *   and InviteVendorStaffInput contract level).
 * - invitedBy: FK to vendor_users.id — the owner/manager who sent the invite.
 *   Required (not nullable) to provide full audit trail.
 * - No updatedAt — acceptedAt captures the only meaningful state transition.
 *
 * Covers D-04, VEN-05, T-06-02.
 */
export const vendorStaffInvites = pgTable("vendor_staff_invites", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the vendor store the invitee will join (D-04).
   * Non-null — every invite is scoped to a specific vendor store.
   */
  vendorId: uuid("vendor_id")
    .notNull()
    .references(() => vendors.id),

  /**
   * Email address of the person being invited.
   * Matched against vendor_users.email after invite acceptance to detect duplicates.
   */
  email: text("email").notNull(),

  /**
   * Role the invitee will receive upon accepting the invite (D-04, D-05).
   * Restricted to manager|staff — owner role cannot be granted via invite (T-06-02).
   * Enforcement: InviteVendorStaffInput.role z.refine() rejects "owner" at API layer.
   */
  role: vendorUserRoleEnum("role").notNull(),

  /**
   * UUID token included in the invite email link (D-04).
   * Format: UUID string (crypto.randomUUID() in VendorStaffService).
   * UNIQUE: prevents duplicate tokens; DB-level safety net against race conditions.
   * Consumed by POST /vendor/team/accept-invite?token=XXX.
   */
  inviteToken: text("invite_token").notNull().unique(),

  /**
   * FK to the vendor_user who sent this invite (D-04).
   * Records who issued the invite for audit purposes.
   * Non-null — every invite must have a traceable sender.
   */
  invitedBy: uuid("invited_by").notNull(),

  /**
   * Invite expiry timestamp (D-04).
   * Set to createdAt + 48h by VendorStaffService at invite creation.
   * Expired invites are rejected by the accept endpoint regardless of token validity.
   */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  /**
   * Timestamp when the invite was accepted and the vendor_user row was created (D-04).
   * null = invite is still pending or expired without being accepted.
   * non-null = invite consumed; attempting to accept again is rejected.
   */
  acceptedAt: timestamp("accepted_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new vendor_staff_invite row */
export type InsertVendorStaffInvite = typeof vendorStaffInvites.$inferInsert;

/** TypeScript type for selecting a vendor_staff_invite row */
export type SelectVendorStaffInvite = typeof vendorStaffInvites.$inferSelect;
