import { z } from "zod";
import type { FastifyInstance } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { CheckoutService } from "../modules/checkout/index.js";
import { BasketSessionNotFoundError, EmptyBasketError } from "../modules/checkout/index.js";
import type { PaymentService } from "../modules/payments/index.js";
import type { CouponService } from "../modules/coupons/index.js";
import { CouponDisabledError, CouponInvalidError } from "../modules/coupons/index.js";
import { ProviderNotConfiguredError } from "../modules/payments/index.js";

/**
 * Checkout routes — all requireCustomerAuth (CHK-03, CHK-05, CHK-06, D-09).
 *
 * Security (T-05-06, T-05-04, T-05-PAY):
 *   - All routes require customer JWT (requireCustomerAuth preHandler on plugin)
 *   - computeSummary re-fetches catalog prices — basket snapshot prices never trusted (CHK-04)
 *   - placeOrder delegates to PaymentService — no stripe/razorpay SDK imports here (Pitfall 9)
 *   - apply-coupon rate-limit note: T-05-CPN mitigation is a short-circuit in CouponService
 *     when COUPONS_ENABLED=false (CHK-06); per-code redemption cap enforced in service
 *
 * D-09: GET /checkout/providers drives the payment method selection UI.
 */

/** Runtime guard — throws if requireCustomerAuth did not run. */
function getCustomerId(request: import("fastify").FastifyRequest): string {
  if (!request.customerId) {
    throw new Error("requireCustomerAuth must run before this handler");
  }
  return request.customerId;
}

// ── Input schemas ─────────────────────────────────────────────────────────────

const ComputeSummaryInputSchema = z.object({
  basketSessionId: z.string().uuid(),
  couponCode: z.string().optional(),
  walletRequestedMinor: z.number().int().min(0).optional(),
});

const InitiateCheckoutInputSchema = z.object({
  basketSessionId: z.string().uuid(),
});

const ApplyCouponInputSchema = z.object({
  basketSessionId: z.string().uuid(),
  couponCode: z.string().min(1).max(50),
  walletRequestedMinor: z.number().int().min(0).optional(),
});

const PlaceOrderInputSchema = z.object({
  basketSessionId: z.string().uuid(),
  addressId: z.string().uuid().nullable().optional(),
  paymentProvider: z.enum(["stripe", "razorpay"]),
  couponCode: z.string().optional(),
  walletRequestedMinor: z.number().int().min(0).optional(),
});

// ── checkoutRoutes plugin ─────────────────────────────────────────────────────

export async function checkoutRoutes(fastify: FastifyInstance): Promise<void> {
  // ── Customer JWT guard — protects ALL routes in this plugin (T-05-06) ────────
  fastify.addHook("preHandler", requireCustomerAuth);

  function getCheckoutService(): CheckoutService {
    return fastify.diContainer.resolve<CheckoutService>("checkoutService");
  }

  function getPaymentService(): PaymentService {
    return fastify.diContainer.resolve<PaymentService>("paymentService");
  }

  function getCouponService(): CouponService {
    return fastify.diContainer.resolve<CouponService>("couponService");
  }

  // ── GET /checkout/summary ──────────────────────────────────────────────────
  // Server-authoritative summary: catalog prices, coupon + wallet applied (CHK-04, WAL-05).
  fastify.get("/checkout/summary", async (request, reply) => {
    const query = request.query as {
      basketSessionId?: string;
      couponCode?: string;
      walletRequestedMinor?: string;
    };

    const params = ComputeSummaryInputSchema.parse({
      basketSessionId: query.basketSessionId,
      couponCode: query.couponCode,
      walletRequestedMinor: query.walletRequestedMinor
        ? Number(query.walletRequestedMinor)
        : undefined,
    });

    const checkoutService = getCheckoutService();

    try {
      const summary = await checkoutService.computeSummary({
        basketSessionId: params.basketSessionId,
        customerId: getCustomerId(request),
        couponCode: params.couponCode,
        walletRequestedMinor: params.walletRequestedMinor,
      });
      return reply.send({ success: true, data: summary });
    } catch (err) {
      if (err instanceof BasketSessionNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof EmptyBasketError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /checkout/initiate ────────────────────────────────────────────────
  // Reserve inventory at proceed-to-payment (CHK-05, D-06).
  // Reservation happens HERE — not on basket add.
  fastify.post("/checkout/initiate", async (request, reply) => {
    const body = InitiateCheckoutInputSchema.parse(request.body);
    const checkoutService = getCheckoutService();

    try {
      const result = await checkoutService.initiateCheckout({
        customerId: getCustomerId(request),
        basketSessionId: body.basketSessionId,
      });
      return reply.send({ success: true, data: result });
    } catch (err) {
      if (err instanceof BasketSessionNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof EmptyBasketError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /checkout/apply-coupon ────────────────────────────────────────────
  // Validate a coupon code server-side and return the updated summary (CHK-06).
  // T-05-CPN: COUPONS_ENABLED feature flag short-circuits in CouponService.
  fastify.post("/checkout/apply-coupon", async (request, reply) => {
    const body = ApplyCouponInputSchema.parse(request.body);
    const checkoutService = getCheckoutService();

    try {
      // computeSummary with coupon code validates server-side (CHK-06)
      const summary = await checkoutService.computeSummary({
        basketSessionId: body.basketSessionId,
        customerId: getCustomerId(request),
        couponCode: body.couponCode,
        walletRequestedMinor: body.walletRequestedMinor,
      });
      return reply.send({ success: true, data: summary });
    } catch (err) {
      if (err instanceof CouponDisabledError) {
        return reply.status(403).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof CouponInvalidError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof BasketSessionNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof EmptyBasketError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── POST /checkout/place-order ─────────────────────────────────────────────
  // Recompute summary + create provider payment order + create pending order (CHK-03, CHK-04).
  // Returns { orderId, displayId, clientSecret, providerOrderRef, providerOrderId }
  fastify.post("/checkout/place-order", async (request, reply) => {
    const body = PlaceOrderInputSchema.parse(request.body);
    const checkoutService = getCheckoutService();

    try {
      const result = await checkoutService.placeOrder({
        customerId: getCustomerId(request),
        addressId: body.addressId ?? null,
        basketSessionId: body.basketSessionId,
        paymentProvider: body.paymentProvider,
        couponCode: body.couponCode,
        walletRequestedMinor: body.walletRequestedMinor,
      });
      return reply.status(201).send({ success: true, data: result });
    } catch (err) {
      if (err instanceof BasketSessionNotFoundError) {
        return reply.status(404).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof EmptyBasketError) {
        return reply.status(422).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      if (err instanceof ProviderNotConfiguredError) {
        return reply.status(400).send({
          success: false,
          error: { code: err.code, message: err.message },
        });
      }
      throw err;
    }
  });

  // ── GET /checkout/providers ────────────────────────────────────────────────
  // Returns which payment providers are enabled (drives UI provider selection, D-09).
  fastify.get("/checkout/providers", async (_request, reply) => {
    const paymentService = getPaymentService();
    const providers = paymentService.getEnabledProviders();
    return reply.send({ success: true, data: providers });
  });
}
