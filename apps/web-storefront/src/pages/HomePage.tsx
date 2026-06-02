import { useQuery } from '@tanstack/react-query';
import { PageTransition } from '../components/layout/PageTransition.js';
import { BlockRenderer } from '../components/blocks/BlockRenderer.js';
import { Skeleton } from '../components/ui/Skeleton.js';
import { Button } from '../components/ui/Button.js';
import { apiClient } from '../lib/api-client.js';
import type { MerchandisingBlock } from '@grovio/contracts';

interface HomepageResponse {
  blocks: MerchandisingBlock[];
}

/**
 * Homepage — renders the configurable CMS block stack from GET /homepage.
 *
 * D-01: Blocks are rendered in API order (sort_order). No hardcoded per-type
 * positioning exists — the order is fully data-driven.
 * D-03: The API always returns seeded blocks; there is no empty state.
 *
 * Loading: full-page skeleton (one tall banner + 2 row skeletons).
 * Error: "Something went wrong loading the homepage." + Retry button.
 * Loaded: ordered block array via BlockRenderer, each in a <section>.
 */
export default function HomePage() {
  const { data, isLoading, isError, refetch } = useQuery<HomepageResponse>({
    queryKey: ['homepage'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: HomepageResponse }>('/homepage')
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000, // 2 minutes
  });

  return (
    <PageTransition>
      {/* Visually-hidden page title for screen readers / a11y — single h1 */}
      <h1 className="sr-only">Grovio — Online Marketplace</h1>

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
            {data.blocks.map((block, index) => (
              <section
                key={`${block.type}-${index}`}
                className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8"
              >
                <BlockRenderer block={block} />
              </section>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
