import {
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * admin_users table — admin panel accounts (D-21, ADM-auth, Phase 11 RBAC).
 *
 * Admin accounts are managed separately from vendor/customer accounts.
 * Phase 11 adds the `role` column for RBAC enforcement in the admin panel.
 *
 * Role values:
 *   - 'super_admin': full access to all sections
 *   - 'moderator': catalog, vendors, support — no finance or settings
 *   - 'finance_admin': finance only — no vendors, settings
 *
 * Covers D-21, ADM authentication, Phase 11 T1.
 */
export const adminUsers = pgTable("admin_users", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Admin login email. Must be unique across all admin accounts.
   */
  email: text("email").notNull().unique(),

  /**
   * Argon2id password hash. Never stored as plaintext.
   */
  passwordHash: text("password_hash").notNull(),

  /**
   * RBAC role for admin panel sections (Phase 11).
   * Values: 'super_admin' | 'moderator' | 'finance_admin'
   * Defaults to 'moderator' (least-privilege default).
   */
  role: text("role").notNull().default("moderator"),

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
