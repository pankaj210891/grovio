import {
  jsonb,
  pgTable,
  text,
  timestamp,
} from "drizzle-orm/pg-core";

/**
 * marketplace_settings table — key/value store for platform-level configuration (D-19, ADM-05).
 *
 * Stores admin-configurable marketplace settings grouped into sections:
 * - General: store_name, default_currency, timezone, default_return_window_days
 * - Branding: primary_color (hex), logo_url, favicon_url
 * - Email: smtp_sender_name, smtp_sender_email
 * - Integration visibility: Stripe/Razorpay keys (display only — masked, no secret key editing)
 *
 * Key design decisions:
 * - key is the PRIMARY KEY (no separate id column) — settings are identified by key.
 *   This enables simple UPSERT-based writes: INSERT ... ON CONFLICT (key) DO UPDATE.
 * - value is JSONB: allows typed settings (string, number, boolean, object) without
 *   requiring schema changes when adding new setting types.
 * - SettingsService reads with Redis-first cache (same pattern as FeatureFlagService):
 *   Redis key = "settings:<key>", TTL from FEATURE_FLAG_TTL_SECONDS env var.
 * - Cache is invalidated on every updateSetting() call (D-19 pattern).
 * - Settings keys are canonical snake_case strings; the full set is defined as
 *   MarketplaceSettingKeySchema z.enum in packages/contracts/src/admin/settings.ts.
 *
 * Analogs:
 * - feature_flags.ts: key text PK, value, updatedAt — this table mirrors that pattern
 *   but uses JSONB value (not text) and omits id, isEnabled, description columns.
 *
 * Covers D-19, ADM-05.
 */
export const marketplaceSettings = pgTable("marketplace_settings", {
  /**
   * Setting key (primary key). Canonical snake_case identifier.
   * Examples: 'store_name', 'default_currency', 'primary_color', 'smtp_sender_email'.
   * Full set of valid keys: MarketplaceSettingKeySchema in @grovio/contracts.
   * The key IS the primary key — no auto-generated id column (D-19).
   */
  key: text("key").primaryKey(),

  /**
   * Setting value stored as JSONB.
   * Parsed by SettingsService typed getters to the correct TypeScript type.
   * Examples:
   * - 'store_name': "Grovio Marketplace" (string)
   * - 'default_return_window_days': 30 (number)
   * - 'primary_color': "#4F46E5" (string)
   * - 'logo_url': "https://..." (string)
   */
  value: jsonb("value").notNull(),

  /**
   * Timestamp of the last update to this setting row.
   * Set by the UPSERT operation in SettingsService.updateSetting().
   * Cache invalidation happens atomically after each write.
   */
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new marketplace_settings row */
export type InsertMarketplaceSetting = typeof marketplaceSettings.$inferInsert;

/** TypeScript type for selecting a marketplace_settings row */
export type SelectMarketplaceSetting = typeof marketplaceSettings.$inferSelect;
