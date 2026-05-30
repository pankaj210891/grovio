import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectCategory, SelectVendorCategoryRestriction } from "../../db/schema/index.js";
import { VendorRestrictionService } from "./VendorRestrictionService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle SELECT mock.
 * VendorRestrictionService uses:
 *   db.select().from().where().limit(1)    ← isCategoryRestricted, isVendorAllowed check
 *   db.select().from().where()             ← getRestrictions (no limit, awaited directly)
 */
function makeSelectDbMock<T extends object>(rows: T[]) {
  const awaitableWhereChain = {
    limit: vi.fn().mockResolvedValue(rows),
    // Make where itself awaitable for getRestrictions (no limit)
    then: (resolve: (v: T[]) => void) => resolve(rows),
    catch: vi.fn(),
    finally: vi.fn(),
  };
  const chain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue(awaitableWhereChain),
    }),
  };
  return { select: vi.fn().mockReturnValue(chain) };
}

/**
 * Build a Drizzle INSERT mock for addVendorToCategory.
 * VendorRestrictionService uses:
 *   db.insert(vendorCategoryRestrictions).values(...).returning()
 */
function makeInsertDbMock(returnRow: SelectVendorCategoryRestriction) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

/**
 * Build a Drizzle INSERT mock that throws a unique-constraint error.
 */
function makeDuplicateInsertDbMock() {
  const uniqueError = new Error(
    'duplicate key value violates unique constraint "vendor_category_restrictions_category_id_vendor_id_unique"'
  );
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockRejectedValue(uniqueError),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

/**
 * Build a Drizzle DELETE mock for removeVendorFromCategory.
 * VendorRestrictionService uses:
 *   db.delete(vendorCategoryRestrictions).where(...)
 */
function makeDeleteDbMock() {
  const deleteChain = {
    where: vi.fn().mockResolvedValue({ rowCount: 1 }),
  };
  return {
    ...makeSelectDbMock([]),
    delete: vi.fn().mockReturnValue(deleteChain),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const categoryId = "cat-uuid-1";
const vendorId = "vendor-uuid-1";
const adminId = "admin-uuid-1";

const restrictionRow: SelectVendorCategoryRestriction = {
  id: "restriction-uuid-1",
  categoryId,
  vendorId,
  createdByAdminId: adminId,
  createdAt: new Date("2025-01-01T00:00:00Z"),
};

const restrictedCategory: SelectCategory = {
  id: categoryId,
  name: "Electronics",
  slug: "electronics",
  parentId: null,
  sortOrder: 0,
  isRestricted: true,
  archivedAt: null,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const openCategory: SelectCategory = {
  ...restrictedCategory,
  isRestricted: false,
};

// ---------------------------------------------------------------------------
// Tests — CAT-06
// ---------------------------------------------------------------------------

describe("VendorRestrictionService", () => {
  // ── addVendorToCategory ────────────────────────────────────────────────────

  describe("addVendorToCategory", () => {
    it("inserts a restriction row and returns it", async () => {
      const db = makeInsertDbMock(restrictionRow);
      const svc = new VendorRestrictionService({ db: db as never });
      const result = await svc.addVendorToCategory({
        categoryId,
        vendorId,
        createdByAdminId: adminId,
      });

      expect(result.categoryId).toBe(categoryId);
      expect(result.vendorId).toBe(vendorId);
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it("throws when a duplicate (categoryId, vendorId) restriction is inserted", async () => {
      const db = makeDuplicateInsertDbMock();
      const svc = new VendorRestrictionService({ db: db as never });

      await expect(
        svc.addVendorToCategory({ categoryId, vendorId, createdByAdminId: adminId })
      ).rejects.toThrow();
    });
  });

  // ── isVendorAllowed ────────────────────────────────────────────────────────

  describe("isVendorAllowed", () => {
    it("returns true when a restriction row exists for (categoryId, vendorId)", async () => {
      const db = makeSelectDbMock([restrictionRow]);
      const svc = new VendorRestrictionService({ db: db as never });
      const allowed = await svc.isVendorAllowed(categoryId, vendorId);

      expect(allowed).toBe(true);
    });

    it("returns false when no restriction row exists for the vendor in that category", async () => {
      const db = makeSelectDbMock([]); // no rows → vendor not approved
      const svc = new VendorRestrictionService({ db: db as never });
      const allowed = await svc.isVendorAllowed(categoryId, "unknown-vendor-uuid");

      expect(allowed).toBe(false);
    });
  });

  // ── isCategoryRestricted ───────────────────────────────────────────────────

  describe("isCategoryRestricted", () => {
    it("returns true when categories.isRestricted is true", async () => {
      const db = makeSelectDbMock([restrictedCategory]);
      const svc = new VendorRestrictionService({ db: db as never });
      const restricted = await svc.isCategoryRestricted(categoryId);

      expect(restricted).toBe(true);
    });

    it("returns false when category has isRestricted=false", async () => {
      const db = makeSelectDbMock([openCategory]);
      const svc = new VendorRestrictionService({ db: db as never });
      const restricted = await svc.isCategoryRestricted(categoryId);

      expect(restricted).toBe(false);
    });

    it("returns false when category does not exist (null/undefined guard)", async () => {
      const db = makeSelectDbMock([]); // no rows → category not found
      const svc = new VendorRestrictionService({ db: db as never });
      const restricted = await svc.isCategoryRestricted("nonexistent-cat-uuid");

      expect(restricted).toBe(false);
    });
  });

  // ── removeVendorFromCategory ───────────────────────────────────────────────

  describe("removeVendorFromCategory", () => {
    it("deletes the restriction row for the given (categoryId, vendorId)", async () => {
      const db = makeDeleteDbMock();
      const svc = new VendorRestrictionService({ db: db as never });
      await svc.removeVendorFromCategory(categoryId, vendorId);

      expect(db.delete).toHaveBeenCalledOnce();
    });
  });

  // ── getRestrictions ────────────────────────────────────────────────────────

  describe("getRestrictions", () => {
    it("returns the list of approved vendorIds for a category", async () => {
      const row2: SelectVendorCategoryRestriction = {
        ...restrictionRow,
        id: "restriction-uuid-2",
        vendorId: "vendor-uuid-2",
      };
      const db = makeSelectDbMock([restrictionRow, row2]);
      const svc = new VendorRestrictionService({ db: db as never });
      const vendorIds = await svc.getRestrictions(categoryId);

      expect(vendorIds).toHaveLength(2);
      expect(vendorIds).toContain(vendorId);
      expect(vendorIds).toContain("vendor-uuid-2");
    });

    it("returns empty array when no vendors are approved for the category", async () => {
      const db = makeSelectDbMock([]);
      const svc = new VendorRestrictionService({ db: db as never });
      const vendorIds = await svc.getRestrictions(categoryId);

      expect(vendorIds).toHaveLength(0);
    });
  });

  // ── Phase 3 enforcement boundary ──────────────────────────────────────────

  describe("D-11 boundary — no product-creation enforcement (Phase 3 only)", () => {
    it("VendorRestrictionService has no enforceVendorAccess or checkProductCreation method", () => {
      const svc = new VendorRestrictionService({ db: {} as never });
      // Phase 2 service must NOT expose enforcement hooks
      // Only these methods should exist:
      const publicMethods = Object.getOwnPropertyNames(Object.getPrototypeOf(svc))
        .filter((m) => m !== "constructor");

      expect(publicMethods).not.toContain("enforceVendorAccess");
      expect(publicMethods).not.toContain("checkProductCreation");
      expect(publicMethods).not.toContain("enforceRestriction");
      // Verify the expected Phase 2 methods are present
      expect(publicMethods).toContain("addVendorToCategory");
      expect(publicMethods).toContain("removeVendorFromCategory");
      expect(publicMethods).toContain("isVendorAllowed");
      expect(publicMethods).toContain("isCategoryRestricted");
      expect(publicMethods).toContain("getRestrictions");
    });
  });
});
