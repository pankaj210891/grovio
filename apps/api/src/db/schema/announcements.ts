import {
  boolean,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * announcements table — admin broadcast announcements (Phase 11, T1).
 *
 * target_type: 'customers' | 'vendors' | 'all'
 * Active + non-expired announcements appear at GET /announcements/active (public).
 *
 * Plan 11-02 T1.
 */
export const announcements = pgTable("announcements", {
  id: uuid("id").defaultRandom().primaryKey(),

  title: text("title").notNull(),
  body: text("body").notNull(),

  /**
   * Who sees this: 'customers', 'vendors', 'all'
   */
  targetType: text("target_type").notNull(),

  /** Whether active. Admin can deactivate without deleting. */
  active: boolean("active").notNull().default(true),

  /** Optional expiry. null = no expiry. */
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  /** Email of creating admin (denormalized for audit trail). */
  createdByAdminEmail: text("created_by_admin_email").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertAnnouncement = typeof announcements.$inferInsert;
export type SelectAnnouncement = typeof announcements.$inferSelect;
