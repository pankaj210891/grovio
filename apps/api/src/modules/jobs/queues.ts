import { Queue } from "bullmq";
import { env } from "../../config/env.js";
import { detectRedisTls } from "../../plugins/redis.js";

// ---------------------------------------------------------------------------
// BullMQ connection options
// ---------------------------------------------------------------------------

/**
 * Connection options for BullMQ Queue and Worker.
 *
 * CRITICAL: BullMQ MUST use a dedicated connection with `maxRetriesPerRequest: null`.
 * BullMQ uses Redis blocking commands (BRPOPLPUSH, BLPOP). Without this option,
 * ioredis throws MaxRetriesPerRequestError on blocking calls, which kills the
 * Worker silently (Pitfall 1 from RESEARCH.md).
 *
 * We pass a `RedisOptions` config object (not a Redis instance) to BullMQ.
 * This avoids the ioredis version mismatch TypeScript error that occurs when
 * our ioredis@5.11.0 Redis instance is passed to BullMQ's internal ioredis@5.10.1
 * type expectations (two distinct class types in strict mode).
 *
 * BullMQ's BaseOptions.url accepts the full Redis URL — the library will
 * parse and connect using its own internally-managed ioredis connection.
 *
 * enableReadyCheck: false — required for Upstash managed Redis.
 * maxRetriesPerRequest: null — REQUIRED by BullMQ (Pitfall 1).
 * TLS: mirrors the detectRedisTls() utility from plugins/redis.ts.
 */
const isTls = detectRedisTls(env.REDIS_URL);

export const bullMqConnection = {
  url: env.REDIS_URL,
  maxRetriesPerRequest: null as null, // REQUIRED by BullMQ (Pitfall 1)
  enableReadyCheck: false,
  ...(isTls ? { tls: {} } : {}),
};

// ---------------------------------------------------------------------------
// Product index queue
// ---------------------------------------------------------------------------

/**
 * BullMQ Queue for product index jobs.
 *
 * Jobs are enqueued by ProductService.approveProduct() (action: 'index') and
 * ProductService.rejectProduct() / archiveProduct() (action: 'delete').
 *
 * Job payload: { productId: string, action: 'index' | 'delete' }
 *
 * Workers are started in main.ts after fastify.listen() so the HTTP server
 * starts cleanly first — Worker failures do not block API startup.
 * (RESEARCH.md Open Question 1 recommendation.)
 */
export const productIndexQueue = new Queue("product-index-queue", {
  connection: bullMqConnection,
});
