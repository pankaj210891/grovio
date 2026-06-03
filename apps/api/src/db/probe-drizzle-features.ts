/**
 * Probe script: verify drizzle-orm 1.0.0-rc.3 query feature compatibility.
 *
 * This script tests two query features that Phase 5 depends on:
 *   1. .for('update') — row-level locking for inventory reservation (CHK-05, T-05-01)
 *   2. onConflictDoNothing({ target }) — webhook idempotency (PAY-03, T-05-02, D-10)
 *
 * Run via: pnpm --filter @grovio/api db:probe
 *
 * Expected output:
 *   [PROBE] .for('update') — SUPPORTED
 *   [PROBE] onConflictDoNothing({ target }) — SUPPORTED (idempotent insert confirmed)
 *   [PROBE] All Phase 5 query features confirmed working.
 */

import { Pool } from "pg";
import { drizzle } from "drizzle-orm/node-postgres";
import { eq } from "drizzle-orm";
import * as schema from "./schema/index.js";

const DATABASE_URL = process.env["DATABASE_DIRECT_URL"] ?? process.env["DATABASE_URL"];

if (!DATABASE_URL) {
  console.error("[PROBE] ERROR: DATABASE_URL or DATABASE_DIRECT_URL must be set.");
  process.exit(1);
}

const pool = new Pool({
  connectionString: DATABASE_URL,
  ssl: DATABASE_URL.includes(".neon.tech") || DATABASE_URL.includes("sslmode=require")
    ? true
    : false,
});

// eslint-disable-next-line @typescript-eslint/no-explicit-any
const db = drizzle({ client: pool }) as any;

async function probe() {
  console.log("[PROBE] Connecting to database...");
  await pool.query("SELECT 1");
  console.log("[PROBE] Connected.");

  // ---- Probe 1: .for('update') ----
  // Insert a test inventory_items row, then select it FOR UPDATE inside a transaction.
  // We use a product_id of null and product_variant_id of null for a minimal row
  // that passes nullable FK constraints.
  let forUpdateSupported = false;
  let forUpdateError: unknown = null;

  // First, insert a temporary inventory item to probe against.
  // Use a known probe ID marker — we clean up at the end.
  const probeInventoryId = "00000000-0000-0000-0000-000000000001";

  try {
    // Clean up any leftover probe row from a previous run.
    await db
      .delete(schema.inventoryItems)
      .where(eq(schema.inventoryItems.id, probeInventoryId));

    // NOTE: Direct insert with a specific UUID requires raw SQL or we accept the auto-gen UUID.
    // We'll insert with auto-gen UUID and select the result back for the FOR UPDATE test.
    const [probeRow] = await db
      .insert(schema.inventoryItems)
      .values({
        quantityAvailable: 10,
        quantityReserved: 0,
      })
      .returning({ id: schema.inventoryItems.id });

    if (!probeRow) {
      throw new Error("Failed to insert probe inventory row");
    }

    const insertedId = probeRow.id;

    // Test .for('update') inside a transaction
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.transaction(async (tx: any) => {
      const rows = await tx
        .select()
        .from(schema.inventoryItems)
        .where(eq(schema.inventoryItems.id, insertedId))
        .for("update");

      if (!rows[0]) {
        throw new Error("FOR UPDATE: row not found");
      }

      forUpdateSupported = true;
    });

    // Clean up probe row
    await db
      .delete(schema.inventoryItems)
      .where(eq(schema.inventoryItems.id, insertedId));

    console.log("[PROBE] .for('update') — SUPPORTED");
  } catch (err) {
    forUpdateError = err;
    console.log(`[PROBE] .for('update') — NOT SUPPORTED (error: ${String(err)})`);
    console.log("[PROBE]   Fallback: use db.execute(sql\`SELECT ... FOR UPDATE\`) in InventoryService");
  }

  // ---- Probe 2: onConflictDoNothing({ target }) ----
  // Insert a payment_events row, then insert it again with onConflictDoNothing.
  // The second insert must return an empty array (idempotent no-op).
  let onConflictSupported = false;
  let onConflictError: unknown = null;

  try {
    // Clean up any leftover probe row
    await db
      .delete(schema.paymentEvents)
      .where(eq(schema.paymentEvents.providerEventId, "probe-event-001"));

    // First insert — should succeed
    const first = await db
      .insert(schema.paymentEvents)
      .values({
        provider: "stripe",
        providerEventId: "probe-event-001",
        eventType: "payment_intent.succeeded",
        payload: { probe: true },
      })
      .onConflictDoNothing({
        target: [schema.paymentEvents.provider, schema.paymentEvents.providerEventId],
      })
      .returning({ id: schema.paymentEvents.id });

    if (!first[0]) {
      throw new Error("onConflictDoNothing: first insert did not return a row (unexpected)");
    }

    // Second insert — same (provider, providerEventId) — should return empty array
    const second = await db
      .insert(schema.paymentEvents)
      .values({
        provider: "stripe",
        providerEventId: "probe-event-001",
        eventType: "payment_intent.succeeded",
        payload: { probe: true, duplicate: true },
      })
      .onConflictDoNothing({
        target: [schema.paymentEvents.provider, schema.paymentEvents.providerEventId],
      })
      .returning({ id: schema.paymentEvents.id });

    if (second.length !== 0) {
      throw new Error(
        `onConflictDoNothing: expected empty array on duplicate insert, got ${second.length} rows`
      );
    }

    onConflictSupported = true;

    // Clean up probe row
    await db
      .delete(schema.paymentEvents)
      .where(eq(schema.paymentEvents.providerEventId, "probe-event-001"));

    console.log(
      "[PROBE] onConflictDoNothing({ target }) — SUPPORTED (idempotent insert confirmed)"
    );
  } catch (err) {
    onConflictError = err;
    console.log(`[PROBE] onConflictDoNothing({ target }) — ERROR: ${String(err)}`);
  }

  // ---- Summary ----
  console.log("");
  console.log("[PROBE] ===== RESULTS =====");
  console.log(`[PROBE] .for('update'):                 ${forUpdateSupported ? "SUPPORTED" : "NOT SUPPORTED"}`);
  console.log(`[PROBE] onConflictDoNothing({ target }): ${onConflictSupported ? "SUPPORTED" : "ERROR"}`);

  if (forUpdateSupported && onConflictSupported) {
    console.log("[PROBE] All Phase 5 query features confirmed working in drizzle-orm 1.0.0-rc.3.");
    console.log("[PROBE] RESULT: PASS");
  } else {
    console.log("[PROBE] One or more features failed. See fallback notes above.");
    if (forUpdateError) console.log("[PROBE] .for('update') error:", forUpdateError);
    if (onConflictError) console.log("[PROBE] onConflictDoNothing error:", onConflictError);
    console.log("[PROBE] RESULT: PARTIAL");
  }
}

probe()
  .catch((err) => {
    console.error("[PROBE] Fatal error:", err);
    process.exit(1);
  })
  .finally(() => {
    pool.end().catch(() => {});
  });
