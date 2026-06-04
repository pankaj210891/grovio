import { z } from "zod";
import { VendorRoleSchema } from "./profile.js";

/**
 * Vendor staff management contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per D-03: Phase 6 introduces vendor_users table to support multi-member vendor teams (VEN-05).
 *   vendor_users: id, vendor_id, email, password_hash, role (owner|manager|staff),
 *   invited_by, accepted_at, archived_at, created_at, updated_at.
 *
 * Per D-04: Staff invite flow:
 *   POST /vendor/team/invite { email, role } → creates vendor_staff_invites row →
 *   sends invite email → invitee accepts at /vendor/accept-invite?token=XXX →
 *   creates vendor_user row.
 *
 * Per D-05: owner role cannot be assigned via invite (T-06-02 — elevation of privilege mitigation).
 *   InviteVendorStaffInput.role is restricted to manager|staff only.
 *
 * Per VEN-05: Vendor team management.
 */

// ---------------------------------------------------------------------------
// Vendor Staff Member (D-03, VEN-05)
// ---------------------------------------------------------------------------

/**
 * A vendor team member as returned by GET /vendor/team.
 */
export const VendorStaffMemberSchema = z.object({
  /** vendor_users row ID (UUID) */
  id: z.string().uuid(),
  /** Staff member email */
  email: z.string().email(),
  /** Staff member role */
  role: VendorRoleSchema,
  /** ISO-8601 timestamp when invite was accepted (null if still pending) */
  acceptedAt: z.string().datetime().nullable(),
  /** UUID of the vendor_user who sent the invite (nullable for owner accounts) */
  invitedBy: z.string().uuid().nullable(),
  /** ISO-8601 timestamp when the vendor_user row was created */
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from VendorStaffMemberSchema */
export type VendorStaffMember = z.infer<typeof VendorStaffMemberSchema>;

// ---------------------------------------------------------------------------
// Invite Staff (D-04, T-06-02)
// ---------------------------------------------------------------------------

/**
 * Input for inviting a new vendor staff member.
 *
 * Security (T-06-02 — Elevation of Privilege mitigation):
 *   role is restricted to "manager" | "staff" only — cannot mint an owner via invite.
 *   Owner accounts are created only during initial vendor onboarding.
 */
export const InviteVendorStaffInputSchema = z.object({
  /** Email address of the invitee */
  email: z.string().email(),
  /**
   * Role to assign to the invited member.
   * Restricted to manager|staff — cannot assign owner via invite (T-06-02).
   */
  role: VendorRoleSchema.refine(
    (r) => r !== "owner",
    { message: "Cannot assign 'owner' role via staff invite" }
  ),
});

/** TypeScript type inferred from InviteVendorStaffInputSchema */
export type InviteVendorStaffInput = z.infer<typeof InviteVendorStaffInputSchema>;

// ---------------------------------------------------------------------------
// Accept Invite (D-04)
// ---------------------------------------------------------------------------

/**
 * Input for accepting a vendor staff invite (invitee sets their password).
 */
export const AcceptVendorInviteInputSchema = z.object({
  /** One-time invite token from the invite email link */
  token: z.string(),
  /** Password the invitee sets for their account (minimum 8 characters) */
  password: z.string().min(8),
});

/** TypeScript type inferred from AcceptVendorInviteInputSchema */
export type AcceptVendorInviteInput = z.infer<typeof AcceptVendorInviteInputSchema>;

// ---------------------------------------------------------------------------
// Staff Invite Record (D-04)
// ---------------------------------------------------------------------------

/**
 * A pending vendor staff invite record.
 * Returned by GET /vendor/team/invites (owner-only).
 */
export const VendorStaffInviteSchema = z.object({
  /** vendor_staff_invites row ID (UUID) */
  id: z.string().uuid(),
  /** Email address the invite was sent to */
  email: z.string().email(),
  /** Role that will be assigned on acceptance */
  role: VendorRoleSchema,
  /** ISO-8601 timestamp when the invite expires (48h after creation) */
  expiresAt: z.string().datetime(),
  /** ISO-8601 timestamp when the invite was accepted (null if still pending) */
  acceptedAt: z.string().datetime().nullable(),
});

/** TypeScript type inferred from VendorStaffInviteSchema */
export type VendorStaffInvite = z.infer<typeof VendorStaffInviteSchema>;
