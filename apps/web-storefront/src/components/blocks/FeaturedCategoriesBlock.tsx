import { useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { apiClient } from '../../lib/api-client.js';
import { Skeleton } from '../ui/Skeleton.js';
import type { FeaturedCategoriesBlock } from '@grovio/contracts';
import type { CategoryTreeResponse } from '@grovio/contracts';

interface FeaturedCategoriesBlockProps {
  block: FeaturedCategoriesBlock;
}

/**
 * Featured categories block renderer.
 *
 * Fetches category data from GET /categories and filters to the IDs in the
 * block payload (Pitfall 5 — categoryIds are not pre-resolved in the block
 * payload; category details must be fetched separately).
 *
 * Reuses the ['categories'] query key so results are cached with the header
 * category nav — no extra API call in practice.
 *
 * T-04-24: category names/slugs are rendered as JSX text nodes (React escapes).
 */
export function FeaturedCategoriesBlock({ block }: FeaturedCategoriesBlockProps) {
  const { data, isLoading } = useQuery<CategoryTreeResponse>({
    queryKey: ['categories'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: CategoryTreeResponse }>('/categories')
        .then((r) => r.data),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });

  // Flatten the category tree to find matching nodes
  function flattenTree(nodes: CategoryTreeResponse['tree']): CategoryTreeResponse['tree'][number][] {
    const result: CategoryTreeResponse['tree'][number][] = [];
    for (const node of nodes) {
      result.push(node);
      if (node.children.length > 0) {
        result.push(...flattenTree(node.children));
      }
    }
    return result;
  }

  const allCategories = data ? flattenTree(data.tree) : [];
  const filteredCategories = allCategories.filter((cat) =>
    block.categoryIds.includes(cat.id),
  );
  // Preserve the order from categoryIds
  const orderedCategories = block.categoryIds
    .map((id) => filteredCategories.find((cat) => cat.id === id))
    .filter(Boolean) as typeof filteredCategories;

  const containerClass =
    block.layout === 'row'
      ? 'flex gap-4 overflow-x-auto pb-2 snap-x snap-mandatory'
      : 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-4';

  if (isLoading) {
    return (
      <section aria-label={block.title} className="w-full">
        <h2 className="text-xl font-semibold text-grovio-text mb-4">{block.title}</h2>
        <div className={containerClass}>
          {Array.from({ length: Math.min(block.categoryIds.length, 4) }).map((_, i) => (
            <div
              key={i}
              className={block.layout === 'row' ? 'flex-shrink-0 w-32' : undefined}
            >
              <Skeleton className="aspect-square w-full rounded-lg" />
              <Skeleton className="h-4 w-3/4 mt-2 mx-auto" />
            </div>
          ))}
        </div>
      </section>
    );
  }

  return (
    <section aria-label={block.title} className="w-full">
      <h2 className="text-xl font-semibold text-grovio-text mb-4">{block.title}</h2>
      <div className={containerClass}>
        {orderedCategories.map((category) => (
          <Link
            key={category.id}
            to={`/category/${category.slug}`}
            className={`flex flex-col items-center gap-2 group focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded-lg ${block.layout === 'row' ? 'flex-shrink-0 w-32 snap-start' : ''}`}
          >
            {/* Category image placeholder — real image from CMS payload in future */}
            <div className="w-full aspect-square rounded-lg bg-grovio-border flex items-center justify-center overflow-hidden group-hover:ring-2 group-hover:ring-grovio-primary transition-all duration-150">
              <span className="text-2xl text-grovio-text-muted" aria-hidden="true">
                {category.name.charAt(0).toUpperCase()}
              </span>
            </div>
            <span className="text-sm font-medium text-grovio-text text-center group-hover:text-grovio-primary transition-colors duration-150 line-clamp-2">
              {category.name}
            </span>
          </Link>
        ))}
      </div>
    </section>
  );
}
