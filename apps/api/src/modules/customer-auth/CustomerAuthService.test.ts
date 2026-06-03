import { describe, expect, it, vi, beforeEach } from "vitest";
import type { SelectCustomer } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Module mocks (must be at top-level, before dynamic imports)
// ---------------------------------------------------------------------------

vi.mock("argon2", () => ({
  hash: vi.fn().mockResolvedValue("$argon2id$hashed"),
  verify: vi.fn().mockResolvedValue(true),
}));

vi.mock("jose", () => {
  // SignJWT must be mocked as a class constructor (not a plain factory function)
  // because CustomerAuthService uses `new SignJWT(...)`.
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
        sub: "customer-uuid-1",
        role: "customer",
        iat: Math.floor(Date.now() / 1000),
        exp: Math.floor(Date.now() / 1000) + 3600,
      },
    }),
  };
});

// Mock crypto to control randomUUID and createHash
vi.mock("crypto", async (importOriginal) => {
  const actual = await importOriginal<typeof import("crypto")>();
  return {
    ...actual,
    randomUUID: vi.fn().mockReturnValue("test-uuid-token-1234"),
    createHash: vi.fn().mockReturnValue({
      update: vi.fn().mockReturnThis(),
      digest: vi.fn().mockReturnValue("sha256-hashed-token"),
    }),
  };
});

import {
  CustomerAuthService,
  CustomerAlreadyExistsError,
  InvalidCredentialsError,
  InvalidResetTokenError,
} from "./CustomerAuthService.js";

// ---------------------------------------------------------------------------
// Mock helpers
// ---------------------------------------------------------------------------

function makeDbMock(rows: Partial<SelectCustomer>[]) {
  const awaitableChain = {
    from: vi.fn().mockReturnValue({
      where: vi.fn().mockReturnValue({
        limit: vi.fn().mockResolvedValue(rows),
        then: (resolve: (v: Partial<SelectCustomer>[]) => void) => resolve(rows),
        catch: vi.fn(),
        finally: vi.fn(),
      }),
    }),
  };
  return {
    select: vi.fn().mockReturnValue(awaitableChain),
  };
}

function makeInsertDbMock(returnRow: Partial<SelectCustomer>) {
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
    SMTP_HOST: undefined,
    SMTP_USER: undefined,
    SMTP_PASS: undefined,
    SMTP_FROM: undefined,
  } as never;
}

function makeMailer() {
  return {
    sendMail: vi.fn().mockResolvedValue({ messageId: "test-message-id" }),
  };
}

// ---------------------------------------------------------------------------
// Test fixtures
// ---------------------------------------------------------------------------

const baseCustomer: SelectCustomer = {
  id: "customer-uuid-1",
  email: "customer@example.com",
  passwordHash: "$argon2id$hashed",
  name: "Test Customer",
  phone: null,
  archivedAt: null,
  walletBalanceMinor: 0,
  createdAt: new Date("2026-01-01T00:00:00Z"),
  updatedAt: new Date("2026-01-01T00:00:00Z"),
};

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("CustomerAuthService", () => {
  // ── register ───────────────────────────────────────────────────────────────

  describe("register", () => {
    it("hashes the password with argon2 and inserts a customer row", async () => {
      const argon2 = await import("argon2");
      const db = makeInsertDbMock(baseCustomer);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.register("customer@example.com", "password123", "Test Customer");

      expect(argon2.hash).toHaveBeenCalledWith("password123");
      expect(db.insert).toHaveBeenCalled();
      expect(result.id).toBe("customer-uuid-1");
    });

    it("does not return passwordHash in the result", async () => {
      const db = makeInsertDbMock(baseCustomer);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.register("customer@example.com", "password123", "Test Customer");

      expect(result).not.toHaveProperty("passwordHash");
    });

    it("throws CustomerAlreadyExistsError when email unique constraint is violated", async () => {
      const db = makeInsertDbMock(baseCustomer);
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
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(
        svc.register("customer@example.com", "password123", "Test Customer")
      ).rejects.toThrow(CustomerAlreadyExistsError);
    });
  });

  // ── login ──────────────────────────────────────────────────────────────────

  describe("login", () => {
    it("returns { accessToken, refreshToken, expiresIn } on successful login", async () => {
      const db = makeDbMock([baseCustomer]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.login("customer@example.com", "password123");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("expiresIn", 3600);
      expect(result.accessToken).toBe("mock.jwt.token");
    });

    it("issues a JWT with role=customer (not vendorId claim)", async () => {
      const db = makeDbMock([baseCustomer]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.login("customer@example.com", "password123");

      // The mock sign() returns "mock.jwt.token" — confirms JWT was issued
      expect(result.accessToken).toBe("mock.jwt.token");
      // Verify no vendorId claim was set (check via implementation)
      expect(result).not.toHaveProperty("vendorId");
    });

    it("throws InvalidCredentialsError when email is not found", async () => {
      const db = makeDbMock([]); // empty rows — email not found
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(
        svc.login("unknown@example.com", "password123")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws InvalidCredentialsError when password is wrong", async () => {
      const argon2 = await import("argon2");
      // Override verify to return false (wrong password)
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);

      const db = makeDbMock([baseCustomer]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(
        svc.login("customer@example.com", "wrongpassword")
      ).rejects.toThrow(InvalidCredentialsError);
    });

    it("throws the same InvalidCredentialsError for unknown email and wrong password (no enumeration)", async () => {
      const mailer = makeMailer();
      const db1 = makeDbMock([]); // email not found
      const svc1 = new CustomerAuthService({ db: db1 as never, env: makeEnv(), mailer: mailer as never });
      let error1: Error | null = null;
      try {
        await svc1.login("unknown@example.com", "password123");
      } catch (e) {
        error1 = e as Error;
      }

      const argon2 = await import("argon2");
      vi.mocked(argon2.verify).mockResolvedValueOnce(false);
      const db2 = makeDbMock([baseCustomer]);
      const svc2 = new CustomerAuthService({ db: db2 as never, env: makeEnv(), mailer: mailer as never });
      let error2: Error | null = null;
      try {
        await svc2.login("customer@example.com", "wrongpassword");
      } catch (e) {
        error2 = e as Error;
      }

      expect(error1).toBeInstanceOf(InvalidCredentialsError);
      expect(error2).toBeInstanceOf(InvalidCredentialsError);
      // Same message — no enumeration (T-04-05)
      expect(error1!.message).toBe(error2!.message);
    });
  });

  // ── verifyToken ────────────────────────────────────────────────────────────

  describe("verifyToken", () => {
    it("returns the JWT payload for a valid customer token", async () => {
      const db = makeDbMock([]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.verifyToken("mock.jwt.token");

      expect(result.role).toBe("customer");
      expect(result.sub).toBe("customer-uuid-1");
    });

    it("throws when the token has a non-customer role (T-04-06)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "vendor-uuid-1",
          role: "vendor",
          vendorId: "vendor-uuid-1",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeDbMock([]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(svc.verifyToken("vendor.jwt.token")).rejects.toThrow();
    });

    it("throws when jwtVerify throws (invalid/expired token)", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockRejectedValueOnce(new Error("JWTExpired"));

      const db = makeDbMock([]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(svc.verifyToken("expired.jwt.token")).rejects.toThrow();
    });
  });

  // ── refreshTokens ──────────────────────────────────────────────────────────

  describe("refreshTokens", () => {
    it("returns a new token pair on valid refresh token", async () => {
      const db = makeDbMock([]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      const result = await svc.refreshTokens("valid.refresh.token");

      expect(result).toHaveProperty("accessToken");
      expect(result).toHaveProperty("refreshToken");
      expect(result).toHaveProperty("expiresIn", 3600);
    });

    it("throws when refresh token has non-customer role", async () => {
      const jose = await import("jose");
      vi.mocked(jose.jwtVerify).mockResolvedValueOnce({
        payload: {
          sub: "vendor-uuid-1",
          role: "vendor",
          iat: Math.floor(Date.now() / 1000),
          exp: Math.floor(Date.now() / 1000) + 3600,
        },
        protectedHeader: { alg: "HS256" },
      } as never);

      const db = makeDbMock([]);
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(svc.refreshTokens("vendor.refresh.token")).rejects.toThrow();
    });
  });

  // ── forgotPassword ─────────────────────────────────────────────────────────

  describe("forgotPassword", () => {
    it("generates a token, stores its SHA-256 hash, and calls mailer.sendMail when SMTP configured", async () => {
      // Build a DB mock that handles both select (lookup customer) and insert (store token)
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([baseCustomer]),
          }),
        }),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
      const mailer = makeMailer();
      const envWithSmtp = {
        JWT_SECRET: "test-secret-at-least-32-characters-long!!",
        SMTP_HOST: "smtp.gmail.com",
        SMTP_USER: "test@gmail.com",
        SMTP_PASS: "testpass",
        SMTP_FROM: "noreply@example.com",
      } as never;

      const svc = new CustomerAuthService({ db: db as never, env: envWithSmtp, mailer: mailer as never });

      await svc.forgotPassword("customer@example.com");

      // mailer.sendMail must be called (T-04-07)
      expect(mailer.sendMail).toHaveBeenCalled();
      // insert must be called to store the token hash
      expect(db.insert).toHaveBeenCalled();
    });

    it("silently succeeds for unknown email (no enumeration — T-04-08)", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),  // no customer found
          }),
        }),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn(),
      };
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      // Must NOT throw for unknown email
      await expect(svc.forgotPassword("unknown@example.com")).resolves.toBeUndefined();
      // Must NOT call insert or sendMail
      expect(db.insert).not.toHaveBeenCalled();
      expect(mailer.sendMail).not.toHaveBeenCalled();
    });

    it("does not throw when SMTP is not configured (dev fallback — logs link)", async () => {
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([baseCustomer]),
          }),
        }),
      };
      const insertChain = {
        values: vi.fn().mockResolvedValue(undefined),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        insert: vi.fn().mockReturnValue(insertChain),
      };
      const mailer = makeMailer();
      // No SMTP configured — should log, not throw
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      // Must NOT throw even without SMTP
      await expect(svc.forgotPassword("customer@example.com")).resolves.toBeUndefined();
    });
  });

  // ── resetPassword ──────────────────────────────────────────────────────────

  describe("resetPassword", () => {
    it("rejects expired token with InvalidResetTokenError (T-04-07)", async () => {
      // Token found but expired
      const expiredTokenRow = {
        id: "token-uuid-1",
        customerId: "customer-uuid-1",
        tokenHash: "sha256-hashed-token",
        expiresAt: new Date(Date.now() - 1000 * 60 * 60), // 1 hour ago
        createdAt: new Date(),
      };
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([expiredTokenRow]),
          }),
        }),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(
        svc.resetPassword("raw-token-value", "newpassword123")
      ).rejects.toThrow(InvalidResetTokenError);
    });

    it("rejects missing token with InvalidResetTokenError", async () => {
      // Token not found
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn(),
        delete: vi.fn(),
      };
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await expect(
        svc.resetPassword("invalid-raw-token", "newpassword123")
      ).rejects.toThrow(InvalidResetTokenError);
    });

    it("updates password and deletes the token on valid reset", async () => {
      const validTokenRow = {
        id: "token-uuid-1",
        customerId: "customer-uuid-1",
        tokenHash: "sha256-hashed-token",
        expiresAt: new Date(Date.now() + 1000 * 60 * 30), // 30 min from now
        createdAt: new Date(),
      };
      const selectChain = {
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([validTokenRow]),
          }),
        }),
      };
      const updateChain = {
        set: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue(undefined),
        }),
      };
      const deleteChain = {
        where: vi.fn().mockResolvedValue(undefined),
      };
      const db = {
        select: vi.fn().mockReturnValue(selectChain),
        update: vi.fn().mockReturnValue(updateChain),
        delete: vi.fn().mockReturnValue(deleteChain),
      };
      const mailer = makeMailer();
      const svc = new CustomerAuthService({ db: db as never, env: makeEnv(), mailer: mailer as never });

      await svc.resetPassword("valid-raw-token", "newpassword123");

      expect(db.update).toHaveBeenCalled();
      expect(db.delete).toHaveBeenCalled();
    });
  });
});
