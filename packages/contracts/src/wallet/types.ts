import { z } from "zod";

/**
 * Wallet contract schemas for Phase 5: Commerce Core.
 *
 * Per WAL-01/WAL-02: Customer can view wallet balance and ledger history.
 * Per WAL-03: Wallet is modeled as an append-only ledger with idempotent entries.
 * Per WAL-04: Refunds can be issued to the customer wallet.
 * Per WAL-05: Customer can apply wallet credit (fully or partially) at checkout.
 *
 * Per D-01: All money fields are z.number().int() (minor units, e.g. paise/cents).
 * Per Pitfall 5: bigint is NEVER used in contracts — JSON serialization uses number.
 *
 * Security notes:
 * - T-05-04: amountMinor and balanceMinor typed as z.number().int() — float amounts rejected.
 * - WAL-03: append-only ledger — no UPDATE or DELETE operations on wallet_entries.
 *   The idempotency_key unique constraint in the DB prevents double-spend (Pitfall 3).
 */

/**
 * The type of a wallet ledger entry (WAL-02, WAL-03, WAL-04).
 * Values MUST exactly match the walletEntryTypeEnum pgEnum in the database schema.
 *
 * - "credit": Admin-granted wallet credit (onboarding bonus, manual adjustment)
 * - "debit": Wallet credit applied during checkout (D-13, WAL-05)
 * - "refund_credit": Wallet credit from an approved return/refund (WAL-04, D-16)
 */
export const WalletEntryTypeSchema = z.enum([
  "credit",
  "debit",
  "refund_credit",
]);

/** TypeScript type inferred from WalletEntryTypeSchema */
export type WalletEntryType = z.infer<typeof WalletEntryTypeSchema>;

/**
 * A single wallet ledger entry as returned by the API (WAL-02).
 * Entries are immutable once written (WAL-03, append-only).
 *
 * amountMinor is always a positive integer regardless of entry_type
 * (the type field distinguishes credit vs debit direction).
 */
export const WalletEntrySchema = z.object({
  /** Wallet entry row ID */
  id: z.string().uuid(),
  /** Type of this ledger entry */
  entryType: WalletEntryTypeSchema,
  /**
   * Amount in minor currency units.
   * Always positive — entry_type indicates the direction (credit/debit).
   * Must be an integer — never a float (D-01, Pitfall 5).
   */
  amountMinor: z.number().int(),
  /**
   * FK UUID to the triggering resource (e.g., order ID or return request ID).
   * null for manual admin credits with no associated transaction.
   */
  referenceId: z.string().nullable(),
  /**
   * Type of the triggering resource (e.g., "order" or "return").
   * null for manual admin credits.
   */
  referenceType: z.string().nullable(),
  /** ISO 8601 datetime string when this entry was created */
  createdAt: z.string().datetime(),
});

/** TypeScript type inferred from WalletEntrySchema */
export type WalletEntry = z.infer<typeof WalletEntrySchema>;

/**
 * The customer's current wallet balance (WAL-01).
 * This is a snapshot of the cached balance column on the customers table.
 * The authoritative balance is derived from the sum of wallet_entries (WAL-03),
 * but the cached column is kept in sync transactionally for performance.
 *
 * balanceMinor is always an integer — never a float (D-01, Pitfall 5).
 */
export const WalletBalanceSchema = z.object({
  /**
   * Current wallet balance in minor currency units.
   * Always 0 or positive — a customer cannot have a negative wallet balance.
   * Must be an integer — never a float (D-01).
   */
  balanceMinor: z.number().int(),
});

/** TypeScript type inferred from WalletBalanceSchema */
export type WalletBalance = z.infer<typeof WalletBalanceSchema>;

/**
 * Combined wallet balance + ledger entry history response (WAL-01, WAL-02).
 * Returned from GET /account/wallet.
 *
 * Entries are ordered by createdAt descending (newest first).
 */
export const WalletLedgerResponseSchema = z.object({
  /**
   * Current wallet balance in minor currency units.
   * Must be an integer — never a float (D-01).
   */
  balanceMinor: z.number().int(),
  /**
   * Ledger entries in descending order (newest first).
   * The full history of credits, debits, and refund credits (WAL-02).
   */
  entries: z.array(WalletEntrySchema),
});

/** TypeScript type inferred from WalletLedgerResponseSchema */
export type WalletLedgerResponse = z.infer<typeof WalletLedgerResponseSchema>;
