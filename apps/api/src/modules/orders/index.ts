/**
 * Orders module barrel export.
 *
 * Exports OrderService, domain errors, and input/output types for
 * DI container registration and route handler usage.
 */

export {
  OrderService,
  OrderNotFoundError,
  OrderOwnershipError,
  VendorOrderOwnershipError,
} from "./OrderService.js";

export type {
  OrderItemInput,
  OrderTotals,
  CreatePendingOrderParams,
  CreatePendingOrderResult,
  OrderDetail,
} from "./OrderService.js";
