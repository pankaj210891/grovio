/**
 * ReviewsSection — full reviews UI for PDP (Wave 5b T2).
 *
 * Features:
 *   - Rating summary (average stars, count, distribution bars)
 *   - Write-a-review form (authenticated + verified purchasers)
 *   - Paginated review list with vendor reply support
 *   - Load more pagination
 */

import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star } from 'lucide-react';
import { apiClient } from '../../lib/api-client.js';
import { useAuth } from '../../hooks/useAuth.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface ReviewVendorReply {
  body: string;
  repliedAt: string;
}

interface ReviewItem {
  id: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  vendorReply: ReviewVendorReply | null;
}

interface RatingDistribution {
  5: number;
  4: number;
  3: number;
  2: number;
  1: number;
}

interface ReviewsResponse {
  averageRating: number;
  totalCount: number;
  distribution: RatingDistribution;
  items: ReviewItem[];
  hasMore: boolean;
}

// ---------------------------------------------------------------------------
// Star display component
// ---------------------------------------------------------------------------

function StarRow({
  rating,
  size = 'sm',
  interactive = false,
  onRate,
}: {
  rating: number;
  size?: 'sm' | 'lg';
  interactive?: boolean;
  onRate?: (r: number) => void;
}) {
  const [hovered, setHovered] = useState(0);
  const sizeClass = size === 'lg' ? 'h-7 w-7' : 'h-4 w-4';

  return (
    <div
      className="flex items-center gap-0.5"
      role={interactive ? 'group' : undefined}
      aria-label={interactive ? 'Select a rating' : `${rating} out of 5 stars`}
    >
      {[1, 2, 3, 4, 5].map((star) => {
        const filled = interactive ? star <= (hovered || rating) : star <= Math.round(rating);
        return (
          <button
            key={star}
            type="button"
            disabled={!interactive}
            aria-label={interactive ? `Rate ${star} star${star > 1 ? 's' : ''}` : undefined}
            aria-pressed={interactive ? star === rating : undefined}
            onMouseEnter={interactive ? () => setHovered(star) : undefined}
            onMouseLeave={interactive ? () => setHovered(0) : undefined}
            onClick={interactive && onRate ? () => onRate(star) : undefined}
            className={[
              interactive ? 'cursor-pointer hover:scale-110 transition-transform focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded' : 'cursor-default pointer-events-none',
            ].join(' ')}
          >
            <Star
              className={`${sizeClass} transition-colors ${filled ? 'fill-amber-400 text-amber-400' : 'fill-none text-grovio-border'}`}
              aria-hidden="true"
            />
          </button>
        );
      })}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Rating distribution bar
// ---------------------------------------------------------------------------

function DistributionBar({
  label,
  count,
  total,
}: {
  label: string;
  count: number;
  total: number;
}) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div className="flex items-center gap-2 text-xs">
      <span className="w-10 text-right text-grovio-text-muted">{label}</span>
      <div className="flex-1 h-1.5 bg-grovio-border rounded-full overflow-hidden">
        <div
          className="h-full bg-amber-400 rounded-full transition-all duration-300"
          style={{ width: `${pct}%` }}
          aria-hidden="true"
        />
      </div>
      <span className="w-6 text-grovio-text-muted">{count}</span>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review card
// ---------------------------------------------------------------------------

function ReviewCard({ review }: { review: ReviewItem }) {
  const date = new Date(review.createdAt).toLocaleDateString('en-IN', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  return (
    <article className="py-5 border-b border-grovio-border last:border-b-0">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div>
          <div className="flex items-center gap-2 flex-wrap">
            <StarRow rating={review.rating} />
            {review.isVerifiedPurchase && (
              <span className="inline-flex items-center gap-1 text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                Verified Purchase
              </span>
            )}
          </div>
          {review.title && (
            <p className="mt-1 text-sm font-semibold text-grovio-text">{review.title}</p>
          )}
        </div>
        <time className="text-xs text-grovio-text-muted whitespace-nowrap" dateTime={review.createdAt}>
          {date}
        </time>
      </div>

      <p className="text-sm text-grovio-text leading-relaxed mb-1">{review.body}</p>
      <p className="text-xs text-grovio-text-muted">
        By {review.authorName}
      </p>

      {review.vendorReply && (
        <div className="mt-3 rounded-lg bg-grovio-surface border-l-2 border-grovio-primary/40 p-3">
          <p className="text-xs font-semibold text-grovio-primary mb-1">Vendor Response</p>
          <p className="text-sm text-grovio-text leading-relaxed">{review.vendorReply.body}</p>
          <time
            className="text-[10px] text-grovio-text-muted mt-1 block"
            dateTime={review.vendorReply.repliedAt}
          >
            {new Date(review.vendorReply.repliedAt).toLocaleDateString()}
          </time>
        </div>
      )}
    </article>
  );
}

// ---------------------------------------------------------------------------
// Write review form
// ---------------------------------------------------------------------------

interface ReviewFormProps {
  productId: string;
  onSuccess: () => void;
}

function WriteReviewForm({ productId, onSuccess }: ReviewFormProps) {
  const [rating, setRating] = useState(0);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState('');
  const [errors, setErrors] = useState<{ rating?: string; body?: string }>({});
  const queryClient = useQueryClient();

  const submitMutation = useMutation({
    mutationFn: () =>
      apiClient.post(`/products/${productId}/reviews`, { rating, title, body }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['reviews', productId] });
      onSuccess();
    },
  });

  function validate() {
    const errs: typeof errors = {};
    if (rating === 0) errs.rating = 'Please select a star rating.';
    if (body.trim().length < 20) errs.body = 'Review must be at least 20 characters.';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) {
      setErrors(errs);
      return;
    }
    setErrors({});
    submitMutation.mutate();
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mt-4 rounded-xl border border-grovio-border bg-grovio-surface p-5 space-y-4"
      aria-label="Write a review"
      noValidate
    >
      <h3 className="text-sm font-semibold text-grovio-text">Write a Review</h3>

      {/* Star selector */}
      <div>
        <p className="text-xs font-medium text-grovio-text mb-1">Your Rating</p>
        <StarRow rating={rating} interactive onRate={setRating} />
        {errors.rating && (
          <p className="mt-1 text-xs text-grovio-error" role="alert">{errors.rating}</p>
        )}
      </div>

      {/* Title */}
      <div>
        <label htmlFor="review-title" className="text-xs font-medium text-grovio-text block mb-1">
          Title <span className="text-grovio-text-muted">(optional)</span>
        </label>
        <input
          id="review-title"
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          placeholder="Summarize your experience"
          maxLength={120}
          disabled={submitMutation.isPending}
          className="w-full h-9 rounded-md border border-grovio-border bg-grovio-surface-raised px-3 text-sm text-grovio-text focus:outline-none focus:ring-2 focus:ring-grovio-primary disabled:opacity-60"
        />
      </div>

      {/* Body */}
      <div>
        <label htmlFor="review-body" className="text-xs font-medium text-grovio-text block mb-1">
          Your Review <span className="text-grovio-error">*</span>
        </label>
        <textarea
          id="review-body"
          value={body}
          onChange={(e) => setBody(e.target.value)}
          rows={4}
          placeholder="Tell others about your experience (min 20 characters)"
          disabled={submitMutation.isPending}
          className="w-full rounded-md border border-grovio-border bg-grovio-surface-raised px-3 py-2 text-sm text-grovio-text resize-y focus:outline-none focus:ring-2 focus:ring-grovio-primary disabled:opacity-60"
          aria-describedby={errors.body ? 'review-body-error' : undefined}
        />
        <p className="text-xs text-grovio-text-muted mt-0.5">
          {body.length} / 20 minimum characters
        </p>
        {errors.body && (
          <p id="review-body-error" className="mt-1 text-xs text-grovio-error" role="alert">
            {errors.body}
          </p>
        )}
      </div>

      {submitMutation.isError && (
        <p className="text-xs text-grovio-error" role="alert">
          Failed to submit review. Please try again.
        </p>
      )}

      <button
        type="submit"
        disabled={submitMutation.isPending}
        className="h-9 px-5 rounded-md bg-grovio-primary text-white text-sm font-semibold hover:bg-grovio-primary-hover transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-offset-2"
      >
        {submitMutation.isPending ? 'Submitting…' : 'Submit Review'}
      </button>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main ReviewsSection
// ---------------------------------------------------------------------------

interface ReviewsSectionProps {
  productId: string;
}

export function ReviewsSection({ productId }: ReviewsSectionProps) {
  const { isAuthenticated } = useAuth();
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(true);

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ['reviews', productId, page],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: ReviewsResponse }>(
          `/products/${productId}/reviews?page=${page}`,
        )
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const handleReviewSuccess = useCallback(() => {
    setShowForm(false);
  }, []);

  const total = data?.totalCount ?? 0;
  const average = data?.averageRating ?? 0;
  const distribution = data?.distribution;

  return (
    <section aria-labelledby="reviews-heading" className="mt-10">
      <h2 id="reviews-heading" className="text-base font-semibold text-grovio-text mb-6">
        Customer Reviews
      </h2>

      {/* Rating summary */}
      {!isLoading && total > 0 && (
        <div className="flex flex-col sm:flex-row gap-6 mb-6 p-5 rounded-xl bg-grovio-surface border border-grovio-border">
          {/* Overall average */}
          <div className="flex flex-col items-center justify-center min-w-[100px]">
            <p className="text-4xl font-bold text-grovio-text">{average.toFixed(1)}</p>
            <StarRow rating={average} size="lg" />
            <p className="text-xs text-grovio-text-muted mt-1">{total} reviews</p>
          </div>

          {/* Distribution bars */}
          {distribution && (
            <div className="flex-1 space-y-1.5 justify-center flex flex-col">
              {([5, 4, 3, 2, 1] as const).map((stars) => (
                <DistributionBar
                  key={stars}
                  label={`${stars} star`}
                  count={distribution[stars]}
                  total={total}
                />
              ))}
            </div>
          )}
        </div>
      )}

      {/* Write review form */}
      {isAuthenticated && showForm && (
        <WriteReviewForm productId={productId} onSuccess={handleReviewSuccess} />
      )}

      {!isAuthenticated && (
        <p className="text-sm text-grovio-text-muted mb-4">
          <a href="/auth/login" className="text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded">
            Sign in
          </a>{' '}
          to write a review.
        </p>
      )}

      {/* Review list */}
      {isLoading && (
        <div className="space-y-4 mt-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <div key={i} className="py-5 border-b border-grovio-border animate-pulse space-y-2">
              <div className="h-4 w-32 bg-grovio-border rounded" />
              <div className="h-3 w-full bg-grovio-border rounded" />
              <div className="h-3 w-2/3 bg-grovio-border rounded" />
            </div>
          ))}
        </div>
      )}

      {!isLoading && total === 0 && (
        <div className="flex flex-col items-center justify-center py-10 gap-3 rounded-lg border border-dashed border-grovio-border bg-grovio-surface mt-4">
          <Star className="h-8 w-8 text-grovio-text-muted" aria-hidden="true" />
          <p className="text-sm font-medium text-grovio-text">Be the first to review</p>
          <p className="text-xs text-grovio-text-muted text-center max-w-xs">
            Share your experience to help other shoppers make the right choice.
          </p>
        </div>
      )}

      {!isLoading && data?.items && data.items.length > 0 && (
        <div className="mt-4">
          {data.items.map((review) => (
            <ReviewCard key={review.id} review={review} />
          ))}

          {data.hasMore && (
            <button
              type="button"
              onClick={() => setPage((p) => p + 1)}
              className="mt-4 w-full py-2.5 text-sm font-medium text-grovio-primary border border-grovio-primary/30 rounded-lg hover:bg-grovio-primary/5 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
            >
              Load More Reviews
            </button>
          )}
        </div>
      )}
    </section>
  );
}
