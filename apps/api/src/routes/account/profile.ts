import { z } from "zod";
import { eq } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import { customers } from "../../db/schema/index.js";

/**
 * Customer profile routes — all guarded by requireCustomerAuth.
 *
 * Security guard (T-04-15, AUTH-04):
 *   requireCustomerAuth preHandler verifies the access_token cookie,
 *   checks role === 'customer', and sets request.customerId.
 *   All handlers use request.customerId for ownership scoping.
 *
 * Body validation (T-04-17 / ASVS V5):
 *   Request bodies are validated through inline Zod schemas before reaching
 *   the DB. Invalid payloads throw ZodError → app.ts converts to 400.
 *
 * GET  /account/profile — returns name/email/phone for the authenticated customer
 * PATCH /account/profile — updates name and/or phone
 */

const UpdateProfileInputSchema = z.object({
  name: z.string().min(1).optional(),
  phone: z.string().optional(),
});

export async function accountProfileRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Customer JWT guard — protects ALL routes in this plugin (T-04-15) ────
  fastify.addHook("preHandler", requireCustomerAuth);

  // ── GET /account/profile ──────────────────────────────────────────────────
  // Returns the authenticated customer's profile (name/email/phone).
  // passwordHash is excluded — never exposed in the API response (T-04-09).
  fastify.get("/account/profile", async (request, reply) => {
    const rows = await fastify.db
      .select({
        id: customers.id,
        email: customers.email,
        name: customers.name,
        phone: customers.phone,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      })
      .from(customers)
      .where(eq(customers.id, request.customerId!))
      .limit(1);

    const customer = rows[0];
    if (!customer) {
      return reply.status(404).send({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found" },
      });
    }

    return reply.send({ success: true, data: customer });
  });

  // ── PATCH /account/profile ────────────────────────────────────────────────
  // Partially updates the authenticated customer's name and/or phone.
  // Email updates are intentionally excluded — require separate verification flow.
  fastify.patch("/account/profile", async (request, reply) => {
    const body = UpdateProfileInputSchema.parse(request.body);

    // Build update object from only the provided fields
    const updateValues: { name?: string; phone?: string; updatedAt: Date } = {
      updatedAt: new Date(),
    };
    if (body.name !== undefined) updateValues.name = body.name;
    if (body.phone !== undefined) updateValues.phone = body.phone;

    const rows = await fastify.db
      .update(customers)
      .set(updateValues)
      .where(eq(customers.id, request.customerId!))
      .returning({
        id: customers.id,
        email: customers.email,
        name: customers.name,
        phone: customers.phone,
        createdAt: customers.createdAt,
        updatedAt: customers.updatedAt,
      });

    const updated = rows[0];
    if (!updated) {
      return reply.status(404).send({
        success: false,
        error: { code: "CUSTOMER_NOT_FOUND", message: "Customer not found" },
      });
    }

    return reply.send({ success: true, data: updated });
  });
}
