/**
 * @grovio/contracts — category domain barrel export
 *
 * Re-exports all category contract types and Zod schemas.
 * Consumers import from "@grovio/contracts" (via root index.ts) or directly
 * from "@grovio/contracts/category" if tree-shaking is a concern.
 */

export * from "./blocks.js";
export * from "./tree.js";
export * from "./attribute-definition.js";
export * from "./filter-schema.js";
export * from "./product-template.js";
export * from "./vendor-restriction.js";
export * from "./metadata.js";
