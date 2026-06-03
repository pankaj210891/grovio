import { eq, sql } from "drizzle-orm";
import type { Job, Queue } from "bullmq";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import {
  inventoryItems,
  inventoryReservations,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors (re-exported for callers; identical signature to basket error)
// ---------------------------------------------------------------------------

/**
 * Thrown when reservation fails due to insufficient stock.
 * Uses same name/code as BasketService's error — callers can import from either module.
 */
export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";

  constructor(
    public readonly inventoryItemId: string,
    public readonly requested: number,
    public readonly available: number,
    message?: string
  ) {
    super(
      message ??
        `Insufficient stock for ${inventoryItemId}: requested ${requested}, available ${available}.`
    );
    this.name = "InsufficientStockError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface InventoryServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  reservationQueue: Queue<any>;
  env: Pick<Env, "NODE_ENV">;
}

// ---------------------------------------------------------------------------
// Constants
// ---------------------------------------------------------------------------

/** Reservation TTL in milliseconds: 15 minutes (D-07) */
const RESERVATION_TTL_MS = 15 * 60 * 1000; // 900000 ms

// ---------------------------------------------------------------------------
// InventoryService
// ---------------------------------------------------------------------------

/**
 * InventoryService
 *
 * Owns atomic inventory reservation and release operations.
 *
 * Methods:
 * - reserveItems: atomically reserve inventory via SELECT FOR UPDATE + BullMQ delayed job
 * - consumeReservation: mark reservation consumed (called on payment success)
 * - releaseReservation: return stock to quantityAvailable (called by ReleaseReservationJob)
 *
 * Thread-safety:
 * reserveItems wraps each item reservation in a separate db.transaction() with
 * SELECT ... FOR UPDATE (Pattern 2, RESEARCH.md). Concurrent checkout requests
 * block on the row lock and read the updated quantityAvailable after commit,
 * preventing oversell (Pitfall 2).
 *
 * BullMQ job enqueuing:
 * Jobs are enqueued AFTER all transactions commit (not inside them) to avoid
 * the anti-pattern of enqueuing jobs that might not commit. Each job has a
 * deterministic `jobId = "release-reservation:{reservationId}"` to prevent
 * duplicate jobs on worker restart (RESEARCH.md anti-pattern note, D-07).
 *
 * Covers CHK-05, D-06, D-07, T-05-01, T-05-RES.
 */
export class InventoryService {
  constructor(private deps: InventoryServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Reserve inventory for all items in a checkout session.
   *
   * For each item:
   * 1. Inside a transaction: SELECT FOR UPDATE the inventory_items row.
   * 2. Throw InsufficientStockError if row missing or quantityAvailable < requested.
   * 3. Decrement quantityAvailable + increment quantityReserved.
   * 4. Insert an inventory_reservations row (status='reserved', expiresAt=now+15min).
   *
   * After all transactions commit:
   * 5. Enqueue one ReleaseReservationJob per reservation with deterministic jobId
   *    and delay=RESERVATION_TTL_MS (15 minutes).
   *
   * @returns Array of reservation IDs created.
   * @throws InsufficientStockError if any item has insufficient stock (first failing item).
   */
  async reserveItems(params: {
    basketSessionId: string;
    customerId: string;
    items: Array<{ inventoryItemId: string; quantity: number }>;
  }): Promise<string[]> {
    const { db, reservationQueue } = this.deps;
    const { basketSessionId, customerId, items } = params;
    const reservationIds: string[] = [];

    for (const item of items) {
      await db.transaction(async (tx) => {
        // SELECT FOR UPDATE — row-level lock prevents concurrent oversell (T-05-01)
        const [invRow] = await tx
          .select()
          .from(inventoryItems)
          .where(eq(inventoryItems.id, item.inventoryItemId))
          .for("update");

        if (!invRow || invRow.quantityAvailable < item.quantity) {
          throw new InsufficientStockError(
            item.inventoryItemId,
            item.quantity,
            invRow?.quantityAvailable ?? 0
          );
        }

        // Atomically decrement available + increment reserved (D-21)
        await tx
          .update(inventoryItems)
          .set({
            quantityAvailable: invRow.quantityAvailable - item.quantity,
            quantityReserved: invRow.quantityReserved + item.quantity,
            updatedAt: new Date(),
          })
          .where(eq(inventoryItems.id, item.inventoryItemId));

        // Insert reservation record
        const [reservation] = await tx
          .insert(inventoryReservations)
          .values({
            basketSessionId,
            customerId,
            inventoryItemId: item.inventoryItemId,
            quantity: item.quantity,
            status: "reserved",
            expiresAt: new Date(Date.now() + RESERVATION_TTL_MS),
          })
          .returning({ id: inventoryReservations.id });

        reservationIds.push(reservation!.id);
      });
    }

    // Enqueue expiry jobs AFTER all transactions commit (T-05-RES, D-07)
    // Deterministic jobId prevents duplicate jobs on restart (RESEARCH anti-pattern)
    for (const reservationId of reservationIds) {
      await reservationQueue.add(
        "release-reservation",
        { reservationId },
        {
          jobId: `release-reservation:${reservationId}`,
          delay: RESERVATION_TTL_MS,
          removeOnComplete: true,
          removeOnFail: { count: 3 },
        }
      );
    }

    return reservationIds;
  }

  /**
   * Mark a reservation as consumed and decrement quantityReserved.
   *
   * Called by OrderService.finalizeOrder() on payment success (D-21).
   * Decrements quantityReserved only — quantityAvailable was already decremented
   * at reservation time and stays decremented (item is now sold).
   */
  async consumeReservation(reservationId: string): Promise<void> {
    const { db } = this.deps;

    await db.transaction(async (tx) => {
      // Load the reservation
      const [reservation] = await tx
        .select()
        .from(inventoryReservations)
        .where(eq(inventoryReservations.id, reservationId))
        .limit(1);

      if (!reservation || reservation.status !== "reserved") {
        // Already consumed or expired — no-op (idempotent)
        return;
      }

      // Decrement quantityReserved (item sold, not returned to available)
      await tx
        .update(inventoryItems)
        .set({
          quantityReserved: sql`${inventoryItems.quantityReserved} - ${reservation.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, reservation.inventoryItemId));

      // Mark reservation consumed
      await tx
        .update(inventoryReservations)
        .set({ status: "consumed" })
        .where(eq(inventoryReservations.id, reservationId));
    });
  }

  /**
   * Release a reservation — returns reserved stock to quantityAvailable.
   *
   * Called by ReleaseReservationJob (the job processor delegates here) and
   * also usable directly for order cancellation flows.
   *
   * Idempotent: if reservation status is not 'reserved', returns without action.
   */
  async releaseReservation(reservationId: string): Promise<void> {
    const { db } = this.deps;

    // Load reservation (outside transaction — for idempotency pre-check)
    const rows = await db
      .select()
      .from(inventoryReservations)
      .where(eq(inventoryReservations.id, reservationId))
      .limit(1);

    const reservation = rows[0];
    if (!reservation || reservation.status !== "reserved") {
      // Already consumed or expired — no-op (idempotent, T-05-RES)
      return;
    }

    await db.transaction(async (tx) => {
      // Return stock to quantityAvailable + decrement quantityReserved (D-21)
      await tx
        .update(inventoryItems)
        .set({
          quantityAvailable: sql`${inventoryItems.quantityAvailable} + ${reservation.quantity}`,
          quantityReserved: sql`${inventoryItems.quantityReserved} - ${reservation.quantity}`,
          updatedAt: new Date(),
        })
        .where(eq(inventoryItems.id, reservation.inventoryItemId));

      // Mark reservation expired
      await tx
        .update(inventoryReservations)
        .set({ status: "expired" })
        .where(eq(inventoryReservations.id, reservationId));
    });
  }
}
