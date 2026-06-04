import { z } from "zod";

/**
 * Admin analytics contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-01, D-10: Admin dashboard metrics for selectable periods: 7d / 30d / 90d.
 *   Metrics computed on-demand server-side via GET /admin/analytics/summary?period=30d.
 *   No materialized views in v1 — manual refresh only (no polling/websocket).
 *
 * Dashboard charts:
 *   - Orders by day line chart (last N days)
 *   - Top 5 vendors by GMV table
 *   - GMV by category bar chart
 *
 * Per Pitfall 1: All money fields are BIGINT minor units (integer z.number()).
 *   Named with *Minor suffix.
 */

// ---------------------------------------------------------------------------
// Analytics Period (D-10, ADM-01)
// ---------------------------------------------------------------------------

/**
 * Time period selector for admin analytics metrics.
 * Default period: 30d (as per D-10).
 */
export const AnalyticsPeriodSchema = z.enum(["7d", "30d", "90d"]);

/** TypeScript type inferred from AnalyticsPeriodSchema */
export type AnalyticsPeriod = z.infer<typeof AnalyticsPeriodSchema>;

// ---------------------------------------------------------------------------
// Admin Analytics Summary (D-10, ADM-01)
// ---------------------------------------------------------------------------

/**
 * Top-level KPI summary for the admin dashboard.
 * Returned as part of AdminAnalyticsResponse.
 *
 * All money fields are minor currency units (integers).
 */
export const AdminAnalyticsSummarySchema = z.object({
  /**
   * Gross merchandise value in the selected period (minor units).
   * Sum of all vendor sub-order subtotals for finalized orders.
   */
  gmvMinor: z.number().int(),
  /** Total number of orders placed in the selected period */
  ordersCount: z.number().int(),
  /**
   * Number of vendors with at least one finalized order in the selected period.
   */
  activeVendors: z.number().int(),
  /**
   * Number of new customer accounts created in the selected period.
   */
  newCustomers: z.number().int(),
  /**
   * Total commission earned across all vendors in the selected period (minor units).
   * Sum of "earned" commission entries.
   */
  commissionEarnedMinor: z.number().int(),
  /**
   * Total outstanding balance across all vendors (minor units).
   * Sum of (netCommission - totalSettled) for all vendors.
   */
  pendingPayoutsMinor: z.number().int(),
});

/** TypeScript type inferred from AdminAnalyticsSummarySchema */
export type AdminAnalyticsSummary = z.infer<typeof AdminAnalyticsSummarySchema>;

// ---------------------------------------------------------------------------
// Chart Data Points (D-10, ADM-01)
// ---------------------------------------------------------------------------

/**
 * A single data point in the "Orders by day" line chart.
 * Covers the last N days based on the selected period.
 */
export const OrdersByDayPointSchema = z.object({
  /** ISO-8601 date (YYYY-MM-DD) */
  date: z.string(),
  /** Number of orders placed on this day */
  ordersCount: z.number().int(),
  /** GMV for this day in minor currency units */
  gmvMinor: z.number().int(),
});

/** TypeScript type inferred from OrdersByDayPointSchema */
export type OrdersByDayPoint = z.infer<typeof OrdersByDayPointSchema>;

/**
 * A single row in the "Top vendors by GMV" table.
 * Top 5 vendors ranked by GMV in the selected period.
 */
export const TopVendorByGmvSchema = z.object({
  /** Vendor UUID */
  vendorId: z.string().uuid(),
  /** Vendor store display name */
  name: z.string(),
  /** Vendor GMV in the selected period (minor units) */
  gmvMinor: z.number().int(),
});

/** TypeScript type inferred from TopVendorByGmvSchema */
export type TopVendorByGmv = z.infer<typeof TopVendorByGmvSchema>;

/**
 * A single bar in the "GMV by category" bar chart.
 */
export const GmvByCategoryPointSchema = z.object({
  /** Category UUID */
  categoryId: z.string().uuid(),
  /** Category display name */
  name: z.string(),
  /** Category GMV in the selected period (minor units) */
  gmvMinor: z.number().int(),
});

/** TypeScript type inferred from GmvByCategoryPointSchema */
export type GmvByCategoryPoint = z.infer<typeof GmvByCategoryPointSchema>;

// ---------------------------------------------------------------------------
// Admin Analytics Response (D-10, ADM-01)
// ---------------------------------------------------------------------------

/**
 * Full analytics response returned by GET /admin/analytics/summary?period=30d.
 * Combines the KPI summary with all chart data arrays.
 */
export const AdminAnalyticsResponseSchema = z.object({
  /** Top-level KPI summary metrics */
  summary: AdminAnalyticsSummarySchema,
  /** Orders + GMV by day (number of points = days in selected period) */
  ordersByDay: z.array(OrdersByDayPointSchema),
  /** Top 5 vendors by GMV in the selected period */
  topVendorsByGmv: z.array(TopVendorByGmvSchema),
  /** GMV breakdown by category in the selected period */
  gmvByCategory: z.array(GmvByCategoryPointSchema),
});

/** TypeScript type inferred from AdminAnalyticsResponseSchema */
export type AdminAnalyticsResponse = z.infer<typeof AdminAnalyticsResponseSchema>;
