/**
 * @grovio/contracts — search domain barrel export
 *
 * Re-exports all search contract types and Zod schemas.
 * Consumers import from "@grovio/contracts" (via root index.ts) or directly
 * from "@grovio/contracts/search" if tree-shaking is a concern.
 */

export * from "./query.js";
export * from "./suggest.js";
export * from "./filter.js";
