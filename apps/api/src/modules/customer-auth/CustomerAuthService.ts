import * as argon2 from "argon2";
import { createHash, randomUUID } from "crypto";
import { SignJWT, jwtVerify } from "jose";
import { eq, and, gt } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type * as nodemailer from "nodemailer";
import type { Env } from "../../config/env.js";
import {
  customers,
  passwordResetTokens,
  type SelectCustomer,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when register() is called with an email that already exists.
 * Error code "CUSTOMER_ALREADY_EXISTS" allows routes to return a structured 409
 * response without relying on error message string matching.
 */
export class CustomerAlreadyExistsError extends Error {
  readonly code = "CUSTOMER_ALREADY_EXISTS";

  constructor(message = "A customer account with this email already exists.") {
    super(message);
    this.name = "CustomerAlreadyExistsError";
  }
}

/**
 * Thrown by login() when email is not found OR when password verification fails.
 *
 * Security note (T-04-05): same error class and message for both cases — avoids
 * user enumeration (an attacker cannot tell whether the email exists).
 */
export class InvalidCredentialsError extends Error {
  readonly code = "INVALID_CREDENTIALS";

  constructor(message = "Invalid email or password.") {
    super(message);
    this.name = "InvalidCredentialsError";
  }
}

/**
 * Thrown by resetPassword() when the provided token is missing, expired, or
 * already used (hard-deleted after first use).
 *
 * Security note (T-04-07): single-use token enforcement — token is hard-deleted
 * on success, so a second attempt with the same token is rejected here.
 */
export class InvalidResetTokenError extends Error {
  readonly code = "INVALID_RESET_TOKEN";

  constructor(message = "Password reset token is invalid or has expired.") {
    super(message);
    this.name = "InvalidResetTokenError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface CustomerAuthServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Env;
  /** Nodemailer transport for password reset email. Injected via Awilix. */
  mailer: nodemailer.Transporter;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** Customer data returned from register() — never includes passwordHash. */
export type RegisteredCustomer = Omit<SelectCustomer, "passwordHash">;

/** Token pair returned from login() and refreshTokens(). Route sets cookies (D-09). */
export interface CustomerLoginResult {
  accessToken: string;
  refreshToken: string;
  expiresIn: number;
}

/** Decoded JWT payload (customer-role only). */
export interface CustomerTokenPayload {
  sub: string;
  role: "customer";
  customerId: string;
  iat: number;
  exp: number;
}

// ---------------------------------------------------------------------------
// CustomerAuthService
// ---------------------------------------------------------------------------

/**
 * CustomerAuthService
 *
 * Owns customer identity operations:
 * - register: argon2id password hashing, customer row insert, email uniqueness
 * - login: credential verification + jose HS256 JWT issuance (role='customer') + cookie token pair
 * - verifyToken: jose JWT verification + customer-role guard
 * - refreshTokens: verify refresh token, issue new token pair
 * - forgotPassword: generate reset token, store SHA-256 hash, dispatch email (or log in dev)
 * - resetPassword: verify token, update password, hard-delete token (single-use)
 *
 * Stateless: no Redis dependency — JWTs are self-contained.
 * Password hashing uses argon2 (Argon2id default) per OWASP recommendation.
 * JWT uses jose (Web Crypto API) with HS256 algorithm.
 * Password reset tokens are stored as SHA-256 hashes; raw token is emailed only (T-04-07).
 *
 * Covers AUTH-01, AUTH-02, AUTH-03, AUTH-04, D-09, D-10, D-11, T-04-05, T-04-06,
 * T-04-07, T-04-08, T-04-09.
 */
export class CustomerAuthService {
  /** Access token TTL: 1 hour (D-09). Route sets maxAge on cookie. */
  private readonly ACCESS_TTL_SECONDS = 3600;

  /** Refresh token TTL: 7 days. Route scopes cookie to /auth/refresh only. */
  private readonly REFRESH_TTL_SECONDS = 604800;

  /** Password reset token TTL: 1 hour (D-10). Separate from access token TTL. */
  private readonly RESET_TOKEN_TTL_SECONDS = 3600;

  constructor(private deps: CustomerAuthServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Register a new customer account.
   *
   * Hashes the password with argon2 (Argon2id default), inserts a customers row,
   * and returns the created customer WITHOUT the password hash (T-04-09).
   *
   * @throws CustomerAlreadyExistsError when the email unique constraint is violated.
   */
  async register(
    email: string,
    password: string,
    name: string
  ): Promise<RegisteredCustomer> {
    const { db } = this.deps;

    const passwordHash = await argon2.hash(password);

    let row: SelectCustomer;
    try {
      const [inserted] = await db
        .insert(customers)
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
        throw new CustomerAlreadyExistsError();
      }
      throw err;
    }

    // Strip passwordHash before returning (T-04-09)
    const { passwordHash: _stripped, ...customerWithoutHash } = row;
    return customerWithoutHash;
  }

  /**
   * Authenticate a customer and issue a JWT access + refresh token pair.
   *
   * Loads customer by email, verifies the argon2 hash, and returns HS256 JWTs.
   * The route handler sets httpOnly cookies from this result (D-09) — this service
   * does NOT touch the reply object.
   *
   * Security (T-04-05): throws InvalidCredentialsError for both unknown email
   * AND wrong password — identical error prevents user enumeration.
   *
   * @throws InvalidCredentialsError on unknown email or wrong password.
   */
  async login(email: string, password: string): Promise<CustomerLoginResult> {
    const { db, env } = this.deps;

    // Look up customer by email
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    const customer = rows[0];
    if (!customer) {
      // Unknown email — throw same error as wrong password (no enumeration — T-04-05)
      throw new InvalidCredentialsError();
    }

    // Reject archived accounts — same error as bad credentials (no enumeration)
    if (customer.archivedAt !== null) {
      throw new InvalidCredentialsError();
    }

    // Verify the argon2 hash (Argon2id)
    const isValid = await argon2.verify(customer.passwordHash, password);
    if (!isValid) {
      throw new InvalidCredentialsError();
    }

    return this.issueTokenPair(customer.id, env);
  }

  /**
   * Verify a customer JWT and return the decoded payload.
   *
   * Throws for invalid/expired tokens, and for tokens that carry a non-customer role.
   * Guards D-11: vendor/admin tokens cannot access customer routes.
   *
   * @throws Error on invalid token, expired token, or non-customer role (T-04-06).
   */
  async verifyToken(token: string): Promise<CustomerTokenPayload> {
    const { env } = this.deps;
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    const { payload } = await jwtVerify(token, secret);

    if (payload["role"] !== "customer") {
      throw new Error("Token does not carry customer role.");
    }

    return {
      sub: payload["sub"] as string,
      role: "customer",
      customerId: payload["sub"] as string,
      iat: payload["iat"] as number,
      exp: payload["exp"] as number,
    };
  }

  /**
   * Verify a refresh token and issue a fresh access + refresh token pair.
   *
   * Used by POST /auth/refresh (Wave 4). The old refresh token is not invalidated
   * in this phase — refresh token rotation is a Phase 5+ concern.
   *
   * @throws Error on invalid token, expired token, or non-customer role.
   */
  async refreshTokens(refreshToken: string): Promise<CustomerLoginResult> {
    // Verify the refresh token using the same customer-role guard
    const payload = await this.verifyToken(refreshToken);
    return this.issueTokenPair(payload.sub, this.deps.env);
  }

  /**
   * Initiate a password reset flow.
   *
   * Generates a raw UUID token, stores its SHA-256 hash in password_reset_tokens
   * with a 1-hour expiry, and sends a reset email via nodemailer.
   *
   * Security:
   * - T-04-08: silently succeeds for unknown email — no account-existence disclosure.
   * - T-04-07: only the SHA-256 hash is stored; raw token is emailed and never persisted.
   * - Dev fallback: when SMTP is not configured, logs the reset link to console and does
   *   NOT throw — the API boots and operates correctly without email configuration.
   */
  async forgotPassword(email: string): Promise<void> {
    const { db, env, mailer } = this.deps;

    // Look up customer — silently succeed for unknown email (T-04-08)
    const rows = await db
      .select()
      .from(customers)
      .where(eq(customers.email, email))
      .limit(1);

    const customer = rows[0];
    if (!customer) {
      // No account for this email — return without error (no enumeration)
      return;
    }

    // Generate raw UUID token (never stored) and its SHA-256 hash (stored)
    const rawToken = randomUUID();
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    // Store only the hash with a 1-hour expiry (T-04-07, D-10)
    const expiresAt = new Date(Date.now() + this.RESET_TOKEN_TTL_SECONDS * 1000);
    await db.insert(passwordResetTokens).values({
      customerId: customer.id,
      tokenHash,
      expiresAt,
    });

    // Construct reset link (raw token — never the hash)
    const resetLink = `${env.STOREFRONT_ORIGIN}/auth/reset-password?token=${rawToken}`;

    // Send email via mailer or log in dev when SMTP is not configured
    const isSmtpConfigured =
      Boolean(env.SMTP_HOST) && Boolean(env.SMTP_USER) && Boolean(env.SMTP_PASS);

    if (isSmtpConfigured) {
      await mailer.sendMail({
        from: env.SMTP_FROM ?? env.SMTP_USER,
        to: email,
        subject: "Reset your Grovio password",
        html: `
          <p>Hi ${customer.name},</p>
          <p>You requested a password reset. Click the link below to reset your password:</p>
          <p><a href="${resetLink}">${resetLink}</a></p>
          <p>This link expires in 1 hour. If you did not request a reset, you can safely ignore this email.</p>
        `,
      });
    } else {
      // Dev fallback: log reset link to console (does not throw — API boots without SMTP)
      console.log(
        `[CustomerAuthService] Password reset link (dev mode — SMTP not configured): ${resetLink}`
      );
    }
  }

  /**
   * Complete a password reset.
   *
   * Hashes the raw token, looks up the matching row, rejects if missing or expired,
   * updates the customer's password, and hard-deletes the token row (single-use — T-04-07).
   *
   * @throws InvalidResetTokenError if token is missing, expired, or already used.
   */
  async resetPassword(rawToken: string, newPassword: string): Promise<void> {
    const { db } = this.deps;

    // Hash the raw token to look up the stored hash (T-04-07)
    const tokenHash = createHash("sha256").update(rawToken).digest("hex");

    // Find the token row
    const rows = await db
      .select()
      .from(passwordResetTokens)
      .where(eq(passwordResetTokens.tokenHash, tokenHash))
      .limit(1);

    const tokenRow = rows[0];

    // Reject if missing or expired (T-04-07, D-10)
    if (!tokenRow || tokenRow.expiresAt < new Date()) {
      throw new InvalidResetTokenError();
    }

    // Hash the new password with argon2 (T-04-09)
    const passwordHash = await argon2.hash(newPassword);

    // Update customer password
    await db
      .update(customers)
      .set({ passwordHash, updatedAt: new Date() })
      .where(eq(customers.id, tokenRow.customerId));

    // Hard-delete the token — single-use enforcement (T-04-07)
    await db
      .delete(passwordResetTokens)
      .where(eq(passwordResetTokens.id, tokenRow.id));
  }

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Issue an HS256 access + refresh token pair for the given customer ID.
   * Role is always "customer" — no vendorId claim (D-11, T-04-06).
   */
  private async issueTokenPair(
    customerId: string,
    env: Env
  ): Promise<CustomerLoginResult> {
    const secret = new TextEncoder().encode(env.JWT_SECRET);

    // Access token — short-lived (1h)
    const accessToken = await new SignJWT({
      sub: customerId,
      role: "customer" as const,
      // No vendorId claim — customer tokens cannot be used on vendor routes (D-11)
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${this.ACCESS_TTL_SECONDS}s`)
      .sign(secret);

    // Refresh token — long-lived (7d), scoped to /auth/refresh in the route
    const refreshToken = await new SignJWT({
      sub: customerId,
      role: "customer" as const,
    })
      .setProtectedHeader({ alg: "HS256" })
      .setIssuedAt()
      .setExpirationTime(`${this.REFRESH_TTL_SECONDS}s`)
      .sign(secret);

    return { accessToken, refreshToken, expiresIn: this.ACCESS_TTL_SECONDS };
  }
}
