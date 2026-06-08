import { and, avg, count, eq, desc } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import {
  productReviews,
  products,
  orderItems,
  vendorOrders,
  orders,
  type InsertProductReview,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface ReviewServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ReviewListItem {
  id: string;
  customerId: string;
  rating: number;
  title: string | null;
  body: string;
  verifiedPurchase: boolean;
  vendorReply: string | null;
  vendorRepliedAt: Date | null;
  createdAt: Date;
}

export interface ReviewListResult {
  reviews: ReviewListItem[];
  total: number;
  page: number;
  limit: number;
}

// ---------------------------------------------------------------------------
// Domain errors
// ---------------------------------------------------------------------------

export class ReviewProductNotFoundError extends Error {
  readonly code = "REVIEW_PRODUCT_NOT_FOUND";
  constructor(productId: string) {
    super(`Product not found: ${productId}`);
    this.name = "ReviewProductNotFoundError";
  }
}

export class ReviewAlreadyExistsError extends Error {
  readonly code = "REVIEW_ALREADY_EXISTS";
  constructor() {
    super("You have already reviewed this product.");
    this.name = "ReviewAlreadyExistsError";
  }
}

export class ReviewNotFoundError extends Error {
  readonly code = "REVIEW_NOT_FOUND";
  constructor(reviewId: string) {
    super(`Review not found: ${reviewId}`);
    this.name = "ReviewNotFoundError";
  }
}

export class ReviewOwnershipError extends Error {
  readonly code = "REVIEW_OWNERSHIP_ERROR";
  constructor() {
    super("You do not have permission to reply to this review.");
    this.name = "ReviewOwnershipError";
  }
}

// ---------------------------------------------------------------------------
// ReviewService
// ---------------------------------------------------------------------------

/**
 * ReviewService
 *
 * Manages product reviews. Key design decisions:
 * - verified_purchase: checked by querying order_items for the customer+product pair.
 * - avg_rating / review_count: cached aggregates on products table — refreshed on
 *   every review insert/update/delete via aggregation query.
 * - Moderation: admin soft-hides reviews by setting moderated=true; public API
 *   filters WHERE moderated = false.
 *
 * Plan 11-05 T3.
 */
export class ReviewService {
  constructor(private deps: ReviewServiceDeps) {}

  // ── Private helpers ───────────────────────────────────────────────────────

  /**
   * Checks whether the customer has ever ordered this product.
   * Used to set verified_purchase at review insert time.
   */
  private async hasCustomerOrderedProduct(
    customerId: string,
    productId: string
  ): Promise<boolean> {
    const { db } = this.deps;

    // order_items → vendor_orders → orders to scope by customerId
    const rows = await db
      .select({ id: orderItems.id })
      .from(orderItems)
      .innerJoin(vendorOrders, eq(orderItems.vendorOrderId, vendorOrders.id))
      .innerJoin(orders, eq(vendorOrders.orderId, orders.id))
      .where(
        and(
          eq(orderItems.productId, productId),
          eq(orders.customerId, customerId)
        )
      )
      .limit(1);

    return rows.length > 0;
  }

  /**
   * Refreshes products.avg_rating and products.review_count from the
   * product_reviews table for the given product. Called after any review write.
   */
  private async refreshProductAggregates(productId: string): Promise<void> {
    const { db } = this.deps;

    const [agg] = await db
      .select({
        avgRating: avg(productReviews.rating),
        reviewCount: count(productReviews.id),
      })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.productId, productId),
          eq(productReviews.moderated, false)
        )
      );

    const newAvgRating = agg?.avgRating ? parseFloat(String(agg.avgRating)) : 0;
    const newReviewCount = agg?.reviewCount ?? 0;

    await db
      .update(products)
      .set({
        avgRating: newAvgRating,
        reviewCount: newReviewCount,
        updatedAt: new Date(),
      })
      .where(eq(products.id, productId));
  }

  // ── Public: create review ─────────────────────────────────────────────────

  /**
   * Creates a new review for a product.
   * - Validates product exists.
   * - Sets verified_purchase based on order history.
   * - Refreshes avg_rating and review_count on products.
   */
  async createReview(params: {
    customerId: string;
    productId: string;
    rating: number;
    title?: string;
    body: string;
  }): Promise<{ id: string }> {
    const { db } = this.deps;

    // Validate product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, params.productId))
      .limit(1);

    if (!product) {
      throw new ReviewProductNotFoundError(params.productId);
    }

    // Check for existing review (unique constraint on customer+product)
    const [existing] = await db
      .select({ id: productReviews.id })
      .from(productReviews)
      .where(
        and(
          eq(productReviews.customerId, params.customerId),
          eq(productReviews.productId, params.productId)
        )
      )
      .limit(1);

    if (existing) {
      throw new ReviewAlreadyExistsError();
    }

    // Check verified purchase status
    const verifiedPurchase = await this.hasCustomerOrderedProduct(
      params.customerId,
      params.productId
    );

    const row: InsertProductReview = {
      customerId: params.customerId,
      productId: params.productId,
      rating: params.rating,
      title: params.title ?? null,
      body: params.body,
      verifiedPurchase,
    };

    const [inserted] = await db
      .insert(productReviews)
      .values(row)
      .returning({ id: productReviews.id });

    // Refresh cached aggregates on products table
    await this.refreshProductAggregates(params.productId);

    return { id: inserted!.id };
  }

  // ── Public: list reviews ──────────────────────────────────────────────────

  /**
   * Returns paginated, non-moderated reviews for a product.
   */
  async listReviews(params: {
    productId: string;
    page?: number;
    limit?: number;
  }): Promise<ReviewListResult> {
    const { db } = this.deps;
    const page = params.page ?? 1;
    const limit = params.limit ?? 10;
    const offset = (page - 1) * limit;

    // Validate product exists
    const [product] = await db
      .select({ id: products.id })
      .from(products)
      .where(eq(products.id, params.productId))
      .limit(1);

    if (!product) {
      throw new ReviewProductNotFoundError(params.productId);
    }

    const [rows, countResult] = await Promise.all([
      db
        .select({
          id: productReviews.id,
          customerId: productReviews.customerId,
          rating: productReviews.rating,
          title: productReviews.title,
          body: productReviews.body,
          verifiedPurchase: productReviews.verifiedPurchase,
          vendorReply: productReviews.vendorReply,
          vendorRepliedAt: productReviews.vendorRepliedAt,
          createdAt: productReviews.createdAt,
        })
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, params.productId),
            eq(productReviews.moderated, false)
          )
        )
        .orderBy(desc(productReviews.createdAt))
        .limit(limit)
        .offset(offset),

      db
        .select({ total: count(productReviews.id) })
        .from(productReviews)
        .where(
          and(
            eq(productReviews.productId, params.productId),
            eq(productReviews.moderated, false)
          )
        ),
    ]);

    return {
      reviews: rows.map((r) => ({
        id: r.id,
        customerId: r.customerId,
        rating: r.rating,
        title: r.title,
        body: r.body,
        verifiedPurchase: r.verifiedPurchase,
        vendorReply: r.vendorReply,
        vendorRepliedAt: r.vendorRepliedAt,
        createdAt: r.createdAt,
      })),
      total: countResult[0]?.total ?? 0,
      page,
      limit,
    };
  }

  // ── Public: vendor reply ──────────────────────────────────────────────────

  /**
   * Allows a vendor to reply to a review on their product.
   * Validates the review belongs to a product the vendor owns.
   */
  async addVendorReply(params: {
    vendorId: string;
    reviewId: string;
    replyText: string;
  }): Promise<void> {
    const { db } = this.deps;

    // Load review + product to check ownership
    const [review] = await db
      .select({
        id: productReviews.id,
        productId: productReviews.productId,
        vendorId: products.vendorId,
      })
      .from(productReviews)
      .innerJoin(products, eq(productReviews.productId, products.id))
      .where(eq(productReviews.id, params.reviewId))
      .limit(1);

    if (!review) {
      throw new ReviewNotFoundError(params.reviewId);
    }

    if (review.vendorId !== params.vendorId) {
      throw new ReviewOwnershipError();
    }

    await db
      .update(productReviews)
      .set({
        vendorReply: params.replyText,
        vendorRepliedAt: new Date(),
        updatedAt: new Date(),
      })
      .where(eq(productReviews.id, params.reviewId));
  }

  // ── Public: admin moderation ──────────────────────────────────────────────

  /**
   * Admin soft-hides a review by setting moderated=true.
   * Also refreshes products.avg_rating and review_count.
   */
  async moderateReview(params: {
    reviewId: string;
    adminEmail: string;
  }): Promise<void> {
    const { db } = this.deps;

    const [review] = await db
      .select({ id: productReviews.id, productId: productReviews.productId })
      .from(productReviews)
      .where(eq(productReviews.id, params.reviewId))
      .limit(1);

    if (!review) {
      throw new ReviewNotFoundError(params.reviewId);
    }

    await db
      .update(productReviews)
      .set({
        moderated: true,
        moderatedByAdminEmail: params.adminEmail,
        updatedAt: new Date(),
      })
      .where(eq(productReviews.id, params.reviewId));

    // Refresh cached aggregates after moderation (review no longer counts)
    await this.refreshProductAggregates(review.productId);
  }
}
