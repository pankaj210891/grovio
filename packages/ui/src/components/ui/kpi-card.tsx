import { TrendingDown, TrendingUp } from 'lucide-react';
import * as React from 'react';
import { cn } from '../../lib/utils.js';
import { Card, CardContent } from './card.js';

export interface KpiCardProps {
  label: string;
  value: string | number;
  delta?: number;
  trend?: 'up' | 'down' | 'neutral';
  accent?: boolean;
  link?: string;
  className?: string;
}

function KpiCard({ label, value, delta, trend, accent = false, className }: KpiCardProps) {
  const trendColor =
    trend === 'up'
      ? 'text-success'
      : trend === 'down'
        ? 'text-destructive'
        : 'text-muted-foreground';

  return (
    <Card
      className={cn(
        'transition-shadow hover:shadow-md',
        accent && 'border-primary/30 bg-primary/5',
        className,
      )}
    >
      <CardContent className="p-5">
        <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
          {label}
        </p>
        <p
          className={cn(
            'mt-1 text-2xl font-bold tabular-nums',
            accent ? 'text-primary' : 'text-foreground',
          )}
        >
          {value}
        </p>
        {delta !== undefined && trend && trend !== 'neutral' && (
          <span className={cn('mt-1 flex items-center gap-0.5 text-xs font-medium', trendColor)}>
            {trend === 'up' ? (
              <TrendingUp className="h-3 w-3" />
            ) : (
              <TrendingDown className="h-3 w-3" />
            )}
            {Math.abs(delta)}%
          </span>
        )}
      </CardContent>
    </Card>
  );
}

export { KpiCard };
