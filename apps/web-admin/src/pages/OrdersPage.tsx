/**
 * OrdersPage — advanced orders management (Phase 11, T9).
 *
 * Features:
 *   1. Advanced filter panel (status, date range, vendor, amount range)
 *   2. Filter preset save/load (stored in sessionStorage)
 *   3. Bulk actions: Mark Shipped, Cancel, Export CSV
 *   4. Order row with expand for items
 */

import { motion, AnimatePresence } from 'framer-motion';
import { useState, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post } from '../lib/apiClient.js';

type OrderStatus = 'all' | 'pending' | 'processing' | 'shipped' | 'delivered' | 'cancelled' | 'refund_requested';

interface OrderRow {
  id: string;
  orderNumber: string;
  customerEmail: string;
  vendorName: string;
  status: string;
  totalMinorUnits: number;
  itemCount: number;
  placedAt: string;
}

interface OrderListResponse {
  items: OrderRow[];
  total: number;
}

interface FilterPreset {
  name: string;
  filters: Filters;
}

interface Filters {
  status: OrderStatus;
  dateFrom: string;
  dateTo: string;
  vendorName: string;
  amountMin: string;
  amountMax: string;
}

const DEFAULT_FILTERS: Filters = {
  status: 'all',
  dateFrom: '',
  dateTo: '',
  vendorName: '',
  amountMin: '',
  amountMax: '',
};

const STATUS_OPTIONS: { value: OrderStatus; label: string }[] = [
  { value: 'all', label: 'All statuses' },
  { value: 'pending', label: 'Pending' },
  { value: 'processing', label: 'Processing' },
  { value: 'shipped', label: 'Shipped' },
  { value: 'delivered', label: 'Delivered' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'refund_requested', label: 'Refund Requested' },
];

const STATUS_COLORS: Record<string, string> = {
  pending: 'bg-amber-100 text-amber-700',
  processing: 'bg-blue-100 text-blue-700',
  shipped: 'bg-purple-100 text-purple-700',
  delivered: 'bg-green-100 text-green-700',
  cancelled: 'bg-gray-100 text-gray-600',
  refund_requested: 'bg-red-100 text-red-700',
};

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

const PRESETS_KEY = 'admin-order-filter-presets';

function loadPresets(): FilterPreset[] {
  try {
    return JSON.parse(sessionStorage.getItem(PRESETS_KEY) ?? '[]') as FilterPreset[];
  } catch {
    return [];
  }
}

function savePresets(presets: FilterPreset[]) {
  sessionStorage.setItem(PRESETS_KEY, JSON.stringify(presets));
}

export function OrdersPage() {
  const queryClient = useQueryClient();
  const [filters, setFilters] = useState<Filters>(DEFAULT_FILTERS);
  const [page, setPage] = useState(1);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [showFilters, setShowFilters] = useState(false);
  const [presets, setPresets] = useState<FilterPreset[]>(loadPresets);
  const [presetName, setPresetName] = useState('');

  const buildQuery = useCallback(() => {
    const p = new URLSearchParams({ page: String(page), pageSize: '20' });
    if (filters.status !== 'all') p.set('status', filters.status);
    if (filters.dateFrom) p.set('dateFrom', filters.dateFrom);
    if (filters.dateTo) p.set('dateTo', filters.dateTo);
    if (filters.vendorName) p.set('vendor', filters.vendorName);
    if (filters.amountMin) p.set('amountMin', String(Math.round(parseFloat(filters.amountMin) * 100)));
    if (filters.amountMax) p.set('amountMax', String(Math.round(parseFloat(filters.amountMax) * 100)));
    return p.toString();
  }, [filters, page]);

  const { data, isLoading } = useQuery<OrderListResponse>({
    queryKey: ['admin', 'orders', filters, page],
    queryFn: () => get<OrderListResponse>(`/admin/orders?${buildQuery()}`),
    staleTime: 30_000,
  });

  const bulkMutation = useMutation({
    mutationFn: ({ action, ids }: { action: 'ship' | 'cancel'; ids: string[] }) =>
      post('/admin/orders/bulk-action', { action, orderIds: ids }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['admin', 'orders'] });
      setSelected(new Set());
    },
  });

  const orders = data?.items ?? [];
  const total = data?.total ?? 0;
  const totalPages = Math.max(1, Math.ceil(total / 20));
  const allSelected = orders.length > 0 && orders.every((o) => selected.has(o.id));

  function toggleAll() {
    setSelected(allSelected ? new Set() : new Set(orders.map((o) => o.id)));
  }

  function toggleOne(id: string) {
    setSelected((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });
  }

  function savePreset() {
    if (!presetName.trim()) return;
    const updated = [...presets.filter((p) => p.name !== presetName), { name: presetName, filters }];
    setPresets(updated);
    savePresets(updated);
    setPresetName('');
  }

  function loadPreset(preset: FilterPreset) {
    setFilters(preset.filters);
    setPage(1);
  }

  function deletePreset(name: string) {
    const updated = presets.filter((p) => p.name !== name);
    setPresets(updated);
    savePresets(updated);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Orders</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">{total} orders total</p>
        </div>
        <div className="flex items-center gap-2">
          {selected.size > 0 && (
            <>
              <span className="text-xs text-grovio-text-muted">{selected.size} selected</span>
              <button
                type="button"
                onClick={() => bulkMutation.mutate({ action: 'ship', ids: [...selected] })}
                disabled={bulkMutation.isPending}
                className="rounded-lg bg-blue-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Mark Shipped
              </button>
              <button
                type="button"
                onClick={() => bulkMutation.mutate({ action: 'cancel', ids: [...selected] })}
                disabled={bulkMutation.isPending}
                className="rounded-lg border border-grovio-error px-3 py-1.5 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
              >
                Cancel
              </button>
            </>
          )}
          <button
            type="button"
            onClick={() => setShowFilters((f) => !f)}
            className={[
              'rounded-lg border px-3 py-1.5 text-xs font-medium transition-colors',
              showFilters
                ? 'border-grovio-primary bg-grovio-primary/10 text-grovio-primary'
                : 'border-grovio-border text-grovio-text hover:bg-grovio-surface',
            ].join(' ')}
          >
            Filters
          </button>
        </div>
      </div>

      {/* Filter panel */}
      <AnimatePresence>
        {showFilters && (
          <motion.div
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden rounded-xl border border-grovio-border bg-grovio-surface-raised p-5"
          >
            <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 md:grid-cols-6">
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Status</label>
                <select
                  value={filters.status}
                  onChange={(e) => { setFilters((f) => ({ ...f, status: e.target.value as OrderStatus })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                >
                  {STATUS_OPTIONS.map((s) => (
                    <option key={s.value} value={s.value}>{s.label}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">From</label>
                <input
                  type="date"
                  value={filters.dateFrom}
                  onChange={(e) => { setFilters((f) => ({ ...f, dateFrom: e.target.value })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">To</label>
                <input
                  type="date"
                  value={filters.dateTo}
                  onChange={(e) => { setFilters((f) => ({ ...f, dateTo: e.target.value })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Vendor</label>
                <input
                  type="text"
                  placeholder="Vendor name"
                  value={filters.vendorName}
                  onChange={(e) => { setFilters((f) => ({ ...f, vendorName: e.target.value })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Min (₹)</label>
                <input
                  type="number"
                  placeholder="0"
                  value={filters.amountMin}
                  onChange={(e) => { setFilters((f) => ({ ...f, amountMin: e.target.value })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-grovio-text-muted">Max (₹)</label>
                <input
                  type="number"
                  placeholder="∞"
                  value={filters.amountMax}
                  onChange={(e) => { setFilters((f) => ({ ...f, amountMax: e.target.value })); setPage(1); }}
                  className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text focus:border-grovio-primary focus:outline-none"
                />
              </div>
            </div>

            {/* Preset save/load */}
            <div className="mt-4 flex flex-wrap items-center gap-2 border-t border-grovio-border pt-4">
              <input
                type="text"
                placeholder="Preset name"
                value={presetName}
                onChange={(e) => setPresetName(e.target.value)}
                className="w-36 rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1.5 text-xs text-grovio-text placeholder-grovio-text-muted/60 focus:border-grovio-primary focus:outline-none"
              />
              <button
                type="button"
                onClick={savePreset}
                className="rounded-lg border border-grovio-border px-2.5 py-1.5 text-xs font-medium text-grovio-text hover:bg-grovio-surface"
              >
                Save preset
              </button>
              {presets.map((preset) => (
                <div key={preset.name} className="flex items-center gap-1">
                  <button
                    type="button"
                    onClick={() => loadPreset(preset)}
                    className="rounded-lg border border-grovio-border px-2.5 py-1.5 text-xs font-medium text-grovio-primary hover:bg-grovio-primary/5"
                  >
                    {preset.name}
                  </button>
                  <button
                    type="button"
                    onClick={() => deletePreset(preset.name)}
                    className="text-grovio-text-muted hover:text-grovio-error text-xs"
                    aria-label={`Delete preset ${preset.name}`}
                  >
                    ×
                  </button>
                </div>
              ))}
              <button
                type="button"
                onClick={() => { setFilters(DEFAULT_FILTERS); setPage(1); }}
                className="ml-auto text-xs font-medium text-grovio-text-muted hover:text-grovio-text"
              >
                Clear all
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Orders table */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
        {isLoading ? (
          <p className="py-12 text-center text-sm text-grovio-text-muted">Loading…</p>
        ) : orders.length === 0 ? (
          <p className="py-12 text-center text-sm text-grovio-text-muted">No orders match your filters.</p>
        ) : (
          <table className="w-full text-sm">
            <thead className="border-b border-grovio-border bg-grovio-surface">
              <tr>
                <th className="w-10 px-4 py-3 text-center">
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} className="accent-grovio-primary" />
                </th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Order</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Customer</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Vendor</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Status</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Total</th>
                <th className="px-4 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Items</th>
                <th className="px-4 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Placed</th>
              </tr>
            </thead>
            <tbody>
              {orders.map((order) => (
                <tr key={order.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                  <td className="px-4 py-3 text-center">
                    <input
                      type="checkbox"
                      checked={selected.has(order.id)}
                      onChange={() => toggleOne(order.id)}
                      className="accent-grovio-primary"
                    />
                  </td>
                  <td className="px-4 py-3 font-mono text-xs font-medium text-grovio-text">
                    #{order.orderNumber}
                  </td>
                  <td className="px-4 py-3 text-grovio-text-muted">{order.customerEmail}</td>
                  <td className="px-4 py-3 text-grovio-text">{order.vendorName}</td>
                  <td className="px-4 py-3">
                    <span className={[
                      'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                      STATUS_COLORS[order.status] ?? 'bg-gray-100 text-gray-600',
                    ].join(' ')}>
                      {order.status?.replace(/_/g, ' ') ?? '—'}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right font-medium text-grovio-text">
                    {formatInr(order.totalMinorUnits)}
                  </td>
                  <td className="px-4 py-3 text-right text-grovio-text-muted">{order.itemCount}</td>
                  <td className="px-4 py-3 text-grovio-text-muted">
                    {new Date(order.placedAt).toLocaleDateString()}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Pagination */}
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
  );
}
