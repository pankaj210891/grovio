import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * Returns true when the given PostgreSQL connection string requires SSL.
 *
 * Triggers on:
 * - Neon hostname (contains `.neon.tech`) — Neon requires SSL on all connections
 * - Explicit `sslmode=require` query parameter — any cloud Postgres requiring SSL
 * - `sslmode=verify-full` — full certificate verification (Supabase, RDS, Railway, etc.)
 * - `sslmode=verify-ca` — CA certificate verification
 *
 * Pure function (no Fastify dependency) so it can be unit-tested independently.
 */
export function requiresSsl(connectionString: string): boolean {
  return (
    connectionString.includes(".neon.tech") ||
    connectionString.includes("sslmode=require") ||
    connectionString.includes("sslmode=verify-full") ||
    connectionString.includes("sslmode=verify-ca")
  );
}

/**
 * Fastify plugin that creates a PostgreSQL connection pool and a Drizzle ORM
 * instance, then decorates the Fastify instance with `fastify.db`.
 *
 * Uses fastify-plugin so the decoration is not scoped to a child context.
 */
const drizzlePlugin = fp(
  async (fastify) => {
    const ssl = requiresSsl(env.DATABASE_URL);
    const pool = new Pool({
      connectionString: env.DATABASE_URL,
      ...(ssl ? { ssl: true } : {}),
    });

    // Verify connectivity at startup so missing DATABASE_URL fails fast.
    // Wrap in try/catch so the pool is cleanly ended if the check fails —
    // without this, the onClose hook is never registered and the pool leaks.
    try {
      await pool.query("SELECT 1");
    } catch (err) {
      await pool.end();
      throw err;
    }

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: NodePgDatabase<any> = drizzle(pool);

    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await pool.end();
    });

    fastify.log.info(`Drizzle ORM connected to PostgreSQL (ssl=${ssl})`);
  },
  { name: "drizzle" },
);

export default drizzlePlugin;
