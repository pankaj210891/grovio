import type { FastifyInstance } from "fastify";
import type { FeatureFlagService } from "../modules/feature-flags/index.js";

/**
 * Feature flag routes — internal use only.
 *
 * These routes are not exposed to end users; they are intended for admin
 * tooling, server-side configuration reads, and integration tests.
 *
 * GET /internal/flags        → list all enabled flags
 * GET /internal/flags/:key   → get value for a single flag (404 if missing/disabled)
 */
export async function featureFlagRoutes(fastify: FastifyInstance): Promise<void> {
  // GET /internal/flags
  fastify.get("/internal/flags", async (_request, reply) => {
    const featureFlagService = fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
    const flags = await featureFlagService.getAllFlags();
    return reply.send({ success: true, data: flags });
  });

  // GET /internal/flags/:key
  fastify.get<{ Params: { key: string } }>("/internal/flags/:key", async (request, reply) => {
    const featureFlagService = fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
    const value = await featureFlagService.getFlag(request.params.key);
    if (value === null) {
      return reply.status(404).send({
        success: false,
        error: {
          code: "FLAG_NOT_FOUND",
          message: "Feature flag not found",
        },
      });
    }
    return reply.send({ success: true, data: { key: request.params.key, value } });
  });
}
