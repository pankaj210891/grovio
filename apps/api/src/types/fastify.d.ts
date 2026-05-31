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
}
