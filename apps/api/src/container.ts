import { asValue, createContainer, InjectionMode } from "awilix";
import type { FastifyInstance } from "fastify";

/**
 * Create the Awilix DI container for the application.
 *
 * Uses PROXY injection mode — resolvers receive a proxy object whose
 * property accesses trigger lazy resolution from the container.
 * No decorator metadata (`reflect-metadata`) required.
 *
 * The container is pre-populated with core infrastructure values derived
 * from the Fastify instance. Domain service registrations are added in
 * subsequent plans (feature flags in 01-06, auth in 02-x, etc.).
 *
 * @param fastify - The fully-initialised Fastify instance (after plugin registration)
 */
export function createAppContainer(fastify: FastifyInstance) {
  const container = createContainer({ injectionMode: InjectionMode.PROXY });

  // Register core infrastructure as values so domain services can receive
  // them via constructor injection without knowing about Fastify internals.
  container.register({
    db: asValue(fastify.db),
    redis: asValue(fastify.redis),
    logger: asValue(fastify.log),
  });

  return container;
}

export type AppContainer = ReturnType<typeof createAppContainer>;
