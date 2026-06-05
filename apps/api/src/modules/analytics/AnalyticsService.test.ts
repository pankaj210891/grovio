import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeDbMock(queryResults?: Record<string, unknown[]>) {
  // A flexible mock that returns pre-set results for execute calls
  const chain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    groupBy: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockReturnThis(),
    then: vi.fn(),
    execute: vi.fn().mockResolvedValue([]),
  };

  // Make the chain thenable to support both await db.select().from()...  patterns
  // and direct query execution patterns

  const execResult = queryResults?.["default"] ?? [];
  chain.execute.mockResolvedValue(execResult);
  // The chain itself is awaitable
  (chain as unknown as Record<string, unknown>)[Symbol.iterator] = undefined;

  return {
    select: vi.fn().mockReturnValue(chain),
    execute: vi.fn().mockResolvedValue(execResult),
    _chain: chain,
    _setNextResult: (result: unknown[]) => {
      chain.execute.mockResolvedValueOnce(result);
      chain.limit.mockResolvedValueOnce(result);
    },
  };
}

function makeSettingsServiceMock() {
  return {
    getSetting: vi.fn().mockResolvedValue(null), // default: no setting (use default 5)
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AnalyticsService", () => {
  describe("getVendorEarnings", () => {
    it("computes outstanding balance = earned - reversed - settled", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();
      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock: earned=10000, reversed=2000, settled=3000 → outstanding=5000
      const earningsRows = [
        { totalEarnedMinor: 10000, totalReversedMinor: 2000, totalSettledMinor: 3000 },
      ];
      // Mock the earnings summary query
      db._chain.limit.mockResolvedValueOnce(earningsRows);

      // Mock empty entries and settlements for simplicity
      db._chain.limit.mockResolvedValueOnce([]); // commission entries
      db._chain.limit.mockResolvedValueOnce([]); // settlement records

      const result = await svc.getVendorEarnings("v-1");

      expect(result.summary.totalEarnedMinor).toBe(10000);
      expect(result.summary.totalReversedMinor).toBe(2000);
      expect(result.summary.totalSettledMinor).toBe(3000);
      expect(result.summary.netCommissionMinor).toBe(8000); // earned - reversed
      expect(result.summary.outstandingBalanceMinor).toBe(5000); // net - settled
    });
  });

  describe("getAdminVendorPayout", () => {
    it("includes payoutInfo field (read-only reference for admin)", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();
      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock earnings
      db._chain.limit.mockResolvedValueOnce([
        { totalEarnedMinor: 5000, totalReversedMinor: 0, totalSettledMinor: 0 },
      ]);
      db._chain.limit.mockResolvedValueOnce([]); // entries
      db._chain.limit.mockResolvedValueOnce([]); // settlements

      // Mock payout info
      db._chain.limit.mockResolvedValueOnce([
        {
          accountHolderName: "John Doe",
          bankAccountNumber: "1234567890",
          ifscOrRoutingCode: "HDFC0001",
          bankName: "HDFC",
        },
      ]);

      const result = await svc.getAdminVendorPayout("v-1");

      // Must include payoutInfo field
      expect(result).toHaveProperty("payoutInfo");
    });
  });

  describe("getVendorDashboard", () => {
    it("returns KPIs including lowStockProducts filtered by threshold", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();

      // Return low_stock_threshold = 3 from settings
      settingsService.getSetting.mockResolvedValue(3);

      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock KPI aggregation result
      db._chain.limit.mockResolvedValueOnce([
        { ordersCount: 10, grossSalesMinor: 50000 },
      ]);

      // Mock outstanding balance
      db._chain.limit.mockResolvedValueOnce([
        { totalEarnedMinor: 5000, totalReversedMinor: 500, totalSettledMinor: 1000 },
      ]);

      // Mock low stock products (quantity_available <= threshold)
      db._chain.limit.mockResolvedValueOnce([
        { productId: "p-1", name: "Widget A", quantityAvailable: 2 },
        { productId: "p-2", name: "Widget B", quantityAvailable: 1 },
      ]);

      const result = await svc.getVendorDashboard("v-1", "30d");

      expect(result.ordersCount).toBe(10);
      expect(result.grossSalesMinor).toBe(50000);
      expect(result.lowStockCount).toBe(2);
      expect(result.lowStockProducts).toHaveLength(2);
    });

    it("uses default low_stock_threshold of 5 when setting is null", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();
      settingsService.getSetting.mockResolvedValue(null); // no setting — use default 5

      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock all DB calls
      db._chain.limit.mockResolvedValueOnce([{ ordersCount: 5, grossSalesMinor: 25000 }]);
      db._chain.limit.mockResolvedValueOnce([{ totalEarnedMinor: 0, totalReversedMinor: 0, totalSettledMinor: 0 }]);
      db._chain.limit.mockResolvedValueOnce([]);

      const result = await svc.getVendorDashboard("v-1", "7d");

      // Should have used getSetting('low_stock_threshold')
      expect(settingsService.getSetting).toHaveBeenCalledWith("low_stock_threshold");
      expect(result.lowStockCount).toBe(0);
    });
  });

  describe("getAdminSummary", () => {
    it("returns required fields including pendingPayoutsMinor", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();
      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock main summary
      db._chain.limit.mockResolvedValueOnce([
        {
          gmvMinor: 100000,
          ordersCount: 50,
          activeVendors: 5,
          newCustomers: 10,
          commissionEarnedMinor: 10000,
        },
      ]);

      // Mock pending payouts (sum of outstanding across all vendors)
      db._chain.limit.mockResolvedValueOnce([
        { pendingPayoutsMinor: 7500 },
      ]);

      const result = await svc.getAdminSummary("30d");

      expect(result.gmvMinor).toBe(100000);
      expect(result.ordersCount).toBe(50);
      expect(result.pendingPayoutsMinor).toBe(7500);
    });
  });

  describe("getAdminCharts", () => {
    it("returns ordersByDay, topVendorsByGmv, gmvByCategory arrays", async () => {
      const { AnalyticsService } = await import("./AnalyticsService.js");

      const db = makeDbMock();
      const settingsService = makeSettingsServiceMock();
      const svc = new AnalyticsService({ db: db as never, settingsService: settingsService as never });

      // Mock ordersByDay
      db._chain.limit.mockResolvedValueOnce([
        { date: "2026-01-01", ordersCount: 5, gmvMinor: 10000 },
      ]);

      // Mock topVendorsByGmv
      db._chain.limit.mockResolvedValueOnce([
        { vendorId: "v-1", name: "Store A", gmvMinor: 50000 },
      ]);

      // Mock gmvByCategory
      db._chain.limit.mockResolvedValueOnce([
        { categoryId: "cat-1", name: "Electronics", gmvMinor: 30000 },
      ]);

      const result = await svc.getAdminCharts("30d");

      expect(result).toHaveProperty("ordersByDay");
      expect(result).toHaveProperty("topVendorsByGmv");
      expect(result).toHaveProperty("gmvByCategory");
      expect(Array.isArray(result.ordersByDay)).toBe(true);
      expect(Array.isArray(result.topVendorsByGmv)).toBe(true);
      expect(Array.isArray(result.gmvByCategory)).toBe(true);
    });
  });
});
