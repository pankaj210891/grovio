import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import type { NotificationService } from "../../modules/notifications/customer/index.js";
import {
  NotificationNotFoundError,
  NotificationOwnershipError,
} from "../../modules/notifications/customer/index.js";

/**
 * Customer notification routes — Plan 11-05 T4.
 *
 * All routes guarded by requireCustomerAuth (httpOnly cookie JWT).
 *
 * GET    /account/notifications                   — paginated notifications (undismissed first)
 * PATCH  /notifications/:id/dismiss               — set dismissed_at = now()
 * GET    /account/notifications/preferences        — get notification preferences
 * PATCH  /account/notifications/preferences        — update price_drops + promotions prefs
 */

function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const NotificationsQuerySchema = z.object({
  page: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 1))
    .pipe(z.number().int().min(1)),
  limit: z
    .string()
    .optional()
    .transform((v) => (v ? parseInt(v, 10) : 20))
    .pipe(z.number().int().min(1).max(100)),
});

const UpdatePreferencesSchema = z.object({
  priceDrops: z.boolean().optional(),
  promotions: z.boolean().optional(),
});

// ── accountNotificationRoutes plugin ─────────────────────────────────────────

export async function accountNotificationRoutes(
  fastify: FastifyInstance
): Promise<void> {
  fastify.addHook("preHandler", requireCustomerAuth);

  function getService(): NotificationService {
    return fastify.diContainer.resolve<NotificationService>("notificationService");
  }

  // ── GET /account/notifications ────────────────────────────────────────────
  fastify.get("/account/notifications", async (request, reply) => {
    const customerId = getCustomerId(request);
    const query = NotificationsQuerySchema.parse(request.query);

    const result = await getService().listNotifications({
      customerId,
      page: query.page,
      limit: query.limit,
    });

    return reply.send({ success: true, data: result });
  });

  // ── PATCH /notifications/:id/dismiss ─────────────────────────────────────
  fastify.patch<{ Params: { id: string } }>(
    "/notifications/:id/dismiss",
    async (request, reply) => {
      const customerId = getCustomerId(request);

      try {
        await getService().dismissNotification({
          notificationId: request.params.id,
          customerId,
        });

        return reply.send({ success: true, data: null });
      } catch (err) {
        if (err instanceof NotificationNotFoundError) {
          return reply.status(404).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        if (err instanceof NotificationOwnershipError) {
          return reply.status(403).send({
            success: false,
            error: { code: err.code, message: err.message },
          });
        }
        throw err;
      }
    }
  );

  // ── GET /account/notifications/preferences ────────────────────────────────
  fastify.get("/account/notifications/preferences", async (request, reply) => {
    const customerId = getCustomerId(request);
    const prefs = await getService().getPreferences(customerId);
    return reply.send({ success: true, data: prefs });
  });

  // ── PATCH /account/notifications/preferences ──────────────────────────────
  // Allows customer to update price_drops and promotions preferences.
  // order_updates is always true and cannot be changed.
  fastify.patch(
    "/account/notifications/preferences",
    async (request, reply) => {
      const customerId = getCustomerId(request);
      const body = UpdatePreferencesSchema.parse(request.body);

      const prefsInput: { priceDrops?: boolean; promotions?: boolean } = {};
      if (body.priceDrops !== undefined) prefsInput.priceDrops = body.priceDrops;
      if (body.promotions !== undefined) prefsInput.promotions = body.promotions;

      const updated = await getService().updatePreferences(customerId, prefsInput);

      return reply.send({ success: true, data: updated });
    }
  );
}
