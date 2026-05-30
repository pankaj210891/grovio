import { z } from "zod";

/**
 * Vendor category restriction contracts.
 *
 * Per D-10 / CAT-06: Admin can restrict which vendors may sell in which categories.
 * Each row in vendor_category_restrictions represents one vendor-category approval.
 *
 * Note: vendor_id and created_by_admin_id are UUIDs without FK constraints in Phase 2.
 * FKs to vendors and admin/users tables are added in Phase 3 and Phase 4 migrations
 * when the referenced tables exist.
 *
 * Enforcement of restrictions at product creation is deferred to Phase 3 (D-11).
 */

/**
 * A vendor category restriction entry as stored and returned by the API.
 * Represents admin approval for a specific vendor to sell in a specific category.
 */
export const VendorCategoryRestrictionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  /** Vendor UUID — references vendors table (Phase 3 adds FK) */
  vendorId: z.string().uuid(),
  /** ISO-8601 UTC timestamp when the restriction was created */
  createdAt: z.string().datetime(),
  /** Admin user UUID who created the restriction — references users table (Phase 4 adds FK) */
  createdByAdminId: z.string().uuid(),
});

/** TypeScript type inferred from VendorCategoryRestrictionSchema */
export type VendorCategoryRestriction = z.infer<
  typeof VendorCategoryRestrictionSchema
>;
