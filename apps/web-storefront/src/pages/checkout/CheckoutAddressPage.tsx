/**
 * CheckoutAddressPage — /checkout/address (step 1 of 4, D-05)
 *
 * Customer selects a saved delivery address or adds a new one using the
 * Phase 4 Google Places component (reuse of AddressesPage pattern).
 * On "Continue" navigates to /checkout/delivery.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { motion } from 'motion/react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { CheckoutProgress } from '../../components/checkout/CheckoutProgress.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import {
  PlacesAutocompleteInput,
  type StructuredAddress,
} from '../../components/PlacesAutocompleteInput.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';
import { useCheckoutStore } from '../../hooks/useCheckout.js';

// ---------------------------------------------------------------------------
// Types (mirrors AddressesPage CustomerAddress — no re-export to avoid coupling)
// ---------------------------------------------------------------------------

interface CustomerAddress {
  id: string;
  label: string | null;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
  isDefault: boolean;
}

interface AddressListResponse {
  success: boolean;
  data: { addresses: CustomerAddress[] };
}

interface AddressResponse {
  success: boolean;
  data: CustomerAddress;
}

interface AddressFormValues {
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  label: string;
  lat: number | null;
  lng: number | null;
  placeId: string | null;
}

const EMPTY_FORM: AddressFormValues = {
  street: '', city: '', state: '', pincode: '', country: '',
  label: '', lat: null, lng: null, placeId: null,
};

// ---------------------------------------------------------------------------
// Address label helper
// ---------------------------------------------------------------------------

function addressLabel(addr: CustomerAddress): string {
  const parts = [addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ');
  return addr.label ? `${addr.label} — ${parts}` : parts;
}

// ---------------------------------------------------------------------------
// Inline add-address form (reuses AddressesPage form pattern)
// ---------------------------------------------------------------------------

interface InlineAddressFormProps {
  isSubmitting: boolean;
  generalError: string;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
}

function InlineAddressForm({
  isSubmitting, generalError, onSubmit, onCancel,
}: InlineAddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>(EMPTY_FORM);
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof AddressFormValues, string>>>({});

  function set<K extends keyof AddressFormValues>(key: K, val: AddressFormValues[K]) {
    setValues((prev) => ({ ...prev, [key]: val }));
  }

  function handlePlaceSelect(addr: StructuredAddress) {
    setValues((prev) => ({
      ...prev,
      street: addr.street,
      city: addr.city,
      state: addr.state,
      pincode: addr.pincode,
      country: addr.country,
      lat: addr.lat,
      lng: addr.lng,
      placeId: addr.placeId,
    }));
  }

  function validate(): Partial<Record<keyof AddressFormValues, string>> {
    const errs: Partial<Record<keyof AddressFormValues, string>> = {};
    if (!values.street.trim()) errs.street = 'Street address is required.';
    if (!values.city.trim()) errs.city = 'City is required.';
    if (!values.state.trim()) errs.state = 'State is required.';
    if (!values.pincode.trim()) errs.pincode = 'Postcode is required.';
    if (!values.country.trim()) errs.country = 'Country is required.';
    return errs;
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setFieldErrors(errs); return; }
    setFieldErrors({});
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4 mt-4">
      <PlacesAutocompleteInput
        label="Street address"
        id="co-addr-street"
        value={values.street}
        onChange={(v) => set('street', v)}
        onAddressSelect={handlePlaceSelect}
        error={fieldErrors.street}
        disabled={isSubmitting}
      />
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="City" id="co-addr-city" type="text" value={values.city}
          onChange={(e) => set('city', e.target.value)} error={fieldErrors.city} disabled={isSubmitting} />
        <Input label="State / Province" id="co-addr-state" type="text" value={values.state}
          onChange={(e) => set('state', e.target.value)} error={fieldErrors.state} disabled={isSubmitting} />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="Postcode / Pincode" id="co-addr-pincode" type="text" value={values.pincode}
          onChange={(e) => set('pincode', e.target.value)} error={fieldErrors.pincode} disabled={isSubmitting} />
        <Input label="Country" id="co-addr-country" type="text" value={values.country}
          onChange={(e) => set('country', e.target.value)} error={fieldErrors.country} disabled={isSubmitting} />
      </div>
      <Input label="Label (optional, e.g. Home)" id="co-addr-label" type="text"
        value={values.label} onChange={(e) => set('label', e.target.value)} disabled={isSubmitting} />
      {generalError && <p className="text-sm text-grovio-error" role="alert">{generalError}</p>}
      <div className="flex gap-3 pt-1">
        <Button type="submit" variant="primary" loading={isSubmitting}>
          {isSubmitting ? 'Saving…' : 'Save & Select'}
        </Button>
        <Button type="button" variant="secondary" onClick={onCancel} disabled={isSubmitting}>
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutAddressPage() {
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const { setSelectedAddressId, setSelectedDeliveryOption } = useCheckoutStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [formError, setFormError] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  const { data: addresses, isLoading, isError, refetch } = useQuery<CustomerAddress[]>({
    queryKey: ['account', 'addresses'],
    queryFn: async () => {
      const res = await apiClient.get<AddressListResponse>('/account/addresses');
      return res.data.addresses;
    },
  });

  // Auto-select default address on load
  const defaultAddress = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const effectiveSelectedId = selectedId ?? defaultAddress?.id ?? null;

  async function handleAddAddress(values: AddressFormValues) {
    setIsSaving(true);
    setFormError('');
    try {
      const res = await apiClient.post<AddressResponse>('/account/addresses', {
        ...values,
        label: values.label.trim() || null,
      });
      addToast({ id: crypto.randomUUID(), message: 'Address saved.', variant: 'success' });
      setShowAddForm(false);
      await refetch();
      setSelectedId(res.data.id);
    } catch (err: unknown) {
      if (err instanceof ApiError) {
        setFormError("We're having trouble saving. Please try again.");
      }
    } finally {
      setIsSaving(false);
    }
  }

  function handleContinue() {
    if (!effectiveSelectedId) return;
    setSelectedAddressId(effectiveSelectedId);
    // WR-02: clear delivery option so the delivery step re-initiates checkout
    // (calls POST /checkout/initiate again) when the customer selects a different
    // address on backward navigation. Without this, a stale selectedDeliveryOption
    // bypasses the CheckoutGuard and submits the old reservation address.
    setSelectedDeliveryOption(null);
    void navigate('/checkout/delivery');
  }

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        {/* Progress indicator */}
        <div className="mb-8">
          <CheckoutProgress currentStep="address" />
        </div>

        <h1 className="text-xl font-semibold text-grovio-text mb-6">Delivery address</h1>

        {/* Loading skeleton */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading addresses…" className="flex flex-col gap-3">
            {[1, 2].map((i) => <Skeleton key={i} className="h-20 w-full rounded-lg" />)}
          </div>
        )}

        {/* Error */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your addresses. Please refresh and try again.
          </p>
        )}

        {/* Address list */}
        {!isLoading && !isError && addresses && (
          <div className="flex flex-col gap-3">
            {addresses.map((addr) => {
              const isSelected = effectiveSelectedId === addr.id;
              return (
                <button
                  key={addr.id}
                  type="button"
                  onClick={() => setSelectedId(addr.id)}
                  className={[
                    'w-full text-left rounded-lg border p-4 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary',
                    isSelected
                      ? 'border-grovio-primary bg-grovio-primary/5'
                      : 'border-grovio-border bg-grovio-surface-raised hover:border-grovio-text-muted',
                  ].join(' ')}
                  aria-pressed={isSelected}
                >
                  <div className="flex items-start gap-3">
                    <div
                      className={[
                        'mt-0.5 w-4 h-4 rounded-full border-2 flex-shrink-0',
                        isSelected
                          ? 'border-grovio-primary bg-grovio-primary'
                          : 'border-grovio-border',
                      ].join(' ')}
                      aria-hidden="true"
                    />
                    <div>
                      {addr.label && (
                        <p className="text-sm font-semibold text-grovio-text">{addr.label}</p>
                      )}
                      <p className="text-sm text-grovio-text-muted">{addressLabel(addr)}</p>
                    </div>
                  </div>
                </button>
              );
            })}

            {/* Add new address */}
            {!showAddForm && (
              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full rounded-lg border border-dashed border-grovio-border p-4 text-sm text-grovio-text-muted hover:border-grovio-primary hover:text-grovio-primary transition-colors"
              >
                + Add a new address
              </button>
            )}
          </div>
        )}

        {/* Inline add-address form */}
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 12 }}
            transition={{ duration: 0.2, ease: 'easeOut' }}
            className="mt-4 rounded-lg border border-grovio-border bg-grovio-surface-raised p-5"
          >
            <h2 className="text-sm font-semibold text-grovio-text mb-2">Add new address</h2>
            <InlineAddressForm
              isSubmitting={isSaving}
              generalError={formError}
              onSubmit={(vals) => { void handleAddAddress(vals); }}
              onCancel={() => { setShowAddForm(false); setFormError(''); }}
            />
          </motion.div>
        )}

        {/* Continue CTA */}
        {!showAddForm && (
          <div className="mt-8">
            <Button
              type="button"
              variant="primary"
              className="w-full sm:w-auto"
              onClick={handleContinue}
              disabled={!effectiveSelectedId}
            >
              Continue to Delivery
            </Button>
          </div>
        )}
      </div>
    </PageTransition>
  );
}
