import { Worker, type Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Client } from "@opensearch-project/opensearch";
import type { Env } from "../../config/env.js";
import { bullMqConnection } from "./queues.js";
import { processProductIndexJob } from "./product-index-job.js";

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
