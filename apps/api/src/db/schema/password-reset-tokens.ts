import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * password_reset_tokens table
 *
 * Stores one-time password reset tokens for customer accounts.
 * Each row represents a pending reset request.
 *
 * Security design (T-04-02):
 * - tokenHash stores SHA-256 of the raw UUID token — never the raw token itself.
 * - expiresAt enforces a 1-hour validity window (D-10).
 * - Tokens are hard-deleted on use (single-use) — no soft delete / archivedAt column.
 * - No updatedAt — tokens are insert-once, deleted on use or expiry.
 *
 * FK cascade: deleting a customer hard-deletes all their pending reset tokens.
 *
 * Covers AUTH-05 (password reset flow).
 */
export const passwordResetTokens = pgTable("password_reset_tokens", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the customer who requested the password reset.
   * Cascade delete: removing a customer removes all their pending tokens.
   */
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),

  /**
   * SHA-256 hash of the raw UUID reset token (T-04-02).
   * The raw token is sent to the customer's email; only the hash is stored.
   * Must be unique — enforced at DB level to prevent hash collisions.
   */
  tokenHash: text("token_hash").notNull().unique(),

  /**
   * Token expiry timestamp. Tokens older than this are invalid (D-10).
   * CustomerAuthService rejects tokens where expiresAt < NOW().
   * Defaults to 1 hour from creation time (set by service at insert).
   */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new password reset token row */
export type InsertPasswordResetToken = typeof passwordResetTokens.$inferInsert;

/** TypeScript type for selecting a password reset token row */
export type SelectPasswordResetToken =
  typeof passwordResetTokens.$inferSelect;
