import { drizzle, type NodePgDatabase } from "drizzle-orm/node-postgres";
import fp from "fastify-plugin";
import { Pool } from "pg";
import { env } from "../config/env.js";

/**
 * Fastify plugin that creates a PostgreSQL connection pool and a Drizzle ORM
 * instance, then decorates the Fastify instance with `fastify.db`.
 *
 * Uses fastify-plugin so the decoration is not scoped to a child context.
 */
const drizzlePlugin = fp(
  async (fastify) => {
    const pool = new Pool({ connectionString: env.DATABASE_URL });

    // Verify connectivity at startup so missing DATABASE_URL fails fast.
    await pool.query("SELECT 1");

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const db: NodePgDatabase<any> = drizzle(pool);

    fastify.decorate("db", db);

    fastify.addHook("onClose", async () => {
      await pool.end();
    });

    fastify.log.info("Drizzle ORM connected to PostgreSQL");
  },
  { name: "drizzle" },
);

export default drizzlePlugin;
