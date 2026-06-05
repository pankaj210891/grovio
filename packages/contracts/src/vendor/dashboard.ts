import { z } from "zod";

/**
 * Vendor dashboard summary contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per D-10 (adapted for vendor): Vendor dashboard shows metrics for selectable
 *   periods: 7d / 30d / 90d (default 30d).
 *
 * Per VEN-02: Vendor dashboard overview with KPIs and low-stock alerts.
 *
 * Per D-15 (VEN-03): Low-stock alerts: products where
 *   inventory_items.quantity_available <= low_stock_threshold
 *   (configurable via marketplace_settings, default 5).
 *
 * Per Pitfall 1: All money fields are minor currency units (integer z.number()).
 *   Named with *Minor suffix.
 */

// ---------------------------------------------------------------------------
// Dashboard Period (VEN-02, D-10)
// ---------------------------------------------------------------------------

/**
 * Time period selector for vendor dashboard metrics.
 * Matches the admin analytics period enum.
 */
export const VendorDashboardPeriodSchema = z.enum(["7d", "30d", "90d"]);

/** TypeScript type inferred from VendorDashboardPeriodSchema */
export type VendorDashboardPeriod = z.infer<typeof VendorDashboardPeriodSchema>;

// ---------------------------------------------------------------------------
// Low Stock Product (VEN-02, D-15)
// ---------------------------------------------------------------------------

/**
 * A single product entry in the low-stock alerts list.
 */
export const LowStockProductSchema = z.object({
  /** Product UUID */
  productId: z.string().uuid(),
  /** Product display name */
  name: z.string(),
  /** Current available quantity */
  quantityAvailable: z.number().int(),
});

/** TypeScript type inferred from LowStockProductSchema */
export type LowStockProduct = z.infer<typeof LowStockProductSchema>;

// ---------------------------------------------------------------------------
// Vendor Dashboard Summary (VEN-02, D-10 adapted)
// ---------------------------------------------------------------------------

/**
 * Vendor dashboard KPI summary.
 * Returned by GET /vendor/dashboard?period=30d.
 *
 * All money fields are minor currency units (integers).
 */
export const VendorDashboardSummarySchema = z.object({
  /** Total number of orders for this vendor in the selected period */
  ordersCount: z.number().int(),
  /**
   * Gross sales revenue in minor currency units (sum of vendor sub-order subtotals).
   */
  grossSalesMinor: z.number().int(),
  /**
   * Net earnings after commission deduction in minor currency units.
   * grossSalesMinor - netCommissionMinor (from commission entries)
   */
  netEarningsMinor: z.number().int(),
  /**
   * Outstanding balance owed by admin to this vendor in minor currency units.
   * Mirrors VendorEarningsSummary.outstandingBalanceMinor.
   */
  outstandingBalanceMinor: z.number().int(),
  /**
   * Number of products currently below the low-stock threshold.
   */
  lowStockCount: z.number().int(),
  /**
   * Products below the low-stock threshold (up to 5 for dashboard widget).
   * Full low-stock list is available via the Inventory & Pricing page.
   */
  lowStockProducts: z.array(LowStockProductSchema),
});

/** TypeScript type inferred from VendorDashboardSummarySchema */
export type VendorDashboardSummary = z.infer<typeof VendorDashboardSummarySchema>;
