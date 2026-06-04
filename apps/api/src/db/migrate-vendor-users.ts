/**
 * Vendor-owner data migration script — Phase 6 (Plan 06-03)
 *
 * Copies existing Phase 3 vendor owner credentials (email + password_hash) from
 * the `vendors` table into `vendor_users` as `role='owner'` rows.
 *
 * Background (D-03):
 *   Phase 3 vendor auth was stored directly on the `vendors` table: one vendor row
 *   had exactly one set of login credentials. Phase 6 introduces `vendor_users` to
 *   support multi-member vendor teams with role-based access. All future authentication
 *   runs against `vendor_users`; the `email`/`password_hash` columns on `vendors` are
 *   retained for data integrity but are no longer used for auth.
 *
 *   This migration bridges the gap by copying every existing vendor owner account into
 *   `vendor_users` as `role='owner'` before VendorAuthService switches to the new table
 *   (Plan 06-04). Without this step, every existing vendor would be locked out after
 *   the auth migration (T-06-07 threat mitigation).
 *
 * Idempotency:
 *   The INSERT uses a NOT EXISTS guard scoped to (vendor_id, role = 'owner'). Re-running
 *   this script after it has already populated `vendor_users` will insert 0 new rows.
 *   Safe to run multiple times (T-06-08 mitigation).
 *
 * Run: pnpm --filter @grovio/api db:migrate:vendor-users
 */

import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const DATABASE_URL =
  process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error(
    "[migrate:vendor-users] ERROR: DATABASE_URL or DATABASE_DIRECT_URL must be set."
  );
  process.exit(1);
}

const usesSsl =
  DATABASE_URL.includes(".neon.tech") ||
  DATABASE_URL.includes("sslmode=require");

const pool = new Pool({
  connectionString: DATABASE_URL,
  ...(usesSsl ? { ssl: true } : {}),
});

// We use raw SQL for the data migration — Drizzle ORM layer not needed for this INSERT/SELECT.
// Using pg client directly avoids any ORM layer interference with the idempotency guard.

async function migrateVendorUsers() {
  console.log("[migrate:vendor-users] Connecting to database...");
  const client = await pool.connect();

  try {
    console.log("[migrate:vendor-users] Connected.");
    console.log(
      "[migrate:vendor-users] Copying vendor owner credentials to vendor_users (idempotent)..."
    );

    // Idempotent INSERT: copies all Phase 3 vendor owner accounts to vendor_users as role='owner'.
    // NOT EXISTS guard ensures re-runs do not create duplicate owner rows (T-06-08).
    // accepted_at = NOW(): migrated owners are already active — no invite acceptance step needed.
    // created_at = vendors.created_at: preserves original account creation timestamp.
    const insertResult = await client.query<{ inserted_count: string }>(`
      WITH inserted AS (
        INSERT INTO vendor_users (
          id,
          vendor_id,
          email,
          password_hash,
          role,
          accepted_at,
          created_at,
          updated_at
        )
        SELECT
          gen_random_uuid(),
          v.id,
          v.email,
          v.password_hash,
          'owner',
          NOW(),
          v.created_at,
          NOW()
        FROM vendors v
        WHERE
          v.email IS NOT NULL
          AND v.password_hash IS NOT NULL
          AND NOT EXISTS (
            SELECT 1
            FROM vendor_users vu
            WHERE vu.vendor_id = v.id
              AND vu.role = 'owner'
          )
        RETURNING id
      )
      SELECT COUNT(*) AS inserted_count FROM inserted
    `);

    const insertedCount = parseInt(
      insertResult.rows[0]?.inserted_count ?? "0",
      10
    );
    console.log(
      `[migrate:vendor-users] Inserted ${insertedCount} new owner row(s).`
    );

    if (insertedCount === 0) {
      console.log(
        "[migrate:vendor-users] No new rows inserted — idempotent re-run detected (all owners already present)."
      );
    }

    // Verify: count total owner rows to confirm coverage (T-06-07 mitigation check).
    const totalOwnerResult = await client.query<{ owner_count: string }>(`
      SELECT COUNT(*) AS owner_count
      FROM vendor_users
      WHERE role = 'owner'
    `);
    const totalOwnerCount = parseInt(
      totalOwnerResult.rows[0]?.owner_count ?? "0",
      10
    );

    // Count how many vendors had eligible credentials (should equal owner rows after migration).
    const eligibleVendorResult = await client.query<{
      eligible_count: string;
    }>(`
      SELECT COUNT(*) AS eligible_count
      FROM vendors
      WHERE email IS NOT NULL AND password_hash IS NOT NULL
    `);
    const eligibleVendorCount = parseInt(
      eligibleVendorResult.rows[0]?.eligible_count ?? "0",
      10
    );

    console.log(
      `[migrate:vendor-users] Total owner rows in vendor_users: ${totalOwnerCount}`
    );
    console.log(
      `[migrate:vendor-users] Eligible vendors (with email + password_hash): ${eligibleVendorCount}`
    );

    if (totalOwnerCount === eligibleVendorCount) {
      console.log(
        `[migrate:vendor-users] Coverage check PASSED: every eligible vendor has an owner row.`
      );
    } else {
      console.warn(
        `[migrate:vendor-users] WARNING: Coverage mismatch — owner_count (${totalOwnerCount}) != eligible_vendor_count (${eligibleVendorCount}). ` +
          `Some vendors may be missing an owner row. Investigate before running Plan 06-04.`
      );
      // Exit with non-zero to surface the mismatch in CI or manual runs.
      process.exitCode = 1;
    }

    console.log("[migrate:vendor-users] Migration complete.");
  } finally {
    client.release();
  }
}

migrateVendorUsers()
  .catch((err) => {
    console.error("[migrate:vendor-users] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
