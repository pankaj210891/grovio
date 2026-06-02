import { integer, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";
import { customers } from "./customers.js";
import { inventoryItems } from "./inventory-items.js";
import { basketSessions } from "./basket-sessions.js";

/**
 * inventory_reservations table
 *
 * Records per-item inventory reservations created at checkout initiation (D-06, CHK-05).
 *
 * Key design decisions:
 * - Created atomically with quantityAvailable decrement on the inventory_items row
 *   inside a SELECT FOR UPDATE transaction (Pattern 2 in RESEARCH.md).
 * - orderId: linked AFTER order placement. null = reservation exists but no order yet
 *   (customer is on the payment step). Non-null = order has been placed.
 * - status: text column with values reserved/consumed/expired.
 *   reserved → payment in progress
 *   consumed → payment captured; inventory sold (quantityReserved decremented)
 *   expired → ReleaseReservationJob fired; stock returned to quantityAvailable
 * - expiresAt: 15-minute TTL from reservation creation (D-07).
 *   BullMQ ReleaseReservationJob fires at this timestamp with a deterministic jobId.
 * - basketSessionId: nullable — may be null if reservation is linked to a direct order
 *   placement path that bypasses the basket (future use).
 * - customerId: nullable — null for guest checkouts that haven't been linked yet.
 *
 * Covers CHK-05 (atomic inventory reservation), D-07 (15-minute TTL).
 */
export const inventoryReservations = pgTable("inventory_reservations", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the basket session that triggered this reservation.
   * null if reservation was created outside the basket flow.
   */
  basketSessionId: uuid("basket_session_id").references(
    () => basketSessions.id
  ),

  /**
   * FK to the authenticated customer who initiated checkout.
   * null for guest checkouts that haven't authenticated yet.
   */
  customerId: uuid("customer_id").references(() => customers.id),

  /**
   * FK to the inventory item being reserved.
   * Always non-null — every reservation is for a specific inventory row.
   */
  inventoryItemId: uuid("inventory_item_id")
    .notNull()
    .references(() => inventoryItems.id),

  /**
   * FK to the order created from this reservation.
   * null = order has not yet been placed (customer is on payment step).
   * Non-null = order placed; linked after OrderService.createOrder() succeeds.
   */
  orderId: uuid("order_id"),

  /** Number of units reserved from quantityAvailable (D-21). Always >= 1. */
  quantity: integer("quantity").notNull(),

  /**
   * Lifecycle status of the reservation.
   * 'reserved': active reservation, payment pending.
   * 'consumed': payment captured, reservation fulfilled (quantityReserved decremented).
   * 'expired': TTL elapsed, stock returned to quantityAvailable by ReleaseReservationJob.
   */
  status: text("status").notNull().default("reserved"),

  /**
   * Reservation expiry timestamp (D-07).
   * 15 minutes from creation. BullMQ ReleaseReservationJob fires at this time
   * with jobId `release-reservation:${id}` (deterministic, prevents duplicates).
   */
  expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new inventory reservation row */
export type InsertInventoryReservation = typeof inventoryReservations.$inferInsert;

/** TypeScript type for selecting an inventory reservation row */
export type SelectInventoryReservation = typeof inventoryReservations.$inferSelect;
