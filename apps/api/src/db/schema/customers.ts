import { pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * customers table
 *
 * Stores customer accounts for the storefront. Each customer can have multiple
 * addresses and place orders across different vendors.
 *
 * Minimal customer identity for Phase 4: email + password hash + name + phone.
 * Full order history and wallet management is deferred to later phases.
 *
 * Soft-delete via archived_at: archiving a customer does not hard-delete their
 * orders or addresses (FK safety). Hard deletion is intentionally unavailable.
 *
 * Note: password is stored as an argon2id hash (hashed by CustomerAuthService).
 * Never stored as plaintext (T-04-03).
 *
 * Covers AUTH-01, AUTH-03 (Phase 4 customer auth scope).
 */
export const customers = pgTable("customers", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Customer login email. Must be unique across all customer accounts.
   * Used as the login identifier in customer JWT issuance (AUTH-01).
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext (T-04-03).
   * Hashed by CustomerAuthService using the argon2 library (OWASP-recommended).
   * Not returned in any API response.
   */
  passwordHash: text("password_hash").notNull(),

  /** Customer's display name shown in account pages and order history. */
  name: text("name").notNull(),

  /**
   * Customer's phone number. Optional — needed for address association
   * and delivery contact. Not validated at DB level; format validation
   * at service layer.
   */
  phone: text("phone"),

  /**
   * Soft-delete timestamp. null = active customer; non-null = archived.
   * Archived customers cannot log in.
   * Their existing orders remain in the DB for data integrity.
   */
  archivedAt: timestamp("archived_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new customer row */
export type InsertCustomer = typeof customers.$inferInsert;

/** TypeScript type for selecting a customer row */
export type SelectCustomer = typeof customers.$inferSelect;
