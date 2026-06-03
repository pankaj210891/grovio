/**
 * OrderSummary sidebar (D-25).
 *
 * Displays: subtotal, coupon code input (graceful if coupons unavailable),
 * wallet credit toggle placeholder (TODO: wire to useWallet in 05-12),
 * estimated delivery, order total, and a "Proceed to checkout" CTA.
 *
 * Security note (T-05-UI): all totals shown here are informational displays
 * from the server basket response. Authoritative totals are recomputed
 * server-side at checkout (CHK-04) — nothing here is trusted for payment.
 */

import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Tag, Wallet } from 'lucide-react';
import { Button } from '../ui/Button.js';
import { Input } from '../ui/Input.js';
import type { Basket } from '@grovio/contracts';

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function formatPrice(minor: number): string {
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 0,
  }).format(minor / 100);
}

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

interface OrderSummaryProps {
  basket: Basket;
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function OrderSummary({ basket }: OrderSummaryProps) {
  const navigate = useNavigate();
  const [couponCode, setCouponCode] = useState('');
  const [couponApplying, setCouponApplying] = useState(false);

  // T-05-UI: subtotal displayed is informational; server re-derives at checkout
  const subtotal = basket.subtotalMinor;
  const orderTotal = subtotal; // delivery + wallet + coupon deductions applied server-side

  function handleCouponApply() {
    if (!couponCode.trim()) return;
    // Coupon application is handled at checkout step (05-12); for now show graceful state
    setCouponApplying(true);
    setTimeout(() => setCouponApplying(false), 600);
  }

  function handleProceedToCheckout() {
    void navigate('/checkout/address');
  }

  return (
    <div className="rounded-lg border border-grovio-border bg-grovio-surface-raised p-6 space-y-5">
      <h2 className="text-base font-semibold text-grovio-text">Order Summary</h2>

      {/* Subtotal row */}
      <div className="flex justify-between text-sm">
        <span className="text-grovio-text-muted">
          Subtotal ({basket.itemCount} {basket.itemCount === 1 ? 'item' : 'items'})
        </span>
        <span className="font-semibold text-grovio-text tabular-nums">
          {formatPrice(subtotal)}
        </span>
      </div>

      {/* Delivery estimate */}
      <div className="flex justify-between text-sm">
        <span className="text-grovio-text-muted">Delivery</span>
        <span className="text-grovio-text-muted">Calculated at checkout</span>
      </div>

      {/* Divider */}
      <div className="border-t border-grovio-border" />

      {/* Order total */}
      <div className="flex justify-between">
        <span className="text-sm font-semibold text-grovio-text">Estimated total</span>
        <span className="text-base font-semibold text-grovio-primary tabular-nums">
          {formatPrice(orderTotal)}
        </span>
      </div>

      {/* Coupon code input */}
      <div className="space-y-2">
        <p className="text-xs font-semibold text-grovio-text-muted uppercase tracking-wide flex items-center gap-1">
          <Tag className="h-3 w-3" aria-hidden="true" />
          Coupon
        </p>
        <div className="flex gap-2">
          <Input
            id="coupon-code"
            type="text"
            placeholder="Enter coupon code"
            value={couponCode}
            onChange={(e) => setCouponCode(e.target.value)}
            disabled={couponApplying}
            className="flex-1"
          />
          <Button
            type="button"
            variant="secondary"
            onClick={handleCouponApply}
            loading={couponApplying}
            disabled={!couponCode.trim() || couponApplying}
            className="px-3 py-2 text-sm whitespace-nowrap"
          >
            Apply
          </Button>
        </div>
        <p className="text-xs text-grovio-text-muted">
          Coupons are applied at checkout.
        </p>
      </div>

      {/* Wallet credit toggle (TODO: wire to useWallet in plan 05-12) */}
      <div className="flex items-center justify-between gap-3 rounded-md border border-grovio-border px-4 py-3 bg-grovio-surface">
        <div className="flex items-center gap-2">
          <Wallet className="h-4 w-4 text-grovio-text-muted" aria-hidden="true" />
          <div>
            <p className="text-sm font-semibold text-grovio-text">Wallet credit</p>
            <p className="text-xs text-grovio-text-muted">
              {/* TODO (05-12): Replace with actual balance from useWallet hook */}
              Available at checkout
            </p>
          </div>
        </div>
        <span className="text-xs text-grovio-text-muted">Coming in checkout</span>
      </div>

      {/* Proceed to checkout CTA */}
      <Button
        type="button"
        variant="primary"
        onClick={handleProceedToCheckout}
        className="w-full"
        disabled={basket.itemCount === 0}
      >
        Proceed to checkout
      </Button>

      <p className="text-xs text-grovio-text-muted text-center leading-relaxed">
        Taxes, delivery fees, and discounts are calculated at checkout.
      </p>
    </div>
  );
}
