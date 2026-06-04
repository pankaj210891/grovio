import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { VendorStaffService } from "../../modules/vendor-staff/index.js";
import {
  InvalidInviteTokenError,
  OwnerRoleNotInvitableError,
  CannotRemoveOwnerError,
  StaffMemberNotFoundError,
} from "../../modules/vendor-staff/VendorStaffService.js";
import {
  InviteVendorStaffInputSchema,
  AcceptVendorInviteInputSchema,
} from "@grovio/contracts/vendor/staff";

/**
 * Vendor team management routes (VEN-05, D-04, D-05).
 *
 * Protected routes (guarded by requireVendorAuth) — ALL owner-only:
 *   GET    /vendor/team             — list team members
 *   POST   /vendor/team/invite      — invite a new team member
 *   DELETE /vendor/team/:userId     — remove a team member
 *
 * Public route (NO requireVendorAuth — invitee has no account yet, T-06-29):
 *   POST /vendor/team/accept-invite — accept an invite token and create an account
 *
 * T-06-26 mitigation: invite/list/delete routes are owner-only.
 * T-06-29 mitigation: accept validates token expiry + acceptedAt in VendorStaffService.
 * T-06-16 mitigation: OwnerRoleNotInvitableError rejects role=owner invites.
 * T-06-17 mitigation: accept rejects expired/used tokens.
 * D-05 mitigation: removeStaff rejects owner-role removals.
 *
 * The public accept-invite route is registered in a separate plugin call (vendorTeamPublicRoutes)
 * so it runs without the requireVendorAuth preHandler.
 */

// ---------------------------------------------------------------------------
// Protected team routes (owner-only)
// ---------------------------------------------------------------------------

export async function vendorTeamRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  /** Helper: 403 unless the authenticated user is owner (T-06-26). */
  function assertOwner(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply
  ): boolean {
    if (request.vendorRole !== "owner") {
      void reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Owner access required" },
      });
      return false;
    }
    return true;
  }

  function getService(): VendorStaffService {
    return fastify.diContainer.resolve<VendorStaffService>("vendorStaffService");
  }

  // ── GET /vendor/team ──────────────────────────────────────────────────────
  // Owner only — list all active team members.
  fastify.get("/vendor/team", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const service = getService();
    const members = await service.listStaff(vendorId);
    return reply.send({ success: true, data: { members } });
  });

  // ── POST /vendor/team/invite ──────────────────────────────────────────────
  // Owner only — send an invite email to a new team member (D-04).
  fastify.post("/vendor/team/invite", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const body = InviteVendorStaffInputSchema.parse(request.body);
    const vendorId = getVendorId(request);
    const service = getService();

    try {
      // invitedByUserId: use vendorId from JWT as the inviter identity (loose ref)
      const invite = await service.invite(vendorId, vendorId, body);
      return reply.status(201).send({ success: true, data: invite });
    } catch (err) {
      if (err instanceof OwnerRoleNotInvitableError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── DELETE /vendor/team/:userId ───────────────────────────────────────────
  // Owner only — soft-delete (archive) a team member (D-05).
  fastify.delete<{ Params: { userId: string } }>(
    "/vendor/team/:userId",
    async (request, reply) => {
      if (!assertOwner(request, reply)) return;
      const vendorId = getVendorId(request);
      const service = getService();

      try {
        await service.removeStaff(vendorId, request.params.userId);
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof CannotRemoveOwnerError) {
          return reply.status(422).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof StaffMemberNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
}

// ---------------------------------------------------------------------------
// Public accept-invite route (NO requireVendorAuth — T-06-29)
// ---------------------------------------------------------------------------

/**
 * Public accept-invite route — registered separately so it runs without the
 * requireVendorAuth preHandler. The invitee has no account yet and thus no JWT.
 *
 * POST /vendor/team/accept-invite
 *   Validates the invite token (expiry + not-already-used), hashes the password,
 *   creates a vendor_users row, and marks the invite as accepted.
 *
 * Security: token validation is done by VendorStaffService.accept (T-06-17 mitigation).
 */
export async function vendorTeamPublicRoutes(fastify: FastifyInstance): Promise<void> {
  function getService(): VendorStaffService {
    return fastify.diContainer.resolve<VendorStaffService>("vendorStaffService");
  }

  fastify.post("/vendor/team/accept-invite", async (request, reply) => {
    const body = AcceptVendorInviteInputSchema.parse(request.body);
    const service = getService();

    try {
      const result = await service.accept({
        token: body.token,
        password: body.password,
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (err) {
      if (err instanceof InvalidInviteTokenError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
}
