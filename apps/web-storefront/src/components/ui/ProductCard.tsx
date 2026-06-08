import { motion } from 'motion/react';
import { Link, useNavigate } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { useComparisonStore } from '../../stores/useComparisonStore.js';
import { useWishlistToggle } from '../../hooks/useWishlist.js';
import { useAuth } from '../../hooks/useAuth.js';

interface ProductCardProps {
  slug: string;
  name: string;
  /** Price in minor units (paise/cents) — rendered as formatted string */
  priceMajor: string;
  vendorName: string;
  imageUrl?: string | undefined;
  /** Render in horizontal list view (image left, details right) */
  listView?: boolean;
  /** Show comparison checkbox (CategoryPage only) */
  showCompare?: boolean;
  /** Product id for comparison store */
  productId?: string;
  /** Whether this product is currently wishlisted */
  isWishlisted?: boolean;
  /** Show heart/wishlist toggle */
  showWishlist?: boolean;
  /** Price-drop badge — shown when product has a lower price than when wishlisted */
  isPriceDropped?: boolean;
}

/**
 * PLP / homepage product card.
 *
 * Supports:
 * - Grid view (default): image-dominant vertical card
 * - List view: horizontal card with image left + details right
 * - Comparison checkbox: shown when showCompare=true (CategoryPage only)
 *
 * Design tokens (no hardcoded hex):
 *   bg-grovio-surface-raised, border-grovio-border
 *   text-grovio-primary (price), text-grovio-text-muted (vendor)
 *
 * Animation:
 *   whileHover: y -4px + shadow increase (UI-SPEC Animation Contract)
 */
export function ProductCard({
  slug,
  name,
  priceMajor,
  vendorName,
  imageUrl,
  listView = false,
  showCompare = false,
  productId,
  isWishlisted = false,
  showWishlist = false,
  isPriceDropped = false,
}: ProductCardProps) {
  const { selectedProductIds, addProduct, removeProduct } = useComparisonStore();
  const isCompared = productId ? selectedProductIds.includes(productId) : false;
  const maxReached = selectedProductIds.length >= 3;
  const isDisabled = showCompare && maxReached && !isCompared;
  const { isAuthenticated } = useAuth();
  const navigate = useNavigate();
  const wishlistToggle = useWishlistToggle();

  function handleCompareToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    if (isCompared) {
      removeProduct(productId);
    } else if (!maxReached) {
      addProduct(productId);
    }
  }

  function handleWishlistToggle(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    if (!productId) return;
    if (!isAuthenticated) {
      void navigate('/auth/login');
      return;
    }
    wishlistToggle.mutate({ productId, isWishlisted });
  }

  if (listView) {
    return (
      <Link
        to={`/products/${slug}`}
        className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded-lg"
      >
        <motion.div
          className={`flex gap-4 bg-grovio-surface-raised rounded-lg border border-grovio-border overflow-hidden p-3 transition-opacity ${isDisabled ? 'opacity-50' : ''}`}
          whileHover={{ boxShadow: '0 4px 16px rgba(0,0,0,0.08)' }}
          transition={{ duration: 0.2 }}
        >
          {/* Image */}
          <div className="w-28 h-28 flex-shrink-0 rounded-md overflow-hidden bg-grovio-surface">
            {imageUrl ? (
              <img src={imageUrl} alt={name} className="w-full h-full object-cover" loading="lazy" />
            ) : (
              <div className="w-full h-full bg-grovio-border" aria-hidden="true" />
            )}
          </div>

          {/* Details */}
          <div className="flex flex-col justify-center gap-1 flex-1 min-w-0">
            <p className="text-base font-semibold text-grovio-text line-clamp-2">{name}</p>
            <p className="text-base font-semibold text-grovio-primary">{priceMajor}</p>
            {vendorName && <p className="text-sm text-grovio-text-muted">{vendorName}</p>}
          </div>

          {/* Compare checkbox */}
          {showCompare && productId && (
            <div className="flex-shrink-0 flex items-center">
              <input
                type="checkbox"
                checked={isCompared}
                disabled={isDisabled}
                onClick={handleCompareToggle}
                onChange={() => { /* controlled via onClick */ }}
                aria-label={`Compare ${name}`}
                className="h-4 w-4 accent-grovio-primary cursor-pointer disabled:cursor-not-allowed"
              />
            </div>
          )}
        </motion.div>
      </Link>
    );
  }

  return (
    <div className="relative block">
      <Link to={`/products/${slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded-lg">
        <motion.div
          className={`bg-grovio-surface-raised rounded-lg border border-grovio-border overflow-hidden h-full transition-opacity ${isDisabled ? 'opacity-50' : ''}`}
          whileHover={{ y: isDisabled ? 0 : -4, ...(isDisabled ? {} : { boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }) }}
          transition={{ duration: 0.2 }}
        >
          {/* Product image */}
          <div className="aspect-[4/5] overflow-hidden rounded-t-lg bg-grovio-surface relative">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
                loading="lazy"
                width={300}
                height={375}
              />
            ) : (
              <div className="w-full h-full bg-grovio-border" aria-hidden="true" />
            )}
            {/* Price-drop badge */}
            {isPriceDropped && (
              <span className="absolute top-2 left-2 bg-grovio-primary text-white text-[10px] font-bold px-1.5 py-0.5 rounded">
                Price Dropped!
              </span>
            )}
          </div>

          {/* Card content */}
          <div className="p-4 flex flex-col gap-1">
            <p className="text-base font-semibold text-grovio-text line-clamp-2">{name}</p>
            <p className="text-base font-semibold text-grovio-primary">{priceMajor}</p>
            <p className="text-sm text-grovio-text-muted">{vendorName}</p>
          </div>
        </motion.div>
      </Link>

      {/* Wishlist heart button — top-right corner */}
      {showWishlist && productId && (
        <button
          type="button"
          onClick={handleWishlistToggle}
          aria-label={isWishlisted ? `Remove ${name} from wishlist` : `Add ${name} to wishlist`}
          aria-pressed={isWishlisted}
          disabled={wishlistToggle.isPending}
          className="absolute top-2 right-2 z-10 flex h-8 w-8 items-center justify-center rounded-full bg-white/90 shadow-sm transition-colors hover:bg-white disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-1"
        >
          <Heart
            className={`h-4 w-4 transition-colors ${isWishlisted ? 'fill-grovio-error text-grovio-error' : 'text-grovio-text-muted'}`}
            aria-hidden="true"
          />
        </button>
      )}

      {/* Compare checkbox — bottom-left corner */}
      {showCompare && productId && (
        <div className="absolute bottom-3 left-3 z-10">
          <input
            type="checkbox"
            checked={isCompared}
            disabled={isDisabled}
            onClick={handleCompareToggle}
            onChange={() => { /* controlled via onClick */ }}
            aria-label={`Compare ${name}`}
            className="h-4 w-4 accent-grovio-primary cursor-pointer disabled:cursor-not-allowed bg-white border border-grovio-border rounded"
          />
        </div>
      )}
    </div>
  );
}
