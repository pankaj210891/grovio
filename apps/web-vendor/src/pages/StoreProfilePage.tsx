/**
 * Vendor Store Profile page — enhanced (Plan 11-03, T7).
 *
 * Sections:
 *   1. Store profile — name, description, logo upload, banner upload, contact
 *   2. Social links — Instagram, Facebook, website URL
 *   3. Return policy — markdown-capable text editor
 *   4. Store hours — per-day open/close/closed toggle
 *   5. Payout info — banking details (unchanged from v1)
 */

import React, { useEffect, useRef, useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import type { VendorStoreProfile, VendorPayoutInfo } from '@grovio/contracts';

// ── Types ─────────────────────────────────────────────────────────────────────

interface ProfileResponse {
  success: boolean;
  data: VendorStoreProfile & {
    instagramHandle?: string | null;
    facebookUrl?: string | null;
    websiteUrl?: string | null;
    returnPolicy?: string | null;
    storeHours?: StoreHoursMap | null;
  };
}

interface PayoutInfoResponse {
  success: boolean;
  data: VendorPayoutInfo | null;
}

interface UploadResponse {
  success: boolean;
  data: { url: string };
}

interface StoreHoursDay {
  open: string;  // HH:MM
  close: string; // HH:MM
  closed: boolean;
}

type StoreHoursMap = Record<string, StoreHoursDay>;

const DAYS = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const DEFAULT_HOURS: StoreHoursMap = Object.fromEntries(
  DAYS.map((d, i) => [d, { open: '09:00', close: '18:00', closed: i >= 5 }]),
) as StoreHoursMap;

// ── Sub-components ────────────────────────────────────────────────────────────

interface ImageUploadFieldProps {
  label: string;
  id: string;
  value: string;
  onChange: (url: string) => void;
  hint?: string;
  aspect?: string;
}

function ImageUploadField({ label, id, value, onChange, hint, aspect }: ImageUploadFieldProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const { addToast } = useUiStore();
  const [uploading, setUploading] = useState(false);

  async function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    if (file.size > 4 * 1024 * 1024) {
      addToast({ id: Date.now().toString(), message: 'Image must be under 4 MB.', variant: 'error' });
      return;
    }
    const form = new FormData();
    form.append('file', file);
    setUploading(true);
    try {
      const res = await apiClient.post<UploadResponse>('/vendor/profile/upload-image', form);
      onChange(res.url);
    } catch {
      addToast({ id: Date.now().toString(), message: 'Upload failed. Try again.', variant: 'error' });
    } finally {
      setUploading(false);
      if (fileRef.current) fileRef.current.value = '';
    }
  }

  return (
    <div>
      <label className="mb-1 block text-sm font-medium text-grovio-text">{label}</label>
      <div className="flex items-start gap-3">
        {value ? (
          <div className={`relative shrink-0 overflow-hidden rounded-lg border border-grovio-border bg-grovio-surface ${aspect ?? 'h-16 w-16'}`}>
            <img src={value} alt={label} className="h-full w-full object-cover" />
          </div>
        ) : (
          <div className={`flex shrink-0 items-center justify-center rounded-lg border-2 border-dashed border-grovio-border bg-grovio-surface text-grovio-text-muted ${aspect ?? 'h-16 w-16'}`}>
            <span className="text-xs">No image</span>
          </div>
        )}
        <div className="flex-1 space-y-2">
          <input
            id={`${id}-url`}
            type="url"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder="https://…"
            className="w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1.5 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none"
          />
          <div className="flex items-center gap-2">
            <button
              type="button"
              disabled={uploading}
              onClick={() => fileRef.current?.click()}
              className="rounded-lg border border-grovio-border bg-grovio-surface px-3 py-1 text-xs font-medium text-grovio-text hover:bg-grovio-surface-raised disabled:cursor-not-allowed disabled:opacity-60"
            >
              {uploading ? 'Uploading…' : 'Upload file'}
            </button>
            {value && (
              <button
                type="button"
                onClick={() => onChange('')}
                className="text-xs text-grovio-error hover:underline"
              >
                Remove
              </button>
            )}
          </div>
          {hint && <p className="text-xs text-grovio-text-muted">{hint}</p>}
        </div>
      </div>
      <input
        ref={fileRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="sr-only"
        onChange={(e) => void handleFileChange(e)}
      />
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function StoreProfilePage() {
  const queryClient = useQueryClient();
  const { addToast } = useUiStore();

  // ── Profile form state
  const [storeName, setStoreName] = useState('');
  const [storeDescription, setStoreDescription] = useState('');
  const [logoUrl, setLogoUrl] = useState('');
  const [bannerUrl, setBannerUrl] = useState('');
  const [contactEmail, setContactEmail] = useState('');
  const [contactPhone, setContactPhone] = useState('');
  const [address, setAddress] = useState('');

  // ── Social links
  const [instagramHandle, setInstagramHandle] = useState('');
  const [facebookUrl, setFacebookUrl] = useState('');
  const [websiteUrl, setWebsiteUrl] = useState('');

  // ── Return policy
  const [returnPolicy, setReturnPolicy] = useState('');

  // ── Store hours
  const [storeHours, setStoreHours] = useState<StoreHoursMap>(DEFAULT_HOURS);

  // ── Payout form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscOrRoutingCode, setIfscOrRoutingCode] = useState('');
  const [bankName, setBankName] = useState('');

  // ── Queries
  const { data: profileData, isLoading: profileLoading } = useQuery({
    queryKey: ['vendorProfile'],
    queryFn: async () => {
      const res = await apiClient.get<ProfileResponse>('/vendor/profile');
      return res.data;
    },
  });

  const { data: payoutData, isLoading: payoutLoading } = useQuery<VendorPayoutInfo | null>({
    queryKey: ['vendorPayoutInfo'],
    queryFn: async () => {
      const res = await apiClient.get<PayoutInfoResponse>('/vendor/profile/payout-info');
      return res.data;
    },
  });

  // Populate profile form
  useEffect(() => {
    if (profileData) {
      setStoreName(profileData.storeName ?? '');
      setStoreDescription(profileData.storeDescription ?? '');
      setLogoUrl(profileData.logoUrl ?? '');
      setBannerUrl(profileData.bannerUrl ?? '');
      setContactEmail(profileData.contactEmail ?? '');
      setContactPhone(profileData.contactPhone ?? '');
      setAddress(profileData.address ?? '');
      setInstagramHandle(profileData.instagramHandle ?? '');
      setFacebookUrl(profileData.facebookUrl ?? '');
      setWebsiteUrl(profileData.websiteUrl ?? '');
      setReturnPolicy(profileData.returnPolicy ?? '');
      if (profileData.storeHours) setStoreHours(profileData.storeHours);
    }
  }, [profileData]);

  // Populate payout form
  useEffect(() => {
    if (payoutData) {
      setAccountHolderName(payoutData.accountHolderName);
      setBankAccountNumber(payoutData.bankAccountNumber);
      setIfscOrRoutingCode(payoutData.ifscOrRoutingCode);
      setBankName(payoutData.bankName);
    }
  }, [payoutData]);

  // ── Mutations
  const profileMutation = useMutation({
    mutationFn: (body: Record<string, unknown>) => apiClient.patch('/vendor/profile', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorProfile'] });
      addToast({ id: Date.now().toString(), message: 'Store profile saved.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to save profile.', variant: 'error' });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (body: Record<string, string>) => apiClient.patch('/vendor/profile/payout-info', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorPayoutInfo'] });
      addToast({ id: Date.now().toString(), message: 'Payout info saved.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to save payout info.', variant: 'error' });
    },
  });

  function handleProfileSubmit(e: React.FormEvent) {
    e.preventDefault();
    profileMutation.mutate({
      storeName: storeName.trim() || null,
      storeDescription: storeDescription.trim() || null,
      logoUrl: logoUrl.trim() || null,
      bannerUrl: bannerUrl.trim() || null,
      contactEmail: contactEmail.trim() || null,
      contactPhone: contactPhone.trim() || null,
      address: address.trim() || null,
      instagramHandle: instagramHandle.trim() || null,
      facebookUrl: facebookUrl.trim() || null,
      websiteUrl: websiteUrl.trim() || null,
      returnPolicy: returnPolicy.trim() || null,
      storeHours,
    });
  }

  function handlePayoutSubmit(e: React.FormEvent) {
    e.preventDefault();
    payoutMutation.mutate({
      accountHolderName: accountHolderName.trim(),
      bankAccountNumber: bankAccountNumber.trim(),
      ifscOrRoutingCode: ifscOrRoutingCode.trim(),
      bankName: bankName.trim(),
    });
  }

  function updateHours(day: string, field: keyof StoreHoursDay, value: string | boolean) {
    setStoreHours((prev) => ({
      ...prev,
      [day]: { ...prev[day], [field]: value },
    }));
  }

  const inputClass =
    'w-full rounded-lg border border-grovio-border bg-grovio-surface px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:border-grovio-primary focus:outline-none';
  const labelClass = 'mb-1 block text-sm font-medium text-grovio-text';

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
    >
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-grovio-text">Store Profile</h1>
        <p className="mt-1 text-sm text-grovio-text-muted">
          Configure your public store information, hours, and payout details.
        </p>
      </div>

      <div className="space-y-8">
        {/* ── Section 1: Store Info ────────────────────────────────────────── */}
        <section>
          <h2 className="mb-4 text-base font-semibold text-grovio-text">
            Public Store Information
          </h2>
          {profileLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : (
            <form
              onSubmit={handleProfileSubmit}
              className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6 space-y-6"
            >
              {/* Basic info */}
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="store-name" className={labelClass}>Store name</label>
                  <input
                    id="store-name"
                    type="text"
                    value={storeName}
                    onChange={(e) => setStoreName(e.target.value)}
                    placeholder="My Awesome Store"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="store-desc" className={labelClass}>Store description</label>
                  <textarea
                    id="store-desc"
                    rows={3}
                    value={storeDescription}
                    onChange={(e) => setStoreDescription(e.target.value)}
                    placeholder="Tell customers about your store…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={labelClass}>Contact email</label>
                  <input
                    id="contact-email"
                    type="email"
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    placeholder="hello@mystore.com"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-phone" className={labelClass}>Contact phone</label>
                  <input
                    id="contact-phone"
                    type="tel"
                    value={contactPhone}
                    onChange={(e) => setContactPhone(e.target.value)}
                    placeholder="+91 98765 43210"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="address" className={labelClass}>Store address</label>
                  <input
                    id="address"
                    type="text"
                    value={address}
                    onChange={(e) => setAddress(e.target.value)}
                    placeholder="123 Main St, City, Country"
                    className={inputClass}
                  />
                </div>
              </div>

              {/* Image uploads */}
              <div className="grid grid-cols-1 gap-5 sm:grid-cols-2">
                <ImageUploadField
                  label="Store logo"
                  id="logo"
                  value={logoUrl}
                  onChange={setLogoUrl}
                  hint="Square, min 200×200 px, max 4 MB"
                  aspect="h-16 w-16"
                />
                <ImageUploadField
                  label="Store banner"
                  id="banner"
                  value={bannerUrl}
                  onChange={setBannerUrl}
                  hint="Landscape, 1200×400 recommended, max 4 MB"
                  aspect="h-16 w-32"
                />
              </div>

              {/* ── Social links ──────────────────────────────────────────── */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-grovio-text">Social Links</h3>
                <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
                  <div>
                    <label htmlFor="instagram" className={labelClass}>Instagram handle</label>
                    <div className="flex items-center rounded-lg border border-grovio-border bg-grovio-surface focus-within:border-grovio-primary overflow-hidden">
                      <span className="border-r border-grovio-border px-2 py-2 text-sm text-grovio-text-muted">@</span>
                      <input
                        id="instagram"
                        type="text"
                        value={instagramHandle}
                        onChange={(e) => setInstagramHandle(e.target.value.replace(/^@/, ''))}
                        placeholder="mystore"
                        className="flex-1 bg-transparent px-3 py-2 text-sm text-grovio-text placeholder:text-grovio-text-muted focus:outline-none"
                      />
                    </div>
                  </div>
                  <div>
                    <label htmlFor="facebook" className={labelClass}>Facebook page URL</label>
                    <input
                      id="facebook"
                      type="url"
                      value={facebookUrl}
                      onChange={(e) => setFacebookUrl(e.target.value)}
                      placeholder="https://facebook.com/…"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label htmlFor="website" className={labelClass}>Website URL</label>
                    <input
                      id="website"
                      type="url"
                      value={websiteUrl}
                      onChange={(e) => setWebsiteUrl(e.target.value)}
                      placeholder="https://mystore.com"
                      className={inputClass}
                    />
                  </div>
                </div>
              </div>

              {/* ── Return policy ─────────────────────────────────────────── */}
              <div>
                <h3 className="mb-1 text-sm font-semibold text-grovio-text">Return Policy</h3>
                <p className="mb-2 text-xs text-grovio-text-muted">
                  Displayed on your store page and product listings. Plain text or Markdown supported.
                </p>
                <textarea
                  id="return-policy"
                  rows={5}
                  value={returnPolicy}
                  onChange={(e) => setReturnPolicy(e.target.value)}
                  placeholder="e.g. We accept returns within 7 days of delivery. Items must be unused and in original packaging…"
                  className={inputClass}
                />
              </div>

              {/* ── Store hours ───────────────────────────────────────────── */}
              <div>
                <h3 className="mb-3 text-sm font-semibold text-grovio-text">Store Hours</h3>
                <div className="space-y-2">
                  {DAYS.map((day) => {
                    const h = storeHours[day] ?? { open: '09:00', close: '18:00', closed: false };
                    return (
                      <div key={day} className="flex items-center gap-3">
                        <div className="w-24 shrink-0">
                          <label className="flex cursor-pointer items-center gap-2">
                            <input
                              type="checkbox"
                              checked={!h.closed}
                              onChange={(e) => updateHours(day, 'closed', !e.target.checked)}
                              className="rounded border-grovio-border"
                            />
                            <span className={`text-sm font-medium ${h.closed ? 'text-grovio-text-muted line-through' : 'text-grovio-text'}`}>
                              {day.slice(0, 3)}
                            </span>
                          </label>
                        </div>
                        {h.closed ? (
                          <span className="text-xs text-grovio-text-muted italic">Closed</span>
                        ) : (
                          <div className="flex items-center gap-2">
                            <input
                              type="time"
                              value={h.open}
                              onChange={(e) => updateHours(day, 'open', e.target.value)}
                              className="rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                            />
                            <span className="text-xs text-grovio-text-muted">to</span>
                            <input
                              type="time"
                              value={h.close}
                              onChange={(e) => updateHours(day, 'close', e.target.value)}
                              className="rounded-lg border border-grovio-border bg-grovio-surface px-2 py-1 text-sm text-grovio-text focus:border-grovio-primary focus:outline-none"
                            />
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="flex justify-end pt-2">
                <button
                  type="submit"
                  disabled={profileMutation.isPending}
                  className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {profileMutation.isPending ? 'Saving…' : 'Save Profile'}
                </button>
              </div>
            </form>
          )}
        </section>

        {/* ── Section 2: Payout Info ───────────────────────────────────────── */}
        <section>
          <h2 className="mb-1 text-base font-semibold text-grovio-text">
            Payout Banking Details
          </h2>
          <p className="mb-4 text-xs text-grovio-text-muted">
            Stored securely, separate from your public profile (D-02). Used by admin for manual settlement.
          </p>
          {payoutLoading ? (
            <div className="flex items-center justify-center py-8">
              <div className="h-6 w-6 animate-spin rounded-full border-2 border-grovio-primary border-t-transparent" />
            </div>
          ) : (
            <form
              onSubmit={handlePayoutSubmit}
              className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="account-holder" className={labelClass}>
                    Account holder name <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="account-holder"
                    type="text"
                    required
                    value={accountHolderName}
                    onChange={(e) => setAccountHolderName(e.target.value)}
                    placeholder="Full legal name"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="account-number" className={labelClass}>
                    Bank account number <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="account-number"
                    type="text"
                    required
                    value={bankAccountNumber}
                    onChange={(e) => setBankAccountNumber(e.target.value)}
                    placeholder="Account number"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="ifsc" className={labelClass}>
                    IFSC / Routing code <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="ifsc"
                    type="text"
                    required
                    value={ifscOrRoutingCode}
                    onChange={(e) => setIfscOrRoutingCode(e.target.value.toUpperCase())}
                    placeholder="HDFC0001234"
                    className={inputClass}
                  />
                </div>
                <div className="sm:col-span-2">
                  <label htmlFor="bank-name" className={labelClass}>
                    Bank name <span className="text-grovio-error">*</span>
                  </label>
                  <input
                    id="bank-name"
                    type="text"
                    required
                    value={bankName}
                    onChange={(e) => setBankName(e.target.value)}
                    placeholder="HDFC Bank"
                    className={inputClass}
                  />
                </div>
              </div>

              <div className="mt-5 flex justify-end">
                <button
                  type="submit"
                  disabled={payoutMutation.isPending}
                  className="rounded-lg bg-grovio-primary px-5 py-2 text-sm font-medium text-white transition-opacity hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  {payoutMutation.isPending ? 'Saving…' : 'Save Payout Info'}
                </button>
              </div>
            </form>
          )}
        </section>
      </div>
    </motion.div>
  );
}
