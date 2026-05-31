import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { vendors, type SelectVendor } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when register() is called with an email that already exists.
 * Error code "VENDOR_ALREADY_EXISTS" allows routes to return a structured 409
 * response without relying on error message string matching.
 */
export class VendorAlreadyExistsError extends Error {
  readonly code = "VENDOR_ALREADY_EXISTS";

  constructor(message = "A vendor account with this email already exists.") {
    super(message);
    this.name = "VendorAlreadyExistsError";
  }
}

/**
 * Thrown by login() when email is not found OR when password verification fails.
 *
 * Security note (T-03-P1): same error class and message for both cases — avoids
 * user enumeration (an attacker cannot tell whether the email exists).
 */
export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface VendorAuthServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Vendor data returned from register() — never includes passwordHash. */
export type RegisteredVendor = Omit<SelectVendor, "passwordHash">;

/** Token pair returned from login(). */
export interface VendorLoginResult {
  accessToken: string;
  expiresIn: number;
}

/** Decoded JWT payload (vendor-role only) */
export interface VendorTokenPayload {
  sub: string;
  role: "vendor";
  vendorId: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// VendorAuthService
// ---------------------------------------------------------------------------

/**
 * VendorAuthService
 *
 * Owns vendor identity operations:
 * - register: argon2id password hashing, vendor row insert, email uniqueness
 * - login: credential verification + jose HS256 JWT issuance (role='vendor', vendorId)
 * - verifyToken: jose JWT verification + vendor-role guard
 *
 * Stateless: no Redis dependency — JWTs are self-contained.
 * Password hashing uses argon2 (Argon2id default) per OWASP recommendation.
 * JWT uses jose (Web Crypto API) with HS256 algorithm per D-17.
 *
 * Covers D-17, T-03-P1.
 */
export class VendorAuthService {
  private readonly TTL_SECONDS = 3600; // 1h vendor token TTL (discretion area)

  constructor(private deps: VendorAuthServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a new vendor account.
   *
   * Hashes the password with argon2 (Argon2id default), inserts a vendors row,
   * and returns the created vendor WITHOUT the password hash.
   *
   * @throws VendorAlreadyExistsError when the email unique constraint is violated.
   */
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<RegisteredVendor> {
    const { db } = this.deps;

    const passwordHash = await argon2.hash(password);

    let row: SelectVendor;
    try {
      const [inserted] = await db
        .insert(vendors)
        .values({
          email,
          passwordHash,
          name,
        })
        .returning();
      row = inserted!;
    } catch (err: unknown) {
      // PostgreSQL unique violation code is 23505
      const pgCode =
        (err as { code?: string })?.code ??
        ((err as { cause?: { code?: string } })?.cause?.code);
      if (pgCode === "23505") {
        throw new VendorAlreadyExistsError();
      }
      throw err;
    }

    // Strip passwordHash before returning (T-03-P1, D-17)
    const { passwordHash: _stripped, ...vendorWithoutHash } = row;
    return vendorWithoutHash;
  }

  /**
   * Authenticate a vendor and issue a JWT access token.
   *
   * Loads vendor by email, verifies the argon2 hash, and returns a signed
   * HS256 JWT with payload { sub, role:'vendor', vendorId }.
   *
   * Security (T-03-P1): throws InvalidCredentialsError for both unknown email
   * AND wrong password — identical error prevents user enumeration.
   *
   * @throws InvalidCredentialsError on unknown email or wrong password.
   */
  async login(email: string, password: string): Promise<VendorLoginResult> {
    const { db, env } = this.deps;

    // Look up vendor by email
    const rows = await db
      .select()
      .from(vendors)
      .where(eq(vendors.email, email))
      .limit(1);

    const vendor = rows[0];
    if (!vendor) {
      // Unknown email — throw same error as wrong password (no enumeration)
      throw new InvalidCredentialsError();
    }

    // Verify the argon2 hash (Argon2id)
    const isValid = await argon2.verify(vendor.passwordHash, password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // Issue HS256 JWT with vendor role and vendorId
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new SignJWT({
      sub: vendor.id,
      role: "vendor" as const,
      vendorId: vendor.id,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${this.TTL_SECONDS}s`)
      .sign(secret);

    return { accessToken, expiresIn: this.TTL_SECONDS };
  }

  /**
   * Verify a vendor JWT and return the decoded payload.
   *
   * Throws for invalid/expired tokens, and for tokens that carry a non-vendor role.
   *
   * @throws Error on invalid token, expired token, or non-vendor role.
   */
  async verifyToken(token: string): Promise<VendorTokenPayload> {
    const { env } = this.deps;
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jwtVerify(token, secret);

    if (payload["role"] !== "vendor") {
      throw new Error("Token does not carry vendor role.");
    }

    return {
      sub: payload["sub"] as string,
      role: "vendor",
      vendorId: payload["vendorId"] as string,
      iat: payload["iat"] as number,
      exp: payload["exp"] as number,
    };
  }
}
