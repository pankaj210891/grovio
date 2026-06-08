/**
 * Admin seed script — creates the initial super_admin account.
 *
 * Idempotent: skips if an admin with the target email already exists.
 *
 * Credentials (override via env):
 *   SEED_ADMIN_EMAIL    — default: admin@grovio.dev
 *   SEED_ADMIN_PASSWORD — default: Admin@1234
 *
 * Run: pnpm --filter @grovio/api db:seed:admin
 */

import * as argon2 from "argon2";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import { eq } from "drizzle-orm";
import * as schema from "./schema/index.js";

const DATABASE_URL =
  process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("[seed:admin] ERROR: DATABASE_URL must be set.");
  process.exit(1);
}

const usesSsl =
  DATABASE_URL.includes(".neon.tech") || DATABASE_URL.includes("sslmode=require");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(usesSsl ? { ssl: { rejectUnauthorized: false } } : {}),
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzle({ client: pool }) as any;

const ADMIN_EMAIL = process.env["SEED_ADMIN_EMAIL"] ?? "admin@grovio.dev";
const ADMIN_PASSWORD = process.env["SEED_ADMIN_PASSWORD"] ?? "Admin@1234";

async function seedAdmin() {
  console.log("[seed:admin] Connecting...");
  await pool.query("SELECT 1");
  console.log("[seed:admin] Connected.");

  const existing = await db
    .select({ id: schema.adminUsers.id })
    .from(schema.adminUsers)
    .where(eq(schema.adminUsers.email, ADMIN_EMAIL))
    .limit(1);

  if (existing.length > 0) {
    console.log(`[seed:admin] Admin '${ADMIN_EMAIL}' already exists — skipping.`);
    await pool.end();
    return;
  }

  const passwordHash = await argon2.hash(ADMIN_PASSWORD);
  await db.insert(schema.adminUsers).values({
    email: ADMIN_EMAIL,
    passwordHash,
    role: "super_admin",
  });

  console.log(`[seed:admin] Admin user created:`);
  console.log(`  Email:    ${ADMIN_EMAIL}`);
  console.log(`  Password: ${ADMIN_PASSWORD}`);
  console.log(`  Role:     super_admin`);

  await pool.end();
}

seedAdmin().catch((err) => {
  console.error("[seed:admin] FAILED:", err);
  process.exit(1);
});
