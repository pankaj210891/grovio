/**
 * @grovio/contracts — catalog domain barrel export
 *
 * Re-exports all catalog contract types and Zod schemas.
 * Consumers import from "@grovio/contracts" (via root index.ts) or directly
 * from "@grovio/contracts/catalog" if tree-shaking is a concern.
 */

export * from "./product.js";
export * from "./variant.js";
export * from "./image.js";
