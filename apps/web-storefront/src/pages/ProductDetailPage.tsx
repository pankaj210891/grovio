import { useState, useRef } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { apiClient } from '../lib/api-client.js';
import type { Product, ProductImage, ProductVariant } from '@grovio/contracts';

/**
 * Full product detail response from GET /products/:slug.
 * Phase 3 forward contract — the API will provide images and variants.
 */
interface ProductDetailResponse {
  product: Product & {
    vendorName?: string | undefined;
    images?: ProductImage[] | undefined;
    variants?: ProductVariant[] | undefined;
    categoryAttributes?: CategoryAttributeInfo[] | undefined;
  };
}

interface CategoryAttributeInfo {
  key: string;
  label: string;
  displayType: string;
  isVariant: boolean;
  isFilterable: boolean;
}

/**
 * Product Detail Page (/products/:slug).
 *
 * STORE-04 — PDP with dynamic category-specific attribute display.
 *
 * Loading: gallery + content skeletons
 * Loaded:
 *   - Image gallery (thumbnails aspect-square)
 *   - Product name <h1>
 *   - Price (major format)
 *   - Vendor name (text-grovio-secondary)
 *   - Specifications table (D-14): skip null/empty + is_variant=true attributes
 *   - Disabled variant selectors (D-15): pill buttons, opacity-60, first option selected
 *   - Disabled Add to Cart button (D-13): data-phase="5", shake animation on click
 * Not found: "Product not found" + "Back to search" link
 */
export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [shaking, setShaking] = useState(false);
  const buttonRef = useRef<HTMLButtonElement>(null);

  const { data, isLoading, isError } = useQuery<ProductDetailResponse>({
    queryKey: ['product', slug],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: ProductDetailResponse }>(`/products/${slug ?? ''}`)
        .then((r) => r.data),
    enabled: !!slug,
    retry: (failureCount, error) => {
      // Don't retry 404s
      if (error && typeof error === 'object' && 'status' in error && (error as { status: number }).status === 404) {
        return false;
      }
      return failureCount < 2;
    },
  });

  const product = data?.product;
  const images = product?.images ?? [];
  const variants = product?.variants ?? [];
  const categoryAttributes = product?.categoryAttributes ?? [];

  const formatPrice = (priceMinor: number) =>
    new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(priceMinor / 100);

  // Build spec table entries (D-14)
  // Skip: value is null/empty string, or attribute is is_variant=true
  const specEntries = categoryAttributes
    .filter((attr) => !attr.isVariant)
    .map((attr) => {
      const rawValue = product?.attributes?.[attr.key];
      return {
        key: attr.key,
        label: attr.label,
        value: formatAttributeValue(rawValue),
      };
    })
    .filter((entry) => entry.value !== null && entry.value !== '');

  // Build variant selector groups (D-15) — group by attribute key
  const variantAttributeKeys = categoryAttributes
    .filter((attr) => attr.isVariant)
    .map((attr) => attr.key);

  const variantGroups: { key: string; label: string; options: string[] }[] = variantAttributeKeys.map((key) => {
    const attr = categoryAttributes.find((a) => a.key === key);
    const options = [...new Set(
      variants.map((v) => {
        const val = v.optionValues[key];
        return typeof val === 'string' ? val : String(val ?? '');
      }).filter(Boolean),
    )];
    return { key, label: attr?.label ?? key, options };
  });

  // Add to Cart shake handler (D-13)
  const handleAddToCartClick = () => {
    if (!shaking) {
      setShaking(true);
      setTimeout(() => setShaking(false), 450);
    }
  };

  if (isLoading) {
    return (
      <PageTransition>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            {/* Gallery skeleton */}
            <div className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-16 rounded-md" />
                ))}
              </div>
            </div>
            {/* Content skeleton */}
            <div className="space-y-4">
              <Skeleton className="h-7 w-2/3" />
              <Skeleton className="h-6 w-1/3" />
              <Skeleton className="h-4 w-1/4" />
              <Skeleton className="h-32 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          </div>
        </div>
      </PageTransition>
    );
  }

  // Product not found
  if (isError || (!isLoading && !product)) {
    return (
      <PageTransition>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center space-y-4">
          <h1 className="text-xl font-semibold text-grovio-text">Product not found</h1>
          <p className="text-sm text-grovio-text-muted">
            This product may have been removed or the link may be incorrect.
          </p>
          <Link
            to="/search"
            className="inline-flex items-center gap-1 text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
          >
            <ChevronLeft className="h-4 w-4" aria-hidden="true" />
            Back to search
          </Link>
        </div>
      </PageTransition>
    );
  }

  if (!product) return null;

  const mainImage = images[selectedImage] ?? null;

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        {/* Back link */}
        <Link
          to="/search"
          className="inline-flex items-center gap-1 text-sm text-grovio-text-muted hover:text-grovio-primary mb-6 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
          Back to results
        </Link>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
          {/* ── Image gallery ── */}
          <section aria-label="Product images">
            {/* Main image */}
            <div className="aspect-square w-full rounded-xl overflow-hidden bg-grovio-border mb-3">
              <AnimatePresence mode="wait">
                <motion.div
                  key={selectedImage}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  className="w-full h-full"
                >
                  {mainImage ? (
                    <img
                      src={mainImage.url}
                      alt={mainImage.altText ?? product.name}
                      className="w-full h-full object-cover"
                      loading="eager"
                    />
                  ) : (
                    <div className="w-full h-full bg-grovio-border flex items-center justify-center">
                      <span className="text-grovio-text-muted text-sm">No image</span>
                    </div>
                  )}
                </motion.div>
              </AnimatePresence>
            </div>

            {/* Thumbnail row */}
            {images.length > 1 && (
              <div className="flex gap-2 overflow-x-auto pb-1" role="list" aria-label="Product image thumbnails">
                {images.map((img, index) => (
                  <button
                    key={img.id}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    aria-label={`View image ${index + 1}`}
                    aria-pressed={index === selectedImage}
                    className={`flex-shrink-0 aspect-square w-16 rounded-md overflow-hidden border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 ${
                      index === selectedImage
                        ? 'border-grovio-primary'
                        : 'border-grovio-border hover:border-grovio-primary/50'
                    }`}
                  >
                    <img
                      src={img.url}
                      alt={img.altText ?? `Product image ${index + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  </button>
                ))}
              </div>
            )}
          </section>

          {/* ── Product content ── */}
          <section aria-label="Product details">
            {/* Product name — single h1 */}
            <h1 className="text-xl font-semibold text-grovio-text mb-2">
              {product.name}
            </h1>

            {/* Price */}
            <p className="text-xl font-semibold text-grovio-primary mb-1">
              {formatPrice(product.basePriceMinor)}
            </p>

            {/* Vendor name */}
            {product.vendorName && (
              <p className="text-sm text-grovio-secondary mb-4">
                {product.vendorName}
              </p>
            )}

            {/* Product description */}
            {product.description && (
              <p className="text-sm text-grovio-text leading-relaxed mb-6">
                {product.description}
              </p>
            )}

            {/* ── Disabled variant selectors (D-15) ── */}
            {variantGroups.map((group) => (
              <div key={group.key} className="mb-6">
                <p className="text-sm font-semibold text-grovio-text mb-2">
                  Select {group.label}
                </p>
                <div className="flex flex-wrap gap-2">
                  {group.options.map((option, optIndex) => (
                    <span
                      key={option}
                      aria-label={`${group.label}: ${option}${optIndex === 0 ? ' (selected)' : ''}`}
                      className={`inline-flex items-center rounded-full border px-4 py-2 text-sm opacity-60 cursor-not-allowed pointer-events-none ${
                        optIndex === 0
                          ? 'border-grovio-primary text-grovio-primary'
                          : 'border-grovio-border text-grovio-text'
                      }`}
                    >
                      {option}
                    </span>
                  ))}
                </div>
              </div>
            ))}

            {/* ── Disabled Add to Cart button (D-13) ── */}
            <div className="mb-8">
              <motion.button
                ref={buttonRef}
                type="button"
                disabled
                data-phase="5"
                onClick={handleAddToCartClick}
                animate={shaking ? { x: [0, -6, 6, -4, 4, -2, 2, 0] } : { x: 0 }}
                transition={shaking ? { duration: 0.4 } : { duration: 0 }}
                aria-label="Add to Cart (available in a future update)"
                className="w-full md:w-auto bg-grovio-primary text-white font-semibold text-base px-8 py-3 rounded-md opacity-60 cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
              >
                Add to Cart
              </motion.button>
            </div>

            {/* ── Specifications table (D-14) ── */}
            {specEntries.length > 0 && (
              <section aria-label="Product specifications">
                <h2 className="text-base font-semibold text-grovio-text mb-3">
                  Specifications
                </h2>
                <table className="w-full text-sm">
                  <tbody>
                    {specEntries.map((entry, i) => (
                      <tr
                        key={entry.key}
                        className={i < specEntries.length - 1 ? 'border-b border-grovio-border' : ''}
                      >
                        <td className="py-2 pr-4 text-grovio-text-muted font-medium w-1/3 align-top">
                          {entry.label}
                        </td>
                        <td className="py-2 text-grovio-text w-2/3 align-top">
                          {entry.value}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </section>
        </div>
      </div>
    </PageTransition>
  );
}

/**
 * Format a raw attribute value for display in the spec table.
 * Returns null/empty string if the value should be skipped (D-14).
 */
function formatAttributeValue(value: unknown): string | null {
  if (value === null || value === undefined) return null;
  if (typeof value === 'boolean') return value ? 'Yes' : 'No';
  if (typeof value === 'number') return String(value);
  if (typeof value === 'string') return value.trim() || null;
  if (Array.isArray(value)) {
    const joined = value.filter(Boolean).join(', ');
    return joined || null;
  }
  return String(value);
}
