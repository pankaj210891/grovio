import { z } from "zod";
import { VendorOnboardingStatusSchema } from "../vendor/profile.js";

/**
 * Admin vendor management contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-02, D-17: Admin vendor list page — paginated table of all vendors with
 *   per-row actions: Approve pending, Suspend active, Reinstate suspended, Configure.
 *
 * Per D-17: onboarding_status drives approval workflow. No hard-delete — archived_at
 *   soft-delete for admin-initiated removal.
 *
 * Per D-01: VendorOnboardingStatus enum values: pending|approved|suspended.
 *   Imported from vendor/profile to avoid duplication.
 *
 * All money fields are minor currency units (integers), named *Minor per Pitfall 1.
 */

// ---------------------------------------------------------------------------
// Admin Vendor List (D-17, ADM-02)
// ---------------------------------------------------------------------------

/**
 * A single vendor row in the admin vendor management list.
 */
export const AdminVendorListItemSchema = z.object({
  /** vendors row ID (UUID) */
  id: z.string().uuid(),
  /** Vendor owner display name */
  name: z.string(),
  /** Vendor owner email */
  ownerEmail: z.string().email(),
  /** Public store name (nullable — may not be set for new vendors) */
  storeName: z.string().nullable(),
  /** Current onboarding/approval status */
  onboardingStatus: VendorOnboardingStatusSchema,
  /** ISO-8601 timestamp when vendor account was created */
  joinedAt: z.string().datetime(),
  /**
   * Vendor GMV (gross merchandise value) in the last 30 days (minor currency units).
   * Computed from vendor sub-orders finalized in the last 30 days.
   */
  gmvLast30dMinor: z.number().int(),
  /** Total number of active (non-archived) products */
  productCount: z.number().int(),
  /** Number of category restriction records for this vendor */
  categoryRestrictionCount: z.number().int(),
});

/** TypeScript type inferred from AdminVendorListItemSchema */
export type AdminVendorListItem = z.infer<typeof AdminVendorListItemSchema>;

/**
 * Paginated response for the admin vendor list.
 * Uses offset pagination (suitable for v1 admin use — D-17).
 */
export const AdminVendorListResponseSchema = z.object({
  /** Array of vendor list items */
  items: z.array(AdminVendorListItemSchema),
  /** Total count of vendors matching the query (for pagination UI) */
  total: z.number().int(),
  /** Page size */
  limit: z.number().int(),
  /** Offset into the result set */
  offset: z.number().int(),
});

/** TypeScript type inferred from AdminVendorListResponseSchema */
export type AdminVendorListResponse = z.infer<typeof AdminVendorListResponseSchema>;

// ---------------------------------------------------------------------------
// Vendor Status Actions (ADM-02, D-17)
// ---------------------------------------------------------------------------

/**
 * Input for suspending a vendor (vendorId is a path param).
 * Sets onboarding_status = 'suspended'; vendor_users cannot log in when suspended.
 */
export const SuspendVendorInputSchema = z.object({
  /** Optional reason for suspension (for audit log) */
  reason: z.string().optional(),
});

/** TypeScript type inferred from SuspendVendorInputSchema */
export type SuspendVendorInput = z.infer<typeof SuspendVendorInputSchema>;

/**
 * Input for approving a pending vendor (vendorId is a path param).
 * Sets onboarding_status = 'approved'.
 */
export const ApproveVendorInputSchema = z.object({
  /** Optional note for audit log */
  note: z.string().optional(),
});

/** TypeScript type inferred from ApproveVendorInputSchema */
export type ApproveVendorInput = z.infer<typeof ApproveVendorInputSchema>;

/**
 * Input for reinstating a suspended vendor (vendorId is a path param).
 * Sets onboarding_status = 'approved'.
 */
export const ReinstateVendorInputSchema = z.object({
  /** Optional note for audit log */
  note: z.string().optional(),
});

/** TypeScript type inferred from ReinstateVendorInputSchema */
export type ReinstateVendorInput = z.infer<typeof ReinstateVendorInputSchema>;

// ---------------------------------------------------------------------------
// Vendor Configuration (ADM-02, D-17)
// ---------------------------------------------------------------------------

/**
 * Input for configuring a vendor's category restrictions and commission override.
 * Submitted via the "Configure" side panel on the admin vendor list.
 */
export const ConfigureVendorInputSchema = z.object({
  /** Array of category UUIDs the vendor is restricted to (empty = unrestricted) */
  categoryRestrictionIds: z.array(z.string().uuid()),
  /**
   * Per-vendor commission override percentage (null = use global/category rate).
   * Overrides all category-level rules for this vendor (highest priority in D-14 chain).
   */
  commissionOverridePercent: z.number().min(0).max(100).nullable(),
});

/** TypeScript type inferred from ConfigureVendorInputSchema */
export type ConfigureVendorInput = z.infer<typeof ConfigureVendorInputSchema>;
