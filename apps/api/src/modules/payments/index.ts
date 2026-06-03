/**
 * Payments module barrel export.
 *
 * PAY-01 enforcement: External code may import PaymentProvider types and adapters here.
 * External code must NEVER import `stripe` or `razorpay` SDK types/modules directly.
 *
 * Exported:
 * - PaymentProvider interface + related types + ProviderNotConfiguredError
 * - StripeAdapter (infrastructure — SDK imports confined inside this file)
 * - RazorpayAdapter (infrastructure — SDK imports confined inside this file)
 * - PaymentService (application layer — no SDK imports)
 */

export type {
  CreatePaymentOrderParams,
  ProviderPaymentOrder,
  WebhookEvent,
  PaymentProvider,
} from "./PaymentProvider.js";
export { ProviderNotConfiguredError } from "./PaymentProvider.js";

export { StripeAdapter } from "./StripeAdapter.js";
export type { StripeAdapterOptions } from "./StripeAdapter.js";

export { RazorpayAdapter } from "./RazorpayAdapter.js";
export type { RazorpayAdapterOptions } from "./RazorpayAdapter.js";

export { PaymentService } from "./PaymentService.js";
