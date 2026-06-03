import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { BasketService } from "../modules/basket/index.js";
import { BasketNotFoundError, InsufficientStockError } from "../modules/basket/index.js";

/**
 * Basket routes — guest cookie session + authenticated merge (CHK-01, CHK-02).
 *
 * Guest session cookie:
 *   - Name: `grovio_basket_token` (httpOnly, sameSite: 'lax', path: '/')
 *   - Value: random UUID from BasketService.getOrCreateGuestSession
 *   - Token is cleared on POST /basket/merge (guest basket absorbed into customer basket)
 *
 * Security (T-05-06, D-09):
 *   - GET/add/update/remove: public — reads grovio_basket_token cookie or auth cookie
 *   - POST /basket/merge: requireCustomerAuth — customerId from JWT
 *   - Guest token is httpOnly + random UUID (hard to forge)
 *
 * D-01 / D-09: Basket state is session-keyed (guest or customer), not product-list in localStorage.
 */

/** Runtime guard — throws if requireCustomerAuth did not run. */
function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const AddToBasketInputSchema = z.object({
  productId: z.string().uuid(),
  productVariantId: z.string().uuid().nullable().optional(),
  quantity: z.number().int().min(1).max(100),
});

const UpdateBasketItemInputSchema = z.object({
  quantity: z.number().int().min(1).max(100),
});

// ── basketRoutes plugin ───────────────────────────────────────────────────────

export async function basketRoutes(fastify: FastifyInstance): Promise<void> {
  function getBasketService(): BasketService {
    return fastify.diContainer.resolve<BasketService>("basketService");
  }

  // ── GET /basket ─────────────────────────────────────────────────────────────
  // Returns the current basket for the session (guest or authenticated).
  // Creates a new guest session + sets the httpOnly cookie if absent (D-01/D-09).
  fastify.get("/basket", async (request, reply) => {
    const basketService = getBasketService();

    // Prefer authenticated customer session; fall back to guest token cookie
    const guestToken = request.cookies?.["grovio_basket_token"] ?? undefined;

    try {
      const session = await basketService.getOrCreateGuestSession(guestToken);

      // Set httpOnly cookie if a new token was created (or if cookie was missing)
      if (session.guestToken && session.guestToken !== guestToken) {
        reply.setCookie("grovio_basket_token", session.guestToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30, // 30 days
        });
      }

      const basket = await basketService.getBasket(session.id);
      return reply.send({ success: true, data: basket });
    } catch (err) {
      if (err instanceof BasketNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /basket/items ──────────────────────────────────────────────────────
  // Add an item to the basket (guest or authenticated).
  fastify.post("/basket/items", async (request, reply) => {
    const body = AddToBasketInputSchema.parse(request.body);
    const basketService = getBasketService();

    const guestToken = request.cookies?.["grovio_basket_token"] ?? undefined;

    try {
      // Get or create the session
      const session = await basketService.getOrCreateGuestSession(guestToken);

      // Set cookie if session is new (or token changed)
      if (session.guestToken && session.guestToken !== guestToken) {
        reply.setCookie("grovio_basket_token", session.guestToken, {
          httpOnly: true,
          sameSite: "lax",
          path: "/",
          maxAge: 60 * 60 * 24 * 30,
        });
      }

      const item = await basketService.addItem({
        sessionId: session.id,
        productId: body.productId,
        variantId: body.productVariantId ?? null,
        quantity: body.quantity,
      });

      return reply.status(201).send({ success: true, data: item });
    } catch (err) {
      if (err instanceof InsufficientStockError) {
        return reply.status(409).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof BasketNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── PATCH /basket/items/:id ─────────────────────────────────────────────────
  // Update the quantity of a basket item.
  fastify.patch<{ Params: { id: string } }>(
    "/basket/items/:id",
    async (request, reply) => {
      const body = UpdateBasketItemInputSchema.parse(request.body);
      const basketService = getBasketService();

      try {
        const updated = await basketService.updateItem(request.params.id, body.quantity);

        if (!updated) {
          return reply.status(404).send({
            success: false,
            error: { code: "BASKET_ITEM_NOT_FOUND", message: "Basket item not found" },
          });
        }

        return reply.send({ success: true, data: updated });
      } catch (err) {
        if (err instanceof BasketNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── DELETE /basket/items/:id ────────────────────────────────────────────────
  // Remove an item from the basket.
  fastify.delete<{ Params: { id: string } }>(
    "/basket/items/:id",
    async (request, reply) => {
      const basketService = getBasketService();

      try {
        await basketService.removeItem(request.params.id);
        return reply.status(200).send({ success: true, data: null });
      } catch (err) {
        if (err instanceof BasketNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── POST /basket/merge ──────────────────────────────────────────────────────
  // Merge the guest basket into the authenticated customer's basket (CHK-02).
  // Requires customer JWT. Clears the grovio_basket_token cookie after merge.
  fastify.post(
    "/basket/merge",
    { preHandler: requireCustomerAuth },
    async (request, reply) => {
      const basketService = getBasketService();
      const customerId = getCustomerId(request);
      const guestToken = request.cookies?.["grovio_basket_token"] ?? null;

      if (!guestToken) {
        // No guest basket to merge — return empty/current basket data
        return reply.send({ success: true, data: { merged: false, customerId } });
      }

      try {
        await basketService.mergeGuestBasket(guestToken, customerId);

        // Clear the guest cookie after successful merge (CHK-02)
        reply.clearCookie("grovio_basket_token", { path: "/" });

        return reply.send({ success: true, data: { merged: true, customerId } });
      } catch (err) {
        if (err instanceof BasketNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
