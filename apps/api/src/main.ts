import type { Worker } from "bullmq";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { productIndexQueue, reservationQueue, basketCleanupQueue } from "./modules/jobs/queues.js";
import {
  startProductIndexWorker,
  startReservationWorker,
  startBasketCleanupWorker,
} from "./modules/jobs/workers.js";

/**
 * Application entry point.
 *
 * Builds the Fastify app, starts the HTTP server, and wires graceful-shutdown
 * handlers for SIGINT and SIGTERM so in-flight requests are drained cleanly
 * before the process exits.
 *
 * Phase 3 addition (plan 03-07):
 *   The BullMQ product index worker is started AFTER fastify.listen() completes.
 *   This means the HTTP server starts cleanly even if the worker/queue has issues.
 *   Worker failures do not block API availability (T-03-W5, RESEARCH.md Open Question 1).
 *   On shutdown, the worker is closed BEFORE fastify.close() to drain in-flight jobs.
 *
 * Phase 5 addition (plan 05-10):
 *   startReservationWorker: processes inventory reservation expiry jobs (D-07, T-05-RES)
 *   startBasketCleanupWorker: processes expired basket session cleanup jobs (D-03)
 *   Both workers start AFTER fastify.listen() so HTTP server starts cleanly first.
 */
async function start() {
  const fastify = await buildApp();

  try {
    await fastify.listen({ port: env.PORT, host: "0.0.0.0" });
    fastify.log.info(`Grovio API listening on port ${env.PORT}`);
  } catch (err) {
    fastify.log.error(err);
    process.exit(1);
  }

  // ── Phase 3: Start product index worker AFTER HTTP server is up ──────────
  // Worker polls the product-index-queue and calls processProductIndexJob().
  // Concurrency 3 — starts only when OpenSearch is configured; otherwise a
  // no-op stub handles graceful degradation inside processProductIndexJob.
  // (RESEARCH.md Open Question 1 — start after listen, T-03-W5)
  let productIndexWorker: Worker | null = null;
  if (fastify.opensearch) {
    productIndexWorker = startProductIndexWorker({
      db: fastify.db,
      opensearch: fastify.opensearch,
      env: { NODE_ENV: env.NODE_ENV },
      logger: fastify.log,
    });
    fastify.log.info("ProductIndexWorker started");
  } else {
    fastify.log.warn(
      "OpenSearch not configured — ProductIndexWorker not started"
    );
  }

  // ── Phase 5: Start reservation expiry worker ─────────────────────────────
  // Processes BullMQ reservation-expiry-queue jobs (release stock on TTL expiry).
  // Concurrency 5 — each reservation is independent (D-07, T-05-RES).
  const reservationWorker = startReservationWorker({
    db: fastify.db,
    logger: fastify.log,
  });
  fastify.log.info("ReservationWorker started");

  // ── Phase 5: Start basket cleanup worker ─────────────────────────────────
  // Processes basket-cleanup-queue jobs (deletes expired basket sessions, D-03).
  // Concurrency 1 — single batch DELETE operation per job.
  const basketCleanupWorker = startBasketCleanupWorker({
    db: fastify.db,
    logger: fastify.log,
  });
  fastify.log.info("BasketCleanupWorker started");

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    fastify.log.info(`Received ${signal} — shutting down gracefully`);
    try {
      // Close workers before HTTP server — drain in-flight jobs first
      if (productIndexWorker) {
        await productIndexWorker.close();
        fastify.log.info("ProductIndexWorker closed");
      }
      await reservationWorker.close();
      fastify.log.info("ReservationWorker closed");
      await basketCleanupWorker.close();
      fastify.log.info("BasketCleanupWorker closed");

      // Drain queue Redis connections
      await productIndexQueue.close();
      await reservationQueue.close();
      await basketCleanupQueue.close();

      await fastify.close();
      fastify.log.info("Server closed");
      process.exit(0);
    } catch (err) {
      fastify.log.error(err, "Error during shutdown — forcing exit");
      process.exit(1);
    }
  };
  process.on("SIGINT", () => { void shutdown("SIGINT"); });
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
}

void start();
