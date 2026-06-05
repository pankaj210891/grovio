import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { AnalyticsService } from "../../modules/analytics/index.js";
import type { AnalyticsPeriod } from "../../modules/analytics/index.js";

/**
 * Vendor dashboard routes (VEN-02).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * All roles allowed.
 *
 * GET /vendor/dashboard?period=30d — KPI summary for the vendor's dashboard
 */

const PeriodQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export async function vendorDashboardRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  // ── GET /vendor/dashboard ─────────────────────────────────────────────────
  fastify.get("/vendor/dashboard", async (request, reply) => {
    const { period } = PeriodQuerySchema.parse(request.query);
    const vendorId = getVendorId(request);
    const analyticsService =
      fastify.diContainer.resolve<AnalyticsService>("analyticsService");

    const summary = await analyticsService.getVendorDashboard(
      vendorId,
      period as AnalyticsPeriod
    );
    return reply.send({ success: true, data: summary });
  });
}
