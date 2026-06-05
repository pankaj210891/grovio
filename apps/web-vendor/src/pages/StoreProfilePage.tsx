/**
 * Vendor Store Profile page (VEN-01) — owner only.
 *
 * Two sections:
 *   1. Store profile (D-01 fields): name, description, logo URL, banner URL,
 *      contact email, contact phone, address → PATCH /vendor/profile
 *   2. Payout info (D-02 banking details): account holder, account number,
 *      IFSC/routing code, bank name → PATCH /vendor/profile/payout-info
 *
 * Image fields use URL input only (no upload in v1 — D-01 note).
 */

import React, { useEffect, useState } from 'react';
import { motion } from 'motion/react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '../lib/apiClient.js';
import { useUiStore } from '../stores/uiStore.js';
import type { VendorStoreProfile, VendorPayoutInfo } from '@grovio/contracts';

interface ProfileResponse {
  success: boolean;
  data: VendorStoreProfile;
}

interface PayoutInfoResponse {
  success: boolean;
  data: VendorPayoutInfo | null;
}

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

  // ── Payout info form state
  const [accountHolderName, setAccountHolderName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [ifscOrRoutingCode, setIfscOrRoutingCode] = useState('');
  const [bankName, setBankName] = useState('');

  // ── Profile query
  const { data: profileData, isLoading: profileLoading } = useQuery<VendorStoreProfile>({
    queryKey: ['vendorProfile'],
    queryFn: async () => {
      const res = await apiClient.get<ProfileResponse>('/vendor/profile');
      return res.data;
    },
  });

  // ── Payout info query
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

  const profileMutation = useMutation({
    mutationFn: (body: Record<string, string | null>) =>
      apiClient.patch('/vendor/profile', body),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: ['vendorProfile'] });
      addToast({ id: Date.now().toString(), message: 'Store profile saved.', variant: 'success' });
    },
    onError: () => {
      addToast({ id: Date.now().toString(), message: 'Failed to save profile.', variant: 'error' });
    },
  });

  const payoutMutation = useMutation({
    mutationFn: (body: Record<string, string>) =>
      apiClient.patch('/vendor/profile/payout-info', body),
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
          Configure your public store information and payout banking details.
        </p>
      </div>

      <div className="space-y-8">
        {/* Store Profile Section */}
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
              className="rounded-xl border border-grovio-border bg-grovio-surface-raised p-6"
            >
              <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <label htmlFor="store-name" className={labelClass}>
                    Store name
                  </label>
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
                  <label htmlFor="store-desc" className={labelClass}>
                    Store description
                  </label>
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
                  <label htmlFor="logo-url" className={labelClass}>
                    Logo URL
                  </label>
                  <input
                    id="logo-url"
                    type="url"
                    value={logoUrl}
                    onChange={(e) => setLogoUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="banner-url" className={labelClass}>
                    Banner URL
                  </label>
                  <input
                    id="banner-url"
                    type="url"
                    value={bannerUrl}
                    onChange={(e) => setBannerUrl(e.target.value)}
                    placeholder="https://…"
                    className={inputClass}
                  />
                </div>
                <div>
                  <label htmlFor="contact-email" className={labelClass}>
                    Contact email
                  </label>
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
                  <label htmlFor="contact-phone" className={labelClass}>
                    Contact phone
                  </label>
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
                  <label htmlFor="address" className={labelClass}>
                    Store address
                  </label>
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

              <div className="mt-5 flex justify-end">
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

        {/* Payout Info Section */}
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
