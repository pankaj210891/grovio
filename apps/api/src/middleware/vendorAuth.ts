import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Vendor JWT preHandler — guards all /vendor/* routes (T-03-W1, V4).
 *
 * Reads the Authorization Bearer token from the request header, verifies
 * the HS256 signature with JWT_SECRET, and checks that the token carries
 * role === 'vendor'. On success, sets `request.vendorId` so downstream
 * handlers can perform ownership checks without re-decoding the token.
 *
 * On any failure (missing header, invalid/expired token, wrong role):
 * returns 401 with a coded error envelope — never leaks raw JWT errors.
 *
 * Pattern source: PATTERNS.md "Vendor JWT preHandler (applies to all /vendor/* routes)".
 * Research ref: RESEARCH.md Code Examples — requireVendorAuth using jose jwtVerify.
 * Security ref: T-03-W1 (Spoofing), V4 (Auth), T-03-W2 (Elevation of Privilege).
 */
export async function requireVendorAuth(
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

    // T-03-W2: vendor token CANNOT satisfy admin guard — role claim is mandatory
    if (payload["role"] !== "vendor") {
      throw new Error("Token does not carry vendor role.");
    }

    // Set vendorId on the request for downstream ownership checks (V4)
    const rawVendorId = payload["vendorId"];
    if (typeof rawVendorId !== "string" || rawVendorId.length === 0) {
      throw new Error("Token is missing vendorId claim.");
    }
    request.vendorId = rawVendorId;
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
