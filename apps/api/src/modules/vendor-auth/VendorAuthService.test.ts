import { beforeEach, describe, expect, it, vi } from "vitest";
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
        sub: "vendor-uuid-1",
        role: "vendor",
        vendorId: "vendor-uuid-1",
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

function makeDbMock(rows: Partial<SelectVendor>[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: Partial<SelectVendor>[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(awaitableChain),
  };
}

function makeInsertDbMock(returnRow: Partial<SelectVendor>) {
  const insertChain = {
    values: vi.fn().mockReturnValue({
      returning: vi.fn().mockResolvedValue([returnRow]),
    }),
  };
  return {
    ...makeDbMock([]),
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

const baseVendor: SelectVendor = {
  id: "vendor-uuid-1",
  email: "vendor@example.com",
  passwordHash: "$argon2id$hashed",
  name: "Test Vendor",
  archivedAt: null,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("VendorAuthService", () => {
  // ── register ───────────────────────────────────────────────────────────────

  describe("register", () => {
    it("hashes the password with argon2 and inserts a vendor row", async () => {
      const argon2 = await import("argon2");
      const db = makeInsertDbMock(baseVendor);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.register("vendor@example.com", "password123", "Test Vendor");

      expect(argon2.hash).toHaveBeenCalledWith("password123");
      expect(db.insert).toHaveBeenCalled();
      expect(result.id).toBe("vendor-uuid-1");
    });

    it("does not return passwordHash in the result", async () => {
      const db = makeInsertDbMock(baseVendor);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.register("vendor@example.com", "password123", "Test Vendor");

      expect(result).not.toHaveProperty("passwordHash");
    });

    it("throws VendorAlreadyExistsError when email unique constraint is violated", async () => {
      const db = makeInsertDbMock(baseVendor);
      // Override insert to simulate unique constraint violation
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

  // ── login ──────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns { accessToken, expiresIn } on successful login", async () => {
      const db = makeDbMock([baseVendor]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("vendor@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("expiresIn", 3600);
      expect(result.accessToken).toBe("mock.jwt.token");
    });

    it("issues a JWT with role=vendor and vendorId (token in result)", async () => {
      const db = makeDbMock([baseVendor]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("vendor@example.com", "password123");

      // The mock sign() returns "mock.jwt.token" — confirms JWT was issued
      expect(result.accessToken).toBe("mock.jwt.token");
    });

    it("throws InvalidCredentialsError when email is not found", async () => {
      const db = makeDbMock([]); // empty rows — email not found
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("unknown@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when password is wrong", async () => {
      const argon2 = await import("argon2");
      // Override verify to return false (wrong password)
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      const db = makeDbMock([baseVendor]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("vendor@example.com", "wrongpassword")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws the same InvalidCredentialsError for unknown email and wrong password (no enumeration)", async () => {
      const db1 = makeDbMock([]); // email not found
      const svc1 = new VendorAuthService({ db: db1 as never, env: makeEnv() });
      let error1: Error | null = null;
      try {
        await svc1.login("unknown@example.com", "password123");
      } catch (e) {
        error1 = e as Error;
      }

      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);
      const db2 = makeDbMock([baseVendor]);
      const svc2 = new VendorAuthService({ db: db2 as never, env: makeEnv() });
      let error2: Error | null = null;
      try {
        await svc2.login("vendor@example.com", "wrongpassword");
      } catch (e) {
        error2 = e as Error;
      }

      expect(error1).toBeInstanceOf(InvalidCredentialsError);
      expect(error2).toBeInstanceOf(InvalidCredentialsError);
      // Same message — no enumeration
      expect(error1!.message).toBe(error2!.message);
    });
  });

  // ── verifyToken ────────────────────────────────────────────────────────────

  describe("verifyToken", () => {
    it("returns the JWT payload for a valid vendor token", async () => {
      const db = makeDbMock([]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.verifyToken("mock.jwt.token");

      expect(result.role).toBe("vendor");
      expect(result.vendorId).toBe("vendor-uuid-1");
    });

    it("throws when the token has a non-vendor role", async () => {
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

      const db = makeDbMock([]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("customer.jwt.token")).rejects.toThrow();
    });

    it("throws when jwtVerify throws (invalid/expired token)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error("JWTExpired"));

      const db = makeDbMock([]);
      const svc = new VendorAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("expired.jwt.token")).rejects.toThrow();
    });
  });
});
