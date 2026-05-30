import { pgTable, timestamp, unique, uuid } from "drizzle-orm/pg-core";
import { categories } from "./categories.js";

/**
 * vendor_category_restrictions table
 *
 * Records which vendors are approved to sell in restricted categories (D-10).
 * An entry means the vendor IS approved. Absence means not approved (if the category
 * has isRestricted=true).
 *
 * Business rule enforcement is in Phase 3 (D-11). Phase 2 delivers:
 *   - Schema + migration (this plan)
 *   - Admin CRUD API (plan 02-06)
 *   - Admin UI (plan 02-08)
 *
 * NOTE: Deferred FK constraints (T-02-05, Pitfall 6 from RESEARCH.md):
 *   - vendorId: uuid without FK — the vendors table does not exist until Phase 3.
 *     FK will be added in the Phase 3 migration once the vendors table is created.
 *   - createdByAdminId: uuid without FK — the users/admin table does not exist until Phase 4.
 *     FK will be added in the Phase 4 migration once the users table is created.
 *
 * This is intentional and safe because the admin UI for vendor restrictions is
 * dev-only / guarded in Phase 2, so this table is empty at Phase 2 completion.
 * No invalid vendor_id or admin_id values can be inserted before the FKs are added.
 *
 * Covers CAT-06.
 */
export const vendorCategoryRestrictions = pgTable(
  "vendor_category_restrictions",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /**
     * FK to the restricted category. Cascade: deleting a category removes all
     * its vendor restriction entries.
     */
    categoryId: uuid("category_id")
      .notNull()
      .references(() => categories.id, { onDelete: "cascade" }),

    /**
     * UUID of the approved vendor.
     * DEFERRED FK: no .references() here — vendors table doesn't exist until Phase 3.
     * FK constraint will be added in the Phase 3 migration:
     *   ALTER TABLE vendor_category_restrictions
     *   ADD CONSTRAINT vcr_vendor_id_fk FOREIGN KEY (vendor_id) REFERENCES vendors(id);
     */
    vendorId: uuid("vendor_id").notNull(),

    createdAt: timestamp("created_at", { withTimezone: true })
      .defaultNow()
      .notNull(),

    /**
     * UUID of the admin who created this restriction entry.
     * DEFERRED FK: no .references() here — users table doesn't exist until Phase 4.
     * FK constraint will be added in the Phase 4 migration:
     *   ALTER TABLE vendor_category_restrictions
     *   ADD CONSTRAINT vcr_admin_id_fk FOREIGN KEY (created_by_admin_id) REFERENCES users(id);
     */
    createdByAdminId: uuid("created_by_admin_id").notNull(),
  },
  (t) => [
    /**
     * Composite unique constraint: one restriction entry per (category, vendor) pair.
     * Prevents duplicate approval entries for the same vendor/category combination (D-10).
     */
    unique().on(t.categoryId, t.vendorId),
  ]
);

/** TypeScript type for inserting a new vendor category restriction row */
export type InsertVendorCategoryRestriction =
  typeof vendorCategoryRestrictions.$inferInsert;

/** TypeScript type for selecting a vendor category restriction row */
export type SelectVendorCategoryRestriction =
  typeof vendorCategoryRestrictions.$inferSelect;
