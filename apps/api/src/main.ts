import type { Worker } from "bullmq";
import { buildApp } from "./app.js";
import { env } from "./config/env.js";
import { productIndexQueue } from "./modules/jobs/queues.js";
import { startProductIndexWorker } from "./modules/jobs/workers.js";

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
  let worker: Worker | null = null;
  if (fastify.opensearch) {
    // Only start the worker when OpenSearch is available; skip otherwise.
    worker = startProductIndexWorker({
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

  let shuttingDown = false;

  const shutdown = async (signal: string) => {
    if (shuttingDown) return;
    shuttingDown = true;
    fastify.log.info(`Received ${signal} — shutting down gracefully`);
    try {
      if (worker) {
        await worker.close();
        fastify.log.info("ProductIndexWorker closed");
      }
      await productIndexQueue.close(); // drain queue Redis connection
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
