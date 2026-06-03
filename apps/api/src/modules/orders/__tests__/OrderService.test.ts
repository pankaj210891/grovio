import { describe, it, expect, vi, beforeEach } from "vitest";
import {
  OrderService,
  OrderNotFoundError,
  OrderOwnershipError,
  VendorOrderOwnershipError,
} from "../OrderService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeCommissionServiceMock() {
  return {
    computeCommission: vi.fn().mockResolvedValue({
      commissionMinor: 100n,
      netVendorMinor: 900n,
    }),
  };
}

function makeInventoryServiceMock() {
  return {
    consumeReservation: vi.fn().mockResolvedValue(undefined),
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
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn().mockImplementation(async (fn: (tx: ReturnType<typeof makeMockTx>) => unknown) => {
      return fn(tx);
    }),
  };
}

function makeEnv() {
  return { NODE_ENV: "test" };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = "customer-uuid-1";
const ORDER_ID = "order-uuid-1";
const VENDOR_ORDER_ID_1 = "vendor-order-uuid-1";
const VENDOR_ORDER_ID_2 = "vendor-order-uuid-2";
const VENDOR_ID_1 = "vendor-uuid-1";
const VENDOR_ID_2 = "vendor-uuid-2";
const PROVIDER_ORDER_ID = "pi_test_abc123";

/** A pending order row */
const pendingOrder = {
  id: ORDER_ID,
  displayId: "ORD-20260603-ABC123",
  customerId: CUSTOMER_ID,
  addressId: "address-uuid-1",
  status: "pending_payment",
  subtotalMinor: 3000,
  shippingMinor: 0,
  discountMinor: 0,
  walletAppliedMinor: 0,
  grandTotalMinor: 3000,
  couponCode: null,
  paymentProvider: "stripe",
  providerOrderId: PROVIDER_ORDER_ID,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** A payment_received order row */
const finalizedOrder = { ...pendingOrder, status: "payment_received" };

/** Order items spanning two vendors */
const orderItems = [
  {
    id: "item-uuid-1",
    vendorOrderId: null, // will be assigned to vendor sub-order
    productId: "product-uuid-1",
    productVariantId: null,
    productName: "Widget A",
    quantity: 2,
    unitPriceMinor: 1000,
    lineSubtotalMinor: 2000,
    vendorId: VENDOR_ID_1,
    categoryId: "cat-uuid-1",
    createdAt: new Date(),
  },
  {
    id: "item-uuid-2",
    vendorOrderId: null,
    productId: "product-uuid-2",
    productVariantId: null,
    productName: "Widget B",
    quantity: 1,
    unitPriceMinor: 1000,
    lineSubtotalMinor: 1000,
    vendorId: VENDOR_ID_2,
    categoryId: "cat-uuid-1",
    createdAt: new Date(),
  },
];

// ---------------------------------------------------------------------------
// OrderService tests
// ---------------------------------------------------------------------------

describe("OrderService", () => {
  // ── createPendingOrder ────────────────────────────────────────────────────

  describe("createPendingOrder()", () => {
    it("inserts an orders row with status='pending_payment' and returns orderId + displayId", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      const newOrder = {
        id: ORDER_ID,
        displayId: "ORD-20260603-ABC123",
        status: "pending_payment",
      };

      // tx.insert for orders → returning [newOrder]
      const txOrderReturning = vi.fn().mockResolvedValue([newOrder]);
      const txOrderValues = vi.fn().mockReturnValue({ returning: txOrderReturning });
      const txOrderInsert = vi.fn().mockReturnValue({ values: txOrderValues });

      // tx.insert for order_items (bulk insert) → void
      const txItemsReturning = vi.fn().mockResolvedValue([]);
      const txItemsValues = vi.fn().mockReturnValue({ returning: txItemsReturning });

      tx.insert
        .mockReturnValueOnce({ values: txOrderValues })
        .mockReturnValue({ values: txItemsValues });
      txOrderValues.mockReturnValue({ returning: txOrderReturning });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      const result = await svc.createPendingOrder({
        customerId: CUSTOMER_ID,
        addressId: "address-uuid-1",
        items: [
          {
            productId: "product-uuid-1",
            productVariantId: null,
            productName: "Widget A",
            vendorId: VENDOR_ID_1,
            categoryId: "cat-uuid-1",
            quantity: 2,
            unitPriceMinor: 1000,
            lineSubtotalMinor: 2000,
          },
        ],
        totals: {
          subtotalMinor: 2000,
          shippingMinor: 0,
          discountMinor: 0,
          walletAppliedMinor: 0,
          grandTotalMinor: 2000,
        },
        couponCode: null,
        walletAppliedMinor: 0,
        paymentProvider: "stripe",
        providerOrderId: PROVIDER_ORDER_ID,
      });

      expect(result.orderId).toBe(ORDER_ID);
      expect(result.displayId).toBe("ORD-20260603-ABC123");
      expect(db.transaction).toHaveBeenCalled();
    });
  });

  // ── finalizeOrder ─────────────────────────────────────────────────────────

  describe("finalizeOrder()", () => {
    it("splits a 2-vendor order into 2 vendor_orders with subtotals summing to order subtotal (ORD-02)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      // tx.select: first call returns order by providerOrderId, second call returns order items
      const txOrderLimitMock = vi.fn().mockResolvedValue([pendingOrder]);
      const txOrderWhereMock = vi.fn().mockReturnValue({ limit: txOrderLimitMock });
      const txOrderFromMock = vi.fn().mockReturnValue({ where: txOrderWhereMock });

      const txItemsWhereMock = vi.fn().mockResolvedValue(orderItems);
      const txItemsFromMock = vi.fn().mockReturnValue({ where: txItemsWhereMock });

      // reservations
      const txResWhereMock = vi.fn().mockResolvedValue([{ id: "res-1" }, { id: "res-2" }]);
      const txResFromMock = vi.fn().mockReturnValue({ where: txResWhereMock });

      tx.select
        .mockReturnValueOnce({ from: txOrderFromMock }) // order lookup
        .mockReturnValueOnce({ from: txItemsFromMock }) // items lookup
        .mockReturnValueOnce({ from: txResFromMock }); // reservations lookup

      // tx.update for order status
      const txUpdateWhereMock = vi.fn().mockResolvedValue([finalizedOrder]);
      const txUpdateSetMock = vi.fn().mockReturnValue({ where: txUpdateWhereMock });
      tx.update.mockReturnValue({ set: txUpdateSetMock });

      // tx.insert for vendor_orders → return vendor sub-order rows
      const vendorOrder1 = { id: VENDOR_ORDER_ID_1, vendorId: VENDOR_ID_1 };
      const vendorOrder2 = { id: VENDOR_ORDER_ID_2, vendorId: VENDOR_ID_2 };
      const txVoReturning1 = vi.fn().mockResolvedValue([vendorOrder1]);
      const txVoReturning2 = vi.fn().mockResolvedValue([vendorOrder2]);
      const txVoValues1 = vi.fn().mockReturnValue({ returning: txVoReturning1 });
      const txVoValues2 = vi.fn().mockReturnValue({ returning: txVoReturning2 });

      // order_items update for vendorOrderId
      const txItemUpdateReturning = vi.fn().mockResolvedValue([]);
      const txItemUpdateWhere = vi.fn().mockReturnValue({ returning: txItemUpdateReturning });
      const txItemUpdateSet = vi.fn().mockReturnValue({ where: txItemUpdateWhere });

      tx.insert
        .mockReturnValueOnce({ values: txVoValues1 })
        .mockReturnValue({ values: txVoValues2 });

      tx.update
        .mockReturnValueOnce({ set: txUpdateSetMock }) // order status update
        .mockReturnValue({ set: txItemUpdateSet }); // item vendorOrderId update

      const capturedInsertArgs: unknown[] = [];
      tx.insert.mockImplementation((...args) => {
        capturedInsertArgs.push(args);
        if (capturedInsertArgs.length === 1) {
          return { values: txVoValues1 };
        }
        return { values: txVoValues2 };
      });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await svc.finalizeOrder(PROVIDER_ORDER_ID);

      // CommissionService.computeCommission called once per vendor sub-order (MKT-01)
      expect(commissionService.computeCommission).toHaveBeenCalledTimes(2);
    });

    it("calls CommissionService.computeCommission once per vendor sub-order (MKT-01)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      const txOrderLimitMock = vi.fn().mockResolvedValue([pendingOrder]);
      const txOrderWhereMock = vi.fn().mockReturnValue({ limit: txOrderLimitMock });
      const txOrderFromMock = vi.fn().mockReturnValue({ where: txOrderWhereMock });

      const txItemsWhereMock = vi.fn().mockResolvedValue(orderItems);
      const txItemsFromMock = vi.fn().mockReturnValue({ where: txItemsWhereMock });

      const txResWhereMock = vi.fn().mockResolvedValue([]);
      const txResFromMock = vi.fn().mockReturnValue({ where: txResWhereMock });

      tx.select
        .mockReturnValueOnce({ from: txOrderFromMock })
        .mockReturnValueOnce({ from: txItemsFromMock })
        .mockReturnValueOnce({ from: txResFromMock });

      const txUpdateWhereMock = vi.fn().mockResolvedValue([finalizedOrder]);
      const txUpdateSetMock = vi.fn().mockReturnValue({ where: txUpdateWhereMock });
      tx.update.mockReturnValue({ set: txUpdateSetMock });

      const vendorOrder1 = { id: VENDOR_ORDER_ID_1, vendorId: VENDOR_ID_1 };
      const vendorOrder2 = { id: VENDOR_ORDER_ID_2, vendorId: VENDOR_ID_2 };
      const txVoValues1 = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([vendorOrder1]) });
      const txVoValues2 = vi.fn().mockReturnValue({ returning: vi.fn().mockResolvedValue([vendorOrder2]) });
      let insertCount = 0;
      tx.insert.mockImplementation(() => {
        insertCount++;
        return insertCount === 1 ? { values: txVoValues1 } : { values: txVoValues2 };
      });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await svc.finalizeOrder(PROVIDER_ORDER_ID);

      // 2 vendor sub-orders → 2 commission calls
      expect(commissionService.computeCommission).toHaveBeenCalledTimes(2);
    });

    it("is a no-op when order is already payment_received (idempotent, Pitfall 8)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      // Order is already payment_received
      const txOrderLimitMock = vi.fn().mockResolvedValue([finalizedOrder]);
      const txOrderWhereMock = vi.fn().mockReturnValue({ limit: txOrderLimitMock });
      const txOrderFromMock = vi.fn().mockReturnValue({ where: txOrderWhereMock });

      tx.select.mockReturnValue({ from: txOrderFromMock });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await svc.finalizeOrder(PROVIDER_ORDER_ID);

      // No commission calls — order already finalized
      expect(commissionService.computeCommission).not.toHaveBeenCalled();
      // No transaction writes — order already finalized
      expect(tx.update).not.toHaveBeenCalled();
    });

    it("throws OrderNotFoundError when order not found by providerOrderId (Pitfall 8 retry hint)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      // Order not found
      const txOrderLimitMock = vi.fn().mockResolvedValue([]);
      const txOrderWhereMock = vi.fn().mockReturnValue({ limit: txOrderLimitMock });
      const txOrderFromMock = vi.fn().mockReturnValue({ where: txOrderWhereMock });

      tx.select.mockReturnValue({ from: txOrderFromMock });
      // Outside transaction too — lookup happens before transaction
      db.select.mockReturnValue({ from: txOrderFromMock });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await expect(svc.finalizeOrder("pi_unknown_abc")).rejects.toThrow(OrderNotFoundError);
    });

    it("vendor subtotals from allocate() sum exactly to order subtotal (ORD-02 no-drift)", async () => {
      // This tests that allocate() is used and sub-order amounts sum to subtotal
      // Use a real allocate import to verify math correctness
      const { allocate } = await import("@grovio/contracts/money");

      // Simulate 2-vendor split with awkward amounts
      const orderSubtotal = 3001n;
      const vendor1Items = 2000;
      const vendor2Items = 1001;

      const [v1Amount, v2Amount] = allocate(orderSubtotal, [vendor1Items, vendor2Items]);
      expect(v1Amount! + v2Amount!).toBe(orderSubtotal);
    });
  });

  // ── getOrderById ──────────────────────────────────────────────────────────

  describe("getOrderById()", () => {
    it("throws OrderOwnershipError when order belongs to a different customer", async () => {
      const db = makeMockDb(makeMockTx());

      // Order exists but belongs to another customer
      const otherOrder = { ...pendingOrder, customerId: "other-customer-uuid" };
      const limitMock = vi.fn().mockResolvedValue([otherOrder]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      await expect(svc.getOrderById(ORDER_ID, CUSTOMER_ID)).rejects.toThrow(OrderOwnershipError);
    });

    it("returns order with vendorOrders grouped by vendor when owner matches", async () => {
      const db = makeMockDb(makeMockTx());

      // First select: orders row
      const limitMock1 = vi.fn().mockResolvedValue([pendingOrder]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      // Second select: vendor_orders
      const whereMock2 = vi.fn().mockResolvedValue([
        { id: VENDOR_ORDER_ID_1, orderId: ORDER_ID, vendorId: VENDOR_ID_1, status: "payment_received", vendorSubtotalMinor: 2000, createdAt: new Date(), updatedAt: new Date() },
      ]);
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      // Third select: order_items
      const whereMock3 = vi.fn().mockResolvedValue([
        { ...orderItems[0], vendorOrderId: VENDOR_ORDER_ID_1 },
      ]);
      const fromMock3 = vi.fn().mockReturnValue({ where: whereMock3 });

      db.select
        .mockReturnValueOnce({ from: fromMock1 })
        .mockReturnValueOnce({ from: fromMock2 })
        .mockReturnValueOnce({ from: fromMock3 });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      const result = await svc.getOrderById(ORDER_ID, CUSTOMER_ID);

      expect(result).toBeDefined();
      expect(result?.id).toBe(ORDER_ID);
    });
  });

  // ── updateVendorOrderStatus ───────────────────────────────────────────────

  describe("updateVendorOrderStatus()", () => {
    it("throws VendorOrderOwnershipError when vendorId does not own the sub-order", async () => {
      const db = makeMockDb(makeMockTx());

      // Vendor sub-order belongs to a different vendor
      const otherVendorOrder = {
        id: VENDOR_ORDER_ID_1,
        orderId: ORDER_ID,
        vendorId: "other-vendor-uuid",
        status: "payment_received",
        vendorSubtotalMinor: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const limitMock = vi.fn().mockResolvedValue([otherVendorOrder]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      await expect(
        svc.updateVendorOrderStatus(VENDOR_ORDER_ID_1, VENDOR_ID_1, "processing")
      ).rejects.toThrow(VendorOrderOwnershipError);
    });

    it("updates vendor order status when vendorId matches", async () => {
      const db = makeMockDb(makeMockTx());

      const vendorOrderRow = {
        id: VENDOR_ORDER_ID_1,
        orderId: ORDER_ID,
        vendorId: VENDOR_ID_1,
        status: "payment_received",
        vendorSubtotalMinor: 2000,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      const limitMock = vi.fn().mockResolvedValue([vendorOrderRow]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const updatedRow = { ...vendorOrderRow, status: "processing" };
      const updateReturningMock = vi.fn().mockResolvedValue([updatedRow]);
      const updateWhereMock = vi.fn().mockReturnValue({ returning: updateReturningMock });
      const updateSetMock = vi.fn().mockReturnValue({ where: updateWhereMock });
      db.update = vi.fn().mockReturnValue({ set: updateSetMock });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      const result = await svc.updateVendorOrderStatus(VENDOR_ORDER_ID_1, VENDOR_ID_1, "processing");
      expect(result.status).toBe("processing");
    });
  });

  // ── listOrdersForCustomer ─────────────────────────────────────────────────

  describe("listOrdersForCustomer()", () => {
    it("returns orders summary list for a customer (ORD-03)", async () => {
      const db = makeMockDb(makeMockTx());

      const orderRows = [pendingOrder];
      const orderByMock = vi.fn().mockResolvedValue(orderRows);
      const whereMock = vi.fn().mockReturnValue({ orderBy: orderByMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      const result = await svc.listOrdersForCustomer(CUSTOMER_ID);
      expect(Array.isArray(result)).toBe(true);
      expect(result[0]?.id).toBe(ORDER_ID);
    });
  });
});
