import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * - dialect: postgresql — Drizzle Kit generates PostgreSQL-flavoured SQL migrations.
 * - schema:  ./src/db/schema/index.ts — barrel that aggregates all table definitions.
 * - out:     ./src/db/migrations — migration files written here by `pnpm db:generate`.
 *
 * Migration URL strategy:
 * - DATABASE_DIRECT_URL: Neon non-pooled endpoint (no `-pooler` in hostname). Required
 *   for drizzle-kit because Neon's PgBouncer pooler runs in transaction mode, which does
 *   not support the SET statements and session-level state that schema migrations rely on.
 *   Using the pooled URL for migrations causes hangs or "prepared statement does not exist"
 *   errors. See: neon.com/docs/guides/drizzle-migrations
 * - DATABASE_URL: Fallback for local Postgres (no pooler, no separation needed).
 *
 * Set DATABASE_DIRECT_URL to the Neon direct connection string before running
 * `pnpm db:migrate` or `pnpm db:generate` against Neon.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"]!,
  },
});
