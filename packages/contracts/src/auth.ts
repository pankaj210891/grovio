import { z } from "zod";

/**
 * Role enum used across auth types.
 * Shared by JwtPayload, SessionData, and future RBAC checks.
 */
const RoleSchema = z.enum(["customer", "vendor", "admin"]);

/**
 * Shape of the JWT payload signed and verified by the backend (jose 6.x).
 * Matches the token structure created in the auth service.
 *
 * Security note (T-02-03): payload is readable by authenticated clients by design;
 * no secrets are stored in the payload.
 */
export const JwtPayloadSchema = z.object({
  /** Subject — user UUID */
  sub: z.string().uuid(),
  /** User role */
  role: RoleSchema,
  /** Vendor ID — present only when role === "vendor" */
  vendorId: z.string().uuid().optional(),
  /** Issued at (Unix timestamp seconds) */
  iat: z.number(),
  /** Expires at (Unix timestamp seconds) */
  exp: z.number(),
});

/** TypeScript type inferred from JwtPayloadSchema */
export type JwtPayload = z.infer<typeof JwtPayloadSchema>;

/**
 * Session data stored in Redis and returned to authenticated route handlers.
 * Mirrors JwtPayload but uses a human-readable ISO timestamp for expiry.
 */
export const SessionDataSchema = z.object({
  /** User UUID */
  userId: z.string().uuid(),
  /** User role */
  role: RoleSchema,
  /** Vendor ID — present only when role === "vendor" */
  vendorId: z.string().uuid().optional(),
  /** ISO-8601 UTC expiry timestamp */
  expiresAt: z.string().datetime(),
});

/** TypeScript type inferred from SessionDataSchema */
export type SessionData = z.infer<typeof SessionDataSchema>;

/**
 * Pair of tokens returned to the client after successful authentication.
 */
export const AuthTokenPairSchema = z.object({
  /** Short-lived JWT access token */
  accessToken: z.string(),
  /** Long-lived refresh token (opaque or JWT) */
  refreshToken: z.string(),
  /** Access token lifetime in seconds */
  expiresIn: z.number(),
});

/** TypeScript type inferred from AuthTokenPairSchema */
export type AuthTokenPair = z.infer<typeof AuthTokenPairSchema>;
