import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Admin JWT preHandler — guards all /admin/* routes (D-21, T-06-09, T-06-10).
 *
 * Token extraction order (Phase 6 — mirrors customer auth cookie pattern D-09):
 *   1. Authorization: Bearer <token> header (API clients / integration tests)
 *   2. admin_token httpOnly cookie (admin web panel — set by POST /admin/auth/login)
 *
 * Verifies the HS256 signature with JWT_SECRET and checks that the token carries
 * role === "admin". On success:
 * - Sets `request.adminId` to the JWT `sub` claim (admin_users.id)
 * - Sets `request.adminEmail` to the JWT `email` claim
 *
 * Key security properties:
 * - T-06-09: Role read only from jose.jwtVerify-validated payload; JWT_SECRET server-side.
 * - T-06-10: Vendor tokens (role ∈ owner|manager|staff) are rejected 401.
 *            Customer tokens (role=customer) are rejected 401.
 * - Only role="admin" tokens are accepted.
 * - T-06-25: X-Internal-Admin-Token placeholder fully replaced.
 *
 * On any failure (missing token, invalid/expired token, wrong role):
 * returns 401 with a coded error envelope — never leaks raw JWT errors.
 *
 * Analog: apps/api/src/middleware/vendorAuth.ts — same structure.
 * Pattern source: PATTERNS.md "adminAuth.ts section".
 * Research ref: RESEARCH.md Code Examples — requireAdminAuth using jose jwtVerify.
 * Security ref: T-06-09 (Spoofing/Role claim forgery), T-06-10 (Elevation of Privilege), T-06-25.
 */
export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Extract token: Authorization header first, then cookie (D-09 / D-21 cookie pattern)
  let token: string | undefined;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    // Fall back to httpOnly cookie set by POST /admin/auth/login
    token = (request.cookies as Record<string, string | undefined>)?.["admin_token"];
  }

  // Reject requests without any token
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
