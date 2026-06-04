import { z } from "zod";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { requireCustomerAuth } from "../middleware/customerAuth.js";
import type { CheckoutService } from "../modules/checkout/index.js";
import { BasketSessionNotFoundError, EmptyBasketError } from "../modules/checkout/index.js";
import type { PaymentService } from "../modules/payments/index.js";
import type { CouponService } from "../modules/coupons/index.js";
import { CouponDisabledError, CouponInvalidError } from "../modules/coupons/index.js";
import { ProviderNotConfiguredError } from "../modules/payments/index.js";
import type { BasketService } from "../modules/basket/index.js";
import { BasketNotFoundError } from "../modules/basket/index.js";

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
// basketSessionId is intentionally absent from all schemas: it is an httpOnly
// cookie value that JS cannot read. The routes resolve it server-side via
// resolveBasketSessionId() using the authenticated customerId (CHK-03).

const ComputeSummaryInputSchema = z.object({
  couponCode: z.string().optional(),
  walletRequestedMinor: z.number().int().min(0).optional(),
});

// addressId + deliveryOption come from the storefront delivery step
const InitiateCheckoutInputSchema = z.object({
  addressId: z.string().uuid().optional(),
  deliveryOption: z.string().optional(),
});

const ApplyCouponInputSchema = z.object({
  couponCode: z.string().min(1).max(50),
  walletRequestedMinor: z.number().int().min(0).optional(),
});

const PlaceOrderInputSchema = z.object({
  addressId: z.string().uuid().nullable().optional(),
  paymentProvider: z.enum(["stripe", "razorpay"]),
  couponCode: z.string().nullable().optional(),
  // Storefront sends walletAppliedMinor; treated as the requested amount
  walletAppliedMinor: z.number().int().min(0).optional(),
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

  function getBasketService(): BasketService {
    return fastify.diContainer.resolve<BasketService>("basketService");
  }

  /**
   * Resolve the basket session UUID for an authenticated customer.
   * Tries customerId first (post-merge session), then falls back to the
   * grovio_basket_token cookie (server-readable httpOnly cookie — not accessible
   * by browser JS but fully visible to the server). This covers the case where
   * a customer is logged in but their basket session was created as a guest and
   * merge-on-login has not run yet.
   */
  async function resolveBasketSessionId(
    request: FastifyRequest
  ): Promise<string> {
    const customerId = getCustomerId(request);
    const basketService = getBasketService();

    // 1. Prefer customer-owned session (post merge-on-login)
    try {
      return await basketService.getSessionIdByCustomerId(customerId);
    } catch {
      // fall through to cookie fallback
    }

    // 2. Fall back to the httpOnly basket cookie (readable server-side)
    const guestToken = (request.cookies as Record<string, string | undefined>)[
      "grovio_basket_token"
    ];
    if (guestToken) {
      try {
        return await basketService.getSessionIdByGuestToken(guestToken);
      } catch {
        // fall through to final error
      }
    }

    throw new BasketSessionNotFoundError(
      `No basket session for customer ${customerId}`
    );
  }

  // ── GET /checkout/summary ──────────────────────────────────────────────────
  // Server-authoritative summary: catalog prices, coupon + wallet applied (CHK-04, WAL-05).
  fastify.get("/checkout/summary", async (request, reply) => {
    const query = request.query as {
      couponCode?: string;
      walletRequestedMinor?: string;
    };

    const params = ComputeSummaryInputSchema.parse({
      couponCode: query.couponCode,
      walletRequestedMinor: query.walletRequestedMinor
        ? Number(query.walletRequestedMinor)
        : undefined,
    });

    const checkoutService = getCheckoutService();

    try {
      const basketSessionId = await resolveBasketSessionId(request);
      const summary = await checkoutService.computeSummary({
        basketSessionId,
        customerId: getCustomerId(request),
        ...(params.couponCode !== undefined && { couponCode: params.couponCode }),
        ...(params.walletRequestedMinor !== undefined && {
          walletRequestedMinor: params.walletRequestedMinor,
        }),
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
    InitiateCheckoutInputSchema.parse(request.body); // validate shape; fields unused here
    const checkoutService = getCheckoutService();

    try {
      const basketSessionId = await resolveBasketSessionId(request);
      const result = await checkoutService.initiateCheckout({
        customerId: getCustomerId(request),
        basketSessionId,
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
      const basketSessionId = await resolveBasketSessionId(request);
      // computeSummary with coupon code validates server-side (CHK-06)
      const summary = await checkoutService.computeSummary({
        basketSessionId,
        customerId: getCustomerId(request),
        couponCode: body.couponCode,
        ...(body.walletRequestedMinor !== undefined && {
          walletRequestedMinor: body.walletRequestedMinor,
        }),
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
      const basketSessionId = await resolveBasketSessionId(request);
      // walletAppliedMinor (storefront name) is the requested wallet amount
      const walletRequestedMinor =
        body.walletRequestedMinor ?? body.walletAppliedMinor;
      const couponCode =
        body.couponCode != null ? body.couponCode : undefined;
      const result = await checkoutService.placeOrder({
        customerId: getCustomerId(request),
        addressId: body.addressId ?? null,
        basketSessionId,
        paymentProvider: body.paymentProvider,
        ...(couponCode !== undefined && { couponCode }),
        ...(walletRequestedMinor !== undefined && { walletRequestedMinor }),
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
          error: { code: "PROVIDER_NOT_CONFIGURED", message: err.message },
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
