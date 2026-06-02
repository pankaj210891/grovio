import { integer, pgTable, timestamp, uuid } from "drizzle-orm/pg-core";
import { productVariants } from "./product-variants.js";
import { products } from "./products.js";

/**
 * inventory_items table
 *
 * Tracks stock levels for products and product variants (D-20, D-21).
 *
 * Key design decisions:
 * - D-20: Dual nullable FK pattern — exactly one of productVariantId or productId is non-null
 *   per row. Variant products link via productVariantId; variant-free products link via productId.
 *   This fulfills Phase 3 D-04's forward contract: "Phase 5 adds inventory_items linking to
 *   product_variant_id (or product_id for variant-free products)."
 *   The "exactly one non-null" invariant is enforced at the service layer, not at DB level
 *   (would require a CHECK constraint; service validation is simpler for Phase 5).
 *
 * - D-21: Two-column reservation model:
 *     quantityAvailable: units available for new reservations
 *     quantityReserved: units held for pending checkouts
 *   Reservation: atomic decrement quantityAvailable + increment quantityReserved (SELECT FOR UPDATE).
 *   Payment success: decrement quantityReserved (stock sold — no change to quantityAvailable).
 *   Abandonment (BullMQ ReleaseReservationJob): decrement quantityReserved + increment quantityAvailable.
 *   Effective available = quantityAvailable (does not include reserved units, per D-21).
 *
 * - lowStockThreshold: optional threshold for low-stock alerts (Phase 6 UI).
 *
 * No money columns in this table — inventory is purely unit counts.
 *
 * Covers CHK-05 (atomic reservation), ORD-02 (consumption on order finalization).
 */
export const inventoryItems = pgTable("inventory_items", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * FK to the product variant this inventory row tracks (D-20).
   * Non-null for variant products; null for variant-free products.
   * Cascade delete: removing a variant removes its inventory row.
   */
  productVariantId: uuid("product_variant_id").references(
    () => productVariants.id,
    { onDelete: "cascade" }
  ),

  /**
   * FK to the product this inventory row tracks (D-20).
   * Non-null for variant-free products; null for variant products (productVariantId is set instead).
   * Cascade delete: removing a product removes its inventory row.
   */
  productId: uuid("product_id").references(() => products.id, {
    onDelete: "cascade",
  }),

  /**
   * Units available for new reservations (D-21).
   * Decremented atomically on reservation (SELECT FOR UPDATE in transaction).
   * Incremented on reservation expiry (ReleaseReservationJob) or order cancellation.
   * Never goes negative — service layer enforces this with the lock.
   */
  quantityAvailable: integer("quantity_available").notNull().default(0),

  /**
   * Units held for pending checkouts (D-21).
   * Incremented on reservation; decremented on payment success (order finalization).
   * Released back to quantityAvailable on reservation expiry (ReleaseReservationJob).
   * Together with quantityAvailable provides full inventory accounting.
   */
  quantityReserved: integer("quantity_reserved").notNull().default(0),

  /**
   * Optional threshold below which low-stock alerts trigger (Phase 6).
   * null = no threshold configured for this item.
   * When quantityAvailable <= lowStockThreshold, the item is flagged as low stock.
   */
  lowStockThreshold: integer("low_stock_threshold"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new inventory item row */
export type InsertInventoryItem = typeof inventoryItems.$inferInsert;

/** TypeScript type for selecting an inventory item row */
export type SelectInventoryItem = typeof inventoryItems.$inferSelect;
