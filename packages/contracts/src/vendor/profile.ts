import { z } from "zod";

/**
 * Vendor profile and identity contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per D-01: Phase 6 extends the `vendors` table with public store profile fields:
 *   store_name, store_description, logo_url, banner_url, contact_email,
 *   contact_phone, address, onboarding_status pgEnum (pending|approved|suspended).
 *
 * Per D-05: Three vendor roles: owner | manager | staff.
 *   Permission enforcement is backend-side; frontend hides UI for lower-privileged roles.
 *
 * Per D-02: Sensitive payout banking data is stored in vendor_payout_info table.
 *   Isolated to prevent accidental exposure in vendor profile API responses.
 *
 * Per VEN-01: Vendor onboarding status drives the approval workflow (ADM-02).
 */

// ---------------------------------------------------------------------------
// Vendor Role (D-05, VEN-05)
// ---------------------------------------------------------------------------

/**
 * Vendor staff role enum.
 * - owner: full access; can invite/remove members; configure profile and payout info
 * - manager: products, inventory, pricing, orders, returns, coupons — no team/payout/settings
 * - staff: inventory levels (view/edit qty only), orders (view + mark shipped/delivered only)
 *
 * Values MUST exactly match the vendor_users.role pgEnum defined in plan 06-02.
 */
export const VendorRoleSchema = z.enum(["owner", "manager", "staff"]);

/** TypeScript type inferred from VendorRoleSchema */
export type VendorRole = z.infer<typeof VendorRoleSchema>;

// ---------------------------------------------------------------------------
// Vendor Onboarding Status (D-01, VEN-01, ADM-02)
// ---------------------------------------------------------------------------

/**
 * Vendor onboarding/approval status.
 * Controls whether a vendor can log in and appear on the storefront.
 * Values MUST exactly match the onboarding_status pgEnum on vendors table.
 */
export const VendorOnboardingStatusSchema = z.enum([
  "pending",
  "approved",
  "suspended",
]);

/** TypeScript type inferred from VendorOnboardingStatusSchema */
export type VendorOnboardingStatus = z.infer<typeof VendorOnboardingStatusSchema>;

// ---------------------------------------------------------------------------
// Vendor Store Profile (D-01, VEN-01)
// ---------------------------------------------------------------------------

/**
 * Vendor public-facing store profile shape.
 * Returned by GET /vendor/profile and used in admin vendor management.
 */
export const VendorStoreProfileSchema = z.object({
  /** Store display name (separate from owner's name used in auth) */
  storeName: z.string(),
  /** Public store description (nullable) */
  storeDescription: z.string().nullable(),
  /** Store logo image URL (nullable) */
  logoUrl: z.string().nullable(),
  /** Store banner image URL (nullable) */
  bannerUrl: z.string().nullable(),
  /** Public contact email (nullable) */
  contactEmail: z.string().nullable(),
  /** Public contact phone (nullable) */
  contactPhone: z.string().nullable(),
  /** Store address text (nullable) */
  address: z.string().nullable(),
  /** Current onboarding/approval status */
  onboardingStatus: VendorOnboardingStatusSchema,
});

/** TypeScript type inferred from VendorStoreProfileSchema */
export type VendorStoreProfile = z.infer<typeof VendorStoreProfileSchema>;

/**
 * Input for updating a vendor's own store profile.
 * All fields are optional. onboardingStatus is omitted — only admin can change it.
 */
export const UpdateVendorStoreProfileInputSchema = z.object({
  storeName: z.string().optional(),
  storeDescription: z.string().nullable().optional(),
  logoUrl: z.string().nullable().optional(),
  bannerUrl: z.string().nullable().optional(),
  contactEmail: z.string().email().nullable().optional(),
  contactPhone: z.string().nullable().optional(),
  address: z.string().nullable().optional(),
});

/** TypeScript type inferred from UpdateVendorStoreProfileInputSchema */
export type UpdateVendorStoreProfileInput = z.infer<typeof UpdateVendorStoreProfileInputSchema>;

// ---------------------------------------------------------------------------
// Vendor Payout Info (D-02)
// ---------------------------------------------------------------------------

/**
 * Vendor bank account details for manual settlement.
 * Stored in vendor_payout_info table (isolated from profile — D-02).
 */
export const VendorPayoutInfoSchema = z.object({
  /** Account holder name */
  accountHolderName: z.string(),
  /** Bank account number */
  bankAccountNumber: z.string(),
  /** IFSC (India) or ACH routing code (US) or equivalent */
  ifscOrRoutingCode: z.string(),
  /** Name of the bank */
  bankName: z.string(),
});

/** TypeScript type inferred from VendorPayoutInfoSchema */
export type VendorPayoutInfo = z.infer<typeof VendorPayoutInfoSchema>;

/**
 * Input for updating vendor payout banking details.
 */
export const UpdateVendorPayoutInfoInputSchema = z.object({
  accountHolderName: z.string(),
  bankAccountNumber: z.string(),
  ifscOrRoutingCode: z.string(),
  bankName: z.string(),
});

/** TypeScript type inferred from UpdateVendorPayoutInfoInputSchema */
export type UpdateVendorPayoutInfoInput = z.infer<typeof UpdateVendorPayoutInfoInputSchema>;

// ---------------------------------------------------------------------------
// Vendor Return Policy
// ---------------------------------------------------------------------------

/**
 * Vendor return policy configuration shape.
 * Phase 5 D-22 created vendor_return_policies table; Phase 6 adds vendor UI to configure it.
 */
export const VendorReturnPolicySchema = z.object({
  /** Number of days after delivery within which returns are accepted */
  returnWindowDays: z.number().int().min(0),
  /** Whether returns are enabled for this vendor */
  returnsEnabled: z.boolean(),
});

/** TypeScript type inferred from VendorReturnPolicySchema */
export type VendorReturnPolicy = z.infer<typeof VendorReturnPolicySchema>;

/**
 * Input for updating vendor return policy.
 */
export const UpdateVendorReturnPolicyInputSchema = z.object({
  returnWindowDays: z.number().int().min(0),
  returnsEnabled: z.boolean(),
});

/** TypeScript type inferred from UpdateVendorReturnPolicyInputSchema */
export type UpdateVendorReturnPolicyInput = z.infer<typeof UpdateVendorReturnPolicyInputSchema>;
