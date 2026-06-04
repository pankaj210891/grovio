import {
  bigint,
  boolean,
  integer,
  pgTable,
  text,
  timestamp,
  uuid,
} from "drizzle-orm/pg-core";

/**
 * coupons table
 *
 * Stores coupon codes and their eligibility conditions (D-17, D-18, CHK-06).
 * Feature-flagged via COUPONS_ENABLED (PAY-02 pattern — Redis-cached feature flag).
 * One coupon per order; admin sets scope per coupon.
 *
 * Key design decisions:
 * - code: unique, used as the lookup key when a customer enters a code at checkout.
 * - discountType: 'flat' (fixed amount off) or 'percentage' (percent off).
 *   text column — values enforced at service layer (CouponService).
 * - discountValue: BIGINT minor units for 'flat' type (e.g., 500 = ₹5.00 off).
 *   For 'percentage' type, stored as integer basis points × 100 scaled — actually stored
 *   as whole number percent (e.g., 10 = 10% off). BIGINT used consistently for both
 *   to avoid DECIMAL/FLOAT (Pitfall 1). CouponService interprets based on discountType.
 * - scopeType / scopeId: determines what the coupon applies to (D-17).
 *   scopeType: 'vendor' | 'product' | 'category'
 *   scopeId: UUID of the relevant vendor/product/category, or null for global scope.
 * - minOrderMinor: minimum eligible order amount (D-18). BIGINT minor units.
 * - maxRedemptions: optional cap on total redemption count (D-18). null = unlimited.
 * - redemptionCount: tracks total uses; incremented atomically at coupon application.
 *   Service checks: redemptionCount < maxRedemptions before applying.
 * - expiresAt: optional expiry timestamp (D-18). null = no expiry.
 * - isActive: boolean toggle. Deactivated coupons cannot be applied regardless of other conditions.
 *
 * Coupon application flow (Pitfall 6): code is stored on the order at placement; discount is
 * re-derived from this table at placement — the client-provided discount amount is never trusted.
 *
 * Covers CHK-06, D-17, D-18.
 */
export const coupons = pgTable("coupons", {
  id: uuid("id").defaultRandom().primaryKey(),

  /**
   * Unique coupon code entered by the customer at checkout.
   * Case-insensitive comparison handled at service layer.
   * UNIQUE: one code maps to exactly one coupon row.
   */
  code: text("code").notNull().unique(),

  /**
   * Type of discount (D-17).
   * 'flat': fixed amount discount (discountValue is in minor currency units).
   * 'percentage': percentage discount (discountValue is whole number percent, e.g., 10 = 10%).
   */
  discountType: text("discount_type").notNull(),

  /**
   * Discount value (D-17). Interpretation depends on discountType:
   * - 'flat': value in BIGINT minor units (e.g., 500 = ₹5.00 off)
   * - 'percentage': whole number percentage (e.g., 10 = 10% off)
   * BIGINT for consistency — no FLOAT/DECIMAL (Pitfall 1).
   */
  discountValue: bigint("discount_value", { mode: "number" }).notNull(),

  /**
   * Scope type for this coupon (D-17).
   * 'vendor': discounts all items from a specific vendor.
   * 'product': discounts a specific product.
   * 'category': discounts all items in a specific category.
   * Additional scope types may be added by admin in future phases.
   */
  scopeType: text("scope_type").notNull(),

  /**
   * UUID of the vendor/product/category this coupon applies to (D-17).
   * null for a global coupon that applies to the entire order.
   * Validated by CouponService against the relevant table before applying.
   */
  scopeId: uuid("scope_id"),

  /**
   * Minimum eligible order amount (D-18).
   * BIGINT minor units. 0 = no minimum. Order subtotal must be >= minOrderMinor.
   * CouponService checks against the scoped order subtotal (not the full order total).
   */
  minOrderMinor: bigint("min_order_minor", { mode: "number" })
    .notNull()
    .default(0),

  /**
   * Maximum total redemptions allowed (D-18).
   * null = unlimited. Service checks: redemptionCount < maxRedemptions before applying.
   */
  maxRedemptions: integer("max_redemptions"),

  /**
   * Running count of coupon redemptions.
   * Incremented atomically at order placement when coupon is applied.
   * Compared against maxRedemptions for eligibility check (D-18).
   */
  redemptionCount: integer("redemption_count").notNull().default(0),

  /**
   * Optional expiry timestamp (D-18).
   * null = coupon never expires. If non-null, coupon cannot be applied after this time.
   */
  expiresAt: timestamp("expires_at", { withTimezone: true }),

  /**
   * Active/inactive toggle.
   * false = coupon is deactivated regardless of other conditions.
   * Admin can deactivate a coupon without deleting it (preserves order history).
   */
  isActive: boolean("is_active").notNull().default(true),

  // -------------------------------------------------------------------------
  // Phase 6 extension (D-14, VEN-06)
  // -------------------------------------------------------------------------

  /**
   * Type of actor who created this coupon (D-14, VEN-06).
   * 'admin': created by admin panel (any scope type allowed).
   * 'vendor': created by vendor panel (scope='vendor' only — auto-scoped to their store).
   * null for coupons created before Phase 6 (backward compatible).
   * Vendor-created coupons cannot have category scope (admin-only — enforced at service layer).
   */
  createdByType: text("created_by_type"),

  /**
   * ID of the actor who created this coupon (D-14, VEN-06).
   * For 'admin': admin_users.id UUID string.
   * For 'vendor': vendor_users.id UUID string.
   * null for coupons created before Phase 6 (backward compatible).
   * Stored as text (not FK) to allow reference to both admin_users and vendor_users.
   */
  createdById: text("created_by_id"),

  createdAt: timestamp("created_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updated_at", { withTimezone: true })
    .defaultNow()
    .notNull(),
});

/** TypeScript type for inserting a new coupon row */
export type InsertCoupon = typeof coupons.$inferInsert;

/** TypeScript type for selecting a coupon row */
export type SelectCoupon = typeof coupons.$inferSelect;
