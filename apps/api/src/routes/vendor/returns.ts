import { z } from "zod";
import { and, desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { ReturnService } from "../../modules/returns/index.js";
import {
  ReturnRequestNotFoundError,
  ReturnNotRejectableError,
} from "../../modules/returns/ReturnService.js";
import { returnRequests, vendorOrders } from "../../db/schema/index.js";

/**
 * Vendor return management routes (VEN-04, D-23).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * T-06-26 mitigation: approve/reject restricted to manager+owner.
 * T-06-28 mitigation: all queries are scoped to the vendorId from JWT.
 *
 * GET  /vendor/returns                      — list vendor's return requests (all roles)
 * POST /vendor/returns/:id/approve          — approve a return (manager+owner)
 * POST /vendor/returns/:id/reject           — reject a return (manager+owner)
 */

const RejectInputSchema = z.object({
  rejectionReason: z.string().min(1),
});

export async function vendorReturnRoutes(fastify: FastifyInstance): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  function getService(): ReturnService {
    return fastify.diContainer.resolve<ReturnService>("returnService");
  }

  // ── GET /vendor/returns ───────────────────────────────────────────────────
  // List return requests for this vendor's orders. Direct DB query scoped to vendorId.
  fastify.get("/vendor/returns", async (request, reply) => {
    const vendorId = getVendorId(request);

    // Query return_requests for vendor orders belonging to this vendor (T-06-28 scoping)
    const rows = await fastify.db
      .select({
        id: returnRequests.id,
        vendorOrderId: returnRequests.vendorOrderId,
        customerId: returnRequests.customerId,
        status: returnRequests.status,
        reason: returnRequests.reason,
        rejectionReason: returnRequests.rejectionReason,
        createdAt: returnRequests.createdAt,
        vendorId: vendorOrders.vendorId,
      })
      .from(returnRequests)
      .innerJoin(vendorOrders, eq(returnRequests.vendorOrderId, vendorOrders.id))
      .where(eq(vendorOrders.vendorId, vendorId))
      .orderBy(desc(returnRequests.createdAt));

    return reply.send({ success: true, data: { returns: rows } });
  });

  // ── POST /vendor/returns/:id/approve ─────────────────────────────────────
  // Approve a return request. Manager + owner only (T-06-26).
  fastify.post<{ Params: { id: string } }>(
    "/vendor/returns/:id/approve",
    async (request, reply) => {
      const role = request.vendorRole;
      if (role !== "manager" && role !== "owner") {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Manager or owner access required" },
        });
      }

      const service = getService();

      try {
        await service.approveReturn(request.params.id);
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof ReturnRequestNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── POST /vendor/returns/:id/reject ───────────────────────────────────────
  // Reject a return request. Manager + owner only (T-06-26).
  fastify.post<{ Params: { id: string } }>(
    "/vendor/returns/:id/reject",
    async (request, reply) => {
      const role = request.vendorRole;
      if (role !== "manager" && role !== "owner") {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Manager or owner access required" },
        });
      }

      const body = RejectInputSchema.parse(request.body);
      const service = getService();

      try {
        await service.rejectReturn(request.params.id, body.rejectionReason);
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof ReturnRequestNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof ReturnNotRejectableError) {
          return reply.status(422).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
