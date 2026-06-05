import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Vendor JWT preHandler — guards all /vendor/* routes (T-03-W1, V4, T-06-09, T-06-10).
 *
 * Phase 6 migration (D-03, D-06): accepts tokens with role ∈ { "owner", "manager", "staff" }.
 * The pre-Phase-6 role="vendor" literal is no longer accepted — stale tokens are rejected.
 *
 * Token extraction order (Phase 6 — mirrors admin auth cookie pattern D-21):
 *   1. Authorization: Bearer <token> header (API clients / integration tests)
 *   2. vendor_token httpOnly cookie (vendor web panel — set by POST /vendor/auth/login)
 *
 * Verifies the HS256 signature with JWT_SECRET and checks that the token carries
 * one of the three vendor roles. On success:
 * - Sets `request.vendorId` to the JWT `vendorId` claim (FK to vendors.id — D-03/D-06 NOTE)
 * - Sets `request.vendorRole` to the JWT `role` claim ("owner" | "manager" | "staff")
 *
 * Migration note (D-03, D-06): `vendorId` is extracted from `payload["vendorId"]` (NOT
 * `payload["sub"]`). This preserves all existing ownership checks in Phase 3/4/5 routes
 * that compare `request.vendorId` against product/order FK columns (which reference vendors.id).
 * The `sub` claim now carries vendor_users.id but downstream handlers should use `vendorId`.
 *
 * On any failure (missing token, invalid/expired token, wrong role):
 * returns 401 with a coded error envelope — never leaks raw JWT errors.
 *
 * Pattern source: PATTERNS.md "Vendor JWT preHandler (applies to all /vendor/* routes)".
 * Research ref: RESEARCH.md Code Examples — requireVendorAuth using jose jwtVerify.
 * Security ref: T-03-W1 (Spoofing), V4 (Auth), T-03-W2 (Elevation of Privilege),
 *               T-06-09 (Role claim forgery), T-06-10 (Vendor token on admin routes).
 */
export async function requireVendorAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  // Extract token: Authorization header first, then vendor_token cookie (Phase 6 D-21 pattern)
  let token: string | undefined;

  const authHeader = request.headers.authorization;
  if (authHeader?.startsWith("Bearer ")) {
    token = authHeader.slice(7);
  } else {
    // Fall back to httpOnly cookie set by POST /vendor/auth/login
    token = (request.cookies as Record<string, string | undefined>)?.["vendor_token"];
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

    // Phase 6 (T-06-09, T-06-10): accept only vendor team roles; reject admin and customer
    const role = payload["role"];
    if (role !== "owner" && role !== "manager" && role !== "staff") {
      throw new Error("Token does not carry a valid vendor role.");
    }

    // Set vendorId from the `vendorId` claim (FK to vendors.id — NOT sub which is vendor_users.id)
    // This preserves all Phase 3/4/5 ownership checks (D-03 migration note).
    const rawVendorId = payload["vendorId"];
    if (typeof rawVendorId !== "string" || rawVendorId.length === 0) {
      throw new Error("Token is missing vendorId claim.");
    }
    request.vendorId = rawVendorId;

    // WR-08: expose vendor_users.id from the JWT `sub` claim for routes that need
    // the user ID (e.g. invitedByUserId in team management) rather than the store ID.
    const rawSub = payload["sub"];
    if (typeof rawSub === "string" && rawSub.length > 0) {
      request.vendorUserId = rawSub;
    }

    // Phase 6: expose the role on the request for role-gated route handlers (D-05)
    request.vendorRole = role as "owner" | "manager" | "staff";
  } catch {
    // Suppresses raw jose errors in the response — prevents token leakage (T-03-W4)
    return reply.status(401).send({
      success: false,
      error: {
        code: "UNAUTHORIZED",
        message: "Invalid or expired token",
      },
    });
  }
}
