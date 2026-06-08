/**
 * CheckoutPage — single /checkout route with 4-section accordion (Phase 11 T7).
 *
 * Replaces the Phase 5 multi-step URL-based flow with a single page accordion.
 * Old routes (/checkout/address, /checkout/delivery, /checkout/payment, /checkout/review)
 * are redirected to /checkout via App.tsx.
 *
 * Accordion sections (expand in sequence):
 *   1. Address  — PlacesAutocompleteInput + saved address selector
 *   2. Delivery — slot/method selector
 *   3. Payment  — Stripe/Razorpay form
 *   4. Review   — order summary + place order
 *
 * Each collapsed section shows a compact summary.
 * Clicking a completed section re-opens it and collapses subsequent sections.
 *
 * Guest checkout: "Continue as Guest" visible at top; email captured in Review.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { motion, AnimatePresence } from 'motion/react';
import { Check, ChevronDown, ChevronRight } from 'lucide-react';
import { PageTransition } from '../../components/layout/PageTransition.js';
import { Skeleton } from '../../components/ui/Skeleton.js';
import { Button } from '../../components/ui/Button.js';
import { Input } from '../../components/ui/Input.js';
import {
  PlacesAutocompleteInput,
  type StructuredAddress,
} from '../../components/PlacesAutocompleteInput.js';
import { StripePaymentForm } from '../../components/checkout/StripePaymentForm.js';
import { RazorpayButton } from '../../components/checkout/RazorpayButton.js';
import { useAuth } from '../../hooks/useAuth.js';
import { useBasket } from '../../hooks/useBasket.js';
import { useCheckoutStore, useCheckoutSummary, useCheckoutProviders, useInitiateCheckout, usePlaceOrder } from '../../hooks/useCheckout.js';
import { useUiStore } from '../../store/ui-store.js';
import { apiClient, ApiError } from '../../lib/api-client.js';
import type { InitiatePaymentResult } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Types
// ---------------------------------------------------------------------------

type CheckoutStep = 'address' | 'delivery' | 'payment' | 'review';

const STEP_ORDER: Record<CheckoutStep, number> = {
  address: 0,
  delivery: 1,
  payment: 2,
  review: 3,
};

interface CustomerAddress {
  id: string;
  label: string | null;
  street: string;
  city: string;
  state: string;
  pincode: string;
  country: string;
  lat: number | null;
  lng: null;
  placeId: string | null;
  isDefault: boolean;
}

interface AddressListResponse {
  success: boolean;
  data: { addresses: CustomerAddress[] };
}

// ---------------------------------------------------------------------------
// Accordion section
// ---------------------------------------------------------------------------

interface AccordionSectionProps {
  step: CheckoutStep;
  label: string;
  stepNumber: number;
  isOpen: boolean;
  isCompleted: boolean;
  summary?: string | undefined;
  onHeaderClick: () => void;
  children: React.ReactNode;
}

function AccordionSection({
  label,
  stepNumber,
  isOpen,
  isCompleted,
  summary,
  onHeaderClick,
  children,
}: AccordionSectionProps) {
  return (
    <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised overflow-hidden">
      {/* Header */}
      <button
        type="button"
        onClick={onHeaderClick}
        className="w-full flex items-center gap-3 px-5 py-4 text-left focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary focus-visible:ring-inset"
        aria-expanded={isOpen}
      >
        {/* Step indicator */}
        <div
          className={`flex-shrink-0 w-7 h-7 rounded-full flex items-center justify-center text-sm font-semibold transition-colors ${
            isCompleted
              ? 'bg-grovio-primary text-white'
              : isOpen
                ? 'bg-grovio-primary text-white ring-4 ring-grovio-primary/20'
                : 'bg-grovio-surface border border-grovio-border text-grovio-text-muted'
          }`}
          aria-hidden="true"
        >
          {isCompleted ? <Check className="h-4 w-4" /> : stepNumber}
        </div>

        <div className="flex-1 min-w-0">
          <span className="text-sm font-semibold text-grovio-text">{label}</span>
          {!isOpen && summary && (
            <p className="text-xs text-grovio-text-muted truncate mt-0.5">{summary}</p>
          )}
        </div>

        <div className="flex-shrink-0 text-grovio-text-muted">
          {isOpen ? (
            <ChevronDown className="h-4 w-4" aria-hidden="true" />
          ) : (
            <ChevronRight className="h-4 w-4" aria-hidden="true" />
          )}
        </div>
      </button>

      {/* Content */}
      <AnimatePresence initial={false}>
        {isOpen && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.25, ease: 'easeInOut' }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 border-t border-grovio-border">{children}</div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Address section content
// ---------------------------------------------------------------------------

function AddressSection({
  onContinue,
}: {
  onContinue: (addressId: string, summary: string) => void;
}) {
  const addToast = useUiStore((s) => s.addToast);
  const { setSelectedAddressId, setSelectedDeliveryOption } = useCheckoutStore();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [formError, setFormError] = useState('');
  const [newAddress, setNewAddress] = useState({
    street: '', city: '', state: '', pincode: '', country: '', label: '',
    lat: null as number | null, lng: null as number | null, placeId: null as string | null,
  });

  const { data: addresses, isLoading, refetch } = useQuery<CustomerAddress[]>({
    queryKey: ['account', 'addresses'],
    queryFn: async () => {
      const res = await apiClient.get<AddressListResponse>('/account/addresses');
      return res.data.addresses;
    },
  });

  const defaultAddress = addresses?.find((a) => a.isDefault) ?? addresses?.[0];
  const effectiveSelectedId = selectedId ?? defaultAddress?.id ?? null;
  const selectedAddress = addresses?.find((a) => a.id === effectiveSelectedId);

  async function handleAddAddress() {
    setIsSaving(true);
    setFormError('');
    try {
      const res = await apiClient.post<{ success: boolean; data: CustomerAddress }>('/account/addresses', {
        ...newAddress,
        label: newAddress.label.trim() || null,
      });
      addToast({ id: crypto.randomUUID(), message: 'Address saved.', variant: 'success' });
      setShowAddForm(false);
      await refetch();
      setSelectedId(res.data.id);
    } catch (err: unknown) {
      if (err instanceof ApiError) setFormError("We're having trouble saving. Please try again.");
    } finally {
      setIsSaving(false);
    }
  }

  function handleContinue() {
    if (!effectiveSelectedId || !selectedAddress) return;
    setSelectedAddressId(effectiveSelectedId);
    setSelectedDeliveryOption(null);
    const summary = [selectedAddress.label, selectedAddress.street, selectedAddress.city]
      .filter(Boolean)
      .join(', ');
    onContinue(effectiveSelectedId, summary);
  }

  if (isLoading) {
    return (
      <div className="pt-4 space-y-2">
        {[1, 2].map((i) => <Skeleton key={i} className="h-16 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-3">
      {addresses?.map((addr) => {
        const isSelected = effectiveSelectedId === addr.id;
        return (
          <button
            key={addr.id}
            type="button"
            onClick={() => setSelectedId(addr.id)}
            aria-pressed={isSelected}
            className={`w-full text-left rounded-lg border p-4 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary ${
              isSelected
                ? 'border-grovio-primary bg-grovio-primary/5'
                : 'border-grovio-border bg-grovio-surface hover:border-grovio-text-muted'
            }`}
          >
            {addr.label && <p className="font-semibold text-grovio-text">{addr.label}</p>}
            <p className="text-grovio-text-muted">
              {[addr.street, addr.city, addr.state, addr.pincode].filter(Boolean).join(', ')}
            </p>
          </button>
        );
      })}

      {!showAddForm && (
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-full rounded-lg border border-dashed border-grovio-border p-3 text-sm text-grovio-text-muted hover:border-grovio-primary hover:text-grovio-primary transition-colors"
        >
          + Add a new address
        </button>
      )}

      {showAddForm && (
        <div className="space-y-3 rounded-lg border border-grovio-border p-4">
          <h3 className="text-sm font-semibold text-grovio-text">Add new address</h3>
          <PlacesAutocompleteInput
            label="Street address"
            id="co-new-street"
            value={newAddress.street}
            onChange={(v) => setNewAddress((p) => ({ ...p, street: v }))}
            onAddressSelect={(addr: StructuredAddress) =>
              setNewAddress((p) => ({ ...p, ...addr }))
            }
          />
          <div className="grid grid-cols-2 gap-3">
            <Input label="City" id="co-new-city" type="text" value={newAddress.city}
              onChange={(e) => setNewAddress((p) => ({ ...p, city: e.target.value }))} />
            <Input label="State" id="co-new-state" type="text" value={newAddress.state}
              onChange={(e) => setNewAddress((p) => ({ ...p, state: e.target.value }))} />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <Input label="Pincode" id="co-new-pincode" type="text" value={newAddress.pincode}
              onChange={(e) => setNewAddress((p) => ({ ...p, pincode: e.target.value }))} />
            <Input label="Country" id="co-new-country" type="text" value={newAddress.country}
              onChange={(e) => setNewAddress((p) => ({ ...p, country: e.target.value }))} />
          </div>
          {formError && <p className="text-sm text-grovio-error" role="alert">{formError}</p>}
          <div className="flex gap-2">
            <Button type="button" variant="primary" loading={isSaving}
              onClick={() => { void handleAddAddress(); }}>
              Save & Select
            </Button>
            <Button type="button" variant="secondary"
              onClick={() => { setShowAddForm(false); setFormError(''); }}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <Button
        type="button"
        variant="primary"
        onClick={handleContinue}
        disabled={!effectiveSelectedId}
      >
        Continue to Delivery
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Delivery section content
// ---------------------------------------------------------------------------

function DeliverySection({ onContinue }: { onContinue: (option: string, summary: string) => void }) {
  const { setSelectedDeliveryOption } = useCheckoutStore();
  const [selected, setSelected] = useState<string | null>(null);

  const deliveryOptions = [
    { id: 'standard', label: 'Standard Delivery', days: '3-5 business days', price: 0 },
    { id: 'express', label: 'Express Delivery', days: '1-2 business days', price: 5900 },
  ];

  function handleContinue() {
    if (!selected) return;
    const opt = deliveryOptions.find((o) => o.id === selected);
    setSelectedDeliveryOption(selected);
    onContinue(selected, opt?.label ?? selected);
  }

  return (
    <div className="pt-4 space-y-3">
      {deliveryOptions.map((opt) => {
        const isSelected = selected === opt.id;
        return (
          <button
            key={opt.id}
            type="button"
            onClick={() => setSelected(opt.id)}
            aria-pressed={isSelected}
            className={`w-full text-left rounded-lg border p-4 transition-colors text-sm focus:outline-none focus-visible:ring-2 focus-visible:ring-grovio-primary ${
              isSelected
                ? 'border-grovio-primary bg-grovio-primary/5'
                : 'border-grovio-border bg-grovio-surface hover:border-grovio-text-muted'
            }`}
          >
            <div className="flex items-center justify-between">
              <div>
                <p className="font-semibold text-grovio-text">{opt.label}</p>
                <p className="text-grovio-text-muted">{opt.days}</p>
              </div>
              <span className="font-semibold text-grovio-text">
                {opt.price === 0 ? 'Free' : `₹${(opt.price / 100).toFixed(0)}`}
              </span>
            </div>
          </button>
        );
      })}

      <Button
        type="button"
        variant="primary"
        onClick={handleContinue}
        disabled={!selected}
      >
        Continue to Payment
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Payment section content
// ---------------------------------------------------------------------------

interface PaymentSectionProps {
  onContinue: (summary: string) => void;
}

function PaymentSection({ onContinue }: PaymentSectionProps) {
  const { selectedAddressId, appliedCouponCode, walletCreditRequested, setPaymentResult } = useCheckoutStore();
  const placeOrder = usePlaceOrder();
  const { data: providers } = useCheckoutProviders();
  const addToast = useUiStore((s) => s.addToast);
  const [localResult, setLocalResult] = useState<InitiatePaymentResult | null>(null);

  async function handlePlaceOrder(provider: 'stripe' | 'razorpay') {
    if (!selectedAddressId) return;
    try {
      const res = await placeOrder.mutateAsync({
        addressId: selectedAddressId,
        paymentProvider: provider,
        walletAppliedMinor: walletCreditRequested,
        couponCode: appliedCouponCode,
      });
      const result = res.data;
      setLocalResult(result);
      setPaymentResult(result);
      onContinue(provider === 'stripe' ? 'Stripe card' : 'Razorpay');
    } catch {
      addToast({ id: crypto.randomUUID(), message: 'Could not initiate payment. Please try again.', variant: 'error' });
    }
  }

  if (localResult?.provider === 'stripe' && localResult.providerOrder.clientSecret) {
    return (
      <div className="pt-4">
        <StripePaymentForm clientSecret={localResult.providerOrder.clientSecret} orderId={localResult.orderId} />
      </div>
    );
  }

  return (
    <div className="pt-4 space-y-3">
      <p className="text-sm text-grovio-text-muted">Choose a payment method:</p>

      {providers?.stripe && (
        <Button
          type="button"
          variant="primary"
          loading={placeOrder.isPending}
          onClick={() => { void handlePlaceOrder('stripe'); }}
          className="w-full"
        >
          Pay with Card (Stripe)
        </Button>
      )}

      {providers?.razorpay && localResult?.provider === 'razorpay' && (
        <RazorpayButton
          orderId={localResult.orderId}
          amountMinor={localResult.amountMinor}
          providerKey={localResult.providerOrder.providerKey ?? ''}
          providerOrderRef={localResult.providerOrder.providerOrderRef ?? ''}
          onSuccess={() => { onContinue('Razorpay'); }}
        />
      )}

      {providers?.razorpay && !localResult && (
        <Button
          type="button"
          variant="secondary"
          loading={placeOrder.isPending}
          onClick={() => { void handlePlaceOrder('razorpay'); }}
          className="w-full"
        >
          Pay with Razorpay
        </Button>
      )}

      {!providers?.stripe && !providers?.razorpay && (
        <p className="text-sm text-grovio-error">No payment methods configured.</p>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Review section content
// ---------------------------------------------------------------------------

interface ReviewSectionProps {
  isGuest: boolean;
}

function ReviewSection({ isGuest }: ReviewSectionProps) {
  const navigate = useNavigate();
  const addToast = useUiStore((s) => s.addToast);
  const { data: summary } = useCheckoutSummary();
  const [guestEmail, setGuestEmail] = useState('');
  const { resetFlow } = useCheckoutStore();

  function handlePlaceOrder() {
    addToast({ id: crypto.randomUUID(), message: 'Order placed! Redirecting…', variant: 'success' });
    resetFlow();
    void navigate('/account/orders');
  }

  const formatMinor = (n: number) =>
    new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', minimumFractionDigits: 0 }).format(n / 100);

  return (
    <div className="pt-4 space-y-4">
      {isGuest && (
        <div>
          <p className="text-sm font-medium text-grovio-text mb-2">Your email (for order updates)</p>
          <Input
            id="guest-email"
            type="email"
            placeholder="you@example.com"
            value={guestEmail}
            onChange={(e) => setGuestEmail(e.target.value)}
          />
        </div>
      )}

      {summary ? (
        <div className="rounded-lg border border-grovio-border p-4 text-sm space-y-2">
          <div className="flex justify-between">
            <span className="text-grovio-text-muted">Subtotal</span>
            <span>{formatMinor(summary.subtotalMinor)}</span>
          </div>
          {summary.shippingMinor > 0 && (
            <div className="flex justify-between">
              <span className="text-grovio-text-muted">Shipping</span>
              <span>{formatMinor(summary.shippingMinor)}</span>
            </div>
          )}
          {summary.discountMinor > 0 && (
            <div className="flex justify-between">
              <span className="text-grovio-text-muted">Discount</span>
              <span className="text-green-600">-{formatMinor(summary.discountMinor)}</span>
            </div>
          )}
          <div className="pt-2 border-t border-grovio-border flex justify-between font-semibold">
            <span>Total</span>
            <span className="text-grovio-primary">{formatMinor(summary.grandTotalMinor)}</span>
          </div>
        </div>
      ) : (
        <Skeleton className="h-24 w-full rounded-lg" />
      )}

      <Button type="button" variant="primary" onClick={handlePlaceOrder} className="w-full">
        Place Order
      </Button>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main page
// ---------------------------------------------------------------------------

export default function CheckoutPage() {
  const { isAuthenticated, isLoading: authLoading } = useAuth();
  const { basket, isLoading: basketLoading } = useBasket();
  const navigate = useNavigate();
  const [openStep, setOpenStep] = useState<CheckoutStep>('address');
  const [completedSteps, setCompletedSteps] = useState<Set<CheckoutStep>>(new Set());
  const [summaries, setSummaries] = useState<Partial<Record<CheckoutStep, string>>>({});

  // Redirect to cart if basket is empty
  if (!basketLoading && (!basket || basket.itemCount === 0)) {
    void navigate('/cart');
    return null;
  }

  function openSection(step: CheckoutStep) {
    // Clicking a completed section re-opens it and collapses subsequent sections
    const idx = STEP_ORDER[step];
    setOpenStep(step);
    // Remove completions for this step and after (to re-validate them)
    setCompletedSteps((prev) => {
      const next = new Set(prev);
      for (const s of Object.keys(STEP_ORDER) as CheckoutStep[]) {
        if (STEP_ORDER[s] >= idx) next.delete(s);
      }
      return next;
    });
  }

  function completeStep(step: CheckoutStep, summary: string) {
    setCompletedSteps((prev) => new Set([...prev, step]));
    setSummaries((prev) => ({ ...prev, [step]: summary }));
    // Advance to next step
    const steps: CheckoutStep[] = ['address', 'delivery', 'payment', 'review'];
    const nextIdx = STEP_ORDER[step] + 1;
    const nextStep = steps[nextIdx];
    if (nextIdx < steps.length && nextStep !== undefined) setOpenStep(nextStep);
  }

  if (authLoading || basketLoading) {
    return (
      <PageTransition>
        <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
          <Skeleton className="h-8 w-48 mb-6" />
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-16 w-full rounded-lg mb-3" />
          ))}
        </div>
      </PageTransition>
    );
  }

  const isGuest = !isAuthenticated;

  return (
    <PageTransition>
      <div className="max-w-screen-md mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <h1 className="text-xl font-semibold text-grovio-text mb-2">Checkout</h1>

        {/* Guest notice */}
        {isGuest && (
          <p className="text-sm text-grovio-text-muted mb-6">
            Checking out as guest.{' '}
            <a href="/auth/login" className="text-grovio-primary hover:underline">
              Sign in
            </a>{' '}
            for faster checkout.
          </p>
        )}

        <div className="space-y-3">
          {/* Step 1: Address */}
          <AccordionSection
            step="address"
            label="Delivery Address"
            stepNumber={1}
            isOpen={openStep === 'address'}
            isCompleted={completedSteps.has('address')}
            summary={summaries.address}
            onHeaderClick={() => openSection('address')}
          >
            <AddressSection
              onContinue={(id, summary) => completeStep('address', summary)}
            />
          </AccordionSection>

          {/* Step 2: Delivery */}
          <AccordionSection
            step="delivery"
            label="Delivery Method"
            stepNumber={2}
            isOpen={openStep === 'delivery'}
            isCompleted={completedSteps.has('delivery')}
            summary={summaries.delivery}
            onHeaderClick={() => {
              if (completedSteps.has('address')) openSection('delivery');
            }}
          >
            <DeliverySection
              onContinue={(option, summary) => completeStep('delivery', summary)}
            />
          </AccordionSection>

          {/* Step 3: Payment */}
          <AccordionSection
            step="payment"
            label="Payment"
            stepNumber={3}
            isOpen={openStep === 'payment'}
            isCompleted={completedSteps.has('payment')}
            summary={summaries.payment}
            onHeaderClick={() => {
              if (completedSteps.has('delivery')) openSection('payment');
            }}
          >
            <PaymentSection
              onContinue={(summary) => completeStep('payment', summary)}
            />
          </AccordionSection>

          {/* Step 4: Review */}
          <AccordionSection
            step="review"
            label="Review & Place Order"
            stepNumber={4}
            isOpen={openStep === 'review'}
            isCompleted={completedSteps.has('review')}
            summary={summaries.review}
            onHeaderClick={() => {
              if (completedSteps.has('payment')) openSection('review');
            }}
          >
            <ReviewSection isGuest={isGuest} />
          </AccordionSection>
        </div>
      </div>
    </PageTransition>
  );
}
