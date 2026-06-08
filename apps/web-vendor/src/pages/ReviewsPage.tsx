/**
 * Vendor Reviews page — /reviews
 *
 * Lists all reviews on vendor's products. Allows vendor to reply
 * to reviews via a reply modal (PATCH /vendor/reviews/:id/reply).
 */

import { motion } from 'motion/react';
import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Star, MessageSquare } from 'lucide-react';
import { apiClient } from '../lib/apiClient.js';

interface Review {
  id: string;
  productName: string;
  rating: number;
  title: string;
  body: string;
  authorName: string;
  isVerifiedPurchase: boolean;
  createdAt: string;
  vendorReply: { body: string; repliedAt: string } | null;
}

interface ReviewsResponse {
  items: Review[];
  total: number;
}

function StarDisplay({ rating }: { rating: number }) {
  return (
    <div className="flex items-center gap-0.5" aria-label={`${rating} out of 5 stars`}>
      {[1, 2, 3, 4, 5].map((s) => (
        <Star
          key={s}
          className={`h-3.5 w-3.5 ${s <= rating ? 'fill-amber-400 text-amber-400' : 'fill-none text-grovio-border'}`}
          aria-hidden="true"
        />
      ))}
    </div>
  );
}

interface ReplyModalProps {
  reviewId: string;
  existingReply: string;
  onClose: () => void;
}

function ReplyModal({ reviewId, existingReply, onClose }: ReplyModalProps) {
  const [reply, setReply] = useState(existingReply);
  const queryClient = useQueryClient();

  const replyMutation = useMutation({
    mutationFn: () => apiClient.patch(`/vendor/reviews/${reviewId}/reply`, { body: reply }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendor', 'reviews'] });
      onClose();
    },
  });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Reply to review"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.95 }}
        animate={{ opacity: 1, scale: 1 }}
        exit={{ opacity: 0, scale: 0.95 }}
        transition={{ duration: 0.2 }}
        className="w-full max-w-md rounded-xl bg-grovio-surface-raised border border-grovio-border shadow-xl p-6 space-y-4"
        onClick={(e) => e.stopPropagation()}
      >
        <h3 className="text-base font-semibold text-grovio-text">
          {existingReply ? 'Edit Reply' : 'Reply to Review'}
        </h3>

        <textarea
          value={reply}
          onChange={(e) => setReply(e.target.value)}
          rows={5}
          placeholder="Write your response to this review…"
          autoFocus
          className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text resize-y focus:outline-none focus:ring-2 focus:ring-grovio-primary"
          aria-label="Reply text"
        />

        {replyMutation.isError && (
          <p className="text-xs text-grovio-error" role="alert">
            Failed to submit reply. Please try again.
          </p>
        )}

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-sm font-medium text-grovio-text-muted hover:text-grovio-text transition-colors rounded-lg hover:bg-grovio-surface focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={() => replyMutation.mutate()}
            disabled={replyMutation.isPending || !reply.trim()}
            className="px-4 py-2 text-sm font-semibold text-white bg-grovio-primary rounded-lg hover:bg-grovio-primary-hover transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary"
          >
            {replyMutation.isPending ? 'Saving…' : 'Save Reply'}
          </button>
        </div>
      </motion.div>
    </div>
  );
}

export default function ReviewsPage() {
  const [page, setPage] = useState(1);
  const [replyTarget, setReplyTarget] = useState<{ id: string; existing: string } | null>(null);

  const { data, isLoading } = useQuery<ReviewsResponse>({
    queryKey: ['vendor', 'reviews', page],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: ReviewsResponse }>(`/vendor/reviews?page=${page}`)
        .then((r) => r.data),
    staleTime: 2 * 60 * 1000,
  });

  const items = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));

  return (
    <>
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.3, ease: 'easeOut' }}
        className="space-y-5"
      >
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Product Reviews</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">{total} reviews on your products</p>
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-4 animate-pulse space-y-2">
                <div className="h-4 w-48 bg-grovio-border rounded" />
                <div className="h-3 w-full bg-grovio-border rounded" />
              </div>
            ))}
          </div>
        )}

        {!isLoading && items.length === 0 && (
          <div className="rounded-xl border border-dashed border-grovio-border bg-grovio-surface p-12 text-center">
            <Star className="h-10 w-10 text-grovio-text-muted mx-auto mb-3" aria-hidden="true" />
            <p className="text-sm font-medium text-grovio-text">No reviews yet</p>
            <p className="text-xs text-grovio-text-muted mt-1">Customer reviews will appear here.</p>
          </div>
        )}

        {!isLoading && items.length > 0 && (
          <div className="space-y-3">
            {items.map((review) => (
              <div
                key={review.id}
                className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5"
              >
                <div className="flex items-start justify-between gap-3 flex-wrap mb-3">
                  <div>
                    <p className="text-xs font-medium text-grovio-text-muted mb-1">{review.productName}</p>
                    <div className="flex items-center gap-2">
                      <StarDisplay rating={review.rating} />
                      {review.isVerifiedPurchase && (
                        <span className="text-[10px] font-medium text-green-700 bg-green-50 px-1.5 py-0.5 rounded">
                          Verified Purchase
                        </span>
                      )}
                    </div>
                    {review.title && (
                      <p className="mt-1 text-sm font-semibold text-grovio-text">{review.title}</p>
                    )}
                  </div>
                  <time className="text-xs text-grovio-text-muted" dateTime={review.createdAt}>
                    {new Date(review.createdAt).toLocaleDateString()}
                  </time>
                </div>

                <p className="text-sm text-grovio-text mb-1">{review.body}</p>
                <p className="text-xs text-grovio-text-muted">By {review.authorName}</p>

                {review.vendorReply && (
                  <div className="mt-3 rounded-lg bg-grovio-surface border-l-2 border-grovio-primary/40 p-3">
                    <p className="text-xs font-semibold text-grovio-primary mb-1">Your Response</p>
                    <p className="text-sm text-grovio-text">{review.vendorReply.body}</p>
                  </div>
                )}

                <div className="mt-3 flex justify-end">
                  <button
                    type="button"
                    onClick={() => setReplyTarget({ id: review.id, existing: review.vendorReply?.body ?? '' })}
                    className="inline-flex items-center gap-1.5 text-xs font-medium text-grovio-primary hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
                  >
                    <MessageSquare className="h-3.5 w-3.5" aria-hidden="true" />
                    {review.vendorReply ? 'Edit Reply' : 'Reply'}
                  </button>
                </div>
              </div>
            ))}
          </div>
        )}

        {totalPages > 1 && (
          <div className="flex items-center justify-between text-sm">
            <span className="text-grovio-text-muted">Page {page} of {totalPages}</span>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={page <= 1}
                onClick={() => setPage((p) => p - 1)}
                className="rounded border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface disabled:opacity-40"
              >
                Previous
              </button>
              <button
                type="button"
                disabled={page >= totalPages}
                onClick={() => setPage((p) => p + 1)}
                className="rounded border border-grovio-border px-3 py-1.5 text-xs font-medium text-grovio-text-muted hover:bg-grovio-surface disabled:opacity-40"
              >
                Next
              </button>
            </div>
          </div>
        )}
      </motion.div>

      {replyTarget && (
        <ReplyModal
          reviewId={replyTarget.id}
          existingReply={replyTarget.existing}
          onClose={() => setReplyTarget(null)}
        />
      )}
    </>
  );
}
