import fp from "fastify-plugin";
import { Redis } from "ioredis";
import { env } from "../config/env.js";

/**
 * Fastify plugin that creates an ioredis client and decorates the Fastify
 * instance with `fastify.redis`.
 *
 * Uses fastify-plugin so the decoration is available outside plugin scope.
 */
const redisPlugin = fp(
  async (fastify) => {
    const redis = new Redis(env.REDIS_URL, {
      lazyConnect: true,
      enableReadyCheck: true,
    });

    // Verify connectivity at startup.
    await redis.connect();
    await redis.ping();

    fastify.decorate("redis", redis);

    fastify.addHook("onClose", async () => {
      await redis.quit();
    });

    fastify.log.info("Redis client connected");
  },
  { name: "redis" },
);

export default redisPlugin;
