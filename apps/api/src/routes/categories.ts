import type { FastifyInstance } from "fastify";
import type { AttributeDefinitionService } from "../modules/attribute-definitions/index.js";
import type { CategoryMetadataService } from "../modules/category-metadata/index.js";
import type { CategoryService } from "../modules/categories/index.js";
import type { FilterSchemaService } from "../modules/filter-schema/index.js";
import type { ProductTemplateService } from "../modules/product-templates/index.js";
import type { VendorRestrictionService } from "../modules/vendor-restrictions/index.js";

/**
 * Public category read routes — Phase 4 storefront contract surfaces.
 *
 * GET /categories                    → full nested tree (Redis-cached, CAT-01)
 * GET /categories/:id                → single category detail (CAT-01)
 * GET /categories/:id/attributes     → attribute definitions for category (CAT-03)
 * GET /categories/:id/filters        → filter schema for category (CAT-04)
 * GET /categories/:id/template       → product template for category (CAT-05)
 * GET /categories/:id/metadata       → SEO + merchandising metadata (CAT-07)
 * GET /categories/:id/restrictions   → vendor restriction status (CAT-06)
 *
 * All handlers resolve services via fastify.diContainer.resolve() inside the handler
 * to avoid holding stale references across reloads (Fastify DI resolution pattern).
 *
 * Response envelope: { success: true, data: { ... } } per @grovio/contracts ApiSuccess.
 * Error envelope:    { success: false, error: { code, message } } for 404s.
 */
export async function categoryRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /categories ──────────────────────────────────────────────────────
  // Returns the full nested category tree. Redis-cached (CAT-01, D-03).
  fastify.get("/categories", async (_request, reply) => {
    const categoryService =
      fastify.diContainer.resolve<CategoryService>("categoryService");
    const tree = await categoryService.getTree();
    return reply.send({ success: true, data: { tree } });
  });

  // ── GET /categories/:id ──────────────────────────────────────────────────
  // Returns a single category row by UUID. 404 if not found (CAT-01).
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id",
    async (request, reply) => {
      const categoryService =
        fastify.diContainer.resolve<CategoryService>("categoryService");
      const category = await categoryService.getCategoryById(
        request.params.id
      );
      if (!category) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "CATEGORY_NOT_FOUND",
            message: "Category not found",
          },
        });
      }
      return reply.send({ success: true, data: category });
    }
  );

  // ── GET /categories/:id/attributes ──────────────────────────────────────
  // Returns all attribute definitions for a category (CAT-03).
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id/attributes",
    async (request, reply) => {
      const attributeDefinitionService =
        fastify.diContainer.resolve<AttributeDefinitionService>(
          "attributeDefinitionService"
        );
      const attributes = await attributeDefinitionService.getAttributesByCategory(
        request.params.id
      );
      return reply.send({ success: true, data: { attributes } });
    }
  );

  // ── GET /categories/:id/filters ──────────────────────────────────────────
  // Returns the filter schema for a category (CAT-04).
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id/filters",
    async (request, reply) => {
      const filterSchemaService =
        fastify.diContainer.resolve<FilterSchemaService>("filterSchemaService");
      const filters = await filterSchemaService.getFilterSchema(
        request.params.id
      );
      return reply.send({ success: true, data: { filters } });
    }
  );

  // ── GET /categories/:id/template ─────────────────────────────────────────
  // Returns the product template for a category, or null if none (CAT-05).
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id/template",
    async (request, reply) => {
      const productTemplateService =
        fastify.diContainer.resolve<ProductTemplateService>(
          "productTemplateService"
        );
      const template = await productTemplateService.getTemplate(
        request.params.id
      );
      return reply.send({ success: true, data: { template } });
    }
  );

  // ── GET /categories/:id/metadata ─────────────────────────────────────────
  // Returns SEO + merchandising metadata for a category, or null (CAT-07).
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id/metadata",
    async (request, reply) => {
      const categoryMetadataService =
        fastify.diContainer.resolve<CategoryMetadataService>(
          "categoryMetadataService"
        );
      const metadata = await categoryMetadataService.getMetadata(
        request.params.id
      );
      return reply.send({ success: true, data: { metadata } });
    }
  );

  // ── GET /categories/:id/restrictions ─────────────────────────────────────
  // Returns vendor restriction status for a category (CAT-06).
  // isRestricted: whether the category requires vendor approval.
  // approvedVendorIds: list of UUIDs approved to sell in this category.
  fastify.get<{ Params: { id: string } }>(
    "/categories/:id/restrictions",
    async (request, reply) => {
      const vendorRestrictionService =
        fastify.diContainer.resolve<VendorRestrictionService>(
          "vendorRestrictionService"
        );
      const { id } = request.params;
      const [isRestricted, approvedVendorIds] = await Promise.all([
        vendorRestrictionService.isCategoryRestricted(id),
        vendorRestrictionService.getRestrictions(id),
      ]);
      return reply.send({
        success: true,
        data: { isRestricted, approvedVendorIds },
      });
    }
  );
}
