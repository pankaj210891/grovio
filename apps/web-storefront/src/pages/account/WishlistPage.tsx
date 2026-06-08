import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { Heart } from 'lucide-react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { ProductCard } from '../../components/ui/ProductCard.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { useWishlist } from '../../hooks/useWishlist.js';
import { apiClient } from '../../lib/api-client.js';
import { SeoHead } from '../../components/seo/SeoHead.js';

/**
 * Account wishlist page — /account/wishlist
 *
 * Shows all wishlisted products in a responsive grid.
 * Price-drop badge appears when is_price_dropped = true.
 * Each card shows a remove button.
 * Empty state with CTA to browse.
 */
export default function WishlistPage() {
  const { data: items, isLoading, isError } = useWishlist();
  const queryClient = useQueryClient();

  const removeMutation = useMutation({
    mutationFn: (productId: string) => apiClient.delete(`/wishlist/${productId}`),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['wishlist'] });
    },
  });

  return (
    <PageTransition>
      <SeoHead
        title="My Wishlist | Grovio"
        description="Your saved products — items you love and want to buy later."
        canonicalPath="/account/wishlist"
      />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center gap-3 mb-8">
          <Heart className="h-6 w-6 text-grovio-error" aria-hidden="true" />
          <h1 className="text-xl font-semibold text-grovio-text">My Wishlist</h1>
        </div>

        {isLoading && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <Skeleton key={i} className="aspect-[4/5] w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            Unable to load your wishlist. Please refresh and try again.
          </p>
        )}

        {!isLoading && !isError && items?.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Heart className="h-12 w-12 text-grovio-border" aria-hidden="true" />
            <p className="text-base font-medium text-grovio-text">Your wishlist is empty</p>
            <p className="text-sm text-grovio-text-muted text-center max-w-xs">
              Start saving items you love. Your wishlist will be here when you&apos;re ready.
            </p>
            <Link
              to="/search"
              className="inline-flex items-center gap-2 rounded-md bg-grovio-primary px-5 py-2.5 text-sm font-semibold text-white hover:bg-grovio-primary-hover transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
            >
              Browse Products
            </Link>
          </div>
        )}

        {!isLoading && !isError && items && items.length > 0 && (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
            {items.map((item) => (
              <div key={item.productId} className="relative">
                <ProductCard
                  productId={item.productId}
                  slug={item.slug}
                  name={item.productName}
                  priceMajor={item.priceMajor}
                  vendorName=""
                  imageUrl={item.imageUrl ?? undefined}
                  isPriceDropped={item.isPriceDropped}
                  showWishlist
                  isWishlisted
                />
                {/* Remove button below the card */}
                <button
                  type="button"
                  onClick={() => removeMutation.mutate(item.productId)}
                  disabled={removeMutation.isPending}
                  className="mt-2 w-full text-xs text-grovio-text-muted hover:text-grovio-error transition-colors text-center focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2 rounded disabled:opacity-50"
                  aria-label={`Remove ${item.productName} from wishlist`}
                >
                  Remove
                </button>
              </div>
            ))}
          </div>
        )}
      </div>
    </PageTransition>
  );
}
