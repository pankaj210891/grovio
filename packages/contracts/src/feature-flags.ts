import { z } from "zod";

/**
 * Schema for a single feature flag entry.
 *
 * Designed per D-06: Phase 6 admin UI can be bolted on without schema changes.
 * The value field supports boolean, string, and number to allow richer flags in Phase 6.
 */
export const FeatureFlagSchema = z.object({
  /** Flag key — e.g., "wallet_enabled", "stripe_enabled" */
  key: z.string().min(1),
  /**
   * Flag value — supports boolean, string, or number for Phase 6 admin UI extensibility.
   * Phase 1–5: primarily boolean values.
   */
  value: z.union([z.boolean(), z.string(), z.number()]),
  /** Human-readable description for admin UI display (Phase 6) */
  description: z.string().optional(),
  /** Whether this flag is currently active */
  enabled: z.boolean(),
});

/** TypeScript type inferred from FeatureFlagSchema */
export type FeatureFlag = z.infer<typeof FeatureFlagSchema>;

/** Schema for a map of all feature flags, keyed by flag key */
export const FeatureFlagMapSchema = z.record(z.string(), FeatureFlagSchema);

/** TypeScript type for a feature flag map */
export type FeatureFlagMap = z.infer<typeof FeatureFlagMapSchema>;
