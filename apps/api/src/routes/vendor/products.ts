import {
  CreateProductInputSchema,
  UpdateProductInputSchema,
  CreateVariantInputSchema,
  UpdateVariantInputSchema,
  PresignImageInputSchema,
  ConfirmImageUploadInputSchema,
  ReorderImagesInputSchema,
} from "@grovio/contracts";
import type { FastifyInstance, FastifyReply } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import {
  type ImageService,
  type ProductService,
  ProductStateError,
  ProductOwnershipError,
  ProductNotFoundError,
  ProductRestrictionError,
  ProductValidationError,
  ImageLimitError,
  ImageOwnershipError,
  ImageSizeError,
} from "../../modules/catalog/index.js";

/**
 * Vendor product, variant, and image routes — all guarded by requireVendorAuth.
 *
 * Security guard (T-03-W1, V4):
 *   requireVendorAuth preHandler verifies the Bearer JWT, checks role === 'vendor',
 *   and sets request.vendorId. All mutation routes use request.vendorId for
 *   ownership checks — vendors cannot touch other vendors' products.
 *
 * Body validation (T-03-W3 / ASVS V5):
 *   Every route validates its request body through @grovio/contracts Zod schemas.
 *   Zod parse failures throw ZodError → app.ts converts to 400.
 *
 * Error mapping (T-03-W4):
 *   - ProductStateError / ProductValidationError / ImageLimitError / ImageSizeError → 422
 *   - ProductOwnershipError / ProductRestrictionError / ImageOwnershipError → 403
 *   - ProductNotFoundError → 404
 *   - Other errors → re-thrown to app.ts error handler
 */
export async function vendorProductRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Vendor JWT guard — protects ALL routes in this plugin (T-03-W1) ────────
  fastify.addHook("preHandler", requireVendorAuth);

  // ── Helper: resolve services once per handler ────────────────────────────
  function getProductService(): ProductService {
    return fastify.diContainer.resolve<ProductService>("productService");
  }

  function getImageService(): ImageService {
    return fastify.diContainer.resolve<ImageService>("imageService");
  }

  // ── Helper: map domain errors to HTTP status codes ───────────────────────
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  function mapProductError(err: unknown, reply: FastifyReply<any>): unknown {
    if (
      err instanceof ProductStateError ||
      err instanceof ProductValidationError ||
      err instanceof ImageLimitError ||
      err instanceof ImageSizeError
    ) {
      return reply.status(422).send({
        success: false,
        error: { code: (err as { code: string }).code, message: err.message },
      });
    }
    if (
      err instanceof ProductOwnershipError ||
      err instanceof ProductRestrictionError ||
      err instanceof ImageOwnershipError
    ) {
      return reply.status(403).send({
        success: false,
        error: { code: (err as { code: string }).code, message: err.message },
      });
    }
    if (err instanceof ProductNotFoundError) {
      return reply.status(404).send({
        success: false,
        error: { code: err.code, message: err.message },
      });
    }
    throw err; // re-throw unknowns to app.ts (T-03-W4)
  }

  // ── POST /vendor/products ─────────────────────────────────────────────────
  // Create a new product in draft status (D-06, PROD-01).
  fastify.post("/vendor/products", async (request, reply) => {
    const body = CreateProductInputSchema.parse(request.body);
    const productService = getProductService();

    try {
      const created = await productService.createProduct(request.vendorId!, body);
      return reply.status(201).send({ success: true, data: created });
    } catch (err) {
      return mapProductError(err, reply);
    }
  });

  // ── GET /vendor/products ──────────────────────────────────────────────────
  // List vendor's active products with cursor pagination (PROD-02).
  fastify.get("/vendor/products", async (request, reply) => {
    const productService = getProductService();

    const query = request.query as { cursor?: string; limit?: string };
    const rawLimit = Number(query.limit);
    const limit = query.limit && Number.isFinite(rawLimit)
      ? Math.min(Math.max(1, rawLimit), 100)
      : 20;

    let cursor: { createdAt: Date; id: string } | undefined;
    if (query.cursor) {
      try {
        const decoded = JSON.parse(
          Buffer.from(query.cursor, "base64url").toString("utf8")
        ) as { createdAt: string; id: string };
        cursor = { createdAt: new Date(decoded.createdAt), id: decoded.id };
      } catch {
        // Invalid cursor — ignore, start from beginning
      }
    }

    const result = await productService.listVendorProducts(
      request.vendorId!,
      cursor,
      limit
    );

    const nextCursor = result.nextCursor
      ? Buffer.from(JSON.stringify(result.nextCursor)).toString("base64url")
      : null;

    return reply.send({
      success: true,
      data: { products: result.products, nextCursor },
    });
  });

  // ── GET /vendor/products/:id ──────────────────────────────────────────────
  // Retrieve a single vendor product by ID (ownership-scoped).
  fastify.get<{ Params: { id: string } }>(
    "/vendor/products/:id",
    async (request, reply) => {
      const productService = getProductService();

      try {
        const product = await productService.getVendorProductById(
          request.params.id,
          request.vendorId!
        );
        if (!product) {
          return reply.status(404).send({
            success: false,
            error: { code: "PRODUCT_NOT_FOUND", message: "Product not found" },
          });
        }
        return reply.send({ success: true, data: product });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── PATCH /vendor/products/:id ────────────────────────────────────────────
  // Partial update of a product's mutable fields (D-06, PROD-02).
  fastify.patch<{ Params: { id: string } }>(
    "/vendor/products/:id",
    async (request, reply) => {
      const body = UpdateProductInputSchema.parse(request.body);
      const productService = getProductService();

      try {
        const updated = await productService.updateProduct(
          request.params.id,
          request.vendorId!,
          body
        );
        return reply.send({ success: true, data: updated });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── PUT /vendor/products/:id/submit ──────────────────────────────────────
  // Submit a product for review (draft → pending_review or → approved via flag, D-07).
  fastify.put<{ Params: { id: string } }>(
    "/vendor/products/:id/submit",
    async (request, reply) => {
      const productService = getProductService();

      try {
        const updated = await productService.submitProduct(
          request.params.id,
          request.vendorId!
        );
        return reply.send({ success: true, data: updated });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── DELETE /vendor/products/:id/archive ──────────────────────────────────
  // Soft-delete a vendor's product (sets archivedAt — Pitfall 7).
  fastify.delete<{ Params: { id: string } }>(
    "/vendor/products/:id/archive",
    async (request, reply) => {
      const productService = getProductService();

      try {
        const archived = await productService.archiveProduct(
          request.params.id,
          request.vendorId!
        );
        return reply.send({ success: true, data: archived });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // =========================================================================
  // Variant sub-routes
  // =========================================================================

  // ── POST /vendor/products/:id/variants ───────────────────────────────────
  // Add a variant to a product (D-04).
  fastify.post<{ Params: { id: string } }>(
    "/vendor/products/:id/variants",
    async (request, reply) => {
      const body = CreateVariantInputSchema.parse(request.body);
      const productService = getProductService();

      try {
        const variant = await productService.addVariant(
          request.params.id,
          request.vendorId!,
          body
        );
        return reply.status(201).send({ success: true, data: variant });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── PATCH /vendor/products/:id/variants/:variantId ───────────────────────
  // Partial update of a product variant (D-04).
  fastify.patch<{ Params: { id: string; variantId: string } }>(
    "/vendor/products/:id/variants/:variantId",
    async (request, reply) => {
      const body = UpdateVariantInputSchema.parse(request.body);
      const productService = getProductService();

      try {
        const variant = await productService.updateVariant(
          request.params.variantId,
          request.params.id,
          request.vendorId!,
          body
        );
        return reply.send({ success: true, data: variant });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── DELETE /vendor/products/:id/variants/:variantId ──────────────────────
  // Remove a product variant (D-04).
  fastify.delete<{ Params: { id: string; variantId: string } }>(
    "/vendor/products/:id/variants/:variantId",
    async (request, reply) => {
      const productService = getProductService();

      try {
        await productService.deleteVariant(
          request.params.variantId,
          request.params.id,
          request.vendorId!
        );
        return reply.send({ success: true, data: null });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // =========================================================================
  // Image sub-routes
  // =========================================================================

  // ── POST /vendor/products/:id/images/presign ─────────────────────────────
  // Request a presigned S3/R2 upload URL (D-09, D-10, D-11).
  fastify.post<{ Params: { id: string } }>(
    "/vendor/products/:id/images/presign",
    async (request, reply) => {
      const body = PresignImageInputSchema.parse(request.body);
      const imageService = getImageService();

      try {
        // ImageService.generatePresignedUpload(productId, vendorId, input)
        const result = await imageService.generatePresignedUpload(
          request.params.id,
          request.vendorId!,
          body
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── POST /vendor/products/:id/images/confirm ─────────────────────────────
  // Confirm a completed S3/R2 upload and write to product_images (D-12).
  fastify.post<{ Params: { id: string } }>(
    "/vendor/products/:id/images/confirm",
    async (request, reply) => {
      const body = ConfirmImageUploadInputSchema.parse(request.body);
      const imageService = getImageService();

      try {
        // ImageService.confirmUpload(productId, vendorId, input)
        const image = await imageService.confirmUpload(
          request.params.id,
          request.vendorId!,
          body
        );
        return reply.status(201).send({ success: true, data: image });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── PATCH /vendor/products/:id/images/reorder ────────────────────────────
  // Reorder product images by providing an ordered array of image IDs.
  fastify.patch<{ Params: { id: string } }>(
    "/vendor/products/:id/images/reorder",
    async (request, reply) => {
      const body = ReorderImagesInputSchema.parse(request.body);
      const imageService = getImageService();

      try {
        // ImageService.reorderImages(productId, vendorId, orderedImageIds)
        await imageService.reorderImages(
          request.params.id,
          request.vendorId!,
          body.orderedImageIds
        );
        return reply.send({ success: true, data: null });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );

  // ── DELETE /vendor/products/:id/images/:imageId ──────────────────────────
  // Delete a product image (hard-delete from DB; S3 cleanup is async).
  fastify.delete<{ Params: { id: string; imageId: string } }>(
    "/vendor/products/:id/images/:imageId",
    async (request, reply) => {
      const imageService = getImageService();

      try {
        // ImageService.deleteImage(imageId, productId, vendorId)
        await imageService.deleteImage(
          request.params.imageId,
          request.params.id,
          request.vendorId!
        );
        return reply.send({ success: true, data: null });
      } catch (err) {
        return mapProductError(err, reply);
      }
    }
  );
}
