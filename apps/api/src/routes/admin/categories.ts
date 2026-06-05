import {
  CreateCategoryInputSchema,
  CreateAttributeInputSchema,
  UpsertFilterSchemaInputSchema,
  UpsertTemplateInputSchema,
  UpsertMetadataInputSchema,
  UpdateCategoryInputSchema,
} from "@grovio/contracts";
import type { FastifyInstance } from "fastify";
import { z, ZodError } from "zod";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { AttributeDefinitionService } from "../../modules/attribute-definitions/index.js";
import type { CategoryMetadataService } from "../../modules/category-metadata/index.js";
import { CategoryDepthError } from "../../modules/categories/CategoryService.js";
import type { CategoryService } from "../../modules/categories/index.js";
import type { FilterSchemaService } from "../../modules/filter-schema/index.js";
import type { ProductTemplateService } from "../../modules/product-templates/index.js";
import type { VendorRestrictionService } from "../../modules/vendor-restrictions/index.js";

/**
 * Admin category mutation routes — guarded write surfaces (CAT-01 through CAT-07 write).
 *
 * Security guard (Phase 6 — T-06-25 mitigation):
 *   All admin routes are protected by requireAdminAuth — the Phase 2/3 X-Internal-Admin-Token
 *   placeholder has been replaced. requireAdminAuth validates a JWT (HS256 with JWT_SECRET)
 *   and checks that role === "admin". On success, populates request.adminId and request.adminEmail.
 *
 * Body validation (T-02-16 / ASVS V5):
 *   Every admin route validates its request body through the corresponding
 *   @grovio/contracts Zod schema via `.parse(request.body)` before reaching the service.
 *   Zod parse failures propagate as thrown ZodErrors which Fastify's error handler
 *   converts to 400 responses.
 *
 * Error mapping (T-02-17):
 *   - CategoryDepthError → 422 with { code: "CATEGORY_DEPTH_EXCEEDED", message }
 *   - Other errors → re-thrown for app.ts error handler (suppresses raw messages in prod)
 */
export async function adminCategoryRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Admin JWT guard (Phase 6 — Pitfall 2 mitigation, T-06-25) ─────────────
  // Replaces the X-Internal-Admin-Token placeholder used in Phases 2/3.
  // requireAdminAuth validates a signed JWT and rejects all non-admin tokens.
  fastify.addHook("preHandler", requireAdminAuth);

  // ── POST /admin/categories ────────────────────────────────────────────────
  // Create a new category. Returns 201 on success, 422 on depth violation (CAT-01).
  fastify.post("/admin/categories", async (request, reply) => {
    const body = CreateCategoryInputSchema.parse(request.body);
    const categoryService =
      fastify.diContainer.resolve<CategoryService>("categoryService");
    try {
      const created = await categoryService.createCategory(body);
      return reply.status(201).send({ success: true, data: created });
    } catch (err) {
      if (err instanceof CategoryDepthError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err; // re-throw — app.ts error handler catches it (T-02-17)
    }
  });

  // ── PATCH /admin/categories/:id ───────────────────────────────────────────
  // Partial update of a category's mutable fields.
  fastify.patch<{ Params: { id: string } }>(
    "/admin/categories/:id",
    async (request, reply) => {
      const body = UpdateCategoryInputSchema.parse(request.body);
      const categoryService =
        fastify.diContainer.resolve<CategoryService>("categoryService");
      const updated = await categoryService.updateCategory(
        request.params.id,
        body
      );
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: "CATEGORY_NOT_FOUND", message: "Category not found" },
        });
      }
      return reply.send({ success: true, data: updated });
    }
  );

  // ── POST /admin/categories/:id/archive ────────────────────────────────────
  // Soft-delete a category (sets archivedAt). Preserves FK references.
  fastify.post<{ Params: { id: string } }>(
    "/admin/categories/:id/archive",
    async (request, reply) => {
      const categoryService =
        fastify.diContainer.resolve<CategoryService>("categoryService");
      const archived = await categoryService.archiveCategory(request.params.id);
      if (!archived) {
        return reply.status(404).send({
          success: false,
          error: { code: "CATEGORY_NOT_FOUND", message: "Category not found" },
        });
      }
      return reply.send({ success: true, data: archived });
    }
  );

  // ── POST /admin/categories/:id/reorder ────────────────────────────────────
  // Reorder siblings by providing the new ordered array of category IDs.
  const ReorderInputSchema = z.object({ orderedIds: z.array(z.string().uuid()) });
  fastify.post<{ Params: { id: string }; Body: { orderedIds: string[] } }>(
    "/admin/categories/:id/reorder",
    async (request, reply) => {
      const { orderedIds } = ReorderInputSchema.parse(request.body);
      const categoryService =
        fastify.diContainer.resolve<CategoryService>("categoryService");
      await categoryService.reorderCategories(request.params.id, orderedIds);
      return reply.send({ success: true, data: null });
    }
  );

  // ── POST /admin/categories/:id/attributes ─────────────────────────────────
  // Add a new attribute definition to a category (CAT-03).
  fastify.post<{ Params: { id: string } }>(
    "/admin/categories/:id/attributes",
    async (request, reply) => {
      const body = CreateAttributeInputSchema.parse(request.body);
      const attributeDefinitionService =
        fastify.diContainer.resolve<AttributeDefinitionService>(
          "attributeDefinitionService"
        );
      const created = await attributeDefinitionService.createAttribute({
        ...body,
        categoryId: request.params.id,
      });
      return reply.status(201).send({ success: true, data: created });
    }
  );

  // ── PATCH /admin/categories/:id/attributes/:attrId ────────────────────────
  // Partial update of an attribute definition.
  fastify.patch<{ Params: { id: string; attrId: string } }>(
    "/admin/categories/:id/attributes/:attrId",
    async (request, reply) => {
      const attributeDefinitionService =
        fastify.diContainer.resolve<AttributeDefinitionService>(
          "attributeDefinitionService"
        );
      const updated = await attributeDefinitionService.updateAttribute(
        request.params.attrId,
        request.body as Parameters<
          typeof attributeDefinitionService.updateAttribute
        >[1]
      );
      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "ATTRIBUTE_NOT_FOUND",
            message: "Attribute definition not found",
          },
        });
      }
      return reply.send({ success: true, data: updated });
    }
  );

  // ── DELETE /admin/categories/:id/attributes/:attrId ───────────────────────
  // Hard-delete an attribute definition (safe in Phase 2, no product FKs).
  fastify.delete<{ Params: { id: string; attrId: string } }>(
    "/admin/categories/:id/attributes/:attrId",
    async (request, reply) => {
      const attributeDefinitionService =
        fastify.diContainer.resolve<AttributeDefinitionService>(
          "attributeDefinitionService"
        );
      const deleted = await attributeDefinitionService.deleteAttribute(
        request.params.attrId
      );
      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: {
            code: "ATTRIBUTE_NOT_FOUND",
            message: "Attribute definition not found",
          },
        });
      }
      return reply.send({ success: true, data: deleted });
    }
  );

  // ── POST /admin/categories/:id/attributes/reorder ─────────────────────────
  // Reorder attribute definitions within a category.
  const AttributeReorderInputSchema = z.object({ orderedIds: z.array(z.string().uuid()) });
  fastify.post<{ Params: { id: string }; Body: { orderedIds: string[] } }>(
    "/admin/categories/:id/attributes/reorder",
    async (request, reply) => {
      const { orderedIds } = AttributeReorderInputSchema.parse(request.body);
      const attributeDefinitionService =
        fastify.diContainer.resolve<AttributeDefinitionService>(
          "attributeDefinitionService"
        );
      await attributeDefinitionService.reorderAttributes(
        request.params.id,
        orderedIds
      );
      return reply.send({ success: true, data: null });
    }
  );

  // ── PUT /admin/categories/:id/filters ─────────────────────────────────────
  // Replace the entire filter schema for a category (CAT-04).
  fastify.put<{ Params: { id: string } }>(
    "/admin/categories/:id/filters",
    async (request, reply) => {
      const body = UpsertFilterSchemaInputSchema.parse(request.body);
      const filterSchemaService =
        fastify.diContainer.resolve<FilterSchemaService>("filterSchemaService");
      const result = await filterSchemaService.replaceFilterSchema(
        request.params.id,
        body.filters.map((f) => ({
          categoryId: request.params.id,
          attributeDefId: f.attributeDefId,
          displayType: f.displayType,
          sortOrder: f.sortOrder,
        }))
      );
      return reply.send({ success: true, data: { filters: result } });
    }
  );

  // ── PUT /admin/categories/:id/template ────────────────────────────────────
  // Create or replace the product template for a category (CAT-05).
  fastify.put<{ Params: { id: string } }>(
    "/admin/categories/:id/template",
    async (request, reply) => {
      const body = UpsertTemplateInputSchema.parse(request.body);
      const productTemplateService =
        fastify.diContainer.resolve<ProductTemplateService>(
          "productTemplateService"
        );
      const result = await productTemplateService.upsertTemplate(
        request.params.id,
        body.templateFields
      );
      return reply.send({ success: true, data: result });
    }
  );

  // ── PUT /admin/categories/:id/metadata ────────────────────────────────────
  // Create or update category metadata (SEO + merchandising blocks) (CAT-07).
  // CategoryMetadataService runs Zod block validation before any DB write (T-02-12).
  // If MerchandisingBlockSchema.array().parse() fails, we map to a 400.
  fastify.put<{ Params: { id: string } }>(
    "/admin/categories/:id/metadata",
    async (request, reply) => {
      const body = UpsertMetadataInputSchema.parse(request.body);
      const categoryMetadataService =
        fastify.diContainer.resolve<CategoryMetadataService>(
          "categoryMetadataService"
        );
      try {
        const result = await categoryMetadataService.upsertMetadata(
          request.params.id,
          body
        );
        return reply.send({ success: true, data: result });
      } catch (err) {
        // Map Zod errors from block validation to 400 (T-02-12 / Pitfall 5).
        if (err instanceof ZodError) {
          return reply.status(400).send({
            success: false,
            error: {
              code: "INVALID_BLOCKS",
              message: err.message,
            },
          });
        }
        throw err; // re-throw other errors (T-02-17)
      }
    }
  );

  // ── POST /admin/categories/:id/restrictions/vendors ───────────────────────
  // Approve a vendor to sell in a restricted category (CAT-06).
  const AddVendorInputSchema = z.object({
    vendorId: z.string().uuid(),
    // createdByAdminId is optional in Phase 2 (no real auth yet — Phase 4 derives
    // this from the JWT sub claim). uuid() validates format when present.
    createdByAdminId: z.string().uuid().optional(),
  });
  fastify.post<{ Params: { id: string }; Body: { vendorId: string; createdByAdminId?: string } }>(
    "/admin/categories/:id/restrictions/vendors",
    async (request, reply) => {
      const { vendorId, createdByAdminId } = AddVendorInputSchema.parse(request.body);
      const vendorRestrictionService =
        fastify.diContainer.resolve<VendorRestrictionService>(
          "vendorRestrictionService"
        );
      const result = await vendorRestrictionService.addVendorToCategory({
        categoryId: request.params.id,
        vendorId,
        // Phase 2: no real auth; createdByAdminId is a placeholder UUID until
        // Phase 4 JWT provides the real admin sub claim.
        createdByAdminId: createdByAdminId ?? "00000000-0000-0000-0000-000000000000",
      });
      return reply.status(201).send({ success: true, data: result });
    }
  );

  // ── DELETE /admin/categories/:id/restrictions/vendors/:vendorId ───────────
  // Remove a vendor's approval for a category (idempotent) (CAT-06).
  fastify.delete<{ Params: { id: string; vendorId: string } }>(
    "/admin/categories/:id/restrictions/vendors/:vendorId",
    async (request, reply) => {
      const vendorRestrictionService =
        fastify.diContainer.resolve<VendorRestrictionService>(
          "vendorRestrictionService"
        );
      await vendorRestrictionService.removeVendorFromCategory(
        request.params.id,
        request.params.vendorId
      );
      return reply.send({ success: true, data: null });
    }
  );
}
