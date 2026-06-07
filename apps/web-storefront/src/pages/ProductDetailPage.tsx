import { useState, useEffect, useCallback } from 'react';
import { useParams, Link } from 'react-router-dom';
import { useQuery, useMutation } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { ChevronLeft, ShieldCheck, RefreshCw, Package, ZoomIn, X, Camera, Mic } from 'lucide-react';
import { PageTransition } from '../components/layout/PageTransition.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { ReviewsSection } from '../components/pdp/ReviewsSection.js';
import { apiClient } from '../lib/api-client.js';
import { useAddToBasket } from '../hooks/useBasket.js';
import { useUiStore } from '../store/ui-store.js';
import { SeoHead } from '../components/seo/SeoHead.js';
import { ProductJsonLd, BreadcrumbJsonLd } from '../components/seo/JsonLd.js';
import type { Product, ProductImage, ProductVariant } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ProductDetailResponse {
  product: Product & {
    vendorName?: string | undefined;
    images?: ProductImage[] | undefined;
    variants?: ProductVariant[] | undefined;
    categoryAttributes?: CategoryAttributeInfo[] | undefined;
    returnPolicy?: string | undefined;
    soldCount?: number | undefined;
  };
}

interface CategoryAttributeInfo {
  key: string;
  label: string;
  displayType: string;
  isVariant: boolean;
  isFilterable: boolean;
}

interface ServiceabilityResponse {
  available: boolean;
  estimatedDays: number;
  message: string;
}

const PINCODE_KEY = 'grovio_delivery_pincode';

// ---------------------------------------------------------------------------
// Lightbox
// ---------------------------------------------------------------------------

interface LightboxProps {
  images: ProductImage[];
  initialIndex: number;
  onClose: () => void;
}

function Lightbox({ images, initialIndex, onClose }: LightboxProps) {
  const [current, setCurrent] = useState(initialIndex);

  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowRight') setCurrent((i) => Math.min(i + 1, images.length - 1));
      if (e.key === 'ArrowLeft') setCurrent((i) => Math.max(i - 1, 0));
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [images.length, onClose]);

  const img = images[current];

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Product image lightbox"
      onClick={onClose}
    >
      <button
        type="button"
        onClick={onClose}
        aria-label="Close lightbox"
        className="absolute top-4 right-4 p-2 rounded-full bg-white/10 text-white hover:bg-white/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
      >
        <X className="h-5 w-5" aria-hidden="true" />
      </button>

      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="max-w-3xl max-h-[90vh] relative"
        onClick={(e) => e.stopPropagation()}
      >
        {img && (
          <img
            src={img.url}
            alt={img.altText ?? 'Product image'}
            className="max-h-[85vh] max-w-full object-contain rounded-lg"
          />
        )}

        {images.length > 1 && (
          <div className="absolute inset-y-0 left-0 right-0 flex items-center justify-between pointer-events-none px-2">
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent((i) => Math.max(i - 1, 0)); }}
              disabled={current === 0}
              aria-label="Previous image"
              className="pointer-events-auto p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-5 w-5" aria-hidden="true" />
            </button>
            <button
              type="button"
              onClick={(e) => { e.stopPropagation(); setCurrent((i) => Math.min(i + 1, images.length - 1)); }}
              disabled={current === images.length - 1}
              aria-label="Next image"
              className="pointer-events-auto p-2 rounded-full bg-black/40 text-white hover:bg-black/60 transition-colors disabled:opacity-30 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white"
            >
              <ChevronLeft className="h-5 w-5 rotate-180" aria-hidden="true" />
            </button>
          </div>
        )}
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery estimation
// ---------------------------------------------------------------------------

interface DeliveryCheckProps {
  productSlug: string;
}

function DeliveryCheck({ productSlug: _productSlug }: DeliveryCheckProps) {
  const [pincode, setPincode] = useState(() => {
    try { return localStorage.getItem(PINCODE_KEY) ?? ''; } catch { return ''; }
  });
  const [submitted, setSubmitted] = useState(false);

  const { data, isLoading, mutate } = useMutation<ServiceabilityResponse, Error, string>({
    mutationFn: (pin: string) =>
      apiClient
        .get<{ success: boolean; data: ServiceabilityResponse }>(`/serviceability?pincode=${encodeURIComponent(pin)}`)
        .then((r) => r.data),
  });

  function handleCheck() {
    if (!pincode.trim()) return;
    try { localStorage.setItem(PINCODE_KEY, pincode.trim()); } catch { /* ignore */ }
    setSubmitted(true);
    mutate(pincode.trim());
  }

  return (
    <div className="mt-4 rounded-lg border border-grovio-border bg-grovio-surface p-4">
      <p className="text-sm font-medium text-grovio-text mb-2">Check Delivery</p>
      <div className="flex gap-2">
        <input
          type="text"
          inputMode="numeric"
          pattern="[0-9]*"
          maxLength={10}
          value={pincode}
          onChange={(e) => { setPincode(e.target.value); setSubmitted(false); }}
          placeholder="Enter pincode"
          aria-label="Delivery pincode"
          className="flex-1 h-9 px-3 rounded-md border border-grovio-border bg-grovio-surface-raised text-sm text-grovio-text focus:outline-none focus:ring-2 focus:ring-grovio-primary"
        />
        <button
          type="button"
          onClick={handleCheck}
          disabled={isLoading || !pincode.trim()}
          className="h-9 px-4 text-sm font-medium bg-grovio-primary text-white rounded-md hover:bg-grovio-primary-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
        >
          {isLoading ? 'Checking…' : 'Check'}
        </button>
      </div>

      {submitted && data && (
        <p className={`mt-2 text-sm ${data.available ? 'text-green-600' : 'text-grovio-error'}`}>
          {data.available
            ? `Delivery available — estimated ${data.estimatedDays} days`
            : 'Delivery not available to this pincode'}
        </p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Trust badges
// ---------------------------------------------------------------------------

function TrustBadges({
  returnPolicy,
  soldCount,
}: {
  returnPolicy?: string;
  soldCount?: number;
}) {
  return (
    <div className="flex flex-wrap gap-3 mt-4 text-xs text-grovio-text-muted">
      <span className="flex items-center gap-1">
        <ShieldCheck className="h-4 w-4 text-green-600 flex-shrink-0" aria-hidden="true" />
        Secure Checkout
      </span>
      {returnPolicy && (
        <span className="flex items-center gap-1">
          <RefreshCw className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {returnPolicy.length > 40 ? returnPolicy.slice(0, 40) + '…' : returnPolicy}
        </span>
      )}
      {soldCount !== undefined && soldCount > 0 && (
        <span className="flex items-center gap-1">
          <Package className="h-4 w-4 flex-shrink-0" aria-hidden="true" />
          {soldCount}+ Sold
        </span>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// FBT + Related stubs
// ---------------------------------------------------------------------------

function FrequentlyBoughtTogether() {
  return (
    <section aria-labelledby="fbt-heading" className="mt-10">
      <h2 id="fbt-heading" className="text-base font-semibold text-grovio-text mb-4">
        Frequently Bought Together
      </h2>
      <div className="rounded-lg border border-dashed border-grovio-border bg-grovio-surface p-6 text-center">
        <p className="text-sm text-grovio-text-muted">Product bundles coming soon (Wave 5b)</p>
      </div>
    </section>
  );
}

function RelatedProducts() {
  return (
    <section aria-labelledby="related-heading" className="mt-10">
      <h2 id="related-heading" className="text-base font-semibold text-grovio-text mb-4">
        You Might Also Like
      </h2>
      <div className="rounded-lg border border-dashed border-grovio-border bg-grovio-surface p-6 text-center">
        <p className="text-sm text-grovio-text-muted">Related products coming soon (Wave 5b)</p>
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

const formatPrice = (priceMinor: number) =>
  new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(priceMinor / 100);

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

// Guess if an attribute key is color-related
function isColorAttribute(key: string, label: string): boolean {
  const lower = (key + label).toLowerCase();
  return lower.includes('color') || lower.includes('colour');
}

// Guess if an attribute key is size-related
function isSizeAttribute(key: string, label: string): boolean {
  const lower = (key + label).toLowerCase();
  return lower.includes('size') || lower.includes('sz');
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function ProductDetailPage() {
  const { slug } = useParams<{ slug: string }>();
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedOptions, setSelectedOptions] = useState<Record<string, string>>({});
  const [lightboxOpen, setLightboxOpen] = useState(false);
  const addToBasket = useAddToBasket();
  const addToast = useUiStore((s) => s.addToast);

  const { data, isLoading, isError } = useQuery<ProductDetailResponse>({
    queryKey: ['product', slug],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: ProductDetailResponse }>(`/products/${slug ?? ''}`)
        .then((r) => r.data),
    enabled: !!slug,
    retry: (failureCount, error) => {
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

  // Keyboard navigation for gallery on desktop
  const handleGalleryKeyDown = useCallback((e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') setSelectedImage((i) => Math.min(i + 1, images.length - 1));
    if (e.key === 'ArrowLeft') setSelectedImage((i) => Math.max(i - 1, 0));
  }, [images.length]);

  const specEntries = categoryAttributes
    .filter((attr) => !attr.isVariant)
    .map((attr) => {
      const rawValue = product?.attributes?.[attr.key];
      return { key: attr.key, label: attr.label, value: formatAttributeValue(rawValue) };
    })
    .filter((entry) => entry.value !== null && entry.value !== '');

  const variantAttributeKeys = categoryAttributes
    .filter((attr) => attr.isVariant)
    .map((attr) => attr.key);

  const variantGroups: { key: string; label: string; options: string[]; isColor: boolean; isSize: boolean }[] =
    variantAttributeKeys.map((key) => {
      const attr = categoryAttributes.find((a) => a.key === key);
      const options = [...new Set(
        variants.map((v) => {
          const val = v.optionValues[key];
          return typeof val === 'string' ? val : String(val ?? '');
        }).filter(Boolean),
      )];
      return {
        key,
        label: attr?.label ?? key,
        options,
        isColor: isColorAttribute(key, attr?.label ?? ''),
        isSize: isSizeAttribute(key, attr?.label ?? ''),
      };
    });

  function resolveSelectedVariant(): ProductVariant | null {
    if (variantGroups.length === 0) return null;
    const allSelected = variantGroups.every((g) => selectedOptions[g.key] !== undefined);
    if (!allSelected) return null;
    return (
      variants.find((v) =>
        variantGroups.every((g) => {
          const val = v.optionValues[g.key];
          const strVal = typeof val === 'string' ? val : String(val ?? '');
          return strVal === selectedOptions[g.key];
        }),
      ) ?? null
    );
  }

  const selectedVariant = resolveSelectedVariant();
  const hasVariants = variantGroups.length > 0;
  const canAddToCart = !hasVariants || variantGroups.every((g) => selectedOptions[g.key] !== undefined);

  function handleAddToCartClick() {
    if (!product || !canAddToCart) return;
    addToBasket.mutate(
      { productId: product.id, productVariantId: selectedVariant?.id ?? null, quantity: 1 },
      {
        onSuccess: () => addToast({ id: crypto.randomUUID(), message: 'Added to cart', variant: 'success' }),
        onError: () => addToast({ id: crypto.randomUUID(), message: 'Could not add to cart. Please try again.', variant: 'error' }),
      },
    );
  }

  if (isLoading) {
    return (
      <PageTransition>
        <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8 lg:gap-12">
            <div className="space-y-3">
              <Skeleton className="aspect-square w-full rounded-xl" />
              <div className="flex gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-16 rounded-md" />
                ))}
              </div>
            </div>
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
  const seoDescription = product.description
    ? product.description.slice(0, 160)
    : `Buy ${product.name} online${product.vendorName ? ` from ${product.vendorName}` : ''}. Fast delivery, great prices.`;
  const productPriceMajor = (selectedVariant?.priceMinor ?? product.basePriceMinor) / 100;

  return (
    <PageTransition>
      <SeoHead
        title={`${product.name} | Grovio`}
        description={seoDescription}
        canonicalPath={`/products/${slug}`}
        ogImage={images[0]?.url}
        ogType="product"
      />
      <ProductJsonLd
        id={product.id}
        name={product.name}
        description={product.description ?? undefined}
        imageUrl={images[0]?.url}
        priceMajor={productPriceMajor}
        availability="InStock"
        brandName={product.vendorName ?? undefined}
        slug={slug ?? ''}
      />
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', path: '/' },
          { name: 'Search', path: '/search' },
          { name: product.name },
        ]}
      />
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
            {/* Desktop: main image with zoom affordance + keyboard nav */}
            <div
              className="hidden md:block"
              onKeyDown={handleGalleryKeyDown}
              tabIndex={0}
              aria-label="Product image gallery (use arrow keys to navigate)"
              role="group"
            >
              <div className="aspect-square w-full rounded-xl overflow-hidden bg-grovio-border mb-3 relative group cursor-zoom-in">
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

                {/* Zoom button overlay */}
                {mainImage && (
                  <button
                    type="button"
                    onClick={() => setLightboxOpen(true)}
                    aria-label="Open full screen image"
                    className="absolute top-3 right-3 p-2 rounded-full bg-white/80 text-grovio-text opacity-0 group-hover:opacity-100 transition-opacity duration-200 hover:bg-white focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary shadow"
                  >
                    <ZoomIn className="h-4 w-4" aria-hidden="true" />
                  </button>
                )}
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
                      <img src={img.url} alt={img.altText ?? `Product image ${index + 1}`} className="w-full h-full object-cover" loading="lazy" />
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Mobile: horizontal swipe carousel */}
            <div
              className="md:hidden"
              aria-label="Product images (swipe to navigate)"
            >
              <div className="flex overflow-x-scroll snap-x snap-mandatory gap-3 pb-2 rounded-xl scrollbar-hide">
                {images.length > 0 ? images.map((img, index) => (
                  <div
                    key={img.id}
                    className="flex-shrink-0 w-full aspect-square snap-center rounded-xl overflow-hidden bg-grovio-border"
                    onClick={() => { setSelectedImage(index); setLightboxOpen(true); }}
                    role="button"
                    tabIndex={0}
                    onKeyDown={(e) => { if (e.key === 'Enter') { setSelectedImage(index); setLightboxOpen(true); } }}
                    aria-label={`View image ${index + 1}`}
                  >
                    <img src={img.url} alt={img.altText ?? product.name} className="w-full h-full object-cover" loading={index === 0 ? 'eager' : 'lazy'} />
                  </div>
                )) : (
                  <div className="flex-shrink-0 w-full aspect-square snap-center rounded-xl overflow-hidden bg-grovio-border flex items-center justify-center">
                    <span className="text-grovio-text-muted text-sm">No image</span>
                  </div>
                )}
              </div>

              {/* Dots indicator for mobile */}
              {images.length > 1 && (
                <div className="flex justify-center gap-1.5 mt-2" aria-hidden="true">
                  {images.map((_, i) => (
                    <div
                      key={i}
                      className={`h-1.5 rounded-full transition-all duration-200 ${i === selectedImage ? 'w-4 bg-grovio-primary' : 'w-1.5 bg-grovio-border'}`}
                    />
                  ))}
                </div>
              )}
            </div>
          </section>

          {/* ── Product content ── */}
          <section aria-label="Product details">
            <h1 className="text-xl font-semibold text-grovio-text mb-2">{product.name}</h1>

            <p className="text-xl font-semibold text-grovio-primary mb-1">
              {formatPrice(product.basePriceMinor)}
            </p>

            {product.vendorName && (
              <p className="text-sm text-grovio-secondary mb-4">{product.vendorName}</p>
            )}

            {product.description && (
              <p className="text-sm text-grovio-text leading-relaxed mb-6">{product.description}</p>
            )}

            {/* ── Variant swatches (replaces dropdowns) ── */}
            {variantGroups.map((group) => (
              <div key={group.key} className="mb-6">
                <p className="text-sm font-semibold text-grovio-text mb-2">
                  Select {group.label}
                  {selectedOptions[group.key] && (
                    <span className="ml-2 font-normal text-grovio-text-muted">
                      {selectedOptions[group.key]}
                    </span>
                  )}
                </p>

                {group.isColor ? (
                  /* Color circles */
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Select ${group.label}`}>
                    {group.options.map((option) => {
                      const isSelected = selectedOptions[group.key] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${group.label}: ${option}`}
                          onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.key]: option }))}
                          className={`w-8 h-8 rounded-full border-2 transition-all duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'ring-2 ring-grovio-primary ring-offset-2 border-transparent'
                              : 'border-grovio-border'
                          }`}
                          style={{ backgroundColor: option }}
                          title={option}
                        />
                      );
                    })}
                  </div>
                ) : group.isSize ? (
                  /* Size chips */
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Select ${group.label}`}>
                    {group.options.map((option) => {
                      const isSelected = selectedOptions[group.key] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${group.label}: ${option}`}
                          onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.key]: option }))}
                          className={`inline-flex items-center justify-center min-w-[2.5rem] h-9 rounded-md border px-3 text-sm font-medium transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-grovio-primary bg-grovio-primary text-white'
                              : 'border-grovio-border text-grovio-text hover:border-grovio-primary/50'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                ) : (
                  /* Other attributes — pill buttons (existing behavior) */
                  <div className="flex flex-wrap gap-2" role="group" aria-label={`Select ${group.label}`}>
                    {group.options.map((option) => {
                      const isSelected = selectedOptions[group.key] === option;
                      return (
                        <button
                          key={option}
                          type="button"
                          aria-pressed={isSelected}
                          aria-label={`${group.label}: ${option}`}
                          onClick={() => setSelectedOptions((prev) => ({ ...prev, [group.key]: option }))}
                          className={`inline-flex items-center rounded-full border px-4 py-2 text-sm transition-colors duration-150 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 ${
                            isSelected
                              ? 'border-grovio-primary text-grovio-primary bg-grovio-primary/5'
                              : 'border-grovio-border text-grovio-text hover:border-grovio-primary/50'
                          }`}
                        >
                          {option}
                        </button>
                      );
                    })}
                  </div>
                )}
              </div>
            ))}

            {hasVariants && !canAddToCart && (
              <p className="text-xs text-grovio-text-muted mb-3" role="status">
                Please select{' '}
                {variantGroups
                  .filter((g) => selectedOptions[g.key] === undefined)
                  .map((g) => g.label)
                  .join(' and ')}{' '}
                to continue.
              </p>
            )}

            {/* Add to Cart */}
            <div className="mb-4">
              <motion.button
                type="button"
                disabled={!canAddToCart || addToBasket.isPending}
                onClick={handleAddToCartClick}
                {...(canAddToCart ? { whileTap: { scale: 0.97 } } : {})}
                aria-label="Add to Cart"
                className={`w-full md:w-auto bg-grovio-primary text-white font-semibold text-base px-8 py-3 rounded-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 transition-opacity duration-150 ${
                  !canAddToCart || addToBasket.isPending
                    ? 'opacity-60 cursor-not-allowed'
                    : 'hover:bg-grovio-primary-hover'
                }`}
              >
                {addToBasket.isPending ? 'Adding…' : 'Add to Cart'}
              </motion.button>
            </div>

            {/* Trust badges */}
            <TrustBadges returnPolicy={product.returnPolicy} soldCount={product.soldCount} />

            {/* Delivery estimation */}
            <DeliveryCheck productSlug={slug ?? ''} />

            {/* Non-functional camera / voice icons */}
            <div className="flex items-center gap-3 mt-3">
              <button
                type="button"
                onClick={() => addToast({ id: crypto.randomUUID(), message: 'Image search coming soon.', variant: 'info' })}
                aria-label="Search by image"
                className="inline-flex items-center gap-1 text-xs text-grovio-text-muted hover:text-grovio-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
              >
                <Camera className="h-4 w-4" aria-hidden="true" />
                Image search
              </button>
              <button
                type="button"
                onClick={() => addToast({ id: crypto.randomUUID(), message: 'Voice search coming soon.', variant: 'info' })}
                aria-label="Search by voice"
                className="inline-flex items-center gap-1 text-xs text-grovio-text-muted hover:text-grovio-text transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded"
              >
                <Mic className="h-4 w-4" aria-hidden="true" />
                Voice search
              </button>
            </div>

            {/* Specifications table */}
            {specEntries.length > 0 && (
              <section aria-label="Product specifications" className="mt-8">
                <h2 className="text-base font-semibold text-grovio-text mb-3">Specifications</h2>
                <table className="w-full text-sm">
                  <tbody>
                    {specEntries.map((entry, i) => (
                      <tr key={entry.key} className={i < specEntries.length - 1 ? 'border-b border-grovio-border' : ''}>
                        <td className="py-2 pr-4 text-grovio-text-muted font-medium w-1/3 align-top">{entry.label}</td>
                        <td className="py-2 text-grovio-text w-2/3 align-top">{entry.value}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </section>
            )}
          </section>
        </div>

        {/* Reviews section */}
        <ReviewsSection productId={product.id} />

        {/* FBT + Related stubs */}
        <FrequentlyBoughtTogether />
        <RelatedProducts />
      </div>

      {/* Lightbox */}
      <AnimatePresence>
        {lightboxOpen && (
          <Lightbox
            key="lightbox"
            images={images}
            initialIndex={selectedImage}
            onClose={() => setLightboxOpen(false)}
          />
        )}
      </AnimatePresence>
    </PageTransition>
  );
}
