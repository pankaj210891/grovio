import { and, count, eq, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  vendors,
  vendorCategoryRestrictions,
  commissionRules,
} from "../../db/schema/index.js";
import type { AuditService } from "../audit/AuditService.js";
import type { AdminVendorListItem, AdminVendorListResponse } from "@grovio/contracts/admin/vendors";

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface VendorManagementServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  auditService: AuditService;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface ConfigureVendorInput {
  categoryRestrictionIds: string[];
  commissionOverridePercent: number | null;
}

export interface ListVendorsOptions {
  limit?: number;
  offset?: number;
}

// ---------------------------------------------------------------------------
// VendorManagementService
// ---------------------------------------------------------------------------

/**
 * VendorManagementService
 *
 * Admin control-plane service for vendor lifecycle management (ADM-02, D-17).
 *
 * Methods:
 * - approveVendor(vendorId, adminEmail, ip) — sets onboarding_status='approved', audits 'vendor.approved'
 * - suspendVendor(vendorId, adminEmail, ip) — sets onboarding_status='suspended', audits 'vendor.suspended'
 * - reinstateVendor(vendorId, adminEmail, ip) — sets onboarding_status='approved', audits 'vendor.reinstated'
 * - configureVendor(vendorId, input, adminEmail) — replaces restrictions + upserts commission override, audits 'vendor.configured'
 * - listVendors(opts) — paginated vendor list with GMV, product count, restriction count
 *
 * Every mutation loads the before-state, performs the update, then calls auditService.log
 * with before/after JSON (T-06-24 mitigation).
 *
 * Covers ADM-02, D-17, T-06-24.
 */
export class VendorManagementService {
  constructor(private deps: VendorManagementServiceDeps) {}

  // ── Internal helpers ─────────────────────────────────────────────────────

  /** Load a vendor row (before-state for audit). Throws if not found. */
  private async loadVendor(vendorId: string) {
    const { db } = this.deps;
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);
    if (!rows[0]) throw new Error(`Vendor not found: ${vendorId}`);
    return rows[0];
  }

  // ── Lifecycle mutations ───────────────────────────────────────────────────

  /**
   * Approve a pending vendor.
   * Sets onboarding_status='approved'; writes audit 'vendor.approved'.
   */
  async approveVendor(
    vendorId: string,
    adminEmail: string,
    ip?: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    const before = await this.loadVendor(vendorId);

    await db
      .update(vendors)
      .set({ onboardingStatus: "approved", updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "vendor.approved",
      entityType: "vendor",
      entityId: vendorId,
      before: { onboardingStatus: before.onboardingStatus },
      after: { onboardingStatus: "approved" },
      ...(ip !== undefined ? { ipAddress: ip } : {}),
    });
  }

  /**
   * Suspend an active vendor.
   * Sets onboarding_status='suspended'; writes audit 'vendor.suspended'.
   * Suspended vendors cannot log in (checked by VendorAuthService at login time).
   */
  async suspendVendor(
    vendorId: string,
    adminEmail: string,
    ip?: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    const before = await this.loadVendor(vendorId);

    await db
      .update(vendors)
      .set({ onboardingStatus: "suspended", updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "vendor.suspended",
      entityType: "vendor",
      entityId: vendorId,
      before: { onboardingStatus: before.onboardingStatus },
      after: { onboardingStatus: "suspended" },
      ...(ip !== undefined ? { ipAddress: ip } : {}),
    });
  }

  /**
   * Reinstate a suspended vendor.
   * Sets onboarding_status='approved'; writes audit 'vendor.reinstated'.
   */
  async reinstateVendor(
    vendorId: string,
    adminEmail: string,
    ip?: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    const before = await this.loadVendor(vendorId);

    await db
      .update(vendors)
      .set({ onboardingStatus: "approved", updatedAt: new Date() })
      .where(eq(vendors.id, vendorId));

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "vendor.reinstated",
      entityType: "vendor",
      entityId: vendorId,
      before: { onboardingStatus: before.onboardingStatus },
      after: { onboardingStatus: "approved" },
      ...(ip !== undefined ? { ipAddress: ip } : {}),
    });
  }

  /**
   * Configure a vendor's category restrictions and commission override.
   *
   * - Replaces all existing vendor_category_restrictions for this vendor with the provided set.
   * - Upserts a vendor-scoped commission rule if commissionOverridePercent is non-null;
   *   removes the vendor-scoped rule if commissionOverridePercent is null (falls back to category/global chain).
   * - Writes audit 'vendor.configured' with before/after configuration.
   */
  async configureVendor(
    vendorId: string,
    input: ConfigureVendorInput,
    adminId: string,
    adminEmail: string
  ): Promise<void> {
    const { db, auditService } = this.deps;

    // Load before-state for audit
    void (await this.loadVendor(vendorId)); // throws VendorNotFoundError if absent

    const beforeRestrictions = await db
      .select()
      .from(vendorCategoryRestrictions)
      .where(eq(vendorCategoryRestrictions.vendorId, vendorId));

    // WR-01: load existing commission override BEFORE any mutations so the audit
    // before-state reflects the real current value (not always null).
    const existingOverride = await db
      .select()
      .from(commissionRules)
      .where(
        and(
          eq(commissionRules.scope, "vendor"),
          eq(commissionRules.vendorId, vendorId)
        )
      )
      .limit(1);
    const beforeCommissionOverridePercent = existingOverride[0]
      ? Number(existingOverride[0].ratePercent)
      : null;

    // WR-02: wrap DELETE + INSERT in a transaction to prevent a concurrent read
    // from seeing zero restrictions between the two statements.
    await db.transaction(async (tx) => {
      // Replace category restrictions: delete all existing, then insert new set
      await tx
        .delete(vendorCategoryRestrictions)
        .where(eq(vendorCategoryRestrictions.vendorId, vendorId));

      if (input.categoryRestrictionIds.length > 0) {
        await tx.insert(vendorCategoryRestrictions).values(
          input.categoryRestrictionIds.map((categoryId) => ({
            vendorId,
            categoryId,
            // WR-03: use adminId (UUID from JWT sub) — not adminEmail string
            createdByAdminId: adminId,
          }))
        );
      }

      // Handle commission override inside the same transaction
      if (input.commissionOverridePercent !== null) {
        if (existingOverride[0]) {
          // Update existing vendor rule
          await tx
            .update(commissionRules)
            .set({
              ratePercent: input.commissionOverridePercent.toFixed(2),
              updatedAt: new Date(),
            })
            .where(eq(commissionRules.id, existingOverride[0].id));
        } else {
          // Insert new vendor-scoped rule
          await tx.insert(commissionRules).values({
            scope: "vendor",
            vendorId,
            categoryId: null,
            ratePercent: input.commissionOverridePercent.toFixed(2),
          });
        }
      } else {
        // commissionOverridePercent is null — remove any vendor-scoped rule
        await tx
          .delete(commissionRules)
          .where(
            and(
              eq(commissionRules.scope, "vendor"),
              eq(commissionRules.vendorId, vendorId)
            )
          );
      }
    });

    await auditService.log({
      actorType: "admin",
      actorId: adminEmail,
      actorEmail: adminEmail,
      action: "vendor.configured",
      entityType: "vendor",
      entityId: vendorId,
      before: {
        categoryRestrictionIds: beforeRestrictions.map((r) => r.categoryId),
        // WR-01: real before-state value, not hardcoded null
        commissionOverridePercent: beforeCommissionOverridePercent,
      },
      after: {
        categoryRestrictionIds: input.categoryRestrictionIds,
        commissionOverridePercent: input.commissionOverridePercent,
      },
    });
  }

  /**
   * List all vendors with admin badge data.
   * Returns paginated AdminVendorListItem rows.
   *
   * Includes: onboarding_status, join date, GMV last 30d (placeholder — computed
   * from AnalyticsService in full implementation; 0 here for service layer), product count,
   * restriction count.
   *
   * @param opts.limit default 50
   * @param opts.offset default 0
   */
  async listVendors(
    opts: ListVendorsOptions = {}
  ): Promise<AdminVendorListResponse> {
    const { db } = this.deps;
    const limit = opts.limit ?? 50;
    const offset = opts.offset ?? 0;

    // Get total count
    const countResult = await db
      .select({ total: count() })
      .from(vendors)
      .where(sql`${vendors.archivedAt} IS NULL`);
    const total = Number(countResult[0]?.total ?? 0);

    // Get vendor rows with pagination
    const rows = await db
      .select()
      .from(vendors)
      .where(sql`${vendors.archivedAt} IS NULL`)
      .orderBy(vendors.createdAt)
      .limit(limit)
      .offset(offset);

    // Map to AdminVendorListItem (GMV and counts are simplified for service layer)
    const items: AdminVendorListItem[] = rows.map((v) => ({
      id: v.id,
      name: v.name,
      ownerEmail: v.email,
      storeName: v.storeName ?? null,
      onboardingStatus: v.onboardingStatus as AdminVendorListItem["onboardingStatus"],
      joinedAt: v.createdAt.toISOString(),
      gmvLast30dMinor: 0, // computed by AnalyticsService; 0 here for base service
      productCount: 0,    // computed via JOIN; 0 here for base service
      categoryRestrictionCount: 0, // computed via JOIN; 0 here for base service
    }));

    return { items, total, limit, offset };
  }
}
