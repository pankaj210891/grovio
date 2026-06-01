import { RejectProductInputSchema } from "@grovio/contracts";
import type { FastifyInstance } from "fastify";
import {
  ProductService,
  ProductStateError,
  ProductNotFoundError,
} from "../../modules/catalog/index.js";

/**
 * Admin product moderation routes — guarded write surfaces (PROD-06).
 *
 * Security guard (T-03-W2):
 *   All admin routes are protected by the same preHandler pattern as
 *   admin/categories.ts — X-Internal-Admin-Token header check in production.
 *   The vendor JWT cannot satisfy this guard (separate env var, separate header).
 *
 *   TODO (Phase 4): Replace with JWT middleware using jose and admin role claim (ASVS V4).
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
  // ── Startup assertion: fail fast in production if the admin token is absent ──
  // Mirrors admin/categories.ts exactly (PATTERNS.md Admin Token Guard).
  if (
    process.env["NODE_ENV"] === "production" &&
    !process.env["INTERNAL_ADMIN_TOKEN"]
  ) {
    throw new Error(
      "INTERNAL_ADMIN_TOKEN must be set in production. " +
        "Admin routes cannot start without it."
    );
  }

  // ── Placeholder admin guard (Phase 4 JWT replacement) ───────────────────
  // Copied verbatim from admin/categories.ts lines 58-82 (PATTERNS.md).
  fastify.addHook("preHandler", async (request, reply) => {
    const isProd = process.env["NODE_ENV"] === "production";
    if (!isProd) {
      // Development/test: allow all requests through — log so it is visible.
      fastify.log.warn(
        { path: request.url, method: request.method },
        "Admin auth bypassed (non-production NODE_ENV)"
      );
      return;
    }
    // Production: require a valid X-Internal-Admin-Token header (T-03-W2).
    const adminToken = process.env["INTERNAL_ADMIN_TOKEN"];
    const headerToken = request.headers["x-internal-admin-token"];
    if (!adminToken || headerToken !== adminToken) {
      return reply.status(401).send({
        success: false,
        error: {
          code: "UNAUTHORIZED",
          message: "Admin authentication required",
        },
      });
    }
    // Phase 4 replaces this guard with JWT middleware (jose library, admin role claim).
  });

  // ── GET /admin/products ───────────────────────────────────────────────────
  // Moderation queue: returns products in pending_review status (PROD-06, D-06).
  // Cursor pagination mirrors vendor list pattern.
  fastify.get("/admin/products", async (request, reply) => {
    const productService =
      fastify.diContainer.resolve<ProductService>("productService");

    const query = request.query as { cursor?: string; limit?: string };
    const limit = query.limit ? Math.min(Math.max(1, Number(query.limit)), 100) : 20;

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
