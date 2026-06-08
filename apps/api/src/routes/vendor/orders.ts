import { z } from "zod";
import { eq, desc } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { OrderService } from "../../modules/orders/index.js";
import { VendorOrderOwnershipError } from "../../modules/orders/index.js";
import { vendorOrders } from "../../db/schema/index.js";

/**
 * Vendor order routes — all guarded by requireVendorAuth (ORD-05).
 *
 * Security (T-03-W1, T-05-06):
 *   - requireVendorAuth preHandler verifies the Bearer JWT, checks role === 'vendor',
 *     and sets request.vendorId. All routes use request.vendorId for ownership checks.
 *   - updateVendorOrderStatus enforces vendor ownership — vendors cannot touch other
 *     vendors' sub-orders (ORD-05).
 *
 * GET    /vendor/orders              — list vendor's sub-orders (vendor-scoped, ORD-05)
 * PATCH  /vendor/orders/:id/status  — update sub-order status (vendor-scoped, ORD-05)
 */

// ── Input schemas ─────────────────────────────────────────────────────────────

const UpdateVendorOrderStatusInputSchema = z.object({
  status: z.enum(["processing", "shipped", "delivered", "cancelled"]),
});

const BulkShipInputSchema = z.object({
  orders: z.array(
    z.object({
      orderId: z.string().uuid(),
      trackingNumber: z.string().optional(),
    })
  ).min(1),
});

// ── vendorOrderRoutes plugin ──────────────────────────────────────────────────

export async function vendorOrderRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Vendor JWT guard — protects ALL routes in this plugin (T-03-W1) ────────
  fastify.addHook("preHandler", requireVendorAuth);

  function getOrderService(): OrderService {
    return fastify.diContainer.resolve<OrderService>("orderService");
  }

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  // ── GET /vendor/orders ────────────────────────────────────────────────────
  // List vendor's sub-orders. Scoped by vendorId (ORD-05) — vendors only see
  // vendor_orders rows where vendorId matches their JWT claim.
  // Direct DB query via fastify.db for this read-only listing operation.
  fastify.get("/vendor/orders", async (request, reply) => {
    const vendorId = getVendorId(request);

    // Direct DB query scoped to vendorId (ORD-05, T-05-06)
    const orders = await fastify.db
      .select()
      .from(vendorOrders)
      .where(eq(vendorOrders.vendorId, vendorId))
      .orderBy(desc(vendorOrders.createdAt));

    return reply.send({ success: true, data: { orders } });
  });

  // ── PATCH /vendor/orders/:id/status ───────────────────────────────────────
  // Update the status of a vendor sub-order (ORD-05).
  // Ownership-checked: vendorId must own the sub-order.
  fastify.patch<{ Params: { id: string } }>(
    "/vendor/orders/:id/status",
    async (request, reply) => {
      const body = UpdateVendorOrderStatusInputSchema.parse(request.body);
      const orderService = getOrderService();
      const vendorId = getVendorId(request);

      try {
        const updated = await orderService.updateVendorOrderStatus(
          request.params.id,
          vendorId,
          body.status
        );
        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err instanceof VendorOrderOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── PATCH /vendor/orders/:id ─────────────────────────────────────────────
  // Convenience alias for status update (frontend compatibility, Plan 11-03).
  fastify.patch<{ Params: { id: string } }>(
    "/vendor/orders/:id",
    async (request, reply) => {
      const body = UpdateVendorOrderStatusInputSchema.parse(request.body);
      const orderService = getOrderService();
      const vendorId = getVendorId(request);

      try {
        const updated = await orderService.updateVendorOrderStatus(
          request.params.id,
          vendorId,
          body.status
        );
        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err instanceof VendorOrderOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── PATCH /vendor/orders/bulk-ship ───────────────────────────────────────
  // Mark multiple orders as shipped with optional tracking numbers (Plan 11-03, T4).
  // All orders must belong to the authenticated vendor.
  fastify.patch("/vendor/orders/bulk-ship", async (request, reply) => {
    const { orders: shipOrders } = BulkShipInputSchema.parse(request.body);
    const vendorId = getVendorId(request);
    const orderService = getOrderService();

    const results = await Promise.allSettled(
      shipOrders.map(({ orderId }) =>
        orderService.updateVendorOrderStatus(orderId, vendorId, "shipped")
      )
    );

    const failed = results.filter((r) => r.status === "rejected");
    if (failed.length > 0) {
      return reply.status(207).send({
        success: false,
        error: { code: "PARTIAL_FAILURE", message: `${failed.length} of ${shipOrders.length} orders failed to update` },
        data: { shipped: results.length - failed.length, failed: failed.length },
      });
    }

    return reply.send({
      success: true,
      data: { shipped: results.length, failed: 0 },
    });
  });
}
