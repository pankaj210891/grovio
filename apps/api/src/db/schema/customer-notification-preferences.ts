import { boolean, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";

/**
 * customer_notification_preferences table
 *
 * Stores per-customer notification opt-in preferences.
 * One row per customer (unique FK). Created on first preference update.
 *
 * order_updates: always true and not editable by the customer (transactional
 *   notifications required by commerce flow). Stored for completeness.
 * price_drops:   customer can opt out of price drop alerts.
 * promotions:    customer can opt in to promotional notifications (off by default).
 *
 * Plan 11-05 T4.
 */
export const customerNotificationPreferences = pgTable(
  "customer_notification_preferences",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** FK to the customer. One row per customer. */
    customerId: uuid("customer_id")
      .notNull()
      .unique()
      .references(() => customers.id, { onDelete: "cascade" }),

    /**
     * Order update notifications (payment confirmed, shipped, delivered).
     * Always true — immutable from customer's perspective.
     */
    orderUpdates: boolean("order_updates").notNull().default(true),

    /**
     * Price drop alerts for wishlisted products.
     * Customer can opt out. Default: true (opted in).
     */
    priceDrops: boolean("price_drops").notNull().default(true),

    /**
     * Promotional/marketing notifications from admin.
     * Customer must opt in. Default: false (opted out).
     */
    promotions: boolean("promotions").notNull().default(false),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
    updatedAt: timestamp("updated_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  }
);

/** TypeScript type for inserting a new customer_notification_preferences row */
export type InsertCustomerNotificationPreferences = typeof customerNotificationPreferences.$inferInsert;

/** TypeScript type for selecting a customer_notification_preferences row */
export type SelectCustomerNotificationPreferences = typeof customerNotificationPreferences.$inferSelect;
