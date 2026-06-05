import { RejectProductInputSchema } from "@grovio/contracts";
import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import {
  type ProductService,
  ProductStateError,
  ProductNotFoundError,
} from "../../modules/catalog/index.js";

/**
 * Admin product moderation routes — guarded write surfaces (PROD-06).
 *
 * Security guard (Phase 6 — T-06-25 mitigation):
 *   All admin routes are protected by requireAdminAuth — the Phase 2/3 X-Internal-Admin-Token
 *   placeholder has been replaced (Pitfall 2). requireAdminAuth validates a JWT (HS256 with
 *   JWT_SECRET) and checks that role === "admin".
 *
 * Body validation (T-03-W3 / ASVS V5):
 *   reject route validates body through RejectProductInputSchema (rejectionReason required, D-08).
 *   Zod parse failures throw ZodError → app.ts converts to 400.
 *
 * Error mapping (T-03-W4):
 *   - ProductStateError → 422
 *   - ProductNotFoundError → 404
 *   - Other errors → re-thrown to app.ts error handler
 */
export async function adminProductRoutes(
  fastify: FastifyInstance
): Promise<void> {
  // ── Admin JWT guard (Phase 6 — Pitfall 2 mitigation, T-06-25) ─────────────
  // Replaces the X-Internal-Admin-Token placeholder used in Phases 2/3.
  fastify.addHook("preHandler", requireAdminAuth);

  // ── GET /admin/products ───────────────────────────────────────────────────
  // Moderation queue: returns products in pending_review status (PROD-06, D-06).
  // Cursor pagination mirrors vendor list pattern.
  fastify.get("/admin/products", async (request, reply) => {
    const productService =
      fastify.diContainer.resolve<ProductService>("productService");

    const query = request.query as { cursor?: string; limit?: string };
    const rawLimit = Number(query.limit);
    const limit = query.limit && Number.isFinite(rawLimit)
      ? Math.min(Math.max(1, rawLimit), 100)
      : 20;

    const result = await productService.listForModeration(limit, query.cursor);

    return reply.send({
      success: true,
      data: {
        products: result.products,
        nextCursor: result.nextCursor,
      },
    });
  });

  // ── POST /admin/products/:id/approve ─────────────────────────────────────
  // Approve a pending_review product (PROD-06, D-06, D-14).
  fastify.post<{ Params: { id: string } }>(
    "/admin/products/:id/approve",
    async (request, reply) => {
      const productService =
        fastify.diContainer.resolve<ProductService>("productService");

      try {
        const approved = await productService.approveProduct(request.params.id);
        return reply.send({ success: true, data: approved });
      } catch (err) {
        if (err instanceof ProductStateError) {
          return reply.status(422).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof ProductNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err; // re-throw unknowns (T-03-W4)
      }
    }
  );

  // ── POST /admin/products/:id/reject ──────────────────────────────────────
  // Reject a pending_review product with a required rejection reason (PROD-06, D-08).
  // RejectProductInputSchema requires rejectionReason: z.string().min(1) (D-08).
  fastify.post<{ Params: { id: string } }>(
    "/admin/products/:id/reject",
    async (request, reply) => {
      const body = RejectProductInputSchema.parse(request.body);
      const productService =
        fastify.diContainer.resolve<ProductService>("productService");

      try {
        const rejected = await productService.rejectProduct(
          request.params.id,
          body.rejectionReason
        );
        return reply.send({ success: true, data: rejected });
      } catch (err) {
        if (err instanceof ProductStateError) {
          return reply.status(422).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof ProductNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err; // re-throw unknowns (T-03-W4)
      }
    }
  );
}
