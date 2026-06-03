import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../../middleware/customerAuth.js";
import type { WalletService } from "../../modules/wallet/index.js";

/**
 * Account wallet routes — all guarded by requireCustomerAuth (WAL-01, WAL-02).
 *
 * Security (T-05-06, AUTH-05):
 *   - requireCustomerAuth preHandler on all routes
 *   - customerId from JWT — customers can only access their own wallet
 *
 * Serialization note: all bigint/number money values are serialized to number
 * before send (Pitfall 5 — JSON boundary).
 *
 * GET /account/wallet          — wallet balance (WAL-01)
 * GET /account/wallet/entries  — wallet ledger history (WAL-02)
 */

/** Runtime guard — throws if requireCustomerAuth did not run. */
function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── accountWalletRoutes plugin ────────────────────────────────────────────────

export async function accountWalletRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Customer JWT guard — protects ALL routes in this plugin (T-05-06) ────────
  fastify.addHook("preHandler", requireCustomerAuth);

  function getWalletService(): WalletService {
    return fastify.diContainer.resolve<WalletService>("walletService");
  }

  // ── GET /account/wallet ────────────────────────────────────────────────────
  // Returns the customer's wallet balance (WAL-01).
  // Serialize bigint → number before send (Pitfall 5).
  fastify.get("/account/wallet", async (request, reply) => {
    const walletService = getWalletService();
    const balanceMinor = await walletService.getBalance(getCustomerId(request));
    // Ensure number serialization (Pitfall 5: JSON cannot serialize bigint)
    return reply.send({
      success: true,
      data: { balanceMinor: Number(balanceMinor) },
    });
  });

  // ── GET /account/wallet/entries ────────────────────────────────────────────
  // Returns the customer's wallet ledger history (WAL-02), most recent first.
  // Serialize amountMinor bigint → number before send (Pitfall 5).
  fastify.get("/account/wallet/entries", async (request, reply) => {
    const walletService = getWalletService();
    const entries = await walletService.getLedger(getCustomerId(request));

    // Serialize: convert any bigint money fields to number (Pitfall 5)
    const serialized = entries.map((entry) => ({
      ...entry,
      amountMinor: Number(entry.amountMinor),
    }));

    return reply.send({ success: true, data: { entries: serialized } });
  });
}
