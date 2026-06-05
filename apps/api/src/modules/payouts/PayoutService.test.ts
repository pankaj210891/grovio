import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// PayoutService tests — MKT-04, D-07, T-06-20, Pitfall 5
//
// TDD RED: tests written first to define expected behavior.
// Key assertions:
// - recordSettlement converts decimal string to minor units: "5000.00" → 500000
// - recordSettlement only INSERTs (append-only, no UPDATE)
// - recordSettlement rejects amount <= 0
// - recordSettlement writes audit 'payout.settled'
// - recordSettlement never reads `amountMinor` from input
// - getVendorPayout delegates to analyticsService.getAdminVendorPayout
// ---------------------------------------------------------------------------

import { PayoutService } from "./PayoutService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

const VENDOR_ID = "vendor-uuid-1";
const ADMIN_EMAIL = "admin@example.com";

function makeAuditServiceMock() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

function makeAnalyticsServiceMock() {
  return {
    getAdminVendorPayout: vi.fn().mockResolvedValue({
      summary: {
        totalEarnedMinor: 100000,
        totalReversedMinor: 0,
        netCommissionMinor: 100000,
        totalSettledMinor: 50000,
        outstandingBalanceMinor: 50000,
      },
      commissionEntries: [],
      settlements: [],
      payoutInfo: null,
    }),
  };
}

function makeInsertValuesMock(returnValue = [{ id: "new-payout-id" }]) {
  return vi.fn().mockResolvedValue(returnValue);
}

function makeDbMock() {
  const insertValuesMock = makeInsertValuesMock();
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });
  return {
    insert: insertMock,
    _insertValuesMock: insertValuesMock,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("PayoutService", () => {
  describe("recordSettlement()", () => {
    it("converts decimal string '5000.00' to minor units 500000 (Pitfall 5)", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "5000.00", settlementReference: "REF-001" },
        ADMIN_EMAIL
      );

      // The insert should have been called with amountMinor = 500000
      expect(db._insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: 500000 })
      );
    });

    it("converts decimal string '1.00' to minor units 100", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "1.00", settlementReference: "REF-002" },
        ADMIN_EMAIL
      );

      expect(db._insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: 100 })
      );
    });

    it("converts decimal string '999.99' to minor units 99999 (Math.round verification)", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "999.99", settlementReference: "REF-003" },
        ADMIN_EMAIL
      );

      expect(db._insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ amountMinor: 99999 })
      );
    });

    it("only calls INSERT (append-only — no UPDATE) — insert is called once", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "1000.00", settlementReference: "REF-004" },
        ADMIN_EMAIL
      );

      // Must insert into vendorPayouts table
      expect(db.insert).toHaveBeenCalledTimes(1);
      // No update method on db (it is not in the mock)
      expect((db as { update?: unknown }).update).toBeUndefined();
    });

    it("calls auditService.log with action 'payout.settled'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "2500.00", settlementReference: "REF-005" },
        ADMIN_EMAIL
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "payout.settled", entityId: VENDOR_ID })
      );
    });

    it("rejects amount '0' (non-positive amounts must be rejected)", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await expect(
        svc.recordSettlement(
          VENDOR_ID,
          { amount: "0", settlementReference: "REF-006" },
          ADMIN_EMAIL
        )
      ).rejects.toThrow();
    });

    it("rejects negative amount '-100.00'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await expect(
        svc.recordSettlement(
          VENDOR_ID,
          { amount: "-100.00", settlementReference: "REF-007" },
          ADMIN_EMAIL
        )
      ).rejects.toThrow();
    });

    it("stores settledByAdminEmail on the insert row", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      await svc.recordSettlement(
        VENDOR_ID,
        { amount: "100.00", settlementReference: "REF-008" },
        ADMIN_EMAIL
      );

      expect(db._insertValuesMock).toHaveBeenCalledWith(
        expect.objectContaining({ settledByAdminEmail: ADMIN_EMAIL })
      );
    });
  });

  describe("getVendorPayout()", () => {
    it("delegates to analyticsService.getAdminVendorPayout", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const analyticsService = makeAnalyticsServiceMock();
      const svc = new PayoutService({
        db: db as never,
        auditService: auditService as never,
        analyticsService: analyticsService as never,
      });

      const result = await svc.getVendorPayout(VENDOR_ID);

      expect(analyticsService.getAdminVendorPayout).toHaveBeenCalledWith(VENDOR_ID);
      expect(result).toHaveProperty("summary");
    });
  });
});
