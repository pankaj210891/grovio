import { z } from "zod";

/**
 * Basket contract schemas for Phase 5: Commerce Core.
 *
 * Per D-01: All money fields are z.number().int() (minor units, e.g. paise/cents).
 * Per Pitfall 5: bigint is NEVER used in contracts — JSON serialization uses number.
 * Per D-04: Basket state is server-authoritative; React Query fetches from API.
 *
 * Security notes:
 * - T-05-IV: quantity bounded with .min(1).max(100) to reject extreme values.
 * - T-05-04: unitPriceMinor/lineSubtotalMinor/subtotalMinor typed as z.number().int()
 *   — float/string payloads rejected at parse time. Server re-derives totals at checkout (CHK-04).
 */

/**
 * A single item within a basket session.
 * Includes denormalized product and vendor info for display without extra API calls.
 *
 * lineSubtotalMinor = quantity * unitPriceMinor (computed server-side, verified at checkout).
 */
export const BasketItemSchema = z.object({
  /** Basket item row ID */
  id: z.string().uuid(),
  /** FK to the product */
  productId: z.string().uuid(),
  /**
   * FK to the product variant, or null for variant-free products (D-20).
   * Exactly one of (productVariantId | null) per item.
   */
  productVariantId: z.string().uuid().nullable(),
  /** Quantity requested (min 1 — validated server-side) */
  quantity: z.number().int(),
  /**
   * Unit price in minor currency units at the time of add-to-basket.
   * This is a snapshot for display; server re-fetches authoritative price at checkout (CHK-04).
   * Must be an integer — never a float (D-01, Pitfall 5).
   */
  unitPriceMinor: z.number().int(),
  /**
   * Line subtotal in minor currency units (quantity × unitPriceMinor).
   * Computed server-side for display; re-derived at checkout (CHK-04).
   */
  lineSubtotalMinor: z.number().int(),
  /** Denormalized product display name */
  productName: z.string(),
  /** URL-safe product slug for linking to the PDP */
  productSlug: z.string(),
  /** FK to the selling vendor */
  vendorId: z.string().uuid(),
  /** Denormalized vendor display name for grouping (D-24) */
  vendorName: z.string(),
  /** Product image URL for display in the cart, or null if no image */
  imageUrl: z.string().nullable(),
});

/** TypeScript type inferred from BasketItemSchema */
export type BasketItem = z.infer<typeof BasketItemSchema>;

/**
 * Items from a single vendor, grouped for the cart page layout (D-24).
 * Customers see items grouped by vendor with a section header per vendor.
 */
export const VendorBasketGroupSchema = z.object({
  vendorId: z.string().uuid(),
  vendorName: z.string(),
  /** Items from this vendor in the basket */
  items: z.array(BasketItemSchema),
  /**
   * Sum of lineSubtotalMinor for all items in this vendor group.
   * Minor currency units, always an integer.
   */
  vendorSubtotalMinor: z.number().int(),
});

/** TypeScript type inferred from VendorBasketGroupSchema */
export type VendorBasketGroup = z.infer<typeof VendorBasketGroupSchema>;

/**
 * The full basket session response.
 * Includes all items and pre-computed aggregates for the cart sidebar (D-25).
 *
 * Per D-01: All amounts are integer minor units (z.number().int()).
 */
export const BasketSchema = z.object({
  /** Basket session ID (UUID) */
  sessionId: z.string().uuid(),
  /**
   * true if this is a guest basket (keyed by httpOnly cookie grovio_basket_token).
   * false if the basket belongs to an authenticated customer (D-01).
   */
  isGuest: z.boolean(),
  /** Flat list of all basket items */
  items: z.array(BasketItemSchema),
  /** Total number of items (sum of quantities) */
  itemCount: z.number().int(),
  /**
   * Sum of all line subtotals in minor currency units.
   * Displayed in the cart sidebar before delivery/discounts (D-25).
   */
  subtotalMinor: z.number().int(),
  /**
   * Items grouped by vendor for the cart page layout (D-24).
   * Each group has a section header with the vendor name.
   */
  groupedByVendor: z.array(VendorBasketGroupSchema),
});

/** TypeScript type inferred from BasketSchema */
export type Basket = z.infer<typeof BasketSchema>;

/**
 * Input schema for adding a product to the basket.
 *
 * Security note (T-05-IV):
 * - quantity bounded .min(1).max(100) to prevent extreme values.
 * - productId/productVariantId validated as UUIDs to prevent malformed lookups.
 */
export const AddToBasketInputSchema = z.object({
  /** UUID of the product to add */
  productId: z.string().uuid(),
  /**
   * UUID of the selected variant, or null/undefined for variant-free products.
   * Server validates this FK before inserting.
   */
  productVariantId: z.string().uuid().nullable().optional(),
  /**
   * Quantity to add. Bounded 1–100 (T-05-IV).
   * Must be an integer.
   */
  quantity: z.number().int().min(1).max(100),
});

/** TypeScript type inferred from AddToBasketInputSchema */
export type AddToBasketInput = z.infer<typeof AddToBasketInputSchema>;

/**
 * Input schema for updating the quantity of an existing basket item.
 *
 * Security note (T-05-IV): quantity bounded 1–100 same as AddToBasketInput.
 */
export const UpdateBasketItemInputSchema = z.object({
  /**
   * New quantity for the basket item. Bounded 1–100 (T-05-IV).
   * To remove an item, use DELETE /basket/items/:id instead.
   */
  quantity: z.number().int().min(1).max(100),
});

/** TypeScript type inferred from UpdateBasketItemInputSchema */
export type UpdateBasketItemInput = z.infer<typeof UpdateBasketItemInputSchema>;
