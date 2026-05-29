/**
 * @grovio/contracts/money — Money utilities sub-path export
 *
 * Independently importable from "@grovio/contracts/money".
 * Does NOT import HTTP types — safe for backend commission/payout code
 * without pulling in API envelope types.
 *
 * Import example:
 *   import { allocate, type Money } from "@grovio/contracts/money";
 */

export {
  type Money,
  type MinorUnitAmount,
  type CurrencyCode,
  MINOR_UNIT_CONVENTION,
} from "./types.js";

export { allocate } from "./allocate.js";
