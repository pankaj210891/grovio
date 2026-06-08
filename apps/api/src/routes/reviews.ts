import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import { requireVendorAuth } from "../middleware/vendorAuth.js";
import { requireAdminAuth } from "../middleware/adminAuth.js";
import type { ReviewService } from "../modules/reviews/index.js";
import {
  ReviewProductNotFoundError,
  ReviewAlreadyExistsError,
  ReviewNotFoundError,
  ReviewOwnershipError,
} from "../modules/reviews/index.js";

/**
 * Product reviews routes — Plan 11-05 T3.
 *
 * POST   /products/:id/reviews               — create review (customer auth)
 * GET    /products/:id/reviews               — list reviews (public)
 * PATCH  /vendor/reviews/:reviewId/reply     — vendor reply (vendor auth)
 * DELETE /admin/reviews/:reviewId            — admin moderation (admin auth)
 *
 * Because each route group requires different auth, they are registered as
 * separate sub-plugins within the same exported function.
 */

// ── Input schemas ─────────────────────────────────────────────────────────────

const CreateReviewSchema = z.object({
  rating: z.number().int().min(1).max(5),
  title: z.string().max(200).optional(),
  body: z.string().min(1).max(5000),
});

const ReviewQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 10))
    .pipe(z.number().int().min(1).max(50)),
});

const VendorReplySchema = z.object({
  reply: z.string().min(1).max(2000),
});

// ── reviewRoutes plugin ───────────────────────────────────────────────────────

export async function reviewRoutes(fastify: FastifyInstance): Promise<void> {
  function getService(): ReviewService {
    return fastify.diContainer.resolve<ReviewService>("reviewService");
  }

  // ── POST /products/:id/reviews — customer auth ────────────────────────────
  fastify.register(async (customerPlugin) => {
    customerPlugin.addHook("preHandler", requireCustomerAuth);

    customerPlugin.post<{ Params: { id: string } }>(
      "/products/:id/reviews",
      async (request, reply) => {
        const customerId = request.customerId;
        if (!customerId) {
          throw new Error("requireCustomerAuth must run before this handler");
        }

        const body = CreateReviewSchema.parse(request.body);

        try {
          const createParams: {
            customerId: string;
            productId: string;
            rating: number;
            body: string;
            title?: string;
          } = {
            customerId,
            productId: request.params.id,
            rating: body.rating,
            body: body.body,
          };
          if (body.title !== undefined) createParams.title = body.title;

          const result = await getService().createReview(createParams);

          return reply.status(201).send({ success: true, data: result });
        } catch (err) {
          if (err instanceof ReviewProductNotFoundError) {
            return reply.status(404).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          if (err instanceof ReviewAlreadyExistsError) {
            return reply.status(409).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          throw err;
        }
      }
    );
  });

  // ── GET /products/:id/reviews — public ────────────────────────────────────
  fastify.get<{ Params: { id: string } }>(
    "/products/:id/reviews",
    async (request, reply) => {
      const query = ReviewQuerySchema.parse(request.query);

      try {
        const result = await getService().listReviews({
          productId: request.params.id,
          page: query.page,
          limit: query.limit,
        });

        return reply.send({ success: true, data: result });
      } catch (err) {
        if (err instanceof ReviewProductNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── PATCH /vendor/reviews/:reviewId/reply — vendor auth ───────────────────
  fastify.register(async (vendorPlugin) => {
    vendorPlugin.addHook("preHandler", requireVendorAuth);

    vendorPlugin.patch<{ Params: { reviewId: string } }>(
      "/vendor/reviews/:reviewId/reply",
      async (request, reply) => {
        const vendorId = (request as import("fastify").FastifyRequest & { vendorId?: string }).vendorId;
        if (!vendorId) {
          throw new Error("requireVendorAuth must run before this handler");
        }

        const body = VendorReplySchema.parse(request.body);

        try {
          await getService().addVendorReply({
            vendorId,
            reviewId: request.params.reviewId,
            replyText: body.reply,
          });

          return reply.send({ success: true, data: null });
        } catch (err) {
          if (err instanceof ReviewNotFoundError) {
            return reply.status(404).send({
              success: false,
              error: { code: err.code, message: err.message },
            });
          }
          if (err instanceof ReviewOwnershipError) {
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

  // ── DELETE /admin/reviews/:reviewId — admin auth ──────────────────────────
  // Soft-hides the review by setting moderated=true. Does not hard-delete.
  fastify.register(async (adminPlugin) => {
    adminPlugin.addHook("preHandler", requireAdminAuth);

    adminPlugin.delete<{ Params: { reviewId: string } }>(
      "/admin/reviews/:reviewId",
      async (request, reply) => {
        const adminEmail = request.adminEmail;
        if (!adminEmail) {
          throw new Error("requireAdminAuth must run before this handler");
        }

        try {
          await getService().moderateReview({
            reviewId: request.params.reviewId,
            adminEmail,
          });

          return reply.send({ success: true, data: null });
        } catch (err) {
          if (err instanceof ReviewNotFoundError) {
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
