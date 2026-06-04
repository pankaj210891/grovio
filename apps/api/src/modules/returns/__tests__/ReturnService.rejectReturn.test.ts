import { describe, expect, it, vi } from "vitest";
import { ReturnService } from "../ReturnService.js";

// ---------------------------------------------------------------------------
// ReturnService.rejectReturn tests — D-16, VEN-04, T-06-D16
//
// New in Phase 6: vendor can reject a return request with a required reason.
// No refund or commission reversal is issued on reject (contrast with approveReturn).
//
// Key assertions:
// - rejectReturn throws when rejectionReason is empty
// - rejectReturn sets status to 'rejected' and stores the reason
// - rejectReturn does NOT call walletService.credit or insert commission entries
// - rejectReturn throws when return is not in a rejectable state (e.g. already approved)
// ---------------------------------------------------------------------------

function makeSelectMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
      }),
    }),
  });
}

function makeUpdateMock() {
  return vi.fn().mockReturnValue({
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockResolvedValue([]),
    }),
  });
}

function makeInsertMock() {
  return vi.fn().mockReturnValue({
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([{ id: "uuid-1" }]),
    }),
  });
}

function makeWalletService() {
  return {
    credit: vi.fn().mockResolvedValue(undefined),
    debit: vi.fn().mockResolvedValue(undefined),
    getBalance: vi.fn().mockResolvedValue(0),
  };
}

function makeDbWithTransaction() {
  const tx = {
    select: makeSelectMock([]),
    insert: makeInsertMock(),
    update: makeUpdateMock(),
  };
  return {
    transaction: vi.fn().mockImplementation(async (fn: (tx: typeof tx) => unknown) => {
      return fn(tx);
    }),
    select: makeSelectMock([]),
    insert: makeInsertMock(),
    update: makeUpdateMock(),
    _tx: tx,
  };
}

describe("ReturnService.rejectReturn", () => {
  it("throws when rejectionReason is empty string", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    await expect(
      svc.rejectReturn("return-id-1", "")
    ).rejects.toThrow();
  });

  it("throws when rejectionReason is whitespace only", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    await expect(
      svc.rejectReturn("return-id-1", "   ")
    ).rejects.toThrow();
  });

  it("sets status to 'rejected' and stores rejection reason", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    // Return request exists and is in 'return_requested' (rejectable) state
    db.select = makeSelectMock([
      {
        id: "return-id-1",
        vendorOrderId: "vo-1",
        customerId: "c-1",
        orderId: "o-1",
        orderItemIds: ["oi-1"],
        reason: "Item damaged",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await svc.rejectReturn("return-id-1", "Item shows no damage on inspection");

    // update should have been called with status='rejected'
    expect(db.update).toHaveBeenCalledOnce();
    const setArg = (db.update as ReturnType<typeof vi.fn>).mock.results[0]?.value?.set?.mock?.calls?.[0]?.[0] as Record<string, unknown>;
    expect(setArg?.["status"]).toBe("rejected");
    // rejectionReason or similar field should be set
    const hasRejection = setArg?.["rejectionReason"] !== undefined || setArg?.["rejection_reason"] !== undefined;
    expect(hasRejection).toBe(true);
  });

  it("does NOT call walletService.credit on rejection", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    db.select = makeSelectMock([
      {
        id: "return-id-1",
        vendorOrderId: "vo-1",
        customerId: "c-1",
        orderId: "o-1",
        orderItemIds: ["oi-1"],
        reason: "Defective",
        refundPreference: "wallet",
        status: "return_requested",
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await svc.rejectReturn("return-id-1", "No defect found on inspection.");

    // No wallet credit should be called
    expect(walletService.credit).not.toHaveBeenCalled();
    // No commission reversal insert should be called
    expect(db.insert).not.toHaveBeenCalled();
  });

  it("throws ReturnRequestNotFoundError when return request does not exist", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    // Return not found
    db.select = makeSelectMock([]);

    const { ReturnRequestNotFoundError } = await import("../ReturnService.js");
    await expect(
      svc.rejectReturn("nonexistent-id", "No defect found.")
    ).rejects.toThrow(ReturnRequestNotFoundError);
  });

  it("throws when return is not in a rejectable state (already approved)", async () => {
    const db = makeDbWithTransaction();
    const walletService = makeWalletService();
    const svc = new ReturnService({
      db: db as never,
      walletService: walletService as never,
      env: {} as never,
    });

    // Return is already approved
    db.select = makeSelectMock([
      {
        id: "return-id-1",
        vendorOrderId: "vo-1",
        customerId: "c-1",
        orderId: "o-1",
        orderItemIds: ["oi-1"],
        reason: "Item damaged",
        refundPreference: "wallet",
        status: "approved", // not rejectable
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    ]);

    await expect(
      svc.rejectReturn("return-id-1", "Some reason")
    ).rejects.toThrow();
  });
});
