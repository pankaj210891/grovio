import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Returns true when the given Redis connection URL requires TLS.
 *
 * Triggers on the `rediss://` scheme (two s's), which is the standard scheme
 * for TLS-encrypted Redis connections (Upstash, AWS ElastiCache TLS, etc.).
 *
 * Pure function (no Fastify dependency) so it can be unit-tested independently.
 *
 * Note: ioredis does parse `rediss://` internally and enables TLS, but some
 * versions strip TLS during URL parsing. The explicit `tls: {}` option passed
 * alongside the URL is belt-and-suspenders defense against that bug.
 */
export function detectRedisTls(url: string): boolean {
  return url.startsWith("rediss://");
}

/**
 * Fastify plugin that creates an ioredis client and decorates the Fastify
 * instance with `fastify.redis`.
 *
 * Uses fastify-plugin so the decoration is available outside plugin scope.
 */
const redisPlugin = fp(
  async (fastify) => {
    const isTls = detectRedisTls(env.REDIS_URL);

    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
      // Explicit tls: {} is required as belt-and-suspenders: some ioredis versions strip TLS
      // during URL parsing even when the rediss:// scheme is present (Pitfall 3).
      ...(isTls ? { tls: {} } : {}),
    });

    // Verify connectivity at startup.
    await redis.connect();
    await redis.ping();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info(`Redis client connected (tls=${isTls})`);
  },
  { name: "redis" },
);

export default redisPlugin;
