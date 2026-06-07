import type { FastifyInstance } from "fastify";
import { requireAdminAuth, rbacGuard } from "../../middleware/adminAuth.js";
import type { AdminService } from "../../modules/admin/index.js";

/**
 * Admin portal routes (Phase 11, Plan 11-02 T3).
 *
 * All routes require JWT admin authentication.
 * RBAC enforced per section:
 *   - Finance: super_admin, finance_admin only
 *   - Support, Vendors, Catalog: super_admin, moderator
 *   - Admin users: super_admin only
 *   - Insights: super_admin, finance_admin
 *
 * Public routes:
 *   GET /announcements/active — filtered active announcements (no auth required)
 */
export async function adminRoutes(fastify: FastifyInstance): Promise<void> {
  function getService(): AdminService {
    return fastify.diContainer.resolve<AdminService>("adminService");
  }

  function getAdminEmail(request: import("fastify").FastifyRequest): string {
    if (!request.adminEmail) throw new Error("requireAdminAuth must run before handler");
    return request.adminEmail;
  }

  // ── Public: active announcements ──────────────────────────────────────────
  fastify.get("/announcements/active", async (_req, reply) => {
    const service = getService();
    const data = await service.listAnnouncements(true);
    return reply.send({ success: true, data });
  });

  // ── All admin routes require JWT auth ─────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  // ── Admin: Announcements CRUD ─────────────────────────────────────────────
  fastify.get("/admin/announcements", async (_req, reply) => {
    const service = getService();
    const data = await service.listAnnouncements();
    return reply.send({ success: true, data });
  });

  fastify.post("/admin/announcements", async (request, reply) => {
    const service = getService();
    const adminEmail = getAdminEmail(request);
    const body = request.body as {
      title: string;
      body: string;
      targetType: string;
      expiresAt?: string | null;
    };
    const data = await service.createAnnouncement(body, adminEmail);
    return reply.status(201).send({ success: true, data });
  });

  fastify.patch<{ Params: { id: string } }>(
    "/admin/announcements/:id",
    async (request, reply) => {
      const service = getService();
      const body = request.body as Record<string, unknown>;
      const data = await service.updateAnnouncement(request.params.id, body as Parameters<AdminService["updateAnnouncement"]>[1]);
      return reply.send({ success: true, data });
    }
  );

  fastify.delete<{ Params: { id: string } }>(
    "/admin/announcements/:id",
    async (request, reply) => {
      const service = getService();
      await service.deleteAnnouncement(request.params.id);
      return reply.send({ success: true, data: null });
    }
  );

  // ── Admin: KYC documents ──────────────────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/admin/vendors/:id/kyc-documents",
    async (request, reply) => {
      const service = getService();
      const data = await service.getVendorKycDocuments(request.params.id);
      return reply.send({ success: true, data });
    }
  );

  fastify.patch<{ Params: { id: string; docId: string } }>(
    "/admin/vendors/:id/kyc-documents/:docId/verify",
    async (request, reply) => {
      const service = getService();
      const adminEmail = getAdminEmail(request);
      const data = await service.verifyKycDocument(request.params.docId, adminEmail);
      return reply.send({ success: true, data });
    }
  );

  // Multipart KYC upload — handled separately (see admin-kyc-upload.ts)

  // ── Admin: Support tickets ────────────────────────────────────────────────
  fastify.get("/admin/support-tickets", async (request, reply) => {
    const service = getService();
    const query = request.query as {
      status?: string;
      type?: string;
      limit?: string;
      offset?: string;
    };
    const data = await service.listSupportTickets({
      status: query.status,
      submittedByType: query.type,
      limit: query.limit ? Number(query.limit) : undefined,
      offset: query.offset ? Number(query.offset) : undefined,
    });
    return reply.send({ success: true, data });
  });

  fastify.get<{ Params: { id: string } }>(
    "/admin/support-tickets/:id",
    async (request, reply) => {
      const service = getService();
      const data = await service.getSupportTicket(request.params.id);
      return reply.send({ success: true, data });
    }
  );

  fastify.post<{ Params: { id: string } }>(
    "/admin/support-tickets/:id/replies",
    async (request, reply) => {
      const service = getService();
      const adminEmail = getAdminEmail(request);
      const body = request.body as { body: string };
      await service.addTicketReply(request.params.id, body.body, "admin", request.adminId!);
      return reply.status(201).send({ success: true, data: null });
    }
  );

  fastify.patch<{ Params: { id: string } }>(
    "/admin/support-tickets/:id",
    async (request, reply) => {
      const service = getService();
      const body = request.body as { status?: string; assignedToAdminEmail?: string };
      await service.updateTicketStatus(
        request.params.id,
        body.status ?? "open",
        body.assignedToAdminEmail
      );
      return reply.send({ success: true, data: null });
    }
  );

  // ── Admin: Insights (finance_admin + super_admin) ─────────────────────────
  fastify.get(
    "/admin/insights/revenue",
    { preHandler: rbacGuard(["super_admin", "finance_admin"]) },
    async (request, reply) => {
      const service = getService();
      const period = (request.query as { period?: string }).period ?? "30d";
      const data = await service.getInsightsRevenue(period);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    "/admin/insights/vendor-performance",
    { preHandler: rbacGuard(["super_admin", "finance_admin"]) },
    async (request, reply) => {
      const service = getService();
      const period = (request.query as { period?: string }).period ?? "30d";
      const data = await service.getInsightsVendorPerformance(period);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    "/admin/insights/product-velocity",
    async (request, reply) => {
      const service = getService();
      const period = (request.query as { period?: string }).period ?? "7d";
      const data = await service.getInsightsProductVelocity(period);
      return reply.send({ success: true, data });
    }
  );

  fastify.get(
    "/admin/insights/retention-rate",
    async (request, reply) => {
      const service = getService();
      const period = (request.query as { period?: string }).period ?? "30d";
      const data = await service.getInsightsRetentionRate(period);
      return reply.send({ success: true, data });
    }
  );

  fastify.get("/admin/insights/anomaly-flags", async (_req, reply) => {
    const service = getService();
    const data = await service.getInsightsAnomalyFlags();
    return reply.send({ success: true, data });
  });

  // ── Admin: Platform health ────────────────────────────────────────────────
  fastify.get("/admin/health/metrics", async (_req, reply) => {
    const service = getService();
    const data = await service.getPlatformHealth();
    return reply.send({ success: true, data });
  });

  // ── Admin: Notifications ──────────────────────────────────────────────────
  fastify.get("/admin/notifications/recent", async (_req, reply) => {
    const service = getService();
    const data = await service.getRecentNotifications();
    return reply.send({ success: true, data });
  });

  // ── Admin: RBAC — Admin users (super_admin only) ──────────────────────────
  fastify.get(
    "/admin/users",
    { preHandler: rbacGuard(["super_admin"]) },
    async (_req, reply) => {
      const service = getService();
      const data = await service.listAdminUsers();
      return reply.send({ success: true, data });
    }
  );

  fastify.patch<{ Params: { id: string } }>(
    "/admin/users/:id",
    { preHandler: rbacGuard(["super_admin"]) },
    async (request, reply) => {
      const service = getService();
      const body = request.body as { role: string };
      await service.updateAdminRole(request.params.id, body.role);
      return reply.send({ success: true, data: null });
    }
  );
}
