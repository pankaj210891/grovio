import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  vendors,
  vendorPayoutInfo,
  vendorReturnPolicies,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class VendorNotFoundError extends Error {
  readonly code = "VENDOR_NOT_FOUND";
  constructor(vendorId: string) {
    super(`Vendor not found: ${vendorId}`);
    this.name = "VendorNotFoundError";
  }
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface UpdateProfileInput {
  storeName?: string;
  storeDescription?: string | null;
  logoUrl?: string | null;
  bannerUrl?: string | null;
  contactEmail?: string | null;
  contactPhone?: string | null;
  address?: string | null;
}

export interface UpdatePayoutInfoInput {
  accountHolderName: string;
  bankAccountNumber: string;
  ifscOrRoutingCode: string;
  bankName: string;
}

export interface UpdateReturnPolicyInput {
  returnWindowDays: number;
  isReturnable: boolean;
  conditions?: string | null;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface VendorProfile {
  id: string;
  storeName: string | null;
  storeDescription: string | null;
  logoUrl: string | null;
  bannerUrl: string | null;
  contactEmail: string | null;
  contactPhone: string | null;
  address: string | null;
  onboardingStatus: "pending" | "approved" | "suspended";
}

export interface VendorPayoutInfoResult {
  id: string;
  vendorId: string;
  accountHolderName: string;
  bankAccountNumber: string;
  ifscOrRoutingCode: string;
  bankName: string;
  updatedAt: Date;
}

export interface VendorReturnPolicyResult {
  id: string;
  vendorId: string;
  returnWindowDays: number;
  isReturnable: boolean;
  conditions: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface VendorProfileServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// VendorProfileService
// ---------------------------------------------------------------------------

/**
 * VendorProfileService
 *
 * Manages vendor store profile, payout info, and return policy.
 *
 * Security:
 * - T-06-15: getProfile NEVER returns payout banking fields (D-02).
 *   Banking data lives in vendor_payout_info, fetched only via getPayoutInfo()
 *   with explicit owner-role gate at the route layer.
 * - D-01: updateProfile can only modify public store profile columns.
 *   onboardingStatus is NEVER writable via this method (admin-only).
 *
 * Covers D-01, D-02, VEN-01, T-06-15.
 */
export class VendorProfileService {
  constructor(private deps: VendorProfileServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Get the vendor's public store profile (D-01).
   *
   * Returns a STRICT subset of vendor columns — NEVER includes payout banking fields.
   * The payout fields (accountHolderName, bankAccountNumber, etc.) live in a separate
   * vendor_payout_info table and are only accessible via getPayoutInfo() (T-06-15, D-02).
   *
   * @returns Profile or null if vendor not found.
   */
  async getProfile(vendorId: string): Promise<VendorProfile | null> {
    const { db } = this.deps;

    const rows = await db
      .select({
        id: vendors.id,
        storeName: vendors.storeName,
        storeDescription: vendors.storeDescription,
        logoUrl: vendors.logoUrl,
        bannerUrl: vendors.bannerUrl,
        contactEmail: vendors.contactEmail,
        contactPhone: vendors.contactPhone,
        address: vendors.address,
        onboardingStatus: vendors.onboardingStatus,
      })
      .from(vendors)
      .where(eq(vendors.id, vendorId))
      .limit(1);

    const row = rows[0];
    if (!row) return null;

    // Explicit mapping — no spread that could accidentally include banking fields
    return {
      id: row.id,
      storeName: row.storeName,
      storeDescription: row.storeDescription,
      logoUrl: row.logoUrl,
      bannerUrl: row.bannerUrl,
      contactEmail: row.contactEmail,
      contactPhone: row.contactPhone,
      address: row.address,
      onboardingStatus: row.onboardingStatus,
    };
  }

  /**
   * Update vendor store profile (D-01 columns only).
   *
   * Whitelisted to D-01 columns only — onboardingStatus is NOT writable.
   * Admin uses a separate admin service to update onboardingStatus (ADM-02, D-17).
   */
  async updateProfile(vendorId: string, input: UpdateProfileInput): Promise<void> {
    const { db } = this.deps;

    // Whitelist: only D-01 public store profile columns can be updated
    // onboardingStatus is deliberately excluded (admin-only via ADM-02)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const setValues: Record<string, any> = { updatedAt: new Date() };
    if (input.storeName !== undefined) setValues["storeName"] = input.storeName;
    if (input.storeDescription !== undefined) setValues["storeDescription"] = input.storeDescription;
    if (input.logoUrl !== undefined) setValues["logoUrl"] = input.logoUrl;
    if (input.bannerUrl !== undefined) setValues["bannerUrl"] = input.bannerUrl;
    if (input.contactEmail !== undefined) setValues["contactEmail"] = input.contactEmail;
    if (input.contactPhone !== undefined) setValues["contactPhone"] = input.contactPhone;
    if (input.address !== undefined) setValues["address"] = input.address;

    await db
      .update(vendors)
      .set(setValues)
      .where(eq(vendors.id, vendorId));
  }

  /**
   * Get vendor payout banking info (D-02).
   *
   * Isolated in a separate method requiring explicit owner-role gate at route layer.
   * Returns null when no payout info has been configured yet.
   */
  async getPayoutInfo(vendorId: string): Promise<VendorPayoutInfoResult | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(vendorPayoutInfo)
      .where(eq(vendorPayoutInfo.vendorId, vendorId))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Upsert vendor payout banking info (D-02).
   *
   * Uses onConflictDoUpdate on vendorId (the UNIQUE column) — exactly one row per vendor.
   * Owner-role gate enforced at route layer.
   */
  async updatePayoutInfo(vendorId: string, input: UpdatePayoutInfoInput): Promise<void> {
    const { db } = this.deps;

    await db
      .insert(vendorPayoutInfo)
      .values({
        vendorId,
        accountHolderName: input.accountHolderName,
        bankAccountNumber: input.bankAccountNumber,
        ifscOrRoutingCode: input.ifscOrRoutingCode,
        bankName: input.bankName,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vendorPayoutInfo.vendorId,
        set: {
          accountHolderName: input.accountHolderName,
          bankAccountNumber: input.bankAccountNumber,
          ifscOrRoutingCode: input.ifscOrRoutingCode,
          bankName: input.bankName,
          updatedAt: new Date(),
        },
      });
  }

  /**
   * Get vendor return policy configuration (D-22, Phase 6 vendor UI).
   *
   * Returns null when no row exists (ReturnService uses global defaults in that case).
   */
  async getReturnPolicy(vendorId: string): Promise<VendorReturnPolicyResult | null> {
    const { db } = this.deps;

    const rows = await db
      .select()
      .from(vendorReturnPolicies)
      .where(eq(vendorReturnPolicies.vendorId, vendorId))
      .limit(1);

    return rows[0] ?? null;
  }

  /**
   * Upsert vendor return policy (D-22).
   *
   * One row per vendor (unique vendorId FK). Upsert creates or updates the policy.
   */
  async updateReturnPolicy(vendorId: string, input: UpdateReturnPolicyInput): Promise<void> {
    const { db } = this.deps;

    await db
      .insert(vendorReturnPolicies)
      .values({
        vendorId,
        returnWindowDays: input.returnWindowDays,
        isReturnable: input.isReturnable,
        conditions: input.conditions ?? null,
        updatedAt: new Date(),
      })
      .onConflictDoUpdate({
        target: vendorReturnPolicies.vendorId,
        set: {
          returnWindowDays: input.returnWindowDays,
          isReturnable: input.isReturnable,
          conditions: input.conditions ?? null,
          updatedAt: new Date(),
        },
      });
  }
}
