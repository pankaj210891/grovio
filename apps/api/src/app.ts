import type { ApiError } from "@grovio/contracts";
import cookiePlugin from "@fastify/cookie";
import cors from "@fastify/cors";
import Fastify, { type FastifyError, type FastifyInstance, type FastifyServerOptions } from "fastify";
import { ZodError } from "zod";
import { env } from "./config/env.js";
import awilixPlugin from "./plugins/awilix.js";
import drizzlePlugin from "./plugins/drizzle.js";
import opensearchPlugin from "./plugins/opensearch.js";
import redisPlugin from "./plugins/redis.js";
import { accountAddressRoutes } from "./routes/account/addresses.js";
import { accountProfileRoutes } from "./routes/account/profile.js";
import { adminCategoryRoutes } from "./routes/admin/categories.js";
import { adminProductRoutes } from "./routes/admin/products.js";
import { categoryRoutes } from "./routes/categories.js";
import { customerAuthRoutes } from "./routes/customer/auth.js";
import { featureFlagRoutes } from "./routes/feature-flags.js";
import healthRoutes from "./routes/health.js";
import { homepageRoutes } from "./routes/homepage.js";
import { searchRoutes } from "./routes/search.js";
import { vendorAuthRoutes } from "./routes/vendor/auth.js";
import { vendorProductRoutes } from "./routes/vendor/products.js";

/**
 * Build and configure the Fastify application.
 *
 * Plugin registration order:
 *   1. drizzle  — PostgreSQL connection pool + Drizzle ORM (`fastify.db`)
 *   2. redis    — ioredis client (`fastify.redis`)
 *   3. awilix   — DI container (`fastify.diContainer`), depends on db + redis
 *   4. routes   — HTTP route handlers, use DI container
 *
 * Error handling:
 *   - Unknown routes return 404 ApiError envelope
 *   - Unhandled errors return 500 ApiError envelope (stack trace suppressed in production)
 *
 * @param opts - Optional Fastify server options (useful for testing: pass { logger: false })
 */
export async function buildApp(opts?: FastifyServerOptions): Promise<FastifyInstance> {
  const fastify = Fastify({
    logger: true,
    ...opts,
  });

  // --- Plugins (order matters) ---
  // 1. drizzle  — PostgreSQL connection pool + Drizzle ORM (`fastify.db`)
  // 2. redis    — ioredis client (`fastify.redis`)
  // 3. opensearch — OpenSearch client (`fastify.opensearch`); null when URL not set
  // 4. awilix   — DI container (`fastify.diContainer`), depends on db + redis + opensearch
  // 5. routes   — HTTP route handlers, use DI container
  await fastify.register(drizzlePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(opensearchPlugin); // Phase 3: must run AFTER redis, BEFORE awilix
  await fastify.register(awilixPlugin);

  // --- Phase 4: CORS + cookie — must be registered BEFORE all routes ---
  // CORS: credentials mode — origin must be exact (never "*"), T-04-13 / Pitfall 2
  await fastify.register(cors, {
    origin: env.STOREFRONT_ORIGIN,
    credentials: true,
    methods: ["GET", "HEAD", "PUT", "PATCH", "POST", "DELETE"],
  });
  // Cookie: required before customerAuthRoutes and /account/* (reply.setCookie, request.cookies)
  await fastify.register(cookiePlugin);

  // --- Routes (Phase 1-2) ---
  await fastify.register(healthRoutes);
  await fastify.register(featureFlagRoutes);
  await fastify.register(categoryRoutes);
  await fastify.register(adminCategoryRoutes);

  // --- Routes (Phase 3 — plan 03-07) ---
  await fastify.register(vendorAuthRoutes); // POST /vendor/auth/* (public — no JWT guard)
  await fastify.register(vendorProductRoutes); // /vendor/products/* (JWT-guarded)
  await fastify.register(adminProductRoutes); // /admin/products/* (admin token guard)
  await fastify.register(searchRoutes); // GET /search, GET /search/suggest (public)

  // --- Routes (Phase 4 — plan 04-05) ---
  await fastify.register(customerAuthRoutes); // POST /auth/* (public — no JWT guard, D-11)
  await fastify.register(accountProfileRoutes); // GET/PATCH /account/profile (customer cookie guard)
  await fastify.register(accountAddressRoutes); // /account/addresses/* (customer cookie guard)
  await fastify.register(homepageRoutes); // GET /homepage (public — Redis-cached, STORE-01)

  // --- 404 handler ---
  fastify.setNotFoundHandler((_req, reply) => {
    const body: ApiError = {
      success: false,
      error: {
        code: "NOT_FOUND",
        message: "Route not found",
      },
    };
    return reply.status(404).send(body);
  });

  // --- Error handler ---
  fastify.setErrorHandler((error: FastifyError | ZodError, _req, reply) => {
    fastify.log.error(error);

    const isProd = process.env["NODE_ENV"] === "production";

    // ZodError: bad client input — always 400, structured message
    if (error instanceof ZodError) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: isProd
            ? "Invalid request parameters"
            : error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; "),
        },
      });
    }

    const body: ApiError = {
      success: false,
      error: {
        code: (error as FastifyError).code ?? "INTERNAL_ERROR",
        // Suppress raw error messages in production (threat T-03-01).
        message: isProd ? "An unexpected error occurred" : (error.message ?? "Internal server error"),
      },
    };

    const statusCode = (typeof (error as FastifyError).statusCode === "number" && (error as FastifyError).statusCode! >= 400)
      ? (error as FastifyError).statusCode!
      : 500;

    return reply.status(statusCode).send(body);
  });

  return fastify;
}
