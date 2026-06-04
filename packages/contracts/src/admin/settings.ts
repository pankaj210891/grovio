import { z } from "zod";

/**
 * Marketplace settings contract types for Phase 6: Vendor & Admin Tools.
 *
 * Per ADM-05, D-19: marketplace_settings table — key TEXT PRIMARY KEY, value JSONB, updated_at.
 *   Settings are grouped into UI sections: General, Branding, Email.
 *   SettingsService wraps DB reads with Redis caching (same TTL/invalidation pattern as FeatureFlagService).
 *
 * Per D-19: MarketplaceSettingKey values are the canonical snake_case keys stored
 *   in the marketplace_settings.key column.
 *
 * Settings key naming: snake_case strings (e.g., store_name, primary_color).
 *   SettingsService exposes typed getters that parse value JSONB to the correct TS type.
 */

// ---------------------------------------------------------------------------
// Marketplace Setting Keys (D-19, ADM-05)
// ---------------------------------------------------------------------------

/**
 * Enumeration of all valid marketplace setting keys.
 * Values are stored as-is in marketplace_settings.key column.
 *
 * Grouped by admin UI section:
 *   General: store_name, default_currency, timezone, default_return_window_days, low_stock_threshold
 *   Branding: primary_color, logo_url, favicon_url
 *   Email: smtp_sender_name, smtp_sender_email
 */
export const MarketplaceSettingKeySchema = z.enum([
  // General settings
  "store_name",
  "default_currency",
  "timezone",
  "default_return_window_days",
  "low_stock_threshold",
  // Branding settings
  "primary_color",
  "logo_url",
  "favicon_url",
  // Email settings
  "smtp_sender_name",
  "smtp_sender_email",
]);

/** TypeScript type inferred from MarketplaceSettingKeySchema */
export type MarketplaceSettingKey = z.infer<typeof MarketplaceSettingKeySchema>;

// ---------------------------------------------------------------------------
// Update Setting Input (D-19, ADM-05)
// ---------------------------------------------------------------------------

/**
 * Input for updating a single marketplace setting.
 * Submitted via PATCH /admin/settings.
 *
 * value is z.unknown() because each key has a different value type:
 *   - store_name, timezone, primary_color, etc. → string
 *   - default_return_window_days, low_stock_threshold → number
 *   Server-side validation applies per-key type coercion from the JSONB value.
 */
export const UpdateSettingInputSchema = z.object({
  /** The setting key to update */
  key: MarketplaceSettingKeySchema,
  /** The new value (type depends on key — validated server-side per JSONB schema) */
  value: z.unknown(),
});

/** TypeScript type inferred from UpdateSettingInputSchema */
export type UpdateSettingInput = z.infer<typeof UpdateSettingInputSchema>;

// ---------------------------------------------------------------------------
// Marketplace Settings Response (D-19, ADM-05)
// ---------------------------------------------------------------------------

/**
 * Full marketplace settings response returned by GET /admin/settings.
 * A record mapping each setting key to its current JSONB value.
 *
 * Typed as Partial to handle missing keys (settings may not be seeded for all keys).
 */
export const MarketplaceSettingsResponseSchema = z.record(
  MarketplaceSettingKeySchema,
  z.unknown()
);

/** TypeScript type inferred from MarketplaceSettingsResponseSchema */
export type MarketplaceSettingsResponse = z.infer<typeof MarketplaceSettingsResponseSchema>;
