import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { CommissionService } from "../../modules/commissions/index.js";
import { CommissionRuleProtectedError } from "../../modules/commissions/CommissionService.js";
import {
  CreateCommissionRuleInputSchema,
  UpdateCommissionRuleInputSchema,
} from "@grovio/contracts/admin/commission-rules";

/**
 * Admin commission rule management routes (ADM-03, D-18).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET    /admin/commission-rules       — three-section list (global + category + vendor overrides)
 * POST   /admin/commission-rules       — create a new category or vendor override
 * PATCH  /admin/commission-rules/:id  — update an existing rule's rate
 * DELETE /admin/commission-rules/:id  — delete a category/vendor override (global rule → 403)
 *
 * CommissionService.deleteRule throws CommissionRuleProtectedError for the global rule (T-06-21).
 * This route maps that error to 403.
 */

export async function adminCommissionRuleRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): CommissionService {
    return fastify.diContainer.resolve<CommissionService>("commissionService");
  }

  function getAdminEmail(request: import("fastify").FastifyRequest): string {
    if (!request.adminEmail) {
      throw new Error("requireAdminAuth must run before this handler");
    }
    return request.adminEmail;
  }

  // ── GET /admin/commission-rules ───────────────────────────────────────────
  fastify.get("/admin/commission-rules", async (_request, reply) => {
    const service = getService();
    const rules = await service.getRules();
    return reply.send({ success: true, data: rules });
  });

  // ── POST /admin/commission-rules ──────────────────────────────────────────
  fastify.post("/admin/commission-rules", async (request, reply) => {
    const body = CreateCommissionRuleInputSchema.parse(request.body);
    const service = getService();
    const adminEmail = getAdminEmail(request);
    await service.createRule(body, adminEmail);
    return reply.status(201).send({ success: true, data: null });
  });

  // ── PATCH /admin/commission-rules/:id ─────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/admin/commission-rules/:id",
    async (request, reply) => {
      const body = UpdateCommissionRuleInputSchema.parse(request.body);
      const service = getService();
      const adminEmail = getAdminEmail(request);
      await service.updateRule(request.params.id, body, adminEmail);
      return reply.send({ success: true, data: null });
    }
  );

  // ── DELETE /admin/commission-rules/:id ────────────────────────────────────
  // Global rule deletions are rejected with 403 (CommissionRuleProtectedError).
  fastify.delete<{ Params: { id: string } }>(
    "/admin/commission-rules/:id",
    async (request, reply) => {
      const service = getService();
      const adminEmail = getAdminEmail(request);

      try {
        await service.deleteRule(request.params.id, adminEmail);
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof CommissionRuleProtectedError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
