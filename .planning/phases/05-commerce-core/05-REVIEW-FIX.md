---
phase: 05-commerce-core
fixed_at: 2026-06-05T12:35:44Z
review_path: .planning/phases/05-commerce-core/05-REVIEW.md
iteration: 1
findings_in_scope: 15
fixed: 15
skipped: 0
status: all_fixed
---

# Phase 05: Code Review Fix Report

**Fixed at:** 2026-06-05T12:35:44Z
**Source review:** .planning/phases/05-commerce-core/05-REVIEW.md
**Iteration:** 1

**Summary:**
- Findings in scope: 15 (7 Critical + 8 Warning)
- Fixed: 15
- Skipped: 0

## Fixed Issues

### CR-01: `resetFlow()` called inside `queryFn` — side effect in query causes double-reset

**Files modified:** `apps/web-storefront/src/pages/OrderConfirmationPage.tsx`
**Commit:** c6c51fb
**Applied fix:** Removed `resetFlow()` from the `queryFn`. Added `useEffect(() => { if (order) resetFlow(); }, [order, resetFlow])` that fires once when the order data loads. Also changed the query key from `['order', orderId]` to `['checkout', 'confirmation', orderId]` to address WR-07 isolation in the same commit.

---

### CR-02: `useCheckoutStore()` called twice — two separate subscriptions

**Files modified:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx`
**Commit:** f6d077d
**Applied fix:** Merged the second `useCheckoutStore()` call (line 117) into the first destructure at line 56, adding `paymentResult` to the single subscription. Part of a combined CR-02/CR-03/WR-08/IN-04 commit.

---

### CR-03: Razorpay `onSuccess` navigates without verifying HMAC signature

**Files modified:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx`
**Commit:** f6d077d
**Applied fix:** Replaced the bare `onSuccess={() => navigate(...)}` callback with an async handler that first POSTs `{razorpayPaymentId, razorpayOrderId, razorpaySignature, orderId}` to `POST /checkout/razorpay/verify`. Navigation only occurs if verification succeeds; failure shows a toast and stays on the payment page. Also added `apiClient` to imports.

---

### CR-04: `WalletCreditToggle` checkbox `checked` state disconnected from `appliedMinor` prop

**Files modified:** `apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx`
**Commit:** ee773bb
**Applied fix:** Removed `const [checked, setChecked] = useState(isApplied)`. Replaced with `const checked = appliedMinor > 0` (derived from prop). Updated `handleToggle` to call `onAppliedChange(e.target.checked ? maxCredit : 0)` directly without touching local state. Removed `useState` import as it is no longer needed.

---

### CR-05: `useWalletEntries` dead export has no 401 auth error handling

**Files modified:** `apps/web-storefront/src/hooks/useWallet.ts`
**Commit:** 718ae92
**Applied fix:** Added `try/catch` with `if (err instanceof ApiError && err.status === 401) return []` to `useWalletEntries`, matching the pattern in `useWallet`. Added comment noting the hook is not yet consumed and why it is retained.

---

### CR-06: `CheckoutGuard` backward navigation unguarded — no comment documenting intent

**Files modified:** `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx`
**Commit:** de6bfa3
**Applied fix:** Added an explanatory comment above the redirect condition clarifying that backward navigation is intentionally permitted and that `setSelectedDeliveryOption(null)` in `CheckoutAddressPage` (WR-02) handles re-entry integrity. Combined with WR-06 fix in the same commit.

---

### CR-07: Hardcoded currency `'INR'` in `RazorpayButton`

**Files modified:** `apps/web-storefront/src/components/checkout/RazorpayButton.tsx`
**Commit:** 2e87dda
**Applied fix:** Added a module-level `DEFAULT_RAZORPAY_CURRENCY` constant reading from `import.meta.env['VITE_RAZORPAY_CURRENCY'] ?? 'INR'`. Added optional `currency?: string` prop to `RazorpayButtonProps` (documented). The prop defaults to `DEFAULT_RAZORPAY_CURRENCY` in the component signature. The `openModal()` call now passes `currency` (the prop value) instead of the hardcoded `'INR'`. Combined with WR-03 in the same commit.

---

### WR-01: `apiClient.get` responses unwrapped without envelope validity check

**Files modified:** `apps/web-storefront/src/hooks/useCheckout.ts`
**Commit:** 52bcca1
**Applied fix:** Added `unwrapEnvelope<T>(res)` helper that asserts `res.success === true` before returning `res.data`, throwing if not. Updated both `useCheckoutSummary` and `useCheckoutProviders` query functions to call `unwrapEnvelope(res)` instead of `res.data` directly.

---

### WR-02: `CheckoutAddressPage` does not clear `selectedDeliveryOption` on address change

**Files modified:** `apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx`
**Commit:** 5a11db4
**Applied fix:** Added `setSelectedDeliveryOption` to the `useCheckoutStore()` destructure. Added `setSelectedDeliveryOption(null)` call in `handleContinue` before navigating, with explanatory comment about inventory reservation re-initiation.

---

### WR-03: `loadRazorpayScript` polling interval leaks on unmount or script failure

**Files modified:** `apps/web-storefront/src/components/checkout/RazorpayButton.tsx`
**Commit:** 2e87dda
**Applied fix:** Replaced the simple `resolve()`-only `setInterval` with a new `Promise` that: (1) clears the interval and resolves when `scriptLoaded = true`, (2) clears the interval and rejects when `scriptLoading` flips back to `false` (onerror path), (3) clears the interval and rejects if `Date.now() - start > 10_000` ms elapsed.

---

### WR-04: `CheckoutDeliveryPage` delivery options are static — price mismatch with server

**Files modified:** `apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx`
**Commit:** 74bde1d
**Applied fix:** Replaced the existing brief comment with a prominently marked `STUB — WR-04` block warning that static prices (`Free` / `₹99`) do not match `shippingMinor` from the server, and that buyers MUST replace the static list with a real `GET /checkout/delivery-options` fetch before going live.

---

### WR-05: `StripePaymentForm` — `amountMinor` prop is dead (accepted but never used)

**Files modified:** `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx`, `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx`
**Commit:** 0f11806
**Applied fix:** Removed `amountMinor: number` from `StripeInnerFormProps`, `StripePaymentFormProps`, and the component signature. Removed the corresponding prop from the `<StripeInnerForm>` render call and the `<StripePaymentForm>` call site in `CheckoutPaymentPage`.

---

### WR-06: `CheckoutRootGuard` basket-empty check uses `basket !== undefined` instead of `isSuccess`

**Files modified:** `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx`, `apps/web-storefront/src/hooks/useBasket.ts`
**Commit:** de6bfa3
**Applied fix:** Added `isSuccess` to `useBasket()`'s return value (destructured from `useQuery`). Updated `CheckoutRootGuard` to destructure `isSuccess: basketSuccess` from `useBasket()`. Replaced `(basket?.itemCount ?? 0) === 0 && basket !== undefined` with `basketSuccess && (basket?.itemCount ?? 0) === 0`.

---

### WR-07: `OrderDetailPage` and `OrderConfirmationPage` share `['order', id]` cache key

**Files modified:** `apps/web-storefront/src/pages/account/OrderDetailPage.tsx`
**Commit:** cc24b90
**Applied fix:** Changed `OrderDetailPage` query key from `['order', id]` to `['account', 'orders', id]`. Updated the `returnMutation.onSuccess` invalidation key to match. The `OrderConfirmationPage` key was already changed to `['checkout', 'confirmation', orderId]` as part of the CR-01 fix — both pages are now isolated.

---

### WR-08: `WalletCreditToggle.orderTotalMinor` computed with fragile client-side formula

**Files modified:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx`
**Commit:** f6d077d
**Applied fix:** Changed `orderTotalMinor={summary.subtotalMinor + summary.shippingMinor - summary.discountMinor}` to `orderTotalMinor={summary.grandTotalMinor + summary.walletAppliedMinor}`. The new formula is always correct given the `CheckoutSummary` invariant (`grandTotalMinor = subtotal + shipping - discount - walletApplied`) and survives any additional server-side adjustments.

---

_Fixed: 2026-06-05T12:35:44Z_
_Fixer: Claude (gsd-code-fixer)_
_Iteration: 1_
