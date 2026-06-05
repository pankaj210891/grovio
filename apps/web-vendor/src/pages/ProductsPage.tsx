/**
 * Vendor Products page.
 *
 * Lists vendor products via GET /vendor/products.
 * Links to product detail (existing Phase 3 endpoints for edit).
 */

import { motion } from 'motion/react';
import { useQuery } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';

interface Product {
  id: string;
  name: string;
  slug: string;
  status: string;
  basePriceMinor: number;
  createdAt: string;
}

interface ProductsResponse {
  success: boolean;
  data: { products: Product[] };
}

function formatMajor(minorUnits: number, currency = 'INR'): string {
  const major = minorUnits / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
  }).format(major);
}

const STATUS_COLORS: Record<string, string> = {
  active: 'bg-green-100 text-green-700',
  draft: 'bg-gray-100 text-gray-600',
  archived: 'bg-red-100 text-red-600',
  pending_review: 'bg-amber-100 text-amber-700',
};

export default function ProductsPage() {
  const { data, isLoading, error: queryError } = useQuery<Product[]>({
    queryKey: ['vendorProducts'],
    queryFn: async () => {
      const res = await apiClient.get<ProductsResponse>('/vendor/products');
      return res.data.products;
    },
  });

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      {/* Page header */}
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-grovio-text">Products</h1>
          <p className="mt-1 text-sm text-grovio-text-muted">
            Manage your product catalog.
          </p>
        </div>
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
          Failed to load products:{' '}
          {queryError instanceof Error ? queryError.message : 'Unknown error'}
        </div>
      )}

      {/* Products table */}
      {data && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
          {data.length === 0 ? (
            <div className="px-6 py-12 text-center text-sm text-grovio-text-muted">
              No products yet.
            </div>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-grovio-border text-left">
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Name
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Status
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Base Price
                  </th>
                  <th className="px-4 py-3 font-medium text-grovio-text-muted">
                    Created
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-grovio-border">
                {data.map((product) => (
                  <tr key={product.id} className="hover:bg-grovio-surface/50">
                    <td className="px-4 py-3">
                      <div>
                        <p className="font-medium text-grovio-text">
                          {product.name}
                        </p>
                        <p className="text-xs text-grovio-text-muted">
                          {product.slug}
                        </p>
                      </div>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={[
                          'inline-flex rounded-full px-2 py-0.5 text-xs font-medium capitalize',
                          STATUS_COLORS[product.status] ??
                            'bg-gray-100 text-gray-600',
                        ].join(' ')}
                      >
                        {product.status.replace('_', ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-grovio-text">
                      {formatMajor(product.basePriceMinor)}
                    </td>
                    <td className="px-4 py-3 text-grovio-text-muted">
                      {new Date(product.createdAt).toLocaleDateString()}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}
    </motion.div>
  );
}
