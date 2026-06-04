/**
 * WalletPage — /account/wallet (WAL-01, WAL-02)
 *
 * Displays:
 * - Wallet balance (WAL-01)
 * - Ledger table: credits/debits with type and reference (WAL-02)
 * - Loading skeletons / empty / error states (AddressesPage analog)
 */

import { PageTransition } from '../../components/layout/PageTransition.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { useWallet } from '../../hooks/useWallet.js';
import type { WalletEntryType } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatMinor(minor: number): string {
  return `₹${(minor / 100).toFixed(2)}`;
}

function formatDate(isoString: string): string {
  return new Date(isoString).toLocaleDateString('en-IN', {
    day: 'numeric', month: 'short', year: 'numeric',
  });
}

const ENTRY_TYPE_LABELS: Record<WalletEntryType, string> = {
  credit: 'Credit',
  debit: 'Debit (checkout)',
  refund_credit: 'Refund credit',
};

const ENTRY_TYPE_COLORS: Record<WalletEntryType, string> = {
  credit: 'text-green-600',
  debit: 'text-grovio-text',
  refund_credit: 'text-green-600',
};

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function WalletPage() {
  const { data: walletData, isLoading, isError } = useWallet();

  const balanceMinor = walletData?.balanceMinor ?? 0;
  const entries = walletData?.entries ?? [];

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <h1 className="text-xl font-semibold text-grovio-text mb-8">My Wallet</h1>

        {/* Loading */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading wallet…" className="flex flex-col gap-4">
            <Skeleton className="h-24 w-full max-w-xs rounded-lg" />
            {[1, 2, 3].map((i) => <Skeleton key={i} className="h-12 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your wallet. Please refresh and try again.
          </p>
        )}

        {/* Content */}
        {!isLoading && !isError && (
          <div className="flex flex-col gap-8">
            {/* Balance card (WAL-01) */}
            <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-6 max-w-xs">
              <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide mb-1">
                Available balance
              </p>
              <p className="text-3xl font-bold text-grovio-text">{formatMinor(balanceMinor)}</p>
            </div>

            {/* Ledger table (WAL-02) */}
            <div>
              <h2 className="text-sm font-semibold text-grovio-text mb-4">Transaction history</h2>

              {/* Empty */}
              {entries.length === 0 && (
                <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-8 text-center">
                  <p className="text-sm text-grovio-text-muted">No transactions yet.</p>
                </div>
              )}

              {/* Entries */}
              {entries.length > 0 && (
                <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised overflow-hidden">
                  {/* Table header */}
                  <div className="grid grid-cols-[1fr,auto,auto] gap-4 px-4 py-2 bg-grovio-surface text-xs font-semibold text-grovio-text-muted uppercase tracking-wide border-b border-grovio-border">
                    <span>Description</span>
                    <span>Date</span>
                    <span className="text-right">Amount</span>
                  </div>

                  {/* Entry rows */}
                  {entries.map((entry) => {
                    const isCredit = entry.entryType === 'credit' || entry.entryType === 'refund_credit';
                    return (
                      <div
                        key={entry.id}
                        className="grid grid-cols-[1fr,auto,auto] gap-4 px-4 py-3 border-b border-grovio-border last:border-b-0 items-center"
                      >
                        <div>
                          <p className="text-sm text-grovio-text">
                            {ENTRY_TYPE_LABELS[entry.entryType]}
                          </p>
                          {entry.referenceId && (
                            <p className="text-xs text-grovio-text-muted">
                              Ref: {entry.referenceType} · {entry.referenceId.slice(0, 8)}…
                            </p>
                          )}
                        </div>
                        <p className="text-xs text-grovio-text-muted whitespace-nowrap">
                          {formatDate(entry.createdAt)}
                        </p>
                        <p
                          className={[
                            'text-sm font-medium text-right whitespace-nowrap',
                            ENTRY_TYPE_COLORS[entry.entryType],
                          ].join(' ')}
                        >
                          {isCredit ? '+' : '-'}{formatMinor(entry.amountMinor)}
                        </p>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
