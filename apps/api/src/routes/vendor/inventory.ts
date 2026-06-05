import { z } from "zod";
import { desc, eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireVendorAuth } from "../../middleware/vendorAuth.js";
import type { InventoryService } from "../../modules/inventory/index.js";
import {
  InventoryOwnershipError,
  InventoryItemNotFoundError,
  ProductNotFoundForPricingError,
} from "../../modules/inventory/InventoryService.js";
import { inventoryItems, products } from "../../db/schema/index.js";

/**
 * Vendor inventory routes (VEN-03, D-15).
 *
 * All routes guarded by requireVendorAuth. Data scoped to request.vendorId.
 * T-06-26 mitigation: pricing update is restricted to manager+owner.
 * T-06-28 mitigation: InventoryService enforces vendorId ownership before any update.
 *
 * GET   /vendor/inventory                            — list vendor's inventory (all roles)
 * PATCH /vendor/inventory/:inventoryItemId           — update quantity (staff+manager+owner)
 * PATCH /vendor/products/:productId/pricing          — update price (manager+owner only)
 */

const UpdateInventoryInputSchema = z.object({
  quantityAvailable: z.number().int().min(0),
});

const UpdatePricingInputSchema = z.object({
  basePriceMinor: z.number().int().min(0),
  variantId: z.string().uuid().optional(),
});

export async function vendorInventoryRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireVendorAuth);

  function getVendorId(request: import("fastify").FastifyRequest): string {
    if (!request.vendorId) {
      throw new Error("requireVendorAuth must run before this handler");
    }
    return request.vendorId;
  }

  function getService(): InventoryService {
    return fastify.diContainer.resolve<InventoryService>("inventoryService");
  }

  // ── GET /vendor/inventory ─────────────────────────────────────────────────
  // Combined inventory+product listing scoped to the vendor. Direct DB query
  // (InventoryService only has write/reserve methods — no list method).
  fastify.get("/vendor/inventory", async (request, reply) => {
    const vendorId = getVendorId(request);

    const rows = await fastify.db
      .select({
        inventoryItemId: inventoryItems.id,
        productId: products.id,
        productName: products.name,
        slug: products.slug,
        basePriceMinor: products.basePriceMinor,
        quantityAvailable: inventoryItems.quantityAvailable,
        quantityReserved: inventoryItems.quantityReserved,
        updatedAt: inventoryItems.updatedAt,
      })
      .from(inventoryItems)
      .innerJoin(products, eq(inventoryItems.productId, products.id))
      .where(eq(products.vendorId, vendorId))
      .orderBy(desc(inventoryItems.updatedAt));

    return reply.send({ success: true, data: { items: rows } });
  });

  // ── PATCH /vendor/inventory/:inventoryItemId ──────────────────────────────
  // Update available quantity. Staff, manager, and owner may do this.
  fastify.patch<{ Params: { inventoryItemId: string } }>(
    "/vendor/inventory/:inventoryItemId",
    async (request, reply) => {
      const body = UpdateInventoryInputSchema.parse(request.body);
      const vendorId = getVendorId(request);
      const service = getService();

      try {
        await service.updateInventory(vendorId, request.params.inventoryItemId, {
          quantityAvailable: body.quantityAvailable,
        });
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof InventoryItemNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof InventoryOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── PATCH /vendor/products/:productId/pricing ─────────────────────────────
  // Update base price. Manager + owner only (T-06-26 — staff cannot change prices).
  fastify.patch<{ Params: { productId: string } }>(
    "/vendor/products/:productId/pricing",
    async (request, reply) => {
      // Role guard: manager+owner only
      const role = request.vendorRole;
      if (role !== "manager" && role !== "owner") {
        return reply.status(403).send({
          success: false,
          error: { code: "FORBIDDEN", message: "Manager or owner access required" },
        });
      }

      const body = UpdatePricingInputSchema.parse(request.body);
      const vendorId = getVendorId(request);
      const service = getService();

      try {
        await service.updatePricing(
          vendorId,
          request.params.productId,
          { basePriceMinor: body.basePriceMinor },
          body.variantId
        );
        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof ProductNotFoundForPricingError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof InventoryOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
