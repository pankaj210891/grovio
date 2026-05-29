import type { HealthCheckResponse } from "@grovio/contracts";
import type { FastifyInstance } from "fastify";

/**
 * Health-check route plugin.
 *
 * GET /health → 200 HealthCheckResponse
 *
 * Returns service status, package version, and current ISO-8601 timestamp.
 * Useful for load-balancer health checks and basic liveness probes.
 *
 * Response shape is typed to HealthCheckResponse from @grovio/contracts so
 * the compile-time type and the runtime Zod schema stay in sync.
 */
export default async function healthRoutes(fastify: FastifyInstance) {
  fastify.get(
    "/health",
    {
      schema: {
        // JSON Schema mirrors HealthCheckResponseSchema from @grovio/contracts.
        // Fastify uses this for response serialization and validation.
        response: {
          200: {
            type: "object",
            properties: {
              status: { type: "string", enum: ["ok", "degraded", "error"] },
              version: { type: "string" },
              timestamp: { type: "string", format: "date-time" },
            },
            required: ["status", "version", "timestamp"],
            additionalProperties: false,
          },
        },
      },
    },
    async (_req, reply) => {
      const response: HealthCheckResponse = {
        status: "ok",
        version: process.env["npm_package_version"] ?? "0.1.0",
        timestamp: new Date().toISOString(),
      };
      return reply.send(response);
    },
  );
}
