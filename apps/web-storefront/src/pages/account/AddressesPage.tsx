import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { AnimatePresence, motion } from 'motion/react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import {
  PlacesAutocompleteInput,
  type StructuredAddress,
} from '../../components/PlacesAutocompleteInput.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import { useUiStore } from '../../store/ui-store.js';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

interface CustomerAddress {
  id: string;
  customerId: string;
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
  createdAt: string;
  updatedAt: string;
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
  street: '',
  city: '',
  state: '',
  pincode: '',
  country: '',
  label: '',
  lat: null,
  lng: null,
  placeId: null,
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function addressLabel(addr: CustomerAddress): string {
  const parts = [addr.street, addr.city, addr.state, addr.pincode]
    .filter(Boolean)
    .join(', ');
  return addr.label ? `${addr.label} — ${parts}` : parts;
}

// ---------------------------------------------------------------------------
// Address form (add / edit)
// ---------------------------------------------------------------------------

interface AddressFormProps {
  initial: AddressFormValues;
  isSubmitting: boolean;
  generalError: string;
  onSubmit: (values: AddressFormValues) => void;
  onCancel: () => void;
}

function AddressForm({
  initial,
  isSubmitting,
  generalError,
  onSubmit,
  onCancel,
}: AddressFormProps) {
  const [values, setValues] = useState<AddressFormValues>(initial);
  interface FieldErrors {
    street?: string | undefined;
    city?: string | undefined;
    state?: string | undefined;
    pincode?: string | undefined;
    country?: string | undefined;
  }

  const [fieldErrors, setFieldErrors] = useState<FieldErrors>({});

  function set<K extends keyof AddressFormValues>(
    key: K,
    val: AddressFormValues[K],
  ) {
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

  function validate(): FieldErrors {
    const errs: FieldErrors = {};
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
    if (Object.keys(errs).length > 0) {
      setFieldErrors(errs);
      return;
    }
    setFieldErrors({});
    onSubmit(values);
  }

  return (
    <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
      <PlacesAutocompleteInput
        label="Street address"
        id="addr-street"
        value={values.street}
        onChange={(v) => set('street', v)}
        onAddressSelect={handlePlaceSelect}
        error={fieldErrors.street}
        disabled={isSubmitting}
      />

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="City"
          id="addr-city"
          type="text"
          value={values.city}
          onChange={(e) => set('city', e.target.value)}
          error={fieldErrors.city}
          disabled={isSubmitting}
        />
        <Input
          label="State / Province"
          id="addr-state"
          type="text"
          value={values.state}
          onChange={(e) => set('state', e.target.value)}
          error={fieldErrors.state}
          disabled={isSubmitting}
        />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input
          label="Postcode / Pincode"
          id="addr-pincode"
          type="text"
          value={values.pincode}
          onChange={(e) => set('pincode', e.target.value)}
          error={fieldErrors.pincode}
          disabled={isSubmitting}
        />
        <Input
          label="Country"
          id="addr-country"
          type="text"
          value={values.country}
          onChange={(e) => set('country', e.target.value)}
          error={fieldErrors.country}
          disabled={isSubmitting}
        />
      </div>

      <Input
        label="Label (optional, e.g. Home or Work)"
        id="addr-label"
        type="text"
        value={values.label}
        onChange={(e) => set('label', e.target.value)}
        disabled={isSubmitting}
      />

      {generalError && (
        <p className="text-sm text-grovio-error" role="alert">
          {generalError}
        </p>
      )}

      <div className="flex gap-3 pt-2">
        <Button
          type="submit"
          variant="primary"
          loading={isSubmitting}
          className="flex-1 sm:flex-none sm:w-auto"
        >
          {isSubmitting ? 'Please wait…' : 'Save Address'}
        </Button>
        <Button
          type="button"
          variant="secondary"
          onClick={onCancel}
          disabled={isSubmitting}
        >
          Cancel
        </Button>
      </div>
    </form>
  );
}

// ---------------------------------------------------------------------------
// Delete confirmation dialog
// ---------------------------------------------------------------------------

interface DeleteDialogProps {
  onConfirm: () => void;
  onCancel: () => void;
  isDeleting: boolean;
}

function DeleteDialog({ onConfirm, onCancel, isDeleting }: DeleteDialogProps) {
  return (
    // Backdrop
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4"
      role="dialog"
      aria-modal="true"
      aria-label="Delete address confirmation"
    >
      <motion.div
        initial={{ opacity: 0, scale: 0.97, y: -4 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.97, y: -4 }}
        transition={{ duration: 0.15 }}
        className="w-full max-w-sm rounded-lg bg-grovio-surface-raised border border-grovio-border p-6 shadow-lg"
      >
        <h2 className="text-base font-semibold text-grovio-text mb-2">
          Delete this address?
        </h2>
        <p className="text-sm text-grovio-text-muted mb-6">
          This action cannot be undone.
        </p>
        <div className="flex gap-3 justify-end">
          <Button
            type="button"
            variant="secondary"
            onClick={onCancel}
            disabled={isDeleting}
          >
            Keep it
          </Button>
          <Button
            type="button"
            variant="destructive"
            onClick={onConfirm}
            loading={isDeleting}
          >
            {isDeleting ? 'Please wait…' : 'Delete'}
          </Button>
        </div>
      </motion.div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

/**
 * Account addresses page — AUTH-05, AUTH-06
 *
 * GET  /account/addresses      → list of address cards
 * POST /account/addresses      → create new address
 * PATCH /account/addresses/:id → update existing address
 * DELETE /account/addresses/:id → delete after confirmation
 *
 * Empty state: "No saved addresses" / "Add your first address"
 * Loaded: address cards with Edit + Delete + "Add address" button
 * Add/edit: slide-up form on mobile, inline on desktop; street field uses PlacesAutocompleteInput
 * Delete: confirmation dialog with "Delete this address?" / "Delete" / "Keep it"
 */
export default function AddressesPage() {
  const qc = useQueryClient();
  const addToast = useUiStore((s) => s.addToast);

  // ── Data fetching ─────────────────────────────────────────────────────────
  const {
    data: addresses,
    isLoading,
    isError,
  } = useQuery<CustomerAddress[]>({
    queryKey: ['account', 'addresses'],
    queryFn: async () => {
      const res = await apiClient.get<AddressListResponse>('/account/addresses');
      return res.data.addresses;
    },
  });

  // ── Local UI state ────────────────────────────────────────────────────────
  type FormMode = 'hidden' | 'add' | { editId: string };
  const [formMode, setFormMode] = useState<FormMode>('hidden');
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [formGeneralError, setFormGeneralError] = useState('');

  function editingAddress(): CustomerAddress | undefined {
    if (typeof formMode === 'object') {
      return addresses?.find((a) => a.id === formMode.editId);
    }
    return undefined;
  }

  function formInitialValues(): AddressFormValues {
    const addr = editingAddress();
    if (addr) {
      return {
        street: addr.street,
        city: addr.city,
        state: addr.state,
        pincode: addr.pincode,
        country: addr.country,
        label: addr.label ?? '',
        lat: addr.lat,
        lng: addr.lng,
        placeId: addr.placeId,
      };
    }
    return EMPTY_FORM;
  }

  // ── Create mutation ───────────────────────────────────────────────────────
  const createMutation = useMutation({
    mutationFn: (body: Omit<AddressFormValues, 'label'> & { label: string | null }) =>
      apiClient.post<AddressResponse>('/account/addresses', body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account', 'addresses'] });
      addToast({
        id: crypto.randomUUID(),
        message: 'Address saved.',
        variant: 'success',
      });
      setFormMode('hidden');
      setFormGeneralError('');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setFormGeneralError(
          "We're having trouble connecting. Check your connection and try again.",
        );
      }
    },
  });

  // ── Update mutation ───────────────────────────────────────────────────────
  const updateMutation = useMutation({
    mutationFn: ({
      id,
      body,
    }: {
      id: string;
      body: Omit<AddressFormValues, 'label'> & { label: string | null };
    }) => apiClient.patch<AddressResponse>(`/account/addresses/${id}`, body),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account', 'addresses'] });
      addToast({
        id: crypto.randomUUID(),
        message: 'Address saved.',
        variant: 'success',
      });
      setFormMode('hidden');
      setFormGeneralError('');
    },
    onError: (err: unknown) => {
      if (err instanceof ApiError) {
        setFormGeneralError(
          "We're having trouble connecting. Check your connection and try again.",
        );
      }
    },
  });

  // ── Delete mutation ───────────────────────────────────────────────────────
  const deleteMutation = useMutation({
    mutationFn: (id: string) =>
      apiClient.delete<{ success: boolean; data: null }>(
        `/account/addresses/${id}`,
      ),
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['account', 'addresses'] });
      addToast({
        id: crypto.randomUUID(),
        message: 'Address deleted.',
        variant: 'info',
      });
      setDeleteId(null);
    },
  });

  // ── Form submit handler ───────────────────────────────────────────────────
  function handleFormSubmit(values: AddressFormValues) {
    setFormGeneralError('');
    const body = {
      street: values.street,
      city: values.city,
      state: values.state,
      pincode: values.pincode,
      country: values.country,
      label: values.label.trim() || null,
      lat: values.lat,
      lng: values.lng,
      placeId: values.placeId,
    };

    if (typeof formMode === 'object') {
      updateMutation.mutate({ id: formMode.editId, body });
    } else {
      createMutation.mutate(body);
    }
  }

  const isMutating = createMutation.isPending || updateMutation.isPending;
  const isFormOpen = formMode !== 'hidden';
  const isEditing = typeof formMode === 'object';

  return (
    <PageTransition>
      <div className="max-w-screen-xl mx-auto px-4 sm:px-6 lg:px-8 py-12">
        <div className="flex items-center justify-between mb-8">
          <h1 className="text-xl font-semibold text-grovio-text">
            My Addresses
          </h1>
          {addresses && addresses.length > 0 && !isFormOpen && (
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setFormMode('add');
                setFormGeneralError('');
              }}
            >
              Add address
            </Button>
          )}
        </div>

        {/* ── Loading skeleton ───────────────────────────────────────────── */}
        {isLoading && (
          <div aria-busy="true" aria-label="Loading addresses…" className="flex flex-col gap-4">
            {[1, 2].map((i) => (
              <Skeleton key={i} className="h-20 w-full rounded-lg" />
            ))}
          </div>
        )}

        {/* ── Error state ────────────────────────────────────────────────── */}
        {isError && (
          <p className="text-sm text-grovio-error" role="alert">
            We&apos;re having trouble loading your addresses. Please refresh and try again.
          </p>
        )}

        {/* ── Empty state ─────────────────────────────────────────────────── */}
        {!isLoading && !isError && addresses && addresses.length === 0 && !isFormOpen && (
          <div className="flex flex-col items-center justify-center py-16 gap-4 text-center">
            <p className="text-base font-semibold text-grovio-text">
              No saved addresses
            </p>
            <p className="text-sm text-grovio-text-muted">
              Add an address to speed up checkout.
            </p>
            <Button
              type="button"
              variant="primary"
              onClick={() => {
                setFormMode('add');
                setFormGeneralError('');
              }}
            >
              Add your first address
            </Button>
          </div>
        )}

        {/* ── Address list ─────────────────────────────────────────────────── */}
        {!isLoading && !isError && addresses && addresses.length > 0 && !isFormOpen && (
          <div className="flex flex-col gap-4 max-w-2xl">
            {addresses.map((addr) => (
              <div
                key={addr.id}
                className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-4 flex items-start justify-between gap-4"
              >
                <div className="flex-1 min-w-0">
                  {addr.label && (
                    <p className="text-sm font-semibold text-grovio-text mb-0.5">
                      {addr.label}
                    </p>
                  )}
                  <p className="text-sm text-grovio-text-muted">
                    {addressLabel(addr)}
                  </p>
                  {addr.country && (
                    <p className="text-sm text-grovio-text-muted">
                      {addr.country}
                    </p>
                  )}
                </div>
                <div className="flex gap-2 shrink-0">
                  <Button
                    type="button"
                    variant="secondary"
                    className="px-3 py-1.5 text-sm"
                    onClick={() => {
                      setFormMode({ editId: addr.id });
                      setFormGeneralError('');
                    }}
                  >
                    Edit
                  </Button>
                  <Button
                    type="button"
                    variant="destructive"
                    className="px-3 py-1.5 text-sm"
                    onClick={() => setDeleteId(addr.id)}
                  >
                    Delete
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}

        {/* ── Add / Edit form ─────────────────────────────────────────────── */}
        <AnimatePresence>
          {isFormOpen && (
            <motion.div
              key="address-form"
              initial={{ opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: 16 }}
              transition={{ duration: 0.25, ease: 'easeOut' }}
              className="max-w-2xl"
            >
              <h2 className="text-base font-semibold text-grovio-text mb-4">
                {isEditing ? 'Edit address' : 'Add address'}
              </h2>
              <AddressForm
                initial={formInitialValues()}
                isSubmitting={isMutating}
                generalError={formGeneralError}
                onSubmit={handleFormSubmit}
                onCancel={() => {
                  setFormMode('hidden');
                  setFormGeneralError('');
                }}
              />
            </motion.div>
          )}
        </AnimatePresence>

        {/* ── Delete confirmation dialog ───────────────────────────────────── */}
        <AnimatePresence>
          {deleteId !== null && (
            <DeleteDialog
              key="delete-dialog"
              onConfirm={() => {
                if (deleteId) deleteMutation.mutate(deleteId);
              }}
              onCancel={() => setDeleteId(null)}
              isDeleting={deleteMutation.isPending}
            />
          )}
        </AnimatePresence>
      </div>
    </PageTransition>
  );
}
