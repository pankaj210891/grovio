import { describe, it, expect, vi } from "vitest";
import { CheckoutService } from "../CheckoutService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeProductServiceMock() {
  return {
    getProductById: vi.fn().mockResolvedValue({
      id: "product-uuid-1",
      basePriceMinor: 1000,
      name: "Widget A",
      vendorId: "vendor-uuid-1",
      categoryId: "cat-uuid-1",
    }),
    // Used for catalog price lookup per variant
    getVariantById: vi.fn().mockResolvedValue({
      id: "variant-uuid-1",
      priceMinor: 1200,
    }),
  };
}

function makeInventoryServiceMock() {
  return {
    reserveItems: vi.fn().mockResolvedValue(["res-uuid-1", "res-uuid-2"]),
  };
}

function makeWalletServiceMock(balance = 5000) {
  return {
    getBalance: vi.fn().mockResolvedValue(balance),
    computeWalletApplied: vi.fn().mockImplementation(
      (bal, req, total) => Math.max(0, Math.min(bal, req, total))
    ),
  };
}

function makeCouponServiceMock(discountMinor = 0) {
  return {
    validateCoupon: vi.fn().mockResolvedValue({
      code: "TEST10",
      discountMinor,
      scopeDescription: "Applies to your entire order",
    }),
  };
}

function makePaymentServiceMock() {
  return {
    createPaymentOrder: vi.fn().mockResolvedValue({
      providerOrderId: "pi_test_abc123",
      clientSecret: "pi_test_abc123_secret",
      providerOrderRef: null,
    }),
  };
}

function makeOrderServiceMock() {
  return {
    createPendingOrder: vi.fn().mockResolvedValue({
      orderId: "order-uuid-1",
      displayId: "ORD-20260603-ABC123",
    }),
  };
}

function makeDbMock() {
  return {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    transaction: vi.fn(),
  };
}

function makeEnv() {
  return { NODE_ENV: "test" };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const CUSTOMER_ID = "customer-uuid-1";
const BASKET_SESSION_ID = "basket-session-uuid-1";
const ADDRESS_ID = "address-uuid-1";

/** Basket items returned from DB — these contain basket snapshot prices */
const basketItemRows = [
  {
    id: "basket-item-1",
    basketSessionId: BASKET_SESSION_ID,
    productId: "product-uuid-1",
    productVariantId: null,
    quantity: 2,
    unitPriceMinor: 9999, // Client-side snapshot price — SHOULD BE IGNORED (CHK-04)
    createdAt: new Date(),
    updatedAt: new Date(),
    // Extended fields from join
    vendorId: "vendor-uuid-1",
    categoryId: "cat-uuid-1",
    productName: "Widget A",
    // CATALOG price (authoritative — re-fetched by CheckoutService)
    catalogPriceMinor: 1000,
  },
];

// ---------------------------------------------------------------------------
// CheckoutService tests
// ---------------------------------------------------------------------------

describe("CheckoutService", () => {
  // ── computeSummary ─────────────────────────────────────────────────────────

  describe("computeSummary()", () => {
    it("uses catalog price from products table, NOT the basket snapshot unitPrice (CHK-04)", async () => {
      // The basket snapshot has a tampered high price (9999) for the item
      // computeSummary must re-fetch from products and use 1000 (catalog price)

      const db = makeDbMock();

      // 1st db.select: basket_sessions (get session)
      const sessionLimitMock = vi.fn().mockResolvedValue([{ id: BASKET_SESSION_ID, customerId: CUSTOMER_ID }]);
      const sessionWhereMock = vi.fn().mockReturnValue({ limit: sessionLimitMock });
      const sessionFromMock = vi.fn().mockReturnValue({ where: sessionWhereMock });

      // 2nd db.select: basket_items (get items)
      const itemsWhereMock = vi.fn().mockResolvedValue(basketItemRows);
      const itemsFromMock = vi.fn().mockReturnValue({ where: itemsWhereMock });

      db.select
        .mockReturnValueOnce({ from: sessionFromMock })
        .mockReturnValueOnce({ from: itemsFromMock });

      // productService re-fetches catalog price (1000, NOT 9999 from basket snapshot)
      const productService = {
        getProductCatalogPrice: vi.fn().mockResolvedValue({ priceMinor: 1000, name: "Widget A" }),
      };

      const svc = new CheckoutService({
        db: db as never,
        productService: productService as never,
        inventoryService: makeInventoryServiceMock() as never,
        walletService: makeWalletServiceMock() as never,
        couponService: makeCouponServiceMock() as never,
        paymentService: makePaymentServiceMock() as never,
        orderService: makeOrderServiceMock() as never,
        env: makeEnv() as never,
      });

      const summary = await svc.computeSummary({
        basketSessionId: BASKET_SESSION_ID,
        customerId: CUSTOMER_ID,
      });

      // Subtotal must use catalog price (1000 * 2 = 2000), NOT snapshot (9999 * 2 = 19998)
      expect(summary.subtotalMinor).toBe(2000);
    });

    it("full-wallet checkout yields grandTotal card-charge of 0 (WAL-05)", async () => {
      // Order total = 2000, wallet balance = 5000, requested = 5000
      // walletApplied = min(5000, 5000, 2000) = 2000
      // grandTotal (card charge) = 2000 - 2000 = 0

      const db = makeDbMock();

      const sessionLimitMock = vi.fn().mockResolvedValue([{ id: BASKET_SESSION_ID, customerId: CUSTOMER_ID }]);
      const sessionWhereMock = vi.fn().mockReturnValue({ limit: sessionLimitMock });
      const sessionFromMock = vi.fn().mockReturnValue({ where: sessionWhereMock });

      const itemsWhereMock = vi.fn().mockResolvedValue(basketItemRows);
      const itemsFromMock = vi.fn().mockReturnValue({ where: itemsWhereMock });

      db.select
        .mockReturnValueOnce({ from: sessionFromMock })
        .mockReturnValueOnce({ from: itemsFromMock });

      const productService = {
        getProductCatalogPrice: vi.fn().mockResolvedValue({ priceMinor: 1000, name: "Widget A" }),
      };

      const walletService = makeWalletServiceMock(5000); // high balance

      const svc = new CheckoutService({
        db: db as never,
        productService: productService as never,
        inventoryService: makeInventoryServiceMock() as never,
        walletService: walletService as never,
        couponService: makeCouponServiceMock() as never,
        paymentService: makePaymentServiceMock() as never,
        orderService: makeOrderServiceMock() as never,
        env: makeEnv() as never,
      });

      const summary = await svc.computeSummary({
        basketSessionId: BASKET_SESSION_ID,
        customerId: CUSTOMER_ID,
        walletRequestedMinor: 5000, // request full wallet
      });

      // walletApplied = min(balance=5000, requested=5000, total=2000) = 2000
      expect(summary.walletAppliedMinor).toBe(2000);
      // grandTotal = total - wallet = 2000 - 2000 = 0
      expect(summary.grandTotalMinor).toBe(0);
    });

    it("partial wallet yields card-charge = total - wallet (WAL-05)", async () => {
      // Order total = 2000, wallet balance = 500, requested = 500
      // walletApplied = min(500, 500, 2000) = 500
      // grandTotal = 2000 - 500 = 1500

      const db = makeDbMock();

      const sessionLimitMock = vi.fn().mockResolvedValue([{ id: BASKET_SESSION_ID, customerId: CUSTOMER_ID }]);
      const sessionWhereMock = vi.fn().mockReturnValue({ limit: sessionLimitMock });
      const sessionFromMock = vi.fn().mockReturnValue({ where: sessionWhereMock });

      const itemsWhereMock = vi.fn().mockResolvedValue(basketItemRows);
      const itemsFromMock = vi.fn().mockReturnValue({ where: itemsWhereMock });

      db.select
        .mockReturnValueOnce({ from: sessionFromMock })
        .mockReturnValueOnce({ from: itemsFromMock });

      const productService = {
        getProductCatalogPrice: vi.fn().mockResolvedValue({ priceMinor: 1000, name: "Widget A" }),
      };

      const walletService = makeWalletServiceMock(500); // partial balance

      const svc = new CheckoutService({
        db: db as never,
        productService: productService as never,
        inventoryService: makeInventoryServiceMock() as never,
        walletService: walletService as never,
        couponService: makeCouponServiceMock() as never,
        paymentService: makePaymentServiceMock() as never,
        orderService: makeOrderServiceMock() as never,
        env: makeEnv() as never,
      });

      const summary = await svc.computeSummary({
        basketSessionId: BASKET_SESSION_ID,
        customerId: CUSTOMER_ID,
        walletRequestedMinor: 500,
      });

      expect(summary.walletAppliedMinor).toBe(500);
      expect(summary.grandTotalMinor).toBe(1500); // 2000 - 500
    });
  });

  // ── initiateCheckout ───────────────────────────────────────────────────────

  describe("initiateCheckout()", () => {
    it("calls inventoryService.reserveItems — reservation at proceed-to-payment, not on basket add (CHK-05)", async () => {
      const db = makeDbMock();

      const sessionLimitMock = vi.fn().mockResolvedValue([{ id: BASKET_SESSION_ID, customerId: CUSTOMER_ID }]);
      const sessionWhereMock = vi.fn().mockReturnValue({ limit: sessionLimitMock });
      const sessionFromMock = vi.fn().mockReturnValue({ where: sessionWhereMock });

      // items with inventoryItemId for reservation
      const itemsWithInv = [
        { ...basketItemRows[0], inventoryItemId: "inv-uuid-1", catalogPriceMinor: 1000 },
      ];
      const itemsWhereMock = vi.fn().mockResolvedValue(itemsWithInv);
      const itemsLeftJoinMock = vi.fn().mockReturnValue({ where: itemsWhereMock });
      const itemsFromMock = vi.fn().mockReturnValue({ leftJoin: itemsLeftJoinMock });

      db.select
        .mockReturnValueOnce({ from: sessionFromMock })
        .mockReturnValueOnce({ from: itemsFromMock });

      const inventoryService = makeInventoryServiceMock();
      const productService = {
        getProductCatalogPrice: vi.fn().mockResolvedValue({ priceMinor: 1000, name: "Widget A" }),
      };

      const svc = new CheckoutService({
        db: db as never,
        productService: productService as never,
        inventoryService: inventoryService as never,
        walletService: makeWalletServiceMock() as never,
        couponService: makeCouponServiceMock() as never,
        paymentService: makePaymentServiceMock() as never,
        orderService: makeOrderServiceMock() as never,
        env: makeEnv() as never,
      });

      await svc.initiateCheckout({
        customerId: CUSTOMER_ID,
        basketSessionId: BASKET_SESSION_ID,
      });

      // reserveItems MUST be called (CHK-05 — reservation at proceed-to-payment)
      expect(inventoryService.reserveItems).toHaveBeenCalled();
    });
  });

  // ── placeOrder ─────────────────────────────────────────────────────────────

  describe("placeOrder()", () => {
    it("passes providerOrderId through to createPendingOrder", async () => {
      const db = makeDbMock();

      const sessionLimitMock = vi.fn().mockResolvedValue([{ id: BASKET_SESSION_ID, customerId: CUSTOMER_ID }]);
      const sessionWhereMock = vi.fn().mockReturnValue({ limit: sessionLimitMock });
      const sessionFromMock = vi.fn().mockReturnValue({ where: sessionWhereMock });

      const itemsWhereMock = vi.fn().mockResolvedValue(basketItemRows);
      const itemsFromMock = vi.fn().mockReturnValue({ where: itemsWhereMock });

      db.select
        .mockReturnValueOnce({ from: sessionFromMock })
        .mockReturnValueOnce({ from: itemsFromMock })
        .mockReturnValueOnce({ from: sessionFromMock }) // second computeSummary call
        .mockReturnValueOnce({ from: itemsFromMock });

      const productService = {
        getProductCatalogPrice: vi.fn().mockResolvedValue({ priceMinor: 1000, name: "Widget A" }),
      };

      const paymentService = makePaymentServiceMock();
      const orderService = makeOrderServiceMock();

      const svc = new CheckoutService({
        db: db as never,
        productService: productService as never,
        inventoryService: makeInventoryServiceMock() as never,
        walletService: makeWalletServiceMock() as never,
        couponService: makeCouponServiceMock() as never,
        paymentService: paymentService as never,
        orderService: orderService as never,
        env: makeEnv() as never,
      });

      await svc.placeOrder({
        customerId: CUSTOMER_ID,
        addressId: ADDRESS_ID,
        basketSessionId: BASKET_SESSION_ID,
        paymentProvider: "stripe",
      });

      // PaymentService must be called (creates provider order)
      expect(paymentService.createPaymentOrder).toHaveBeenCalled();
      // OrderService.createPendingOrder must receive providerOrderId
      expect(orderService.createPendingOrder).toHaveBeenCalledWith(
        expect.objectContaining({
          providerOrderId: "pi_test_abc123",
        })
      );
    });

    it("does NOT import stripe or razorpay directly — uses PaymentService abstraction (T-05-PAY)", async () => {
      // Verify at the module level that CheckoutService has no direct SDK imports
      // This test reads the source file and asserts no SDK import strings
      const fs = await import("fs");
      const path = await import("path");
      const { fileURLToPath } = await import("url");

      const __dirname = path.dirname(fileURLToPath(import.meta.url));
      const svcPath = path.join(__dirname, "..", "CheckoutService.ts");
      const source = fs.readFileSync(svcPath, "utf-8");

      // Must NOT contain direct SDK imports
      expect(source).not.toMatch(/from ["']stripe["']/);
      expect(source).not.toMatch(/from ["']razorpay["']/);
    });
  });
});
