import { z } from "zod";
import type { FastifyInstance } from "fastify";
import {
  VendorAuthService,
  InvalidCredentialsError,
  VendorAlreadyExistsError,
} from "../../modules/vendor-auth/index.js";

/**
 * Vendor authentication routes — public endpoints, no preHandler guard.
 *
 * POST /vendor/auth/register — creates a new vendor account (D-17)
 * POST /vendor/auth/login    — authenticates and returns a JWT (D-17)
 *
 * Body validation (T-03-W3 / ASVS V5):
 *   Request bodies are validated through inline Zod schemas before reaching
 *   the service. Invalid payloads throw ZodError (converted to 400 by app.ts).
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
  // Authenticates a vendor and returns an HS256 JWT (D-17).
  // Maps InvalidCredentialsError to 401 — identical error for unknown email or
  // wrong password to prevent user enumeration (T-03-P1).
  fastify.post("/vendor/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const vendorAuthService =
      fastify.diContainer.resolve<VendorAuthService>("vendorAuthService");

    try {
      const result = await vendorAuthService.login(body.email, body.password);
      return reply.status(200).send({ success: true, data: result });
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
}
