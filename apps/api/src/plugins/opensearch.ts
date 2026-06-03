import fp from "fastify-plugin";
import { Client } from "@opensearch-project/opensearch";
import { env } from "../config/env.js";

/**
 * Fastify plugin that optionally initialises an OpenSearch client and
 * decorates the Fastify instance with `fastify.opensearch`.
 *
 * If `OPENSEARCH_URL` is not set (e.g. local dev without a cluster, or
 * environments where search is disabled), the plugin logs a warning and
 * decorates with `null` instead of throwing. The API boots cleanly without
 * OpenSearch — SearchService uses `isAvailable()` to gate all queries.
 *
 * When `OPENSEARCH_URL` is set, the plugin:
 * - Constructs a `Client` pointing at the URL (credentials embedded as Basic Auth).
 * - Decorates `fastify.opensearch` with the client instance.
 * - Registers an `onClose` hook to gracefully close the connection on shutdown.
 *
 * Uses `fastify-plugin` (fp) so the decoration escapes plugin scope and is
 * available to all downstream plugins and route handlers.
 *
 * Named "opensearch" so Fastify's dependency graph can order it correctly.
 *
 * Pattern source: mirrors apps/api/src/plugins/redis.ts exactly.
 * Research ref: RESEARCH.md Pattern 2; PATTERNS.md opensearch.ts adaptation.
 */
const opensearchPlugin = fp(
  async (fastify) => {
    if (!env.OPENSEARCH_URL) {
      fastify.log.warn(
        "OPENSEARCH_URL is not set — search features are disabled. " +
          "Set OPENSEARCH_URL to enable full-text search and type-ahead suggestions."
      );
      fastify.decorate("opensearch", null);
      return;
    }

    const client = new Client({
      node: env.OPENSEARCH_URL,
      // In dev on Windows, Node's system CA store often lacks the Bonsai/Neon
      // intermediate cert. Disable rejection only in development.
      ...(env.NODE_ENV === "development" && { ssl: { rejectUnauthorized: false } }),
    });

    fastify.decorate("opensearch", client);

    fastify.addHook("onClose", async () => {
      await client.close();
    });

    fastify.log.info("OpenSearch client connected");
  },
  { name: "opensearch" }
);

export default opensearchPlugin;
