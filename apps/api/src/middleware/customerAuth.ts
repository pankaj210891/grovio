import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import "@fastify/cookie"; // import for module augmentation (adds request.cookies type)
import { env } from "../config/env.js";

/**
 * Augment FastifyRequest to carry `customerId` after successful auth.
 *
 * Mirrors the existing `vendorId` augmentation in vendorAuth.ts.
 * Set on the request by requireCustomerAuth so downstream handlers can
 * perform ownership checks without re-decoding the token.
 */
declare module "fastify" {
  interface FastifyRequest {
    customerId?: string;
  }
}

/**
 * Customer cookie JWT preHandler — guards all /account/* routes (AUTH-04, D-11).
 *
 * Reads the access_token from the httpOnly cookie set by POST /auth/login (D-09),
 * verifies the HS256 signature with JWT_SECRET, and checks that the token carries
 * role === 'customer'. On success, sets `request.customerId` so downstream handlers
 * can perform ownership checks without re-decoding the token.
 *
 * On any failure (missing cookie, invalid/expired token, wrong role):
 * returns 401 with a coded error envelope — never leaks raw JWT errors.
 *
 * Key differences from requireVendorAuth:
 * 1. Reads from `request.cookies.access_token` (httpOnly cookie) — NOT Authorization header.
 * 2. Guards `payload.role === "customer"` (D-11/T-04-06) — vendor tokens are rejected.
 * 3. Sets `request.customerId` (not `request.vendorId`).
 *
 * Requires `@fastify/cookie` registered before this middleware runs (wired in Plan 04-04 app.ts).
 *
 * Pattern source: PATTERNS.md § customerAuth.ts (exact middleware, vendorAuth analog).
 * Security: T-04-06 (Spoofing), AUTH-04 (customer-role guard), D-09 (httpOnly cookie).
 */
export async function requireCustomerAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Read token from httpOnly cookie (D-09) — NOT Authorization header
  const token = request.cookies?.["access_token"];

  // Reject requests without a cookie token
  if (!token) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Authentication required",
      },
    });
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);

    // T-04-06 / D-11: customer token CANNOT satisfy vendor/admin guard — role claim is mandatory
    if (payload["role"] !== "customer") {
      throw new Error("Token does not carry customer role.");
    }

    // Set customerId on the request for downstream ownership checks (AUTH-04)
    request.customerId = payload["sub"] as string;
  } catch {
    // Suppress raw jose errors in the response — prevents token leakage
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      },
    });
  }
}
