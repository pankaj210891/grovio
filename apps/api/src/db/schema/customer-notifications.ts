import { pgEnum, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * customerNotificationTypeEnum — types of customer notifications.
 *
 * order_update:   Order status changed (payment received, shipped, delivered).
 * price_drop:     A wishlisted product's price has dropped below the wishlist price.
 * return_update:  Return request status has changed.
 * promotion:      Promotional/marketing notification from admin.
 *
 * Constrained at the DB level via pgEnum (T-03-S1 pattern).
 */
export const customerNotificationTypeEnum = pgEnum(
  "customer_notification_type",
  ["order_update", "price_drop", "return_update", "promotion"]
);

/**
 * customer_notifications table
 *
 * Append-only notification store per customer. Notifications are never updated
 * (except for soft-hide via dismissed_at). New notifications always INSERT.
 *
 * reference_id / reference_type: loose reference to related entity (order ID,
 * product ID, return request ID) — not a hard FK to allow flexibility and avoid
 * cascades that would delete notifications when orders are removed.
 *
 * dismissed_at: null = visible in notification center; non-null = dismissed/hidden.
 *
 * Plan 11-05 T1.
 */
export const customerNotifications = pgTable("customer_notifications", {
  id: uuid("id").defaultRandom().primaryKey(),

  /** FK to the customer who receives this notification. */
  customerId: uuid("customer_id")
    .notNull()
    .references(() => customers.id, { onDelete: "cascade" }),

  /**
   * Notification type (pgEnum — constrained at DB level).
   * Determines display icon and grouping in the notification center.
   */
  type: customerNotificationTypeEnum("type").notNull(),

  /** Short notification title displayed as the headline. */
  title: text("title").notNull(),

  /** Full notification body text. */
  body: text("body").notNull(),

  /**
   * Loose reference ID to the related entity (order ID, product ID, etc.).
   * null when no entity reference is applicable (e.g., promotional notifications).
   */
  referenceId: text("reference_id"),

  /**
   * Type of the referenced entity.
   * Values: 'order' | 'product' | 'return' — not pgEnum to allow extensibility.
   */
  referenceType: text("reference_type"),

  /**
   * Soft-dismiss timestamp. null = visible; non-null = dismissed by customer.
   * Notifications are never hard-deleted.
   */
  dismissedAt: timestamp("dismissed_at", { withTimezone: true }),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new customer_notification row */
export type InsertCustomerNotification = typeof customerNotifications.$inferInsert;

/** TypeScript type for selecting a customer_notification row */
export type SelectCustomerNotification = typeof customerNotifications.$inferSelect;
