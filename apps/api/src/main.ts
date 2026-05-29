import { buildApp } from "./app.js";
import { env } from "./config/env.js";

/**
 * Application entry point.
 *
 * Builds the Fastify app, starts the HTTP server, and wires graceful-shutdown
 * handlers for SIGINT and SIGTERM so in-flight requests are drained cleanly
 * before the process exits.
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

  const shutdown = async (signal: string) => {
    fastify.log.info(`Received ${signal} — shutting down gracefully`);
    await fastify.close();
    fastify.log.info("Server closed");
    process.exit(0);
  };

  process.on("SIGINT", () => { void shutdown("SIGINT"); });
  process.on("SIGTERM", () => { void shutdown("SIGTERM"); });
}

void start();
