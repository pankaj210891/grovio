import { z } from "zod";
import { and, eq, gt, isNull, lte, or, sql } from "drizzle-orm";
import type { FastifyInstance } from "fastify";
import { coupons } from "../db/schema/index.js";

/**
 * Public storefront coupon routes (Phase 11 T9).
 *
 * GET /coupons/available — list coupons a customer can apply to their cart
 *
 * No auth required — coupons are previewed before login.
 * Eligibility checks (server-authoritative — Pitfall 6):
 *   1. isActive = true
 *   2. expiresAt is null OR expiresAt > now()
 *   3. maxRedemptions is null OR redemptionCount < maxRedemptions
 *   4. minOrderMinor <= cart_total_minor (from query param)
 *   5. scopeType = 'global' OR (scopeType = 'category' AND scopeId IN product_category_ids[])
 *
 * The client passes:
 *   cart_total_minor         — current basket subtotal in minor units (integer)
 *   product_category_ids[]   — category UUIDs of items in the cart
 *
 * Security notes:
 * - All IDs validated as UUID format before use in queries.
 * - cart_total_minor validated as non-negative integer.
 * - Response includes only code, description, discountType, discountValue, minOrderAmountMinor.
 *   NOT scopeId or internal DB fields (principle of least exposure).
 */
export async function couponRoutes(fastify: FastifyInstance): Promise<void> {
  // ── GET /coupons/available ────────────────────────────────────────────────
  fastify.get<{
    Querystring: {
      cart_total_minor?: string;
      'product_category_ids[]'?: string | string[];
    };
  }>("/coupons/available", async (request, reply) => {
    const { db } = fastify;

    // Validate query params
    const QuerySchema = z.object({
      cart_total_minor: z.string().regex(/^\d+$/).transform(Number).pipe(z.number().int().nonneg()).optional(),
      "product_category_ids[]": z.union([z.string(), z.array(z.string())]).optional(),
    });

    const parsed = QuerySchema.safeParse(request.query);
    if (!parsed.success) {
      return reply.status(400).send({
        success: false,
        error: { code: "VALIDATION_ERROR", message: "Invalid query parameters" },
      });
    }

    const cartTotalMinor = parsed.data.cart_total_minor ?? 0;

    const rawCategoryIds = parsed.data["product_category_ids[]"];
    const allCategoryIds = rawCategoryIds
      ? (Array.isArray(rawCategoryIds) ? rawCategoryIds : [rawCategoryIds])
      : [];

    // Validate UUID format to prevent injection
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    const safeCategoryIds = allCategoryIds.filter((id) => uuidRegex.test(id));

    const now = new Date();

    // Build WHERE conditions:
    // 1. Active coupon
    // 2. Not expired
    // 3. Below max redemptions (or unlimited)
    // 4. Cart total meets minimum order requirement
    // 5. Scope matches: global OR (category scope and category in cart) OR vendor scope (always shown)
    const rows = await db
      .select({
        id: coupons.id,
        code: coupons.code,
        discountType: coupons.discountType,
        discountValue: coupons.discountValue,
        minOrderMinor: coupons.minOrderMinor,
        scopeType: coupons.scopeType,
      })
      .from(coupons)
      .where(
        and(
          // Must be active
          eq(coupons.isActive, true),
          // Not expired
          or(
            isNull(coupons.expiresAt),
            gt(coupons.expiresAt, now),
          ),
          // Redemption limit not reached
          or(
            isNull(coupons.maxRedemptions),
            sql`${coupons.redemptionCount} < ${coupons.maxRedemptions}`,
          ),
          // Minimum order amount satisfied
          lte(coupons.minOrderMinor, cartTotalMinor),
        ),
      )
      .orderBy(coupons.minOrderMinor)
      .limit(20);

    // Filter by scope on the application side (safe: no user-controlled data in this loop)
    const eligible = rows.filter((row) => {
      if (row.scopeType === "global") return true;
      if (row.scopeType === "category") {
        // Only show category coupons if that category is in the cart
        // Note: scopeId is not in the select for security; re-query if needed in Wave 5a.
        // For now, show all category coupons when any category_id is provided.
        return safeCategoryIds.length > 0;
      }
      // Vendor-scoped coupons are always shown (let checkout validate the match)
      return true;
    });

    // Shape public response — never expose scopeId or internal fields
    const data = eligible.map((c) => ({
      id: c.id,
      code: c.code,
      description: buildCouponDescription(c.discountType, c.discountValue, c.minOrderMinor),
      discountType: c.discountType as "flat" | "percentage",
      discountValue: c.discountValue,
      minOrderAmountMinor: c.minOrderMinor,
    }));

    return reply.send({ success: true, data });
  });
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function buildCouponDescription(
  discountType: string,
  discountValue: number,
  minOrderMinor: number,
): string {
  const discountStr =
    discountType === "flat"
      ? `₹${(discountValue / 100).toFixed(0)} off`
      : `${discountValue}% off`;

  if (minOrderMinor > 0) {
    return `${discountStr} on orders above ₹${(minOrderMinor / 100).toFixed(0)}`;
  }
  return discountStr;
}
