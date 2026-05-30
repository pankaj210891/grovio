import { z } from "zod";

/**
 * Vendor category restriction — represents an approved vendor for a restricted category.
 *
 * Per D-10, the DB table stores { id, category_id, vendor_id, created_at, created_by_admin_id }.
 * Per D-11, restriction enforcement (blocking unauthorized vendors) happens in Phase 3.
 * Phase 2 delivers schema + admin CRUD + query API only.
 *
 * Note: vendor_id and created_by_admin_id FK constraints are deferred to Phase 3 and
 * Phase 4 respectively (vendors and users tables do not exist yet in Phase 2).
 * Covers CAT-06.
 */
export const VendorCategoryRestrictionSchema = z.object({
  id: z.string().uuid(),
  categoryId: z.string().uuid(),
  vendorId: z.string().uuid(),
  createdAt: z.string().datetime(),
  createdByAdminId: z.string().uuid(),
});

/** TypeScript type for a vendor category restriction */
export type VendorCategoryRestriction = z.infer<typeof VendorCategoryRestrictionSchema>;

/**
 * Response schema for GET /categories/:id/restrictions.
 * Returns the category's restricted status and the list of approved vendor IDs.
 */
export const CategoryRestrictionsResponseSchema = z.object({
  isRestricted: z.boolean(),
  approvedVendorIds: z.array(z.string().uuid()),
});

/** TypeScript type for the category restrictions response */
export type CategoryRestrictionsResponse = z.infer<typeof CategoryRestrictionsResponseSchema>;
