import type { FastifyInstance } from "fastify";
import type { HomepageService } from "../modules/homepage/index.js";

/**
 * Homepage read route — public, no auth guard.
 *
 * GET /homepage — returns the ordered active block array (STORE-01, D-04)
 *
 * Serves the Redis-cached list of active homepage blocks in sort_order ascending.
 * The HomepageService applies a Redis-first read with DB fallback and a
 * configurable TTL (HOMEPAGE_BLOCKS_TTL_SECONDS, default 300s).
 *
 * Admin write-side (create/reorder/archive blocks) is deferred to Phase 6 (ADM-04).
 * Phase 4 delivers the read endpoint only.
 *
 * Response envelope: { success: true, data: { blocks } }
 * Pattern source: PATTERNS.md § homepage.ts — analog: routes/categories.ts
 */
export async function homepageRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /homepage ─────────────────────────────────────────────────────────
  // Returns ordered active blocks. Redis-cached (STORE-01, D-04).
  // No auth required — homepage data is public (all visitors, including guests).
  fastify.get("/homepage", async (_request, reply) => {
    const homepageService =
      fastify.diContainer.resolve<HomepageService>("homepageService");
    const blocks = await homepageService.getBlocks();
    return reply.send({ success: true, data: { blocks } });
  });
}
