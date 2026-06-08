import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { WishlistService } from "../modules/wishlist/index.js";
import { WishlistProductNotFoundError } from "../modules/wishlist/index.js";

/**
 * Wishlist routes — Plan 11-05 T2.
 *
 * POST   /wishlist/:productId              — add product to wishlist (customer auth required)
 * DELETE /wishlist/:productId              — remove product from wishlist (customer auth required)
 * GET    /account/wishlist?page=1&limit=20 — paginated wishlist list (customer auth required)
 * GET    /wishlist/status?productIds=...   — wishlist status map for given IDs (customer auth required)
 *
 * Security: all routes require customer JWT via requireCustomerAuth preHandler.
 * IDOR prevention: customer actions are scoped to request.customerId from JWT.
 */

function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

export async function wishlistRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes in this plugin require customer authentication
  fastify.addHook("preHandler", requireCustomerAuth);

  function getService(): WishlistService {
    return fastify.diContainer.resolve<WishlistService>("wishlistService");
  }

  // ── POST /wishlist/:productId ─────────────────────────────────────────────
  // Upsert: adds product to wishlist or no-ops if already wishlisted.
  // Reads current product price to store in price_at_wishlist_minor.
  fastify.post<{ Params: { productId: string } }>(
    "/wishlist/:productId",
    async (request, reply) => {
      const customerId = getCustomerId(request);
      const { productId } = request.params;

      try {
        const result = await getService().addToWishlist(customerId, productId);
        return reply.status(201).send({ success: true, data: result });
      } catch (err) {
        if (err instanceof WishlistProductNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── DELETE /wishlist/:productId ───────────────────────────────────────────
  // Hard-delete the wishlist row for (customerId, productId). No-op if not wishlisted.
  fastify.delete<{ Params: { productId: string } }>(
    "/wishlist/:productId",
    async (request, reply) => {
      const customerId = getCustomerId(request);
      const { productId } = request.params;

      const result = await getService().removeFromWishlist(customerId, productId);
      return reply.send({ success: true, data: result });
    }
  );

  // ── GET /account/wishlist ─────────────────────────────────────────────────
  // Paginated list of wishlisted products with is_price_dropped flag.
  const WishlistQuerySchema = z.object({
    page: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 1))
      .pipe(z.number().int().min(1)),
    limit: z
      .string()
      .optional()
      .transform((v) => (v ? parseInt(v, 10) : 20))
      .pipe(z.number().int().min(1).max(100)),
  });

  fastify.get("/account/wishlist", async (request, reply) => {
    const customerId = getCustomerId(request);
    const query = WishlistQuerySchema.parse(request.query);

    const result = await getService().listWishlist(
      customerId,
      query.page,
      query.limit
    );

    return reply.send({ success: true, data: result });
  });

  // ── GET /wishlist/status ──────────────────────────────────────────────────
  // Batch wishlist status check for given productIds.
  // Returns { [productId]: boolean } map.
  const WishlistStatusQuerySchema = z.object({
    productIds: z
      .string()
      .min(1, "productIds is required")
      .transform((v) => v.split(",").map((s) => s.trim()).filter(Boolean)),
  });

  fastify.get("/wishlist/status", async (request, reply) => {
    const customerId = getCustomerId(request);

    const query = WishlistStatusQuerySchema.parse(request.query);

    // Guard against excessive batch sizes
    if (query.productIds.length > 100) {
      return reply.status(400).send({
        success: false,
        error: {
          code: "VALIDATION_ERROR",
          message: "Maximum 100 productIds per request",
        },
      });
    }

    const statusMap = await getService().getWishlistStatus(
      customerId,
      query.productIds
    );

    return reply.send({ success: true, data: statusMap });
  });
}
