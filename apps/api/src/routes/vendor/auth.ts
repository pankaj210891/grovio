import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import {
  type VendorAuthService,
  InvalidCredentialsError,
  VendorAlreadyExistsError,
} from "../../modules/vendor-auth/index.js";

/**
 * Vendor authentication routes — public endpoints (register, login) + protected (me, logout).
 *
 * POST /vendor/auth/register — creates a new vendor account (D-17)
 * POST /vendor/auth/login    — authenticates, sets httpOnly vendor_token cookie, returns expiresIn
 * GET  /vendor/auth/me       — returns the vendor user profile from the JWT (requireVendorAuth)
 * POST /vendor/auth/logout   — clears the vendor_token cookie
 *
 * Body validation (T-03-W3 / ASVS V5):
 *   Request bodies are validated through inline Zod schemas before reaching
 *   the service. Invalid payloads throw ZodError (converted to 400 by app.ts).
 *
 * Cookie: vendor_token — httpOnly, sameSite=lax, path=/ (mirrors admin auth cookie pattern D-21).
 *
 * Error mapping (T-03-W4):
 *   - InvalidCredentialsError → 401 (no enumeration — same error for bad email or bad password)
 *   - VendorAlreadyExistsError → 409
 *   - Other errors → re-thrown to app.ts error handler
 */

const RegisterInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().min(1),
});

const LoginInputSchema = z.object({
  email: z.string().email(),
  password: z.string().min(1),
});

export async function vendorAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /vendor/auth/register ────────────────────────────────────────────
  // Creates a new vendor account. Returns 201 with the created vendor (no hash).
  fastify.post("/vendor/auth/register", async (request, reply) => {
    const body = RegisterInputSchema.parse(request.body);
    const vendorAuthService =
      fastify.diContainer.resolve<VendorAuthService>("vendorAuthService");

    try {
      const vendor = await vendorAuthService.register(
        body.email,
        body.password,
        body.name
      );
      return reply.status(201).send({ success: true, data: vendor });
    } catch (err) {
      if (err instanceof VendorAlreadyExistsError) {
        return reply.status(409).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /vendor/auth/login ───────────────────────────────────────────────
  // Authenticates a vendor, sets an httpOnly cookie, and returns expiresIn (D-17, Phase 6).
  // Maps InvalidCredentialsError to 401 — identical error for unknown email or
  // wrong password to prevent user enumeration (T-03-P1).
  fastify.post("/vendor/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const vendorAuthService =
      fastify.diContainer.resolve<VendorAuthService>("vendorAuthService");

    try {
      const result = await vendorAuthService.login(body.email, body.password);

      // Set httpOnly cookie for vendor web panel (D-21 pattern, Phase 6)
      void reply.setCookie("vendor_token", result.accessToken, {
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

  // ── GET /vendor/auth/me ───────────────────────────────────────────────────
  // Returns the authenticated vendor user profile from the JWT claims (Phase 6).
  // Guarded by requireVendorAuth — reads cookie or Bearer header.
  fastify.get(
    "/vendor/auth/me",
    { preHandler: requireVendorAuth },
    async (request, reply) => {
      return reply.send({
        success: true,
        data: {
          vendorId: request.vendorId,
          role: request.vendorRole,
        },
      });
    }
  );

  // ── POST /vendor/auth/logout ──────────────────────────────────────────────
  // WR-04: guard with requireVendorAuth to prevent CSRF logout with sameSite=lax cookies.
  // A valid vendor token is required to clear the cookie (mirrors GET /vendor/auth/me pattern).
  fastify.post("/vendor/auth/logout", { preHandler: requireVendorAuth }, async (_request, reply) => {
    void reply.clearCookie("vendor_token", { path: "/" });
    return reply.send({ success: true, data: null });
  });
}
