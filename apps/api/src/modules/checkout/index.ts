/**
 * Checkout module barrel export.
 *
 * Exports CheckoutService, domain errors, and input/output types for
 * DI container registration and route handler usage.
 */

export {
  CheckoutService,
  BasketSessionNotFoundError,
  EmptyBasketError,
} from "./CheckoutService.js";

export type {
  ProductCatalogLookup,
  CheckoutSummary,
  CheckoutItem,
  ComputeSummaryParams,
  InitiateCheckoutParams,
  InitiateCheckoutResult,
  PlaceOrderParams,
  PlaceOrderResult,
} from "./CheckoutService.js";
