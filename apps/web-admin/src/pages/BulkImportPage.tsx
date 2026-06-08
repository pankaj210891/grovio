/**
 * BulkImportPage — bulk product CSV import (Phase 11, T12).
 *
 * Flow:
 *   1. Download CSV template
 *   2. Upload filled CSV file
 *   3. Preview parsed rows (first 10)
 *   4. Confirm to trigger import job
 *   5. Show import result (created / skipped / errors)
 */

import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import { uploadFile } from '../lib/apiClient.js';

interface ImportPreviewRow {
  name: string;
  sku: string;
  categoryName: string;
  vendorEmail: string;
  priceRupees: number;
  stockQuantity: number;
}

interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

type ImportState = 'idle' | 'previewing' | 'uploading' | 'done' | 'error';

const CSV_TEMPLATE_HEADERS =
  'name,sku,category_name,vendor_email,price_rupees,stock_quantity,description';

function downloadTemplate() {
  const blob = new Blob([CSV_TEMPLATE_HEADERS + '\n'], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'product-import-template.csv';
  a.click();
  URL.revokeObjectURL(url);
}

async function parseCsvPreview(file: File): Promise<ImportPreviewRow[]> {
  const text = await file.text();
  const lines = text.split('\n').filter((l) => l.trim());
  if (lines.length < 2) return [];
  const headers = (lines[0] ?? '').split(',').map((h) => h.trim());
  return lines.slice(1, 11).map((line) => {
    const cols = line.split(',').map((c) => c.trim());
    const get = (key: string) => cols[headers.indexOf(key)] ?? '';
    return {
      name: get('name'),
      sku: get('sku'),
      categoryName: get('category_name'),
      vendorEmail: get('vendor_email'),
      priceRupees: parseFloat(get('price_rupees')) || 0,
      stockQuantity: parseInt(get('stock_quantity'), 10) || 0,
    };
  });
}

export function BulkImportPage() {
  const navigate = useNavigate();
  const fileRef = useRef<HTMLInputElement>(null);
  const [state, setState] = useState<ImportState>('idle');
  const [preview, setPreview] = useState<ImportPreviewRow[]>([]);
  const [result, setResult] = useState<ImportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const rows = await parseCsvPreview(file);
      setPreview(rows);
      setState('previewing');
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to parse CSV');
      setState('error');
    }
  }

  async function handleImport() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setState('uploading');
    setError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      const res = await uploadFile<ImportResult>('/admin/catalog/import-csv', formData);
      setResult(res);
      setState('done');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Import failed');
      setState('error');
    }
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-6"
    >
      {/* Header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/catalog-moderation')}
          className="mb-3 text-xs font-medium text-grovio-text-muted hover:text-grovio-text"
        >
          ← Back to Catalog Moderation
        </button>
        <h1 className="text-2xl font-bold text-grovio-text">Bulk Product Import</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Import multiple products at once using a CSV file.
        </p>
      </div>

      {/* Step 1: Download template */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
        <h2 className="mb-2 text-sm font-semibold text-grovio-text">Step 1: Download Template</h2>
        <p className="mb-3 text-xs text-grovio-text-muted">
          Download the CSV template and fill in your product data.
          Required columns: name, sku, category_name, vendor_email, price_rupees, stock_quantity.
        </p>
        <button
          type="button"
          onClick={downloadTemplate}
          className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
        >
          Download CSV Template
        </button>
      </div>

      {/* Step 2: Upload file */}
      <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
        <h2 className="mb-2 text-sm font-semibold text-grovio-text">Step 2: Upload Filled CSV</h2>
        <input
          ref={fileRef}
          type="file"
          accept=".csv,text/csv"
          onChange={(e) => void handleFileChange(e)}
          className="block text-sm text-grovio-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-grovio-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-grovio-primary"
        />
      </div>

      {/* Preview */}
      {state === 'previewing' && preview.length > 0 && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          <div className="flex items-center justify-between border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">
              Preview (showing first {preview.length} rows)
            </h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="border-b border-grovio-border bg-grovio-surface">
                <tr>
                  {['Name', 'SKU', 'Category', 'Vendor Email', 'Price (₹)', 'Stock'].map((h) => (
                    <th
                      key={h}
                      className="px-4 py-2.5 text-left font-semibold uppercase tracking-wide text-grovio-text-muted"
                    >
                      {h}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {preview.map((row, i) => (
                  <tr key={i} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-4 py-2.5 font-medium text-grovio-text">{row.name}</td>
                    <td className="px-4 py-2.5 font-mono text-grovio-text-muted">{row.sku}</td>
                    <td className="px-4 py-2.5 text-grovio-text-muted">{row.categoryName}</td>
                    <td className="px-4 py-2.5 text-grovio-text-muted">{row.vendorEmail}</td>
                    <td className="px-4 py-2.5 text-right text-grovio-text">₹{row.priceRupees}</td>
                    <td className="px-4 py-2.5 text-right text-grovio-text-muted">{row.stockQuantity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="flex justify-end gap-3 border-t border-grovio-border px-5 py-4">
            <button
              type="button"
              onClick={() => { setState('idle'); setPreview([]); if (fileRef.current) fileRef.current.value = ''; }}
              className="rounded-lg border border-grovio-border px-4 py-2 text-sm font-medium text-grovio-text hover:bg-grovio-surface"
            >
              Cancel
            </button>
            <button
              type="button"
              onClick={() => void handleImport()}
              className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
            >
              Confirm Import
            </button>
          </div>
        </div>
      )}

      {/* Uploading state */}
      {state === 'uploading' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-8 text-center">
          <p className="text-sm text-grovio-text-muted">Importing products… this may take a moment.</p>
        </div>
      )}

      {/* Result */}
      {state === 'done' && result && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-6">
          <h2 className="mb-3 text-sm font-semibold text-green-800">Import Complete</h2>
          <div className="grid grid-cols-3 gap-4">
            <div className="text-center">
              <p className="text-2xl font-bold text-green-700">{result.created}</p>
              <p className="text-xs text-green-600">Products created</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-amber-700">{result.skipped}</p>
              <p className="text-xs text-amber-600">Skipped (duplicates)</p>
            </div>
            <div className="text-center">
              <p className="text-2xl font-bold text-red-700">{result.errors.length}</p>
              <p className="text-xs text-red-600">Errors</p>
            </div>
          </div>
          {result.errors.length > 0 && (
            <div className="mt-4 rounded-lg border border-red-200 bg-white p-3">
              <p className="mb-2 text-xs font-semibold text-red-700">Error details:</p>
              <ul className="space-y-1">
                {result.errors.map((e, i) => (
                  <li key={i} className="text-xs text-red-600">
                    Row {e.row}: {e.message}
                  </li>
                ))}
              </ul>
            </div>
          )}
          <button
            type="button"
            onClick={() => navigate('/catalog-moderation')}
            className="mt-4 rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
          >
            Go to Catalog Moderation
          </button>
        </div>
      )}

      {/* Error state */}
      {(state === 'error' || error) && (
        <div className="rounded-xl border border-grovio-error/20 bg-grovio-error/10 p-4">
          <p className="text-sm font-medium text-grovio-error">{error}</p>
        </div>
      )}
    </motion.div>
  );
}
