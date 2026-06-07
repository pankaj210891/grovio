/**
 * Cart page — /cart (D-24, D-25, CHK-01)
 *
 * Phase 11 T6 enhancements:
 * - Inline coupon suggestions dropdown on coupon input focus
 * - Cart recommendations ("You might also like") horizontal scroll
 *
 * Groups basket items by vendor (D-24) with per-vendor section headers and
 * delivery estimate labels. Shows an OrderSummary sidebar on desktop and
 * below items on mobile (D-25).
 *
 * Security note (T-05-UI): prices here are informational displays from the
 * server basket response. All totals are recomputed server-side at checkout.
 */

import { useState, useRef } from 'react';
import { Link } from 'react-router-dom';
import { AnimatePresence, motion } from 'motion/react';
import { ShoppingCart, Tag, ChevronLeft, ChevronRight } from 'lucide-react';
import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '../components/layout/PageTransition.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { BasketItemRow } from '../components/basket/BasketItem.js';
import { OrderSummary } from '../components/basket/OrderSummary.js';
import { ProductCard } from '../components/ui/ProductCard.js';
import { useBasket, useUpdateBasketItem, useRemoveBasketItem } from '../hooks/useBasket.js';
import { useUiStore } from '../store/ui-store.js';
import { apiClient } from '../lib/api-client.js';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface AvailableCoupon {
  id: string;
  code: string;
  description: string;
  discountType: 'flat' | 'percentage';
  discountValue: number;
  minOrderAmountMinor: number;
}

interface AvailableCouponsResponse {
  success: boolean;
  data: AvailableCoupon[];
}

interface RecommendedProduct {
  id: string;
  slug: string;
  name: string;
  basePriceMinor: number;
  imageUrl: string | null;
  vendorName: string;
}

interface CartRecommendationsResponse {
  success: boolean;
  data: RecommendedProduct[];
}

// ---------------------------------------------------------------------------
// CouponInputWithSuggestions
// ---------------------------------------------------------------------------

interface CouponInputProps {
  cartTotalMinor: number;
  categoryIds: string[];
  onApply: (code: string) => void;
}

function CouponInputWithSuggestions({ cartTotalMinor, categoryIds, onApply }: CouponInputProps) {
  const [code, setCode] = useState('');
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const { data: availableCoupons, isLoading: couponsLoading } = useQuery<AvailableCoupon[]>({
    queryKey: ['coupons', 'available', cartTotalMinor, categoryIds.join(',')],
    queryFn: async () => {
      const params = new URLSearchParams({
        cart_total_minor: String(cartTotalMinor),
      });
      categoryIds.forEach((id) => params.append('product_category_ids[]', id));
      const res = await apiClient.get<AvailableCouponsResponse>(`/coupons/available?${params.toString()}`);
      return res.data;
    },
    enabled: dropdownOpen && cartTotalMinor > 0,
    staleTime: 5 * 60 * 1000,
  });

  function handleFocus() {
    setDropdownOpen(true);
  }

  function handleBlur() {
    setTimeout(() => setDropdownOpen(false), 150);
  }

  function handleCouponSelect(selectedCode: string) {
    setCode(selectedCode);
    setDropdownOpen(false);
    onApply(selectedCode);
  }

  function handleApply() {
    if (!code.trim()) return;
    onApply(code.trim());
  }

  function formatCouponDiscount(coupon: AvailableCoupon): string {
    if (coupon.discountType === 'flat') {
      return `Save ${formatPrice(coupon.discountValue)}`;
    }
    return `${coupon.discountValue}% off`;
  }

  return (
    <div className="space-y-2">
      <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide flex items-center gap-1">
        <Tag className="h-3 w-3" aria-hidden="true" />
        Coupon
      </p>

      <div className="relative">
        <div className="flex gap-2">
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              id="coupon-code"
              type="text"
              placeholder="Enter coupon code"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              onFocus={handleFocus}
              onBlur={handleBlur}
              aria-label="Coupon code"
              aria-autocomplete="list"
              aria-expanded={dropdownOpen}
              className="w-full h-10 px-3 rounded-md border border-grovio-border bg-grovio-surface text-sm text-grovio-text placeholder:text-grovio-text-muted focus:outline-none focus:ring-2 focus:ring-grovio-primary"
            />
          </div>
          <button
            type="button"
            onClick={handleApply}
            disabled={!code.trim()}
            className="h-10 px-4 text-sm font-medium bg-grovio-primary text-white rounded-md hover:bg-grovio-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
          >
            Apply
          </button>
        </div>

        {/* Coupon suggestions dropdown */}
        <AnimatePresence>
          {dropdownOpen && (
            <motion.div
              initial={{ opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.15 }}
              className="absolute top-[calc(100%+4px)] left-0 right-0 z-30 rounded-md border border-grovio-border bg-grovio-surface-raised shadow-lg overflow-hidden"
              role="listbox"
              aria-label="Available coupons"
            >
              {couponsLoading && (
                <div className="p-3">
                  <Skeleton className="h-8 w-full" />
                </div>
              )}

              {!couponsLoading && (!availableCoupons || availableCoupons.length === 0) && (
                <p className="px-4 py-3 text-sm text-grovio-text-muted">
                  No coupons available for your current cart.
                </p>
              )}

              {!couponsLoading && availableCoupons && availableCoupons.length > 0 && (
                <>
                  <p className="px-4 pt-3 pb-1 text-xs font-medium text-grovio-text-muted">
                    Available coupons
                  </p>
                  {availableCoupons.map((coupon) => (
                    <button
                      key={coupon.id}
                      type="button"
                      role="option"
                      aria-selected={false}
                      onMouseDown={() => handleCouponSelect(coupon.code)}
                      className="flex w-full items-center justify-between px-4 py-2.5 text-left hover:bg-grovio-surface transition-colors"
                    >
                      <div>
                        <p className="text-sm font-semibold text-grovio-primary">{coupon.code}</p>
                        <p className="text-xs text-grovio-text-muted">{coupon.description}</p>
                      </div>
                      <span className="text-xs font-semibold text-green-600 flex-shrink-0 ml-2">
                        {formatCouponDiscount(coupon)}
                      </span>
                    </button>
                  ))}
                </>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <p className="text-xs text-grovio-text-muted">Coupons are finalized at checkout.</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CartRecommendations
// ---------------------------------------------------------------------------

interface CartRecommendationsProps {
  categoryIds: string[];
  excludeProductIds: string[];
}

function CartRecommendations({ categoryIds, excludeProductIds }: CartRecommendationsProps) {
  const { data: recommendations, isLoading } = useQuery<RecommendedProduct[]>({
    queryKey: ['products', 'recommendations', 'cart', categoryIds.join(',')],
    queryFn: async () => {
      const params = new URLSearchParams();
      categoryIds.forEach((id) => params.append('category_ids[]', id));
      excludeProductIds.forEach((id) => params.append('exclude_ids[]', id));
      const res = await apiClient.get<CartRecommendationsResponse>(`/products/recommendations/cart?${params.toString()}`);
      return res.data;
    },
    // Only fetch when category IDs are available (Wave 5a will populate basket with categoryIds)
    enabled: categoryIds.length > 0,
    staleTime: 30 * 60 * 1000, // 30 min
  });

  if (isLoading) {
    return (
      <div className="mt-8">
        <Skeleton className="h-5 w-40 mb-4" />
        <div className="flex gap-3 overflow-x-auto pb-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="flex-shrink-0 w-40 h-52 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (!recommendations || recommendations.length === 0) return null;

  return (
    <div className="mt-8">
      <h2 className="text-base font-semibold text-grovio-text mb-4">You might also like</h2>
      <div className="flex gap-3 overflow-x-auto pb-2 scrollbar-hide">
        {recommendations.map((product) => (
          <div key={product.id} className="flex-shrink-0 w-40">
            <ProductCard
              slug={product.slug}
              name={product.name}
              priceMajor={formatPrice(product.basePriceMinor)}
              vendorName={product.vendorName}
              {...(product.imageUrl ? { imageUrl: product.imageUrl } : {})}
            />
          </div>
        ))}
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// CartPage
// ---------------------------------------------------------------------------

export default function CartPage() {
  const addToast = useUiStore((s) => s.addToast);

  const { basket, isLoading, isError } = useBasket();
  const updateItemMutation = useUpdateBasketItem();
  const removeItemMutation = useRemoveBasketItem();

  const isActing = updateItemMutation.isPending || removeItemMutation.isPending;

  function handleQuantityChange(itemId: string, newQuantity: number) {
    updateItemMutation.mutate(
      { itemId, quantity: newQuantity },
      {
        onError: () => {
          addToast({
            id: crypto.randomUUID(),
            message: 'Could not update quantity. Please try again.',
            variant: 'error',
          });
        },
      },
    );
  }

  function handleRemove(itemId: string) {
    removeItemMutation.mutate(itemId, {
      onSuccess: () => {
        addToast({ id: crypto.randomUUID(), message: 'Item removed from cart.', variant: 'info' });
      },
      onError: () => {
        addToast({ id: crypto.randomUUID(), message: 'Could not remove item. Please try again.', variant: 'error' });
      },
    });
  }

  function handleCouponApply(code: string) {
    addToast({ id: crypto.randomUUID(), message: `Coupon "${code}" will be applied at checkout.`, variant: 'info' });
  }

  // Derive product IDs from basket for recommendations
  // Note: categoryId is not in BasketItem — category context for recommendations
  // comes from vendorId as a proxy; recommendations endpoint accepts category_ids[]
  // which will be populated when basket API is extended in Wave 5a.
  // For now pass empty array so the recommendations query is enabled but returns nothing.
  const categoryIds: string[] = [];
  const productIds = basket?.items.map((i) => i.productId) ?? [];

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <h1 className="text-xl font-semibold text-grovio-text mb-8">Your Cart</h1>

        {/* ── Loading skeleton ────────────────────────────────────────────── */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading cart…" className="flex flex-col gap-4">
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} className="h-24 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* ── Error state ─────────────────────────────────────────────────── */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your cart. Please refresh and try again.
          </p>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && !isError && (!basket || basket.itemCount === 0) && (
          <div className="flex flex-col items-center justify-center py-20 gap-4 text-center">
            <div className="flex items-center justify-center w-16 h-16 rounded-full bg-grovio-surface border border-grovio-border">
              <ShoppingCart className="h-7 w-7 text-grovio-text-muted" aria-hidden="true" />
            </div>
            <p className="text-base font-semibold text-grovio-text">Your cart is empty</p>
            <p className="text-sm text-grovio-text-muted">Browse our products and add something you like.</p>
            <Link
              to="/search"
              className="inline-flex items-center gap-1 text-sm text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
            >
              Continue shopping
            </Link>
          </div>
        )}

        {/* ── Loaded: vendor-grouped items + order summary ─────────────────── */}
        {!isLoading && !isError && basket && basket.itemCount > 0 && (
          <>
            <div className="flex flex-col lg:flex-row gap-8">
              {/* Items column */}
              <div className="flex-1 min-w-0">
                {basket.groupedByVendor.map((vendorGroup) => (
                  <section
                    key={vendorGroup.vendorId}
                    aria-label={`Items from ${vendorGroup.vendorName}`}
                    className="mb-8"
                  >
                    {/* Vendor section header */}
                    <div className="flex items-center justify-between mb-3 pb-2 border-b border-grovio-border">
                      <div>
                        <h2 className="text-sm font-semibold text-grovio-text">{vendorGroup.vendorName}</h2>
                        <p className="text-xs text-grovio-text-muted mt-0.5">Estimated delivery: 3–5 business days</p>
                      </div>
                      <span className="text-sm font-semibold text-grovio-text tabular-nums">
                        {formatPrice(vendorGroup.vendorSubtotalMinor)}
                      </span>
                    </div>

                    {/* Item rows */}
                    <AnimatePresence initial={false}>
                      {vendorGroup.items.map((item) => (
                        <BasketItemRow
                          key={item.id}
                          item={item}
                          onQuantityChange={handleQuantityChange}
                          onRemove={handleRemove}
                          isUpdating={isActing}
                        />
                      ))}
                    </AnimatePresence>
                  </section>
                ))}

                {/* Cart recommendations */}
                <CartRecommendations
                  categoryIds={[...new Set(categoryIds)]}
                  excludeProductIds={productIds}
                />
              </div>

              {/* Order summary sidebar */}
              <div className="lg:w-80 xl:w-96 flex-shrink-0">
                <div className="lg:sticky lg:top-24 space-y-4">
                  {/* Coupon suggestions */}
                  <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4">
                    <CouponInputWithSuggestions
                      cartTotalMinor={basket.subtotalMinor}
                      categoryIds={[...new Set(categoryIds)]}
                      onApply={handleCouponApply}
                    />
                  </div>

                  <OrderSummary basket={basket} />
                </div>
              </div>
            </div>
          </>
        )}
      </div>
    </PageTransition>
  );
}
