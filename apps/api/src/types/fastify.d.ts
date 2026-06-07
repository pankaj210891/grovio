import type { AwilixContainer } from "awilix";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";

/**
 * Augments the Fastify instance type with custom decorator properties
 * added by the drizzle, redis, and awilix plugins.
 *
 * These declarations allow TypeScript to resolve `fastify.db`,
 * `fastify.redis`, and `fastify.diContainer` without casting to `any`.
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
  }

  interface FastifyRequest {
    /** Admin user UUID — set by requireAdminAuth middleware. */
    adminId?: string;

    /** Admin user email — set by requireAdminAuth middleware. */
    adminEmail?: string;

    /**
     * Admin RBAC role — set by requireAdminAuth middleware (Phase 11).
     * Values: 'super_admin' | 'moderator' | 'finance_admin'
     */
    adminRole?: string;
  }
}
