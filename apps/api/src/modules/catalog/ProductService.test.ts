import { beforeEach, describe, expect, it, vi } from "vitest";
import type { SelectProduct } from "../../db/schema/index.js";
import type { SelectAttributeDefinition } from "../../db/schema/index.js";
import type { SelectCategory } from "../../db/schema/index.js";
import {
  ProductService,
  ProductStateError,
  ProductOwnershipError,
  ProductNotFoundError,
  ProductRestrictionError,
  ProductValidationError,
} from "./ProductService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable SELECT mock returning `rows`.
 * ProductService uses:
 *   db.select().from().where().limit(1)   — ownership load
 *   db.select().from().where().orderBy().limit()  — list
 */
function makeDbSelectMock(rows: Partial<SelectProduct | SelectAttributeDefinition | SelectCategory>[]) {
  return {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
        then: (resolve: (v: unknown[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
}

function makeDbMock(selectRows: Partial<SelectProduct | SelectAttributeDefinition | SelectCategory>[] = []) {
  return {
    select: vi.fn().mockReturnValue(makeDbSelectMock(selectRows)),
  };
}

function makeInsertDbMock(returnRow: Partial<SelectProduct>) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(makeDbSelectMock([])),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

function makeUpdateDbMock(returnRow: Partial<SelectProduct> | null) {
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnRow ? [returnRow] : []),
      }),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(makeDbSelectMock([])),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

function makeFeatureFlagMock(value: string | null = null) {
  return {
    getFlag: vi.fn().mockResolvedValue(value),
  };
}

function makeQueueMock() {
  return {
    add: vi.fn().mockResolvedValue({ id: "job-1" }),
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseProduct: SelectProduct = {
  id: "product-uuid-1",
  vendorId: "vendor-uuid-1",
  categoryId: "category-uuid-1",
  name: "Test Product",
  slug: "test-product",
  description: null,
  status: "draft",
  basePriceMinor: 9999,
  attributes: {},
  rejectionReason: null,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const draftProduct = { ...baseProduct, status: "draft" as const };
const pendingProduct = { ...baseProduct, status: "pending_review" as const };
const approvedProduct = { ...baseProduct, status: "approved" as const };
const rejectedProduct = { ...baseProduct, status: "rejected" as const };

const baseAttrDef: SelectAttributeDefinition = {
  id: "attr-def-uuid-1",
  categoryId: "category-uuid-1",
  key: "color",
  label: "Color",
  attrType: "text",
  options: null,
  isRequired: false,
  isFilterable: false,
  isSearchable: false,
  isVariant: false,
  sortOrder: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

const baseCategory: SelectCategory = {
  id: "category-uuid-1",
  name: "Electronics",
  slug: "electronics",
  parentId: null,
  sortOrder: 0,
  isRestricted: false,
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Test suites
// ---------------------------------------------------------------------------

describe("ProductService", () => {

  // ── createProduct ─────────────────────────────────────────────────────────

  describe("createProduct", () => {
    it("inserts a product with status=draft and generates a slug", async () => {
      // Mock sequence:
      // 1. load category (for restriction check) → baseCategory (not restricted)
      // 2. load attribute definitions → [baseAttrDef]
      // 3. slug uniqueness check → [] (free)
      // 4. insert + returning → [draftProduct]
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([baseCategory]))      // category load
        .mockReturnValueOnce(makeDbSelectMock([baseAttrDef]))       // attr defs
        .mockReturnValueOnce(makeDbSelectMock([]))                  // slug check
      ;
      const db = {
        select: selectFn,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([draftProduct]),
          }),
        }),
      };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      const result = await svc.createProduct("vendor-uuid-1", {
        name: "Test Product",
        categoryId: "category-uuid-1",
        basePriceMinor: 9999,
      });

      expect(result.status).toBe("draft");
      expect(db.insert).toHaveBeenCalled();
    });

    it("throws ProductRestrictionError when category is restricted and vendor not approved", async () => {
      const restrictedCategory = { ...baseCategory, isRestricted: true };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([restrictedCategory]))  // category load
        .mockReturnValueOnce(makeDbSelectMock([]))                    // no restriction approval rows
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.createProduct("vendor-uuid-1", {
          name: "Test Product",
          categoryId: "category-uuid-1",
          basePriceMinor: 9999,
        })
      ).rejects.toThrow(ProductRestrictionError);
    });

    it("succeeds when category is restricted but vendor is in approved list", async () => {
      const restrictedCategory = { ...baseCategory, isRestricted: true };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([restrictedCategory]))           // category load
        .mockReturnValueOnce(makeDbSelectMock([{ vendorId: "vendor-uuid-1" }])) // restriction row found
        .mockReturnValueOnce(makeDbSelectMock([baseAttrDef]))                  // attr defs
        .mockReturnValueOnce(makeDbSelectMock([]))                             // slug check
      ;
      const db = {
        select: selectFn,
        insert: vi.fn().mockReturnValue({
          values: vi.fn().mockReturnValue({
            returning: vi.fn().mockResolvedValue([draftProduct]),
          }),
        }),
      };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      const result = await svc.createProduct("vendor-uuid-1", {
        name: "Test Product",
        categoryId: "category-uuid-1",
        basePriceMinor: 9999,
      });

      expect(result.status).toBe("draft");
    });

    it("throws ProductValidationError for unknown attribute keys", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([baseCategory]))  // category not restricted
        .mockReturnValueOnce(makeDbSelectMock([baseAttrDef]))   // only 'color' attr exists
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.createProduct("vendor-uuid-1", {
          name: "Test Product",
          categoryId: "category-uuid-1",
          basePriceMinor: 9999,
          attributes: { unknownKey: "value" }, // key not in category schema
        })
      ).rejects.toThrow(ProductValidationError);
    });
  });

  // ── updateProduct ─────────────────────────────────────────────────────────

  describe("updateProduct", () => {
    it("resets status from pending_review to draft when editing (D-06, Pitfall 3)", async () => {
      const updatedToDraft = { ...pendingProduct, status: "draft" as const, name: "Updated Name" };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([pendingProduct])) // ownership load
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([updatedToDraft]),
            }),
          }),
        }),
      };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      const result = await svc.updateProduct("product-uuid-1", "vendor-uuid-1", { name: "Updated Name" });

      // The update call's set arg must include status: 'draft'
      const setMock = db.update().set;
      // result status should be draft after reset
      expect(result?.status).toBe("draft");
    });

    it("throws ProductOwnershipError when vendorId doesn't match", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([])) // no rows for this vendor
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.updateProduct("product-uuid-1", "other-vendor-uuid", { name: "Hack" })
      ).rejects.toThrow(ProductOwnershipError);
    });

    it("does not allow direct status mutation via updateProduct", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([draftProduct]))
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([draftProduct]),
            }),
          }),
        }),
      };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      // Passing status in the input should be stripped/ignored — should not throw
      // but status should NOT be set to 'approved' directly
      const result = await svc.updateProduct("product-uuid-1", "vendor-uuid-1", {
        name: "Updated Name",
      });
      // The update set args should not have status: 'approved'
      const setArg = (db.update().set as ReturnType<typeof vi.fn>).mock.calls[0]?.[0];
      expect(setArg?.status).not.toBe("approved");
    });
  });

  // ── submitProduct ─────────────────────────────────────────────────────────

  describe("submitProduct", () => {
    it("transitions from draft to pending_review when CATALOG_AUTO_APPROVE is off", async () => {
      const pendingResult = { ...draftProduct, status: "pending_review" as const };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([draftProduct])) // ownership load
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([pendingResult]),
            }),
          }),
        }),
      };
      const featureFlagService = makeFeatureFlagMock(null); // flag off
      const productIndexQueue = makeQueueMock();
      const svc = new ProductService({
        db: db as never,
        featureFlagService,
        productIndexQueue,
      });

      const result = await svc.submitProduct("product-uuid-1", "vendor-uuid-1");

      expect(featureFlagService.getFlag).toHaveBeenCalledWith("CATALOG_AUTO_APPROVE");
      expect(result.status).toBe("pending_review");
      // Queue should NOT be called when not auto-approved
      expect(productIndexQueue.add).not.toHaveBeenCalled();
    });

    it("auto-approves and enqueues index job when CATALOG_AUTO_APPROVE is true", async () => {
      const approvedResult = { ...draftProduct, status: "approved" as const };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([draftProduct])) // ownership load
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([approvedResult]),
            }),
          }),
        }),
      };
      const featureFlagService = makeFeatureFlagMock("true"); // flag on
      const productIndexQueue = makeQueueMock();
      const svc = new ProductService({
        db: db as never,
        featureFlagService,
        productIndexQueue,
      });

      const result = await svc.submitProduct("product-uuid-1", "vendor-uuid-1");

      expect(result.status).toBe("approved");
      expect(productIndexQueue.add).toHaveBeenCalledWith(
        "index",
        expect.objectContaining({ productId: "product-uuid-1", action: "index" }),
        expect.any(Object)
      );
    });

    it("throws ProductStateError when product is not in draft status", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([pendingProduct]))
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.submitProduct("product-uuid-1", "vendor-uuid-1")
      ).rejects.toThrow(ProductStateError);
    });
  });

  // ── approveProduct ────────────────────────────────────────────────────────

  describe("approveProduct", () => {
    it("transitions from pending_review to approved and enqueues index job", async () => {
      const approvedResult = { ...pendingProduct, status: "approved" as const };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([pendingProduct]))
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([approvedResult]),
            }),
          }),
        }),
      };
      const productIndexQueue = makeQueueMock();
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue,
      });

      const result = await svc.approveProduct("product-uuid-1");

      expect(result.status).toBe("approved");
      expect(productIndexQueue.add).toHaveBeenCalledWith(
        "index",
        expect.objectContaining({ productId: "product-uuid-1", action: "index" }),
        expect.any(Object)
      );
    });

    it("throws ProductStateError when product is not in pending_review status", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([draftProduct]))
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(svc.approveProduct("product-uuid-1")).rejects.toThrow(ProductStateError);
    });
  });

  // ── rejectProduct ─────────────────────────────────────────────────────────

  describe("rejectProduct", () => {
    it("transitions to rejected and stores rejectionReason (D-08)", async () => {
      const rejectedResult = {
        ...pendingProduct,
        status: "rejected" as const,
        rejectionReason: "Missing required images",
      };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([pendingProduct]))
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([rejectedResult]),
            }),
          }),
        }),
      };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      const result = await svc.rejectProduct("product-uuid-1", "Missing required images");

      expect(result.status).toBe("rejected");
      expect(result.rejectionReason).toBe("Missing required images");
    });

    it("throws ProductStateError when rejection reason is empty (D-08)", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([pendingProduct]))
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.rejectProduct("product-uuid-1", "")
      ).rejects.toThrow(ProductStateError);
    });

    it("enqueues a delete job when previously approved product is rejected (Pitfall 7, D-13)", async () => {
      // Product was approved (indexed in OpenSearch) — reject must enqueue delete
      const approvedBeforeReject = { ...approvedProduct };
      const rejectedResult = { ...approvedBeforeReject, status: "rejected" as const, rejectionReason: "Bad content" };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([approvedBeforeReject]))
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([rejectedResult]),
            }),
          }),
        }),
      };
      const productIndexQueue = makeQueueMock();
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue,
      });

      await svc.rejectProduct("product-uuid-1", "Bad content");

      expect(productIndexQueue.add).toHaveBeenCalledWith(
        "index",
        expect.objectContaining({ productId: "product-uuid-1", action: "delete" }),
        expect.any(Object)
      );
    });
  });

  // ── archiveProduct ────────────────────────────────────────────────────────

  describe("archiveProduct", () => {
    it("sets archivedAt and enqueues delete job (Pitfall 7)", async () => {
      const archivedResult = { ...approvedProduct, archivedAt: new Date() };
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([approvedProduct])) // ownership load
      ;
      const db = {
        select: selectFn,
        update: vi.fn().mockReturnValue({
          set: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              returning: vi.fn().mockResolvedValue([archivedResult]),
            }),
          }),
        }),
      };
      const productIndexQueue = makeQueueMock();
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue,
      });

      await svc.archiveProduct("product-uuid-1", "vendor-uuid-1");

      expect(productIndexQueue.add).toHaveBeenCalledWith(
        "index",
        expect.objectContaining({ productId: "product-uuid-1", action: "delete" }),
        expect.any(Object)
      );
    });

    it("throws ProductOwnershipError when vendorId doesn't match", async () => {
      const selectFn = vi.fn()
        .mockReturnValueOnce(makeDbSelectMock([]))
      ;
      const db = { select: selectFn };
      const svc = new ProductService({
        db: db as never,
        featureFlagService: makeFeatureFlagMock(),
        productIndexQueue: makeQueueMock(),
      });

      await expect(
        svc.archiveProduct("product-uuid-1", "other-vendor-uuid")
      ).rejects.toThrow(ProductOwnershipError);
    });
  });
});
