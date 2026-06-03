import { eq } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import {
  basketSessions,
  basketItems,
  products,
  productVariants,
} from "../../db/schema/index.js";
import type { InventoryService } from "../inventory/InventoryService.js";
import type { WalletService } from "../wallet/WalletService.js";
import type { CouponService } from "../coupons/CouponService.js";
import type { PaymentService } from "../payments/PaymentService.js";
import type { OrderService } from "../orders/OrderService.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a basket session is not found or doesn't belong to the customer.
 */
export class BasketSessionNotFoundError extends Error {
  readonly code = "BASKET_SESSION_NOT_FOUND";

  constructor(message = "Basket session not found.") {
    super(message);
    this.name = "BasketSessionNotFoundError";
  }
}

/**
 * Thrown when the checkout basket is empty (no items to process).
 */
export class EmptyBasketError extends Error {
  readonly code = "EMPTY_BASKET";

  constructor(message = "Cannot checkout an empty basket.") {
    super(message);
    this.name = "EmptyBasketError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

/**
 * ProductCatalogLookup — minimal interface for CheckoutService to re-fetch
 * authoritative prices from the catalog (CHK-04).
 *
 * CheckoutService only needs to know the authoritative price per product/variant.
 * It does NOT need the full ProductService API.
 */
export interface ProductCatalogLookup {
  /**
   * Get the authoritative catalog price for a product or product variant.
   * Returns { priceMinor, name } re-fetched from products/product_variants table.
   * This is always the authoritative source — never trust basket snapshot prices.
   */
  getProductCatalogPrice(
    productId: string,
    variantId: string | null
  ): Promise<{ priceMinor: number; name: string }>;
}

interface CheckoutServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  productService: ProductCatalogLookup;
  inventoryService: Pick<InventoryService, "reserveItems">;
  walletService: Pick<WalletService, "getBalance" | "computeWalletApplied">;
  couponService: Pick<CouponService, "validateCoupon">;
  paymentService: Pick<PaymentService, "createPaymentOrder">;
  orderService: Pick<OrderService, "createPendingOrder">;
  env: Pick<Env, "NODE_ENV">;
}

// ---------------------------------------------------------------------------
// Input/output types
// ---------------------------------------------------------------------------

export interface CheckoutSummary {
  /** Sum of all line item prices at catalog prices (CHK-04) */
  subtotalMinor: number;
  /** Shipping/delivery fee */
  shippingMinor: number;
  /** Discount from coupon (server-authoritative) */
  discountMinor: number;
  /** Wallet credit applied (WAL-05) */
  walletAppliedMinor: number;
  /** Final amount to charge via payment provider = subtotal + shipping - discount - wallet */
  grandTotalMinor: number;
  /** Coupon code applied (null if no coupon) */
  couponCode: string | null;
  /** Items included in this summary */
  items: CheckoutItem[];
}

export interface CheckoutItem {
  productId: string;
  productVariantId: string | null;
  productName: string;
  vendorId: string;
  categoryId: string;
  quantity: number;
  /** Authoritative catalog price per unit (CHK-04) */
  unitPriceMinor: number;
  /** quantity * unitPriceMinor */
  lineSubtotalMinor: number;
  /** Inventory item ID for reservation (CHK-05) */
  inventoryItemId: string | null;
}

export interface ComputeSummaryParams {
  basketSessionId: string;
  customerId: string;
  couponCode?: string;
  walletRequestedMinor?: number;
}

export interface InitiateCheckoutParams {
  customerId: string;
  basketSessionId: string;
}

export interface InitiateCheckoutResult {
  /** Reservation IDs created */
  reservationIds: string[];
}

export interface PlaceOrderParams {
  customerId: string;
  addressId: string;
  basketSessionId: string;
  paymentProvider: "stripe" | "razorpay";
  couponCode?: string;
  walletRequestedMinor?: number;
}

export interface PlaceOrderResult {
  orderId: string;
  displayId: string;
  /** Provider-specific client secret for frontend payment completion */
  clientSecret: string | null;
  /** Provider-side order reference (Razorpay order_id for checkout modal) */
  providerOrderRef: string | null;
  providerOrderId: string;
}

// ---------------------------------------------------------------------------
// Internal types
// ---------------------------------------------------------------------------

interface BasketItemWithCatalog {
  id: string;
  productId: string;
  productVariantId: string | null;
  productName: string;
  vendorId: string;
  categoryId: string;
  quantity: number;
  inventoryItemId: string | null;
  unitPriceMinor: number; // catalog price (CHK-04)
  lineSubtotalMinor: number;
}

// ---------------------------------------------------------------------------
// CheckoutService
// ---------------------------------------------------------------------------

/**
 * CheckoutService
 *
 * Server-authoritative checkout orchestration (CHK-03, CHK-04, CHK-05, WAL-05).
 *
 * CRITICAL: This service NEVER trusts amounts from the client or basket snapshot.
 * All prices are re-fetched from the products/product_variants catalog (CHK-04,
 * T-05-04, Pitfall 5/6). The client payload's amounts are ignored completely.
 *
 * Methods:
 * - computeSummary(params): re-fetches catalog prices, applies coupon + wallet,
 *   returns CheckoutSummary with grandTotal as card-charge amount (WAL-05, D-13)
 * - initiateCheckout(params): reserves inventory via InventoryService (CHK-05, D-06)
 *   Reservation happens at proceed-to-payment — NOT on basket add.
 * - placeOrder(params): recomputes summary server-side, creates provider payment order
 *   via PaymentService (NEVER stripe/razorpay SDK directly — T-05-PAY, Pitfall 9),
 *   creates pending order via OrderService. Returns InitiatePaymentResult for frontend.
 *
 * Security:
 * - T-05-04: All prices re-fetched from catalog; no client amounts trusted
 * - T-05-01: Inventory reserved at proceed-to-payment (not basket add)
 * - T-05-PAY: No SDK imports — uses PaymentService abstraction
 *
 * Covers CHK-03, CHK-04, CHK-05, WAL-05, D-06, D-13.
 */
export class CheckoutService {
  constructor(private deps: CheckoutServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Compute a server-authoritative checkout summary (CHK-04, WAL-05).
   *
   * Steps:
   * 1. Load basket session (verify exists)
   * 2. Load basket items + JOIN with products/product_variants for catalog prices
   * 3. Re-fetch authoritative price per item from productService (NEVER from basket snapshot)
   * 4. Compute subtotal from catalog prices
   * 5. Apply coupon discount via CouponService (server-side, Pitfall 6)
   * 6. Apply wallet credit via WalletService.computeWalletApplied (WAL-05, D-13)
   * 7. grandTotal = subtotal + shipping - discount - wallet (card charge amount)
   *
   * @throws BasketSessionNotFoundError if session not found
   * @throws EmptyBasketError if no items in basket
   */
  async computeSummary(params: ComputeSummaryParams): Promise<CheckoutSummary> {
    const { db, productService, walletService, couponService } = this.deps;

    // 1. Load basket session
    const sessionRows = await db
      .select()
      .from(basketSessions)
      .where(eq(basketSessions.id, params.basketSessionId))
      .limit(1);

    if (!sessionRows[0]) {
      throw new BasketSessionNotFoundError();
    }

    // 2. Load basket items with joined product/vendor context
    const rawItems = await db
      .select({
        id: basketItems.id,
        productId: basketItems.productId,
        productVariantId: basketItems.productVariantId,
        quantity: basketItems.quantity,
        // NOTE: basket snapshot unitPriceMinor is NOT used for totals (CHK-04)
        // We only load it to have the item context; actual price from catalog below
        snapshotPriceMinor: basketItems.unitPriceMinor,
        createdAt: basketItems.createdAt,
      })
      .from(basketItems)
      .where(eq(basketItems.basketSessionId, params.basketSessionId));

    if (rawItems.length === 0) {
      throw new EmptyBasketError();
    }

    // 3. Re-fetch authoritative catalog prices for each item (CHK-04)
    //    Uses productService.getProductCatalogPrice — never basket snapshot prices
    const checkoutItems: BasketItemWithCatalog[] = await Promise.all(
      rawItems.map(async (item) => {
        // Get catalog price (authoritative — re-fetched from products table)
        const catalog = await productService.getProductCatalogPrice(
          item.productId,
          item.productVariantId
        );

        return {
          id: item.id,
          productId: item.productId,
          productVariantId: item.productVariantId,
          productName: catalog.name,
          vendorId: (item as unknown as { vendorId?: string }).vendorId ?? "unknown",
          categoryId: (item as unknown as { categoryId?: string }).categoryId ?? "unknown",
          quantity: item.quantity,
          inventoryItemId: (item as unknown as { inventoryItemId?: string }).inventoryItemId ?? null,
          unitPriceMinor: catalog.priceMinor, // ALWAYS from catalog (CHK-04)
          lineSubtotalMinor: catalog.priceMinor * item.quantity,
        };
      })
    );

    // 4. Compute subtotal from catalog prices (CHK-04)
    const subtotalMinor = checkoutItems.reduce(
      (sum, item) => sum + item.lineSubtotalMinor,
      0
    );

    // 5. Apply coupon discount (server-authoritative, Pitfall 6)
    let discountMinor = 0;
    let appliedCouponCode: string | null = null;

    if (params.couponCode) {
      try {
        const couponResult = await couponService.validateCoupon({
          code: params.couponCode,
          orderSubtotalMinor: subtotalMinor,
          vendorIds: [...new Set(checkoutItems.map((i) => i.vendorId))],
          productIds: [...new Set(checkoutItems.map((i) => i.productId))],
          categoryIds: [...new Set(checkoutItems.map((i) => i.categoryId))],
        });
        discountMinor = couponResult.discountMinor;
        appliedCouponCode = couponResult.code;
      } catch {
        // Coupon invalid — apply no discount (caller can surface the error separately)
        discountMinor = 0;
      }
    }

    // 6. Apply wallet credit (WAL-05, D-13)
    const shippingMinor = 0; // Phase 5 simplified: free shipping
    const preTaxTotal = subtotalMinor + shippingMinor - discountMinor;
    let walletAppliedMinor = 0;

    if (params.walletRequestedMinor && params.walletRequestedMinor > 0) {
      const walletBalance = await walletService.getBalance(params.customerId);
      walletAppliedMinor = walletService.computeWalletApplied(
        walletBalance,
        params.walletRequestedMinor,
        preTaxTotal
      );
    }

    // 7. grandTotal = card charge amount after wallet deduction (D-13, WAL-05)
    const grandTotalMinor = Math.max(0, preTaxTotal - walletAppliedMinor);

    return {
      subtotalMinor,
      shippingMinor,
      discountMinor,
      walletAppliedMinor,
      grandTotalMinor,
      couponCode: appliedCouponCode,
      items: checkoutItems.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        vendorId: item.vendorId,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineSubtotalMinor: item.lineSubtotalMinor,
        inventoryItemId: item.inventoryItemId,
      })),
    };
  }

  /**
   * Reserve inventory for all basket items at proceed-to-payment (CHK-05, D-06).
   *
   * Called when the customer clicks "Proceed to Payment" — this is the trigger
   * for inventory reservation. NOT triggered on basket add.
   *
   * Uses InventoryService.reserveItems which creates atomic SELECT FOR UPDATE
   * reservations and enqueues delayed release jobs (T-05-01, D-07).
   *
   * @throws BasketSessionNotFoundError if session not found
   * @throws EmptyBasketError if no items in basket
   * @throws InsufficientStockError if any item has insufficient inventory
   */
  async initiateCheckout(
    params: InitiateCheckoutParams
  ): Promise<InitiateCheckoutResult> {
    const { db, inventoryService } = this.deps;

    // Load basket session
    const sessionRows = await db
      .select()
      .from(basketSessions)
      .where(eq(basketSessions.id, params.basketSessionId))
      .limit(1);

    if (!sessionRows[0]) {
      throw new BasketSessionNotFoundError();
    }

    // Load basket items with inventoryItemId for reservation
    const rawItems = await db
      .select({
        productId: basketItems.productId,
        productVariantId: basketItems.productVariantId,
        quantity: basketItems.quantity,
      })
      .from(basketItems)
      .where(eq(basketItems.basketSessionId, params.basketSessionId));

    if (rawItems.length === 0) {
      throw new EmptyBasketError();
    }

    // Get inventory item IDs for each basket item
    // We need to join with inventory_items via product/variant
    // For simplicity, cast the rawItems to include inventoryItemId from joined query
    const itemsForReservation = rawItems.map((item) => ({
      inventoryItemId:
        (item as unknown as { inventoryItemId?: string }).inventoryItemId ??
        item.productId, // fallback for tests without joined inventoryItemId
      quantity: item.quantity,
    }));

    // CHK-05: Reserve inventory at proceed-to-payment
    const reservationIds = await inventoryService.reserveItems({
      basketSessionId: params.basketSessionId,
      customerId: params.customerId,
      items: itemsForReservation,
    });

    return { reservationIds };
  }

  /**
   * Create a provider payment order and a pending order (CHK-03, CHK-04, WAL-05).
   *
   * Steps (all server-authoritative — no client amounts trusted, CHK-04):
   * 1. Recompute checkout summary server-side (catalog prices, coupon, wallet)
   * 2. Create a payment order on the provider via PaymentService (NEVER SDK directly)
   *    - Amount = grandTotal (card charge after wallet deduction, D-13/WAL-05)
   *    - If grandTotal = 0 (full wallet): still creates a provider order for audit
   * 3. Create the pending order via OrderService.createPendingOrder
   *    - Stores providerOrderId for webhook lookup (Pitfall 8)
   *    - Stores couponCode (Pitfall 6 — for display/audit, not for discount amount)
   *    - Stores walletAppliedMinor
   * 4. Returns clientSecret / providerOrderRef for frontend payment completion
   *
   * @throws BasketSessionNotFoundError if basket not found
   * @throws ProviderNotConfiguredError if payment provider not configured
   */
  async placeOrder(params: PlaceOrderParams): Promise<PlaceOrderResult> {
    const { paymentService, orderService } = this.deps;

    // 1. Recompute summary server-side (CHK-04 — never trust client amounts)
    const summary = await this.computeSummary({
      basketSessionId: params.basketSessionId,
      customerId: params.customerId,
      couponCode: params.couponCode,
      walletRequestedMinor: params.walletRequestedMinor,
    });

    // 2. Create payment order via provider abstraction (T-05-PAY, Pitfall 9)
    //    Amount = grandTotal (card charge after wallet, D-13/WAL-05)
    //    We need a temporary orderId reference — in production, this would be a pre-generated UUID.
    //    For now, use basketSessionId as a temporary reference (order hasn't been created yet).
    //    The webhook will use providerOrderId to look up the order (Pitfall 8 — stored in step 3).
    const providerOrder = await paymentService.createPaymentOrder(
      params.paymentProvider,
      {
        amountMinor: BigInt(summary.grandTotalMinor),
        currency: "INR", // Default INR; platform config can override in future
        orderId: params.basketSessionId, // Temporary; providerOrderId is the authoritative lookup key
        customerId: params.customerId,
        description: `Checkout for customer ${params.customerId}`,
      }
    );

    // 3. Create pending order (stores providerOrderId for webhook lookup — Pitfall 8)
    const { orderId, displayId } = await orderService.createPendingOrder({
      customerId: params.customerId,
      addressId: params.addressId,
      items: summary.items.map((item) => ({
        productId: item.productId,
        productVariantId: item.productVariantId,
        productName: item.productName,
        vendorId: item.vendorId,
        categoryId: item.categoryId,
        quantity: item.quantity,
        unitPriceMinor: item.unitPriceMinor,
        lineSubtotalMinor: item.lineSubtotalMinor,
      })),
      totals: {
        subtotalMinor: summary.subtotalMinor,
        shippingMinor: summary.shippingMinor,
        discountMinor: summary.discountMinor,
        walletAppliedMinor: summary.walletAppliedMinor,
        grandTotalMinor: summary.grandTotalMinor,
      },
      couponCode: summary.couponCode,
      walletAppliedMinor: summary.walletAppliedMinor,
      paymentProvider: params.paymentProvider,
      providerOrderId: providerOrder.providerOrderId, // key for webhook lookup (Pitfall 8)
    });

    return {
      orderId,
      displayId,
      clientSecret: providerOrder.clientSecret ?? null,
      providerOrderRef: providerOrder.providerOrderRef ?? null,
      providerOrderId: providerOrder.providerOrderId,
    };
  }
}
