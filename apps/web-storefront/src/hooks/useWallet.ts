/**
 * Wallet hook — customer wallet balance and ledger via React Query (WAL-01/02).
 *
 * GET /account/wallet returns { balanceMinor, entries[] } in one round trip
 * (WalletLedgerResponseSchema — avoids two-round-trip pattern per 05-01 decision).
 *
 * GET /account/wallet/entries returns paginated ledger entries.
 */

import { useQuery } from '@tanstack/react-query';
import { apiClient, ApiError } from '../lib/api-client.js';
import type { WalletLedgerResponse, WalletEntry } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface WalletResponse {
  success: boolean;
  data: WalletLedgerResponse;
}

interface WalletEntriesResponse {
  success: boolean;
  data: { entries: WalletEntry[] };
}

// ---------------------------------------------------------------------------
// Query keys
// ---------------------------------------------------------------------------

export const WALLET_KEY = ['wallet'] as const;
export const WALLET_ENTRIES_KEY = ['wallet', 'entries'] as const;

// ---------------------------------------------------------------------------
// useWallet — GET /account/wallet (WAL-01: balance + WAL-02: ledger)
// ---------------------------------------------------------------------------

export function useWallet() {
  return useQuery<WalletLedgerResponse | null>({
    queryKey: WALLET_KEY,
    queryFn: async () => {
      try {
        const res = await apiClient.get<WalletResponse>('/account/wallet');
        return res.data;
      } catch (err: unknown) {
        if (err instanceof ApiError && err.status === 401) return null;
        throw err;
      }
    },
    staleTime: 1000 * 30,
    retry: false,
  });
}

// ---------------------------------------------------------------------------
// useWalletEntries — GET /account/wallet/entries (WAL-02: ledger entries)
// ---------------------------------------------------------------------------

export function useWalletEntries() {
  return useQuery<WalletEntry[]>({
    queryKey: WALLET_ENTRIES_KEY,
    queryFn: async () => {
      const res = await apiClient.get<WalletEntriesResponse>('/account/wallet/entries');
      return res.data.entries;
    },
    staleTime: 1000 * 30,
    retry: false,
  });
}
