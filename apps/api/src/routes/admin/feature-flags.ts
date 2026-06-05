import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { FeatureFlagService } from "../../modules/feature-flags/index.js";

/**
 * Admin feature flag management routes (ADM-06, D-12).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET   /admin/feature-flags       — list ALL flags (including disabled) for the toggle UI
 * PATCH /admin/feature-flags/:key  — toggle a flag enabled/disabled
 *
 * FeatureFlagService.toggleFlag invalidates the Redis cache after the DB update (Pitfall 3).
 * Every toggle is logged to audit_log (T-06-24).
 */

const ToggleFlagInputSchema = z.object({
  enabled: z.boolean(),
});

export async function adminFeatureFlagRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): FeatureFlagService {
    return fastify.diContainer.resolve<FeatureFlagService>("featureFlagService");
  }

  // ── GET /admin/feature-flags ──────────────────────────────────────────────
  // Returns all flags including disabled rows — unlike the public getFlag() endpoint.
  fastify.get("/admin/feature-flags", async (_request, reply) => {
    const service = getService();
    const flags = await service.listFlags();
    return reply.send({ success: true, data: { flags } });
  });

  // ── PATCH /admin/feature-flags/:key ───────────────────────────────────────
  // Toggle a feature flag's enabled state.
  fastify.patch<{ Params: { key: string } }>(
    "/admin/feature-flags/:key",
    async (request, reply) => {
      const { enabled } = ToggleFlagInputSchema.parse(request.body);
      const service = getService();

      try {
        await service.toggleFlag(request.params.key, enabled);
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof Error && err.message.includes("not found")) {
          return reply.status(404).send({
            success: false,
            error: { code: "FLAG_NOT_FOUND", message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
