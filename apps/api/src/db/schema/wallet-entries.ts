import {
  bigint,
  pgEnum,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * walletEntryTypeEnum — 3 entry types for the append-only wallet ledger (WAL-03, WAL-04).
 *
 * Values MUST exactly match WalletEntryTypeSchema in packages/contracts/src/wallet/types.ts.
 *
 * - credit: Admin-granted wallet credit (onboarding bonus, manual adjustment)
 * - debit: Wallet credit applied during checkout (D-13, WAL-05)
 * - refund_credit: Wallet credit from an approved return/refund (WAL-04, D-16)
 */
export const walletEntryTypeEnum = pgEnum("wallet_entry_type", [
  "credit",
  "debit",
  "refund_credit",
]);

/**
 * wallet_entries table — append-only wallet ledger (WAL-03)
 *
 * The customer wallet is modeled as an immutable ledger: one row per transaction.
 * Balance = SUM(amount_minor WHERE type IN ['credit','refund_credit'])
 *         - SUM(amount_minor WHERE type = 'debit')
 *
 * The cached balance is also maintained on customers.wallet_balance_minor for fast
 * reads without aggregating this table (Pattern 7 in RESEARCH.md).
 *
 * Key design decisions (WAL-03, T-05-03):
 * - NO updatedAt column — entries are append-only. Existing rows are NEVER modified.
 *   This makes the ledger tamper-evident and audit-friendly.
 * - idempotencyKey: unique text key prevents double-spend and duplicate entries.
 *   Pattern: `order:{orderId}:wallet-debit`, `return:{returnId}:refund-credit`.
 *   The UNIQUE constraint at DB level makes duplicate inserts a no-op DB error.
 * - amountMinor: always a POSITIVE BIGINT regardless of entry type.
 *   The entry_type field indicates credit vs. debit direction.
 * - referenceId / referenceType: nullable FKs by convention (not strict FK constraint)
 *   to avoid tight coupling to order/return tables. Service layer validates.
 *
 * Security: T-05-03 — append-only pattern + unique idempotency_key prevents
 * wallet balance manipulation via duplicate entries (Pitfall 3).
 *
 * Covers WAL-02, WAL-03, WAL-04, WAL-05.
 */
export const walletEntries = pgTable("wallet_entries", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the customer whose wallet this entry belongs to.
   * Non-null — every wallet entry belongs to exactly one customer.
   */
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id),

  /**
   * Type of this ledger entry (credit/debit/refund_credit).
   * credit/refund_credit add to balance; debit subtracts.
   */
  entryType: walletEntryTypeEnum("entry_type").notNull(),

  /**
   * Amount in minor currency units (paise/cents).
   * BIGINT — no floating-point rounding drift (Pitfall 1, CLAUDE.md money rule).
   * Always POSITIVE — direction is determined by entryType (never negative amounts).
   */
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),

  /**
   * Unique idempotency key (WAL-03, T-05-03).
   * Prevents double-spend and duplicate ledger entries.
   * Pattern: `order:{orderId}:wallet-debit`, `return:{returnId}:refund-credit`.
   * UNIQUE constraint: inserting a row with an existing key raises a unique violation
   * which WalletService catches and treats as an idempotent no-op.
   */
  idempotencyKey: text("idempotency_key").notNull().unique(),

  /**
   * ID of the resource that triggered this wallet entry.
   * e.g., order UUID for debits, return_request UUID for refund credits.
   * null for manual admin credits with no associated transaction.
   * NOT a strict FK — avoids coupling to multiple tables; service validates.
   */
  referenceId: text("reference_id"),

  /**
   * Type of the triggering resource ('order', 'return', 'admin', etc.).
   * null for manual admin credits.
   * Used for filtering ledger history by transaction type (WAL-02).
   */
  referenceType: text("reference_type"),

  /**
   * Entry creation timestamp.
   * Append-only: NO updatedAt column — entries are immutable once written (WAL-03, T-05-03).
   */
  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new wallet entry row */
export type InsertWalletEntry = typeof walletEntries.$inferInsert;

/** TypeScript type for selecting a wallet entry row */
export type SelectWalletEntry = typeof walletEntries.$inferSelect;
