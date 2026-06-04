import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Admin JWT preHandler — guards all /admin/* routes (D-21, T-06-09, T-06-10).
 *
 * Reads the Authorization Bearer token from the request header, verifies
 * the HS256 signature with JWT_SECRET, and checks that the token carries
 * role === "admin". On success:
 * - Sets `request.adminId` to the JWT `sub` claim (admin_users.id)
 * - Sets `request.adminEmail` to the JWT `email` claim
 *
 * Key security properties:
 * - T-06-09: Role read only from jose.jwtVerify-validated payload; JWT_SECRET server-side.
 * - T-06-10: Vendor tokens (role ∈ owner|manager|staff) are rejected 401.
 *            Customer tokens (role=customer) are rejected 401.
 * - Only role="admin" tokens are accepted.
 *
 * On any failure (missing header, invalid/expired token, wrong role):
 * returns 401 with a coded error envelope — never leaks raw JWT errors.
 *
 * Analog: apps/api/src/middleware/vendorAuth.ts — same structure.
 * Pattern source: PATTERNS.md "adminAuth.ts section".
 * Research ref: RESEARCH.md Code Examples — requireAdminAuth using jose jwtVerify.
 * Security ref: T-06-09 (Spoofing/Role claim forgery), T-06-10 (Elevation of Privilege).
 */
export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  const authHeader = request.headers.authorization;

  // Reject requests without a Bearer token
  if (!authHeader?.startsWith("Bearer ")) {
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Bearer token required",
      },
    });
  }

  const token = authHeader.slice(7);
  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);

    // T-06-09, T-06-10: admin token MUST carry role="admin"; all other roles rejected
    if (payload["role"] !== "admin") {
      throw new Error("Token does not carry admin role.");
    }

    // Set adminId and adminEmail on the request for downstream handler access (D-21)
    request.adminId = payload["sub"] as string;
    request.adminEmail = payload["email"] as string;
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
