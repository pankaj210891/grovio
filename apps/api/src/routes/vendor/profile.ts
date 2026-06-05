import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { VendorProfileService } from "../../modules/vendor-profile/index.js";

/**
 * Vendor profile routes (VEN-01, D-01, D-02).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * T-06-26 mitigation: owner-only routes enforce role=owner at route layer.
 *
 * GET   /vendor/profile                      — all roles
 * PATCH /vendor/profile                      — owner only (public store profile)
 * GET   /vendor/profile/payout-info          — owner only (banking data, D-02)
 * PATCH /vendor/profile/payout-info          — owner only (banking data, D-02)
 * GET   /vendor/profile/return-policy        — owner only
 * PATCH /vendor/profile/return-policy        — owner only
 */

const UpdateProfileInputSchema = z.object({
  storeName: z.string().min(1).optional(),
  storeDescription: z.string().nullable().optional(),
  logoUrl: z.string().url().nullable().optional(),
  bannerUrl: z.string().url().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

const UpdatePayoutInfoInputSchema = z.object({
  accountHolderName: z.string().min(1),
  bankAccountNumber: z.string().min(1),
  ifscOrRoutingCode: z.string().min(1),
  bankName: z.string().min(1),
});

const UpdateReturnPolicyInputSchema = z.object({
  returnWindowDays: z.number().int().min(0),
  isReturnable: z.boolean(),
  conditions: z.string().nullable().optional(),
});

export async function vendorProfileRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  /** Helper: 403 unless the authenticated user is owner (T-06-26). */
  function assertOwner(request: import("fastify").FastifyRequest, reply: import("fastify").FastifyReply): boolean {
    if (request.vendorRole !== "owner") {
      void reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Owner access required" },
      });
      return false;
    }
    return true;
  }

  function getService(): VendorProfileService {
    return fastify.diContainer.resolve<VendorProfileService>("vendorProfileService");
  }

  // ── GET /vendor/profile ───────────────────────────────────────────────────
  fastify.get("/vendor/profile", async (request, reply) => {
    const vendorId = getVendorId(request);
    const service = getService();
    const profile = await service.getProfile(vendorId);
    if (!profile) {
      return reply.status(404).send({
        success: false,
        error: { code: "VENDOR_NOT_FOUND", message: "Vendor not found" },
      });
    }
    return reply.send({ success: true, data: profile });
  });

  // ── PATCH /vendor/profile ─────────────────────────────────────────────────
  // Owner only — public store profile fields (D-01 whitelist).
  fastify.patch("/vendor/profile", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const body = UpdateProfileInputSchema.parse(request.body);
    const vendorId = getVendorId(request);
    const service = getService();
    // Build explicit input to satisfy exactOptionalPropertyTypes
    await service.updateProfile(vendorId, {
      ...(body.storeName !== undefined ? { storeName: body.storeName } : {}),
      ...(body.storeDescription !== undefined ? { storeDescription: body.storeDescription } : {}),
      ...(body.logoUrl !== undefined ? { logoUrl: body.logoUrl } : {}),
      ...(body.bannerUrl !== undefined ? { bannerUrl: body.bannerUrl } : {}),
      ...(body.contactEmail !== undefined ? { contactEmail: body.contactEmail } : {}),
      ...(body.contactPhone !== undefined ? { contactPhone: body.contactPhone } : {}),
      ...(body.address !== undefined ? { address: body.address } : {}),
    });
    return reply.send({ success: true, data: null });
  });

  // ── GET /vendor/profile/payout-info ──────────────────────────────────────
  // Owner only — banking data (D-02, T-06-15).
  fastify.get("/vendor/profile/payout-info", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const service = getService();
    const info = await service.getPayoutInfo(vendorId);
    return reply.send({ success: true, data: info });
  });

  // ── PATCH /vendor/profile/payout-info ────────────────────────────────────
  // Owner only — banking data (D-02, T-06-15).
  fastify.patch("/vendor/profile/payout-info", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const body = UpdatePayoutInfoInputSchema.parse(request.body);
    const vendorId = getVendorId(request);
    const service = getService();
    await service.updatePayoutInfo(vendorId, body);
    return reply.send({ success: true, data: null });
  });

  // ── GET /vendor/profile/return-policy ────────────────────────────────────
  // Owner only.
  fastify.get("/vendor/profile/return-policy", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const service = getService();
    const policy = await service.getReturnPolicy(vendorId);
    return reply.send({ success: true, data: policy });
  });

  // ── PATCH /vendor/profile/return-policy ──────────────────────────────────
  // Owner only.
  fastify.patch("/vendor/profile/return-policy", async (request, reply) => {
    if (!assertOwner(request, reply)) return;
    const body = UpdateReturnPolicyInputSchema.parse(request.body);
    const vendorId = getVendorId(request);
    const service = getService();
    await service.updateReturnPolicy(vendorId, {
      returnWindowDays: body.returnWindowDays,
      isReturnable: body.isReturnable,
      ...(body.conditions !== undefined ? { conditions: body.conditions } : {}),
    });
    return reply.send({ success: true, data: null });
  });
}
