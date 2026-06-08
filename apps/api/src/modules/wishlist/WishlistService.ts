import { and, eq, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  wishlists,
  products,
  type InsertWishlist,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface WishlistServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface WishlistedProduct {
  wishlistId: string;
  productId: string;
  name: string;
  slug: string;
  basePriceMinor: number;
  avgRating: number;
  reviewCount: number;
  priceAtWishlistMinor: number;
  isPriceDropped: boolean;
  createdAt: Date;
}

export interface WishlistStatusMap {
  [productId: string]: boolean;
}

// ---------------------------------------------------------------------------
// WishlistService
// ---------------------------------------------------------------------------

/**
 * WishlistService
 *
 * Manages customer wishlists. Key design decisions:
 * - Hard delete (no soft delete) per Plan 11-05 T2 spec.
 * - price_at_wishlist_minor stored on insert by reading products.base_price_minor.
 * - is_price_dropped computed dynamically: current basePriceMinor < priceAtWishlistMinor.
 * - Upsert pattern: if wishlist row already exists, return wishlisted: true without error.
 *
 * Plan 11-05 T2.
 */
export class WishlistService {
  constructor(private deps: WishlistServiceDeps) {}

  /**
   * Add a product to the customer's wishlist.
   * Upserts — returns { wishlisted: true } even if already wishlisted.
   * Reads current product price to store in price_at_wishlist_minor.
   */
  async addToWishlist(
    customerId: string,
    productId: string
  ): Promise<{ wishlisted: boolean }> {
    const { db } = this.deps;

    // Read current product price (for price_at_wishlist_minor)
    const [product] = await db
      .select({ basePriceMinor: products.basePriceMinor })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!product) {
      throw new WishlistProductNotFoundError(productId);
    }

    const row: InsertWishlist = {
      customerId,
      productId,
      priceAtWishlistMinor: product.basePriceMinor,
    };

    // ON CONFLICT DO NOTHING — unique(customer_id, product_id) handles duplicates
    await db
      .insert(wishlists)
      .values(row)
      .onConflictDoNothing({
        target: [wishlists.customerId, wishlists.productId],
      });

    return { wishlisted: true };
  }

  /**
   * Remove a product from the customer's wishlist (hard delete).
   * No-op if not wishlisted — returns { wishlisted: false } either way.
   */
  async removeFromWishlist(
    customerId: string,
    productId: string
  ): Promise<{ wishlisted: boolean }> {
    const { db } = this.deps;

    await db
      .delete(wishlists)
      .where(
        and(
          eq(wishlists.customerId, customerId),
          eq(wishlists.productId, productId)
        )
      );

    return { wishlisted: false };
  }

  /**
   * List paginated wishlist products for a customer.
   * Includes is_price_dropped flag: true when current price < price_at_wishlist_minor.
   */
  async listWishlist(
    customerId: string,
    page = 1,
    limit = 20
  ): Promise<{ items: WishlistedProduct[]; total: number; page: number; limit: number }> {
    const { db } = this.deps;

    const offset = (page - 1) * limit;

    const rows = await db
      .select({
        wishlistId: wishlists.id,
        productId: products.id,
        name: products.name,
        slug: products.slug,
        basePriceMinor: products.basePriceMinor,
        avgRating: products.avgRating,
        reviewCount: products.reviewCount,
        priceAtWishlistMinor: wishlists.priceAtWishlistMinor,
        createdAt: wishlists.createdAt,
      })
      .from(wishlists)
      .innerJoin(products, eq(wishlists.productId, products.id))
      .where(eq(wishlists.customerId, customerId))
      .orderBy(wishlists.createdAt)
      .limit(limit)
      .offset(offset);

    // Count total for pagination
    const countResult = await db
      .select({ count: sql<number>`COUNT(*)::int` })
      .from(wishlists)
      .where(eq(wishlists.customerId, customerId));

    const total = countResult[0]?.count ?? 0;

    const items: WishlistedProduct[] = rows.map((row) => ({
      wishlistId: row.wishlistId,
      productId: row.productId,
      name: row.name,
      slug: row.slug,
      basePriceMinor: row.basePriceMinor,
      avgRating: row.avgRating,
      reviewCount: row.reviewCount,
      priceAtWishlistMinor: row.priceAtWishlistMinor,
      isPriceDropped: row.basePriceMinor < row.priceAtWishlistMinor,
      createdAt: row.createdAt,
    }));

    return { items, total, page, limit };
  }

  /**
   * Returns a map of { [productId]: boolean } indicating wishlist status.
   * Used to initialize ProductCard heart icons on page load.
   * Efficient: single query for all productIds.
   */
  async getWishlistStatus(
    customerId: string,
    productIds: string[]
  ): Promise<WishlistStatusMap> {
    if (productIds.length === 0) {
      return {};
    }

    const { db } = this.deps;

    const rows = await db
      .select({ productId: wishlists.productId })
      .from(wishlists)
      .where(
        and(
          eq(wishlists.customerId, customerId),
          inArray(wishlists.productId, productIds)
        )
      );

    // Build status map: all false by default, then mark trues from DB result
    const statusMap: WishlistStatusMap = {};
    for (const id of productIds) {
      statusMap[id] = false;
    }
    for (const row of rows) {
      statusMap[row.productId] = true;
    }

    return statusMap;
  }

  /**
   * Called by PriceDropCheckJob after a price drop: updates price_at_wishlist_minor
   * for all wishlist rows for this product so subsequent drops are measured correctly.
   */
  async updateWishlistPrices(
    productId: string,
    newPriceMinor: number
  ): Promise<void> {
    const { db } = this.deps;

    await db
      .update(wishlists)
      .set({ priceAtWishlistMinor: newPriceMinor })
      .where(eq(wishlists.productId, productId));
  }

  /**
   * Returns all customerIds who have the product wishlisted with
   * price_at_wishlist_minor > newPriceMinor (eligible for price drop notification).
   */
  async getWishlistersEligibleForDrop(
    productId: string,
    newPriceMinor: number
  ): Promise<string[]> {
    const { db } = this.deps;

    const rows = await db
      .select({ customerId: wishlists.customerId })
      .from(wishlists)
      .where(
        and(
          eq(wishlists.productId, productId),
          sql`${wishlists.priceAtWishlistMinor} > ${newPriceMinor}`
        )
      );

    return rows.map((r) => r.customerId);
  }
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class WishlistProductNotFoundError extends Error {
  readonly code = "WISHLIST_PRODUCT_NOT_FOUND";

  constructor(public readonly productId: string) {
    super(`Product not found: ${productId}`);
    this.name = "WishlistProductNotFoundError";
  }
}
