import fp from "fastify-plugin";
import { createAppContainer } from "../container.js";

/**
 * Fastify plugin that bootstraps the Awilix DI container.
 *
 * Manual bootstrap pattern used instead of @fastify/awilix — Fastify 5
 * compatibility requires @fastify/awilix@5.x which is not yet released on
 * the stable channel. The manual pattern is simpler, has no extra dependencies,
 * and is compatible with Awilix 13.x InjectionMode.PROXY.
 *
 * After registration, the container is accessible via `fastify.diContainer`.
 * Plugins registered after this one can resolve services from the container.
 *
 * Registered in app.ts AFTER drizzle and redis plugins so `fastify.db` and
 * `fastify.redis` are available when createAppContainer() is called.
 */
const awilixPlugin = fp(
  async (fastify) => {
    const container = createAppContainer(fastify);

    fastify.decorate("diContainer", container);

    fastify.addHook("onClose", async () => {
      await container.dispose();
    });

    fastify.log.info("Awilix DI container initialised");
  },
  {
    name: "awilix",
    dependencies: ["drizzle", "redis"],
  },
);

export default awilixPlugin;
