import { jwtVerify } from "jose";
import type { FastifyRequest, FastifyReply } from "fastify";
import { env } from "../config/env.js";

/**
 * Admin JWT preHandler — guards all /admin/* routes (Phase 11, D-21).
 *
 * Token extraction order:
 *   1. Authorization: Bearer <token> header (dev/test environments only)
 *   2. admin_token httpOnly cookie (admin web panel)
 *
 * Verifies HS256 signature with JWT_SECRET and checks role === 'admin'.
 * On success:
 *   - Sets request.adminId (UUID from `sub` claim)
 *   - Sets request.adminEmail (email from JWT payload)
 *   - Sets request.adminRole (from JWT payload, defaults to 'moderator')
 *
 * Security:
 * - Bearer header auth is disabled in production (prevents XSS token exfiltration)
 * - Role extracted from server-verified JWT payload only (not from request headers/body)
 */
export async function requireAdminAuth(
  request: FastifyRequest,
  reply: FastifyReply
): Promise<void> {
  let token: string | undefined;

  const authHeader = request.headers.authorization;
  if (
    authHeader?.startsWith("Bearer ") &&
    process.env["NODE_ENV"] !== "production"
  ) {
    token = authHeader.slice(7);
  } else {
    token = (request.cookies as Record<string, string | undefined>)?.["admin_token"];
  }

  if (!token) {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Authentication required" },
    });
  }

  const secret = new TextEncoder().encode(env.JWT_SECRET);

  try {
    const { payload } = await jwtVerify(token, secret);

    if (payload["role"] !== "admin") {
      throw new Error("Token does not carry admin role.");
    }

    request.adminId = payload["sub"] as string;
    request.adminEmail = payload["email"] as string;
    // adminRole from JWT (default 'moderator' for backward compat with existing tokens)
    request.adminRole = (payload["adminRole"] as string | undefined) ?? "moderator";
  } catch {
    return reply.status(401).send({
      success: false,
      error: { code: "UNAUTHORIZED", message: "Invalid or expired token" },
    });
  }
}

/**
 * RBAC middleware factory — returns a preHandler that enforces section access.
 *
 * Role access matrix:
 *   super_admin:   all sections
 *   moderator:     catalog, vendors, support (no finance, settings)
 *   finance_admin: finance only (no vendors, catalog, settings, support)
 *
 * Usage:
 *   fastify.addHook('preHandler', rbacGuard(['super_admin', 'finance_admin']))
 *   fastify.addHook('preHandler', rbacGuard(['super_admin']))
 */
export function rbacGuard(allowedRoles: string[]) {
  return async function (request: FastifyRequest, reply: FastifyReply): Promise<void> {
    const role = request.adminRole ?? "moderator";
    if (!allowedRoles.includes(role)) {
      return reply.status(403).send({
        success: false,
        error: {
          code: "FORBIDDEN",
          message: `Role '${role}' is not permitted to access this section.`,
        },
      });
    }
  };
}
