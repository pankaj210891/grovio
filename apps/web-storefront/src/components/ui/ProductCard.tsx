import { motion } from 'motion/react';
import { Link } from 'react-router-dom';

interface ProductCardProps {
  slug: string;
  name: string;
  /** Price in minor units (paise/cents) — rendered as formatted string */
  priceMajor: string;
  vendorName: string;
  imageUrl?: string;
}

/**
 * PLP / homepage product card.
 *
 * Design tokens (no hardcoded hex):
 *   bg-grovio-surface-raised, border-grovio-border
 *   text-grovio-primary (price), text-grovio-text-muted (vendor)
 *
 * Animation:
 *   whileHover: y -4px + shadow increase (UI-SPEC Animation Contract)
 *
 * Links to /products/:slug — no add-to-cart in Phase 4 (commerce is Phase 5).
 */
export function ProductCard({
  slug,
  name,
  priceMajor,
  vendorName,
  imageUrl,
}: ProductCardProps) {
  return (
    <Link to={`/products/${slug}`} className="block focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded-lg">
      <motion.div
        className="bg-grovio-surface-raised rounded-lg border border-grovio-border overflow-hidden h-full"
        whileHover={{ y: -4, boxShadow: '0 8px 24px rgba(0,0,0,0.10)' }}
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
  );
}
