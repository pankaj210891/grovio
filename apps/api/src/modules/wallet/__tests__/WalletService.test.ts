import { describe, expect, it, vi, beforeEach } from "vitest";

// ---------------------------------------------------------------------------
// WalletService tests — WAL-01..05, T-05-03
//
// TDD RED: tests are written first to define expected behavior.
// All DB interactions are mocked; no live DB required.
// ---------------------------------------------------------------------------

import {
  WalletService,
  InsufficientWalletBalanceError,
} from "../WalletService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/** Build a chainable Drizzle-select mock that resolves to `rows`. */
function makeSelectMock(rows: unknown[]) {
  return vi.fn().mockReturnValue({
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
        limit: vi.fn().mockResolvedValue(rows),
      }),
      limit: vi.fn().mockResolvedValue(rows),
    }),
  });
}

/** Build a mock DB with a transaction that executes the callback immediately. */
function makeDbMock(opts: {
  selectRows?: unknown[];
  insertShouldConflict?: boolean;
} = {}) {
  const { selectRows = [], insertShouldConflict = false } = opts;

  const insertValues = vi.fn().mockReturnValue({
    // Simulate unique constraint violation for idempotency tests
    onConflictDoNothing: vi.fn().mockResolvedValue(
      insertShouldConflict ? [] : [{ id: "entry-uuid-1" }]
    ),
  });
  const insertMock = vi.fn().mockReturnValue({ values: insertValues });

  const updateSet = vi.fn().mockReturnValue({
    where: vi.fn().mockResolvedValue([]),
  });
  const updateMock = vi.fn().mockReturnValue({ set: updateSet });

  // Transaction mock: executes callback with tx (which is the same mock db)
  const txCallback = async (cb: (tx: unknown) => Promise<unknown>) => {
    const tx = {
      insert: insertMock,
      update: updateMock,
    };
    return cb(tx);
  };

  return {
    select: makeSelectMock(selectRows),
    insert: insertMock,
    update: updateMock,
    transaction: vi.fn().mockImplementation(txCallback),
    _insertValues: insertValues,
    _updateSet: updateSet,
  };
}

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("WalletService", () => {
  const CUSTOMER_ID = "customer-uuid-1";

  // ── getBalance ────────────────────────────────────────────────────────────

  describe("getBalance()", () => {
    it("returns the cached wallet_balance_minor from the customers row", async () => {
      const db = makeDbMock({
        selectRows: [{ id: CUSTOMER_ID, walletBalanceMinor: 5000 }],
      });
      const svc = new WalletService({ db: db as never, env: {} as never });

      const balance = await svc.getBalance(CUSTOMER_ID);

      expect(balance).toBe(5000);
    });

    it("returns 0 when the customer has no wallet balance (new customer)", async () => {
      const db = makeDbMock({
        selectRows: [{ id: CUSTOMER_ID, walletBalanceMinor: 0 }],
      });
      const svc = new WalletService({ db: db as never, env: {} as never });

      const balance = await svc.getBalance(CUSTOMER_ID);

      expect(balance).toBe(0);
    });
  });

  // ── getLedger ─────────────────────────────────────────────────────────────

  describe("getLedger()", () => {
    it("returns wallet entries ordered by createdAt desc (WAL-02)", async () => {
      const entries = [
        { id: "e1", customerId: CUSTOMER_ID, entryType: "debit", amountMinor: 200, createdAt: new Date("2024-02-01") },
        { id: "e2", customerId: CUSTOMER_ID, entryType: "credit", amountMinor: 500, createdAt: new Date("2024-01-01") },
      ];
      const db = makeDbMock({ selectRows: entries });
      const svc = new WalletService({ db: db as never, env: {} as never });

      const ledger = await svc.getLedger(CUSTOMER_ID);

      expect(ledger).toHaveLength(2);
      expect(ledger[0]?.entryType).toBe("debit");
    });
  });

  // ── credit ────────────────────────────────────────────────────────────────

  describe("credit()", () => {
    it("inserts a wallet_entries row and updates cached balance in one transaction", async () => {
      const db = makeDbMock();
      const svc = new WalletService({ db: db as never, env: {} as never });

      await svc.credit({
        customerId: CUSTOMER_ID,
        amountMinor: 1000,
        idempotencyKey: "admin:credit:abc123",
        referenceId: null,
        referenceType: null,
      });

      // Transaction must have been called
      expect(db.transaction).toHaveBeenCalledOnce();

      // Insert must have been called with the entry data
      expect(db.insert).toHaveBeenCalled();
      expect(db._insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          customerId: CUSTOMER_ID,
          amountMinor: 1000,
          idempotencyKey: "admin:credit:abc123",
        })
      );

      // Update must have been called to adjust cached balance
      expect(db.update).toHaveBeenCalled();
    });

    it("is a silent no-op when the idempotencyKey already exists (duplicate insert conflict)", async () => {
      // Simulate conflict: insert returns no rows (unique violation → no-op)
      const db = makeDbMock({ insertShouldConflict: true });
      const svc = new WalletService({ db: db as never, env: {} as never });

      // Should not throw
      await expect(
        svc.credit({
          customerId: CUSTOMER_ID,
          amountMinor: 1000,
          idempotencyKey: "order:ord-1:wallet-debit",
          referenceId: "ord-1",
          referenceType: "order",
        })
      ).resolves.toBeUndefined();
    });
  });

  // ── debit ─────────────────────────────────────────────────────────────────

  describe("debit()", () => {
    it("inserts a debit entry and decreases cached balance when balance is sufficient", async () => {
      // Customer has 5000 minor units balance
      const db = makeDbMock({
        selectRows: [{ id: CUSTOMER_ID, walletBalanceMinor: 5000 }],
      });
      const svc = new WalletService({ db: db as never, env: {} as never });

      await svc.debit({
        customerId: CUSTOMER_ID,
        amountMinor: 3000,
        orderId: "order-uuid-1",
      });

      expect(db.transaction).toHaveBeenCalledOnce();
      expect(db.insert).toHaveBeenCalled();
    });

    it("throws InsufficientWalletBalanceError when balance < amount (WAL-05, T-05-03)", async () => {
      const db = makeDbMock({
        selectRows: [{ id: CUSTOMER_ID, walletBalanceMinor: 100 }],
      });
      const svc = new WalletService({ db: db as never, env: {} as never });

      await expect(
        svc.debit({
          customerId: CUSTOMER_ID,
          amountMinor: 500,
          orderId: "order-uuid-2",
        })
      ).rejects.toThrow(InsufficientWalletBalanceError);
    });

    it("uses idempotencyKey `order:{orderId}:wallet-debit` (WAL-03, T-05-03)", async () => {
      const db = makeDbMock({
        selectRows: [{ id: CUSTOMER_ID, walletBalanceMinor: 5000 }],
      });
      const svc = new WalletService({ db: db as never, env: {} as never });

      await svc.debit({
        customerId: CUSTOMER_ID,
        amountMinor: 100,
        orderId: "order-uuid-3",
      });

      expect(db._insertValues).toHaveBeenCalledWith(
        expect.objectContaining({
          idempotencyKey: "order:order-uuid-3:wallet-debit",
          entryType: "debit",
        })
      );
    });
  });

  // ── computeWalletApplied ──────────────────────────────────────────────────

  describe("computeWalletApplied()", () => {
    it("returns min(balance, requested, orderTotal) — full-wallet case where balance covers total", () => {
      const svc = new WalletService({ db: {} as never, env: {} as never });

      // balance=5000, requested=5000, total=3000 → min is total=3000
      const result = svc.computeWalletApplied(5000, 5000, 3000);
      expect(result).toBe(3000);
    });

    it("returns min(balance, requested, orderTotal) — partial case where balance is limiting factor", () => {
      const svc = new WalletService({ db: {} as never, env: {} as never });

      // balance=200, requested=500, total=1000 → min is balance=200
      const result = svc.computeWalletApplied(200, 500, 1000);
      expect(result).toBe(200);
    });

    it("returns min(balance, requested, orderTotal) — requested is limiting factor", () => {
      const svc = new WalletService({ db: {} as never, env: {} as never });

      // balance=5000, requested=100, total=1000 → min is requested=100
      const result = svc.computeWalletApplied(5000, 100, 1000);
      expect(result).toBe(100);
    });

    it("never returns a negative value (WAL-05)", () => {
      const svc = new WalletService({ db: {} as never, env: {} as never });

      // All zeros
      const result = svc.computeWalletApplied(0, 0, 0);
      expect(result).toBeGreaterThanOrEqual(0);
    });

    it("returns 0 when balance is 0 (no wallet credit to apply)", () => {
      const svc = new WalletService({ db: {} as never, env: {} as never });

      const result = svc.computeWalletApplied(0, 500, 1000);
      expect(result).toBe(0);
    });
  });
});
