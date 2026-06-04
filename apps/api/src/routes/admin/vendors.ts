import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { VendorManagementService } from "../../modules/vendor-management/index.js";
import {
  ConfigureVendorInputSchema,
} from "@grovio/contracts/admin/vendors";

/**
 * Admin vendor management routes (ADM-02, D-17).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation — no X-Internal-Admin-Token).
 *
 * GET  /admin/vendors                     — paginated vendor list with GMV + product count
 * POST /admin/vendors/:id/approve         — set onboarding_status='approved'
 * POST /admin/vendors/:id/suspend         — set onboarding_status='suspended'
 * POST /admin/vendors/:id/reinstate       — set onboarding_status='approved' from suspended
 * PATCH /admin/vendors/:id/configure      — replace restrictions + commission override
 *
 * adminEmail from JWT (request.adminEmail) is passed to service mutations for audit log.
 */

export async function adminVendorRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin JWT guard — protects ALL routes in this plugin ──────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): VendorManagementService {
    return fastify.diContainer.resolve<VendorManagementService>(
      "vendorManagementService"
    );
  }

  function getAdminEmail(request: import("fastify").FastifyRequest): string {
    if (!request.adminEmail) {
      throw new Error("requireAdminAuth must run before this handler");
    }
    return request.adminEmail;
  }

  // ── GET /admin/vendors ─────────────────────────────────────────────────────
  // Paginated vendor list.
  fastify.get("/admin/vendors", async (request, reply) => {
    const query = request.query as { limit?: string; offset?: string };
    const limit = Math.min(Math.max(1, Number(query.limit) || 50), 100);
    const offset = Math.max(0, Number(query.offset) || 0);

    const service = getService();
    const result = await service.listVendors({ limit, offset });
    return reply.send({ success: true, data: result });
  });

  // ── POST /admin/vendors/:id/approve ───────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/admin/vendors/:id/approve",
    async (request, reply) => {
      const service = getService();
      const adminEmail = getAdminEmail(request);
      await service.approveVendor(request.params.id, adminEmail, request.ip);
      return reply.send({ success: true, data: null });
    }
  );

  // ── POST /admin/vendors/:id/suspend ───────────────────────────────────────
  const SuspendInputSchema = z.object({ reason: z.string().optional() });
  fastify.post<{ Params: { id: string } }>(
    "/admin/vendors/:id/suspend",
    async (request, reply) => {
      SuspendInputSchema.parse(request.body ?? {});
      const service = getService();
      const adminEmail = getAdminEmail(request);
      await service.suspendVendor(request.params.id, adminEmail, request.ip);
      return reply.send({ success: true, data: null });
    }
  );

  // ── POST /admin/vendors/:id/reinstate ─────────────────────────────────────
  fastify.post<{ Params: { id: string } }>(
    "/admin/vendors/:id/reinstate",
    async (request, reply) => {
      const service = getService();
      const adminEmail = getAdminEmail(request);
      await service.reinstateVendor(request.params.id, adminEmail, request.ip);
      return reply.send({ success: true, data: null });
    }
  );

  // ── PATCH /admin/vendors/:id/configure ────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/admin/vendors/:id/configure",
    async (request, reply) => {
      const body = ConfigureVendorInputSchema.parse(request.body);
      const service = getService();
      const adminEmail = getAdminEmail(request);
      await service.configureVendor(request.params.id, body, adminEmail);
      return reply.send({ success: true, data: null });
    }
  );
}
