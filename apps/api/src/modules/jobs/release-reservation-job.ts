import { eq, sql } from "drizzle-orm";
import type { Job } from "bullmq";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  inventoryItems,
  inventoryReservations,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

export interface ReleaseReservationJobData {
  reservationId: string;
}

// ---------------------------------------------------------------------------
// Job processor dependencies
// ---------------------------------------------------------------------------

interface ReleaseReservationJobDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// processReleaseReservationJob
// ---------------------------------------------------------------------------

/**
 * BullMQ job processor for releasing an inventory reservation after TTL expiry.
 *
 * Design:
 * - Idempotent: if reservation.status != 'reserved', returns immediately (no-op).
 *   This covers: payment already captured (status='consumed') or another release
 *   already processed (status='expired'). Worker restart safety (T-05-RES).
 * - On status='reserved': inside a transaction, increments inventory_items.quantityAvailable
 *   and decrements quantityReserved, then sets reservation status='expired'.
 * - Uses sql template for atomic +/- increments (avoids read-modify-write race,
 *   though the job is expected to be the only writer for an expired reservation).
 *
 * Follows product-index-job.ts pattern: pure processor function with injected deps.
 *
 * Covers D-07 (15-min TTL release), T-05-RES (abandoned reservation mitigation).
 */
export async function processReleaseReservationJob(
  job: Job<ReleaseReservationJobData>,
  deps: ReleaseReservationJobDeps
): Promise<void> {
  const { db } = deps;
  const { reservationId } = job.data;

  // Idempotency pre-check: load reservation outside the transaction first.
  // If status is not 'reserved', we are done immediately.
  const rows = await db
    .select()
    .from(inventoryReservations)
    .where(eq(inventoryReservations.id, reservationId))
    .limit(1);

  const reservation = rows[0];

  if (!reservation || reservation.status !== "reserved") {
    // Already consumed by payment or previously expired — no-op (T-05-RES)
    return;
  }

  // Release reservation: return stock to quantityAvailable
  await db.transaction(async (tx) => {
    // Atomically return quantity to available + decrement reserved (D-21)
    await tx
      .update(inventoryItems)
      .set({
        quantityAvailable: sql`${inventoryItems.quantityAvailable} + ${reservation.quantity}`,
        quantityReserved: sql`${inventoryItems.quantityReserved} - ${reservation.quantity}`,
        updatedAt: new Date(),
      })
      .where(eq(inventoryItems.id, reservation.inventoryItemId));

    // Mark reservation as expired
    await tx
      .update(inventoryReservations)
      .set({ status: "expired" })
      .where(eq(inventoryReservations.id, reservationId));
  });
}
