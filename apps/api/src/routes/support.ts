import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { SupportService } from "../modules/support/index.js";
import {
  SupportTicketNotFoundError,
  SupportTicketOwnershipError,
} from "../modules/support/index.js";

/**
 * Customer support ticket routes — Plan 11-05 T6.
 *
 * POST  /support/tickets                        — create ticket (customer auth)
 * GET   /account/support-tickets                — list customer's tickets (customer auth)
 * POST  /account/support-tickets/:id/replies    — reply to own ticket (customer auth)
 *
 * Complements admin support ticket management from Wave 2 T3.4.
 */

function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const CreateTicketSchema = z.object({
  subject: z.string().min(1).max(300),
  body: z.string().min(1).max(10000),
});

const ReplySchema = z.object({
  body: z.string().min(1).max(10000),
});

// ── supportRoutes plugin ──────────────────────────────────────────────────────

export async function supportRoutes(fastify: FastifyInstance): Promise<void> {
  // All routes require customer authentication
  fastify.addHook("preHandler", requireCustomerAuth);

  function getService(): SupportService {
    return fastify.diContainer.resolve<SupportService>("supportService");
  }

  // ── POST /support/tickets ─────────────────────────────────────────────────
  fastify.post("/support/tickets", async (request, reply) => {
    const customerId = getCustomerId(request);
    const body = CreateTicketSchema.parse(request.body);

    const result = await getService().createTicket({
      submittedByType: "customer",
      submittedById: customerId,
      subject: body.subject,
      body: body.body,
    });

    return reply.status(201).send({ success: true, data: result });
  });

  // ── GET /account/support-tickets ─────────────────────────────────────────
  fastify.get("/account/support-tickets", async (request, reply) => {
    const customerId = getCustomerId(request);

    const tickets = await getService().listTicketsBySubmitter({
      submittedByType: "customer",
      submittedById: customerId,
    });

    return reply.send({ success: true, data: { tickets } });
  });

  // ── POST /account/support-tickets/:id/replies ─────────────────────────────
  // Customer replies to their own ticket.
  fastify.post<{ Params: { id: string } }>(
    "/account/support-tickets/:id/replies",
    async (request, reply) => {
      const customerId = getCustomerId(request);
      const body = ReplySchema.parse(request.body);

      try {
        const result = await getService().addReply({
          ticketId: request.params.id,
          authorType: "customer",
          authorId: customerId,
          body: body.body,
          ownerType: "customer",
          ownerId: customerId,
        });

        return reply.status(201).send({ success: true, data: result });
      } catch (err) {
        if (err instanceof SupportTicketNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof SupportTicketOwnershipError) {
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
