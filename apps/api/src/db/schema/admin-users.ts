import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * admin_users table — admin panel accounts (D-21, ADM-auth).
 *
 * Admin accounts are managed separately from vendor/customer accounts.
 * Phase 4 admin routes used a placeholder X-Internal-Admin-Token header.
 * Phase 6 introduces this table for proper admin authentication via AdminAuthService.
 *
 * Key design decisions:
 * - Separate table from vendors and customers (D-21): distinct JWT payload with role='admin',
 *   separate TTL (8h admin sessions vs 1h vendor sessions).
 * - No onboarding_status or archivedAt: admin accounts are managed directly in the DB
 *   (or via future admin-created-admin flow in v2). No approval workflow needed.
 * - passwordHash: Argon2id consistent with vendor/customer auth patterns.
 * - No role column: all admin_users have full admin access (single role = 'admin').
 *   Future v2 may add role-based admin access (super-admin vs ops-admin).
 *
 * Covers D-21, ADM authentication.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Admin login email. Must be unique across all admin accounts.
   * Used as the login identifier in AdminAuthService JWT issuance (D-21).
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext.
   * Hashed by AdminAuthService using the argon2 library (OWASP-recommended).
   * Not returned in any API response.
   */
  passwordHash: text("password_hash").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new admin_user row */
export type InsertAdminUser = typeof adminUsers.$inferInsert;

/** TypeScript type for selecting an admin_user row */
export type SelectAdminUser = typeof adminUsers.$inferSelect;
