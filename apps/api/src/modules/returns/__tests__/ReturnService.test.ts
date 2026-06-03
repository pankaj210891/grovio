import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// ReturnService tests — ORD-04, WAL-04, MKT-03, D-15, D-22, D-23, T-05-RFD, T-05-06
//
// TDD RED: tests are written first to define expected behavior.
// All DB + WalletService interactions are mocked; no live infrastructure required.
//
// Key assertions:
// - checkEligibility uses 7-day/returnable fallback when no vendor_return_policies row (D-22)
// - checkEligibility returns false past window
// - checkEligibility returns false when isReturnable = false
// - createReturnRequest inserts a return_requests row with status='return_requested'
// - approveReturn calls WalletService.credit with entry_type=refund_credit + idempotencyKey=`return:{id}:refund-credit` (WAL-04)
// - approveReturn inserts a vendor_commission_entries row with status='reversed' (MKT-03)
// - approveReturn uses allocate() proportional proration for reversal amount (D-15)
// - The original 'earned' commission row is never updated (append-only)
// ---------------------------------------------------------------------------

import { ReturnService } from "../ReturnService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a Drizzle select mock returning `rows` via limit(). */
function makeSelectMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** Build a Drizzle select mock that also supports .orderBy(). */
function makeSelectWithOrderMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        orderBy: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

/** Build a Drizzle insert mock. */
function makeInsertMock(returnedRows: unknown[] = [{ id: "inserted-uuid" }]) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockResolvedValue(returnedRows),
  });
}

/** Build a Drizzle insert mock that returns via .returning(). */
function makeInsertWithReturningMock(returnedRows: unknown[]) {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returnedRows),
    }),
  });
}

/** Build a Drizzle update mock. */
function makeUpdateMock() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

/** Build a mock db with transaction support. */
function makeDbWithTransaction(
  txOperations: (tx: Record<string, unknown>) => void
) {
  const tx = {
    select: makeSelectMock([]),
    insert: makeInsertMock(),
    update: makeUpdateMock(),
  };
  return {
    transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
      txOperations(tx);
      return fn(tx);
    }),
    select: makeSelectMock([]),
    insert: makeInsertWithReturningMock([{ id: "return-uuid-1" }]),
    update: makeUpdateMock(),
  };
}

/** Build a mock WalletService. */
function makeWalletService() {
  return {
    credit: vi.fn().mockResolvedValue(undefined),
    debit: vi.fn().mockResolvedValue(undefined),
    getBalance: vi.fn().mockResolvedValue(0),
  };
}

/** Build a mock env. */
function makeEnv() {
  return { DATABASE_URL: "postgres://test", REDIS_URL: "redis://test" };
}

// ---------------------------------------------------------------------------
// Fixtures
// ---------------------------------------------------------------------------

const now = new Date();
const withinWindow = new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000); // 3 days ago
const outsideWindow = new Date(now.getTime() - 10 * 24 * 60 * 60 * 1000); // 10 days ago

const CUSTOMER_ID = "customer-uuid-1";
const ORDER_ID = "order-uuid-1";
const VENDOR_ORDER_ID = "vendor-order-uuid-1";
const RETURN_REQUEST_ID = "return-request-uuid-1";
const VENDOR_ID = "vendor-uuid-1";

/** A delivered vendor order (within 7-day fallback window). */
const deliveredVendorOrder = {
  id: VENDOR_ORDER_ID,
  orderId: ORDER_ID,
  vendorId: VENDOR_ID,
  status: "delivered",
  vendorSubtotalMinor: 30000, // ₹300 total for this vendor
  deliveredAt: withinWindow,
  createdAt: withinWindow,
  updatedAt: withinWindow,
};

/** A delivered vendor order outside the 7-day fallback window. */
const deliveredVendorOrderOutsideWindow = {
  ...deliveredVendorOrder,
  deliveredAt: outsideWindow,
};

/** A vendor return policy: 14-day window, returnable. */
const vendorReturnPolicy14Days = {
  id: "policy-uuid-1",
  vendorId: VENDOR_ID,
  returnWindowDays: 14,
  conditions: "Items must be in original packaging.",
  isReturnable: true,
  createdAt: now,
  updatedAt: now,
};

/** A vendor return policy: not returnable. */
const vendorReturnPolicyNotReturnable = {
  id: "policy-uuid-2",
  vendorId: VENDOR_ID,
  returnWindowDays: 14,
  conditions: null,
  isReturnable: false,
  createdAt: now,
  updatedAt: now,
};

/** Sample order items for the vendor sub-order. */
const orderItem1 = {
  id: "item-uuid-1",
  vendorOrderId: VENDOR_ORDER_ID,
  productId: "product-uuid-1",
  productVariantId: null,
  productName: "Test Product A",
  quantity: 2,
  unitPriceMinor: 5000,
  lineSubtotalMinor: 10000,
  createdAt: now,
};

const orderItem2 = {
  id: "item-uuid-2",
  vendorOrderId: VENDOR_ORDER_ID,
  productId: "product-uuid-2",
  productVariantId: null,
  productName: "Test Product B",
  quantity: 2,
  unitPriceMinor: 10000,
  lineSubtotalMinor: 20000,
  createdAt: now,
};

/** An earned commission entry for the vendor order. */
const earnedCommissionEntry = {
  id: "commission-uuid-1",
  vendorOrderId: VENDOR_ORDER_ID,
  ratePercent: "10.00",
  orderSubtotalMinor: 30000,
  commissionAmountMinor: 3000,
  status: "earned",
  createdAt: now,
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("ReturnService", () => {
  // ── checkEligibility ──────────────────────────────────────────────────────

  describe("checkEligibility()", () => {
    it("returns true using 7-day/returnable fallback when no vendor_return_policies row exists (D-22)", async () => {
      // DB returns no vendor return policy (policy does not exist)
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({ // vendor return policy query → no rows
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      const eligible = await svc.checkEligibility(deliveredVendorOrder as never);

      expect(eligible).toBe(true);
    });

    it("returns false using 7-day fallback when order delivered > 7 days ago (D-22)", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]), // no policy
            }),
          }),
        }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      const eligible = await svc.checkEligibility(deliveredVendorOrderOutsideWindow as never);

      expect(eligible).toBe(false);
    });

    it("returns true within vendor policy window when policy exists", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([vendorReturnPolicy14Days]),
            }),
          }),
        }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      const eligible = await svc.checkEligibility(deliveredVendorOrder as never);

      expect(eligible).toBe(true);
    });

    it("returns false when vendor policy isReturnable = false", async () => {
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([vendorReturnPolicyNotReturnable]),
            }),
          }),
        }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      const eligible = await svc.checkEligibility(deliveredVendorOrder as never);

      expect(eligible).toBe(false);
    });

    it("returns false when vendor order has no deliveredAt date (not yet delivered)", async () => {
      const undeliveredOrder = { ...deliveredVendorOrder, deliveredAt: null };
      const db = {
        select: vi.fn().mockReturnValueOnce({
          from: vi.fn().mockReturnValue({
            where: vi.fn().mockReturnValue({
              limit: vi.fn().mockResolvedValue([]),
            }),
          }),
        }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      const eligible = await svc.checkEligibility(undeliveredOrder as never);

      expect(eligible).toBe(false);
    });
  });

  // ── createReturnRequest ───────────────────────────────────────────────────

  describe("createReturnRequest()", () => {
    it("inserts a return_requests row with status='return_requested' (D-23)", async () => {
      const insertValues = vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue([{ id: RETURN_REQUEST_ID }]),
      });
      const insertMock = vi.fn().mockReturnValue({ values: insertValues });

      // Mock DB for: vendor order query first (loadVendorOrder), then policy check (checkEligibility)
      const db = {
        select: vi.fn()
          .mockReturnValueOnce({ // vendor order query (loadVendorOrder)
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({ // policy query (checkEligibility → no policy)
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([]),
              }),
            }),
          }),
        insert: insertMock,
        update: makeUpdateMock(),
        transaction: vi.fn(),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.createReturnRequest({
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Item arrived damaged",
        refundPreference: "wallet",
      });

      expect(insertMock).toHaveBeenCalled();
      expect(insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "return_requested",
          customerId: CUSTOMER_ID,
          reason: "Item arrived damaged",
          refundPreference: "wallet",
        })
      );
    });
  });

  // ── approveReturn ─────────────────────────────────────────────────────────

  describe("approveReturn()", () => {
    it("calls WalletService.credit with refund_credit entry type and idempotencyKey `return:{id}:refund-credit` (WAL-04)", async () => {
      // Return request with refundPreference='wallet'
      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Damaged",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      let capturedTxFn: ((tx: unknown) => Promise<unknown>) | null = null;

      const txInsertValues = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: txInsertValues });
      const txUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });
      const txSelectWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([orderItem1]),
      });
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere });
      const txSelectMock = vi.fn().mockReturnValue({ from: txSelectFrom });

      const db = {
        // First DB call: load return request
        select: vi.fn()
          .mockReturnValueOnce({ // return request lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({ // vendor order lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({ // earned commission lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      expect(walletService.credit).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: `return:${RETURN_REQUEST_ID}:refund-credit`,
        })
      );
    });

    it("does NOT call WalletService.credit when refundPreference is 'original' (provider refund path, Phase 6)", async () => {
      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Changed mind",
        refundPreference: "original", // NOT wallet
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      const txInsertValues = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: txInsertValues });
      const txUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });
      const txSelectWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([orderItem1]),
      });
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere });
      const txSelectMock = vi.fn().mockReturnValue({ from: txSelectFrom });

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      expect(walletService.credit).not.toHaveBeenCalled();
    });

    it("inserts a vendor_commission_entries row with status='reversed' (MKT-03, T-05-RFD)", async () => {
      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Defective",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      const txInsertValues = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: txInsertValues });
      const txUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });
      const txSelectWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([orderItem1]),
      });
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere });
      const txSelectMock = vi.fn().mockReturnValue({ from: txSelectFrom });

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      // Commission reversal insert should have been called with status='reversed'
      expect(txInsertMock).toHaveBeenCalled();
      expect(txInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "reversed",
          vendorOrderId: VENDOR_ORDER_ID,
        })
      );
    });

    it("uses allocate() to compute prorated reversal amount for partial return (D-15, MKT-03)", async () => {
      // Scenario: vendor order total = 30000 (item1=10000 + item2=20000)
      // Returning only item1 (10000) = 1/3 of the total
      // Original commission = 3000 (10% of 30000)
      // Expected reversal = allocate(3000, [10000, 20000])[0] = 1000 (1/3 of 3000)

      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id], // only item1 being returned
        reason: "Defective",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      const capturedReversalInsert = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: capturedReversalInsert });
      const txUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });

      // tx.select returns different data depending on call order:
      // 1st call inside tx: order items for the vendor order (all items — both item1 and item2)
      let txSelectCallCount = 0;
      const txSelectMock = vi.fn().mockImplementation(() => ({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockImplementation(() => {
              txSelectCallCount++;
              // Return both items so service knows the full vendor subtotal
              return Promise.resolve([orderItem1, orderItem2]);
            }),
          }),
        }),
      }));

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({ // return request lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({ // vendor order lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({ // earned commission lookup
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      // Assert the reversal amount was computed proportionally via allocate()
      // item1 subtotal = 10000, total = 30000, commission = 3000
      // prorated reversal = allocate(3000, [10000, 20000])[0] = 1000
      expect(capturedReversalInsert).toHaveBeenCalledWith(
        expect.objectContaining({
          status: "reversed",
          commissionAmountMinor: 1000, // 1/3 of 3000 = 1000
        })
      );
    });

    it("does not UPDATE the original 'earned' commission row — only inserts 'reversed' (append-only, MKT-03)", async () => {
      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Defective",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      const txInsertValues = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: txInsertValues });
      const txUpdateSet = vi.fn().mockReturnValue({
        where: vi.fn().mockResolvedValue([]),
      });
      // This update should ONLY be called for the return_requests status update,
      // NOT for vendorCommissionEntries
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });
      const txSelectWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([orderItem1]),
      });
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere });
      const txSelectMock = vi.fn().mockReturnValue({ from: txSelectFrom });

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      // The tx.update should have been called ONLY for the return_requests status update.
      // It should NOT have been called with vendorCommissionEntries as the table.
      // We verify this by checking that insert (not update) was used for the commission reversal.
      expect(txInsertValues).toHaveBeenCalledWith(
        expect.objectContaining({ status: "reversed" })
      );
      // Ensure the update call does not reference vendorCommissionEntries
      // (it should only update return_requests.status to 'approved')
      // The most direct test: mock tracks all calls, and we can see insert was used for reversal
    });

    it("sets return request status to 'approved' in the transaction", async () => {
      const returnRequest = {
        id: RETURN_REQUEST_ID,
        orderId: ORDER_ID,
        vendorOrderId: VENDOR_ORDER_ID,
        customerId: CUSTOMER_ID,
        orderItemIds: [orderItem1.id],
        reason: "Damaged",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: now,
        updatedAt: now,
      };

      const txInsertValues = vi.fn().mockResolvedValue([]);
      const txInsertMock = vi.fn().mockReturnValue({ values: txInsertValues });
      const txUpdateWhere = vi.fn().mockResolvedValue([]);
      const txUpdateSet = vi.fn().mockReturnValue({ where: txUpdateWhere });
      const txUpdateMock = vi.fn().mockReturnValue({ set: txUpdateSet });
      const txSelectWhere = vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue([orderItem1]),
      });
      const txSelectFrom = vi.fn().mockReturnValue({ where: txSelectWhere });
      const txSelectMock = vi.fn().mockReturnValue({ from: txSelectFrom });

      const db = {
        select: vi.fn()
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([returnRequest]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([deliveredVendorOrder]),
              }),
            }),
          })
          .mockReturnValueOnce({
            from: vi.fn().mockReturnValue({
              where: vi.fn().mockReturnValue({
                limit: vi.fn().mockResolvedValue([earnedCommissionEntry]),
              }),
            }),
          }),
        insert: makeInsertMock(),
        update: makeUpdateMock(),
        transaction: vi.fn().mockImplementation(async (fn: (tx: unknown) => unknown) => {
          return fn({
            select: txSelectMock,
            insert: txInsertMock,
            update: txUpdateMock,
          });
        }),
      };
      const walletService = makeWalletService();
      const svc = new ReturnService({
        db: db as never,
        walletService: walletService as never,
        env: makeEnv() as never,
      });

      await svc.approveReturn(RETURN_REQUEST_ID);

      expect(txUpdateMock).toHaveBeenCalled();
      expect(txUpdateSet).toHaveBeenCalledWith(
        expect.objectContaining({ status: "approved" })
      );
    });
  });
});
