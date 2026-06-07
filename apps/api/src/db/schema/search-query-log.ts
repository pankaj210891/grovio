import { index, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * search_query_log table
 *
 * Append-only log of customer search queries. Used by PopularSearchesJob
 * (Plan 11-05 T8) to aggregate the top 10 popular search queries via daily
 * BullMQ job, cached in Redis key `search:popular`.
 *
 * customer_id is nullable — guest searches are also logged (no auth required
 * for search). Not a FK reference to avoid issues with guest sessions.
 *
 * Index on created_at enables efficient time-range aggregation queries
 * (e.g., last 7 days or last 30 days).
 *
 * Plan 11-05 T8.
 */
export const searchQueryLog = pgTable(
  "search_query_log",
  {
    id: uuid("id").defaultRandom().primaryKey(),

    /** The search query string entered by the user. */
    query: text("query").notNull(),

    /**
     * Customer ID if authenticated, null for guest searches.
     * Loose reference (no FK) to avoid cascade issues.
     */
    customerId: uuid("customer_id"),

    /** When the search was performed. Used for time-range aggregation. */
    searchedAt: timestamp("searched_at", { withTimezone: true })
      .defaultNow()
      .notNull(),
  },
  (t) => [
    /** Index on searched_at for efficient time-range aggregation. */
    index("search_query_log_searched_at_idx").on(t.searchedAt),

    /** Index on query for group-by aggregation efficiency. */
    index("search_query_log_query_idx").on(t.query),
  ]
);

/** TypeScript type for inserting a new search_query_log row */
export type InsertSearchQueryLog = typeof searchQueryLog.$inferInsert;

/** TypeScript type for selecting a search_query_log row */
export type SelectSearchQueryLog = typeof searchQueryLog.$inferSelect;
