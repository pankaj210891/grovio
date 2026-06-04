import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { AuditService } from "../../modules/audit/index.js";

/**
 * Admin audit log routes (ADM-07, D-13).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET /admin/audit-log — paginated filterable audit log query
 *
 * Supported filters: actorType, action, entityType, from, to, limit, offset.
 * Ordered newest first (createdAt DESC).
 */

const AuditLogQuerySchema = z.object({
  actorType: z.enum(["admin", "vendor", "system"]).optional(),
  action: z.string().optional(),
  entityType: z.string().optional(),
  from: z.string().datetime({ offset: true }).optional(),
  to: z.string().datetime({ offset: true }).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  offset: z.coerce.number().int().min(0).default(0),
});

export async function adminAuditLogRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): AuditService {
    return fastify.diContainer.resolve<AuditService>("auditService");
  }

  // ── GET /admin/audit-log ──────────────────────────────────────────────────
  fastify.get("/admin/audit-log", async (request, reply) => {
    const query = AuditLogQuerySchema.parse(request.query);
    const service = getService();
    const result = await service.query(query);
    return reply.send({ success: true, data: result });
  });
}
