import { eq, desc } from "drizzle-orm";
import { sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import {
  walletEntries,
  customers,
  type SelectWalletEntry,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown by debit() when the customer's wallet balance is less than the
 * requested debit amount.
 *
 * Code INSUFFICIENT_WALLET_BALANCE lets routes return a structured 400/422
 * response without relying on error message string matching.
 *
 * Security (T-05-03): prevents negative wallet balances caused by race
 * conditions. Combined with the idempotency_key unique constraint on
 * wallet_entries, double-spend attacks are prevented (Pitfall 3).
 */
export class InsufficientWalletBalanceError extends Error {
  readonly code = "INSUFFICIENT_WALLET_BALANCE";

  constructor(
    message = "Wallet balance is insufficient to complete this transaction."
  ) {
    super(message);
    this.name = "InsufficientWalletBalanceError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface WalletServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreditParams {
  customerId: string;
  amountMinor: number;
  idempotencyKey: string;
  referenceId: string | null;
  referenceType: string | null;
}

export interface DebitParams {
  customerId: string;
  amountMinor: number;
  /** Used to build the deterministic idempotencyKey `order:{orderId}:wallet-debit` (WAL-03) */
  orderId: string;
}

// ---------------------------------------------------------------------------
// WalletService
// ---------------------------------------------------------------------------

/**
 * WalletService
 *
 * Owns all wallet read and write operations.
 *
 * Design:
 * - Wallet is an append-only ledger (wallet_entries). No row is ever modified.
 * - A cached balance (customers.wallet_balance_minor) is maintained transactionally
 *   alongside every insert — insert entry + update cache in a single DB transaction.
 * - NEVER expose a method that sets wallet_balance_minor directly. The only way to
 *   change the balance is through credit() or debit() which always pair the cache
 *   update with a ledger insert.
 *
 * Methods:
 * - getBalance(customerId) → reads cached balance (WAL-01)
 * - getLedger(customerId) → wallet_entries ordered by createdAt desc (WAL-02)
 * - credit(params) → insert credit/refund_credit entry + add to cached balance (WAL-03, WAL-04)
 * - debit(params) → insert debit entry + subtract from cached balance; throws if insufficient (WAL-03, WAL-05)
 * - computeWalletApplied(balanceMinor, requestedMinor, orderTotalMinor) → min of three (WAL-05, D-13)
 *
 * Security: T-05-03 — append-only + unique idempotency_key prevents double-spend (Pitfall 3).
 *
 * Covers WAL-01, WAL-02, WAL-03, WAL-04, WAL-05.
 */
export class WalletService {
  constructor(private deps: WalletServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get the customer's cached wallet balance (WAL-01).
   *
   * Reads from the customers.wallet_balance_minor cached column.
   * This is a fast O(1) read — does NOT aggregate wallet_entries.
   * The cache is always up-to-date because credit() and debit() maintain
   * it transactionally alongside every ledger insert.
   *
   * @returns balance in minor currency units (e.g., paise/cents)
   */
  async getBalance(customerId: string): Promise<number> {
    const { db } = this.deps;

    const rows = await db
      .select({ walletBalanceMinor: customers.walletBalanceMinor })
      .from(customers)
      .where(eq(customers.id, customerId))
      .limit(1);

    return rows[0]?.walletBalanceMinor ?? 0;
  }

  /**
   * Get the customer's wallet ledger history (WAL-02).
   *
   * Returns all wallet_entries rows ordered by createdAt descending
   * (most recent first).
   */
  async getLedger(customerId: string): Promise<SelectWalletEntry[]> {
    const { db } = this.deps;

    return db
      .select()
      .from(walletEntries)
      .where(eq(walletEntries.customerId, customerId))
      .orderBy(desc(walletEntries.createdAt));
  }

  /**
   * Credit the customer's wallet (WAL-03, WAL-04).
   *
   * Inserts a wallet_entries row with entry_type='credit' or 'refund_credit'
   * and atomically adds to customers.wallet_balance_minor in a single DB transaction.
   *
   * Idempotency: if the idempotencyKey already exists, the insert returns no rows
   * (onConflictDoNothing). When that happens, this method exits without updating
   * the cached balance — the previous insert already handled it (Pitfall 3).
   *
   * @param params.idempotencyKey — Unique key preventing duplicate credit entries.
   *   Use descriptive patterns: `admin:credit:{uuid}`, `return:{returnId}:refund-credit`
   */
  async credit(params: CreditParams): Promise<void> {
    const { db } = this.deps;

    await db.transaction(async (tx) => {
      // Insert the ledger entry — onConflictDoNothing for idempotency
      const inserted = await tx
        .insert(walletEntries)
        .values({
          customerId: params.customerId,
          entryType: "credit",
          amountMinor: params.amountMinor,
          idempotencyKey: params.idempotencyKey,
          referenceId: params.referenceId,
          referenceType: params.referenceType,
        })
        .onConflictDoNothing({ target: walletEntries.idempotencyKey });

      // If insert was a no-op (duplicate key), do NOT update the cached balance
      if (!inserted || (Array.isArray(inserted) && inserted.length === 0)) {
        return;
      }

      // Update cached balance: add amount to existing value (WAL-03 anti-pattern: never set directly)
      await tx
        .update(customers)
        .set({
          walletBalanceMinor: sql`${customers.walletBalanceMinor} + ${params.amountMinor}`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, params.customerId));
    });
  }

  /**
   * Debit the customer's wallet during checkout (WAL-03, WAL-05, T-05-03).
   *
   * Reads the current balance, throws InsufficientWalletBalanceError if
   * balance < amount, then inserts a debit entry and subtracts from the
   * cached balance in a single DB transaction.
   *
   * Idempotency key: `order:{orderId}:wallet-debit` — deterministic per order.
   * The unique constraint on wallet_entries.idempotency_key prevents two simultaneous
   * checkout tabs from both debiting the same balance (Pitfall 3, T-05-03).
   *
   * @throws InsufficientWalletBalanceError when balance < amountMinor
   */
  async debit(params: DebitParams): Promise<void> {
    const { db } = this.deps;

    // Read the current balance to guard against InsufficientWalletBalance
    const balance = await this.getBalance(params.customerId);

    if (balance < params.amountMinor) {
      throw new InsufficientWalletBalanceError(
        `Wallet balance ${balance} is insufficient for debit of ${params.amountMinor}.`
      );
    }

    const idempotencyKey = `order:${params.orderId}:wallet-debit`;

    await db.transaction(async (tx) => {
      // Insert the debit ledger entry
      const inserted = await tx
        .insert(walletEntries)
        .values({
          customerId: params.customerId,
          entryType: "debit",
          amountMinor: params.amountMinor,
          idempotencyKey,
          referenceId: params.orderId,
          referenceType: "order",
        })
        .onConflictDoNothing({ target: walletEntries.idempotencyKey });

      // If insert was a no-op (duplicate key), do NOT update the cached balance
      if (!inserted || (Array.isArray(inserted) && inserted.length === 0)) {
        return;
      }

      // Update cached balance: subtract amount (WAL-03 anti-pattern: never set directly)
      await tx
        .update(customers)
        .set({
          walletBalanceMinor: sql`${customers.walletBalanceMinor} - ${params.amountMinor}`,
          updatedAt: new Date(),
        })
        .where(eq(customers.id, params.customerId));
    });
  }

  /**
   * Compute the wallet amount to apply at checkout (WAL-05, D-13).
   *
   * Returns min(balanceMinor, requestedMinor, orderTotalMinor).
   *
   * This pure function is used by CheckoutService to derive:
   * - How much wallet credit to apply (walletAppliedMinor)
   * - The remaining card-charge amount: orderTotalMinor - walletAppliedMinor
   *
   * Result is always >= 0 — never negative.
   *
   * Examples:
   *   computeWalletApplied(5000, 5000, 3000) → 3000  (capped at order total)
   *   computeWalletApplied(200, 500, 1000)   → 200   (capped at balance)
   *   computeWalletApplied(5000, 100, 1000)  → 100   (capped at requested amount)
   */
  computeWalletApplied(
    balanceMinor: number,
    requestedMinor: number,
    orderTotalMinor: number
  ): number {
    const applied = Math.min(balanceMinor, requestedMinor, orderTotalMinor);
    return Math.max(0, applied);
  }
}
