import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { SettingsService } from "../../modules/settings/index.js";
import { UpdateSettingInputSchema } from "@grovio/contracts/admin/settings";

/**
 * Admin marketplace settings routes (ADM-05, D-19).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET   /admin/settings       — list ALL marketplace settings as key→value record
 * PATCH /admin/settings/:key  — upsert a single setting (key must be a valid MarketplaceSettingKey)
 *
 * SettingsService uses Redis-first caching (same pattern as FeatureFlagService).
 * Cache is invalidated AFTER the DB write (Pitfall 3 ordering, T-06-14).
 */

export async function adminSettingsRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): SettingsService {
    return fastify.diContainer.resolve<SettingsService>("settingsService");
  }

  // ── GET /admin/settings ───────────────────────────────────────────────────
  // Returns all settings as a key → value record (directly from DB — low-frequency admin access).
  fastify.get("/admin/settings", async (_request, reply) => {
    const service = getService();
    const settings = await service.getAllSettings();
    return reply.send({ success: true, data: settings });
  });

  // ── PATCH /admin/settings/:key ────────────────────────────────────────────
  // Upsert a single marketplace setting.
  // The key must be a valid MarketplaceSettingKey (validated by UpdateSettingInputSchema).
  fastify.patch<{ Params: { key: string } }>(
    "/admin/settings/:key",
    async (request, reply) => {
      // Combine the path param key with the body into the UpdateSettingInput shape
      const body = UpdateSettingInputSchema.parse({
        key: request.params.key,
        value: (request.body as { value?: unknown })?.value,
      });
      const service = getService();
      await service.updateSetting(body.key, body.value);
      return reply.send({ success: true, data: null });
    }
  );
}
