import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import {
  type AdminAuthService,
  InvalidCredentialsError,
} from "../../modules/admin-auth/index.js";

/**
 * Admin authentication routes (D-21).
 *
 * POST /admin/auth/login   — public; verifies credentials, sets httpOnly cookie
 * POST /admin/auth/logout  — clears the admin_token cookie
 * GET  /admin/auth/me      — protected by requireAdminAuth; returns admin profile from JWT
 *
 * Cookie: admin_token — httpOnly, sameSite=lax, path=/ (mirrors customer auth cookie D-09 pattern).
 * Login route is intentionally NOT behind requireAdminAuth.
 */

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function adminAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /admin/auth/login ─────────────────────────────────────────────────
  // Public — no preHandler guard.
  // Verifies credentials and sets an httpOnly cookie on success (D-21).
  fastify.post("/admin/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const adminAuthService =
      fastify.diContainer.resolve<AdminAuthService>("adminAuthService");

    try {
      const result = await adminAuthService.login(body.email, body.password);

      // Set httpOnly cookie — mirrors customer auth cookie pattern (D-09, D-21)
      void reply.setCookie("admin_token", result.accessToken, {
        httpOnly: true,
        sameSite: "lax",
        path: "/",
        maxAge: result.expiresIn,
        secure: process.env["NODE_ENV"] === "production",
      });

      return reply.status(200).send({
        success: true,
        data: { expiresIn: result.expiresIn },
      });
    } catch (err) {
      if (err instanceof InvalidCredentialsError) {
        return reply.status(401).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /admin/auth/logout ────────────────────────────────────────────────
  // WR-04: guard with requireAdminAuth to prevent CSRF logout with sameSite=lax cookies.
  // A valid admin token is required to clear the cookie (mirrors GET /admin/auth/me pattern).
  fastify.post("/admin/auth/logout", { preHandler: requireAdminAuth }, async (_request, reply) => {
    void reply.clearCookie("admin_token", { path: "/" });
    return reply.send({ success: true, data: null });
  });

  // ── GET /admin/auth/me ─────────────────────────────────────────────────────
  // Protected — requireAdminAuth guard validates the cookie/bearer token and
  // populates request.adminId and request.adminEmail.
  fastify.get(
    "/admin/auth/me",
    { preHandler: requireAdminAuth },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          id: request.adminId,
          email: request.adminEmail,
          role: "admin" as const,
        },
      });
    }
  );
}
