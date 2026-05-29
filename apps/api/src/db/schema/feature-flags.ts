import { boolean, jsonb, pgTable, text, timestamp, uuid } from "drizzle-orm/pg-core";

/**
 * feature_flags table
 *
 * Stores key/value feature flag configuration. Values are cached in Redis
 * (key pattern "ff:<key>") with a configurable TTL (FEATURE_FLAG_TTL_SECONDS).
 *
 * isEnabled=false flags are treated as non-existent by FeatureFlagService —
 * they return null on getFlag() and are excluded from getAllFlags().
 *
 * Write path (create/update/delete) is intentionally omitted here; it will be
 * added as a Phase 6 admin bolt-on via the admin panel API.
 */
export const featureFlags = pgTable("feature_flags", {
  id: uuid("id").defaultRandom().primaryKey(),
  key: text("key").notNull().unique(),
  value: text("value").notNull(),
  description: text("description"),
  isEnabled: boolean("is_enabled").notNull().default(true),
  metadata: jsonb("metadata"),
  createdAt: timestamp("created_at", { withTimezone: true }).defaultNow().notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).defaultNow().notNull(),
});

export type InsertFeatureFlag = typeof featureFlags.$inferInsert;
export type SelectFeatureFlag = typeof featureFlags.$inferSelect;
