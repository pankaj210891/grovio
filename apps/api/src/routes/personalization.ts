import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { PersonalizationService } from "../modules/personalization/index.js";

/**
 * Personalization routes — Plan 11-05 T5.
 *
 * POST  /products/:id/view                     — record product view (customer auth, rate-limited)
 * GET   /products/recently-viewed              — last 10 distinct viewed products (customer auth)
 * GET   /products/trending                     — trending products (public, Redis-cached 1h)
 * GET   /products/:id/frequently-bought-together — co-purchase products (public, Redis-cached 2h)
 * GET   /products/related/:id                  — related products same cat ±30% (public, Redis-cached 1h)
 * GET   /homepage/personalized                 — 3-section homepage (customer auth, Redis-cached 15min)
 */

export async function personalizationRoutes(fastify: FastifyInstance): Promise<void> {
  function getService(): PersonalizationService {
    return fastify.diContainer.resolve<PersonalizationService>("personalizationService");
  }

  // ── POST /products/:id/view — customer auth ───────────────────────────────
  // Rate-limited: dedup same (customer, product) within 5 minutes.
  fastify.register(async (customerPlugin) => {
    customerPlugin.addHook("preHandler", requireCustomerAuth);

    customerPlugin.post<{ Params: { id: string } }>(
      "/products/:id/view",
      async (request, reply) => {
        const customerId = request.customerId!;
        await getService().recordView(customerId, request.params.id);
        return reply.status(204).send();
      }
    );

    // ── GET /products/recently-viewed — customer auth ─────────────────────
    customerPlugin.get("/products/recently-viewed", async (request, reply) => {
      const customerId = request.customerId!;
      const products = await getService().getRecentlyViewed(customerId);
      return reply.send({ success: true, data: { products } });
    });

    // ── GET /homepage/personalized — customer auth ────────────────────────
    customerPlugin.get("/homepage/personalized", async (request, reply) => {
      const customerId = request.customerId!;
      const data = await getService().getPersonalizedHomepage(customerId);
      return reply.send({ success: true, data });
    });
  });

  // ── GET /products/trending — public ──────────────────────────────────────
  fastify.get("/products/trending", async (_request, reply) => {
    const products = await getService().getTrending();
    return reply.send({ success: true, data: { products } });
  });

  // ── GET /products/:id/frequently-bought-together — public ────────────────
  fastify.get<{ Params: { id: string } }>(
    "/products/:id/frequently-bought-together",
    async (request, reply) => {
      const products = await getService().getFrequentlyBoughtTogether(
        request.params.id
      );
      return reply.send({ success: true, data: { products } });
    }
  );

  // ── GET /products/related/:id — public ───────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/products/related/:id",
    async (request, reply) => {
      const products = await getService().getRelatedProducts(request.params.id);
      return reply.send({ success: true, data: { products } });
    }
  );
}
