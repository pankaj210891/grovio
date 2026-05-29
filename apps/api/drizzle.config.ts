import { defineConfig } from "drizzle-kit";

/**
 * Drizzle Kit configuration.
 *
 * - dialect: postgresql — Drizzle Kit generates PostgreSQL-flavoured SQL migrations.
 * - schema:  ./src/db/schema/index.ts — barrel that aggregates all table definitions.
 * - out:     ./src/db/migrations — migration files written here by `pnpm db:generate`.
 *
 * DATABASE_URL must be set in the environment before running any drizzle-kit command.
 * Use the .env.example as a guide.
 */
export default defineConfig({
  dialect: "postgresql",
  schema: "./src/db/schema/index.ts",
  out: "./src/db/migrations",
  dbCredentials: {
    url: process.env["DATABASE_URL"]!,
  },
});
