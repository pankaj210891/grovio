import { useEffect } from 'react';
import { useQuery, useMutation } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { PageTransition } from '../components/layout/PageTransition.js';
import { BlockRenderer } from '../components/blocks/BlockRenderer.js';
import { ProductCard } from '../components/ui/ProductCard.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { apiClient } from '../lib/api-client.js';
import { useAuth } from '../hooks/useAuth.js';
import { SeoHead } from '../components/seo/SeoHead.js';
import type { MerchandisingBlock } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface HomepageResponse {
  blocks: MerchandisingBlock[];
}

interface PersonalizedProduct {
  id: string;
  slug: string;
  name: string;
  priceMajor: string;
  imageUrl: string | null;
  vendorName: string;
}

interface PersonalizedHomepageResponse {
  recentlyViewed: PersonalizedProduct[];
  continueShoppingCategory: { name: string; slug: string; thumbnails: string[] } | null;
  recommendations: PersonalizedProduct[];
}

interface TrendingProduct {
  id: string;
  slug: string;
  name: string;
  priceMajor: string;
  imageUrl: string | null;
  vendorName: string;
}

// ---------------------------------------------------------------------------
// View tracking
// ---------------------------------------------------------------------------

const RECENTLY_VIEWED_KEY = 'grovio_recently_viewed';
const MAX_RECENT = 20;

export function trackProductView(productId: string): void {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    const ids: string[] = stored ? (JSON.parse(stored) as string[]) : [];
    const filtered = ids.filter((id) => id !== productId);
    const updated = [productId, ...filtered].slice(0, MAX_RECENT);
    localStorage.setItem(RECENTLY_VIEWED_KEY, JSON.stringify(updated));
  } catch {
    // ignore
  }
}

export function getLocalRecentlyViewed(): string[] {
  try {
    const stored = localStorage.getItem(RECENTLY_VIEWED_KEY);
    return stored ? (JSON.parse(stored) as string[]) : [];
  } catch {
    return [];
  }
}

// ---------------------------------------------------------------------------
// Personalized sections (authenticated only)
// ---------------------------------------------------------------------------

function PersonalizedSections() {
  const { data, isLoading } = useQuery<PersonalizedHomepageResponse>({
    queryKey: ['homepage', 'personalized'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: PersonalizedHomepageResponse }>('/homepage/personalized')
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <div className="space-y-10">
        {/* Recently Viewed skeleton */}
        <section aria-label="Loading recently viewed products">
          <Skeleton className="h-5 w-40 mb-4" />
          <div className="flex gap-4 overflow-hidden">
            {Array.from({ length: 5 }).map((_, i) => (
              <Skeleton key={i} className="flex-shrink-0 w-36 aspect-[4/5] rounded-lg" />
            ))}
          </div>
        </section>
        {/* Recommendations skeleton */}
        <section aria-label="Loading recommendations">
          <Skeleton className="h-5 w-48 mb-4" />
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
            ))}
          </div>
        </section>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className="space-y-12">
      {/* Recently Viewed — horizontal carousel */}
      {data.recentlyViewed.length > 0 && (
        <section aria-labelledby="recently-viewed-heading">
          <h2 id="recently-viewed-heading" className="text-base font-semibold text-grovio-text mb-4">
            Recently Viewed
          </h2>
          <div
            className="flex gap-4 overflow-x-auto pb-3 snap-x snap-mandatory scrollbar-hide"
            role="list"
          >
            {data.recentlyViewed.map((product) => (
              <div
                key={product.id}
                className="flex-shrink-0 w-40 snap-start"
                role="listitem"
              >
                <ProductCard
                  productId={product.id}
                  slug={product.slug}
                  name={product.name}
                  priceMajor={product.priceMajor}
                  vendorName={product.vendorName}
                  imageUrl={product.imageUrl ?? undefined}
                  showWishlist
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Continue Shopping */}
      {data.continueShoppingCategory && (
        <section aria-labelledby="continue-shopping-heading">
          <h2 id="continue-shopping-heading" className="text-base font-semibold text-grovio-text mb-4">
            Continue Shopping
          </h2>
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5 flex items-center gap-5">
            {data.continueShoppingCategory.thumbnails.length > 0 && (
              <div className="flex -space-x-2">
                {data.continueShoppingCategory.thumbnails.slice(0, 3).map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    aria-hidden="true"
                    className="h-14 w-14 rounded-lg border-2 border-white object-cover"
                    loading="lazy"
                    width={56}
                    height={56}
                  />
                ))}
              </div>
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-grovio-text mb-2">
                {data.continueShoppingCategory.name}
              </p>
              <Link
                to={`/category/${data.continueShoppingCategory.slug}`}
                className="inline-flex items-center gap-1 text-sm font-semibold text-white bg-grovio-primary px-4 py-1.5 rounded-md hover:bg-grovio-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
              >
                Browse {data.continueShoppingCategory.name}
              </Link>
            </div>
          </div>
        </section>
      )}

      {/* Personalized Recommendations */}
      {data.recommendations.length > 0 && (
        <section aria-labelledby="recommendations-heading">
          <h2 id="recommendations-heading" className="text-base font-semibold text-grovio-text mb-4">
            Picked for you
          </h2>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
            {data.recommendations.map((product) => (
              <ProductCard
                key={product.id}
                productId={product.id}
                slug={product.slug}
                name={product.name}
                priceMajor={product.priceMajor}
                vendorName={product.vendorName}
                imageUrl={product.imageUrl ?? undefined}
                showWishlist
              />
            ))}
          </div>
        </section>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Guest trending section
// ---------------------------------------------------------------------------

function TrendingSection() {
  const { data, isLoading } = useQuery<TrendingProduct[]>({
    queryKey: ['products', 'trending'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: TrendingProduct[] }>('/products/trending')
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000,
  });

  if (isLoading) {
    return (
      <section aria-label="Loading trending products">
        <Skeleton className="h-5 w-32 mb-4" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
          ))}
        </div>
      </section>
    );
  }

  if (!data || data.length === 0) return null;

  return (
    <section aria-labelledby="trending-heading">
      <h2 id="trending-heading" className="text-base font-semibold text-grovio-text mb-4">
        Trending Now
      </h2>
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {data.map((product) => (
          <ProductCard
            key={product.id}
            productId={product.id}
            slug={product.slug}
            name={product.name}
            priceMajor={product.priceMajor}
            vendorName={product.vendorName}
            imageUrl={product.imageUrl ?? undefined}
          />
        ))}
      </div>
    </section>
  );
}

// ---------------------------------------------------------------------------
// Announcement banner
// ---------------------------------------------------------------------------

function AnnouncementBanner() {
  const { data: announcements } = useQuery<{ id: string; message: string; type: string }[]>({
    queryKey: ['announcements', 'customer'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: { id: string; message: string; type: string }[] }>(
          '/announcements/active?target=customer',
        )
        .then((r) => r.data),
    staleTime: 10 * 60 * 1000,
  });

  if (!announcements || announcements.length === 0) return null;

  const announcement = announcements[0];
  if (!announcement) return null;

  return (
    <div
      role="banner"
      aria-label="Announcement"
      className="w-full bg-grovio-primary/10 border-b border-grovio-primary/20 px-4 py-2 text-center"
    >
      <p className="text-sm text-grovio-primary font-medium">{announcement.message}</p>
    </div>
  );
}

// ---------------------------------------------------------------------------
// View sync for authenticated users
// ---------------------------------------------------------------------------

function ViewSyncEffect() {
  const { isAuthenticated } = useAuth();
  const syncMutation = useMutation({
    mutationFn: (productIds: string[]) =>
      apiClient.post('/products/batch-view', { productIds }),
  });

  useEffect(() => {
    if (!isAuthenticated) return;
    const ids = getLocalRecentlyViewed();
    if (ids.length === 0) return;
    syncMutation.mutate(ids);
    // Clear local storage after sync
    try {
      localStorage.removeItem(RECENTLY_VIEWED_KEY);
    } catch {
      // ignore
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAuthenticated]);

  return null;
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Homepage — renders the configurable CMS block stack from GET /homepage,
 * plus personalized sections for authenticated users.
 *
 * D-01: Blocks are rendered in API order (sort_order). No hardcoded per-type
 * positioning exists — the order is fully data-driven.
 * D-03: Authenticated users see Recently Viewed, Continue Shopping, Recommendations.
 * D-04: Guest users see only trending products section.
 */
export default function HomePage() {
  const { isAuthenticated } = useAuth();

  const { data, isLoading, isError, refetch } = useQuery<HomepageResponse>({
    queryKey: ['homepage'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: HomepageResponse }>('/homepage')
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  return (
    <PageTransition>
      <SeoHead
        title="Grovio — Online Marketplace"
        description="Shop a wide range of products from multiple vendors. Fast delivery, great prices."
        canonicalPath="/"
      />
      {/* Visually-hidden page title for screen readers / a11y — single h1 */}
      <h1 className="sr-only">Grovio — Online Marketplace</h1>

      {/* Sync local recently-viewed on login */}
      <ViewSyncEffect />

      {/* Announcement banner */}
      <AnnouncementBanner />

      <div className="w-full">
        {isLoading && (
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-6 space-y-8">
            {/* Banner skeleton */}
            <Skeleton className="w-full aspect-[16/7] sm:aspect-[21/7]" />
            {/* Product row skeleton */}
            <div>
              <Skeleton className="h-6 w-48 mb-4" />
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-[4/5] w-full" />
                ))}
              </div>
            </div>
            {/* Category row skeleton */}
            <div>
              <Skeleton className="h-6 w-40 mb-4" />
              <div className="grid grid-cols-4 gap-4">
                {Array.from({ length: 4 }).map((_, i) => (
                  <Skeleton key={i} className="aspect-square w-full rounded-lg" />
                ))}
              </div>
            </div>
          </div>
        )}

        {isError && (
          <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-24 text-center">
            <p className="text-grovio-text mb-4">
              Something went wrong loading the homepage. Please try again.
            </p>
            <Button variant="primary" onClick={() => void refetch()}>
              Retry
            </Button>
          </div>
        )}

        {!isLoading && !isError && data && (
          <div className="space-y-12 pb-16">
            {/* CMS blocks */}
            {data.blocks.map((block, index) => (
              <section
                key={`${block.type}-${index}`}
                className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8"
              >
                <BlockRenderer block={block} />
              </section>
            ))}

            {/* Personalization sections — authenticated only */}
            <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8">
              {isAuthenticated ? (
                <PersonalizedSections />
              ) : (
                <TrendingSection />
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
