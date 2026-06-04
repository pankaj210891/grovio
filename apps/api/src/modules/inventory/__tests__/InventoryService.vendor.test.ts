import { describe, expect, it, vi } from "vitest";
import { InventoryService } from "../InventoryService.js";

// ---------------------------------------------------------------------------
// InventoryService vendor methods — D-15, VEN-03, T-06-18, T-06-19
//
// New in Phase 6: vendor can update inventory quantity and pricing for their products.
// Ownership check (IDOR guard): vendorId must match product.vendorId.
// quantity_reserved is never writable through these methods.
// Price updates trigger a ProductIndexJob via BullMQ queue.
//
// Key assertions:
// - updateInventory rejects when inventoryItemId belongs to a different vendor (T-06-18)
// - updateInventory updates quantityAvailable but NOT quantityReserved (T-06-19)
// - updatePricing rejects when product belongs to a different vendor (T-06-18)
// - updatePricing enqueues a ProductIndexJob after the price write
// ---------------------------------------------------------------------------

function makeMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: "job-id" }),
  };
}

function makeMockSelect(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnThis(),
    innerJoin: vi.fn().mockReturnThis(),
    leftJoin: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue(rows),
  });
}

function makeMockUpdate() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

function makeMockDb(selectRows: unknown[] = []) {
  return {
    select: makeMockSelect(selectRows),
    update: makeMockUpdate(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: ReturnType<typeof makeBasicTx>) => unknown) => fn(makeBasicTx())),
  };
}

function makeBasicTx() {
  return {
    select: makeMockSelect([]),
    insert: vi.fn().mockReturnValue({ values: vi.fn().mockResolvedValue([]) }),
    update: makeMockUpdate(),
    delete: vi.fn().mockReturnValue({ where: vi.fn().mockResolvedValue([]) }),
  };
}

function makeService(
  db: ReturnType<typeof makeMockDb>,
  queue: ReturnType<typeof makeMockQueue>
) {
  return new InventoryService({
    db: db as never,
    reservationQueue: queue as never,
    productIndexQueue: queue as never,
    env: {} as never,
  });
}

describe("InventoryService vendor extensions", () => {
  describe("updateInventory", () => {
    it("rejects update when inventoryItemId belongs to a different vendorId (T-06-18 IDOR guard)", async () => {
      const queue = makeMockQueue();
      // The inventory item belongs to vendor-B, not vendor-A
      const db = makeMockDb([
        {
          inventoryItemId: "inv-1",
          productId: "prod-1",
          vendorId: "vendor-B", // mismatch
        },
      ]);

      const svc = makeService(db, queue);

      await expect(
        svc.updateInventory("vendor-A", "inv-1", { quantityAvailable: 10 })
      ).rejects.toThrow();
    });

    it("updates quantityAvailable for the vendor's own inventory item", async () => {
      const queue = makeMockQueue();
      const db = makeMockDb([
        {
          inventoryItemId: "inv-1",
          productId: "prod-1",
          vendorId: "vendor-A", // match
        },
      ]);

      const svc = makeService(db, queue);

      await svc.updateInventory("vendor-A", "inv-1", { quantityAvailable: 20 });

      expect(db.update).toHaveBeenCalledOnce();
      const setArg = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0] as Record<string, unknown>;
      expect(setArg?.["quantityAvailable"]).toBe(20);
    });

    it("does NOT write quantityReserved through updateInventory (T-06-19)", async () => {
      const queue = makeMockQueue();
      const db = makeMockDb([
        { inventoryItemId: "inv-1", productId: "prod-1", vendorId: "vendor-A" },
      ]);

      const svc = makeService(db, queue);
      await svc.updateInventory("vendor-A", "inv-1", { quantityAvailable: 5 });

      const setArg = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0] as Record<string, unknown>;
      // quantityReserved must NOT appear in the set payload
      expect(setArg).not.toHaveProperty("quantityReserved");
    });
  });

  describe("updatePricing", () => {
    it("rejects update when product belongs to a different vendorId (T-06-18 IDOR guard)", async () => {
      const queue = makeMockQueue();
      // Product belongs to vendor-B, not vendor-A
      const db = makeMockDb([
        { productId: "prod-1", vendorId: "vendor-B" },
      ]);

      const svc = makeService(db, queue);

      await expect(
        svc.updatePricing("vendor-A", "prod-1", { basePriceMinor: 5000 })
      ).rejects.toThrow();
    });

    it("updates base_price_minor for own product and enqueues ProductIndexJob", async () => {
      const queue = makeMockQueue();
      const db = makeMockDb([
        { productId: "prod-1", vendorId: "vendor-A" }, // ownership match
      ]);

      const svc = makeService(db, queue);

      await svc.updatePricing("vendor-A", "prod-1", { basePriceMinor: 9999 });

      // Should have updated the price
      expect(db.update).toHaveBeenCalledOnce();
      const setArg = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0] as Record<string, unknown>;
      expect(setArg?.["basePriceMinor"]).toBe(9999);

      // Should have enqueued ProductIndexJob
      expect(queue.add).toHaveBeenCalledOnce();
      const jobArgs = queue.add.mock.calls[0] as [string, { productId: string; action: string }];
      expect(jobArgs?.[0]).toBe("product-index");
      expect(jobArgs?.[1]?.productId).toBe("prod-1");
      expect(jobArgs?.[1]?.action).toBe("index");
    });

    it("does NOT write quantity_reserved via updatePricing (T-06-19)", async () => {
      const queue = makeMockQueue();
      const db = makeMockDb([
        { productId: "prod-1", vendorId: "vendor-A" },
      ]);

      const svc = makeService(db, queue);
      await svc.updatePricing("vendor-A", "prod-1", { basePriceMinor: 100 });

      const setArg = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0] as Record<string, unknown>;
      expect(setArg).not.toHaveProperty("quantityReserved");
    });
  });
});
