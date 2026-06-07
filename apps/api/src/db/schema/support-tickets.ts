import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * supportTicketStatusEnum — lifecycle states for support tickets.
 */
export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

/**
 * support_tickets table — customer/vendor support tickets (Phase 11, T1).
 *
 * submitted_by_type: 'customer' | 'vendor'
 * Status transitions are logged to audit_log.
 *
 * Plan 11-02 T1.
 */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** 'customer' or 'vendor' */
  submittedByType: text("submitted_by_type").notNull(),

  /** UUID of the submitter (no FK constraint — polymorphic reference). */
  submittedById: uuid("submitted_by_id").notNull(),

  subject: text("subject").notNull(),
  body: text("body").notNull(),

  status: supportTicketStatusEnum("status").notNull().default("open"),

  /** Email of assigned admin. null = unassigned. */
  assignedToAdminEmail: text("assigned_to_admin_email"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * support_ticket_replies table — threaded replies on tickets.
 *
 * author_type: 'admin' | 'customer' | 'vendor'
 */
export const supportTicketReplies = pgTable("support_ticket_replies", {
  id: uuid("id").defaultRandom().primaryKey(),

  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),

  /** 'admin', 'customer', or 'vendor' */
  authorType: text("author_type").notNull(),

  /** UUID of the author (no FK constraint — polymorphic). */
  authorId: text("author_id").notNull(),

  body: text("body").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

export type InsertSupportTicket = typeof supportTickets.$inferInsert;
export type SelectSupportTicket = typeof supportTickets.$inferSelect;
export type InsertSupportTicketReply = typeof supportTicketReplies.$inferInsert;
export type SelectSupportTicketReply = typeof supportTicketReplies.$inferSelect;
