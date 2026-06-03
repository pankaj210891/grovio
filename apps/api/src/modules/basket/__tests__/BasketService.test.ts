import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  BasketService,
  BasketNotFoundError,
  InsufficientStockError,
} from "../BasketService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Creates a minimal mock db with the transaction-scoped query pattern */
function makeMockDb() {
  const tx = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
  };

  // Allow chaining: tx.select().from().where().limit() etc.
  const chainable = () => ({
    from: () => chainable(),
    where: () => chainable(),
    limit: () => chainable(),
    leftJoin: () => chainable(),
    returning: vi.fn().mockResolvedValue([]),
  });

  tx.select.mockReturnValue(chainable());
  tx.insert.mockReturnValue({
    values: () => ({ returning: vi.fn().mockResolvedValue([]) }),
  });
  tx.update.mockReturnValue({
    set: () => ({ where: () => Promise.resolve() }),
  });
  tx.delete.mockReturnValue({
    where: () => Promise.resolve(),
  });

  const db = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };

  // Top-level db queries share same chainable pattern
  const dbChainable = () => ({
    from: () => dbChainable(),
    where: () => dbChainable(),
    limit: () => Promise.resolve([]),
    leftJoin: () => dbChainable(),
    returning: vi.fn().mockResolvedValue([]),
  });

  db.select.mockReturnValue(dbChainable());
  db.insert.mockReturnValue({
    values: () => ({ returning: vi.fn().mockResolvedValue([]) }),
  });
  db.update.mockReturnValue({
    set: () => ({ where: () => Promise.resolve() }),
  });
  db.delete.mockReturnValue({
    where: () => Promise.resolve(),
  });
  db.transaction.mockImplementation(async (fn: (tx: typeof tx) => unknown) => {
    return fn(tx);
  });

  return { db, tx };
}

function makeService(db: ReturnType<typeof makeMockDb>["db"]) {
  return new BasketService({
    db: db as never,
    env: {} as never,
  });
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("BasketService", () => {
  describe("getOrCreateGuestSession", () => {
    it("returns existing session when valid guestToken provided", async () => {
      const { db } = makeMockDb();
      const existingSession = {
        id: "session-uuid",
        guestToken: "guest-token-123",
        customerId: null,
        expiresAt: new Date(Date.now() + 1000 * 60 * 60),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // Mock db.select chain to return the session
      const limitMock = vi.fn().mockResolvedValue([existingSession]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const service = makeService(db);
      const result = await service.getOrCreateGuestSession("guest-token-123");

      expect(result).toEqual(existingSession);
    });

    it("creates a new session when no guestToken provided", async () => {
      const { db } = makeMockDb();
      const newSession = {
        id: "new-session-uuid",
        guestToken: "new-guest-token",
        customerId: null,
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000),
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // No existing session found
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const returningMock = vi.fn().mockResolvedValue([newSession]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      db.insert.mockReturnValue({ values: valuesMock });

      const service = makeService(db);
      const result = await service.getOrCreateGuestSession();

      expect(result.id).toBe("new-session-uuid");
      expect(db.insert).toHaveBeenCalled();
    });
  });

  describe("addItem", () => {
    it("inserts a new basket item with price snapshot from product", async () => {
      const { db } = makeMockDb();
      const product = {
        id: "product-id",
        basePriceMinor: 1500,
        priceMinor: null,
      };
      const newItem = {
        id: "item-id",
        basketSessionId: "session-id",
        productId: "product-id",
        productVariantId: null,
        quantity: 2,
        unitPriceMinor: 1500,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      // db.select returns product
      const limitMock = vi.fn().mockResolvedValue([product]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      // Second select call for existing item check
      const limitMock2 = vi.fn().mockResolvedValue([]);
      const whereMock2 = vi.fn().mockReturnValue({ limit: limitMock2 });
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      db.select
        .mockReturnValueOnce({ from: fromMock })
        .mockReturnValueOnce({ from: fromMock2 });

      const returningMock = vi.fn().mockResolvedValue([newItem]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      db.insert.mockReturnValue({ values: valuesMock });

      const service = makeService(db);
      const result = await service.addItem({
        sessionId: "session-id",
        productId: "product-id",
        quantity: 2,
      });

      expect(result.unitPriceMinor).toBe(1500);
      expect(db.insert).toHaveBeenCalled();
    });

    it("uses variant price snapshot when variantId provided", async () => {
      const { db } = makeMockDb();
      const variant = { id: "variant-id", priceMinor: 2500 };
      const newItem = {
        id: "item-id",
        basketSessionId: "session-id",
        productId: "product-id",
        productVariantId: "variant-id",
        quantity: 1,
        unitPriceMinor: 2500,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      const limitMock = vi.fn().mockResolvedValue([variant]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const limitMock2 = vi.fn().mockResolvedValue([]);
      const whereMock2 = vi.fn().mockReturnValue({ limit: limitMock2 });
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      db.select
        .mockReturnValueOnce({ from: fromMock })
        .mockReturnValueOnce({ from: fromMock2 });

      const returningMock = vi.fn().mockResolvedValue([newItem]);
      const valuesMock = vi.fn().mockReturnValue({ returning: returningMock });
      db.insert.mockReturnValue({ values: valuesMock });

      const service = makeService(db);
      const result = await service.addItem({
        sessionId: "session-id",
        productId: "product-id",
        variantId: "variant-id",
        quantity: 1,
      });

      expect(result.unitPriceMinor).toBe(2500);
    });

    it("increments quantity when same productId + variantId already in session", async () => {
      const { db } = makeMockDb();
      const variant = { id: "variant-id", priceMinor: 2500 };
      const existingItem = {
        id: "existing-item-id",
        quantity: 1,
        unitPriceMinor: 2500,
      };
      const updatedItem = { ...existingItem, quantity: 3, unitPriceMinor: 2500 };

      const limitMock = vi.fn().mockResolvedValue([variant]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      const limitMock2 = vi.fn().mockResolvedValue([existingItem]);
      const whereMock2 = vi.fn().mockReturnValue({ limit: limitMock2 });
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      db.select
        .mockReturnValueOnce({ from: fromMock })
        .mockReturnValueOnce({ from: fromMock2 });

      const returningMock = vi.fn().mockResolvedValue([updatedItem]);
      const setMock = vi.fn().mockReturnValue({ where: () => ({ returning: returningMock }) });
      db.update.mockReturnValue({ set: setMock });

      const service = makeService(db);
      const result = await service.addItem({
        sessionId: "session-id",
        productId: "product-id",
        variantId: "variant-id",
        quantity: 2,
      });

      expect(db.update).toHaveBeenCalled();
      expect(result.quantity).toBe(3);
    });
  });

  describe("updateItem", () => {
    it("sets quantity on the basket item row", async () => {
      const { db } = makeMockDb();
      const updatedItem = { id: "item-id", quantity: 5, unitPriceMinor: 1500 };

      const returningMock = vi.fn().mockResolvedValue([updatedItem]);
      const setMock = vi.fn().mockReturnValue({ where: () => ({ returning: returningMock }) });
      db.update.mockReturnValue({ set: setMock });

      const service = makeService(db);
      const result = await service.updateItem("item-id", 5);

      expect(db.update).toHaveBeenCalled();
      expect(result.quantity).toBe(5);
    });
  });

  describe("removeItem", () => {
    it("deletes the basket item row", async () => {
      const { db } = makeMockDb();
      const whereMock = vi.fn().mockResolvedValue(undefined);
      db.delete.mockReturnValue({ where: whereMock });

      const service = makeService(db);
      await service.removeItem("item-id");

      expect(db.delete).toHaveBeenCalled();
      expect(whereMock).toHaveBeenCalled();
    });
  });

  describe("getBasket", () => {
    it("returns grouped basket with subtotal computed", async () => {
      const { db } = makeMockDb();
      const rows = [
        {
          item_id: "item-1",
          item_quantity: 2,
          item_unit_price_minor: 1000,
          item_created_at: new Date(),
          product_id: "prod-1",
          product_name: "Widget",
          variant_id: null,
          vendor_id: "vendor-1",
          vendor_name: "Store A",
        },
        {
          item_id: "item-2",
          item_quantity: 1,
          item_unit_price_minor: 500,
          item_created_at: new Date(),
          product_id: "prod-2",
          product_name: "Gadget",
          variant_id: null,
          vendor_id: "vendor-1",
          vendor_name: "Store A",
        },
      ];

      // Mock db.select chained with leftJoin + where
      const whereFinalMock = vi.fn().mockResolvedValue(rows);
      const whereMock = vi.fn().mockReturnValue(whereFinalMock);
      const leftJoinMock2 = vi.fn().mockReturnValue({ where: whereMock });
      const leftJoinMock1 = vi.fn().mockReturnValue({ leftJoin: leftJoinMock2 });
      const fromMock = vi.fn().mockReturnValue({ leftJoin: leftJoinMock1 });
      db.select.mockReturnValue({ from: fromMock });

      const service = makeService(db);
      const result = await service.getBasket("session-id");

      expect(result.groupedByVendor).toHaveLength(1);
      expect(result.groupedByVendor[0]!.vendorName).toBe("Store A");
      expect(result.groupedByVendor[0]!.items).toHaveLength(2);
      expect(result.subtotalMinor).toBe(2500); // 2*1000 + 1*500
    });
  });

  describe("mergeGuestBasket", () => {
    it("throws BasketNotFoundError when guest session not found", async () => {
      const { db } = makeMockDb();

      // Guest session not found
      const limitMock = vi.fn().mockResolvedValue([]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const service = makeService(db);
      await expect(service.mergeGuestBasket("bad-token", "customer-id")).rejects.toThrow(
        BasketNotFoundError
      );
    });

    it("sums quantities for matching variants and caps at available stock", async () => {
      const { db, tx } = makeMockDb();

      const guestSession = { id: "guest-session-id", guestToken: "guest-token" };
      const customerSession = { id: "customer-session-id", customerId: "customer-id" };
      const guestItems = [
        {
          id: "guest-item-1",
          productId: "prod-1",
          productVariantId: "variant-1",
          quantity: 3,
          unitPriceMinor: 1000,
          basketSessionId: "guest-session-id",
        },
      ];
      const customerItems = [
        {
          id: "customer-item-1",
          productId: "prod-1",
          productVariantId: "variant-1",
          quantity: 2,
          unitPriceMinor: 1000,
          basketSessionId: "customer-session-id",
        },
      ];
      // Available stock = 4 (so cap = 4, sum = 3+2 = 5 -> capped at 4)
      const inventoryItem = { id: "inv-1", quantityAvailable: 4 };

      // db.select calls: 1. guest session, 2. customer session
      const limitMock1 = vi.fn().mockResolvedValue([guestSession]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      const limitMock2 = vi.fn().mockResolvedValue([customerSession]);
      const whereMock2 = vi.fn().mockReturnValue({ limit: limitMock2 });
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      db.select
        .mockReturnValueOnce({ from: fromMock1 })
        .mockReturnValueOnce({ from: fromMock2 });

      // tx.select calls inside transaction: guest items, customer items, inventory
      const txLimitMock1 = vi.fn().mockResolvedValue(guestItems);
      const txWhereMock1 = vi.fn().mockReturnValue({ limit: () => txLimitMock1() });
      const txFromMock1 = vi.fn().mockReturnValue({ where: txWhereMock1 });

      const txLimitMock2 = vi.fn().mockResolvedValue(customerItems);
      const txWhereMock2 = vi.fn().mockReturnValue({ limit: () => txLimitMock2() });
      const txFromMock2 = vi.fn().mockReturnValue({ where: txWhereMock2 });

      // inventory items joined from basket items
      const txInventoryResult = [{ ...guestItems[0], inventoryQuantityAvailable: 4 }];
      const txInventoryFn = vi.fn().mockResolvedValue(txInventoryResult);
      const txInventoryWhere = vi.fn().mockReturnValue(txInventoryFn);
      const txInventoryLeftJoin = vi.fn().mockReturnValue({ where: txInventoryWhere });
      const txInventoryFrom = vi.fn().mockReturnValue({ leftJoin: txInventoryLeftJoin });

      tx.select
        .mockReturnValueOnce({ from: txFromMock1 })
        .mockReturnValueOnce({ from: txFromMock2 })
        .mockReturnValueOnce({ from: txInventoryFrom });

      const txReturningMock = vi.fn().mockResolvedValue([{ ...customerItems[0], quantity: 4 }]);
      const txSetMock = vi.fn().mockReturnValue({ where: () => ({ returning: txReturningMock }) });
      tx.update.mockReturnValue({ set: txSetMock });

      const txDeleteWhere = vi.fn().mockResolvedValue(undefined);
      tx.delete.mockReturnValue({ where: txDeleteWhere });

      const service = makeService(db);

      // Should not throw — merge completes with cap at 4
      await service.mergeGuestBasket("guest-token", "customer-id");

      // Update was called (to set capped quantity on customer item)
      expect(tx.update).toHaveBeenCalled();
    });

    it("moves non-matching guest items to customer basket", async () => {
      const { db, tx } = makeMockDb();

      const guestSession = { id: "guest-session-id", guestToken: "guest-token" };
      const customerSession = { id: "customer-session-id", customerId: "customer-id" };
      const guestItems = [
        {
          id: "guest-item-1",
          productId: "prod-2",
          productVariantId: "variant-2",
          quantity: 1,
          unitPriceMinor: 2000,
          basketSessionId: "guest-session-id",
        },
      ];
      const customerItems: typeof guestItems = []; // Empty customer basket
      const inventoryResult = [{ ...guestItems[0], inventoryQuantityAvailable: 10 }];

      const limitMock1 = vi.fn().mockResolvedValue([guestSession]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      const limitMock2 = vi.fn().mockResolvedValue([customerSession]);
      const whereMock2 = vi.fn().mockReturnValue({ limit: limitMock2 });
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      db.select
        .mockReturnValueOnce({ from: fromMock1 })
        .mockReturnValueOnce({ from: fromMock2 });

      const txLimitMock1 = vi.fn().mockResolvedValue(guestItems);
      const txWhereMock1 = vi.fn().mockReturnValue({ limit: () => txLimitMock1() });
      const txFromMock1 = vi.fn().mockReturnValue({ where: txWhereMock1 });

      const txLimitMock2 = vi.fn().mockResolvedValue(customerItems);
      const txWhereMock2 = vi.fn().mockReturnValue({ limit: () => txLimitMock2() });
      const txFromMock2 = vi.fn().mockReturnValue({ where: txWhereMock2 });

      const txInventoryFn = vi.fn().mockResolvedValue(inventoryResult);
      const txInventoryWhere = vi.fn().mockReturnValue(txInventoryFn);
      const txInventoryLeftJoin = vi.fn().mockReturnValue({ where: txInventoryWhere });
      const txInventoryFrom = vi.fn().mockReturnValue({ leftJoin: txInventoryLeftJoin });

      tx.select
        .mockReturnValueOnce({ from: txFromMock1 })
        .mockReturnValueOnce({ from: txFromMock2 })
        .mockReturnValueOnce({ from: txInventoryFrom });

      const txReturningMock = vi.fn().mockResolvedValue([]);
      const txValuesMock = vi.fn().mockReturnValue({ returning: txReturningMock });
      tx.insert.mockReturnValue({ values: txValuesMock });

      const txDeleteWhere = vi.fn().mockResolvedValue(undefined);
      tx.delete.mockReturnValue({ where: txDeleteWhere });

      const service = makeService(db);
      await service.mergeGuestBasket("guest-token", "customer-id");

      // Should have inserted non-matching items into customer basket
      expect(tx.insert).toHaveBeenCalled();
      // Should have deleted guest session
      expect(tx.delete).toHaveBeenCalled();
    });
  });

  describe("error classes", () => {
    it("BasketNotFoundError has correct code", () => {
      const err = new BasketNotFoundError();
      expect(err.code).toBe("BASKET_NOT_FOUND");
      expect(err).toBeInstanceOf(Error);
    });

    it("InsufficientStockError has correct code", () => {
      const err = new InsufficientStockError("variant-1", 5, 3);
      expect(err.code).toBe("INSUFFICIENT_STOCK");
      expect(err).toBeInstanceOf(Error);
    });
  });
});
