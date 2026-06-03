import type { FastifyInstance } from "fastify";
import type { ProductService } from "../modules/catalog/index.js";

/**
 * Public storefront product routes.
 *
 * GET /products/:slug — full product detail for the PDP (STORE-04).
 * Returns product + variants + images + category attributes + vendor name.
 * Only approved products are visible (status filter in ProductService).
 */
export default async function productsRoutes(fastify: FastifyInstance) {
  fastify.get<{ Params: { slug: string } }>(
    "/products/:slug",
    async (request, reply) => {
      const productService =
        fastify.diContainer.resolve<ProductService>("productService");

      const result = await productService.getProductBySlug(request.params.slug);

      if (!result) {
        return reply.status(404).send({
          success: false,
          error: { code: "NOT_FOUND", message: "Product not found" },
        });
      }

      return reply.send({ success: true, data: result });
    }
  );
}
