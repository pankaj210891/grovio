import { describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// VendorManagementService tests — ADM-02, D-17
//
// TDD: tests define expected behavior.
// All DB interactions are mocked; no live infrastructure required.
//
// Key assertions:
// - approveVendor sets onboarding_status='approved' and audits 'vendor.approved'
// - suspendVendor sets onboarding_status='suspended' and audits 'vendor.suspended'
// - reinstateVendor sets onboarding_status='approved' and audits 'vendor.reinstated'
// - configureVendor replaces restrictions + upserts commission override + audits
// - listVendors returns paginated result shape
// ---------------------------------------------------------------------------

import { VendorManagementService } from "./VendorManagementService.js";

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const VENDOR_ID = "vendor-uuid-1";
const ADMIN_EMAIL = "admin@example.com";
const ADMIN_IP = "127.0.0.1";

const vendorRow = {
  id: VENDOR_ID,
  onboardingStatus: "pending",
  email: "vendor@example.com",
  name: "Test Vendor",
  storeName: null,
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeAuditServiceMock() {
  return {
    log: vi.fn().mockResolvedValue(undefined),
  };
}

/**
 * Build a flexible Drizzle DB mock.
 * - select() → chain for vendor row lookup (first call)
 * - update().set().where() → resolves OK
 * - insert().values() → resolves OK
 * - delete().where() → resolves OK
 */
function makeDbMock(overrides: {
  selectVendorRows?: unknown[];
  selectRestrictionRows?: unknown[];
  selectCommissionRuleRows?: unknown[];
  countRows?: unknown[];
  selectListRows?: unknown[];
} = {}) {
  const vendorRows = overrides.selectVendorRows ?? [vendorRow];
  const restrictionRows = overrides.selectRestrictionRows ?? [];
  const commissionRuleRows = overrides.selectCommissionRuleRows ?? [];
  const countRows = overrides.countRows ?? [{ total: 0 }];
  const listRows = overrides.selectListRows ?? [];

  let selectCallCount = 0;

  // We need to return different results for different select() calls:
  // Call 1: loadVendor → vendor row
  // Call 2 (configureVendor): beforeRestrictions → restriction rows
  // Call 3 (configureVendor): existing commission rules → commission rule rows
  // Call 4 (listVendors): count → count rows
  // Call 5 (listVendors): list rows

  const selectMock = vi.fn().mockImplementation(() => {
    const callIdx = selectCallCount++;
    const resultSets = [vendorRows, restrictionRows, commissionRuleRows, countRows, listRows];
    const rows = resultSets[callIdx] ?? [];

    return {
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
          orderBy: vi.fn().mockReturnValue({
            limit: vi.fn().mockReturnValue({
              offset: vi.fn().mockResolvedValue(rows),
            }),
          }),
          // Make where itself awaitable for queries without extra chaining
          then: (resolve: (v: unknown[]) => void) => resolve(rows),
          catch: vi.fn(),
          finally: vi.fn(),
        }),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockReturnValue({
            offset: vi.fn().mockResolvedValue(rows),
          }),
        }),
      }),
    };
  });

  const updateSetWhereMock = vi.fn().mockResolvedValue([]);
  const updateSetMock = vi.fn().mockReturnValue({ where: updateSetWhereMock });
  const updateMock = vi.fn().mockReturnValue({ set: updateSetMock });

  const insertValuesMock = vi.fn().mockResolvedValue([{ id: "new-id" }]);
  const insertMock = vi.fn().mockReturnValue({ values: insertValuesMock });

  const deleteWhereMock = vi.fn().mockResolvedValue([]);
  const deleteMock = vi.fn().mockReturnValue({ where: deleteWhereMock });

  return {
    select: selectMock,
    update: updateMock,
    insert: insertMock,
    delete: deleteMock,
    _updateSetMock: updateSetMock,
    _insertValuesMock: insertValuesMock,
    _deleteWhereMock: deleteWhereMock,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VendorManagementService", () => {
  describe("approveVendor()", () => {
    it("sets onboarding_status to 'approved'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.approveVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(db.update).toHaveBeenCalled();
      expect(db._updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingStatus: "approved" })
      );
    });

    it("calls auditService.log with action 'vendor.approved'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.approveVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "vendor.approved", entityId: VENDOR_ID })
      );
    });
  });

  describe("suspendVendor()", () => {
    it("sets onboarding_status to 'suspended'", async () => {
      const db = makeDbMock({
        selectVendorRows: [{ ...vendorRow, onboardingStatus: "approved" }],
      });
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.suspendVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(db._updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingStatus: "suspended" })
      );
    });

    it("calls auditService.log with action 'vendor.suspended'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.suspendVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "vendor.suspended", entityId: VENDOR_ID })
      );
    });
  });

  describe("reinstateVendor()", () => {
    it("sets onboarding_status back to 'approved'", async () => {
      const db = makeDbMock({
        selectVendorRows: [{ ...vendorRow, onboardingStatus: "suspended" }],
      });
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.reinstateVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(db._updateSetMock).toHaveBeenCalledWith(
        expect.objectContaining({ onboardingStatus: "approved" })
      );
    });

    it("calls auditService.log with action 'vendor.reinstated'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.reinstateVendor(VENDOR_ID, ADMIN_EMAIL, ADMIN_IP);

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "vendor.reinstated", entityId: VENDOR_ID })
      );
    });
  });

  describe("configureVendor()", () => {
    it("calls auditService.log with action 'vendor.configured'", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.configureVendor(
        VENDOR_ID,
        { categoryRestrictionIds: [], commissionOverridePercent: null },
        ADMIN_EMAIL
      );

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: "vendor.configured", entityId: VENDOR_ID })
      );
    });

    it("deletes existing category restrictions and inserts new ones when IDs provided", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.configureVendor(
        VENDOR_ID,
        {
          categoryRestrictionIds: ["cat-uuid-1", "cat-uuid-2"],
          commissionOverridePercent: null,
        },
        ADMIN_EMAIL
      );

      // delete is called for existing restrictions
      expect(db.delete).toHaveBeenCalled();
      expect(db._deleteWhereMock).toHaveBeenCalled();
      // insert is called for new restrictions (2 category IDs)
      expect(db._insertValuesMock).toHaveBeenCalledWith(
        expect.arrayContaining([
          expect.objectContaining({ categoryId: "cat-uuid-1", vendorId: VENDOR_ID }),
          expect.objectContaining({ categoryId: "cat-uuid-2", vendorId: VENDOR_ID }),
        ])
      );
    });

    it("only deletes restrictions (no insert) when empty categoryRestrictionIds", async () => {
      const db = makeDbMock();
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      await svc.configureVendor(
        VENDOR_ID,
        { categoryRestrictionIds: [], commissionOverridePercent: null },
        ADMIN_EMAIL
      );

      // delete is called to clear existing restrictions
      expect(db.delete).toHaveBeenCalled();
      // insert is NOT called (empty list)
      expect(db.insert).not.toHaveBeenCalled();
    });
  });

  describe("listVendors()", () => {
    it("returns items, total, limit and offset", async () => {
      const db = makeDbMock({
        countRows: [{ total: 2 }],
        selectListRows: [
          { ...vendorRow, id: "v1" },
          { ...vendorRow, id: "v2" },
        ],
      });
      const auditService = makeAuditServiceMock();
      const svc = new VendorManagementService({ db: db as never, auditService: auditService as never });

      const result = await svc.listVendors({ limit: 10, offset: 0 });

      expect(result).toHaveProperty("items");
      expect(result).toHaveProperty("total");
      expect(result).toHaveProperty("limit", 10);
      expect(result).toHaveProperty("offset", 0);
    });
  });
});
