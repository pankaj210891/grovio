/**
 * VendorProfilePage — vendor detail + KYC + onboarding checklist + payouts (Phase 11, T7).
 *
 * Tabs:
 *   1. Overview — business info, onboarding checklist, status actions
 *   2. KYC Documents — list uploaded docs, verify/reject per doc, upload new
 *   3. Payouts — payout history for this vendor
 */

import { motion } from 'framer-motion';
import { useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { get, post, uploadFile } from '../lib/apiClient.js';

type Tab = 'overview' | 'kyc' | 'payouts';

interface VendorProfile {
  id: string;
  businessName: string;
  email: string;
  phone: string | null;
  status: string;
  kycStatus: string;
  gmv: number;
  productCount: number;
  avgRating: number;
  createdAt: string;
  onboardingChecklist: {
    profileComplete: boolean;
    bankAdded: boolean;
    kycSubmitted: boolean;
    firstProductListed: boolean;
    firstOrderFulfilled: boolean;
  };
}

interface KycDocument {
  id: string;
  documentType: string;
  fileUrl: string;
  uploadedAt: string;
  verifiedAt: string | null;
  verifiedByAdminEmail: string | null;
}

interface Payout {
  id: string;
  amount: number;
  status: string;
  method: string;
  createdAt: string;
}

interface PayoutListResponse {
  items: Payout[];
  total: number;
}

const TABS: { value: Tab; label: string }[] = [
  { value: 'overview', label: 'Overview' },
  { value: 'kyc', label: 'KYC Documents' },
  { value: 'payouts', label: 'Payouts' },
];

function formatInr(minor: number): string {
  return `₹${(minor / 100).toLocaleString('en-IN', { minimumFractionDigits: 0 })}`;
}

function ChecklistItem({ label, done }: { label: string; done: boolean }) {
  return (
    <div className="flex items-center gap-2.5 py-1.5">
      <span
        className={[
          'flex h-5 w-5 items-center justify-center rounded-full text-[11px] font-bold',
          done ? 'bg-green-500 text-white' : 'border border-grovio-border text-grovio-text-muted bg-grovio-surface',
        ].join(' ')}
      >
        {done ? '✓' : '○'}
      </span>
      <span className={['text-sm', done ? 'text-grovio-text' : 'text-grovio-text-muted'].join(' ')}>
        {label}
      </span>
    </div>
  );
}

export function VendorProfilePage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState<Tab>('overview');
  const [uploadDocType, setUploadDocType] = useState('id_proof');
  const [uploadError, setUploadError] = useState<string | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);

  const { data: vendor, isLoading: vendorLoading } = useQuery<VendorProfile>({
    queryKey: ['admin', 'vendor', id],
    queryFn: () => get<VendorProfile>(`/admin/vendors/${id}`),
    enabled: Boolean(id),
  });

  const { data: kycDocs = [], isLoading: kycLoading } = useQuery<KycDocument[]>({
    queryKey: ['admin', 'vendor', id, 'kyc'],
    queryFn: () => get<KycDocument[]>(`/admin/vendors/${id}/kyc-documents`),
    enabled: tab === 'kyc' && Boolean(id),
  });

  const { data: payouts } = useQuery<PayoutListResponse>({
    queryKey: ['admin', 'vendor', id, 'payouts'],
    queryFn: () => get<PayoutListResponse>(`/admin/vendors/${id}/payouts?pageSize=20`),
    enabled: tab === 'payouts' && Boolean(id),
  });

  const statusMutation = useMutation({
    mutationFn: (status: 'active' | 'suspended') =>
      post(`/admin/vendors/${id}/status`, { status }),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'vendor', id] }),
  });

  const verifyDocMutation = useMutation({
    mutationFn: ({ docId, action }: { docId: string; action: 'verify' | 'reject' }) =>
      post(`/admin/vendors/${id}/kyc-documents/${docId}/${action}`, {}),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: ['admin', 'vendor', id, 'kyc'] }),
  });

  async function handleUploadDoc() {
    const file = fileRef.current?.files?.[0];
    if (!file) return;
    setUploadError(null);
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('documentType', uploadDocType);
      await uploadFile(`/admin/vendors/${id}/kyc-documents/upload`, formData);
      void queryClient.invalidateQueries({ queryKey: ['admin', 'vendor', id, 'kyc'] });
      if (fileRef.current) fileRef.current.value = '';
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : 'Upload failed');
    }
  }

  if (vendorLoading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <p className="text-sm text-grovio-text-muted">Loading vendor…</p>
      </div>
    );
  }

  if (!vendor) {
    return (
      <div className="flex h-64 flex-col items-center justify-center gap-3">
        <p className="text-sm text-grovio-text-muted">Vendor not found.</p>
        <button
          type="button"
          onClick={() => navigate('/vendors')}
          className="text-xs font-medium text-grovio-primary hover:underline"
        >
          Back to Vendors
        </button>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className="space-y-5"
    >
      {/* Back + header */}
      <div>
        <button
          type="button"
          onClick={() => navigate('/vendors')}
          className="mb-3 text-xs font-medium text-grovio-text-muted hover:text-grovio-text"
        >
          ← Back to Vendors
        </button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold text-grovio-text">{vendor.businessName}</h1>
            <p className="mt-0.5 text-sm text-grovio-text-muted">{vendor.email}</p>
          </div>
          <div className="flex items-center gap-2">
            <span className={[
              'rounded-full px-3 py-1 text-xs font-bold capitalize',
              vendor.status === 'active' ? 'bg-green-100 text-green-700'
              : vendor.status === 'pending' ? 'bg-amber-100 text-amber-700'
              : 'bg-red-100 text-red-700',
            ].join(' ')}>
              {vendor.status}
            </span>
            {vendor.status !== 'active' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate('active')}
                disabled={statusMutation.isPending}
                className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
              >
                Approve
              </button>
            )}
            {vendor.status !== 'suspended' && (
              <button
                type="button"
                onClick={() => statusMutation.mutate('suspended')}
                disabled={statusMutation.isPending}
                className="rounded-lg border border-grovio-error px-3 py-1.5 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
              >
                Suspend
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Quick stat row */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        {[
          { label: 'GMV', value: formatInr(vendor.gmv) },
          { label: 'Products', value: String(vendor.productCount) },
          { label: 'Avg Rating', value: vendor.avgRating != null ? vendor.avgRating.toFixed(1) : '—' },
          { label: 'KYC Status', value: vendor.kycStatus?.replace(/_/g, ' ') ?? '—' },
        ].map(({ label, value }) => (
          <div key={label} className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-4">
            <p className="text-xs font-medium uppercase tracking-wide text-grovio-text-muted">{label}</p>
            <p className="mt-1 text-lg font-bold capitalize text-grovio-text">{value}</p>
          </div>
        ))}
      </div>

      {/* Tabs */}
      <div className="border-b border-grovio-border">
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.value}
              type="button"
              onClick={() => setTab(t.value)}
              className={[
                'px-4 py-2 text-sm font-medium transition-colors border-b-2',
                tab === t.value
                  ? 'border-grovio-primary text-grovio-primary'
                  : 'border-transparent text-grovio-text-muted hover:text-grovio-text',
              ].join(' ')}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      {/* Tab content */}
      {tab === 'overview' && (
        <div className="grid grid-cols-1 gap-5 lg:grid-cols-2">
          {/* Business info */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h2 className="mb-4 text-sm font-semibold text-grovio-text">Business Info</h2>
            <dl className="space-y-3">
              {[
                { label: 'Business Name', value: vendor.businessName },
                { label: 'Email', value: vendor.email },
                { label: 'Phone', value: vendor.phone ?? '—' },
                { label: 'Member Since', value: new Date(vendor.createdAt).toLocaleDateString() },
              ].map(({ label, value }) => (
                <div key={label} className="flex justify-between gap-3 text-sm">
                  <dt className="font-medium text-grovio-text-muted">{label}</dt>
                  <dd className="text-right text-grovio-text">{value}</dd>
                </div>
              ))}
            </dl>
          </div>

          {/* Onboarding checklist */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h2 className="mb-3 text-sm font-semibold text-grovio-text">Onboarding Checklist</h2>
            <ChecklistItem label="Profile complete" done={vendor.onboardingChecklist.profileComplete} />
            <ChecklistItem label="Bank account added" done={vendor.onboardingChecklist.bankAdded} />
            <ChecklistItem label="KYC submitted" done={vendor.onboardingChecklist.kycSubmitted} />
            <ChecklistItem label="First product listed" done={vendor.onboardingChecklist.firstProductListed} />
            <ChecklistItem label="First order fulfilled" done={vendor.onboardingChecklist.firstOrderFulfilled} />
          </div>
        </div>
      )}

      {tab === 'kyc' && (
        <div className="space-y-4">
          {/* Upload new document */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-5">
            <h2 className="mb-4 text-sm font-semibold text-grovio-text">Upload KYC Document</h2>
            <div className="flex flex-wrap items-end gap-3">
              <div>
                <label htmlFor="docType" className="mb-1 block text-xs font-medium text-grovio-text-muted">
                  Document type
                </label>
                <select
                  id="docType"
                  value={uploadDocType}
                  onChange={(e) => setUploadDocType(e.target.value)}
                  className="rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                >
                  <option value="id_proof">ID Proof</option>
                  <option value="gst_certificate">GST Certificate</option>
                  <option value="bank_verification">Bank Verification</option>
                </select>
              </div>
              <div>
                <input
                  ref={fileRef}
                  type="file"
                  accept="image/*,application/pdf"
                  className="block text-sm text-grovio-text-muted file:mr-3 file:rounded-lg file:border-0 file:bg-grovio-primary/10 file:px-3 file:py-1.5 file:text-xs file:font-medium file:text-grovio-primary"
                />
              </div>
              <button
                type="button"
                onClick={() => void handleUploadDoc()}
                className="rounded-lg bg-grovio-primary px-4 py-2 text-sm font-medium text-white hover:opacity-90"
              >
                Upload
              </button>
            </div>
            {uploadError && (
              <p className="mt-2 text-xs text-grovio-error">{uploadError}</p>
            )}
          </div>

          {/* Documents list */}
          <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised">
            <div className="border-b border-grovio-border px-5 py-4">
              <h2 className="text-sm font-semibold text-grovio-text">Submitted Documents</h2>
            </div>
            {kycLoading ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
            ) : kycDocs.length === 0 ? (
              <p className="py-8 text-center text-sm text-grovio-text-muted">No documents submitted yet.</p>
            ) : (
              <div className="divide-y divide-grovio-border">
                {kycDocs.map((doc) => (
                  <div key={doc.id} className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
                    <div>
                      <p className="text-sm font-medium capitalize text-grovio-text">
                        {doc.documentType?.replace(/_/g, ' ') ?? '—'}
                      </p>
                      <p className="text-xs text-grovio-text-muted">
                        Uploaded {new Date(doc.uploadedAt).toLocaleDateString()}
                        {doc.verifiedAt && ` · Verified ${new Date(doc.verifiedAt).toLocaleDateString()}`}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <a
                        href={doc.fileUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="text-xs font-medium text-grovio-primary hover:underline"
                      >
                        View
                      </a>
                      {!doc.verifiedAt && (
                        <>
                          <button
                            type="button"
                            onClick={() => verifyDocMutation.mutate({ docId: doc.id, action: 'verify' })}
                            disabled={verifyDocMutation.isPending}
                            className="rounded-lg bg-green-600 px-2.5 py-1 text-xs font-medium text-white hover:opacity-90 disabled:opacity-60"
                          >
                            Verify
                          </button>
                          <button
                            type="button"
                            onClick={() => verifyDocMutation.mutate({ docId: doc.id, action: 'reject' })}
                            disabled={verifyDocMutation.isPending}
                            className="rounded-lg border border-grovio-error px-2.5 py-1 text-xs font-medium text-grovio-error hover:bg-grovio-error/5 disabled:opacity-60"
                          >
                            Reject
                          </button>
                        </>
                      )}
                      {doc.verifiedAt && (
                        <span className="rounded-full bg-green-100 px-2 py-0.5 text-[10px] font-bold text-green-700">
                          Verified
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {tab === 'payouts' && (
        <div className="rounded-xl border border-grovio-border bg-grovio-surface-raised overflow-hidden">
          <div className="border-b border-grovio-border px-5 py-4">
            <h2 className="text-sm font-semibold text-grovio-text">Payout History</h2>
          </div>
          {!payouts ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">Loading…</p>
          ) : payouts.items.length === 0 ? (
            <p className="py-8 text-center text-sm text-grovio-text-muted">No payouts yet.</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="border-b border-grovio-border bg-grovio-surface">
                <tr>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Date</th>
                  <th className="px-5 py-3 text-right text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Amount</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Method</th>
                  <th className="px-5 py-3 text-left text-xs font-semibold uppercase tracking-wide text-grovio-text-muted">Status</th>
                </tr>
              </thead>
              <tbody>
                {payouts.items.map((p) => (
                  <tr key={p.id} className="border-b border-grovio-border/50 hover:bg-grovio-surface">
                    <td className="px-5 py-3 text-grovio-text-muted">
                      {new Date(p.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-5 py-3 text-right font-medium text-grovio-text">{formatInr(p.amount)}</td>
                    <td className="px-5 py-3 capitalize text-grovio-text-muted">{p.method}</td>
                    <td className="px-5 py-3">
                      <span className={[
                        'rounded-full px-2 py-0.5 text-[10px] font-bold capitalize',
                        p.status === 'paid' ? 'bg-green-100 text-green-700'
                        : p.status === 'pending' ? 'bg-amber-100 text-amber-700'
                        : 'bg-red-100 text-red-700',
                      ].join(' ')}>
                        {p.status}
                      </span>
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
