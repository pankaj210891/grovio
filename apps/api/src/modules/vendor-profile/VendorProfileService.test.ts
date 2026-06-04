import { beforeEach, describe, expect, it, vi, type Mock } from "vitest";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeDbMock() {
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  const insertChain = {
    values: vi.fn().mockReturnThis(),
    onConflictDoUpdate: vi.fn().mockResolvedValue([]),
    returning: vi.fn().mockResolvedValue([]),
  };
  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockResolvedValue([]),
  };
  return {
    select: vi.fn().mockReturnValue(selectChain),
    insert: vi.fn().mockReturnValue(insertChain),
    update: vi.fn().mockReturnValue(updateChain),
    _selectChain: selectChain,
    _insertChain: insertChain,
    _updateChain: updateChain,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VendorProfileService", () => {
  let db: ReturnType<typeof makeDbMock>;

  beforeEach(() => {
    db = makeDbMock();
    vi.clearAllMocks();
  });

  describe("getProfile", () => {
    it("selects store profile columns (not payout banking fields)", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([
        {
          id: "v-1",
          storeName: "My Store",
          storeDescription: "A fine store",
          logoUrl: null,
          bannerUrl: null,
          contactEmail: null,
          contactPhone: null,
          address: null,
          onboardingStatus: "approved",
        },
      ]);

      const profile = await svc.getProfile("v-1");

      // Must return store profile fields
      expect(profile).not.toBeNull();
      expect(profile?.storeName).toBe("My Store");
      expect(profile?.onboardingStatus).toBe("approved");

      // Must NOT include payout banking fields
      expect(profile).not.toHaveProperty("accountHolderName");
      expect(profile).not.toHaveProperty("bankAccountNumber");
      expect(profile).not.toHaveProperty("ifscOrRoutingCode");
      expect(profile).not.toHaveProperty("bankName");
    });

    it("returns null when vendor not found", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([]);
      const profile = await svc.getProfile("nonexistent");
      expect(profile).toBeNull();
    });
  });

  describe("updateProfile", () => {
    it("updates only allowed D-01 profile columns", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      await svc.updateProfile("v-1", { storeName: "New Name" });

      expect(db.update).toHaveBeenCalledOnce();
      const setArgs = db._updateChain.set.mock.calls[0]?.[0] as Record<string, unknown>;

      // Should include allowed field
      expect(setArgs).toHaveProperty("storeName", "New Name");

      // Should NOT include onboardingStatus (not modifiable by vendor)
      expect(setArgs).not.toHaveProperty("onboardingStatus");
    });
  });

  describe("getPayoutInfo", () => {
    it("returns payout info when row exists", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([
        {
          id: "pi-1",
          vendorId: "v-1",
          accountHolderName: "John Doe",
          bankAccountNumber: "1234567890",
          ifscOrRoutingCode: "HDFC0001234",
          bankName: "HDFC Bank",
          updatedAt: new Date(),
        },
      ]);

      const info = await svc.getPayoutInfo("v-1");
      expect(info).not.toBeNull();
      expect(info?.accountHolderName).toBe("John Doe");
    });

    it("returns null when no payout info row exists", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([]);
      const info = await svc.getPayoutInfo("v-1");
      expect(info).toBeNull();
    });
  });

  describe("updatePayoutInfo", () => {
    it("uses onConflictDoUpdate on vendorId (upsert pattern)", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      await svc.updatePayoutInfo("v-1", {
        accountHolderName: "Jane Doe",
        bankAccountNumber: "9876543210",
        ifscOrRoutingCode: "SBIN0001",
        bankName: "SBI",
      });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(db._insertChain.onConflictDoUpdate).toHaveBeenCalledOnce();
    });
  });

  describe("getReturnPolicy", () => {
    it("returns the vendor return policy when it exists", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([
        {
          id: "rp-1",
          vendorId: "v-1",
          returnWindowDays: 14,
          isReturnable: true,
          conditions: "Items must be unopened",
          createdAt: new Date(),
          updatedAt: new Date(),
        },
      ]);

      const policy = await svc.getReturnPolicy("v-1");
      expect(policy).not.toBeNull();
      expect(policy?.returnWindowDays).toBe(14);
    });

    it("returns null when no return policy row exists", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      db._selectChain.limit.mockResolvedValue([]);
      const policy = await svc.getReturnPolicy("v-1");
      expect(policy).toBeNull();
    });
  });

  describe("updateReturnPolicy", () => {
    it("upserts the return policy", async () => {
      const { VendorProfileService } = await import("./VendorProfileService.js");
      const svc = new VendorProfileService({ db: db as never });

      await svc.updateReturnPolicy("v-1", {
        returnWindowDays: 7,
        isReturnable: true,
        conditions: null,
      });

      expect(db.insert).toHaveBeenCalledOnce();
      expect(db._insertChain.onConflictDoUpdate).toHaveBeenCalledOnce();
    });
  });
});
