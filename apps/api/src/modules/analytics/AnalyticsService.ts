import { eq, sql, and, gte } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { SettingsService } from "../settings/SettingsService.js";
import {
  vendorCommissionEntries,
  vendorOrders,
  vendorPayouts,
  vendorPayoutInfo,
  orders,
  inventoryItems,
  products,
  categories,
  vendors,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

export type AnalyticsPeriod = "7d" | "30d" | "90d";

export interface VendorEarningsSummary {
  totalEarnedMinor: number;
  totalReversedMinor: number;
  netCommissionMinor: number;
  totalSettledMinor: number;
  outstandingBalanceMinor: number;
}

export interface CommissionLedgerEntry {
  id: string;
  vendorOrderId: string;
  orderDisplayId: string;
  status: "earned" | "reversed";
  ratePercent: number;
  subtotalMinor: number;
  commissionAmountMinor: number;
  createdAt: string;
}

export interface SettlementRecord {
  id: string;
  amountMinor: number;
  settlementReference: string;
  note: string | null;
  settledAt: string;
}

export interface VendorEarningsResponse {
  summary: VendorEarningsSummary;
  commissionEntries: CommissionLedgerEntry[];
  settlements: SettlementRecord[];
}

export interface AdminVendorPayoutResponse extends VendorEarningsResponse {
  payoutInfo: {
    accountHolderName: string;
    bankAccountNumber: string;
    ifscOrRoutingCode: string;
    bankName: string;
  } | null;
}

export interface LowStockProduct {
  productId: string;
  name: string;
  quantityAvailable: number;
}

export interface VendorDashboardSummary {
  ordersCount: number;
  grossSalesMinor: number;
  netEarningsMinor: number;
  outstandingBalanceMinor: number;
  lowStockCount: number;
  lowStockProducts: LowStockProduct[];
}

export interface AdminAnalyticsSummary {
  gmvMinor: number;
  ordersCount: number;
  activeVendors: number;
  newCustomers: number;
  commissionEarnedMinor: number;
  pendingPayoutsMinor: number;
}

export interface OrdersByDayPoint {
  date: string;
  ordersCount: number;
  gmvMinor: number;
}

export interface TopVendorByGmv {
  vendorId: string;
  name: string;
  gmvMinor: number;
}

export interface GmvByCategoryPoint {
  categoryId: string;
  name: string;
  gmvMinor: number;
}

export interface AdminChartsResponse {
  ordersByDay: OrdersByDayPoint[];
  topVendorsByGmv: TopVendorByGmv[];
  gmvByCategory: GmvByCategoryPoint[];
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

const DEFAULT_LOW_STOCK_THRESHOLD = 5;

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface AnalyticsServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  settingsService: SettingsService;
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/**
 * Convert period string to PostgreSQL interval expression.
 * Period maps to: `NOW() - INTERVAL '7 days'` etc.
 */
function periodToInterval(period: AnalyticsPeriod): string {
  switch (period) {
    case "7d": return "7 days";
    case "30d": return "30 days";
    case "90d": return "90 days";
    default: return "30 days";
  }
}

/**
 * Compute the cutoff date for a given period.
 */
function periodCutoff(period: AnalyticsPeriod): Date {
  const days = period === "7d" ? 7 : period === "90d" ? 90 : 30;
  return new Date(Date.now() - days * 24 * 60 * 60 * 1000);
}

// ---------------------------------------------------------------------------
// AnalyticsService
// ---------------------------------------------------------------------------

/**
 * AnalyticsService
 *
 * Computes vendor earnings, vendor dashboard KPIs, admin analytics summary,
 * and admin chart data using SQL aggregation (CTEs/grouped queries).
 *
 * Key contracts:
 * - Outstanding balance = SUM(earned) - SUM(reversed) - SUM(vendor_payouts) (D-08, D-09, Pattern 7)
 * - All money aggregation uses SQL SUM — never JS .reduce() on large datasets (Pitfall 1)
 * - Period filter: 7d / 30d / 90d mapped to a created_at >= cutoff clause
 * - Low stock threshold from SettingsService (key: 'low_stock_threshold'), default 5
 *
 * Covers MKT-05, VEN-02, ADM-01, D-08, D-09, D-10.
 */
export class AnalyticsService {
  constructor(private deps: AnalyticsServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get vendor earnings summary + commission entries + settlement records (D-09, MKT-05).
   *
   * Outstanding balance formula (D-08):
   *   outstanding = SUM(earned entries) - SUM(reversed entries) - SUM(vendor_payouts)
   *
   * Uses SQL SUM aggregation — not JS reduce (Pitfall 1, MKT-05).
   */
  async getVendorEarnings(vendorId: string): Promise<VendorEarningsResponse> {
    const { db } = this.deps;

    // ── 1. Earnings summary aggregation (earned + reversed + settled in one query) ─
    // Pattern 7 (06-RESEARCH.md): outstanding = earned - reversed - settled
    // Uses a correlated subquery for total settled to keep it in one DB round-trip
    const summaryRows = await db
      .select({
        totalEarnedMinor: sql<number>`COALESCE(SUM(CASE WHEN ${vendorCommissionEntries.status} = 'earned' THEN ${vendorCommissionEntries.commissionAmountMinor} ELSE 0 END), 0)`.as("total_earned_minor"),
        totalReversedMinor: sql<number>`COALESCE(SUM(CASE WHEN ${vendorCommissionEntries.status} = 'reversed' THEN ${vendorCommissionEntries.commissionAmountMinor} ELSE 0 END), 0)`.as("total_reversed_minor"),
        totalSettledMinor: sql<number>`COALESCE((SELECT SUM(amount_minor) FROM vendor_payouts WHERE vendor_id = ${vendorId}), 0)`.as("total_settled_minor"),
      })
      .from(vendorCommissionEntries)
      .innerJoin(vendorOrders, eq(vendorCommissionEntries.vendorOrderId, vendorOrders.id))
      .where(eq(vendorOrders.vendorId, vendorId))
      .limit(1);

    const totalEarned = Number(summaryRows[0]?.totalEarnedMinor ?? 0);
    const totalReversed = Number(summaryRows[0]?.totalReversedMinor ?? 0);
    const totalSettled = Number(summaryRows[0]?.totalSettledMinor ?? 0);
    const netCommission = totalEarned - totalReversed;
    const outstanding = netCommission - totalSettled;

    const summary: VendorEarningsSummary = {
      totalEarnedMinor: totalEarned,
      totalReversedMinor: totalReversed,
      netCommissionMinor: netCommission,
      totalSettledMinor: totalSettled,
      outstandingBalanceMinor: outstanding,
    };

    // ── 3. Commission ledger entries ─────────────────────────────────────────
    const commissionRows = await db
      .select({
        id: vendorCommissionEntries.id,
        vendorOrderId: vendorCommissionEntries.vendorOrderId,
        orderDisplayId: sql<string>`COALESCE(${orders.displayId}, '')`.as("order_display_id"),
        status: vendorCommissionEntries.status,
        ratePercent: vendorCommissionEntries.ratePercent,
        subtotalMinor: vendorCommissionEntries.orderSubtotalMinor,
        commissionAmountMinor: vendorCommissionEntries.commissionAmountMinor,
        createdAt: vendorCommissionEntries.createdAt,
      })
      .from(vendorCommissionEntries)
      .innerJoin(vendorOrders, eq(vendorCommissionEntries.vendorOrderId, vendorOrders.id))
      .innerJoin(orders, eq(vendorOrders.orderId, orders.id))
      .where(eq(vendorOrders.vendorId, vendorId))
      .limit(200);

    const commissionEntries: CommissionLedgerEntry[] = commissionRows.map((r) => ({
      id: r.id,
      vendorOrderId: r.vendorOrderId,
      orderDisplayId: r.orderDisplayId,
      status: r.status as "earned" | "reversed",
      ratePercent: Number(r.ratePercent),
      subtotalMinor: Number(r.subtotalMinor),
      commissionAmountMinor: Number(r.commissionAmountMinor),
      createdAt: r.createdAt.toISOString(),
    }));

    // ── 4. Settlement records ────────────────────────────────────────────────
    const settlementRows = await db
      .select()
      .from(vendorPayouts)
      .where(eq(vendorPayouts.vendorId, vendorId))
      .limit(200);

    const settlements: SettlementRecord[] = settlementRows.map((r) => ({
      id: r.id,
      amountMinor: Number(r.amountMinor),
      settlementReference: r.settlementReference,
      note: r.note ?? null,
      settledAt: r.settledAt.toISOString(),
    }));

    return { summary, commissionEntries, settlements };
  }

  /**
   * Get admin payout view for a vendor (D-08, MKT-04).
   *
   * Same as getVendorEarnings but adds the vendor's bank details as `payoutInfo`
   * for the admin to reference during manual settlement (read-only).
   */
  async getAdminVendorPayout(vendorId: string): Promise<AdminVendorPayoutResponse> {
    const { db } = this.deps;

    const earnings = await this.getVendorEarnings(vendorId);

    // Load payout info (bank details — admin view, read-only)
    const payoutInfoRows = await db
      .select({
        accountHolderName: vendorPayoutInfo.accountHolderName,
        bankAccountNumber: vendorPayoutInfo.bankAccountNumber,
        ifscOrRoutingCode: vendorPayoutInfo.ifscOrRoutingCode,
        bankName: vendorPayoutInfo.bankName,
      })
      .from(vendorPayoutInfo)
      .where(eq(vendorPayoutInfo.vendorId, vendorId))
      .limit(1);

    const payoutInfoData = payoutInfoRows[0] ?? null;

    return {
      ...earnings,
      payoutInfo: payoutInfoData,
    };
  }

  /**
   * Get vendor dashboard KPIs for a given period (VEN-02, D-10 adapted).
   *
   * Returns: ordersCount, grossSalesMinor, netEarningsMinor, outstandingBalanceMinor,
   *          lowStockCount, lowStockProducts (up to 5 for widget).
   *
   * Low stock threshold from SettingsService('low_stock_threshold'), default 5.
   */
  async getVendorDashboard(vendorId: string, period: AnalyticsPeriod): Promise<VendorDashboardSummary> {
    const { db, settingsService } = this.deps;

    const cutoff = periodCutoff(period);

    // ── 1. KPI aggregation ───────────────────────────────────────────────────
    const kpiRows = await db
      .select({
        ordersCount: sql<number>`COUNT(DISTINCT ${vendorOrders.id})`.as("orders_count"),
        grossSalesMinor: sql<number>`COALESCE(SUM(${vendorOrders.vendorSubtotalMinor}), 0)`.as("gross_sales_minor"),
      })
      .from(vendorOrders)
      .where(
        and(
          eq(vendorOrders.vendorId, vendorId),
          gte(vendorOrders.createdAt, cutoff)
        )
      )
      .limit(1);

    const ordersCount = Number(kpiRows[0]?.ordersCount ?? 0);
    const grossSalesMinor = Number(kpiRows[0]?.grossSalesMinor ?? 0);

    // ── 2. Earnings for net earnings and outstanding balance ─────────────────
    const earningsSummaryRows = await db
      .select({
        totalEarnedMinor: sql<number>`COALESCE(SUM(CASE WHEN ${vendorCommissionEntries.status} = 'earned' THEN ${vendorCommissionEntries.commissionAmountMinor} ELSE 0 END), 0)`.as("total_earned"),
        totalReversedMinor: sql<number>`COALESCE(SUM(CASE WHEN ${vendorCommissionEntries.status} = 'reversed' THEN ${vendorCommissionEntries.commissionAmountMinor} ELSE 0 END), 0)`.as("total_reversed"),
        totalSettledMinor: sql<number>`COALESCE((SELECT SUM(amount_minor) FROM vendor_payouts WHERE vendor_id = ${vendorId}), 0)`.as("total_settled"),
      })
      .from(vendorCommissionEntries)
      .innerJoin(vendorOrders, eq(vendorCommissionEntries.vendorOrderId, vendorOrders.id))
      .where(eq(vendorOrders.vendorId, vendorId))
      .limit(1);

    const totalEarned = Number(earningsSummaryRows[0]?.totalEarnedMinor ?? 0);
    const totalReversed = Number(earningsSummaryRows[0]?.totalReversedMinor ?? 0);
    const totalSettled = Number(earningsSummaryRows[0]?.totalSettledMinor ?? 0);
    const netEarningsMinor = totalEarned - totalReversed;
    const outstandingBalanceMinor = netEarningsMinor - totalSettled;

    // ── 3. Low stock products ────────────────────────────────────────────────
    // Get threshold from settings, fall back to 5 (D-15, VEN-02)
    const thresholdSetting = await settingsService.getSetting("low_stock_threshold");
    const lowStockThreshold = typeof thresholdSetting === "number"
      ? thresholdSetting
      : DEFAULT_LOW_STOCK_THRESHOLD;

    const lowStockRows = await db
      .select({
        productId: products.id,
        name: products.name,
        quantityAvailable: inventoryItems.quantityAvailable,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .where(
        and(
          eq(products.vendorId, vendorId),
          sql`${inventoryItems.quantityAvailable} <= ${lowStockThreshold}`
        )
      )
      .limit(5); // dashboard widget shows top 5

    const lowStockProducts: LowStockProduct[] = lowStockRows.map((r) => ({
      productId: r.productId,
      name: r.name,
      quantityAvailable: r.quantityAvailable,
    }));

    return {
      ordersCount,
      grossSalesMinor,
      netEarningsMinor,
      outstandingBalanceMinor,
      lowStockCount: lowStockProducts.length,
      lowStockProducts,
    };
  }

  /**
   * Get admin dashboard summary KPIs for a given period (ADM-01, D-10).
   *
   * Returns: gmvMinor, ordersCount, activeVendors, newCustomers,
   *          commissionEarnedMinor, pendingPayoutsMinor (sum of outstanding across all vendors).
   *
   * All computed on-demand — no materialized views in v1 (D-10).
   */
  async getAdminSummary(period: AnalyticsPeriod): Promise<AdminAnalyticsSummary> {
    const { db } = this.deps;

    const cutoff = periodCutoff(period);

    // ── Single comprehensive KPI query ────────────────────────────────────────
    // Combines GMV, orders, active vendors, new customers (subquery), commission earned
    // into a single DB round-trip using correlated subqueries (ADM-01, D-10).
    const summaryRows = await db
      .select({
        gmvMinor: sql<number>`COALESCE(SUM(${vendorOrders.vendorSubtotalMinor}), 0)`.as("gmv_minor"),
        ordersCount: sql<number>`COUNT(DISTINCT ${orders.id})`.as("orders_count"),
        activeVendors: sql<number>`COUNT(DISTINCT ${vendorOrders.vendorId})`.as("active_vendors"),
        newCustomers: sql<number>`COALESCE((SELECT COUNT(*) FROM customers WHERE created_at >= ${cutoff.toISOString()}), 0)`.as("new_customers"),
        commissionEarnedMinor: sql<number>`COALESCE(SUM(CASE WHEN ${vendorCommissionEntries.status} = 'earned' THEN ${vendorCommissionEntries.commissionAmountMinor} ELSE 0 END), 0)`.as("commission_earned_minor"),
      })
      .from(vendorOrders)
      .innerJoin(orders, eq(vendorOrders.orderId, orders.id))
      .innerJoin(
        vendorCommissionEntries,
        eq(vendorCommissionEntries.vendorOrderId, vendorOrders.id)
      )
      .where(gte(vendorOrders.createdAt, cutoff))
      .limit(1);

    // ── Pending payouts (outstanding balance sum across all vendors) ──────────
    // outstanding_per_vendor = SUM(earned) - SUM(reversed) - SUM(vendor_payouts)
    const pendingRows = await db
      .select({
        pendingPayoutsMinor: sql<number>`
          COALESCE(
            (
              SELECT SUM(net_balance)
              FROM (
                SELECT
                  vo2.vendor_id,
                  SUM(CASE WHEN vce2.status = 'earned' THEN vce2.commission_amount_minor ELSE 0 END) -
                  SUM(CASE WHEN vce2.status = 'reversed' THEN vce2.commission_amount_minor ELSE 0 END) -
                  COALESCE((
                    SELECT SUM(vp.amount_minor)
                    FROM vendor_payouts vp
                    WHERE vp.vendor_id = vo2.vendor_id
                  ), 0) AS net_balance
                FROM vendor_commission_entries vce2
                JOIN vendor_orders vo2 ON vce2.vendor_order_id = vo2.id
                GROUP BY vo2.vendor_id
              ) AS per_vendor_balances
            ),
            0
          )
        `.as("pending_payouts_minor"),
      })
      .from(vendorCommissionEntries)
      .limit(1);

    return {
      gmvMinor: Number(summaryRows[0]?.gmvMinor ?? 0),
      ordersCount: Number(summaryRows[0]?.ordersCount ?? 0),
      activeVendors: Number(summaryRows[0]?.activeVendors ?? 0),
      newCustomers: Number(summaryRows[0]?.newCustomers ?? 0),
      commissionEarnedMinor: Number(summaryRows[0]?.commissionEarnedMinor ?? 0),
      pendingPayoutsMinor: Number(pendingRows[0]?.pendingPayoutsMinor ?? 0),
    };
  }

  /**
   * Get admin chart data: orders-by-day, top vendors by GMV, GMV by category (ADM-01, D-10).
   */
  async getAdminCharts(period: AnalyticsPeriod): Promise<AdminChartsResponse> {
    const { db } = this.deps;

    const cutoff = periodCutoff(period);
    const intervalStr = periodToInterval(period);

    // ── 1. Orders by day ─────────────────────────────────────────────────────
    const ordersByDayRows = await db
      .select({
        date: sql<string>`DATE(${orders.createdAt})::text`.as("date"),
        ordersCount: sql<number>`COUNT(*)`.as("orders_count"),
        gmvMinor: sql<number>`COALESCE(SUM(${vendorOrders.vendorSubtotalMinor}), 0)`.as("gmv_minor"),
      })
      .from(orders)
      .innerJoin(vendorOrders, eq(vendorOrders.orderId, orders.id))
      .where(gte(orders.createdAt, cutoff))
      .limit(Number(intervalStr.split(" ")[0]) + 1); // one row per day

    // ── 2. Top 5 vendors by GMV ──────────────────────────────────────────────
    const topVendorsRows = await db
      .select({
        vendorId: vendorOrders.vendorId,
        name: sql<string>`COALESCE(${vendors.storeName}, ${vendors.name})`.as("name"),
        gmvMinor: sql<number>`COALESCE(SUM(${vendorOrders.vendorSubtotalMinor}), 0)`.as("gmv_minor"),
      })
      .from(vendorOrders)
      .innerJoin(vendors, eq(vendors.id, vendorOrders.vendorId))
      .where(gte(vendorOrders.createdAt, cutoff))
      .limit(5);

    // ── 3. GMV by category ───────────────────────────────────────────────────
    const gmvByCategoryRows = await db
      .select({
        categoryId: categories.id,
        name: categories.name,
        gmvMinor: sql<number>`COALESCE(SUM(${vendorOrders.vendorSubtotalMinor}), 0)`.as("gmv_minor"),
      })
      .from(vendorOrders)
      .innerJoin(orders, eq(orders.id, vendorOrders.orderId))
      .innerJoin(products, eq(products.vendorId, vendorOrders.vendorId))
      .innerJoin(categories, eq(products.categoryId, categories.id))
      .where(gte(vendorOrders.createdAt, cutoff))
      .limit(20);

    return {
      ordersByDay: ordersByDayRows.map((r) => ({
        date: r.date,
        ordersCount: Number(r.ordersCount),
        gmvMinor: Number(r.gmvMinor),
      })),
      topVendorsByGmv: topVendorsRows.map((r) => ({
        vendorId: r.vendorId,
        name: r.name,
        gmvMinor: Number(r.gmvMinor),
      })),
      gmvByCategory: gmvByCategoryRows.map((r) => ({
        categoryId: r.categoryId,
        name: r.name,
        gmvMinor: Number(r.gmvMinor),
      })),
    };
  }
}
