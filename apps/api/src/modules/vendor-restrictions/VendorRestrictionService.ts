import { and, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  categories,
  vendorCategoryRestrictions,
  type InsertVendorCategoryRestriction,
  type SelectVendorCategoryRestriction,
} from "../../db/schema/index.js";

interface VendorRestrictionServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

export interface AddVendorInput {
  categoryId: string;
  vendorId: string;
  createdByAdminId: string;
}

/**
 * VendorRestrictionService
 *
 * Manages the vendor-category restriction table (CAT-06 / D-10).
 *
 * Phase 2 scope: schema + CRUD + query API only.
 * Enforcement at product creation is Phase 3 (D-11). This service does NOT
 * add any enforcement hooks or product-creation guards.
 *
 * A restriction row means the vendor IS approved to sell in a restricted category.
 * Absence of a row means the vendor is NOT approved (when the category has
 * isRestricted=true). The isVendorAllowed() query answers this for Phase 3 use.
 *
 * NOTE: vendorId and createdByAdminId are bare UUIDs without FK constraints in Phase 2.
 * FKs to vendors (Phase 3) and users (Phase 4) tables will be added in future migrations.
 */
export class VendorRestrictionService {
  constructor(private deps: VendorRestrictionServiceDeps) {}

  /**
   * Return all approved vendorIds for a category.
   *
   * @param categoryId - UUID of the restricted category.
   * @returns Array of vendorId UUIDs that are approved for this category.
   */
  async getRestrictions(categoryId: string): Promise<string[]> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(vendorCategoryRestrictions)
      .where(eq(vendorCategoryRestrictions.categoryId, categoryId));

    return rows.map((r) => r.vendorId);
  }

  /**
   * Approve a vendor to sell in a restricted category.
   *
   * Throws if the (categoryId, vendorId) pair already exists (unique constraint).
   * The caller (route handler) should catch the DB unique-violation error and
   * return a clean 409 Conflict response.
   *
   * @param input - { categoryId, vendorId, createdByAdminId }
   */
  async addVendorToCategory(
    input: AddVendorInput
  ): Promise<SelectVendorCategoryRestriction> {
    const { db } = this.deps;

    const now = new Date();
    const values: InsertVendorCategoryRestriction = {
      categoryId: input.categoryId,
      vendorId: input.vendorId,
      createdByAdminId: input.createdByAdminId,
      createdAt: now,
    };

    const [row] = await db
      .insert(vendorCategoryRestrictions)
      .values(values)
      .returning();

    return row!;
  }

  /**
   * Remove a vendor's approval to sell in a category.
   *
   * Idempotent: deleting a non-existent row is a no-op (DELETE WHERE returns 0 rows).
   *
   * @param categoryId - UUID of the category.
   * @param vendorId   - UUID of the vendor to remove.
   */
  async removeVendorFromCategory(
    categoryId: string,
    vendorId: string
  ): Promise<void> {
    const { db } = this.deps;

    await db
      .delete(vendorCategoryRestrictions)
      .where(
        and(
          eq(vendorCategoryRestrictions.categoryId, categoryId),
          eq(vendorCategoryRestrictions.vendorId, vendorId)
        )
      );
  }

  /**
   * Check whether a specific vendor is approved to sell in a category.
   *
   * Returns true if a restriction row exists for (categoryId, vendorId).
   * Returns false otherwise (vendor not approved or category unrestricted).
   *
   * Used by Phase 3 product-creation enforcement (D-11).
   *
   * @param categoryId - UUID of the category to check.
   * @param vendorId   - UUID of the vendor to check.
   */
  async isVendorAllowed(categoryId: string, vendorId: string): Promise<boolean> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(vendorCategoryRestrictions)
      .where(
        and(
          eq(vendorCategoryRestrictions.categoryId, categoryId),
          eq(vendorCategoryRestrictions.vendorId, vendorId)
        )
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Check whether a category requires vendor approval.
   *
   * Reads the categories.is_restricted flag directly.
   * Returns false if the category does not exist.
   *
   * @param categoryId - UUID of the category to check.
   */
  async isCategoryRestricted(categoryId: string): Promise<boolean> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(categories)
      .where(eq(categories.id, categoryId))
      .limit(1);

    return rows[0]?.isRestricted ?? false;
  }
}
