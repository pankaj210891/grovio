import type { AwilixContainer } from "awilix";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import type { Client as OpenSearchClient } from "@opensearch-project/opensearch";

/**
 * Augments the Fastify instance type with custom decorator properties
 * added by the drizzle, redis, awilix, and opensearch plugins.
 *
 * These declarations allow TypeScript to resolve `fastify.db`,
 * `fastify.redis`, `fastify.diContainer`, and `fastify.opensearch`
 * without casting to `any`.
 */
declare module "fastify" {
  interface FastifyInstance {
    /** Drizzle ORM database instance (connected to PostgreSQL via pg Pool). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    db: NodePgDatabase<any>;

    /** ioredis client instance (connected to Redis). */
    redis: Redis;

    /** Awilix DI container (PROXY injection mode). */
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    diContainer: AwilixContainer<any>;

    /**
     * OpenSearch client instance. null when OPENSEARCH_URL is not configured
     * (e.g. local dev or environments where search is disabled).
     * SearchService.isAvailable() gates all queries on this being non-null.
     */
    opensearch: OpenSearchClient | null;
  }

  interface FastifyRequest {
    /**
     * Vendor store UUID (vendors.id FK) extracted from the verified JWT by requireVendorAuth
     * preHandler. Present only on /vendor/* routes after the preHandler runs (T-03-W1, V4).
     *
     * Phase 6 migration note (D-03, D-06): this remains the FK to vendors.id (not vendor_users.id).
     * The JWT `vendorId` claim carries vendors.id; `sub` carries vendor_users.id.
     * All existing ownership checks using request.vendorId remain valid.
     */
    vendorId?: string;

    /**
     * Vendor user UUID (vendor_users.id) extracted from the JWT `sub` claim by requireVendorAuth.
     * Present only on /vendor/* routes after the preHandler runs (Phase 6, WR-08).
     * Distinct from vendorId (vendors.id FK) — use this for invitedByUserId and audit actor IDs.
     */
    vendorUserId?: string;

    /**
     * Vendor team role extracted from the verified JWT by requireVendorAuth preHandler.
     * Present only on /vendor/* routes after the preHandler runs (Phase 6, D-05).
     * Values: "owner" | "manager" | "staff".
     * Routes can check this for role-gated actions (e.g. owner-only operations).
     */
    vendorRole?: "owner" | "manager" | "staff";

    /**
     * Admin UUID (admin_users.id) extracted from the verified JWT by requireAdminAuth
     * preHandler. Present only on /admin/* routes after the preHandler runs (D-21).
     */
    adminId?: string;

    /**
     * Admin email extracted from the verified JWT by requireAdminAuth preHandler.
     * Present only on /admin/* routes after the preHandler runs (D-21).
     */
    adminEmail?: string;
  }
}
