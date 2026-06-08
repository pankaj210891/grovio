import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { InvoiceService } from "../../modules/orders/index.js";
import {
  InvoiceOrderNotFoundError,
  InvoiceOrderOwnershipError,
} from "../../modules/orders/index.js";

/**
 * Invoice download routes — Plan 11-05 T7.
 *
 * GET  /orders/:id/invoice        — customer downloads their order invoice (customer auth)
 * GET  /admin/orders/:id/invoice  — admin downloads any order invoice (admin auth)
 *
 * Streams the PDF buffer as application/pdf with Content-Disposition: attachment.
 */

export async function invoiceRoutes(fastify: FastifyInstance): Promise<void> {
  function getService(): InvoiceService {
    return fastify.diContainer.resolve<InvoiceService>("invoiceService");
  }

  // ── GET /orders/:id/invoice — customer auth ───────────────────────────────
  fastify.register(async (customerPlugin) => {
    customerPlugin.addHook("preHandler", requireCustomerAuth);

    customerPlugin.get<{ Params: { id: string } }>(
      "/orders/:id/invoice",
      async (request, reply) => {
        const customerId = request.customerId!;
        const orderId = request.params.id;

        try {
          const pdfBuffer = await getService().generateInvoicePdf(orderId, customerId);

          return reply
            .header("Content-Type", "application/pdf")
            .header("Content-Disposition", `attachment; filename="invoice-${orderId}.pdf"`)
            .header("Content-Length", pdfBuffer.length)
            .send(pdfBuffer);
        } catch (err) {
          if (err instanceof InvoiceOrderNotFoundError) {
            return reply.status(404).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          if (err instanceof InvoiceOrderOwnershipError) {
            return reply.status(403).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          throw err;
        }
      }
    );
  });

  // ── GET /admin/orders/:id/invoice — admin auth ────────────────────────────
  // Admin can download any order's invoice — no ownership check (customerId = null).
  fastify.register(async (adminPlugin) => {
    adminPlugin.addHook("preHandler", requireAdminAuth);

    adminPlugin.get<{ Params: { id: string } }>(
      "/admin/orders/:id/invoice",
      async (request, reply) => {
        const orderId = request.params.id;

        try {
          // null customerId = admin bypass (no ownership check)
          const pdfBuffer = await getService().generateInvoicePdf(orderId, null);

          return reply
            .header("Content-Type", "application/pdf")
            .header("Content-Disposition", `attachment; filename="invoice-${orderId}.pdf"`)
            .header("Content-Length", pdfBuffer.length)
            .send(pdfBuffer);
        } catch (err) {
          if (err instanceof InvoiceOrderNotFoundError) {
            return reply.status(404).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          throw err;
        }
      }
    );
  });
}
