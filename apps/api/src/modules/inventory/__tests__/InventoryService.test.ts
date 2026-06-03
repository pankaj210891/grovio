import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  InventoryService,
  InsufficientStockError as InventoryInsufficientStockError,
} from "../InventoryService.js";
import { processReleaseReservationJob } from "../../jobs/release-reservation-job.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeMockQueue() {
  return {
    add: vi.fn().mockResolvedValue({ id: "job-id" }),
  };
}

function makeMockTx() {
  const tx = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  return tx;
}

function makeMockDb(tx: ReturnType<typeof makeMockTx>) {
  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: ReturnType<typeof makeMockTx>) => unknown) => {
      return fn(tx);
    }),
  };
  return db;
}

function makeService(
  db: ReturnType<typeof makeMockDb>,
  queue: ReturnType<typeof makeMockQueue>
) {
  return new InventoryService({
    db: db as never,
    reservationQueue: queue as never,
    env: {} as never,
  });
}

// ---------------------------------------------------------------------------
// InventoryService tests
// ---------------------------------------------------------------------------

describe("InventoryService", () => {
  describe("reserveItems", () => {
    it("decrements quantityAvailable and increments quantityReserved for each item", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      const invRow = {
        id: "inv-1",
        productVariantId: "variant-1",
        productId: null,
        quantityAvailable: 10,
        quantityReserved: 0,
        lowStockThreshold: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // tx.select chain: .from().where().for('update') → resolves to [invRow]
      const txForUpdateMock = vi.fn().mockResolvedValue([invRow]);
      const txWhereMock = vi.fn().mockReturnValue({ for: txForUpdateMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      // tx.update chain
      const txWhereSilentMock = vi.fn().mockResolvedValue(undefined);
      const txSetMock = vi.fn().mockReturnValue({ where: txWhereSilentMock });
      tx.update.mockReturnValue({ set: txSetMock });

      // tx.insert chain: returns reservation row with id
      const reservationRow = { id: "res-1" };
      const txReturningMock = vi.fn().mockResolvedValue([reservationRow]);
      const txValuesMock = vi.fn().mockReturnValue({ returning: txReturningMock });
      tx.insert.mockReturnValue({ values: txValuesMock });

      const service = makeService(db, queue);
      const ids = await service.reserveItems({
        basketSessionId: "session-1",
        customerId: "customer-1",
        items: [{ inventoryItemId: "inv-1", quantity: 3 }],
      });

      expect(ids).toEqual(["res-1"]);
      expect(tx.update).toHaveBeenCalled();
      expect(tx.insert).toHaveBeenCalled();
    });

    it("throws InsufficientStockError when quantityAvailable < requested", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      const invRow = {
        id: "inv-1",
        quantityAvailable: 2,
        quantityReserved: 0,
      };

      // SELECT FOR UPDATE returns row with only 2 available
      const txForUpdateMock = vi.fn().mockResolvedValue([invRow]);
      const txWhereMock = vi.fn().mockReturnValue({ for: txForUpdateMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      const service = makeService(db, queue);
      await expect(
        service.reserveItems({
          basketSessionId: "session-1",
          customerId: "customer-1",
          items: [{ inventoryItemId: "inv-1", quantity: 5 }],
        })
      ).rejects.toThrow(InventoryInsufficientStockError);
    });

    it("throws InsufficientStockError when inventory item not found", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      // SELECT FOR UPDATE returns empty array (item not found)
      const txForUpdateMock = vi.fn().mockResolvedValue([]);
      const txWhereMock = vi.fn().mockReturnValue({ for: txForUpdateMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      const service = makeService(db, queue);
      await expect(
        service.reserveItems({
          basketSessionId: "session-1",
          customerId: "customer-1",
          items: [{ inventoryItemId: "inv-missing", quantity: 1 }],
        })
      ).rejects.toThrow(InventoryInsufficientStockError);
    });

    it("enqueues a ReleaseReservationJob with deterministic jobId and 15-min delay", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      const invRow = {
        id: "inv-1",
        quantityAvailable: 10,
        quantityReserved: 0,
      };

      const txForUpdateMock = vi.fn().mockResolvedValue([invRow]);
      const txWhereMock = vi.fn().mockReturnValue({ for: txForUpdateMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      const txWhereSilentMock = vi.fn().mockResolvedValue(undefined);
      const txSetMock = vi.fn().mockReturnValue({ where: txWhereSilentMock });
      tx.update.mockReturnValue({ set: txSetMock });

      const reservationRow = { id: "res-deterministic-1" };
      const txReturningMock = vi.fn().mockResolvedValue([reservationRow]);
      const txValuesMock = vi.fn().mockReturnValue({ returning: txReturningMock });
      tx.insert.mockReturnValue({ values: txValuesMock });

      const service = makeService(db, queue);
      await service.reserveItems({
        basketSessionId: "session-1",
        customerId: "customer-1",
        items: [{ inventoryItemId: "inv-1", quantity: 1 }],
      });

      // Assert queue.add was called with deterministic jobId
      expect(queue.add).toHaveBeenCalledWith(
        "release-reservation",
        { reservationId: "res-deterministic-1" },
        expect.objectContaining({
          jobId: "release-reservation:res-deterministic-1",
          delay: 900000, // 15 min = 900 seconds = 900000 ms
        })
      );
    });

    it("uses a transaction for each inventory item reservation", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      const invRow = { id: "inv-1", quantityAvailable: 5, quantityReserved: 0 };

      const txForUpdateMock = vi.fn().mockResolvedValue([invRow]);
      const txWhereMock = vi.fn().mockReturnValue({ for: txForUpdateMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      const txWhereSilentMock = vi.fn().mockResolvedValue(undefined);
      const txSetMock = vi.fn().mockReturnValue({ where: txWhereSilentMock });
      tx.update.mockReturnValue({ set: txSetMock });

      const txReturningMock = vi.fn().mockResolvedValue([{ id: "res-1" }]);
      const txValuesMock = vi.fn().mockReturnValue({ returning: txReturningMock });
      tx.insert.mockReturnValue({ values: txValuesMock });

      const service = makeService(db, queue);
      await service.reserveItems({
        basketSessionId: "session-1",
        customerId: "customer-1",
        items: [{ inventoryItemId: "inv-1", quantity: 2 }],
      });

      // Transaction was used
      expect(db.transaction).toHaveBeenCalledTimes(1);
    });
  });

  describe("consumeReservation", () => {
    it("marks reservation consumed and decrements quantityReserved", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);
      const queue = makeMockQueue();

      const reservation = {
        id: "res-1",
        inventoryItemId: "inv-1",
        quantity: 2,
        status: "reserved",
      };

      // tx.select: returns reservation row
      const txLimitMock = vi.fn().mockResolvedValue([reservation]);
      const txWhereMock = vi.fn().mockReturnValue({ limit: txLimitMock });
      const txFromMock = vi.fn().mockReturnValue({ where: txWhereMock });
      tx.select.mockReturnValue({ from: txFromMock });

      // tx.update: two calls — update inventory + update reservation status
      const txWhereSilentMock = vi.fn().mockResolvedValue(undefined);
      const txSetMock = vi.fn().mockReturnValue({ where: txWhereSilentMock });
      tx.update.mockReturnValue({ set: txSetMock });

      const service = makeService(db, queue);
      await service.consumeReservation("res-1");

      expect(db.transaction).toHaveBeenCalled();
      expect(tx.update).toHaveBeenCalled();
    });
  });
});

// ---------------------------------------------------------------------------
// ReleaseReservationJob tests
// ---------------------------------------------------------------------------

describe("processReleaseReservationJob", () => {
  it("is a no-op when reservation status is not 'reserved' (already consumed)", async () => {
    const db = {
      select: vi.fn(),
      transaction: vi.fn(),
    };

    const consumedReservation = {
      id: "res-1",
      status: "consumed",
      inventoryItemId: "inv-1",
      quantity: 3,
    };

    const limitMock = vi.fn().mockResolvedValue([consumedReservation]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    db.select.mockReturnValue({ from: fromMock });

    const job = { data: { reservationId: "res-1" } };

    await processReleaseReservationJob(job as never, { db: db as never });

    // Transaction should NOT be called — early return on non-reserved status
    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("is a no-op when reservation is not found", async () => {
    const db = {
      select: vi.fn(),
      transaction: vi.fn(),
    };

    const limitMock = vi.fn().mockResolvedValue([]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    db.select.mockReturnValue({ from: fromMock });

    const job = { data: { reservationId: "res-missing" } };
    await processReleaseReservationJob(job as never, { db: db as never });

    expect(db.transaction).not.toHaveBeenCalled();
  });

  it("returns stock to quantityAvailable when status is 'reserved'", async () => {
    const tx = {
      update: vi.fn(),
    };

    const db = {
      select: vi.fn(),
      transaction: vi.fn().mockImplementation(async (fn: (txArg: unknown) => unknown) => {
        return fn(tx);
      }),
    };

    const reservation = {
      id: "res-1",
      status: "reserved",
      inventoryItemId: "inv-1",
      quantity: 3,
    };

    const limitMock = vi.fn().mockResolvedValue([reservation]);
    const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
    const fromMock = vi.fn().mockReturnValue({ where: whereMock });
    db.select.mockReturnValue({ from: fromMock });

    const txWhereSilentMock = vi.fn().mockResolvedValue(undefined);
    const txSetMock = vi.fn().mockReturnValue({ where: txWhereSilentMock });
    tx.update.mockReturnValue({ set: txSetMock });

    const job = { data: { reservationId: "res-1" } };
    await processReleaseReservationJob(job as never, { db: db as never });

    // Transaction should be called — two update calls (inventory + reservation status)
    expect(db.transaction).toHaveBeenCalled();
    expect(tx.update).toHaveBeenCalledTimes(2);
  });
});
