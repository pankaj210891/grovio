/**
 * Drizzle ORM schema barrel.
 *
 * This file is the single import point for all Drizzle table definitions.
 * Each domain module will add its own schema file and re-export it here.
 *
 * Current state: empty — schema tables are added in subsequent plans:
 *   - Plan 01-06: FeatureFlags table (first schema addition)
 *   - Plan 02-x:  Users, Sessions, RefreshTokens
 *   - ...and so on per the Phase 1–8 roadmap.
 *
 * Example (how to add a schema in a future plan):
 *   export * from "./feature-flags.js";
 */

export * from "./feature-flags.js";
