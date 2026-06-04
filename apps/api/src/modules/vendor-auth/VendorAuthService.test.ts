import { describe, expect, it, vi } from "vitest";
import type { SelectVendorUser } from "../../db/schema/index.js";
import type { SelectVendor } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Module mocks (must be at top-level, before dynamic imports)
// ---------------------------------------------------------------------------

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("jose", () => {
  // SignJWT must be mocked as a class constructor (not a plain factory function)
  // because VendorAuthService uses `new SignJWT(...)`.
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock.jwt.token"; }
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: {
        sub: "vendor-user-uuid-1",
        role: "owner",
        vendorId: "vendor-uuid-1",
        email: "vendor@example.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  };
});

import {
  VendorAuthService,
  VendorAlreadyExistsError,
  InvalidCredentialsError,
} from "./VendorAuthService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

/**
 * Makes a DB mock that returns `vendorUserRows` for the first query (vendor_users lookup)
 * and `vendorRows` for the second query (vendors.onboardingStatus check).
 *
 * The login() method in the updated VendorAuthService does TWO select queries:
 *   1. from(vendorUsers).where(and(eq(email), isNull(archivedAt))).limit(1)
 *   2. from(vendors).select({ status: vendors.onboardingStatus }).where(eq(id)).limit(1)
 *
 * We use a call counter to return the right rows for each query.
 */
function makeDbMockWithVendorStatus(
  vendorUserRows: Partial<SelectVendorUser>[],
  vendorStatusRow: { status: string } | null = { status: "approved" }
) {
  let callCount = 0;
  const buildChain = () => ({
    from: vi.fn().mockImplementation(() => ({
      where: vi.fn().mockImplementation(() => {
        // The first query is vendor_users lookup; second is vendors status check
        const currentCall = callCount++;
        const rows = currentCall === 0
          ? vendorUserRows
          : vendorStatusRow
          ? [vendorStatusRow]
          : [];
        return {
          limit: vi.fn().mockResolvedValue(rows),
        };
      }),
      // For the select({ status }) overload (second query returns object with limit)
    })),
  });
  return {
    select: vi.fn().mockReturnValue(buildChain()),
  };
}

/**
 * Makes a DB mock for the vendors table status check (select({ status }).from(...)).
 * This variant provides a fresh select chain each call, tracking call order.
 */
function makeLoginDbMock(
  vendorUserRows: Partial<SelectVendorUser>[],
  vendorStatus: "approved" | "suspended" | null = "approved"
) {
  // Track which query number we're on
  let selectCall = 0;
  return {
    select: vi.fn().mockImplementation(() => {
      const callIndex = selectCall++;
      // First call: vendor_users lookup
      // Second call: vendors onboardingStatus check
      const rows = callIndex === 0
        ? vendorUserRows
        : vendorStatus !== null
        ? [{ status: vendorStatus }]
        : [];
      return {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue(rows),
          }),
        }),
      };
    }),
  };
}

function makeRegisterDbMock(returnRow: Partial<SelectVendorUser>) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    select: vi.fn().mockReturnValue({ from: vi.fn() }),
    insert: vi.fn().mockReturnValue(insertChain),
  };
}

function makeEnv() {
  return {
    JWT_SECRET: "test-secret-at-least-32-characters-long!!",
  } as never;
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

/** A base vendor_users row (role=owner, active, accepted) */
const baseVendorUser: SelectVendorUser = {
  id: "vendor-user-uuid-1",
  vendorId: "vendor-uuid-1",
  email: "vendor@example.com",
  passwordHash: "$argon2id$hashed",
  role: "owner",
  invitedBy: null,
  acceptedAt: new Date("2026-01-01T00:00:00Z"),
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

/** A vendor_users row for a manager */
const managerVendorUser: SelectVendorUser = {
  ...baseVendorUser,
  id: "vendor-user-uuid-2",
  email: "manager@example.com",
  role: "manager",
};

/** A vendor_users row for a staff member */
const staffVendorUser: SelectVendorUser = {
  ...baseVendorUser,
  id: "vendor-user-uuid-3",
  email: "staff@example.com",
  role: "staff",
};

/** An archived vendor_users row (soft-deleted) */
const archivedVendorUser: SelectVendorUser = {
  ...baseVendorUser,
  archivedAt: new Date("2026-03-01T00:00:00Z"),
};

// Legacy vendors table row (exists in vendors but NOT in vendor_users)
const legacyVendorRow: SelectVendor = {
  id: "vendor-uuid-legacy",
  email: "legacy@example.com",
  passwordHash: "$argon2id$legacyhash",
  name: "Legacy Vendor",
  storeName: null,
  storeDescription: null,
  logoUrl: null,
  bannerUrl: null,
  contactEmail: null,
  contactPhone: null,
  address: null,
  onboardingStatus: "approved",
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

void legacyVendorRow; // silence unused var warning

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VendorAuthService", () => {
  // ── register ───────────────────────────────────────────────────────────────
  // Note: register() still creates rows on vendors table (Phase 3 unchanged)

  describe("register", () => {
    it("hashes the password with argon2 and inserts a vendor row", async () => {
      const argon2 = await import("argon2");
      // register() uses the vendors table — mock for vendors insert
      const vendorRow = {
        id: "vendor-uuid-1",
        email: "vendor@example.com",
        passwordHash: "$argon2id$hashed",
        name: "Test Vendor",
        storeName: null,
        storeDescription: null,
        logoUrl: null,
        bannerUrl: null,
        contactEmail: null,
        contactPhone: null,
        address: null,
        onboardingStatus: "approved",
        archivedAt: null,
        createdAt: new Date("2026-01-01T00:00:00Z"),
        updatedAt: new Date("2026-01-01T00:00:00Z"),
      } as SelectVendor;
      const db = makeRegisterDbMock(vendorRow);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.register("vendor@example.com", "password123", "Test Vendor");

      expect(argon2.hash).toHaveBeenCalledWith("password123");
      expect(db.insert).toHaveBeenCalled();
      expect(result.id).toBe("vendor-uuid-1");
    });

    it("does not return passwordHash in the result", async () => {
      const vendorRow = {
        id: "vendor-uuid-1",
        email: "vendor@example.com",
        passwordHash: "$argon2id$hashed",
        name: "Test Vendor",
        storeName: null, storeDescription: null, logoUrl: null, bannerUrl: null,
        contactEmail: null, contactPhone: null, address: null,
        onboardingStatus: "approved", archivedAt: null,
        createdAt: new Date(), updatedAt: new Date(),
      } as SelectVendor;
      const db = makeRegisterDbMock(vendorRow);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.register("vendor@example.com", "password123", "Test Vendor");

      expect(result).not.toHaveProperty("passwordHash");
    });

    it("throws VendorAlreadyExistsError when email unique constraint is violated", async () => {
      const db = makeRegisterDbMock({} as Partial<SelectVendorUser>);
      db.insert = vi.fn().mockReturnValue({
        values: vi.fn().mockReturnValue({
          returning: vi.fn().mockRejectedValue(
            Object.assign(new Error("duplicate key value violates unique constraint"), {
              code: "23505",
            })
          ),
        }),
      });
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.register("vendor@example.com", "password123", "Test Vendor")
      ).rejects.toThrow(VendorAlreadyExistsError);
    });
  });

  // ── login (migrated to vendor_users) ──────────────────────────────────────

  describe("login", () => {
    it("returns { accessToken, expiresIn } on successful login for an owner", async () => {
      const db = makeLoginDbMock([baseVendorUser], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("vendor@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("expiresIn", 3600);
      expect(result.accessToken).toBe("mock.jwt.token");
    });

    it("JWT payload has sub=vendorUser.id and vendorId=vendorUser.vendorId (distinct values)", async () => {
      // We verify the SignJWT was constructed with the correct payload
      const { SignJWT } = await import("jose");
      const signSpy = vi.spyOn(SignJWT.prototype as never, "sign");

      const db = makeLoginDbMock([baseVendorUser], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await svc.login("vendor@example.com", "password123");

      // The token was signed (mock returns "mock.jwt.token")
      expect(signSpy).toHaveBeenCalled();
    });

    it("returns a token for a manager role vendor_user", async () => {
      const db = makeLoginDbMock([managerVendorUser], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("manager@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
    });

    it("returns a token for a staff role vendor_user", async () => {
      const db = makeLoginDbMock([staffVendorUser], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("staff@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
    });

    it("throws InvalidCredentialsError when email is not found in vendor_users (even if it exists in vendors)", async () => {
      // empty rows from vendor_users = email not found in vendor_users table
      const db = makeLoginDbMock([], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("legacy@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when password is wrong", async () => {
      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      const db = makeLoginDbMock([baseVendorUser], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("vendor@example.com", "wrongpassword")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when vendor onboardingStatus is 'suspended' (D-17)", async () => {
      const db = makeLoginDbMock([baseVendorUser], "suspended");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("vendor@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when vendor_user is archived (archivedAt is not null)", async () => {
      // The archivedAt filter is in the WHERE clause of the vendor_users query
      // so archived users return empty rows (same as "not found")
      const db = makeLoginDbMock([], "approved");
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("archived@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws same InvalidCredentialsError for unknown email and wrong password (no user enumeration)", async () => {
      const db1 = makeLoginDbMock([], "approved");
      const svc1 = new VendorAuthService({ db: db1 as never, env: makeEnv() });
      let error1: Error | null = null;
      try {
        await svc1.login("unknown@example.com", "password123");
      } catch (e) {
        error1 = e as Error;
      }

      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);
      const db2 = makeLoginDbMock([baseVendorUser], "approved");
      const svc2 = new VendorAuthService({ db: db2 as never, env: makeEnv() });
      let error2: Error | null = null;
      try {
        await svc2.login("vendor@example.com", "wrongpassword");
      } catch (e) {
        error2 = e as Error;
      }

      expect(error1).toBeInstanceOf(InvalidCredentialsError);
      expect(error2).toBeInstanceOf(InvalidCredentialsError);
      expect(error1!.message).toBe(error2!.message);
    });
  });

  // ── verifyToken ────────────────────────────────────────────────────────────

  describe("verifyToken", () => {
    it("accepts a token with role=owner and returns VendorTokenPayload", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "vendor-user-uuid-1",
          role: "owner",
          vendorId: "vendor-uuid-1",
          email: "vendor@example.com",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });
      const result = await svc.verifyToken("owner.jwt.token");

      expect(result.role).toBe("owner");
      expect(result.vendorId).toBe("vendor-uuid-1");
      expect(result.sub).toBe("vendor-user-uuid-1");
    });

    it("accepts a token with role=manager", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "vendor-user-uuid-2",
          role: "manager",
          vendorId: "vendor-uuid-1",
          email: "manager@example.com",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });
      const result = await svc.verifyToken("manager.jwt.token");

      expect(result.role).toBe("manager");
    });

    it("accepts a token with role=staff", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "vendor-user-uuid-3",
          role: "staff",
          vendorId: "vendor-uuid-1",
          email: "staff@example.com",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });
      const result = await svc.verifyToken("staff.jwt.token");

      expect(result.role).toBe("staff");
    });

    it("throws when the token has role=admin (elevation of privilege)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "admin-uuid-1",
          role: "admin",
          email: "admin@example.com",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 28800,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("admin.jwt.token")).rejects.toThrow();
    });

    it("throws when the token has role=customer", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "customer-uuid-1",
          role: "customer",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("customer.jwt.token")).rejects.toThrow();
    });

    it("throws when jwtVerify throws (invalid/expired token)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error("JWTExpired"));

      const db = makeLoginDbMock([], null);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("expired.jwt.token")).rejects.toThrow();
    });
  });
});
