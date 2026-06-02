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
 * Customers must be exported before tables that reference it:
 *   customers → password-reset-tokens, customer-addresses
 * Phase 5 FK order:
 *   customers → basket-sessions → basket-items
 *   products + product-variants → inventory-items → inventory-reservations
 *   customers + customer-addresses → orders → vendor-orders → order-items
 *   customers → wallet-entries
 *   vendor-orders → vendor-commission-entries
 *   orders + vendor-orders + customers → return-requests
 *   vendors → vendor-return-policies
 *   vendors + categories → commission-rules
 *
 * Current schema modules:
 *   - Plan 01-06: feature_flags table
 *   - Plan 02-02: categories, attribute_definitions, filter_schema_definitions,
 *                 product_templates, vendor_category_restrictions, category_metadata (+ 2 pgEnums)
 *   - Plan 03-03: vendors, products (+ productStatusEnum + GIN index),
 *                 product_variants, product_images
 *   - Plan 04-02: customers, password_reset_tokens, customer_addresses, homepage_blocks
 *   - Plan 05-03: Phase 5 commerce tables (basket, inventory, orders, wallet, payments,
 *                 commissions, coupons, returns)
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

// Customer domain — customers before password-reset-tokens and customer-addresses (FK dependency)
export * from "./customers.js";
export * from "./password-reset-tokens.js";
export * from "./customer-addresses.js";
export * from "./homepage-blocks.js";

// Other domains
export * from "./feature-flags.js";

// Plan 05-03: Phase 5 commerce tables — exported in FK-dependency order
// Basket domain: basket-sessions before basket-items (FK dependency)
export * from "./basket-sessions.js";
export * from "./basket-items.js";

// Inventory domain: inventory-items before inventory-reservations (FK dependency)
export * from "./inventory-items.js";
export * from "./inventory-reservations.js";

// Order domain: orders before vendor-orders before order-items (FK chain)
export * from "./orders.js";
export * from "./vendor-orders.js";
export * from "./order-items.js";

// Wallet domain: wallet-entries after customers (FK dependency)
export * from "./wallet-entries.js";

// Payment domain: payment-events (no FK dependencies beyond the pgEnum)
export * from "./payment-events.js";

// Commission domain: commission-rules after vendors + categories; entries after vendor-orders
export * from "./commission-rules.js";
export * from "./vendor-commission-entries.js";

// Coupon domain: coupons (no FK dependencies — scopeId is a loose reference)
export * from "./coupons.js";

// Returns domain: return-requests after orders + vendor-orders + customers
export * from "./return-requests.js";

// Vendor return policies: vendor-return-policies after vendors
export * from "./vendor-return-policies.js";
