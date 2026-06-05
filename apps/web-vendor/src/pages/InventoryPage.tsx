/**
 * Vendor Inventory & Pricing page (VEN-03, D-15).
 *
 * Combined table: product/variant name, quantity_available (editable),
 * quantity_reserved (read-only), base_price_minor (editable).
 *
 * Inline click-to-edit row modal:
 *   PATCH /vendor/inventory/:inventoryItemId  → update qty
 *   PATCH /vendor/products/:productId/pricing  → update price
 *
 * Shows a toast on save. Staff can edit qty only (role enforced by backend).
 */

import React, { useState } from 'react';
import { AnimatePresence, motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import { useVendorAuthStore } from '../stores/vendorAuthStore.js';

interface InventoryItem {
  inventoryItemId: string;
  productId: string;
  variantId: string | null;
  productName: string;
  variantName: string | null;
  quantityAvailable: number;
  quantityReserved: number;
  basePriceMinor: number;
}

interface InventoryResponse {
  success: boolean;
  data: { items: InventoryItem[] };
}

function formatMajor(minorUnits: number, currency = 'INR'): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(minorUnits / 100);
}

export default function InventoryPage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();
  const { role } = useVendorAuthStore();

  const [editItem, setEditItem] = useState<InventoryItem | null>(null);
  const [qty, setQty] = useState('');
  const [price, setPrice] = useState('');

  const canEditPrice = role === 'owner' || role === 'manager';

  const { data, isLoading, error: queryError } = useQuery<InventoryItem[]>({
    queryKey: ['vendorInventory'],
    queryFn: async () => {
      const res = await apiClient.get<InventoryResponse>('/vendor/inventory');
      return res.data.items;
    },
  });

  const updateQtyMutation = useMutation({
    mutationFn: ({ inventoryItemId, quantityAvailable }: { inventoryItemId: string; quantityAvailable: number }) =>
      apiClient.patch(`/vendor/inventory/${inventoryItemId}`, { quantityAvailable }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorInventory'] });
    },
  });

  const updatePriceMutation = useMutation({
    mutationFn: ({ productId, basePriceMinor }: { productId: string; basePriceMinor: number }) =>
      apiClient.patch(`/vendor/products/${productId}/pricing`, { basePriceMinor }),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorInventory'] });
    },
  });

  function openEdit(item: InventoryItem) {
    setEditItem(item);
    setQty(String(item.quantityAvailable));
    setPrice(String(item.basePriceMinor / 100));
  }

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!editItem) return;

    const newQty = parseInt(qty, 10);
    const newPriceMinor = Math.round(parseFloat(price) * 100);

    try {
      const promises: Promise<unknown>[] = [];

      if (newQty !== editItem.quantityAvailable) {
        promises.push(
          updateQtyMutation.mutateAsync({
            inventoryItemId: editItem.inventoryItemId,
            quantityAvailable: newQty,
          }),
        );
      }

      if (canEditPrice && newPriceMinor !== editItem.basePriceMinor) {
        promises.push(
          updatePriceMutation.mutateAsync({
            productId: editItem.productId,
            basePriceMinor: newPriceMinor,
          }),
        );
      }

      await Promise.all(promises);

      addToast({
        id: Date.now().toString(),
        message: 'Inventory updated successfully.',
        variant: 'success',
      });
      setEditItem(null);
    } catch {
      addToast({
        id: Date.now().toString(),
        message: 'Failed to update inventory.',
        variant: 'error',
      });
    }
  }

  const isSaving = updateQtyMutation.isPending || updatePriceMutation.isPending;

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">
          Inventory &amp; Pricing
        </h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Manage stock levels and product pricing.
        </p>
      </div>

      {/* Loading */}
      {isLoading && (
        <div className="flex items-center justify-center py-16">
          <div className="h-8 w-8 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
        </div>
      )}

      {/* Error */}
      {queryError && (
        <div className="rounded-lg border border-grovio-error/20 bg-grovio-error/10 p-4 text-sm text-grovio-error">
          Failed to load inventory:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No inventory items found.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Product / Variant
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Available
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Reserved
                  </th>
                  {canEditPrice && (
                    <th className="px-4 py-3 font-medium text-grovio-text-muted">
                      Price
                    </th>
                  )}
                  <th className="px-4 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {data.map((item) => (
                  <tr key={item.inventoryItemId} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3">
                      <p className="font-medium text-grovio-text">
                        {item.productName}
                      </p>
                      {item.variantName && (
                        <p className="text-xs text-grovio-text-muted">
                          {item.variantName}
                        </p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-grovio-text">
                      {item.quantityAvailable}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {item.quantityReserved}
                    </td>
                    {canEditPrice && (
                      <td className="px-4 py-3 text-grovio-text">
                        {formatMajor(item.basePriceMinor)}
                      </td>
                    )}
                    <td className="px-4 py-3 text-right">
                      <button
                        type="button"
                        onClick={() => openEdit(item)}
                        className="rounded-md px-3 py-1 text-xs font-medium text-grovio-primary transition-colors hover:bg-grovio-primary/10"
                      >
                        Edit
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Edit slide-over */}
      <AnimatePresence>
        {editItem && (
          <>
            <motion.div
              key="backdrop"
              className="fixed inset-0 z-40 bg-black/30"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setEditItem(null)}
            />
            <motion.div
              key="panel"
              className="fixed inset-y-0 right-0 z-50 w-full max-w-md border-l border-grovio-border bg-grovio-surface-raised shadow-xl"
              initial={{ x: '100%' }}
              animate={{ x: 0 }}
              exit={{ x: '100%' }}
              transition={{ type: 'spring', damping: 26, stiffness: 280 }}
            >
              <div className="flex h-full flex-col">
                <div className="flex items-center justify-between border-b border-grovio-border px-6 py-4">
                  <h2 className="text-base font-semibold text-grovio-text">
                    Edit Inventory
                  </h2>
                  <button
                    type="button"
                    onClick={() => setEditItem(null)}
                    className="text-grovio-text-muted transition-colors hover:text-grovio-text"
                    aria-label="Close"
                  >
                    ✕
                  </button>
                </div>

                <form
                  onSubmit={(e) => void handleSave(e)}
                  className="flex flex-1 flex-col gap-5 overflow-y-auto px-6 py-6"
                >
                  <div>
                    <p className="text-sm font-medium text-grovio-text">
                      {editItem.productName}
                    </p>
                    {editItem.variantName && (
                      <p className="text-xs text-grovio-text-muted">
                        Variant: {editItem.variantName}
                      </p>
                    )}
                  </div>

                  <div>
                    <label
                      htmlFor="qty"
                      className="mb-1 block text-sm font-medium text-grovio-text"
                    >
                      Available quantity <span className="text-grovio-error">*</span>
                    </label>
                    <input
                      id="qty"
                      type="number"
                      min={0}
                      required
                      value={qty}
                      onChange={(e) => setQty(e.target.value)}
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-sm font-medium text-grovio-text-muted">
                      Reserved (read-only)
                    </label>
                    <input
                      type="number"
                      value={editItem.quantityReserved}
                      readOnly
                      className="w-full rounded-lg border border-grovio-border bg-grovio-surface/50 px-3 py-2 text-sm text-grovio-text-muted"
                    />
                  </div>

                  {canEditPrice && (
                    <div>
                      <label
                        htmlFor="price"
                        className="mb-1 block text-sm font-medium text-grovio-text"
                      >
                        Base price (major units) <span className="text-grovio-error">*</span>
                      </label>
                      <input
                        id="price"
                        type="number"
                        min={0}
                        step={0.01}
                        required
                        value={price}
                        onChange={(e) => setPrice(e.target.value)}
                        className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                      />
                    </div>
                  )}

                  <div className="mt-auto flex gap-3">
                    <button
                      type="button"
                      onClick={() => setEditItem(null)}
                      className="flex-1 rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text transition-colors hover:bg-grovio-surface"
                    >
                      Cancel
                    </button>
                    <button
                      type="submit"
                      disabled={isSaving}
                      className="flex-1 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {isSaving ? 'Saving…' : 'Save'}
                    </button>
                  </div>
                </form>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
