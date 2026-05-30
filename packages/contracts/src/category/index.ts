/**
 * @grovio/contracts — category domain barrel export
 *
 * Exports all category-related Zod schemas and TypeScript types.
 * Import order matches dependency graph (blocks before metadata; attribute-definition before filter-schema).
 *
 * Import example:
 *   import { AttributeOption, MerchandisingBlock, CategoryTreeNode } from "@grovio/contracts";
 */

export * from "./blocks.js";
export * from "./tree.js";
export * from "./attribute-definition.js";
export * from "./filter-schema.js";
export * from "./product-template.js";
export * from "./vendor-restriction.js";
export * from "./metadata.js";
