import { motion } from 'motion/react';
import { Link } from 'react-router-dom';
import { useComparisonStore } from '../../stores/useComparisonStore.js';

interface ProductCardProps {
  slug: string;
  name: string;
  /** Price in minor units (paise/cents) — rendered as formatted string */
  priceMajor: string;
  vendorName: string;
  imageUrl?: string;
  /** Render in horizontal list view (image left, details right) */
  listView?: boolean;
  /** Show comparison checkbox (CategoryPage only) */
  showCompare?: boolean;
  /** Product id for comparison store */
  productId?: string;
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
}: ProductCardProps) {
  const { selectedProductIds, addProduct, removeProduct } = useComparisonStore();
  const isCompared = productId ? selectedProductIds.includes(productId) : false;
  const maxReached = selectedProductIds.length >= 3;
  const isDisabled = showCompare && maxReached && !isCompared;

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
          whileHover={{ y: isDisabled ? 0 : -4, boxShadow: isDisabled ? undefined : '0 8px 24px rgba(0,0,0,0.10)' }}
          transition={{ duration: 0.2 }}
        >
          {/* Product image */}
          <div className="aspect-[4/5] overflow-hidden rounded-t-lg bg-grovio-surface">
            {imageUrl ? (
              <img
                src={imageUrl}
                alt={name}
                className="w-full h-full object-cover"
                loading="lazy"
              />
            ) : (
              <div className="w-full h-full bg-grovio-border" aria-hidden="true" />
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
