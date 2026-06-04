import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { AnalyticsService } from "../../modules/analytics/index.js";

/**
 * Vendor earnings routes (MKT-05, D-09).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * T-06-26 mitigation: owner+manager only (staff cannot view earnings).
 *
 * GET /vendor/earnings — earnings summary + commission ledger + settlement records
 */

export async function vendorEarningsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  // ── GET /vendor/earnings ──────────────────────────────────────────────────
  // Owner + manager only — staff should not see financial data.
  fastify.get("/vendor/earnings", async (request, reply) => {
    const role = request.vendorRole;
    if (role !== "manager" && role !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Manager or owner access required" },
      });
    }

    const vendorId = getVendorId(request);
    const analyticsService =
      fastify.diContainer.resolve<AnalyticsService>("analyticsService");

    const result = await analyticsService.getVendorEarnings(vendorId);
    return reply.send({ success: true, data: result });
  });
}
