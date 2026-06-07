import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * supportTicketStatusEnum — lifecycle states for support tickets.
 *
 * open:        Newly submitted ticket, awaiting admin response.
 * in_progress: Admin is actively working on the ticket.
 * resolved:    Ticket is resolved by admin.
 * closed:      Ticket is closed (by customer or auto-close after resolution).
 */
export const supportTicketStatusEnum = pgEnum("support_ticket_status", [
  "open",
  "in_progress",
  "resolved",
  "closed",
]);

/**
 * support_tickets table
 *
 * Stores support tickets submitted by customers or vendors.
 * submitted_by_type distinguishes whether the submitter is a 'customer' or 'vendor'.
 * submitted_by_id is the UUID of the customer or vendor.
 *
 * Not hard FK references — allows customer and vendor IDs to coexist in one column.
 * submitted_by_type + submitted_by_id must be validated at service layer.
 *
 * Plan 11-05 T6.
 */
export const supportTickets = pgTable("support_tickets", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Who submitted the ticket: 'customer' or 'vendor'.
   * Used to route to the correct auth scope for replies and listing.
   */
  submittedByType: text("submitted_by_type").notNull(),

  /**
   * UUID of the submitting customer or vendor.
   * No FK constraint — coexists for customer_id and vendor_id in one column.
   */
  submittedById: uuid("submitted_by_id").notNull(),

  /** Ticket subject/title. */
  subject: text("subject").notNull(),

  /** Initial message body from the submitter. */
  body: text("body").notNull(),

  /**
   * Ticket lifecycle status.
   * pgEnum constrained at DB level (T-03-S1 pattern).
   */
  status: supportTicketStatusEnum("status").notNull().default("open"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/**
 * support_ticket_replies table
 *
 * Threaded replies on a support ticket. Either the customer/vendor or an admin
 * can reply. reply_by_type distinguishes admin vs. customer/vendor replies.
 */
export const supportTicketReplies = pgTable("support_ticket_replies", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** FK to the parent support ticket. */
  ticketId: uuid("ticket_id")
    .notNull()
    .references(() => supportTickets.id, { onDelete: "cascade" }),

  /**
   * Who replied: 'customer', 'vendor', or 'admin'.
   * Used to display correct attribution in the support thread UI.
   */
  replyByType: text("reply_by_type").notNull(),

  /**
   * UUID of the replier (customer, vendor, or admin ID).
   * No FK constraint — coexists for multiple entity types.
   */
  replyById: uuid("reply_by_id").notNull(),

  /** Reply message body. */
  body: text("body").notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new support_ticket row */
export type InsertSupportTicket = typeof supportTickets.$inferInsert;

/** TypeScript type for selecting a support_ticket row */
export type SelectSupportTicket = typeof supportTickets.$inferSelect;

/** TypeScript type for inserting a new support_ticket_reply row */
export type InsertSupportTicketReply = typeof supportTicketReplies.$inferInsert;

/** TypeScript type for selecting a support_ticket_reply row */
export type SelectSupportTicketReply = typeof supportTicketReplies.$inferSelect;
