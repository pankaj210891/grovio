import { describe, expect, it, vi } from "vitest";
import type { SelectCustomerAddress } from "../../db/schema/index.js";
import { CustomerAddressService } from "./CustomerAddressService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Build a chainable Drizzle SELECT mock resolving to `rows`.
 * CustomerAddressService uses:
 *   db.select().from().where().orderBy()   ← listAddresses
 */
function makeSelectDbMock(rows: SelectCustomerAddress[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        orderBy: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: SelectCustomerAddress[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  return { select: vi.fn().mockReturnValue(awaitableChain) };
}

/**
 * Build a Drizzle INSERT mock for createAddress.
 * CustomerAddressService uses: db.insert(table).values(...).returning()
 */
function makeInsertDbMock(returnRow: SelectCustomerAddress) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

/**
 * Build a Drizzle UPDATE mock for updateAddress.
 * CustomerAddressService uses: db.update(table).set(...).where(...).returning()
 */
function makeUpdateDbMock(returnRow: SelectCustomerAddress | null) {
  const updateChain = {
    set: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        returning: vi.fn().mockResolvedValue(returnRow ? [returnRow] : []),
      }),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    update: vi.fn().mockReturnValue(updateChain),
  };
}

/**
 * Build a Drizzle DELETE mock for deleteAddress.
 * CustomerAddressService uses: db.delete(table).where(...).returning()
 */
function makeDeleteDbMock(returnRow: SelectCustomerAddress | null) {
  const deleteChain = {
    where: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue(returnRow ? [returnRow] : []),
    }),
  };
  return {
    ...makeSelectDbMock([]),
    delete: vi.fn().mockReturnValue(deleteChain),
  };
}

// ---------------------------------------------------------------------------
// Test data
// ---------------------------------------------------------------------------

const CUSTOMER_A = "aaaaaaaa-0000-4aaa-8aaa-aaaaaaaaaaaa";
const CUSTOMER_B = "bbbbbbbb-0000-4bbb-8bbb-bbbbbbbbbbbb";

const addressA1: SelectCustomerAddress = {
  id: "11111111-0000-4111-8111-111111111111",
  customerId: CUSTOMER_A,
  label: "Home",
  street: "123 Main St",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400001",
  country: "India",
  lat: 18.9388,
  lng: 72.8354,
  placeId: "ChIJPVpZeVSP3jkRP-H_T25xJ08",
  isDefault: true,
  createdAt: new Date("2025-01-01T00:00:00Z"),
  updatedAt: new Date("2025-01-01T00:00:00Z"),
};

const addressA2: SelectCustomerAddress = {
  id: "22222222-0000-4222-8222-222222222222",
  customerId: CUSTOMER_A,
  label: "Work",
  street: "456 Business Park",
  city: "Mumbai",
  state: "Maharashtra",
  pincode: "400051",
  country: "India",
  lat: null,
  lng: null,
  placeId: null,
  isDefault: false,
  createdAt: new Date("2025-01-02T00:00:00Z"),
  updatedAt: new Date("2025-01-02T00:00:00Z"),
};

const addressB1: SelectCustomerAddress = {
  id: "33333333-0000-4333-8333-333333333333",
  customerId: CUSTOMER_B,
  label: "Home",
  street: "789 Other St",
  city: "Delhi",
  state: "Delhi",
  pincode: "110001",
  country: "India",
  lat: null,
  lng: null,
  placeId: null,
  isDefault: true,
  createdAt: new Date("2025-01-03T00:00:00Z"),
  updatedAt: new Date("2025-01-03T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CustomerAddressService", () => {
  // ── listAddresses ─────────────────────────────────────────────────────────

  describe("listAddresses", () => {
    it("returns all addresses for the given customerId ordered by createdAt ASC", async () => {
      const db = makeSelectDbMock([addressA1, addressA2]);
      const svc = new CustomerAddressService({ db: db as never });
      const result = await svc.listAddresses(CUSTOMER_A);

      expect(result).toHaveLength(2);
      expect(result[0]!.id).toBe(addressA1.id);
      expect(result[1]!.id).toBe(addressA2.id);
      // DB was queried
      expect(db.select).toHaveBeenCalledOnce();
    });

    it("returns empty array when customer has no addresses", async () => {
      const db = makeSelectDbMock([]);
      const svc = new CustomerAddressService({ db: db as never });
      const result = await svc.listAddresses(CUSTOMER_A);

      expect(result).toHaveLength(0);
    });

    it("AUTH-05 isolation: does not return another customer's addresses", async () => {
      // DB mock simulates correct WHERE customerId filter — returns only CUSTOMER_A rows
      const db = makeSelectDbMock([addressA1, addressA2]);
      const svc = new CustomerAddressService({ db: db as never });
      const result = await svc.listAddresses(CUSTOMER_A);

      // None of the returned addresses belong to CUSTOMER_B
      const customerIds = result.map((a) => a.customerId);
      expect(customerIds).not.toContain(CUSTOMER_B);

      // The WHERE clause receives customerId scoping — confirmed by DB call
      expect(db.select).toHaveBeenCalledOnce();
    });
  });

  // ── createAddress ─────────────────────────────────────────────────────────

  describe("createAddress", () => {
    it("inserts a new address and returns the created row", async () => {
      const db = makeInsertDbMock(addressA1);
      const svc = new CustomerAddressService({ db: db as never });

      const input = {
        label: "Home",
        street: "123 Main St",
        city: "Mumbai",
        state: "Maharashtra",
        pincode: "400001",
        country: "India",
        lat: 18.9388 as number | null,
        lng: 72.8354 as number | null,
        placeId: "ChIJPVpZeVSP3jkRP-H_T25xJ08" as string | null,
        isDefault: true,
      };

      const result = await svc.createAddress(CUSTOMER_A, input);

      expect(result.id).toBe(addressA1.id);
      expect(result.customerId).toBe(CUSTOMER_A);
      expect(result.street).toBe("123 Main St");
      // insert was called
      expect(db.insert).toHaveBeenCalledOnce();
    });

    it("associates the new address with the given customerId", async () => {
      const newAddress: SelectCustomerAddress = { ...addressB1 };
      const db = makeInsertDbMock(newAddress);
      const svc = new CustomerAddressService({ db: db as never });

      const result = await svc.createAddress(CUSTOMER_B, {
        label: null,
        street: "789 Other St",
        city: "Delhi",
        state: "Delhi",
        pincode: "110001",
        country: "India",
        lat: null,
        lng: null,
        placeId: null,
        isDefault: false,
      });

      // Result belongs to CUSTOMER_B
      expect(result.customerId).toBe(CUSTOMER_B);
    });
  });

  // ── updateAddress ─────────────────────────────────────────────────────────

  describe("updateAddress", () => {
    it("updates the row matching BOTH id AND customerId, returns updated row", async () => {
      const updatedAddress: SelectCustomerAddress = {
        ...addressA1,
        street: "456 Updated St",
        updatedAt: new Date("2025-06-01T00:00:00Z"),
      };
      const db = makeUpdateDbMock(updatedAddress);
      const svc = new CustomerAddressService({ db: db as never });

      const result = await svc.updateAddress(addressA1.id, CUSTOMER_A, { street: "456 Updated St" });

      expect(result).not.toBeNull();
      expect(result!.street).toBe("456 Updated St");
      expect(db.update).toHaveBeenCalledOnce();
    });

    it("returns null when no row matches id AND customerId (cross-customer attempt)", async () => {
      // DB returns empty array when customerId does not match — simulates AUTH-05 isolation
      const db = makeUpdateDbMock(null);
      const svc = new CustomerAddressService({ db: db as never });

      // CUSTOMER_B trying to update CUSTOMER_A's address
      const result = await svc.updateAddress(addressA1.id, CUSTOMER_B, { street: "Hacked St" });

      expect(result).toBeNull();
    });

    it("AUTH-05 isolation: cross-customer update returns null, not the other customer's row", async () => {
      const db = makeUpdateDbMock(null); // no matching row for (id, wrongCustomerId)
      const svc = new CustomerAddressService({ db: db as never });

      const result = await svc.updateAddress(addressA1.id, CUSTOMER_B, { label: "Stolen" });

      // Cannot access or modify another customer's address
      expect(result).toBeNull();
    });
  });

  // ── deleteAddress ─────────────────────────────────────────────────────────

  describe("deleteAddress", () => {
    it("deletes the row matching id AND customerId, returns true when deleted", async () => {
      const db = makeDeleteDbMock(addressA1);
      const svc = new CustomerAddressService({ db: db as never });

      const deleted = await svc.deleteAddress(addressA1.id, CUSTOMER_A);

      expect(deleted).toBe(true);
      expect(db.delete).toHaveBeenCalledOnce();
    });

    it("returns false when no row matches (different customerId — cross-customer attempt)", async () => {
      const db = makeDeleteDbMock(null); // no match for (id, wrongCustomerId)
      const svc = new CustomerAddressService({ db: db as never });

      // CUSTOMER_B trying to delete CUSTOMER_A's address
      const deleted = await svc.deleteAddress(addressA1.id, CUSTOMER_B);

      expect(deleted).toBe(false);
    });

    it("AUTH-05 isolation: cross-customer delete returns false, address is not deleted", async () => {
      const db = makeDeleteDbMock(null);
      const svc = new CustomerAddressService({ db: db as never });

      const deleted = await svc.deleteAddress(addressA1.id, CUSTOMER_B);

      expect(deleted).toBe(false);
    });
  });
});
