import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import type { OrderService } from "../../modules/orders/index.js";
import { OrderOwnershipError, OrderNotFoundError } from "../../modules/orders/index.js";
import type { ReturnService } from "../../modules/returns/index.js";
import { ReturnNotEligibleError } from "../../modules/returns/index.js";

/**
 * Account order routes — all guarded by requireCustomerAuth (ORD-03, ORD-04, D-08).
 *
 * Security (T-05-06, AUTH-05):
 *   - requireCustomerAuth preHandler on all routes
 *   - getOrderById ownership-checked by customerId — IDOR prevented
 *   - createReturnRequest scoped by customerId from JWT (T-05-06)
 *
 * GET    /account/orders         — list customer's orders (ORD-03)
 * GET    /account/orders/:id     — order detail with vendor sub-orders (ORD-03)
 * POST   /account/orders/:id/return-request — create return request (ORD-04, D-23)
 */

/** Runtime guard — throws if requireCustomerAuth did not run. */
function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const CreateReturnRequestInputSchema = z.object({
  vendorOrderId: z.string().uuid(),
  orderItemIds: z.array(z.string().uuid()).min(1),
  reason: z.string().min(1).max(500),
  refundPreference: z.enum(["wallet", "original"]),
});

// ── accountOrderRoutes plugin ─────────────────────────────────────────────────

export async function accountOrderRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Customer JWT guard — protects ALL routes in this plugin (T-05-06) ────────
  fastify.addHook("preHandler", requireCustomerAuth);

  function getOrderService(): OrderService {
    return fastify.diContainer.resolve<OrderService>("orderService");
  }

  function getReturnService(): ReturnService {
    return fastify.diContainer.resolve<ReturnService>("returnService");
  }

  // ── GET /account/orders ────────────────────────────────────────────────────
  // List all orders for the authenticated customer, most recent first (ORD-03).
  fastify.get("/account/orders", async (request, reply) => {
    const orderService = getOrderService();
    const orders = await orderService.listOrdersForCustomer(getCustomerId(request));
    return reply.send({ success: true, data: { orders } });
  });

  // ── GET /account/orders/:id ────────────────────────────────────────────────
  // Order detail with vendor sub-orders and items. Ownership-checked (D-08, ORD-03).
  fastify.get<{ Params: { id: string } }>(
    "/account/orders/:id",
    async (request, reply) => {
      const orderService = getOrderService();

      try {
        const order = await orderService.getOrderById(
          request.params.id,
          getCustomerId(request)
        );

        if (!order) {
          return reply.status(404).send({
            success: false,
            error: { code: "ORDER_NOT_FOUND", message: "Order not found" },
          });
        }

        return reply.send({ success: true, data: order });
      } catch (err) {
        if (err instanceof OrderOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── POST /account/orders/:id/return-request ────────────────────────────────
  // Create a return request for an order (ORD-04, D-23, T-05-06).
  // Scoped by customerId from JWT — customers cannot create returns for other orders.
  fastify.post<{ Params: { id: string } }>(
    "/account/orders/:id/return-request",
    async (request, reply) => {
      const body = CreateReturnRequestInputSchema.parse(request.body);
      const returnService = getReturnService();

      try {
        const returnRequest = await returnService.createReturnRequest({
          orderId: request.params.id,
          vendorOrderId: body.vendorOrderId,
          customerId: getCustomerId(request),
          orderItemIds: body.orderItemIds,
          reason: body.reason,
          refundPreference: body.refundPreference,
        });

        return reply.status(201).send({ success: true, data: returnRequest });
      } catch (err) {
        if (err instanceof ReturnNotEligibleError) {
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
