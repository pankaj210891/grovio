import { z } from "zod";
import { env } from "../../config/env.js";
import type { FastifyInstance } from "fastify";
import {
  type CustomerAuthService,
  CustomerAlreadyExistsError,
  InvalidCredentialsError,
  InvalidResetTokenError,
} from "../../modules/customer-auth/index.js";

/**
 * Customer authentication routes — public endpoints, no preHandler guard.
 *
 * POST /auth/signup          — creates a new customer account (AUTH-01)
 * POST /auth/login           — authenticates and sets httpOnly cookies (D-09, AUTH-02)
 * POST /auth/refresh         — rotates the access token using the scoped refresh cookie
 * POST /auth/logout          — clears both auth cookies
 * POST /auth/forgot-password — triggers password reset email (AUTH-03, D-10)
 * POST /auth/reset-password  — completes password reset with a time-limited token
 *
 * Body validation (T-04-17 / ASVS V5):
 *   Request bodies are validated through inline Zod schemas before reaching
 *   the service. Invalid payloads throw ZodError (converted to 400 by app.ts).
 *
 * Error mapping:
 *   - CustomerAlreadyExistsError → 409
 *   - InvalidCredentialsError → 401 (no enumeration)
 *   - InvalidResetTokenError → 400
 *   - Other errors → re-thrown to app.ts error handler
 *
 * Cookie issuance (D-09):
 *   - access_token: httpOnly, path="/", maxAge=3600s
 *   - refresh_token: httpOnly, path="/auth/refresh" (scoped — Pitfall 7)
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

const ForgotPasswordInputSchema = z.object({
  email: z.string().email(),
});

const ResetPasswordInputSchema = z.object({
  token: z.string(),
  password: z.string().min(8),
});

export async function customerAuthRoutes(fastify: FastifyInstance): Promise<void> {
  // ── POST /auth/signup ─────────────────────────────────────────────────────
  // Creates a new customer account. Returns 201 with the created customer (no hash).
  fastify.post("/auth/signup", async (request, reply) => {
    const body = RegisterInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");

    try {
      const customer = await customerAuthService.register(
        body.email,
        body.password,
        body.name
      );
      return reply.status(201).send({ success: true, data: customer });
    } catch (err) {
      if (err instanceof CustomerAlreadyExistsError) {
        return reply.status(409).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /auth/login ──────────────────────────────────────────────────────
  // Authenticates a customer and sets httpOnly cookies (D-09).
  // Maps InvalidCredentialsError to 401 — identical error for unknown email or
  // wrong password to prevent user enumeration (T-04-05).
  fastify.post("/auth/login", async (request, reply) => {
    const body = LoginInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");

    try {
      const result = await customerAuthService.login(body.email, body.password);
      const isProduction = env.NODE_ENV === "production";

      return reply
        .setCookie("access_token", result.accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          path: "/",
          maxAge: result.expiresIn,
        })
        .setCookie("refresh_token", result.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          path: "/auth/refresh", // scoped — not sent to all API routes (Pitfall 7, T-04-14)
          maxAge: 604800,
        })
        .send({ success: true, data: { expiresIn: result.expiresIn } });
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

  // ── POST /auth/refresh ────────────────────────────────────────────────────
  // Reads the refresh_token cookie, verifies it, and re-issues both cookies.
  // Returns 401 if the cookie is missing or the token is invalid/expired.
  fastify.post("/auth/refresh", async (request, reply) => {
    const refreshToken = request.cookies?.["refresh_token"];

    if (!refreshToken) {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Refresh token missing" },
      });
    }

    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");

    try {
      const result = await customerAuthService.refreshTokens(refreshToken);
      const isProduction = env.NODE_ENV === "production";

      return reply
        .setCookie("access_token", result.accessToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          path: "/",
          maxAge: result.expiresIn,
        })
        .setCookie("refresh_token", result.refreshToken, {
          httpOnly: true,
          secure: isProduction,
          sameSite: "lax",
          path: "/auth/refresh",
          maxAge: 604800,
        })
        .send({ success: true, data: { expiresIn: result.expiresIn } });
    } catch {
      return reply.status(401).send({
        success: false,
        error: { code: "UNAUTHORIZED", message: "Invalid or expired refresh token" },
      });
    }
  });

  // ── POST /auth/logout ─────────────────────────────────────────────────────
  // Clears both auth cookies (T-04-16). Does not require auth — clearing stale
  // cookies for unauthenticated requests is safe and expected (e.g. expired session).
  fastify.post("/auth/logout", async (_request, reply) => {
    return reply
      .clearCookie("access_token", { path: "/" })
      .clearCookie("refresh_token", { path: "/auth/refresh" })
      .status(200)
      .send({ success: true, data: null });
  });

  // ── POST /auth/forgot-password ────────────────────────────────────────────
  // Triggers a password reset email. Always returns 200 — no enumeration (T-04-08).
  // Unknown email addresses silently succeed (service handles this case).
  fastify.post("/auth/forgot-password", async (request, reply) => {
    const body = ForgotPasswordInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");

    // Always 200 — do not enumerate whether the email exists (T-04-08)
    await customerAuthService.forgotPassword(body.email);
    return reply.status(200).send({ success: true, data: null });
  });

  // ── POST /auth/reset-password ─────────────────────────────────────────────
  // Verifies the reset token and updates the customer's password.
  // Returns 400 with err.code on InvalidResetTokenError (D-10).
  fastify.post("/auth/reset-password", async (request, reply) => {
    const body = ResetPasswordInputSchema.parse(request.body);
    const customerAuthService =
      fastify.diContainer.resolve<CustomerAuthService>("customerAuthService");

    try {
      await customerAuthService.resetPassword(body.token, body.password);
      return reply.status(200).send({ success: true, data: null });
    } catch (err) {
      if (err instanceof InvalidResetTokenError) {
        return reply.status(400).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });
}
