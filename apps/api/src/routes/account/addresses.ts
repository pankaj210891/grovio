import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import {
  type CustomerAddressService,
} from "../../modules/customer-addresses/index.js";

/**
 * Customer address CRUD routes — all guarded by requireCustomerAuth.
 *
 * Security guard (T-04-15, AUTH-05):
 *   requireCustomerAuth preHandler verifies the access_token cookie,
 *   checks role === 'customer', and sets request.customerId.
 *   Every service call passes request.customerId — AUTH-05 isolation is enforced
 *   at the service layer (addresses scoped to owning customer only).
 *
 * Body validation (T-04-17 / ASVS V5):
 *   Request bodies are validated through inline Zod schemas before reaching
 *   the service. Invalid payloads throw ZodError → app.ts converts to 400.
 *
 * GET    /account/addresses         — list all addresses for the customer
 * POST   /account/addresses         — create a new address
 * PATCH  /account/addresses/:id     — update a specific address (ownership-scoped)
 * DELETE /account/addresses/:id     — delete a specific address (ownership-scoped)
 */

const CreateAddressInputSchema = z.object({
  street: z.string().min(1),
  city: z.string().min(1),
  state: z.string().min(1),
  pincode: z.string().min(1),
  country: z.string().min(1),
  label: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  placeId: z.string().nullable().optional(),
  isDefault: z.boolean().optional().default(false),
});

const UpdateAddressInputSchema = z.object({
  street: z.string().min(1).optional(),
  city: z.string().min(1).optional(),
  state: z.string().min(1).optional(),
  pincode: z.string().min(1).optional(),
  country: z.string().min(1).optional(),
  label: z.string().nullable().optional(),
  lat: z.number().nullable().optional(),
  lng: z.number().nullable().optional(),
  placeId: z.string().nullable().optional(),
  isDefault: z.boolean().optional(),
});

export async function accountAddressRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Customer JWT guard — protects ALL routes in this plugin (T-04-15) ────
  fastify.addHook("preHandler", requireCustomerAuth);

  // ── Helper: resolve service inside handler ────────────────────────────────
  function getAddressService(): CustomerAddressService {
    return fastify.diContainer.resolve<CustomerAddressService>("customerAddressService");
  }

  // ── GET /account/addresses ────────────────────────────────────────────────
  // Returns all addresses belonging to the authenticated customer (AUTH-05).
  fastify.get("/account/addresses", async (request, reply) => {
    const addressService = getAddressService();
    const addresses = await addressService.listAddresses(request.customerId!);
    return reply.send({ success: true, data: { addresses } });
  });

  // ── POST /account/addresses ───────────────────────────────────────────────
  // Creates a new address for the authenticated customer (AUTH-05).
  // customerId is from the auth cookie — customers cannot create addresses
  // under another customer's account.
  fastify.post("/account/addresses", async (request, reply) => {
    const body = CreateAddressInputSchema.parse(request.body);
    const addressService = getAddressService();

    const address = await addressService.createAddress(request.customerId!, {
      street: body.street,
      city: body.city,
      state: body.state,
      pincode: body.pincode,
      country: body.country,
      label: body.label ?? null,
      lat: body.lat ?? null,
      lng: body.lng ?? null,
      placeId: body.placeId ?? null,
      isDefault: body.isDefault,
    });

    return reply.status(201).send({ success: true, data: address });
  });

  // ── PATCH /account/addresses/:id ──────────────────────────────────────────
  // Partially updates an existing address. The WHERE clause in the service scopes
  // both id AND customerId — customers cannot edit another customer's address (AUTH-05).
  fastify.patch<{ Params: { id: string } }>(
    "/account/addresses/:id",
    async (request, reply) => {
      const body = UpdateAddressInputSchema.parse(request.body);
      const addressService = getAddressService();

      const updated = await addressService.updateAddress(
        request.params.id,
        request.customerId!,
        body
      );

      if (!updated) {
        return reply.status(404).send({
          success: false,
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      return reply.send({ success: true, data: updated });
    }
  );

  // ── DELETE /account/addresses/:id ─────────────────────────────────────────
  // Deletes an address. The WHERE clause in the service scopes both id AND
  // customerId — customers cannot delete another customer's address (AUTH-05).
  fastify.delete<{ Params: { id: string } }>(
    "/account/addresses/:id",
    async (request, reply) => {
      const addressService = getAddressService();

      const deleted = await addressService.deleteAddress(
        request.params.id,
        request.customerId!
      );

      if (!deleted) {
        return reply.status(404).send({
          success: false,
          error: { code: "ADDRESS_NOT_FOUND", message: "Address not found" },
        });
      }

      return reply.status(200).send({ success: true, data: null });
    }
  );
}
