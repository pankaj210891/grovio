import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { HomepageService } from "../../modules/homepage/index.js";
import {
  CreateHomepageBlockInputSchema,
  UpdateHomepageBlockInputSchema,
} from "@grovio/contracts/admin/cms";

/**
 * Admin homepage block CMS routes (ADM-04, D-11).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET    /admin/homepage-blocks        — list ALL blocks (incl. inactive) for admin CMS page
 * POST   /admin/homepage-blocks        — create a new homepage block
 * PATCH  /admin/homepage-blocks/:id   — update an existing block (content and/or active flag)
 * DELETE /admin/homepage-blocks/:id   — delete a block
 * POST   /admin/homepage-blocks/:id/reorder — move block up or down in the ordered list
 *
 * HomepageService invalidates Redis cache after every write (Pitfall 3, T-06-23).
 */

const ReorderInputSchema = z.object({
  direction: z.enum(["up", "down"]),
});

export async function adminHomepageBlockRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): HomepageService {
    return fastify.diContainer.resolve<HomepageService>("homepageService");
  }

  // ── GET /admin/homepage-blocks ────────────────────────────────────────────
  // Returns ALL blocks including inactive (admin CMS page needs to show them all).
  fastify.get("/admin/homepage-blocks", async (_request, reply) => {
    const service = getService();
    const blocks = await service.listBlocksForAdmin();
    return reply.send({ success: true, data: { blocks } });
  });

  // ── POST /admin/homepage-blocks ───────────────────────────────────────────
  fastify.post("/admin/homepage-blocks", async (request, reply) => {
    const body = CreateHomepageBlockInputSchema.parse(request.body);
    const service = getService();
    await service.createBlock(body);
    return reply.status(201).send({ success: true, data: null });
  });

  // ── PATCH /admin/homepage-blocks/:id ─────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/admin/homepage-blocks/:id",
    async (request, reply) => {
      const body = UpdateHomepageBlockInputSchema.parse(request.body);
      const service = getService();
      await service.updateBlock(request.params.id, body);
      return reply.send({ success: true, data: null });
    }
  );

  // ── DELETE /admin/homepage-blocks/:id ─────────────────────────────────────
  fastify.delete<{ Params: { id: string } }>(
    "/admin/homepage-blocks/:id",
    async (request, reply) => {
      const service = getService();
      await service.deleteBlock(request.params.id);
      return reply.send({ success: true, data: null });
    }
  );

  // ── POST /admin/homepage-blocks/:id/reorder ───────────────────────────────
  // Move a block up or down in the sort order.
  fastify.post<{ Params: { id: string } }>(
    "/admin/homepage-blocks/:id/reorder",
    async (request, reply) => {
      const { direction } = ReorderInputSchema.parse(request.body);
      const service = getService();
      await service.reorderBlock(request.params.id, direction);
      return reply.send({ success: true, data: null });
    }
  );
}
