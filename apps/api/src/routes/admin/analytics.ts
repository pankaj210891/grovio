import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { AnalyticsService } from "../../modules/analytics/index.js";
import type { AnalyticsPeriod } from "../../modules/analytics/index.js";

/**
 * Admin analytics routes (ADM-01, D-10).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET /admin/analytics/summary?period=30d  — KPI summary strip (GMV, orders, vendors, customers)
 * GET /admin/analytics/charts?period=30d   — chart data (orders by day, top vendors, GMV by category)
 *
 * Period must be one of: 7d | 30d | 90d. Defaults to 30d.
 */

const PeriodQuerySchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});

export async function adminAnalyticsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): AnalyticsService {
    return fastify.diContainer.resolve<AnalyticsService>("analyticsService");
  }

  // ── GET /admin/analytics/summary ──────────────────────────────────────────
  fastify.get("/admin/analytics/summary", async (request, reply) => {
    const { period } = PeriodQuerySchema.parse(request.query);
    const service = getService();
    const summary = await service.getAdminSummary(period as AnalyticsPeriod);
    return reply.send({ success: true, data: summary });
  });

  // ── GET /admin/analytics/charts ───────────────────────────────────────────
  fastify.get("/admin/analytics/charts", async (request, reply) => {
    const { period } = PeriodQuerySchema.parse(request.query);
    const service = getService();
    const charts = await service.getAdminCharts(period as AnalyticsPeriod);
    return reply.send({ success: true, data: charts });
  });

  // ── GET /admin/insights/product-views (Plan 11-05 T9) ─────────────────────
  // Most-viewed products platform-wide (last 7d) from customer_product_views.
  fastify.get("/admin/insights/product-views", async (_request, reply) => {
    const service = getService();
    const data = await service.getMostViewedProducts();
    return reply.send({ success: true, data });
  });

  // ── GET /admin/insights/view-conversion-gap (Plan 11-05 T9) ──────────────
  // Products with high views but low order conversion (last 7d).
  // view_count > 50 AND (order_count / view_count) < 0.02.
  fastify.get("/admin/insights/view-conversion-gap", async (_request, reply) => {
    const service = getService();
    const data = await service.getViewConversionGap();
    return reply.send({ success: true, data });
  });
}
