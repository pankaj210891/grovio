import * as argon2 from "argon2";
import { SignJWT, jwtVerify } from "jose";
import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import { adminUsers } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

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

interface AdminAuthServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Token pair returned from login(). */
export interface AdminLoginResult {
  accessToken: string;
  expiresIn: number;
}

/**
 * Decoded JWT payload for admin tokens (D-21).
 *
 * - sub: admin_users.id
 * - role: "admin" (literal — all admin_users have the same role)
 * - email: admin's login email
 */
export interface AdminTokenPayload {
  sub: string;          // admin_users.id
  role: "admin";        // literal constant — never a union
  email: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// AdminAuthService
// ---------------------------------------------------------------------------

/**
 * AdminAuthService
 *
 * Owns admin identity operations:
 * - login: argon2id credential verification + jose HS256 JWT issuance
 *   with payload { sub: admin.id, role: "admin", email }.
 *   TTL_SECONDS = 28800 (8h) — longer session than vendor (1h) per D-21 / RESEARCH.md.
 * - verifyToken: jose JWT verification + admin-role guard (role must be "admin").
 *
 * Analog: VendorAuthService — same argon2 + jose pattern. Differences:
 * - Queries adminUsers table (not vendorUsers or vendors)
 * - JWT role is literal "admin" (no union — no suspended check)
 * - TTL is 28800s (8h) vs 3600s (1h) for vendor tokens
 * - No register() — admin accounts are seeded directly in the DB
 * - verifyToken rejects all non-admin roles (including vendor owner/manager/staff)
 *
 * Shares JWT_SECRET with VendorAuthService (no new env var — RESEARCH.md).
 *
 * Covers D-21, T-06-09, T-06-10 (admin-side).
 */
export class AdminAuthService {
  private readonly TTL_SECONDS = 28800; // 8h admin token TTL (D-21, RESEARCH.md)

  constructor(private deps: AdminAuthServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Authenticate an admin and issue a JWT access token.
   *
   * Loads admin by email, verifies the argon2 hash, and returns a signed
   * HS256 JWT with payload { sub, role: "admin", email }.
   *
   * Security (T-03-P1): throws InvalidCredentialsError for both unknown email
   * AND wrong password — identical error prevents user enumeration.
   *
   * @throws InvalidCredentialsError on unknown email or wrong password.
   */
  async login(email: string, password: string): Promise<AdminLoginResult> {
    const { db, env } = this.deps;

    // Look up admin by email
    const rows = await db
      .select()
      .from(adminUsers)
      .where(eq(adminUsers.email, email))
      .limit(1);

    const admin = rows[0];
    if (!admin) {
      // Unknown email — throw same error as wrong password (no enumeration)
      throw new InvalidCredentialsError();
    }

    // Verify the argon2 hash (Argon2id)
    const isValid = await argon2.verify(admin.passwordHash, password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    // Issue HS256 JWT with admin role and email (D-21)
    const secret = new TextEncoder().encode(env.JWT_SECRET);
    const accessToken = await new SignJWT({
      sub: admin.id,
      role: "admin" as const,
      email: admin.email,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${this.TTL_SECONDS}s`)
      .sign(secret);

    return { accessToken, expiresIn: this.TTL_SECONDS };
  }

  /**
   * Verify an admin JWT and return the decoded payload.
   *
   * Accepts only tokens with role = "admin".
   * Rejects vendor tokens (role ∈ owner|manager|staff) — T-06-10.
   * Rejects customer tokens.
   *
   * @throws Error on invalid token, expired token, or non-admin role.
   */
  async verifyToken(token: string): Promise<AdminTokenPayload> {
    const { env } = this.deps;
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jwtVerify(token, secret);

    // T-06-09, T-06-10: only accept admin role; all others rejected
    if (payload["role"] !== "admin") {
      throw new Error("Token does not carry admin role.");
    }

    return {
      sub: payload["sub"] as string,
      role: "admin",
      email: payload["email"] as string,
      iat: payload["iat"] as number,
      exp: payload["exp"] as number,
    };
  }
}
