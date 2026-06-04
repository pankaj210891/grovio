import * as argon2 from "argon2";
import { randomUUID } from "crypto";
import { eq, and, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as nodemailer from "nodemailer";
import type { Env } from "../../config/env.js";
import {
  vendorStaffInvites,
  vendorUsers,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when an invite token is invalid, expired, or already used (T-06-17).
 */
export class InvalidInviteTokenError extends Error {
  readonly code = "INVALID_INVITE_TOKEN";

  constructor(message = "Invite token is invalid, expired, or already used.") {
    super(message);
    this.name = "InvalidInviteTokenError";
  }
}

/**
 * Thrown when attempting to invite with role='owner' (T-06-16 — elevation of privilege mitigation).
 */
export class OwnerRoleNotInvitableError extends Error {
  readonly code = "OWNER_ROLE_NOT_INVITABLE";

  constructor() {
    super("Cannot assign 'owner' role via staff invite. Only manager or staff roles can be invited.");
    this.name = "OwnerRoleNotInvitableError";
  }
}

/**
 * Thrown when attempting to remove/archive an owner-role vendor_user (D-05).
 */
export class CannotRemoveOwnerError extends Error {
  readonly code = "CANNOT_REMOVE_OWNER";

  constructor() {
    super("The owner cannot be removed from the team. Transfer ownership first.");
    this.name = "CannotRemoveOwnerError";
  }
}

/**
 * Thrown when staff member is not found or does not belong to the vendor.
 */
export class StaffMemberNotFoundError extends Error {
  readonly code = "STAFF_MEMBER_NOT_FOUND";

  constructor(userId: string) {
    super(`Staff member not found: ${userId}`);
    this.name = "StaffMemberNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type VendorStaffRole = "manager" | "staff";

export interface InviteStaffInput {
  email: string;
  role: VendorStaffRole;
}

export interface AcceptInviteInput {
  token: string;
  password: string;
}

export interface StaffMember {
  id: string;
  email: string;
  role: "owner" | "manager" | "staff";
  acceptedAt: Date | null;
  invitedBy: string | null;
  createdAt: Date;
}

export interface StaffInviteResult {
  id: string;
  vendorId: string;
  email: string;
  role: "manager" | "staff";
  inviteToken: string;
  expiresAt: Date;
  acceptedAt: Date | null;
  createdAt: Date;
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface VendorStaffServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  mailer: nodemailer.Transporter;
  env: Env;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Invite token TTL: 48 hours (D-04). */
const INVITE_TTL_MS = 48 * 60 * 60 * 1000;

// ---------------------------------------------------------------------------
// VendorStaffService
// ---------------------------------------------------------------------------

/**
 * VendorStaffService
 *
 * Manages vendor team members via the invite/accept flow (D-04, D-05, VEN-05).
 *
 * Security:
 * - T-06-16: invite() rejects role='owner' — owner cannot be minted via invite.
 * - T-06-17: accept() rejects tokens where acceptedAt is already set OR expiresAt is past.
 *   Token is crypto.randomUUID() (128-bit entropy), 48h expiry.
 * - D-05: removeStaff() refuses to archive an owner — owner-protection at service layer.
 * - IDOR: all methods scope operations to vendorId from JWT (route layer responsibility).
 *
 * Covers D-04, D-05, VEN-05, T-06-16, T-06-17.
 */
export class VendorStaffService {
  constructor(private deps: VendorStaffServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Invite a new vendor team member (D-04).
   *
   * Creates a vendor_staff_invites row with:
   * - A crypto.randomUUID() token (128-bit entropy)
   * - expiresAt = now + 48h
   * - role restricted to manager | staff (T-06-16)
   *
   * Sends an invite email via mailer with the accept link.
   *
   * @throws OwnerRoleNotInvitableError when role === 'owner'
   */
  async invite(
    vendorId: string,
    invitedByUserId: string,
    input: InviteStaffInput
  ): Promise<StaffInviteResult> {
    // T-06-16: reject owner role
    if (input.role === ("owner" as string)) {
      throw new OwnerRoleNotInvitableError();
    }

    const { db, mailer, env } = this.deps;

    const inviteToken = randomUUID();
    const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

    // Insert invite row
    const rows = await db
      .insert(vendorStaffInvites)
      .values({
        vendorId,
        email: input.email,
        role: input.role,
        inviteToken,
        invitedBy: invitedByUserId,
        expiresAt,
      })
      .returning();

    const invite = rows[0]!;

    // Build accept link
    const webVendorUrl = env.WEB_VENDOR_URL ?? "http://localhost:5174";
    const acceptLink = `${webVendorUrl}/accept-invite?token=${inviteToken}`;

    // Send invite email (dev fallback: SMTP not configured → log + don't throw)
    const isSmtpConfigured = Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

    if (isSmtpConfigured) {
      await mailer.sendMail({
        from: env.SMTP_FROM ?? env.SMTP_USER,
        to: input.email,
        subject: `You've been invited to join a store on Grovio as a ${input.role}`,
        html: `
          <p>Hello,</p>
          <p>You've been invited to join a store on Grovio as a <strong>${input.role}</strong>.</p>
          <p>Click the link below to set up your account:</p>
          <p><a href="${acceptLink}">${acceptLink}</a></p>
          <p>This invite link expires in 48 hours. If you did not expect this invite, you can safely ignore this email.</p>
        `,
      });
    } else {
      console.log(
        `[VendorStaffService] Invite link (dev mode — SMTP not configured): ${acceptLink}`
      );
    }

    return invite as StaffInviteResult;
  }

  /**
   * Accept a vendor staff invite and create the vendor_users account (D-04, T-06-17).
   *
   * In ONE transaction:
   * 1. Validate token: not expired, not already accepted.
   * 2. Hash password with argon2 (Argon2id).
   * 3. Insert vendor_users row (role from invite, invitedBy from invite).
   * 4. Set invite.acceptedAt.
   *
   * @throws InvalidInviteTokenError if token is missing, expired, or already used (T-06-17).
   */
  async accept(input: AcceptInviteInput): Promise<{ vendorUserId: string }> {
    const { db } = this.deps;

    // Load the invite by token
    const inviteRows = await db
      .select()
      .from(vendorStaffInvites)
      .where(eq(vendorStaffInvites.inviteToken, input.token))
      .limit(1);

    const invite = inviteRows[0];
    if (!invite) {
      throw new InvalidInviteTokenError("Invite token not found.");
    }

    // T-06-17: reject if already accepted
    if (invite.acceptedAt !== null) {
      throw new InvalidInviteTokenError("Invite has already been used.");
    }

    // T-06-17: reject if expired
    if (invite.expiresAt < new Date()) {
      throw new InvalidInviteTokenError("Invite has expired.");
    }

    // Hash the password (argon2id — OWASP recommended)
    const passwordHash = await argon2.hash(input.password);

    // Atomic transaction: create vendor_user + mark invite accepted
    let vendorUserId = "";
    await db.transaction(async (tx) => {
      // Insert vendor_users row
      const newUserRows = await tx
        .insert(vendorUsers)
        .values({
          vendorId: invite.vendorId,
          email: invite.email,
          passwordHash,
          role: invite.role,
          invitedBy: invite.invitedBy,
          acceptedAt: new Date(),
        })
        .returning({ id: vendorUsers.id });

      vendorUserId = newUserRows[0]?.id ?? "";

      // Mark invite as accepted
      await tx
        .update(vendorStaffInvites)
        .set({ acceptedAt: new Date() })
        .where(eq(vendorStaffInvites.id, invite.id));
    });

    return { vendorUserId };
  }

  /**
   * List active (non-archived) vendor_users for the given vendor (D-05).
   *
   * Returns all team members regardless of role.
   * @param vendorId - The vendor whose staff to list.
   */
  async listStaff(vendorId: string): Promise<StaffMember[]> {
    const { db } = this.deps;

    const rows = await db
      .select({
        id: vendorUsers.id,
        email: vendorUsers.email,
        role: vendorUsers.role,
        acceptedAt: vendorUsers.acceptedAt,
        invitedBy: vendorUsers.invitedBy,
        createdAt: vendorUsers.createdAt,
      })
      .from(vendorUsers)
      .where(
        and(
          eq(vendorUsers.vendorId, vendorId),
          isNull(vendorUsers.archivedAt)
        )
      )
      .limit(200); // practical cap; large teams are unusual

    return rows as StaffMember[];
  }

  /**
   * Soft-delete (archive) a team member (D-05).
   *
   * Sets archivedAt to the current timestamp. Archived users cannot log in.
   *
   * @throws CannotRemoveOwnerError if the target user has role='owner' (D-05).
   * @throws StaffMemberNotFoundError if the user does not belong to the vendor.
   */
  async removeStaff(vendorId: string, userId: string): Promise<void> {
    const { db } = this.deps;

    // Load the user to verify ownership and role
    const userRows = await db
      .select({
        id: vendorUsers.id,
        vendorId: vendorUsers.vendorId,
        role: vendorUsers.role,
        archivedAt: vendorUsers.archivedAt,
      })
      .from(vendorUsers)
      .where(
        and(
          eq(vendorUsers.id, userId),
          eq(vendorUsers.vendorId, vendorId)
        )
      )
      .limit(1);

    const user = userRows[0];
    if (!user) {
      throw new StaffMemberNotFoundError(userId);
    }

    // D-05: owner cannot be removed via this method
    if (user.role === "owner") {
      throw new CannotRemoveOwnerError();
    }

    // Soft-delete: set archivedAt
    await db
      .update(vendorUsers)
      .set({ archivedAt: new Date(), updatedAt: new Date() })
      .where(eq(vendorUsers.id, userId));
  }
}
