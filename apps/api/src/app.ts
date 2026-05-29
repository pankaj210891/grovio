import type { ApiError } from "@grovio/contracts";
import Fastify, { type FastifyInstance, type FastifyServerOptions } from "fastify";
import awilixPlugin from "./plugins/awilix.js";
import drizzlePlugin from "./plugins/drizzle.js";
import redisPlugin from "./plugins/redis.js";
import healthRoutes from "./routes/health.js";

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
  await fastify.register(drizzlePlugin);
  await fastify.register(redisPlugin);
  await fastify.register(awilixPlugin);

  // --- Routes ---
  await fastify.register(healthRoutes);

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
  fastify.setErrorHandler((error, _req, reply) => {
    fastify.log.error(error);

    const isProd = process.env["NODE_ENV"] === "production";

    const body: ApiError = {
      success: false,
      error: {
        code: error.code ?? "INTERNAL_ERROR",
        // Suppress raw error messages in production (threat T-03-01).
        message: isProd ? "An unexpected error occurred" : (error.message ?? "Internal server error"),
      },
    };

    const statusCode = (typeof error.statusCode === "number" && error.statusCode >= 400)
      ? error.statusCode
      : 500;

    return reply.status(statusCode).send(body);
  });

  return fastify;
}
