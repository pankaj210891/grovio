/**
 * ReviewsSection — PDP reviews stub (Wave 5b will implement full reviews UI).
 *
 * Shows an empty state "Be the first to review" when no reviews exist.
 * Full star ratings, review form, and review list are in Wave 5b.
 */

import { Star } from 'lucide-react';

interface ReviewsSectionProps {
  productId: string;
}

/**
 * Product reviews section stub.
 *
 * Wave 5b implementation will add:
 * - Star rating aggregate display
 * - Review list with pagination
 * - Write a review form (authenticated only)
 */
export function ReviewsSection({ productId: _productId }: ReviewsSectionProps) {
  return (
    <section aria-labelledby="reviews-heading" className="mt-10">
      <h2
        id="reviews-heading"
        className="text-base font-semibold text-grovio-text mb-4"
      >
        Customer Reviews
      </h2>

      <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-lg border border-dashed border-grovio-border bg-grovio-surface">
        <Star className="h-8 w-8 text-grovio-text-muted" aria-hidden="true" />
        <p className="text-sm font-medium text-grovio-text">Be the first to review</p>
        <p className="text-xs text-grovio-text-muted text-center max-w-xs">
          Share your experience to help other shoppers make the right choice.
        </p>
        {/* Review form will be enabled in Wave 5b */}
        <span className="text-xs text-grovio-text-muted italic">(Review submission coming soon)</span>
      </div>
    </section>
  );
}
