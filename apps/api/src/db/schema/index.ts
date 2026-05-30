/**
 * Drizzle ORM schema barrel.
 *
 * This file is the single import point for all Drizzle table definitions.
 * Each domain module adds its own schema file and re-exports it here.
 *
 * Export order matters — Drizzle resolves FK references at module load time.
 * Categories must be exported before any table that references it:
 *   categories → attribute-definitions, filter-schema-definitions,
 *                product-templates, vendor-category-restrictions, category-metadata
 *
 * Current schema modules:
 *   - Plan 01-06: feature_flags table
 *   - Plan 02-02: categories, attribute_definitions, filter_schema_definitions,
 *                 product_templates, vendor_category_restrictions, category_metadata (+ 2 pgEnums)
 */

// Category domain — exported in FK-dependency order (categories first)
export * from "./categories.js";
export * from "./attribute-definitions.js";
export * from "./filter-schema-definitions.js";
export * from "./product-templates.js";
export * from "./vendor-category-restrictions.js";
export * from "./category-metadata.js";

// Other domains
export * from "./feature-flags.js";
