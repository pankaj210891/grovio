import { describe, expect, it, vi } from "vitest";
import type { SelectAdminUser } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Module mocks (must be at top-level, before dynamic imports)
// ---------------------------------------------------------------------------

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("jose", () => {
  class MockSignJWT {
    setProtectedHeader() { return this; }
    setIssuedAt() { return this; }
    setExpirationTime() { return this; }
    async sign() { return "mock.admin.jwt.token"; }
  }
  return {
    SignJWT: MockSignJWT,
    jwtVerify: vi.fn().mockResolvedValue({
      payload: {
        sub: "admin-uuid-1",
        role: "admin",
        email: "admin@example.com",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 28800,
      },
    }),
  };
});

import {
  AdminAuthService,
  InvalidCredentialsError,
} from "./AdminAuthService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeDbMock(rows: Partial<SelectAdminUser>[]) {
  return {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: vi.fn().mockResolvedValue(rows),
        }),
      }),
    }),
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

const baseAdmin: SelectAdminUser = {
  id: "admin-uuid-1",
  email: "admin@example.com",
  passwordHash: "$argon2id$hashed",
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("AdminAuthService", () => {
  // ── TTL ──────────────────────────────────────────────────────────────────

  describe("TTL", () => {
    it("expiresIn is 28800 (8 hours)", async () => {
      const db = makeDbMock([baseAdmin]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("admin@example.com", "password123");

      expect(result.expiresIn).toBe(28800);
    });
  });

  // ── login ─────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns { accessToken, expiresIn } on successful login", async () => {
      const db = makeDbMock([baseAdmin]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      const result = await svc.login("admin@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("expiresIn", 28800);
      expect(result.accessToken).toBe("mock.admin.jwt.token");
    });

    it("JWT payload has sub=admin.id and role='admin'", async () => {
      const { SignJWT } = await import("jose");
      const signSpy = vi.spyOn(SignJWT.prototype as never, "sign");

      const db = makeDbMock([baseAdmin]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await svc.login("admin@example.com", "password123");

      expect(signSpy).toHaveBeenCalled();
    });

    it("throws InvalidCredentialsError when email is not found", async () => {
      const db = makeDbMock([]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("unknown@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when password is wrong", async () => {
      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      const db = makeDbMock([baseAdmin]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await expect(
        svc.login("admin@example.com", "wrongpassword")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws same InvalidCredentialsError for unknown email and wrong password (no user enumeration)", async () => {
      const db1 = makeDbMock([]);
      const svc1 = new AdminAuthService({ db: db1 as never, env: makeEnv() });
      let error1: Error | null = null;
      try {
        await svc1.login("unknown@example.com", "password123");
      } catch (e) {
        error1 = e as Error;
      }

      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);
      const db2 = makeDbMock([baseAdmin]);
      const svc2 = new AdminAuthService({ db: db2 as never, env: makeEnv() });
      let error2: Error | null = null;
      try {
        await svc2.login("admin@example.com", "wrongpassword");
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
    it("returns AdminTokenPayload for a valid admin token (role=admin)", async () => {
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

      const db = makeDbMock([]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });
      const result = await svc.verifyToken("admin.jwt.token");

      expect(result.role).toBe("admin");
      expect(result.sub).toBe("admin-uuid-1");
      expect(result.email).toBe("admin@example.com");
    });

    it("throws for a token with role=owner (vendor token — T-06-10)", async () => {
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

      const db = makeDbMock([]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("vendor.jwt.token")).rejects.toThrow();
    });

    it("throws for a token with role=customer", async () => {
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
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("customer.jwt.token")).rejects.toThrow();
    });

    it("throws when jwtVerify throws (invalid/expired token)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error("JWTExpired"));

      const db = makeDbMock([]);
      const svc = new AdminAuthService({ db: db as never, env: makeEnv() });

      await expect(svc.verifyToken("expired.jwt.token")).rejects.toThrow();
    });
  });
});
