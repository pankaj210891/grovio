import { Bell } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils.js';

export interface NotificationBellProps {
  count?: number;
  onClick?: () => void;
  className?: string;
  'aria-label'?: string;
}

function NotificationBell({
  count = 0,
  onClick,
  className,
  'aria-label': ariaLabel,
}: NotificationBellProps) {
  const hasUnread = count > 0;
  const label = ariaLabel ?? (hasUnread ? `Notifications, ${count} unread` : 'Notifications');

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={label}
      className={cn(
        'relative inline-flex h-9 w-9 items-center justify-center rounded-md text-muted-foreground transition-colors hover:bg-accent hover:text-accent-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        className,
      )}
    >
      <Bell className="h-5 w-5" />
      {hasUnread && (
        <span
          aria-hidden
          className={cn(
            'absolute right-1 top-1 flex h-4 min-w-4 items-center justify-center rounded-full bg-primary px-0.5 text-[10px] font-bold leading-none text-primary-foreground',
          )}
        >
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  );
}

export { NotificationBell };
