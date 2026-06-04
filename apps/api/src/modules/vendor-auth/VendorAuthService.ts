import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { and, eq, isNull } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import {
  vendors,
  vendorUsers,
  type SelectVendor,
} from "../../db/schema/index.js";
import type { VendorRole } from "@grovio/contracts";

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
 * Security note (T-03-P1, T-06-11): same error class and message for both cases — avoids
 * user enumeration (an attacker cannot tell whether the email exists).
 * Also thrown when the vendor account is suspended (D-17, T-06-11).
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

/**
 * Decoded JWT payload (Phase 6 vendor-role JWT).
 *
 * Phase 6 migration (D-03, D-06):
 * - sub: vendor_users.id (the authenticating user's ID — NOT vendors.id)
 * - vendorId: vendors.id (FK to the vendor store — used by all ownership checks)
 * - role: one of "owner" | "manager" | "staff" (VendorRole from contracts)
 * - email: vendor_user's login email
 *
 * Migration note: all existing middleware that reads request.vendorId from the JWT
 * `vendorId` claim continues to work correctly — vendorId remains the FK to vendors.id.
 * The sub field has changed from vendors.id to vendor_users.id (D-06).
 */
export interface VendorTokenPayload {
  sub: string;          // vendor_users.id
  role: VendorRole;     // "owner" | "manager" | "staff"
  vendorId: string;     // vendors.id FK — preserved for all ownership checks
  email: string;
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
 * - login: Phase 6 — authenticates against vendor_users (not vendors) and issues a
 *   HS256 JWT with payload { sub: vendorUser.id, role, vendorId, email }.
 *   Blocks suspended vendors (D-17, T-06-11).
 * - verifyToken: jose JWT verification + vendor-role guard (accepts owner|manager|staff)
 *
 * Stateless: no Redis dependency — JWTs are self-contained.
 * Password hashing uses argon2 (Argon2id default) per OWASP recommendation.
 * JWT uses jose (Web Crypto API) with HS256 algorithm.
 *
 * Covers D-03, D-06, D-17, T-03-P1, T-06-09, T-06-10, T-06-11.
 */
export class VendorAuthService {
  private readonly TTL_SECONDS = 3600; // 1h vendor token TTL

  constructor(private deps: VendorAuthServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a new vendor account.
   *
   * Hashes the password with argon2 (Argon2id default), inserts a vendors row,
   * and returns the created vendor WITHOUT the password hash.
   *
   * Note: register() still creates a vendors row (Phase 3 pattern unchanged).
   * The vendor_users entry is created by the data migration script (db:migrate:vendor-users)
   * or by the staff invite flow (VendorStaffService.inviteOwner).
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
   * Authenticate a vendor user and issue a JWT access token.
   *
   * Phase 6 migration (D-03): authenticates against vendor_users (not vendors).
   * Archived vendor_users (archivedAt IS NOT NULL) are excluded from lookup.
   *
   * Suspended vendor check (D-17, T-06-11): after credential validation, checks
   * vendors.onboardingStatus — if 'suspended', throws InvalidCredentialsError even
   * with correct credentials.
   *
   * JWT payload (D-06): { sub: vendorUser.id, role, vendorId: vendorUser.vendorId, email }
   * All existing middleware using request.vendorId (FK to vendors.id) remains correct
   * because vendorId claim is still vendors.id.
   *
   * Security (T-03-P1): throws InvalidCredentialsError for both unknown email
   * AND wrong password AND suspended vendor — identical error prevents user enumeration.
   *
   * @throws InvalidCredentialsError on unknown email, wrong password, or suspended vendor.
   */
  async login(email: string, password: string): Promise<VendorLoginResult> {
    const { db, env } = this.deps;

    // Look up vendor_user by email (only active, non-archived users)
    // Phase 6 migration: query vendorUsers, not vendors (D-03)
    const vendorUserRows = await db
      .select()
      .from(vendorUsers)
      .where(and(eq(vendorUsers.email, email), isNull(vendorUsers.archivedAt)))
      .limit(1);

    const vendorUser = vendorUserRows[0];
    if (!vendorUser) {
      // Unknown email or archived user — throw same error as wrong password (no enumeration)
      throw new InvalidCredentialsError();
    }

    // Verify the argon2 hash (Argon2id)
    const isValid = await argon2.verify(vendorUser.passwordHash, password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // Suspended vendor check (D-17, T-06-11):
    // Even with correct credentials, a suspended vendor cannot log in.
    const vendorStatusRows = await db
      .select({ status: vendors.onboardingStatus })
      .from(vendors)
      .where(eq(vendors.id, vendorUser.vendorId))
      .limit(1);

    if (vendorStatusRows[0]?.status === "suspended") {
      // Throw same error as invalid credentials — no enumeration (T-06-11)
      throw new InvalidCredentialsError();
    }

    // Issue HS256 JWT with vendor role, vendorId FK, and email (D-06)
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new SignJWT({
      sub: vendorUser.id,              // vendor_users.id (NOT vendors.id — D-06)
      role: vendorUser.role,           // "owner" | "manager" | "staff"
      vendorId: vendorUser.vendorId,   // vendors.id FK — used by all ownership checks
      email: vendorUser.email,
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
   * Phase 6: accepts tokens with role ∈ { "owner", "manager", "staff" }.
   * Rejects tokens with role = "admin" (T-06-10) or "customer".
   *
   * @throws Error on invalid token, expired token, or non-vendor-role token.
   */
  async verifyToken(token: string): Promise<VendorTokenPayload> {
    const { env } = this.deps;
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jwtVerify(token, secret);

    const role = payload["role"];
    // Accept only the three vendor roles; reject admin and customer (T-06-09, T-06-10)
    if (role !== "owner" && role !== "manager" && role !== "staff") {
      throw new Error("Token does not carry a valid vendor role.");
    }

    return {
      sub: payload["sub"] as string,
      role: role as VendorRole,
      vendorId: payload["vendorId"] as string,
      email: payload["email"] as string,
      iat: payload["iat"] as number,
      exp: payload["exp"] as number,
    };
  }
}
