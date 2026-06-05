/**
 * Vendor Earnings & Payouts page (MKT-05, D-09).
 *
 * GET /vendor/earnings → VendorEarningsResponse
 * Shows:
 *   - Highlighted Outstanding Balance card
 *   - Summary strip (earned, reversed, net, settled)
 *   - Commission ledger table
 *   - Settlements received table
 *
 * All money in major units (divide minor by 100).
 */

import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import type { VendorEarningsResponse } from '@grovio/contracts';

interface EarningsApiResponse {
  success: boolean;
  data: VendorEarningsResponse;
}

function formatMajor(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

interface SummaryCardProps {
  label: string;
  value: string;
  highlight?: boolean;
  muted?: boolean;
}

function SummaryCard({ label, value, highlight, muted }: SummaryCardProps) {
  return (
    <div
      className={[
        'rounded-xl border p-5',
        highlight
          ? 'border-grovio-primary/40 bg-grovio-primary/8 shadow-sm'
          : muted
            ? 'border-grovio-border bg-grovio-surface'
            : 'border-grovio-border bg-grovio-surface-raised',
      ].join(' ')}
    >
      <p className="text-xs font-medium uppercase tracking-wider text-grovio-text-muted">
        {label}
      </p>
      <p
        className={[
          'mt-2 text-2xl font-bold',
          highlight ? 'text-grovio-primary' : 'text-grovio-text',
        ].join(' ')}
      >
        {value}
      </p>
    </div>
  );
}

export default function EarningsPage() {
  const { data, isLoading, error: queryError } = useQuery<VendorEarningsResponse>({
    queryKey: ['vendorEarnings'],
    queryFn: async () => {
      const res = await apiClient.get<EarningsApiResponse>('/vendor/earnings');
      return res.data;
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Earnings &amp; Payouts</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Your commission ledger and settlement history.
        </p>
      </div>

      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load earnings:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <>
          {/* Summary cards */}
          <div className="mb-6 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-5">
            <div className="lg:col-span-2">
              <SummaryCard
                label="Outstanding Balance"
                value={formatMajor(data.summary.outstandingBalanceMinor)}
                highlight
              />
            </div>
            <SummaryCard
              label="Total Earned"
              value={formatMajor(data.summary.totalEarnedMinor)}
            />
            <SummaryCard
              label="Reversed"
              value={formatMajor(data.summary.totalReversedMinor)}
              muted
            />
            <SummaryCard
              label="Total Settled"
              value={formatMajor(data.summary.totalSettledMinor)}
            />
          </div>

          {/* Commission ledger */}
          <section className="mb-6">
            <h2 className="mb-3 text-sm font-semibold text-grovio-text">
              Commission Ledger
            </h2>
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              {data.commissionEntries.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                  No commission entries yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Order</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Status</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Rate</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Subtotal</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Commission</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.commissionEntries.map((entry) => (
                      <tr key={entry.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {new Date(entry.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                          {entry.orderDisplayId}
                        </td>
                        <td className="px-4 py-3">
                          <span
                            className={[
                              'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                              entry.status === 'earned'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-red-100 text-red-600',
                            ].join(' ')}
                          >
                            {entry.status}
                          </span>
                        </td>
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {entry.ratePercent}%
                        </td>
                        <td className="px-4 py-3 text-grovio-text">
                          {formatMajor(entry.subtotalMinor)}
                        </td>
                        <td
                          className={[
                            'px-4 py-3 font-medium',
                            entry.status === 'reversed'
                              ? 'text-grovio-error'
                              : 'text-grovio-text',
                          ].join(' ')}
                        >
                          {entry.status === 'reversed' ? '-' : ''}
                          {formatMajor(entry.commissionAmountMinor)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>

          {/* Settlements */}
          <section>
            <h2 className="mb-3 text-sm font-semibold text-grovio-text">
              Settlements Received
            </h2>
            <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
              {data.settlements.length === 0 ? (
                <p className="px-6 py-8 text-center text-sm text-grovio-text-muted">
                  No settlements recorded yet.
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-grovio-border text-left">
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Date</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Amount</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Reference</th>
                      <th className="px-4 py-3 font-medium text-grovio-text-muted">Note</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-grovio-border">
                    {data.settlements.map((s) => (
                      <tr key={s.id} className="hover:bg-grovio-surface/50">
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {new Date(s.settledAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3 font-medium text-green-700">
                          {formatMajor(s.amountMinor)}
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-grovio-text">
                          {s.settlementReference}
                        </td>
                        <td className="px-4 py-3 text-grovio-text-muted">
                          {s.note ?? '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </section>
        </>
      )}
    </motion.div>
  );
}
