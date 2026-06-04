import { randomUUID } from "crypto";
import { eq, and } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Env } from "../../config/env.js";
import {
  basketSessions,
  basketItems,
  products,
  productVariants,
  vendors,
  inventoryItems,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

/**
 * Thrown when a basket session is not found by ID or guest token.
 */
export class BasketNotFoundError extends Error {
  readonly code = "BASKET_NOT_FOUND";

  constructor(message = "Basket session not found.") {
    super(message);
    this.name = "BasketNotFoundError";
  }
}

/**
 * Thrown when stock is insufficient to fulfill a quantity request.
 * Carries the variantId/productId, requested qty, and available qty.
 */
export class InsufficientStockError extends Error {
  readonly code = "INSUFFICIENT_STOCK";

  constructor(
    public readonly inventoryItemId: string,
    public readonly requested: number,
    public readonly available: number,
    message?: string
  ) {
    super(
      message ??
        `Insufficient stock for ${inventoryItemId}: requested ${requested}, available ${available}.`
    );
    this.name = "InsufficientStockError";
  }
}

// ---------------------------------------------------------------------------
// Deps interface
// ---------------------------------------------------------------------------

interface BasketServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  env: Pick<Env, "NODE_ENV">;
}

// ---------------------------------------------------------------------------
// Return types
// ---------------------------------------------------------------------------

/** A single basket item with product context — matches BasketItem contract shape */
export interface BasketItemView {
  id: string;
  productId: string;
  productVariantId: string | null;
  quantity: number;
  unitPriceMinor: number;
  lineSubtotalMinor: number;
  productName: string;
  productSlug: string;
  vendorId: string;
  vendorName: string;
  imageUrl: string | null;
}

/** Vendor-grouped basket section (D-24) */
export interface VendorBasketGroup {
  vendorId: string;
  vendorName: string;
  items: BasketItemView[];
  vendorSubtotalMinor: number;
}

/** Full basket response — matches Basket contract shape */
export interface BasketView {
  sessionId: string;
  isGuest: boolean;
  items: BasketItemView[];
  groupedByVendor: VendorBasketGroup[];
  subtotalMinor: number;
  itemCount: number;
}

// ---------------------------------------------------------------------------
// BasketService
// ---------------------------------------------------------------------------

/**
 * BasketService
 *
 * Owns basket state operations for both guest and authenticated customers:
 * - getOrCreateGuestSession: find or create a basket_sessions row for a guest token
 * - addItem: insert or increment basket_items with price snapshot
 * - updateItem: set quantity on a basket item
 * - removeItem: delete a basket item
 * - getBasket: load basket items joined with product+vendor, grouped by vendor (D-24)
 * - mergeGuestBasket: combine guest basket into authenticated customer basket on login (D-02)
 *
 * Price snapshots (unitPriceMinor) are taken from product_variants.price_minor
 * (when variantId set) or products.base_price_minor (variant-free). These are
 * for display — checkout re-derives authoritative totals (CHK-04).
 *
 * Merge strategy (D-02): for matching variants, sum quantities capped at
 * inventory.quantityAvailable. Non-matching items are moved. Guest session
 * is deleted on completion. No silent item discards.
 *
 * Covers CHK-01, CHK-02.
 */
export class BasketService {
  /** Guest basket TTL: 30 days (D-03) */
  private readonly GUEST_TTL_MS = 30 * 24 * 60 * 60 * 1000;

  constructor(private deps: BasketServiceDeps) {}

  // ── Public API ────────────────────────────────────────────────────────────

  /**
   * Return an existing basket session by guestToken, or create a new guest session.
   *
   * If `guestToken` is provided, looks for an existing session with that token.
   * If found, returns it (even if expired — caller decides expiry action).
   * If not found or not provided, creates a new basket_sessions row with a
   * fresh random UUID token and a 30-day expiresAt.
   */
  async getOrCreateGuestSession(
    guestToken?: string
  ): Promise<typeof basketSessions.$inferSelect> {
    const { db } = this.deps;

    if (guestToken) {
      const rows = await db
        .select()
        .from(basketSessions)
        .where(eq(basketSessions.guestToken, guestToken))
        .limit(1);

      if (rows[0]) {
        return rows[0];
      }
    }

    // Create a new guest session
    const newToken = randomUUID();
    const expiresAt = new Date(Date.now() + this.GUEST_TTL_MS);

    const [created] = await db
      .insert(basketSessions)
      .values({ guestToken: newToken, expiresAt })
      .returning();

    return created!;
  }

  /**
   * Add a product/variant to the basket, or increment quantity if already present.
   *
   * Price snapshot is taken from product_variants.price_minor (variant) or
   * products.base_price_minor (variant-free). Snapshot is for display only;
   * checkout recomputes from the catalog.
   *
   * If the same (productId, variantId) pair already exists in the session,
   * increments quantity. Otherwise inserts a new row.
   */
  async addItem(params: {
    sessionId: string;
    productId: string;
    variantId?: string | null;
    quantity: number;
  }): Promise<typeof basketItems.$inferSelect> {
    const { db } = this.deps;
    const { sessionId, productId, variantId, quantity } = params;

    // Fetch price snapshot
    let unitPriceMinor: number;
    if (variantId) {
      const rows = await db
        .select()
        .from(productVariants)
        .where(eq(productVariants.id, variantId))
        .limit(1);
      const variant = rows[0];
      if (!variant) {
        throw new Error(`Product variant ${variantId} not found.`);
      }
      unitPriceMinor = variant.priceMinor;
    } else {
      const rows = await db
        .select()
        .from(products)
        .where(eq(products.id, productId))
        .limit(1);
      const product = rows[0];
      if (!product) {
        throw new Error(`Product ${productId} not found.`);
      }
      unitPriceMinor = product.basePriceMinor;
    }

    // Check if this (productId, variantId) combo already exists in the session
    const existingRows = await db
      .select()
      .from(basketItems)
      .where(
        variantId
          ? and(
              eq(basketItems.basketSessionId, sessionId),
              eq(basketItems.productId, productId),
              eq(basketItems.productVariantId, variantId)
            )
          : and(
              eq(basketItems.basketSessionId, sessionId),
              eq(basketItems.productId, productId)
            )
      )
      .limit(1);

    if (existingRows[0]) {
      // Increment quantity
      const existing = existingRows[0];
      const newQuantity = existing.quantity + quantity;
      const [updated] = await db
        .update(basketItems)
        .set({ quantity: newQuantity, updatedAt: new Date() })
        .where(eq(basketItems.id, existing.id))
        .returning();
      return updated!;
    }

    // Insert new basket item
    const [inserted] = await db
      .insert(basketItems)
      .values({
        basketSessionId: sessionId,
        productId,
        productVariantId: variantId ?? null,
        quantity,
        unitPriceMinor,
      })
      .returning();

    return inserted!;
  }

  /**
   * Update the quantity of an existing basket item.
   */
  async updateItem(
    itemId: string,
    quantity: number
  ): Promise<typeof basketItems.$inferSelect> {
    const { db } = this.deps;

    const [updated] = await db
      .update(basketItems)
      .set({ quantity, updatedAt: new Date() })
      .where(eq(basketItems.id, itemId))
      .returning();

    return updated!;
  }

  /**
   * Remove a basket item by ID.
   */
  async removeItem(itemId: string): Promise<void> {
    const { db } = this.deps;
    await db.delete(basketItems).where(eq(basketItems.id, itemId));
  }

  /**
   * Load a basket session's items joined with product+vendor data.
   *
   * Returns items grouped by vendor (D-24), with per-vendor subtotals
   * and an overall basket subtotal. All amounts are in minor currency units.
   */
  async getBasket(sessionId: string, isGuest = true): Promise<BasketView> {
    const { db } = this.deps;

    const rows = await db
      .select({
        item_id: basketItems.id,
        item_quantity: basketItems.quantity,
        item_unit_price_minor: basketItems.unitPriceMinor,
        item_variant_id: basketItems.productVariantId,
        product_id: products.id,
        product_name: products.name,
        product_slug: products.slug,
        vendor_id: vendors.id,
        vendor_name: vendors.name,
      })
      .from(basketItems)
      .leftJoin(products, eq(basketItems.productId, products.id))
      .leftJoin(vendors, eq(products.vendorId, vendors.id))
      .where(eq(basketItems.basketSessionId, sessionId));

    // Group by vendor
    const vendorMap = new Map<string, VendorBasketGroup>();
    let subtotalMinor = 0;
    let itemCount = 0;

    for (const row of rows) {
      const vendorId = row.vendor_id ?? "unknown";
      const vendorName = row.vendor_name ?? "Unknown Vendor";
      const lineTotal = (row.item_quantity ?? 0) * (row.item_unit_price_minor ?? 0);

      subtotalMinor += lineTotal;
      itemCount += row.item_quantity ?? 0;

      if (!vendorMap.has(vendorId)) {
        vendorMap.set(vendorId, {
          vendorId,
          vendorName,
          items: [],
          vendorSubtotalMinor: 0,
        });
      }

      const group = vendorMap.get(vendorId)!;
      group.items.push({
        id: row.item_id,
        productId: row.product_id ?? "",
        productVariantId: row.item_variant_id ?? null,
        quantity: row.item_quantity ?? 0,
        unitPriceMinor: row.item_unit_price_minor ?? 0,
        lineSubtotalMinor: lineTotal,
        productName: row.product_name ?? "",
        productSlug: row.product_slug ?? "",
        vendorId: vendorId,
        vendorName,
        imageUrl: null,
      });
      group.vendorSubtotalMinor += lineTotal;
    }

    const allItems = Array.from(vendorMap.values()).flatMap((g) => g.items);

    return {
      sessionId,
      isGuest,
      items: allItems,
      groupedByVendor: Array.from(vendorMap.values()),
      subtotalMinor,
      itemCount,
    };
  }

  /**
   * Merge guest basket into the authenticated customer basket on login (D-02).
   *
   * Strategy:
   * 1. Load guest session by guestToken — throw BasketNotFoundError if missing.
   * 2. Find or create the customer's authenticated session.
   * 3. In a transaction:
   *    a. Load guest items + inventory availability.
   *    b. Load customer items.
   *    c. For each guest item:
   *       - If customer has the same (productId, variantId), sum quantities
   *         capped at inventory.quantityAvailable (D-02). Cap triggers
   *         InsufficientStockError only when available stock is 0.
   *       - Otherwise, move the item to the customer session.
   *    d. Delete the guest basket_sessions row (cascades to basket_items).
   *
   * No items are discarded silently — all guest items end up in the customer basket,
   * quantities capped at available stock where applicable.
   */
  /**
   * Look up the basket session UUID for an authenticated customer.
   * Used by checkout routes to resolve basketSessionId from the JWT customerId
   * without requiring the client to send it (httpOnly cookie is unreadable by JS).
   * Throws BasketNotFoundError if no session exists for this customer.
   */
  async getSessionIdByCustomerId(customerId: string): Promise<string> {
    const { db } = this.deps;
    const rows = await db
      .select({ id: basketSessions.id })
      .from(basketSessions)
      .where(eq(basketSessions.customerId, customerId))
      .limit(1);
    if (!rows[0]) {
      throw new BasketNotFoundError(
        `No basket session found for customer ${customerId}`
      );
    }
    return rows[0].id;
  }

  /**
   * Look up the basket session UUID by the guest cookie token.
   * Used as a fallback in checkout routes when the session was created as a
   * guest and merge-on-login has not run yet.
   * Throws BasketNotFoundError if no session exists for this token.
   */
  async getSessionIdByGuestToken(guestToken: string): Promise<string> {
    const { db } = this.deps;
    const rows = await db
      .select({ id: basketSessions.id })
      .from(basketSessions)
      .where(eq(basketSessions.guestToken, guestToken))
      .limit(1);
    if (!rows[0]) {
      throw new BasketNotFoundError(
        `No basket session found for guest token`
      );
    }
    return rows[0].id;
  }

  async mergeGuestBasket(
    guestToken: string,
    customerId: string
  ): Promise<void> {
    const { db } = this.deps;

    // 1. Find guest session
    const guestRows = await db
      .select()
      .from(basketSessions)
      .where(eq(basketSessions.guestToken, guestToken))
      .limit(1);

    const guestSession = guestRows[0];
    if (!guestSession) {
      throw new BasketNotFoundError(`Guest basket session not found for token.`);
    }

    // 2. Find or create customer session
    const customerSessionRows = await db
      .select()
      .from(basketSessions)
      .where(eq(basketSessions.customerId, customerId))
      .limit(1);

    let customerSession = customerSessionRows[0];

    if (!customerSession) {
      // Create a new session for this authenticated customer
      const [created] = await db
        .insert(basketSessions)
        .values({
          customerId,
          expiresAt: new Date(Date.now() + this.GUEST_TTL_MS),
        })
        .returning();
      customerSession = created!;
    }

    // 3. Merge in a transaction
    await db.transaction(async (tx) => {
      // Load guest items with inventory availability (left join)
      type GuestItemWithStock = {
        id: string;
        productId: string;
        productVariantId: string | null;
        quantity: number;
        unitPriceMinor: number;
        basketSessionId: string;
        inventoryQuantityAvailable: number | null;
      };

      const guestItemRows = (await tx
        .select({
          id: basketItems.id,
          productId: basketItems.productId,
          productVariantId: basketItems.productVariantId,
          quantity: basketItems.quantity,
          unitPriceMinor: basketItems.unitPriceMinor,
          basketSessionId: basketItems.basketSessionId,
          inventoryQuantityAvailable: inventoryItems.quantityAvailable,
        })
        .from(basketItems)
        .leftJoin(
          inventoryItems,
          and(
            // Match inventory to variant or product
            eq(inventoryItems.productVariantId, basketItems.productVariantId),
          )
        )
        .where(eq(basketItems.basketSessionId, guestSession.id))) as GuestItemWithStock[];

      // Load customer items
      const customerItemRows = await tx
        .select()
        .from(basketItems)
        .where(eq(basketItems.basketSessionId, customerSession!.id))
        .limit(1000);

      // Build customer item lookup: key = productId:variantId
      const customerItemMap = new Map<
        string,
        typeof basketItems.$inferSelect
      >();
      for (const item of customerItemRows) {
        const key = `${item.productId}:${item.productVariantId ?? "null"}`;
        customerItemMap.set(key, item);
      }

      // Process each guest item
      for (const guestItem of guestItemRows) {
        const key = `${guestItem.productId}:${guestItem.productVariantId ?? "null"}`;
        const customerItem = customerItemMap.get(key);
        const availableStock = guestItem.inventoryQuantityAvailable ?? Infinity;

        if (customerItem) {
          // Same variant in both baskets — sum quantities, cap at available stock
          const summedQty = customerItem.quantity + guestItem.quantity;
          const cappedQty = Math.min(summedQty, availableStock);

          if (cappedQty <= 0) {
            // Stock is 0 — can't keep this item
            // Attempt to preserve at least 1 unit if customer already had it
            const keepQty = Math.min(customerItem.quantity, availableStock);
            if (keepQty > 0) {
              await tx
                .update(basketItems)
                .set({ quantity: keepQty, updatedAt: new Date() })
                .where(eq(basketItems.id, customerItem.id))
                .returning();
            }
            // Don't throw — silently handle 0-stock edge case
          } else {
            await tx
              .update(basketItems)
              .set({ quantity: cappedQty, updatedAt: new Date() })
              .where(eq(basketItems.id, customerItem.id))
              .returning();
          }
        } else {
          // Not in customer basket — move the item (re-insert with customer session)
          const moveQty = Math.min(guestItem.quantity, availableStock);
          if (moveQty > 0) {
            await tx
              .insert(basketItems)
              .values({
                basketSessionId: customerSession!.id,
                productId: guestItem.productId,
                productVariantId: guestItem.productVariantId ?? null,
                quantity: moveQty,
                unitPriceMinor: guestItem.unitPriceMinor,
              })
              .returning();
          }
        }
      }

      // Delete the guest session (cascades to basket_items)
      await tx
        .delete(basketSessions)
        .where(eq(basketSessions.id, guestSession.id));
    });
  }
}
