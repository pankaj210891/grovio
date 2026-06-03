import { lt } from "drizzle-orm";
import type { Job } from "bullmq";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import { basketSessions } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

/** BasketExpiryJob has no payload — it cleans up all expired sessions */
// eslint-disable-next-line @typescript-eslint/no-empty-object-type
export interface BasketExpiryJobData {}

// ---------------------------------------------------------------------------
// Job processor dependencies
// ---------------------------------------------------------------------------

interface BasketExpiryJobDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// processBasketExpiryJob
// ---------------------------------------------------------------------------

/**
 * BullMQ job processor for cleaning up expired basket sessions (D-03).
 *
 * Deletes all basket_sessions rows where expiresAt < NOW().
 * FK cascade on basket_items means all associated items are removed automatically.
 *
 * Design:
 * - Idempotent: re-running deletes nothing if no expired sessions exist.
 * - Batch: single DELETE WHERE expiresAt < NOW() — DB handles all expired rows.
 * - No row-level lock needed: expired sessions are not being modified by active checkouts.
 *
 * Scheduled by startBasketCleanupWorker (workers.ts) as a recurring job.
 * Covers D-03 (30-day guest basket TTL cleanup).
 */
export async function processBasketExpiryJob(
  _job: Job<BasketExpiryJobData>,
  deps: BasketExpiryJobDeps
): Promise<void> {
  const { db } = deps;

  await db
    .delete(basketSessions)
    .where(lt(basketSessions.expiresAt, new Date()));
}
