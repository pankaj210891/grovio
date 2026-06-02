import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../../lib/api-client.js';
import { ProductCard } from '../ui/ProductCard.js';
import { Skeleton } from '../ui/Skeleton.js';
import type { ProductGridBlock } from '@grovio/contracts';
import type { Product } from '@grovio/contracts';

interface ProductGridBlockProps {
  block: ProductGridBlock;
}

/**
 * Product grid block renderer.
 *
 * Fetches product summaries for the given productIds via GET /products.
 * Renders in 'grid' (responsive card grid) or 'carousel' (horizontal scroll row) layout.
 *
 * T-04-24: Product data is rendered as JSX nodes (React escapes by default).
 */
export function ProductGridBlock({ block }: ProductGridBlockProps) {
  const { data, isLoading } = useQuery<Product[]>({
    queryKey: ['products', 'by-ids', block.productIds],
    queryFn: () => {
      const ids = block.productIds.join(',');
      return apiClient
        .get<{ success: boolean; data: Product[] }>(`/products?ids=${encodeURIComponent(ids)}`)
        .then((r) => r.data);
    },
    enabled: block.productIds.length > 0,
  });

  const formatPrice = (priceMinor: number) => {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      minimumFractionDigits: 0,
    }).format(priceMinor / 100);
  };

  if (isLoading || !data) {
    return (
      <section aria-label={block.title} className="w-full">
        <h2 className="text-xl font-semibold text-grovio-text mb-4">{block.title}</h2>
        <div
          className={
            block.layout === 'carousel'
              ? 'flex gap-4 overflow-x-auto pb-2'
              : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4'
          }
        >
          {Array.from({ length: Math.min(block.productIds.length, 4) }).map((_, i) => (
            <div key={i} className="flex-shrink-0 w-40 sm:w-auto">
              <Skeleton className="aspect-[4/5] w-full" />
              <Skeleton className="h-4 w-3/4 mt-2" />
              <Skeleton className="h-4 w-1/2 mt-1" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  const gridClass =
    block.layout === 'carousel'
      ? 'flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory'
      : 'grid grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4';

  return (
    <section aria-label={block.title} className="w-full">
      <h2 className="text-xl font-semibold text-grovio-text mb-4">{block.title}</h2>
      <div className={gridClass}>
        {data.map((product) => (
          <div
            key={product.id}
            className={block.layout === 'carousel' ? 'flex-shrink-0 w-48 sm:w-56' : undefined}
          >
            <ProductCard
              slug={product.slug}
              name={product.name}
              priceMajor={formatPrice(product.basePriceMinor)}
              vendorName=""
            />
          </div>
        ))}
      </div>
    </section>
  );
}
