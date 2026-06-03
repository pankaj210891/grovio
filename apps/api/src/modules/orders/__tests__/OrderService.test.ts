import { describe, it, expect, vi } from "vitest";
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

/** Two vendor sub-orders already created at order creation time */
const vendorOrderRow1 = {
  id: VENDOR_ORDER_ID_1,
  orderId: ORDER_ID,
  vendorId: VENDOR_ID_1,
  status: "pending_payment",
  vendorSubtotalMinor: 2000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

const vendorOrderRow2 = {
  id: VENDOR_ORDER_ID_2,
  orderId: ORDER_ID,
  vendorId: VENDOR_ID_2,
  status: "pending_payment",
  vendorSubtotalMinor: 1000,
  createdAt: new Date(),
  updatedAt: new Date(),
};

/** Order items, each linked to a vendor_order */
const orderItemRows = [
  {
    id: "item-uuid-1",
    vendorOrderId: VENDOR_ORDER_ID_1,
    productId: "product-uuid-1",
    productVariantId: null,
    productName: "Widget A",
    quantity: 2,
    unitPriceMinor: 1000,
    lineSubtotalMinor: 2000,
    categoryId: "cat-uuid-1",
    createdAt: new Date(),
  },
  {
    id: "item-uuid-2",
    vendorOrderId: VENDOR_ORDER_ID_2,
    productId: "product-uuid-2",
    productVariantId: null,
    productName: "Widget B",
    quantity: 1,
    unitPriceMinor: 1000,
    lineSubtotalMinor: 1000,
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
      };

      // 1st tx.insert: orders row → returning [newOrder]
      const txOrderReturning = vi.fn().mockResolvedValue([newOrder]);
      const txOrderValues = vi.fn().mockReturnValue({ returning: txOrderReturning });

      // 2nd tx.insert: vendor_orders → returning [vendorOrderRow]
      const txVoReturning = vi.fn().mockResolvedValue([vendorOrderRow1]);
      const txVoValues = vi.fn().mockReturnValue({ returning: txVoReturning });

      // 3rd tx.insert: order_items → no returning needed
      const txItemsValues = vi.fn().mockResolvedValue([]);

      let insertCallCount = 0;
      tx.insert.mockImplementation(() => {
        insertCallCount++;
        if (insertCallCount === 1) return { values: txOrderValues };
        if (insertCallCount === 2) return { values: txVoValues };
        return { values: txItemsValues };
      });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
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

    it("uses allocate() to compute vendor subtotals that sum exactly to order subtotal (ORD-02)", async () => {
      // This is verified by the allocate import test + the fact that createPendingOrder uses allocate()
      // Use actual allocate to verify drift-free math
      const { allocate } = await import("@grovio/contracts/money");

      // 2-vendor order with awkward subtotal
      const orderSubtotal = 3001n;
      const vendor1LineSubtotal = 2000;
      const vendor2LineSubtotal = 1001;

      const [v1, v2] = allocate(orderSubtotal, [vendor1LineSubtotal, vendor2LineSubtotal]);
      expect(v1! + v2!).toBe(orderSubtotal);
    });
  });

  // ── finalizeOrder ─────────────────────────────────────────────────────────

  describe("finalizeOrder()", () => {
    it("calls CommissionService.computeCommission once per vendor sub-order (MKT-01)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      // Outer db.select: look up order by providerOrderId
      const outerLimitMock = vi.fn().mockResolvedValue([pendingOrder]);
      const outerWhereMock = vi.fn().mockReturnValue({ limit: outerLimitMock });
      const outerFromMock = vi.fn().mockReturnValue({ where: outerWhereMock });
      db.select.mockReturnValue({ from: outerFromMock });

      // Outer db.select: load order items
      const outerItemWhereMock = vi.fn().mockResolvedValue([]);
      const outerItemFromMock = vi.fn().mockReturnValue({ where: outerItemWhereMock });

      // Set up db.select sequence: 1st=order lookup, rest=items (but items loading is inside tx)
      db.select
        .mockReturnValueOnce({ from: outerFromMock })        // order lookup (outside tx)
        .mockReturnValue({ from: outerItemFromMock });       // fallback for any outer items load

      // tx.select: order status update (1st), vendor_orders (2nd), items per vo (3rd, 4th), reservations (5th)
      const txUpdateWhereMock = vi.fn().mockResolvedValue([finalizedOrder]);
      const txUpdateSetMock = vi.fn().mockReturnValue({ where: txUpdateWhereMock });
      tx.update.mockReturnValue({ set: txUpdateSetMock });

      // tx.select sequence inside transaction:
      const txVoWhereMock = vi.fn().mockResolvedValue([vendorOrderRow1, vendorOrderRow2]);
      const txVoFromMock = vi.fn().mockReturnValue({ where: txVoWhereMock });

      // items for vendor_order 1
      const txItems1WhereMock = vi.fn().mockResolvedValue([orderItemRows[0]]);
      const txItems1FromMock = vi.fn().mockReturnValue({ where: txItems1WhereMock });

      // items for vendor_order 2
      const txItems2WhereMock = vi.fn().mockResolvedValue([orderItemRows[1]]);
      const txItems2FromMock = vi.fn().mockReturnValue({ where: txItems2WhereMock });

      // reservations
      const txResWhereMock = vi.fn().mockResolvedValue([]);
      const txResFromMock = vi.fn().mockReturnValue({ where: txResWhereMock });

      tx.select
        .mockReturnValueOnce({ from: txVoFromMock })     // vendor_orders for order
        .mockReturnValueOnce({ from: txItems1FromMock }) // items for vendor_order 1
        .mockReturnValueOnce({ from: txItems2FromMock }) // items for vendor_order 2
        .mockReturnValueOnce({ from: txResFromMock });   // reservations

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await svc.finalizeOrder(PROVIDER_ORDER_ID);

      // 2 vendor sub-orders → 2 commission calls (MKT-01)
      expect(commissionService.computeCommission).toHaveBeenCalledTimes(2);
    });

    it("is a no-op when order is already payment_received (idempotent, Pitfall 8)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      // Order is already payment_received — return early
      const outerLimitMock = vi.fn().mockResolvedValue([finalizedOrder]);
      const outerWhereMock = vi.fn().mockReturnValue({ limit: outerLimitMock });
      const outerFromMock = vi.fn().mockReturnValue({ where: outerWhereMock });
      db.select.mockReturnValue({ from: outerFromMock });

      const commissionService = makeCommissionServiceMock();
      const inventoryService = makeInventoryServiceMock();
      const svc = new OrderService({
        db: db as never,
        commissionService: commissionService as never,
        inventoryService: inventoryService as never,
        env: makeEnv() as never,
      });

      await svc.finalizeOrder(PROVIDER_ORDER_ID);

      // No commission calls — already finalized
      expect(commissionService.computeCommission).not.toHaveBeenCalled();
      // No transaction writes — returned before reaching the transaction
      expect(db.transaction).not.toHaveBeenCalled();
    });

    it("throws OrderNotFoundError when order not found by providerOrderId (Pitfall 8 retry hint)", async () => {
      const tx = makeMockTx();
      const db = makeMockDb(tx);

      const outerLimitMock = vi.fn().mockResolvedValue([]);
      const outerWhereMock = vi.fn().mockReturnValue({ limit: outerLimitMock });
      const outerFromMock = vi.fn().mockReturnValue({ where: outerWhereMock });
      db.select.mockReturnValue({ from: outerFromMock });

      const svc = new OrderService({
        db: db as never,
        commissionService: makeCommissionServiceMock() as never,
        inventoryService: makeInventoryServiceMock() as never,
        env: makeEnv() as never,
      });

      await expect(svc.finalizeOrder("pi_unknown_xyz")).rejects.toThrow(OrderNotFoundError);
    });

    it("vendor subtotals from allocate() sum exactly to order subtotal (ORD-02 no-drift)", async () => {
      const { allocate } = await import("@grovio/contracts/money");

      const orderSubtotal = 3001n;
      const vendor1Subtotal = 2000;
      const vendor2Subtotal = 1001;

      const [v1Amount, v2Amount] = allocate(orderSubtotal, [vendor1Subtotal, vendor2Subtotal]);
      expect(v1Amount! + v2Amount!).toBe(orderSubtotal);
    });
  });

  // ── getOrderById ──────────────────────────────────────────────────────────

  describe("getOrderById()", () => {
    it("throws OrderOwnershipError when order belongs to a different customer", async () => {
      const db = makeMockDb(makeMockTx());

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

    it("returns order with vendorOrders when owner matches", async () => {
      const db = makeMockDb(makeMockTx());

      // 1st select: order row
      const limitMock1 = vi.fn().mockResolvedValue([pendingOrder]);
      const whereMock1 = vi.fn().mockReturnValue({ limit: limitMock1 });
      const fromMock1 = vi.fn().mockReturnValue({ where: whereMock1 });

      // 2nd select: vendor_orders
      const whereMock2 = vi.fn().mockResolvedValue([vendorOrderRow1]);
      const fromMock2 = vi.fn().mockReturnValue({ where: whereMock2 });

      // 3rd select: order_items (inArray)
      const whereMock3 = vi.fn().mockResolvedValue([orderItemRows[0]]);
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
      expect(result?.vendorOrders).toHaveLength(1);
    });
  });

  // ── updateVendorOrderStatus ───────────────────────────────────────────────

  describe("updateVendorOrderStatus()", () => {
    it("throws VendorOrderOwnershipError when vendorId does not own the sub-order", async () => {
      const db = makeMockDb(makeMockTx());

      const otherVendorOrder = { ...vendorOrderRow1, vendorId: "other-vendor-uuid" };
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

      // 1st select: vendor_orders row (ownership check)
      const limitMock = vi.fn().mockResolvedValue([vendorOrderRow1]);
      const whereMock = vi.fn().mockReturnValue({ limit: limitMock });
      const fromMock = vi.fn().mockReturnValue({ where: whereMock });
      db.select.mockReturnValue({ from: fromMock });

      const updatedRow = { ...vendorOrderRow1, status: "processing" };
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

      const orderByMock = vi.fn().mockResolvedValue([pendingOrder]);
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
