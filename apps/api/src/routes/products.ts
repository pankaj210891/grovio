import { z } from "zod";
import { and, eq, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import type { ProductService } from "../modules/catalog/index.js";
import { products } from "../db/schema/index.js";

/**
 * Public storefront product routes.
 *
 * GET /products/:slug                    — full product detail for the PDP (STORE-04)
 * GET /serviceability?pincode=XXX        — pincode serviceability check (Phase 11 T9, D-22)
 * GET /products/recommendations/cart     — cart-contextual product recommendations (Phase 11 T9)
 *
 * Returns product + variants + images + category attributes + vendor name.
 * Only approved products are visible (status filter in ProductService).
 */
export default async function productsRoutes(fastify: FastifyInstance) {
  // ── GET /serviceability ──────────────────────────────────────────────────
  // Pincode serviceability check for the PDP delivery estimator (Phase 11 T9, D-22).
  //
  // Stub implementation: all pincodes are serviceable with a 3–5 day estimate.
  // Wave 5a will integrate the logistics provider API (India Post / Shiprocket) for
  // real serviceability data. The endpoint shape is stable; only the body changes.
  //
  // Security: pincode is validated as a 6-digit numeric string. No auth required.
  fastify.get<{ Querystring: { pincode: string } }>(
    "/serviceability",
    async (request, reply) => {
      const ServiceabilityQuerySchema = z.object({
        pincode: z.string().regex(/^\d{6}$/, "Pincode must be exactly 6 digits"),
      });

      const parsed = ServiceabilityQuerySchema.safeParse(request.query);
      if (!parsed.success) {
        return reply.status(400).send({
          success: false,
          error: {
            code: "VALIDATION_ERROR",
            message: "pincode must be exactly 6 digits",
          },
        });
      }

      // Stub: all pincodes serviceable — Wave 5a replaces with real logistics API
      return reply.send({
        success: true,
        data: {
          pincode: parsed.data.pincode,
          serviceable: true,
          estimatedDays: { min: 3, max: 5 },
          message: "Delivery available in 3–5 business days",
        },
      });
    }
  );

  // ── GET /products/recommendations/cart ──────────────────────────────────
  // Cart-contextual product recommendations (Phase 11 T9).
  //
  // Accepts:
  //   category_ids[] — categories already in the cart
  //   exclude_ids[]  — product IDs already in the cart (to avoid duplicates)
  //
  // Returns up to 8 approved products from the same categories, excluding
  // already-carted products. Results are Redis-cached for 30 minutes.
  //
  // When category_ids[] is empty, returns an empty list (client-side guard).
  // Wave 5a will populate basket items with categoryId, enabling this endpoint.
  //
  // Security: no auth required (public product catalog). IDs are UUIDs and
  // are parameterised via Drizzle — no SQL injection risk.
  fastify.get<{ Querystring: { 'category_ids[]'?: string | string[]; 'exclude_ids[]'?: string | string[] } }>(
    "/products/recommendations/cart",
    async (request, reply) => {
      const { redis, db } = fastify;

      // Parse repeated query params (Express-style array syntax)
      const rawCategoryIds = request.query["category_ids[]"];
      const rawExcludeIds = request.query["exclude_ids[]"];

      const categoryIds = rawCategoryIds
        ? (Array.isArray(rawCategoryIds) ? rawCategoryIds : [rawCategoryIds])
        : [];
      const excludeIds = rawExcludeIds
        ? (Array.isArray(rawExcludeIds) ? rawExcludeIds : [rawExcludeIds])
        : [];

      // Guard: empty category context — return nothing (client already disables call)
      if (categoryIds.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      // Validate that IDs are UUID-format to prevent injection
      const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const safeCategories = categoryIds.filter((id) => uuidRegex.test(id));
      const safeExcludes = excludeIds.filter((id) => uuidRegex.test(id));

      if (safeCategories.length === 0) {
        return reply.send({ success: true, data: [] });
      }

      // Cache key: sorted IDs for cache-key stability
      const cacheKey = `cart_recs:${[...safeCategories].sort().join(",")}:${[...safeExcludes].sort().join(",")}`;
      const CACHE_TTL = 30 * 60; // 30 minutes

      try {
        const cached = await redis.get(cacheKey);
        if (cached) {
          return reply.send({ success: true, data: JSON.parse(cached) as unknown });
        }
      } catch {
        // Redis unavailable — continue to DB query
      }

      // Fetch from DB: up to 8 approved products in the requested categories
      // excluding products already in the cart
      const whereConditions = [
        eq(products.status, "approved"),
        sql`${products.categoryId} = ANY(ARRAY[${sql.join(safeCategories.map((id) => sql`${id}::uuid`), sql`, `)}])`,
      ];

      if (safeExcludes.length > 0) {
        whereConditions.push(
          sql`${products.id} NOT IN (${sql.join(safeExcludes.map((id) => sql`${id}::uuid`), sql`, `)})`,
        );
      }

      const rows = await db
        .select({
          id: products.id,
          slug: products.slug,
          name: products.name,
          basePriceMinor: products.basePriceMinor,
          vendorId: products.vendorId,
        })
        .from(products)
        .where(and(...whereConditions))
        .orderBy(sql`RANDOM()`)
        .limit(8);

      // Shape response to match storefront ProductCard expectations
      const recs = rows.map((r) => ({
        id: r.id,
        slug: r.slug,
        name: r.name,
        basePriceMinor: r.basePriceMinor,
        imageUrl: null as string | null, // Phase 11: images require join with product_images; Wave 5a
        vendorName: "", // Phase 11: vendor name requires join; Wave 5a will add it
      }));

      // Cache result
      try {
        await redis.setex(cacheKey, CACHE_TTL, JSON.stringify(recs));
      } catch {
        // Cache write failure — non-fatal
      }

      return reply.send({ success: true, data: recs });
    }
  );

  // ── GET /products/:slug ──────────────────────────────────────────────────
  // Full product detail for the PDP (STORE-04).
  // NOTE: This must be registered AFTER /products/recommendations/cart to prevent
  // :slug matching "recommendations" as a dynamic segment.
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
