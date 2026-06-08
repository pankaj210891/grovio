import type { Job } from "bullmq";
import type { FastifyBaseLogger } from "fastify";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import { desc, sql } from "drizzle-orm";
import { searchQueryLog } from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Job payload type
// ---------------------------------------------------------------------------

/**
 * PopularSearchesJob payload.
 * Empty — the job always aggregates the full search log window.
 */
export interface PopularSearchesJobPayload {
  /** Days of history to look back (default: 7). */
  lookbackDays?: number;
}

// ---------------------------------------------------------------------------
// Processor deps
// ---------------------------------------------------------------------------

interface PopularSearchesJobDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
  logger: FastifyBaseLogger;
}

// ---------------------------------------------------------------------------
// Redis key + TTL
// ---------------------------------------------------------------------------

export const POPULAR_SEARCHES_CACHE_KEY = "search:popular";
const POPULAR_SEARCHES_TTL_SECONDS = 86400; // 24 hours

// ---------------------------------------------------------------------------
// processPopularSearchesJob
// ---------------------------------------------------------------------------

/**
 * Processes the PopularSearchesJob.
 *
 * Aggregates top 10 search query strings from search_query_log over the
 * last N days (default 7) and stores the result in Redis key `search:popular`
 * with a 24-hour TTL.
 *
 * Plan 11-05 T8.
 */
export async function processPopularSearchesJob(
  job: Job<PopularSearchesJobPayload>,
  deps: PopularSearchesJobDeps
): Promise<void> {
  const { db, redis, logger } = deps;
  const lookbackDays = job.data?.lookbackDays ?? 7;

  logger.info(
    { jobId: job.id, lookbackDays },
    "[PopularSearchesJob] Aggregating popular searches"
  );

  const since = new Date(Date.now() - lookbackDays * 24 * 60 * 60 * 1000);

  // Aggregate top 10 queries by frequency
  const rows = await db
    .select({
      query: searchQueryLog.query,
      count: sql<number>`COUNT(*)::int`,
    })
    .from(searchQueryLog)
    .where(sql`${searchQueryLog.searchedAt} >= ${since}`)
    .groupBy(searchQueryLog.query)
    .orderBy(desc(sql`COUNT(*)`))
    .limit(10);

  const popular = rows.map((r) => r.query);

  await redis.setex(
    POPULAR_SEARCHES_CACHE_KEY,
    POPULAR_SEARCHES_TTL_SECONDS,
    JSON.stringify(popular)
  );

  logger.info(
    { jobId: job.id, count: popular.length },
    "[PopularSearchesJob] Popular searches cached"
  );
}

// ---------------------------------------------------------------------------
// logSearchQuery (called by search routes to record each query)
// ---------------------------------------------------------------------------

/**
 * Logs a search query to search_query_log.
 * Called by the search route handler on every search request.
 * Async — does not block the search response.
 */
export async function logSearchQuery(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>,
  query: string,
  customerId?: string
): Promise<void> {
  if (!query.trim()) return;

  await db.insert(searchQueryLog).values({
    query: query.trim().toLowerCase(),
    customerId: customerId ?? null,
  });
}
