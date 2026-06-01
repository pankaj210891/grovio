import { and, asc, eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  customerAddresses,
  type InsertCustomerAddress,
  type SelectCustomerAddress,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps interface — no Redis cache (address data is customer-specific, not shared)
// ---------------------------------------------------------------------------

interface CustomerAddressServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Input types
// ---------------------------------------------------------------------------

export interface CreateAddressInput {
  label: string | null;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  isDefault: boolean;
}

export interface UpdateAddressInput {
  label?: string | null | undefined;
  street?: string | undefined;
  city?: string | undefined;
  state?: string | undefined;
  pincode?: string | undefined;
  country?: string | undefined;
  lat?: number | null | undefined;
  lng?: number | null | undefined;
  placeId?: string | null | undefined;
  isDefault?: boolean | undefined;
}

// ---------------------------------------------------------------------------
// CustomerAddressService
// ---------------------------------------------------------------------------

/**
 * CustomerAddressService
 *
 * Owns the full CRUD lifecycle for customer delivery addresses.
 *
 * AUTH-05 isolation: every read and write operation is scoped to the requesting
 * customerId. It is structurally impossible for a customer to read, modify, or
 * delete another customer's address — all Drizzle queries include an
 * `eq(customerAddresses.customerId, customerId)` predicate.
 *
 * No Redis cache — address data is customer-specific (not shared/global).
 * Per-customer query results are not worth caching and would require per-user
 * cache key management (PATTERNS.md § CustomerAddressService.ts).
 *
 * isDefault: multiple addresses may have isDefault=true in Phase 4.
 * Single-default enforcement is deferred to Phase 5 / checkout flow (documented
 * in plan acceptance criteria as acceptable).
 *
 * Covers AUTH-05 (per-customer address isolation).
 * Mitigates T-04-10 (information disclosure via cross-customer address reads).
 */
export class CustomerAddressService {
  constructor(private deps: CustomerAddressServiceDeps) {}

  /**
   * List all addresses belonging to the given customer, ordered by createdAt ASC.
   *
   * AUTH-05: Only addresses with customerId = the given customerId are returned.
   * Another customer's addresses are never visible.
   */
  async listAddresses(customerId: string): Promise<SelectCustomerAddress[]> {
    const { db } = this.deps;
    return db
      .select()
      .from(customerAddresses)
      .where(eq(customerAddresses.customerId, customerId))
      .orderBy(asc(customerAddresses.createdAt));
  }

  /**
   * Create a new address for the given customer.
   *
   * The customerId is supplied by the caller (auth middleware) — not from
   * the request body — so customers cannot create addresses under another
   * customer's account.
   *
   * @returns The newly created address row.
   */
  async createAddress(
    customerId: string,
    input: CreateAddressInput
  ): Promise<SelectCustomerAddress> {
    const { db } = this.deps;

    const now = new Date();
    const insertValues: InsertCustomerAddress = {
      customerId,
      label: input.label ?? null,
      street: input.street,
      city: input.city,
      state: input.state,
      pincode: input.pincode,
      country: input.country,
      lat: input.lat ?? null,
      lng: input.lng ?? null,
      placeId: input.placeId ?? null,
      isDefault: input.isDefault,
      createdAt: now,
      updatedAt: now,
    };

    const [row] = await db
      .insert(customerAddresses)
      .values(insertValues)
      .returning();

    return row!;
  }

  /**
   * Update mutable fields on an existing address.
   *
   * AUTH-05: Scopes the WHERE clause to BOTH id AND customerId.
   * If the address does not belong to the given customer, the update matches
   * zero rows and returns null — preventing cross-customer edits without
   * exposing whether the address ID exists at all.
   *
   * @returns The updated row, or null when no matching row was found.
   */
  async updateAddress(
    id: string,
    customerId: string,
    patch: UpdateAddressInput
  ): Promise<SelectCustomerAddress | null> {
    const { db } = this.deps;

    const updateValues: Partial<InsertCustomerAddress> = {
      updatedAt: new Date(),
    };

    if (patch.label !== undefined) updateValues.label = patch.label;
    if (patch.street !== undefined) updateValues.street = patch.street;
    if (patch.city !== undefined) updateValues.city = patch.city;
    if (patch.state !== undefined) updateValues.state = patch.state;
    if (patch.pincode !== undefined) updateValues.pincode = patch.pincode;
    if (patch.country !== undefined) updateValues.country = patch.country;
    if (patch.lat !== undefined) updateValues.lat = patch.lat;
    if (patch.lng !== undefined) updateValues.lng = patch.lng;
    if (patch.placeId !== undefined) updateValues.placeId = patch.placeId;
    if (patch.isDefault !== undefined) updateValues.isDefault = patch.isDefault;

    const rows = await db
      .update(customerAddresses)
      .set(updateValues)
      .where(
        and(
          eq(customerAddresses.id, id),
          eq(customerAddresses.customerId, customerId)
        )
      )
      .returning();

    return rows[0] ?? null;
  }

  /**
   * Delete an address by ID, scoped to the owning customer.
   *
   * AUTH-05: Scopes the WHERE clause to BOTH id AND customerId.
   * Returns false when no matching row was deleted — customers cannot detect
   * whether a foreign address ID exists.
   *
   * Hard delete — addresses have no soft-delete requirement.
   *
   * @returns true when a row was deleted, false otherwise.
   */
  async deleteAddress(id: string, customerId: string): Promise<boolean> {
    const { db } = this.deps;

    const rows = await db
      .delete(customerAddresses)
      .where(
        and(
          eq(customerAddresses.id, id),
          eq(customerAddresses.customerId, customerId)
        )
      )
      .returning();

    return rows.length > 0;
  }
}
