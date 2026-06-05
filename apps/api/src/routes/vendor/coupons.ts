import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { FeatureFlagService } from "../../modules/feature-flags/index.js";
import { coupons } from "../../db/schema/index.js";

/**
 * Vendor coupon management routes (VEN-06, D-14).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * T-06-26 mitigation: manager+owner only.
 * T-06-27 mitigation: COUPONS_ENABLED feature flag gate — returns 404 when disabled (D-14).
 * T-06-28 mitigation: all queries are scoped to created_by_id=vendorId.
 *
 * GET  /vendor/coupons — list vendor's coupons
 * POST /vendor/coupons — create a vendor-scoped coupon
 *
 * Note: The COUPONS_ENABLED gate is checked per-handler, not at plugin level,
 * so the 404 response is returned consistently for all operations.
 */

const CreateCouponInputSchema = z.object({
  code: z.string().min(1).max(50),
  discountType: z.enum(["percentage", "flat"]),
  discountValue: z.number().int().positive(),
  minOrderMinor: z.number().int().min(0).optional(),
  maxRedemptions: z.number().int().positive().nullable().optional(),
  expiresAt: z.string().datetime({ offset: true }).nullable().optional(),
});

export async function vendorCouponRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  async function checkCouponsEnabled(reply: import("fastify").FastifyReply): Promise<boolean> {
    const featureFlagService =
      fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
    const enabled = await featureFlagService.getFlag("COUPONS_ENABLED");
    // getFlag returns null when disabled — treat falsy as disabled (D-14, T-06-27)
    if (!enabled || enabled === "false" || enabled === "0") {
      void reply.status(404).send({
        success: false,
        error: { code: "FEATURE_DISABLED", message: "Coupons feature is not enabled" },
      });
      return false;
    }
    return true;
  }

  // ── GET /vendor/coupons ───────────────────────────────────────────────────
  // Manager + owner only. Returns 404 when COUPONS_ENABLED is off (T-06-27).
  fastify.get("/vendor/coupons", async (request, reply) => {
    const role = request.vendorRole;
    if (role !== "manager" && role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Manager or owner access required" },
      });
    }

    if (!(await checkCouponsEnabled(reply))) return;

    const vendorId = getVendorId(request);

    const rows = await fastify.db
      .select()
      .from(coupons)
      .where(
        and(
          eq(coupons.createdByType, "vendor"),
          eq(coupons.createdById, vendorId),
          eq(coupons.isActive, true)
        )
      )
      .orderBy(desc(coupons.createdAt));

    return reply.send({ success: true, data: { coupons: rows } });
  });

  // ── POST /vendor/coupons ──────────────────────────────────────────────────
  // Manager + owner only. Returns 404 when COUPONS_ENABLED is off (T-06-27).
  fastify.post("/vendor/coupons", async (request, reply) => {
    const role = request.vendorRole;
    if (role !== "manager" && role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Manager or owner access required" },
      });
    }

    if (!(await checkCouponsEnabled(reply))) return;

    const body = CreateCouponInputSchema.parse(request.body);
    const vendorId = getVendorId(request);

    const rows = await fastify.db
      .insert(coupons)
      .values({
        code: body.code.toUpperCase(),
        discountType: body.discountType,
        discountValue: body.discountValue,
        minOrderMinor: body.minOrderMinor ?? 0,
        maxRedemptions: body.maxRedemptions ?? null,
        expiresAt: body.expiresAt ? new Date(body.expiresAt) : null,
        createdByType: "vendor",
        createdById: vendorId,
        // Vendor coupons are always vendor-scoped (D-14) — auto-scoped to their store
        scopeType: "vendor",
        scopeId: vendorId,
      })
      .returning();

    return reply.status(201).send({ success: true, data: rows[0] });
  });
}
