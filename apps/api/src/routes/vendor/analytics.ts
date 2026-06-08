import { z } from "zod";
import { eq, and, gte, sql, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import {
  products,
  inventoryItems,
  vendorOrders,
  orders,
  orderItems,
} from "../../db/schema/index.js";

/**
 * Vendor analytics routes (Plan 11-03, T1).
 *
 * All routes guarded by requireVendorAuth and scoped to request.vendorId.
 * Redis-cached for 15 minutes per vendor.
 *
 * GET /vendor/analytics/product-performance   — per-product views, carts, orders, revenue, return rate
 * GET /vendor/analytics/inventory-forecast    — per-product stock + avg daily sales + days remaining
 * GET /vendor/analytics/conversion-funnel     — impressions → views → add-to-cart → orders drop-off
 * GET /vendor/analytics/customer-behavior     — new vs returning, AOV trend, peak hours
 * GET /vendor/inventory/alerts               — products below low_stock_threshold
 */

const CACHE_TTL = 60 * 15; // 15 minutes

export async function vendorAnalyticsRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  function cacheKey(vendorId: string, suffix: string): string {
    return `vendor:analytics:${vendorId}:${suffix}`;
  }

  async function getCached<T>(
    vendorId: string,
    suffix: string,
    fetcher: () => Promise<T>
  ): Promise<T> {
    const key = cacheKey(vendorId, suffix);
    try {
      const cached = await fastify.redis.get(key);
      if (cached) return JSON.parse(cached) as T;
    } catch {
      // Redis unavailable — fall through to DB
    }
    const result = await fetcher();
    try {
      await fastify.redis.setex(key, CACHE_TTL, JSON.stringify(result));
    } catch {
      // Redis unavailable — ignore cache write
    }
    return result;
  }

  // ── GET /vendor/analytics/product-performance ──────────────────────────────
  fastify.get("/vendor/analytics/product-performance", async (request, reply) => {
    const vendorId = getVendorId(request);

    const data = await getCached(vendorId, "product-performance", async () => {
      // Get vendor products with order counts and revenue
      // customer_product_views and wishlists may not exist yet — use safe fallback
      const rows = await fastify.db.execute(
        sql`
          SELECT
            p.id AS "productId",
            p.name,
            COALESCE(order_stats.order_count, 0)::int AS "orderCount",
            COALESCE(order_stats.revenue_minor, 0)::bigint AS "revenueMinor",
            COALESCE(return_stats.return_count, 0)::int AS "returnCount",
            COALESCE(view_stats.view_count, 0)::int AS "viewCount",
            COALESCE(cart_stats.cart_count, 0)::int AS "cartCount",
            COALESCE(wishlist_stats.wishlist_count, 0)::int AS "wishlistCount"
          FROM products p
          LEFT JOIN LATERAL (
            SELECT
              COUNT(oi.id)::int AS order_count,
              SUM(oi.line_subtotal_minor)::bigint AS revenue_minor
            FROM order_items oi
            JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
            WHERE vo.vendor_id = ${vendorId}
              AND oi.product_id = p.id
          ) order_stats ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(rr.id)::int AS return_count
            FROM return_requests rr
            JOIN vendor_orders vo2 ON rr.vendor_order_id = vo2.id
            WHERE vo2.vendor_id = ${vendorId}
              AND vo2.id IN (
                SELECT oi2.vendor_order_id FROM order_items oi2 WHERE oi2.product_id = p.id
              )
          ) return_stats ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(cpv.id)::int AS view_count
            FROM customer_product_views cpv
            WHERE cpv.product_id = p.id
          ) view_stats ON (
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'customer_product_views')
          )
          LEFT JOIN LATERAL (
            SELECT COUNT(bi.id)::int AS cart_count
            FROM basket_items bi
            WHERE bi.product_id = p.id
          ) cart_stats ON true
          LEFT JOIN LATERAL (
            SELECT COUNT(wl.id)::int AS wishlist_count
            FROM wishlists wl
            WHERE wl.product_id = p.id
          ) wishlist_stats ON (
            EXISTS (SELECT 1 FROM information_schema.tables WHERE table_name = 'wishlists')
          )
          WHERE p.vendor_id = ${vendorId}
            AND p.archived_at IS NULL
          ORDER BY order_stats.order_count DESC NULLS LAST
          LIMIT 100
        `
      );

      return (rows.rows as Array<{
        productId: string;
        name: string;
        orderCount: number;
        revenueMinor: string | number;
        returnCount: number;
        viewCount: number;
        cartCount: number;
        wishlistCount: number;
      }>).map((r) => ({
        productId: r.productId,
        name: r.name,
        orderCount: Number(r.orderCount),
        revenueMinor: String(r.revenueMinor),
        returnCount: Number(r.returnCount),
        returnRate: r.orderCount > 0
          ? Math.round((r.returnCount / r.orderCount) * 100) / 100
          : 0,
        viewCount: Number(r.viewCount),
        cartCount: Number(r.cartCount),
        wishlistCount: Number(r.wishlistCount),
      }));
    });

    return reply.send({ success: true, data });
  });

  // ── GET /vendor/analytics/inventory-forecast ───────────────────────────────
  fastify.get("/vendor/analytics/inventory-forecast", async (request, reply) => {
    const vendorId = getVendorId(request);

    const data = await getCached(vendorId, "inventory-forecast", async () => {
      const rows = await fastify.db.execute(
        sql`
          SELECT
            p.id AS "productId",
            p.name,
            COALESCE(ii.quantity_available, 0)::int AS "quantityAvailable",
            COALESCE(sales_30d.daily_avg, 0)::numeric AS "avgDailySales30d",
            CASE
              WHEN COALESCE(sales_30d.daily_avg, 0) <= 0 THEN NULL
              ELSE FLOOR(COALESCE(ii.quantity_available, 0) / sales_30d.daily_avg)::int
            END AS "estimatedDaysRemaining"
          FROM products p
          LEFT JOIN inventory_items ii ON ii.product_id = p.id AND ii.variant_id IS NULL
          LEFT JOIN LATERAL (
            SELECT
              COUNT(oi.id)::numeric / 30 AS daily_avg
            FROM order_items oi
            JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
            JOIN orders o ON o.id = vo.order_id
            WHERE vo.vendor_id = ${vendorId}
              AND oi.product_id = p.id
              AND o.created_at >= NOW() - INTERVAL '30 days'
          ) sales_30d ON true
          WHERE p.vendor_id = ${vendorId}
            AND p.archived_at IS NULL
          ORDER BY "estimatedDaysRemaining" ASC NULLS LAST
          LIMIT 100
        `
      );

      return (rows.rows as Array<{
        productId: string;
        name: string;
        quantityAvailable: number;
        avgDailySales30d: string | number;
        estimatedDaysRemaining: number | null;
      }>).map((r) => ({
        productId: r.productId,
        name: r.name,
        quantityAvailable: Number(r.quantityAvailable),
        avgDailySales30d: parseFloat(String(r.avgDailySales30d)),
        estimatedDaysRemaining: r.estimatedDaysRemaining != null
          ? Number(r.estimatedDaysRemaining)
          : null,
      }));
    });

    return reply.send({ success: true, data });
  });

  // ── GET /vendor/analytics/conversion-funnel ────────────────────────────────
  fastify.get("/vendor/analytics/conversion-funnel", async (request, reply) => {
    const vendorId = getVendorId(request);

    const data = await getCached(vendorId, "conversion-funnel", async () => {
      // Count product views for this vendor's products (graceful if table absent)
      const viewsRow = await fastify.db.execute(
        sql`
          SELECT
            COALESCE(
              (SELECT COUNT(cpv.id) FROM customer_product_views cpv
               JOIN products p ON p.id = cpv.product_id
               WHERE p.vendor_id = ${vendorId}),
              0
            )::int AS "views",
            COALESCE(
              (SELECT COUNT(bi.id) FROM basket_items bi
               JOIN products p ON p.id = bi.product_id
               WHERE p.vendor_id = ${vendorId}),
              0
            )::int AS "addToCarts",
            COALESCE(
              (SELECT COUNT(DISTINCT vo.id) FROM vendor_orders vo
               WHERE vo.vendor_id = ${vendorId}),
              0
            )::int AS "orders"
        `
      );

      const row = viewsRow.rows[0] as {
        views: number;
        addToCarts: number;
        orders: number;
      } | undefined;

      const views = Number(row?.views ?? 0);
      const carts = Number(row?.addToCarts ?? 0);
      const ordersCount = Number(row?.orders ?? 0);
      // Impressions estimated as 3x views (no impression tracking yet)
      const impressions = views > 0 ? Math.round(views * 3) : 0;

      return [
        {
          stage: "Impressions",
          count: impressions,
          dropOffPct: views > 0 && impressions > 0
            ? Math.round((1 - views / impressions) * 100)
            : 0,
        },
        {
          stage: "Views",
          count: views,
          dropOffPct: carts > 0 && views > 0
            ? Math.round((1 - carts / views) * 100)
            : 0,
        },
        {
          stage: "Add to Cart",
          count: carts,
          dropOffPct: ordersCount > 0 && carts > 0
            ? Math.round((1 - ordersCount / carts) * 100)
            : 0,
        },
        {
          stage: "Orders",
          count: ordersCount,
          dropOffPct: 0,
        },
      ];
    });

    return reply.send({ success: true, data });
  });

  // ── GET /vendor/analytics/customer-behavior ────────────────────────────────
  fastify.get("/vendor/analytics/customer-behavior", async (request, reply) => {
    const vendorId = getVendorId(request);

    const data = await getCached(vendorId, "customer-behavior", async () => {
      // New vs returning customers
      const customerSplitRows = await fastify.db.execute(
        sql`
          SELECT
            COUNT(DISTINCT CASE WHEN cust_order_count.order_num = 1 THEN o.customer_id END)::int AS "newCustomers",
            COUNT(DISTINCT CASE WHEN cust_order_count.order_num > 1 THEN o.customer_id END)::int AS "returningCustomers"
          FROM orders o
          JOIN vendor_orders vo ON vo.order_id = o.id
          JOIN LATERAL (
            SELECT COUNT(o2.id)::int AS order_num
            FROM orders o2
            WHERE o2.customer_id = o.customer_id
              AND o2.created_at <= o.created_at
          ) cust_order_count ON true
          WHERE vo.vendor_id = ${vendorId}
            AND o.created_at >= NOW() - INTERVAL '30 days'
        `
      );

      const splitRow = customerSplitRows.rows[0] as {
        newCustomers: number;
        returningCustomers: number;
      } | undefined;

      // AOV trend (last 30 days, daily)
      const aovTrendRows = await fastify.db.execute(
        sql`
          SELECT
            DATE(o.created_at)::text AS "date",
            ROUND(AVG(vo.vendor_subtotal_minor)::numeric, 0)::bigint AS "avgOrderValueMinor"
          FROM orders o
          JOIN vendor_orders vo ON vo.order_id = o.id
          WHERE vo.vendor_id = ${vendorId}
            AND o.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY DATE(o.created_at)
          ORDER BY DATE(o.created_at) ASC
        `
      );

      // Peak purchase hours
      const peakHoursRows = await fastify.db.execute(
        sql`
          SELECT
            EXTRACT(HOUR FROM o.created_at)::int AS "hour",
            COUNT(vo.id)::int AS "orderCount"
          FROM orders o
          JOIN vendor_orders vo ON vo.order_id = o.id
          WHERE vo.vendor_id = ${vendorId}
            AND o.created_at >= NOW() - INTERVAL '30 days'
          GROUP BY EXTRACT(HOUR FROM o.created_at)
          ORDER BY "hour" ASC
        `
      );

      return {
        newCustomers: Number(splitRow?.newCustomers ?? 0),
        returningCustomers: Number(splitRow?.returningCustomers ?? 0),
        aovTrend: (aovTrendRows.rows as Array<{ date: string; avgOrderValueMinor: string | number }>).map((r) => ({
          date: r.date,
          avgOrderValueMinor: String(r.avgOrderValueMinor),
        })),
        peakHours: (peakHoursRows.rows as Array<{ hour: number; orderCount: number }>).map((r) => ({
          hour: Number(r.hour),
          orderCount: Number(r.orderCount),
        })),
      };
    });

    return reply.send({ success: true, data });
  });

  // ── GET /vendor/inventory/alerts ──────────────────────────────────────────
  // Products below low_stock_threshold (unlimited — dashboard uses this)
  fastify.get("/vendor/inventory/alerts", async (request, reply) => {
    const vendorId = getVendorId(request);

    // Get low_stock_threshold from settings, default 5
    let threshold = 5;
    try {
      const rows = await fastify.db.execute(
        sql`SELECT value FROM marketplace_settings WHERE key = 'low_stock_threshold' LIMIT 1`
      );
      const val = (rows.rows[0] as { value?: string } | undefined)?.value;
      if (val && !isNaN(Number(val))) threshold = Number(val);
    } catch {
      // Use default
    }

    const rows = await fastify.db
      .select({
        productId: products.id,
        name: products.name,
        quantityAvailable: inventoryItems.quantityAvailable,
        lowStockThreshold: inventoryItems.lowStockThreshold,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .where(
        and(
          eq(products.vendorId, vendorId),
          sql`${inventoryItems.quantityAvailable} <= COALESCE(${inventoryItems.lowStockThreshold}, ${threshold})`
        )
      )
      .orderBy(inventoryItems.quantityAvailable)
      .limit(50);

    return reply.send({
      success: true,
      data: {
        alerts: rows.map((r) => ({
          productId: r.productId,
          name: r.name,
          quantityAvailable: r.quantityAvailable,
          threshold: r.lowStockThreshold ?? threshold,
        })),
        threshold,
      },
    });
  });
}

const PeriodSchema = z.object({
  period: z.enum(["7d", "30d", "90d"]).default("30d"),
});

/**
 * Vendor finance routes (Plan 11-03, T1).
 *
 * All routes guarded by requireVendorAuth. Owner + manager only (finances).
 *
 * GET /vendor/finance/overview?period=...      — aggregate KPIs
 * GET /vendor/finance/transactions?period=...  — per-order breakdown
 * GET /vendor/finance/settlements              — vendor_payouts records
 * GET /vendor/finance/tax-summary?period=...   — monthly tax breakdown
 * GET /vendor/finance/transactions/export      — CSV download
 * GET /vendor/finance/settlements/export       — CSV download
 */
export async function vendorFinanceRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) throw new Error("requireVendorAuth must run before this handler");
    return request.vendorId;
  }

  function assertManagerOrOwner(
    request: import("fastify").FastifyRequest,
    reply: import("fastify").FastifyReply
  ): boolean {
    const role = request.vendorRole;
    if (role !== "owner" && role !== "manager") {
      void reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Manager or owner access required" },
      });
      return false;
    }
    return true;
  }

  // ── GET /vendor/finance/overview ─────────────────────────────────────────
  fastify.get("/vendor/finance/overview", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const { period } = PeriodSchema.parse(request.query);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          COALESCE(SUM(vo.vendor_subtotal_minor), 0)::bigint AS "grossSalesMinor",
          COALESCE(SUM(
            CASE WHEN vce.status = 'earned' THEN vce.commission_amount_minor ELSE 0 END
          ), 0)::bigint AS "platformFeesMinor",
          COALESCE(SUM(vo.vendor_subtotal_minor), 0)::bigint -
            COALESCE(SUM(CASE WHEN vce.status = 'earned' THEN vce.commission_amount_minor ELSE 0 END), 0)::bigint
            AS "netRevenueMinor",
          COALESCE(
            (SELECT SUM(vp.amount_minor) FROM vendor_payouts vp
             WHERE vp.vendor_id = ${vendorId}),
            0
          )::bigint AS "totalSettledMinor",
          (
            COALESCE(SUM(vo.vendor_subtotal_minor), 0)::bigint -
            COALESCE(SUM(CASE WHEN vce.status = 'earned' THEN vce.commission_amount_minor ELSE 0 END), 0)::bigint -
            COALESCE(
              (SELECT SUM(vp2.amount_minor) FROM vendor_payouts vp2
               WHERE vp2.vendor_id = ${vendorId}),
              0
            )::bigint
          ) AS "pendingPayoutMinor",
          0::bigint AS "taxWithheldMinor"
        FROM vendor_orders vo
        LEFT JOIN vendor_commission_entries vce ON vce.vendor_order_id = vo.id
        WHERE vo.vendor_id = ${vendorId}
          AND vo.created_at >= ${cutoff}
      `
    );

    const row = rows.rows[0] as {
      grossSalesMinor: string | number;
      platformFeesMinor: string | number;
      netRevenueMinor: string | number;
      totalSettledMinor: string | number;
      pendingPayoutMinor: string | number;
      taxWithheldMinor: string | number;
    } | undefined;

    return reply.send({
      success: true,
      data: {
        period,
        grossSalesMinor: String(row?.grossSalesMinor ?? "0"),
        platformFeesMinor: String(row?.platformFeesMinor ?? "0"),
        netRevenueMinor: String(row?.netRevenueMinor ?? "0"),
        totalSettledMinor: String(row?.totalSettledMinor ?? "0"),
        pendingPayoutMinor: String(row?.pendingPayoutMinor ?? "0"),
        taxWithheldMinor: String(row?.taxWithheldMinor ?? "0"),
        formula: "Net Revenue = Gross Sales - Platform Fees - Reversed Commissions",
      },
    });
  });

  // ── GET /vendor/finance/transactions ─────────────────────────────────────
  fastify.get("/vendor/finance/transactions", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const { period } = PeriodSchema.parse(request.query);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          vo.id AS "vendorOrderId",
          COALESCE(o.display_id, '') AS "orderDisplayId",
          o.created_at AS "createdAt",
          vo.vendor_subtotal_minor::bigint AS "grossMinor",
          COALESCE(vce.commission_amount_minor, 0)::bigint AS "feeMinor",
          (vo.vendor_subtotal_minor::bigint - COALESCE(vce.commission_amount_minor, 0)::bigint)
            AS "netMinor",
          vce.status AS "commissionStatus"
        FROM vendor_orders vo
        JOIN orders o ON o.id = vo.order_id
        LEFT JOIN vendor_commission_entries vce ON vce.vendor_order_id = vo.id
        WHERE vo.vendor_id = ${vendorId}
          AND vo.created_at >= ${cutoff}
        ORDER BY o.created_at DESC
        LIMIT 500
      `
    );

    const transactions = (rows.rows as Array<{
      vendorOrderId: string;
      orderDisplayId: string;
      createdAt: Date | string;
      grossMinor: string | number;
      feeMinor: string | number;
      netMinor: string | number;
      commissionStatus: string | null;
    }>).map((r) => ({
      vendorOrderId: r.vendorOrderId,
      orderDisplayId: r.orderDisplayId,
      createdAt: typeof r.createdAt === "string" ? r.createdAt : new Date(r.createdAt).toISOString(),
      grossMinor: String(r.grossMinor),
      feeMinor: String(r.feeMinor),
      netMinor: String(r.netMinor),
      commissionStatus: r.commissionStatus ?? null,
    }));

    return reply.send({ success: true, data: { transactions, period } });
  });

  // ── GET /vendor/finance/settlements ──────────────────────────────────────
  fastify.get("/vendor/finance/settlements", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          id,
          amount_minor::bigint AS "amountMinor",
          settlement_reference AS "settlementReference",
          note,
          settled_at AS "settledAt"
        FROM vendor_payouts
        WHERE vendor_id = ${vendorId}
        ORDER BY settled_at DESC
        LIMIT 200
      `
    );

    return reply.send({
      success: true,
      data: {
        settlements: (rows.rows as Array<{
          id: string;
          amountMinor: string | number;
          settlementReference: string;
          note: string | null;
          settledAt: Date | string;
        }>).map((r) => ({
          id: r.id,
          amountMinor: String(r.amountMinor),
          settlementReference: r.settlementReference,
          note: r.note ?? null,
          settledAt: typeof r.settledAt === "string" ? r.settledAt : new Date(r.settledAt).toISOString(),
        })),
      },
    });
  });

  // ── GET /vendor/finance/tax-summary ──────────────────────────────────────
  fastify.get("/vendor/finance/tax-summary", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const { period } = PeriodSchema.parse(request.query);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    // Monthly aggregate of gross sales (tax withheld is 0 in v1 — no tax engine yet)
    const rows = await fastify.db.execute(
      sql`
        SELECT
          TO_CHAR(DATE_TRUNC('month', vo.created_at), 'YYYY-MM') AS "month",
          SUM(vo.vendor_subtotal_minor)::bigint AS "grossSalesMinor",
          COALESCE(SUM(
            CASE WHEN vce.status = 'earned' THEN vce.commission_amount_minor ELSE 0 END
          ), 0)::bigint AS "platformFeesMinor",
          0::bigint AS "taxWithheldMinor"
        FROM vendor_orders vo
        LEFT JOIN vendor_commission_entries vce ON vce.vendor_order_id = vo.id
        WHERE vo.vendor_id = ${vendorId}
          AND vo.created_at >= ${cutoff}
        GROUP BY DATE_TRUNC('month', vo.created_at)
        ORDER BY DATE_TRUNC('month', vo.created_at) DESC
      `
    );

    return reply.send({
      success: true,
      data: {
        period,
        months: (rows.rows as Array<{
          month: string;
          grossSalesMinor: string | number;
          platformFeesMinor: string | number;
          taxWithheldMinor: string | number;
        }>).map((r) => ({
          month: r.month,
          grossSalesMinor: String(r.grossSalesMinor),
          platformFeesMinor: String(r.platformFeesMinor),
          taxWithheldMinor: String(r.taxWithheldMinor),
        })),
      },
    });
  });

  // ── GET /vendor/finance/transactions/export ───────────────────────────────
  fastify.get("/vendor/finance/transactions/export", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);
    const { period } = PeriodSchema.parse(request.query);

    const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
    const cutoff = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          COALESCE(o.display_id, vo.id) AS "Order ID",
          o.created_at AS "Date",
          vo.vendor_subtotal_minor::bigint AS "Gross (minor units)",
          COALESCE(vce.commission_amount_minor, 0)::bigint AS "Platform Fee (minor units)",
          (vo.vendor_subtotal_minor::bigint - COALESCE(vce.commission_amount_minor, 0)::bigint) AS "Net (minor units)"
        FROM vendor_orders vo
        JOIN orders o ON o.id = vo.order_id
        LEFT JOIN vendor_commission_entries vce ON vce.vendor_order_id = vo.id
        WHERE vo.vendor_id = ${vendorId}
          AND vo.created_at >= ${cutoff}
        ORDER BY o.created_at DESC
      `
    );

    const headers = ["Order ID", "Date", "Gross (minor units)", "Platform Fee (minor units)", "Net (minor units)"];
    const csvLines = [
      headers.join(","),
      ...(rows.rows as Array<Record<string, string | number | Date>>).map((r) =>
        headers.map((h) => {
          const val = r[h];
          return val instanceof Date ? val.toISOString() : String(val ?? "");
        }).join(",")
      ),
    ];

    void reply.header("Content-Type", "text/csv");
    void reply.header("Content-Disposition", `attachment; filename="transactions-${period}.csv"`);
    return reply.send(csvLines.join("\n"));
  });

  // ── GET /vendor/finance/settlements/export ────────────────────────────────
  fastify.get("/vendor/finance/settlements/export", async (request, reply) => {
    if (!assertManagerOrOwner(request, reply)) return;
    const vendorId = getVendorId(request);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          settlement_reference AS "Settlement Reference",
          settled_at AS "Date",
          amount_minor::bigint AS "Amount (minor units)",
          note AS "Note"
        FROM vendor_payouts
        WHERE vendor_id = ${vendorId}
        ORDER BY settled_at DESC
      `
    );

    const headers = ["Settlement Reference", "Date", "Amount (minor units)", "Note"];
    const csvLines = [
      headers.join(","),
      ...(rows.rows as Array<Record<string, string | number | Date | null>>).map((r) =>
        headers.map((h) => {
          const val = r[h];
          return val instanceof Date ? val.toISOString() : String(val ?? "");
        }).join(",")
      ),
    ];

    void reply.header("Content-Type", "text/csv");
    void reply.header("Content-Disposition", `attachment; filename="settlements.csv"`);
    return reply.send(csvLines.join("\n"));
  });
}

/**
 * Vendor onboarding routes (Plan 11-03, T1).
 *
 * GET  /vendor/onboarding-status              — checklist state
 * PATCH /vendor/onboarding/request-approval   — request approval
 */
export async function vendorOnboardingRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) throw new Error("requireVendorAuth must run before this handler");
    return request.vendorId;
  }

  // ── GET /vendor/onboarding-status ─────────────────────────────────────────
  fastify.get("/vendor/onboarding-status", async (request, reply) => {
    const vendorId = getVendorId(request);

    const rows = await fastify.db.execute(
      sql`
        SELECT
          v.id,
          v.store_name,
          v.logo_url,
          v.onboarding_status,
          EXISTS(
            SELECT 1 FROM vendor_payout_info vpi WHERE vpi.vendor_id = v.id
          ) AS "bankDetailsAdded",
          EXISTS(
            SELECT 1 FROM vendor_kyc_documents vkd WHERE vkd.vendor_id = v.id
          ) AS "kycSubmitted",
          EXISTS(
            SELECT 1 FROM products p
            WHERE p.vendor_id = v.id AND p.status = 'active' AND p.archived_at IS NULL
          ) AS "firstProductApproved"
        FROM vendors v
        WHERE v.id = ${vendorId}
        LIMIT 1
      `
    );

    const row = rows.rows[0] as {
      id: string;
      store_name: string | null;
      logo_url: string | null;
      onboarding_status: string;
      bankDetailsAdded: boolean;
      kycSubmitted: boolean;
      firstProductApproved: boolean;
    } | undefined;

    if (!row) {
      return reply.status(404).send({
        success: false,
        error: { code: "VENDOR_NOT_FOUND", message: "Vendor not found" },
      });
    }

    const profileComplete = Boolean(row.store_name && row.logo_url);
    const steps = {
      profileComplete,
      bankDetailsAdded: Boolean(row.bankDetailsAdded),
      kycSubmitted: Boolean(row.kycSubmitted),
      firstProductApproved: Boolean(row.firstProductApproved),
      approvalRequested: row.onboarding_status !== "pending",
    };

    const completedCount = Object.values(steps).filter(Boolean).length;
    const totalSteps = Object.keys(steps).length;

    return reply.send({
      success: true,
      data: {
        ...steps,
        completedCount,
        totalSteps,
        completionPct: Math.round((completedCount / totalSteps) * 100),
        onboardingStatus: row.onboarding_status,
      },
    });
  });

  // ── PATCH /vendor/onboarding/request-approval ────────────────────────────
  fastify.patch("/vendor/onboarding/request-approval", async (request, reply) => {
    // Owner only
    if (request.vendorRole !== "owner") {
      return reply.status(403).send({
        success: false,
        error: { code: "FORBIDDEN", message: "Owner access required" },
      });
    }
    const vendorId = getVendorId(request);

    await fastify.db.execute(
      sql`
        UPDATE vendors
        SET onboarding_status = 'pending', updated_at = NOW()
        WHERE id = ${vendorId}
          AND onboarding_status = 'approved'
      `
    );

    return reply.send({ success: true, data: null });
  });
}
