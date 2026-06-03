import { Worker, type Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "@opensearch-project/opensearch";
import type { Env } from "../../config/env.js";
import { bullMqConnection } from "./queues.js";
import { processProductIndexJob } from "./product-index-job.js";
import { processReleaseReservationJob } from "./release-reservation-job.js";
import { processBasketExpiryJob } from "./basket-expiry-job.js";

// ---------------------------------------------------------------------------
// Worker factory dependencies
// ---------------------------------------------------------------------------

interface ProductIndexWorkerDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  opensearch: Client;
  env: Pick<Env, "NODE_ENV">;
  logger: FastifyBaseLogger;
}

// ---------------------------------------------------------------------------
// startProductIndexWorker
// ---------------------------------------------------------------------------

/**
 * Creates and starts the BullMQ Worker for the product-index-queue.
 *
 * Design decisions:
 * - Uses the same dedicated `bullRedis` connection as the queue (Pitfall 1).
 * - Concurrency 3: handles 3 index jobs in parallel — suitable for v1 catalog
 *   sizes without overwhelming OpenSearch.
 * - `failed` event: logs errors so failed jobs are visible in server logs.
 *   Bull-board (dev) or BullMQ dashboard can inspect the dead-letter queue.
 * - Should be called in main.ts AFTER fastify.listen(), not inside buildApp(),
 *   so the HTTP server starts cleanly before the Worker begins polling.
 *   (RESEARCH.md Open Question 1 recommendation.)
 *
 * @param deps - Injected dependencies passed to each job processor.
 * @returns The started Worker instance (useful for graceful shutdown).
 */
export function startProductIndexWorker(
  deps: ProductIndexWorkerDeps
): Worker {
  const worker = new Worker(
    "product-index-queue",
    async (job: Job) => {
      await processProductIndexJob(job, deps);
    },
    {
      connection: bullMqConnection,
      concurrency: 3,
    }
  );

  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, error: err.message },
      "[ProductIndexWorker] Job failed"
    );
  });

  return worker;
}

// ---------------------------------------------------------------------------
// ReservationWorker deps + factory
// ---------------------------------------------------------------------------

interface ReservationWorkerDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  logger: FastifyBaseLogger;
}

/**
 * Creates and starts the BullMQ Worker for the reservation-expiry-queue.
 *
 * Processes ReleaseReservationJob payloads: returns stock to quantityAvailable
 * when the 15-minute reservation TTL elapses (D-07, T-05-RES).
 *
 * - Concurrency 5: handles 5 expiry jobs in parallel — reservations are
 *   independent rows, so parallel processing is safe.
 * - Idempotent processor: no-op if reservation already consumed/expired.
 * - `failed` event: logs errors for visibility in server logs / bull-board.
 *
 * @param deps - Injected dependencies for the job processor.
 * @returns The started Worker instance.
 */
export function startReservationWorker(
  deps: ReservationWorkerDeps
): Worker {
  const worker = new Worker(
    "reservation-expiry-queue",
    async (job: Job) => {
      await processReleaseReservationJob(job, deps);
    },
    {
      connection: bullMqConnection,
      concurrency: 5,
    }
  );

  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, error: err.message },
      "[ReservationWorker] Job failed"
    );
  });

  return worker;
}

// ---------------------------------------------------------------------------
// BasketCleanupWorker deps + factory
// ---------------------------------------------------------------------------

interface BasketCleanupWorkerDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  logger: FastifyBaseLogger;
}

/**
 * Creates and starts the BullMQ Worker for the basket-cleanup-queue.
 *
 * Processes BasketExpiryJob payloads: deletes basket_sessions rows where
 * expiresAt < NOW(), cascading to basket_items (D-03, 30-day TTL cleanup).
 *
 * - Concurrency 1: cleanup is a single batch DELETE — no need for parallelism.
 * - Job is typically a recurring/scheduled job: one instance runs periodically.
 * - `failed` event: logs errors for visibility.
 *
 * @param deps - Injected dependencies for the job processor.
 * @returns The started Worker instance.
 */
export function startBasketCleanupWorker(
  deps: BasketCleanupWorkerDeps
): Worker {
  const worker = new Worker(
    "basket-cleanup-queue",
    async (job: Job) => {
      await processBasketExpiryJob(job, deps);
    },
    {
      connection: bullMqConnection,
      concurrency: 1,
    }
  );

  worker.on("failed", (job, err) => {
    deps.logger.error(
      { jobId: job?.id, error: err.message },
      "[BasketCleanupWorker] Job failed"
    );
  });

  return worker;
}
