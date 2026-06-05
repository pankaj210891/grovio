/**
 * MiniChart — thin recharts wrappers for the admin dashboard.
 *
 * LineChart wrapper: orders-by-day trend line (ADM-01, D-10).
 * BarChart wrapper: GMV-by-category bars (ADM-01, D-10).
 *
 * Both components are responsive via recharts ResponsiveContainer.
 * Decision: recharts (Task 1 — approved by user).
 */

import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';

// ---------------------------------------------------------------------------
// Line chart — orders / GMV over time
// ---------------------------------------------------------------------------

interface LineDataPoint {
  date: string;
  ordersCount: number;
  gmvMinor: number;
}

interface MiniLineChartProps {
  data: LineDataPoint[];
  /** Which metric to plot on Y axis — defaults to ordersCount */
  metric?: 'ordersCount' | 'gmvMinor';
}

export function MiniLineChart({ data, metric = 'ordersCount' }: MiniLineChartProps) {
  const isGmv = metric === 'gmvMinor';

  function formatY(value: number): string {
    if (isGmv) {
      const major = value / 100;
      return major >= 1000 ? `₹${(major / 1000).toFixed(1)}k` : `₹${major.toFixed(0)}`;
    }
    return String(value);
  }

  function formatTooltip(value: number): string {
    if (isGmv) return `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`;
    return `${value} orders`;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <LineChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grovio-border, #e5e7eb)" />
        <XAxis
          dataKey="date"
          tick={{ fontSize: 11, fill: 'var(--color-grovio-text-muted, #9ca3af)' }}
          tickFormatter={(v: string) => {
            const d = new Date(v);
            return `${d.getMonth() + 1}/${d.getDate()}`;
          }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-grovio-text-muted, #9ca3af)' }}
          tickFormatter={formatY}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          formatter={(value: number) => [formatTooltip(value), isGmv ? 'GMV' : 'Orders']}
          labelFormatter={(label: string) => new Date(label).toLocaleDateString('en-IN')}
          contentStyle={{
            fontSize: 12,
            background: 'var(--color-grovio-surface-raised, #fff)',
            border: '1px solid var(--color-grovio-border, #e5e7eb)',
            borderRadius: 8,
          }}
        />
        <Line
          type="monotone"
          dataKey={metric}
          stroke="var(--color-grovio-primary, #6366f1)"
          strokeWidth={2}
          dot={false}
          activeDot={{ r: 4 }}
        />
      </LineChart>
    </ResponsiveContainer>
  );
}

// ---------------------------------------------------------------------------
// Bar chart — GMV by category
// ---------------------------------------------------------------------------

interface BarDataPoint {
  name: string;
  gmvMinor: number;
}

interface MiniBarChartProps {
  data: BarDataPoint[];
}

export function MiniBarChart({ data }: MiniBarChartProps) {
  function formatY(value: number): string {
    const major = value / 100;
    return major >= 1000 ? `₹${(major / 1000).toFixed(1)}k` : `₹${major.toFixed(0)}`;
  }

  return (
    <ResponsiveContainer width="100%" height={200}>
      <BarChart data={data} margin={{ top: 4, right: 8, left: 0, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" stroke="var(--color-grovio-border, #e5e7eb)" vertical={false} />
        <XAxis
          dataKey="name"
          tick={{ fontSize: 11, fill: 'var(--color-grovio-text-muted, #9ca3af)' }}
          tickLine={false}
          axisLine={false}
        />
        <YAxis
          tick={{ fontSize: 11, fill: 'var(--color-grovio-text-muted, #9ca3af)' }}
          tickFormatter={formatY}
          tickLine={false}
          axisLine={false}
          width={50}
        />
        <Tooltip
          formatter={(value: number) => [
            `₹${(value / 100).toLocaleString('en-IN', { minimumFractionDigits: 2 })}`,
            'GMV',
          ]}
          contentStyle={{
            fontSize: 12,
            background: 'var(--color-grovio-surface-raised, #fff)',
            border: '1px solid var(--color-grovio-border, #e5e7eb)',
            borderRadius: 8,
          }}
        />
        <Bar
          dataKey="gmvMinor"
          fill="var(--color-grovio-primary, #6366f1)"
          radius={[4, 4, 0, 0]}
        />
      </BarChart>
    </ResponsiveContainer>
  );
}
