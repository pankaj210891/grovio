/**
 * Customer notifications page — /account/notifications
 *
 * Full paginated list of customer notifications with dismiss action.
 * "Mark all as dismissed" button at top.
 * Per-type icons and relative timestamps.
 */

import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { Bell, Package, Tag, RefreshCw, Gift } from 'lucide-react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient } from '../../lib/api-client.js';
import { SeoHead } from '../../components/seo/SeoHead.js';

type NotificationType = 'order_update' | 'price_drop' | 'return_update' | 'promotion' | string;

interface CustomerNotification {
  id: string;
  type: NotificationType;
  title: string;
  body: string;
  createdAt: string;
  isDismissed: boolean;
}

interface NotificationsResponse {
  items: CustomerNotification[];
  unreadCount: number;
  hasMore: boolean;
}

function typeIcon(type: NotificationType) {
  switch (type) {
    case 'order_update': return <Package className="h-4 w-4 text-grovio-primary" aria-hidden="true" />;
    case 'price_drop': return <Tag className="h-4 w-4 text-amber-500" aria-hidden="true" />;
    case 'return_update': return <RefreshCw className="h-4 w-4 text-grovio-secondary" aria-hidden="true" />;
    case 'promotion': return <Gift className="h-4 w-4 text-green-600" aria-hidden="true" />;
    default: return <Bell className="h-4 w-4 text-grovio-text-muted" aria-hidden="true" />;
  }
}

function relativeTime(iso: string): string {
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffSec = Math.floor(diffMs / 1000);
  if (diffSec < 60) return 'Just now';
  const diffMin = Math.floor(diffSec / 60);
  if (diffMin < 60) return `${diffMin} minute${diffMin > 1 ? 's' : ''} ago`;
  const diffHr = Math.floor(diffMin / 60);
  if (diffHr < 24) return `${diffHr} hour${diffHr > 1 ? 's' : ''} ago`;
  const diffDay = Math.floor(diffHr / 24);
  if (diffDay < 7) return `${diffDay} day${diffDay > 1 ? 's' : ''} ago`;
  return new Date(iso).toLocaleDateString();
}

export default function NotificationsPage() {
  const queryClient = useQueryClient();

  const { data, isLoading, isError } = useQuery<NotificationsResponse>({
    queryKey: ['account', 'notifications'],
    queryFn: () =>
      apiClient
        .get<{ success: boolean; data: NotificationsResponse }>('/account/notifications')
        .then((r) => r.data),
    staleTime: 0,
  });

  const dismissMutation = useMutation({
    mutationFn: (notificationId: string) =>
      apiClient.post(`/account/notifications/${notificationId}/dismiss`, {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account', 'notifications'] });
    },
  });

  const dismissAllMutation = useMutation({
    mutationFn: () => apiClient.post('/account/notifications/dismiss-all', {}),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['account', 'notifications'] });
    },
  });

  const items = data?.items ?? [];
  const unreadCount = data?.unreadCount ?? 0;

  return (
    <PageTransition>
      <SeoHead
        title="Notifications | Grovio"
        description="Your account notifications and updates."
        canonicalPath="/account/notifications"
      />
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="flex items-center justify-between mb-8 gap-4 flex-wrap">
          <div className="flex items-center gap-3">
            <Bell className="h-6 w-6 text-grovio-primary" aria-hidden="true" />
            <h1 className="text-xl font-semibold text-grovio-text">
              Notifications
              {unreadCount > 0 && (
                <span className="ml-2 text-sm font-normal text-grovio-text-muted">
                  ({unreadCount} unread)
                </span>
              )}
            </h1>
          </div>

          {items.some((n) => !n.isDismissed) && (
            <button
              type="button"
              onClick={() => dismissAllMutation.mutate()}
              disabled={dismissAllMutation.isPending}
              className="text-sm font-medium text-grovio-primary hover:underline disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
            >
              {dismissAllMutation.isPending ? 'Dismissing…' : 'Mark all as dismissed'}
            </button>
          )}
        </div>

        {isLoading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            Unable to load notifications. Please refresh and try again.
          </p>
        )}

        {!isLoading && !isError && items.length === 0 && (
          <div className="flex flex-col items-center justify-center py-24 gap-4">
            <Bell className="h-12 w-12 text-grovio-border" aria-hidden="true" />
            <p className="text-base font-medium text-grovio-text">You&apos;re all caught up!</p>
            <p className="text-sm text-grovio-text-muted">No notifications to show right now.</p>
          </div>
        )}

        {!isLoading && !isError && items.length > 0 && (
          <ul className="space-y-2" aria-label="Notifications list">
            {items.map((notification) => (
              <li
                key={notification.id}
                className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
                  notification.isDismissed
                    ? 'border-grovio-border bg-grovio-surface opacity-70'
                    : 'border-grovio-primary/20 bg-grovio-surface-raised'
                }`}
              >
                <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-grovio-surface border border-grovio-border mt-0.5">
                  {typeIcon(notification.type)}
                </div>

                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-grovio-text">{notification.title}</p>
                  <p className="text-sm text-grovio-text-muted mt-0.5">{notification.body}</p>
                  <time
                    className="text-xs text-grovio-text-muted mt-1 block"
                    dateTime={notification.createdAt}
                    title={new Date(notification.createdAt).toLocaleString()}
                  >
                    {relativeTime(notification.createdAt)}
                  </time>
                </div>

                {!notification.isDismissed && (
                  <button
                    type="button"
                    onClick={() => dismissMutation.mutate(notification.id)}
                    disabled={dismissMutation.isPending}
                    className="shrink-0 text-xs text-grovio-text-muted hover:text-grovio-text transition-colors disabled:opacity-60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary rounded"
                    aria-label={`Dismiss notification: ${notification.title}`}
                  >
                    Dismiss
                  </button>
                )}
              </li>
            ))}
          </ul>
        )}
      </div>
    </PageTransition>
  );
}
