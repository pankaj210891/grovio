import type { FastifyInstance } from "fastify";
import { requireAdminAuth } from "../../middleware/adminAuth.js";
import type { PayoutService } from "../../modules/payouts/index.js";
import { RecordSettlementInputSchema } from "@grovio/contracts/admin/payouts";

/**
 * Admin payout settlement routes (MKT-04, D-07/D-08).
 *
 * All routes are guarded by requireAdminAuth (T-06-25 mitigation).
 *
 * GET  /admin/payouts/:vendorId             — full admin payout view (summary + ledger + settlements + bank)
 * POST /admin/payouts/:vendorId/settlements — record a manual settlement (append-only)
 *
 * RecordSettlementInput.amount is a decimal string (T-06-20 mitigation — server converts to minor units).
 * vendor_payouts is append-only; no UPDATE endpoint exists here (D-07, T-06-03).
 */

export async function adminPayoutRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Admin JWT guard ────────────────────────────────────────────────────────
  fastify.addHook("preHandler", requireAdminAuth);

  function getService(): PayoutService {
    return fastify.diContainer.resolve<PayoutService>("payoutService");
  }

  function getAdminEmail(request: import("fastify").FastifyRequest): string {
    if (!request.adminEmail) {
      throw new Error("requireAdminAuth must run before this handler");
    }
    return request.adminEmail;
  }

  // ── GET /admin/payouts/:vendorId ──────────────────────────────────────────
  // Full payout view: summary strip + commission ledger + settlement records + bank details.
  fastify.get<{ Params: { vendorId: string } }>(
    "/admin/payouts/:vendorId",
    async (request, reply) => {
      const service = getService();
      const result = await service.getVendorPayout(request.params.vendorId);
      return reply.send({ success: true, data: result });
    }
  );

  // ── POST /admin/payouts/:vendorId/settlements ─────────────────────────────
  // Record a manual settlement. Append-only — inserts a vendor_payouts row.
  fastify.post<{ Params: { vendorId: string } }>(
    "/admin/payouts/:vendorId/settlements",
    async (request, reply) => {
      const body = RecordSettlementInputSchema.parse(request.body);
      const service = getService();
      const adminEmail = getAdminEmail(request);

      try {
        await service.recordSettlement(
          request.params.vendorId,
          {
            amount: body.amount,
            settlementReference: body.settlementReference,
            ...(body.note !== undefined ? { note: body.note } : {}),
          },
          adminEmail
        );
        return reply.status(201).send({ success: true, data: null });
      } catch (err) {
        if (err instanceof Error && err.message.includes("must be positive")) {
          return reply.status(422).send({
            success: false,
            error: { code: "INVALID_AMOUNT", message: err.message },
          });
        }
        throw err;
      }
    }
  );
}
