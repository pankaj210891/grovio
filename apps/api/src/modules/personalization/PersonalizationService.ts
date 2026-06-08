import { and, desc, eq, gt, inArray, sql } from "drizzle-orm";
import type { NodePgDatabase } from "drizzle-orm/node-postgres";
import type { Redis } from "ioredis";
import {
  customerProductViews,
  products,
  orderItems,
  vendorOrders,
  orders,
  categories,
} from "../../db/schema/index.js";

// ---------------------------------------------------------------------------
// Deps
// ---------------------------------------------------------------------------

interface PersonalizationServiceDeps {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  db: NodePgDatabase<any>;
  redis: Redis;
}

// ---------------------------------------------------------------------------
// Output types
// ---------------------------------------------------------------------------

export interface ProductSummary {
  id: string;
  name: string;
  slug: string;
  basePriceMinor: number;
  avgRating: number;
  reviewCount: number;
  soldCount: number;
}

export interface PersonalizedHomepage {
  recentlyViewed: ProductSummary[];
  continueShoppingCategory: { id: string; name: string; slug: string } | null;
  recommendations: ProductSummary[];
}

// ---------------------------------------------------------------------------
// PersonalizationService
// ---------------------------------------------------------------------------

/**
 * PersonalizationService
 *
 * Endpoints:
 * - recordView(): inserts customer_product_views (rate-limited: dedup within 5 min)
 * - getRecentlyViewed(): last 10 distinct products viewed by customer
 * - getTrending(): weighted score products (Redis-cached 1h)
 * - getFrequentlyBoughtTogether(): co-purchase query (Redis-cached 2h)
 * - getRelatedProducts(): same category ±30% price (Redis-cached 1h)
 * - getPersonalizedHomepage(): 3-section homepage (Redis-cached 15min per customer)
 * - applyPersonalizedBoost(): returns category IDs for function_score boost
 *
 * Plan 11-05 T5.
 */
export class PersonalizationService {
  constructor(private deps: PersonalizationServiceDeps) {}

  // ── TTLs ─────────────────────────────────────────────────────────────────

  private readonly TRENDING_TTL_SECONDS = 3600;      // 1 hour
  private readonly FBT_TTL_SECONDS = 7200;           // 2 hours
  private readonly RELATED_TTL_SECONDS = 3600;       // 1 hour
  private readonly HOMEPAGE_TTL_SECONDS = 900;       // 15 minutes
  private readonly VIEW_DEDUP_SECONDS = 300;         // 5 minutes

  // ── Private helpers ───────────────────────────────────────────────────────

  private productSummarySelect() {
    return {
      id: products.id,
      name: products.name,
      slug: products.slug,
      basePriceMinor: products.basePriceMinor,
      avgRating: products.avgRating,
      reviewCount: products.reviewCount,
      soldCount: products.soldCount,
    };
  }

  // ── Public: record product view ───────────────────────────────────────────

  /**
   * Records a product view for an authenticated customer.
   * Rate-limited: skips insert if same (customerId, productId) viewed within 5 min.
   */
  async recordView(customerId: string, productId: string): Promise<void> {
    const { db, redis } = this.deps;

    // Rate-limit key: dedup same customer+product within VIEW_DEDUP_SECONDS
    const dedupKey = `view:dedup:${customerId}:${productId}`;
    const existing = await redis.get(dedupKey);
    if (existing) {
      return; // Skip duplicate view within rate-limit window
    }

    await db.insert(customerProductViews).values({ customerId, productId });

    // Set dedup key with TTL
    await redis.setex(dedupKey, this.VIEW_DEDUP_SECONDS, "1");
  }

  // ── Public: recently viewed ───────────────────────────────────────────────

  /**
   * Returns last 10 distinct products viewed by the customer, ordered by
   * most recently viewed.
   */
  async getRecentlyViewed(customerId: string): Promise<ProductSummary[]> {
    const { db } = this.deps;

    // Use DISTINCT ON (product_id) ordered by max(viewed_at) DESC to get last 10 distinct
    const rows = await db.execute(
      sql`
        SELECT DISTINCT ON (cpv.product_id)
          p.id,
          p.name,
          p.slug,
          p.base_price_minor AS "basePriceMinor",
          p.avg_rating AS "avgRating",
          p.review_count AS "reviewCount",
          p.sold_count AS "soldCount",
          cpv.viewed_at
        FROM customer_product_views cpv
        JOIN products p ON p.id = cpv.product_id
        WHERE cpv.customer_id = ${customerId}::uuid
          AND p.archived_at IS NULL
          AND p.status = 'approved'
        ORDER BY cpv.product_id, cpv.viewed_at DESC
      `
    );

    // Sort by viewed_at DESC and limit to 10
    type RawRow = { id: string; name: string; slug: string; basePriceMinor: unknown; avgRating: unknown; reviewCount: unknown; soldCount: unknown; viewed_at: string };
    const sorted = (rows.rows as RawRow[])
      .sort((a, b) => new Date(b.viewed_at).getTime() - new Date(a.viewed_at).getTime())
      .slice(0, 10)
      .map(({ id, name, slug, basePriceMinor, avgRating, reviewCount, soldCount }) => ({
        id,
        name,
        slug,
        basePriceMinor: Number(basePriceMinor),
        avgRating: Number(avgRating),
        reviewCount: Number(reviewCount),
        soldCount: Number(soldCount),
      }));

    return sorted;
  }

  // ── Public: trending products ─────────────────────────────────────────────

  /**
   * Returns up to 20 trending products.
   * Score = (order_count_7d × 3) + (view_count_7d × 1).
   * Redis-cached with 1-hour TTL.
   */
  async getTrending(): Promise<ProductSummary[]> {
    const { db, redis } = this.deps;

    const cacheKey = "trending:products";
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProductSummary[];
    }

    const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000);

    // Compute weighted trending score per product over last 7 days
    const rows = await db.execute(
      sql`
        WITH order_counts AS (
          SELECT oi.product_id, COUNT(*) AS order_count
          FROM order_items oi
          JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
          JOIN orders o ON vo.order_id = o.id
          WHERE o.created_at >= ${sevenDaysAgo}
          GROUP BY oi.product_id
        ),
        view_counts AS (
          SELECT cpv.product_id, COUNT(*) AS view_count
          FROM customer_product_views cpv
          WHERE cpv.viewed_at >= ${sevenDaysAgo}
          GROUP BY cpv.product_id
        )
        SELECT
          p.id,
          p.name,
          p.slug,
          p.base_price_minor AS "basePriceMinor",
          p.avg_rating AS "avgRating",
          p.review_count AS "reviewCount",
          p.sold_count AS "soldCount",
          COALESCE(oc.order_count, 0) * 3 + COALESCE(vc.view_count, 0) AS score
        FROM products p
        LEFT JOIN order_counts oc ON oc.product_id = p.id
        LEFT JOIN view_counts vc ON vc.product_id = p.id
        WHERE p.archived_at IS NULL
          AND p.status = 'approved'
          AND (oc.order_count IS NOT NULL OR vc.view_count IS NOT NULL)
        ORDER BY score DESC
        LIMIT 20
      `
    );

    const trending: ProductSummary[] = (rows.rows as Array<{
      id: string;
      name: string;
      slug: string;
      basePriceMinor: number;
      avgRating: number;
      reviewCount: number;
      soldCount: number;
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      basePriceMinor: Number(r.basePriceMinor),
      avgRating: Number(r.avgRating),
      reviewCount: Number(r.reviewCount),
      soldCount: Number(r.soldCount),
    }));

    await redis.setex(cacheKey, this.TRENDING_TTL_SECONDS, JSON.stringify(trending));
    return trending;
  }

  // ── Public: frequently bought together ────────────────────────────────────

  /**
   * Returns up to 6 products frequently ordered together with the given product.
   * Redis-cached per product ID with 2-hour TTL.
   */
  async getFrequentlyBoughtTogether(productId: string): Promise<ProductSummary[]> {
    const { db, redis } = this.deps;

    const cacheKey = `fbt:${productId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProductSummary[];
    }

    const rows = await db.execute(
      sql`
        SELECT
          p.id,
          p.name,
          p.slug,
          p.base_price_minor AS "basePriceMinor",
          p.avg_rating AS "avgRating",
          p.review_count AS "reviewCount",
          p.sold_count AS "soldCount",
          COUNT(*) AS co_count
        FROM order_items oi_target
        JOIN order_items oi_other ON oi_target.vendor_order_id = oi_other.vendor_order_id
          AND oi_other.product_id != oi_target.product_id
        JOIN products p ON p.id = oi_other.product_id
        WHERE oi_target.product_id = ${productId}::uuid
          AND p.archived_at IS NULL
          AND p.status = 'approved'
        GROUP BY p.id, p.name, p.slug, p.base_price_minor, p.avg_rating, p.review_count, p.sold_count
        ORDER BY co_count DESC
        LIMIT 6
      `
    );

    const result: ProductSummary[] = (rows.rows as Array<{
      id: string;
      name: string;
      slug: string;
      basePriceMinor: number;
      avgRating: number;
      reviewCount: number;
      soldCount: number;
    }>).map((r) => ({
      id: r.id,
      name: r.name,
      slug: r.slug,
      basePriceMinor: Number(r.basePriceMinor),
      avgRating: Number(r.avgRating),
      reviewCount: Number(r.reviewCount),
      soldCount: Number(r.soldCount),
    }));

    await redis.setex(cacheKey, this.FBT_TTL_SECONDS, JSON.stringify(result));
    return result;
  }

  // ── Public: related products ──────────────────────────────────────────────

  /**
   * Returns up to 8 related products (same category, ±30% price range).
   * Ordered by avg_rating DESC. Redis-cached per product ID with 1-hour TTL.
   */
  async getRelatedProducts(productId: string): Promise<ProductSummary[]> {
    const { db, redis } = this.deps;

    const cacheKey = `related:${productId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as ProductSummary[];
    }

    // Fetch the target product's category and price
    const [target] = await db
      .select({
        categoryId: products.categoryId,
        basePriceMinor: products.basePriceMinor,
      })
      .from(products)
      .where(eq(products.id, productId))
      .limit(1);

    if (!target) {
      await redis.setex(cacheKey, this.RELATED_TTL_SECONDS, "[]");
      return [];
    }

    const priceMin = Math.floor(target.basePriceMinor * 0.7);
    const priceMax = Math.ceil(target.basePriceMinor * 1.3);

    const rows = await db
      .select(this.productSummarySelect())
      .from(products)
      .where(
        and(
          eq(products.categoryId, target.categoryId),
          sql`${products.basePriceMinor} BETWEEN ${priceMin} AND ${priceMax}`,
          sql`${products.id} != ${productId}::uuid`,
          sql`${products.archivedAt} IS NULL`,
          eq(products.status, "approved")
        )
      )
      .orderBy(desc(products.avgRating))
      .limit(8);

    const result: ProductSummary[] = rows.map((r) => ({
      ...r,
      basePriceMinor: Number(r.basePriceMinor),
    }));

    await redis.setex(cacheKey, this.RELATED_TTL_SECONDS, JSON.stringify(result));
    return result;
  }

  // ── Public: personalized homepage ─────────────────────────────────────────

  /**
   * Returns personalized homepage sections for an authenticated customer.
   * Redis-cached per customerId with 15-min TTL.
   */
  async getPersonalizedHomepage(customerId: string): Promise<PersonalizedHomepage> {
    const { db, redis } = this.deps;

    const cacheKey = `homepage:personalized:${customerId}`;
    const cached = await redis.get(cacheKey);
    if (cached) {
      return JSON.parse(cached) as PersonalizedHomepage;
    }

    // 1. Recently viewed (last 10 distinct)
    const recentlyViewed = await this.getRecentlyViewed(customerId);

    // 2. Continue shopping: most recently viewed product's category
    let continueShoppingCategory: { id: string; name: string; slug: string } | null = null;
    if (recentlyViewed.length > 0) {
      const [product] = await db
        .select({ categoryId: products.categoryId })
        .from(products)
        .where(eq(products.id, recentlyViewed[0]!.id))
        .limit(1);

      if (product) {
        const [cat] = await db
          .select({ id: categories.id, name: categories.name, slug: categories.slug })
          .from(categories)
          .where(eq(categories.id, product.categoryId))
          .limit(1);

        if (cat) {
          continueShoppingCategory = cat;
        }
      }
    }

    // 3. Recommendations: products from categories the customer has ordered from
    //    that they haven't purchased again (gap fill).
    const orderedCategories = await db.execute(
      sql`
        SELECT DISTINCT p.category_id
        FROM order_items oi
        JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
        JOIN orders o ON vo.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.customer_id = ${customerId}::uuid
        LIMIT 5
      `
    );

    let recommendations: ProductSummary[] = [];

    const orderedCategoryIds = (orderedCategories.rows as Array<{ category_id: string }>)
      .map((r) => r.category_id);

    if (orderedCategoryIds.length > 0) {
      // Find products the customer has NOT ordered yet in those categories
      const orderedProductIds = await db.execute(
        sql`
          SELECT DISTINCT oi.product_id
          FROM order_items oi
          JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
          JOIN orders o ON vo.order_id = o.id
          WHERE o.customer_id = ${customerId}::uuid
        `
      );

      const purchasedIds = (orderedProductIds.rows as Array<{ product_id: string }>)
        .map((r) => r.product_id);

      const recQuery = db
        .select(this.productSummarySelect())
        .from(products)
        .where(
          and(
            inArray(products.categoryId, orderedCategoryIds),
            sql`${products.archivedAt} IS NULL`,
            eq(products.status, "approved")
          )
        )
        .orderBy(desc(products.avgRating))
        .limit(12);

      const recRows = await recQuery;

      recommendations = recRows
        .filter((r) => !purchasedIds.includes(r.id))
        .slice(0, 6)
        .map((r) => ({
          ...r,
          basePriceMinor: Number(r.basePriceMinor),
        }));
    }

    // Fallback: use trending if not enough recommendations
    if (recommendations.length < 6) {
      const trending = await this.getTrending();
      const existing = new Set(recommendations.map((r) => r.id));
      const filler = trending.filter((t) => !existing.has(t.id)).slice(0, 6 - recommendations.length);
      recommendations = [...recommendations, ...filler];
    }

    const result: PersonalizedHomepage = {
      recentlyViewed,
      continueShoppingCategory,
      recommendations,
    };

    await redis.setex(cacheKey, this.HOMEPAGE_TTL_SECONDS, JSON.stringify(result));
    return result;
  }

  // ── Public: customer category affinity ────────────────────────────────────

  /**
   * Returns category IDs that the customer has purchased from.
   * Used by SearchService for personalized function_score boosting (T5.7).
   * Returns empty array if customer has no purchase history.
   */
  async getCustomerCategoryAffinity(customerId: string): Promise<string[]> {
    const { db } = this.deps;

    const rows = await db.execute(
      sql`
        SELECT DISTINCT p.category_id
        FROM order_items oi
        JOIN vendor_orders vo ON oi.vendor_order_id = vo.id
        JOIN orders o ON vo.order_id = o.id
        JOIN products p ON oi.product_id = p.id
        WHERE o.customer_id = ${customerId}::uuid
        LIMIT 10
      `
    );

    return (rows.rows as Array<{ category_id: string }>).map((r) => r.category_id);
  }
}
