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
 * Vendors must be exported before products (FK dependency):
 *   vendors → products → product-variants, product-images
 *
 * Current schema modules:
 *   - Plan 01-06: feature_flags table
 *   - Plan 02-02: categories, attribute_definitions, filter_schema_definitions,
 *                 product_templates, vendor_category_restrictions, category_metadata (+ 2 pgEnums)
 *   - Plan 03-03: vendors, products (+ productStatusEnum + GIN index),
 *                 product_variants, product_images
 */

// Category domain — exported in FK-dependency order (categories first)
export * from "./categories.js";
export * from "./attribute-definitions.js";
export * from "./filter-schema-definitions.js";
export * from "./product-templates.js";
export * from "./vendor-category-restrictions.js";
export * from "./category-metadata.js";

// Catalog domain — vendors before products (FK dependency); products before variants/images
export * from "./vendors.js";
export * from "./products.js";
export * from "./product-variants.js";
export * from "./product-images.js";

// Other domains
export * from "./feature-flags.js";
