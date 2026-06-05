---
phase: 05-commerce-core
reviewed: 2026-06-05T00:00:00Z
depth: standard
files_reviewed: 16
files_reviewed_list:
  - apps/web-storefront/src/hooks/useCheckout.ts
  - apps/web-storefront/src/hooks/useWallet.ts
  - apps/web-storefront/src/components/checkout/CheckoutProgress.tsx
  - apps/web-storefront/src/components/checkout/CheckoutGuard.tsx
  - apps/web-storefront/src/components/checkout/StripePaymentForm.tsx
  - apps/web-storefront/src/components/checkout/RazorpayButton.tsx
  - apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx
  - apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx
  - apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx
  - apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx
  - apps/web-storefront/src/pages/checkout/CheckoutReviewPage.tsx
  - apps/web-storefront/src/pages/OrderConfirmationPage.tsx
  - apps/web-storefront/src/pages/account/OrdersPage.tsx
  - apps/web-storefront/src/pages/account/OrderDetailPage.tsx
  - apps/web-storefront/src/pages/account/WalletPage.tsx
  - apps/web-storefront/src/router.tsx
findings:
  critical: 7
  warning: 8
  info: 4
  total: 19
status: issues_found
---

# Phase 05: Code Review Report

**Reviewed:** 2026-06-05T00:00:00Z
**Depth:** standard
**Files Reviewed:** 16
**Status:** issues_found

## Summary

Reviewed all 16 Phase 05 checkout/payment/wallet UI source files. The overall structure is sound — server-authoritative pricing is correctly respected, PCI scope is correctly delegated to Stripe/Razorpay, and the Zustand/React Query split follows the documented design. However, there are seven critical issues that can cause incorrect payment behavior, silent query errors, or security-impacting trust gaps, plus eight warnings covering flow correctness and robustness defects.

---

## Critical Issues

### CR-01: `resetFlow()` called inside `queryFn` — side effect in query causes double-reset and race condition

**File:** `apps/web-storefront/src/pages/OrderConfirmationPage.tsx:60`
**Issue:** `resetFlow()` is called inside the React Query `queryFn`. React Query may invoke `queryFn` multiple times (background refetch, StaleTime expiry, tab-focus refetch). Each invocation will reset the Zustand checkout flow store — including `paymentResult` — even if the user navigates back or if a background refetch fires after the first successful load. This can also cause the `CheckoutGuard` for the `/checkout/review` route to redirect mid-session if the page is still mounted and a refetch fires.

React Query's documented constraint is that `queryFn` must be a pure function that fetches and returns data; side effects that mutate external state must live in `onSuccess` or `useEffect`.

**Fix:**
```tsx
// Remove resetFlow() from queryFn entirely.
// Add a useEffect that fires once when the order loads successfully.
const resetFlow = useCheckoutStore((s) => s.resetFlow);

useEffect(() => {
  if (order) {
    resetFlow();
  }
}, [order, resetFlow]);

// queryFn becomes pure:
queryFn: async () => {
  if (!orderId) return null;
  try {
    const res = await apiClient.get<OrderResponse>(`/account/orders/${orderId}`);
    return res.data;
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 404) return null;
    throw err;
  }
},
```

---

### CR-02: `useCheckoutStore()` called twice inside the same component — creates two separate subscriptions

**File:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx:56-62` and `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx:117`
**Issue:** `useCheckoutStore()` is called twice in `CheckoutPaymentPage`: once at line 56 (destructuring `selectedAddressId`, `walletCreditRequested`, `appliedCouponCode`, `setWalletCreditRequested`, `setPaymentResult`) and again at line 117 (to read `paymentResult`). The second call creates a second subscription. While this is not a crash, it means `paymentResult` and `setPaymentResult` come from different subscription instances, and the render triggered by the first `setPaymentResult` call may not synchronously expose the new `paymentResult` to the second subscription before the render — depending on the Zustand scheduler. The idiomatic fix is a single `useCheckoutStore` call.

Beyond the subscription issue, this also means `setPaymentResult` was called in the first destructure but `paymentResult` is read from a second separate call, which obscures the data flow.

**Fix:**
```tsx
// Single store access — remove the second useCheckoutStore() call at line 117
const {
  selectedAddressId,
  walletCreditRequested,
  appliedCouponCode,
  paymentResult,          // add here
  setWalletCreditRequested,
  setPaymentResult,
} = useCheckoutStore();
// Delete the second `const { paymentResult } = useCheckoutStore();` at line 117
```

---

### CR-03: Razorpay `onSuccess` navigates without verifying the webhook-confirmed order — client trusts client-reported payment

**File:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx:248`
**Issue:** The Razorpay `onSuccess` callback is:
```tsx
onSuccess={() => { void navigate(`/order-confirmation/${paymentResult.orderId}`); }}
```
The Razorpay handler fires client-side when the Razorpay modal reports success, but the `razorpay_payment_id`, `razorpay_order_id`, and `razorpay_signature` returned in the `RazorpayResponse` are never sent to the server for signature verification. The server must verify the HMAC signature (`razorpay_order_id + "|" + razorpay_payment_id` signed with the Razorpay key secret) to confirm the payment is genuine.

Without this, any client could open the modal, cancel payment, manually call `navigate()` with a known `orderId`, and land on the order-confirmation page with a "confirmed" UI — even though no money was taken and the order status remains `pending_payment`.

This is a **trust-the-client** gap in the payment flow. The `RazorpayButton.onSuccess` callback receives `RazorpayResponse` with all three signature fields; those fields must be POST-ed to the backend (e.g. `POST /checkout/razorpay/verify`) before navigation.

**Fix:**
```tsx
// In CheckoutPaymentPage, replace the onSuccess prop:
onSuccess={async (response) => {
  try {
    await apiClient.post('/checkout/razorpay/verify', {
      razorpayPaymentId: response.razorpay_payment_id,
      razorpayOrderId: response.razorpay_order_id,
      razorpaySignature: response.razorpay_signature,
      orderId: paymentResult.orderId,
    });
    void navigate(`/order-confirmation/${paymentResult.orderId}`);
  } catch {
    addToast({
      id: crypto.randomUUID(),
      message: 'Payment verification failed. Please contact support.',
      variant: 'error',
    });
  }
}}
```

---

### CR-04: `WalletCreditToggle` checkbox `checked` state is independent of `appliedMinor` prop — stale UI after parent reset

**File:** `apps/web-storefront/src/components/wallet/WalletCreditToggle.tsx:51`
**Issue:** The checkbox `checked` state is stored in local `useState(isApplied)`. The initial value is derived from `appliedMinor > 0`, but after that the local state is disconnected from the prop. If the parent resets `appliedMinor` to 0 (e.g., when the wallet summary refreshes or the component re-mounts), the checkbox remains visually checked while the parent holds `appliedMinor = 0`. Conversely, if `appliedMinor` is restored to a positive value from another source (page back/forward), `checked` stays `false`.

This creates a UI lie: the checkbox appears checked (or unchecked) in a state inconsistent with the actual `appliedMinor` value sent to the server. Because `walletCreditRequested` in the Zustand store flows to `usePlaceOrder`, an inconsistent checkbox can silently result in the wrong wallet credit amount being submitted.

**Fix:**
Derive `checked` from props rather than local state, making the component controlled:
```tsx
// Remove: const [checked, setChecked] = useState(isApplied);
// Derive checked directly:
const checked = appliedMinor > 0;

function handleToggle(e: React.ChangeEvent<HTMLInputElement>) {
  onAppliedChange(e.target.checked ? maxCredit : 0);
}
```

---

### CR-05: `useWalletEntries` query is defined but never used — dead export that also has no auth error handling

**File:** `apps/web-storefront/src/hooks/useWallet.ts:60-70`
**Issue:** `useWalletEntries` exports a query for `GET /account/wallet/entries`, but no component in the reviewed file set calls it. `WalletPage` uses `useWallet()` (which already includes `entries` from the combined `WalletLedgerResponse`), and `useWalletEntries` fetches the same data via a separate endpoint. Beyond being dead code, `useWalletEntries` does not handle the `401` case (unlike `useWallet`) — if the user is unauthenticated when this hook fires, the error will propagate uncaught to React Query's error boundary rather than returning `null`.

**Fix:**
If the hook is not needed, remove it. If it is needed in the future, add the same 401 handling as `useWallet`:
```ts
queryFn: async () => {
  try {
    const res = await apiClient.get<WalletEntriesResponse>('/account/wallet/entries');
    return res.data.entries;
  } catch (err: unknown) {
    if (err instanceof ApiError && err.status === 401) return [];
    throw err;
  }
},
```

---

### CR-06: `CheckoutGuard` guard logic inversion — step can be accessed when it should be blocked

**File:** `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx:88`
**Issue:** The redirect condition is:
```tsx
if (STEP_ORDER[earliestAllowed] < STEP_ORDER[step]) {
```
This fires a redirect when `earliestAllowed < step` (i.e., "you can go to a step *earlier* than this one"), which is the wrong direction. The guard is supposed to block *forward* skipping — it should redirect when the user is trying to access a step *further ahead* than they are allowed. The condition should be:
```
if (STEP_ORDER[earliestAllowed] < STEP_ORDER[step])  ← WRONG: redirects when ahead is allowed
```
Walk through an example: the user lands on `/checkout/payment` (step=2) without setting `selectedDeliveryOption`. `earliestAllowed` returns `'delivery'` (order=1). The condition is `1 < 2` → `true` → redirect fires. In this case the redirect is correct.

But consider: the user is at `/checkout/address` (step=0) with `earliestAllowed='address'` (order=0). Condition: `0 < 0` → `false` → no redirect. Correct.

Then: the user hits `/checkout/review` (step=3) without `paymentResult`. `earliestAllowed='payment'` (order=2). Condition: `2 < 3` → `true` → redirect to `/checkout/payment`. Correct.

The logic is accidentally correct for all forward-skip cases. **However**, the guard does *not* prevent a user from navigating *backward* to a completed step (e.g., going from `/checkout/payment` back to `/checkout/address`), which would silently allow re-selecting an address after inventory has been reserved, leaving a stale `selectedAddressId` in the Zustand store without calling `useInitiateCheckout` again. This is a flow integrity issue — re-selecting an address without re-initiating checkout means the server's reserved inventory is bound to the old address.

The guard was designed to prevent forward skipping only (which it does). The concern is the *backward* direction is not handled — users can freely navigate backward, change state, and not re-trigger the initiation step.

**Fix:** Add an explicit comment clarifying backward navigation is intentionally unguarded (if that is the design intent). If backward re-navigation must re-trigger initiation, detect re-entry to `/checkout/delivery` with a dirty address and call `useInitiateCheckout` again. At minimum, when the user returns to `/checkout/address` and selects a different address, `selectedDeliveryOption` should be cleared to force re-selection:
```tsx
// In CheckoutAddressPage handleContinue:
setSelectedAddressId(effectiveSelectedId);
setSelectedDeliveryOption(null); // Reset so delivery step re-initiates checkout
void navigate('/checkout/delivery');
```

---

### CR-07: Hardcoded currency `'INR'` in `RazorpayButton` — breaks multi-currency buyers

**File:** `apps/web-storefront/src/components/checkout/RazorpayButton.tsx:139`
**Issue:** The currency field is hardcoded:
```tsx
currency: 'INR',
```
The CLAUDE.md project brief describes Grovio as a "commercially sellable starter kit" targeting multiple verticals and buyers. Razorpay supports multiple currencies (USD, EUR, SGD, etc.) but the integration hardcodes INR. Buyers deploying for non-INR markets will send the wrong currency to Razorpay, causing either silent incorrect charges (if Razorpay defaults to INR) or payment creation failures.

The `formatMinor` helper across all pages also hardcodes the `₹` symbol, but the currency issue in the Razorpay constructor is the critical one because it reaches the payment processor.

**Fix:**
Pass currency as a prop sourced from the server's `InitiatePaymentResult` or a feature-flagged configuration value. At minimum, read it from a VITE env var:
```tsx
// Add to RazorpayButtonProps:
currency: string; // e.g. 'INR', 'USD' — from server or config

// In openModal():
currency: currency,
```

---

## Warnings

### WR-01: `apiClient.get` responses unwrapped incorrectly — `res.data` accesses the envelope `data` property but `apiClient.get` returns the full JSON body

**File:** `apps/web-storefront/src/hooks/useCheckout.ts:119`, `apps/web-storefront/src/hooks/useWallet.ts:44`, and all query functions
**Issue:** The `apiClient.get<T>` method returns `T` directly (the parsed JSON body, typed as `T`). In `useCheckoutSummary`, the hook types the return as `CheckoutSummaryResponse` and then accesses `.data` on it:
```ts
const res = await apiClient.get<CheckoutSummaryResponse>('/checkout/summary');
return res.data;
```
This works at runtime only if the actual JSON has a top-level `{ success, data }` envelope — which appears to be the convention. But the typing is misleading: `apiClient.get<CheckoutSummaryResponse>` types `res` as `CheckoutSummaryResponse`, then `res.data` is typed as `CheckoutSummary`. This is fine as long as the server actually returns `{ success, data }`. However, if any endpoint returns a non-enveloped response (e.g., during error fallback or a 204), `.data` will be `undefined` and the query will silently return `undefined` typed as `CheckoutSummary`, bypassing the `null` fallback path and potentially causing downstream `summary.subtotalMinor` crashes. The pattern needs either a runtime envelope check or a stricter shared type.

**Fix:**
Add an envelope type guard in the query functions, or create a shared `unwrapEnvelope` helper that asserts `.success === true` and throws if not:
```ts
function unwrapEnvelope<T>(res: { success: boolean; data: T }): T {
  if (!res.success) throw new Error('API returned success: false');
  return res.data;
}
// Then: return unwrapEnvelope(res);
```

---

### WR-02: `CheckoutAddressPage` does not call `setSelectedDeliveryOption(null)` when a new address is selected — stale delivery option remains

**File:** `apps/web-storefront/src/pages/checkout/CheckoutAddressPage.tsx:217-221`
**Issue:** When the user returns to `/checkout/address` and selects a different address, the `handleContinue` function only calls `setSelectedAddressId(effectiveSelectedId)` but does not clear `selectedDeliveryOption` from the Zustand store. If the user previously completed the delivery step (setting `selectedDeliveryOption = 'express'`), then comes back and picks a different address, the delivery step will show the previously selected option as already selected, and the `CheckoutGuard` for `/checkout/delivery` will pass through without re-initiating checkout. The server-side inventory reservation (from `useInitiateCheckout`) is tied to the original address — now the guard won't force re-initiation.

**Fix:**
```tsx
function handleContinue() {
  if (!effectiveSelectedId) return;
  setSelectedAddressId(effectiveSelectedId);
  setSelectedDeliveryOption(null); // force delivery step re-selection when address changes
  void navigate('/checkout/delivery');
}
```
This requires destructuring `setSelectedDeliveryOption` from `useCheckoutStore` in this component.

---

### WR-03: `loadRazorpayScript` polling fallback for concurrent loads leaks the interval if the component unmounts

**File:** `apps/web-storefront/src/components/checkout/RazorpayButton.tsx:57-64`
**Issue:** When `loadRazorpayScript()` is called while a load is already in progress (`scriptLoading === true`), it starts a `setInterval` that polls `scriptLoaded` every 50ms. If the `RazorpayButton` component unmounts while this interval is running (e.g., user navigates away during script load), the interval continues indefinitely. Because `scriptLoaded` and `scriptLoading` are module-level variables (not cleaned up on unmount), the interval will eventually resolve `scriptLoaded = true` and call `resolve()` on the original promise — but there is no component to receive the result. This is a minor memory leak but also a logic concern: if the script actually fails, `scriptLoading = false` is set by `onerror` but the interval never observes this path (it only checks `scriptLoaded`), so the interval runs forever if the script fails to load.

**Fix:**
Add a timeout and an error-state check in the polling interval:
```ts
return new Promise((resolve, reject) => {
  const start = Date.now();
  const interval = setInterval(() => {
    if (scriptLoaded) { clearInterval(interval); resolve(); return; }
    if (!scriptLoading) { clearInterval(interval); reject(new Error('Razorpay script load failed')); return; }
    if (Date.now() - start > 10000) { clearInterval(interval); reject(new Error('Razorpay script load timeout')); }
  }, 50);
});
```

---

### WR-04: `CheckoutDeliveryPage` delivery options are a static hardcoded list — price shown to the user is not server-authoritative

**File:** `apps/web-storefront/src/pages/checkout/CheckoutDeliveryPage.tsx:31-46`
**Issue:** `DELIVERY_OPTIONS` is a static array with hardcoded `priceLabel: 'Free'` and `priceLabel: '₹99'`. The comment in the file acknowledges this: "driven by backend in a full integration; static list here". However, the `useCheckoutSummary` hook returns a server-authoritative `shippingMinor` value that is shown on the payment page. The delivery option price displayed on the delivery step does not match the authoritative value from the server, which means a user could see "Express: ₹99" on the delivery page but the server charges a different amount.

In the current code this is an acknowledged stub. However it is a UX correctness gap that could mislead customers, and since this is a commercially-sold starter kit, buyers will likely deploy this as-is.

**Fix:**
Fetch delivery options from `GET /checkout/delivery-options` (or similar endpoint) and show server-derived price labels. At minimum, show the shipping cost from `useCheckoutSummary().data.shippingMinor` after option selection rather than the static label.

---

### WR-05: `StripePaymentForm` — `amountMinor` prop is received but never used (dead prop)

**File:** `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx:41`, `apps/web-storefront/src/components/checkout/StripePaymentForm.tsx:108`
**Issue:** `StripeInnerFormProps` declares `amountMinor: number`, and `StripePaymentFormProps` also declares `amountMinor: number` with the comment "for display purposes only." Neither component uses this value anywhere in the render tree — it is accepted, passed to `StripeInnerForm`, and then silently dropped. The prop is therefore dead. This is a minor code quality issue but misleads integrators into thinking amount is displayed or validated client-side.

**Fix:**
Either remove the `amountMinor` prop from both interfaces and the call site in `CheckoutPaymentPage`, or actually use it to display the charge amount above the `PaymentElement`.

---

### WR-06: `CheckoutRootGuard` basket-empty check has an inconsistent null guard

**File:** `apps/web-storefront/src/components/checkout/CheckoutGuard.tsx:129`
**Issue:** The empty-basket redirect condition is:
```tsx
if ((basket?.itemCount ?? 0) === 0 && basket !== undefined) {
```
`basket` is declared `useBasket().basket`, which can be `undefined` while loading (and `basketLoading` is false only after data arrives). When `basket` is `undefined` and loading is complete (e.g., the query returned `undefined` as its data), `basket !== undefined` is `false`, so no redirect fires — a customer with a broken basket query can reach the checkout. However, if the API returns a valid response with `itemCount: 0`, `basket !== undefined` is `true` and the redirect fires correctly.

The more subtle issue: the guard uses `basket !== undefined` as a proxy for "basket loaded," but React Query types the basket as potentially `undefined` even after loading (if `data` was never set). The condition should use the React Query `isSuccess` flag from `useBasket()` to be explicit, rather than checking `basket !== undefined`.

**Fix:**
```tsx
const { basket, isLoading: basketLoading, isSuccess: basketSuccess } = useBasket();
// ...
if (basketSuccess && (basket?.itemCount ?? 0) === 0) {
  return <Navigate to="/cart" replace />;
}
```

---

### WR-07: `OrderDetailPage` query key is `['order', id]` — same as `OrderConfirmationPage`'s key — unintended cache sharing

**File:** `apps/web-storefront/src/pages/account/OrderDetailPage.tsx:206`, `apps/web-storefront/src/pages/OrderConfirmationPage.tsx:53`
**Issue:** Both `OrderDetailPage` and `OrderConfirmationPage` use the query key `['order', orderId]` / `['order', id]`. These two pages fetch from the same endpoint (`/account/orders/:id`) and share the same cache entry. This is intentional for data freshness (the confirmation page's result pre-warms the detail page), but `OrderConfirmationPage`'s `queryFn` has the `resetFlow()` side effect (CR-01) inside it. When the user navigates from the confirmation page to the order detail page, React Query reuses the same cache entry and does not re-run `queryFn`. If the cache has expired by the time the user visits the detail page directly (e.g., deep-linked), the `queryFn` for `OrderDetailPage` runs — which is fine since it does not have the side-effect. But if the cache is still fresh, the detail page sees stale data without a refetch.

Beyond the CR-01 interaction: the intentional sharing is not documented and could surprise future developers. Given `OrderDetailPage` also does a `returnMutation.onSuccess` that invalidates `['order', id]`, the confirmation page cache could be busted on a return request — which may trigger the confirmation page to re-run `resetFlow()` (once CR-01 is fixed with `useEffect`, this is no longer a crash, but the key sharing still warrants a comment).

**Fix:**
At minimum, document the intentional cache-key overlap. For stronger isolation, use `['account', 'orders', id]` as the key in `OrderDetailPage` and `['checkout', 'confirmation', orderId]` in `OrderConfirmationPage`.

---

### WR-08: `CheckoutPaymentPage` — `WalletCreditToggle.orderTotalMinor` is computed client-side from summary fields, not from `grandTotalMinor`

**File:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx:170-174`
**Issue:** The `orderTotalMinor` passed to `WalletCreditToggle` is:
```tsx
orderTotalMinor={summary.subtotalMinor + summary.shippingMinor - summary.discountMinor}
```
This is a client-side reconstruction of the pre-wallet total, which is arithmetically equivalent to `grandTotalMinor + walletAppliedMinor` (since `grandTotalMinor = subtotal + shipping - discount - walletApplied`). However, if the server includes any other adjustments in `grandTotalMinor` that are not individually surfaced in the summary fields (e.g., a future "platform fee" field), the client-computed cap would be wrong. The server-authoritative pre-wallet total is not directly returned in the current `CheckoutSummarySchema` — using a derived client formula for the cap is fragile.

**Fix:**
Add a `preWalletTotalMinor` (or `chargeableBeforeWalletMinor`) field to `CheckoutSummarySchema` so the cap is always server-derived. As an interim fix, use:
```tsx
orderTotalMinor={summary.grandTotalMinor + summary.walletAppliedMinor}
```
which is always the correct pre-wallet total given the schema's invariant.

---

## Info

### IN-01: `isPending` variable shadows unused — `isPending` for `CheckoutProgress` step

**File:** `apps/web-storefront/src/components/checkout/CheckoutProgress.tsx:56`, `122`
**Issue:** `isPending` is computed (`const isPending = index > currentIndex`) but the only use is `{isPending && null}` at line 122 — a no-op expression added with a comment "Suppress unused variable warning." This pattern is an anti-pattern: it suppresses a legitimate "unused variable" diagnostic by consuming the variable in a way that does nothing. The variable should simply be removed if it is not used in render logic.

**Fix:**
Remove `isPending` declaration and the `{isPending && null}` expression entirely.

---

### IN-02: Duplicated `formatMinor` helper across 6 files

**File:** Multiple — `WalletCreditToggle.tsx:19`, `CheckoutPaymentPage.tsx:41`, `CheckoutReviewPage.tsx:24`, `OrderConfirmationPage.tsx:37`, `OrdersPage.tsx:30`, `OrderDetailPage.tsx:43`, `WalletPage.tsx:19`
**Issue:** The `formatMinor` function is copy-pasted verbatim with identical hardcoded `₹` currency symbol across seven files. This also ties into CR-07 (hardcoded INR). A shared utility would ensure currency symbol changes (needed for non-INR buyers) only require a single edit.

**Fix:**
Extract to `packages/ui/src/utils/format-currency.ts` or `apps/web-storefront/src/lib/format.ts`:
```ts
export function formatMinor(minor: number, currencySymbol = '₹'): string {
  return `${currencySymbol}${(minor / 100).toFixed(2)}`;
}
```

---

### IN-03: Duplicated `STATUS_LABELS` and `STATUS_COLORS` records across `OrdersPage` and `OrderDetailPage`

**File:** `apps/web-storefront/src/pages/account/OrdersPage.tsx:40-56`, `apps/web-storefront/src/pages/account/OrderDetailPage.tsx:53-69`
**Issue:** The `STATUS_LABELS` and `STATUS_COLORS` constant objects are identical in both files. Any future `OrderStatus` addition in contracts requires updating both.

**Fix:**
Move to a shared module, e.g. `apps/web-storefront/src/lib/order-status.ts`, and import in both pages.

---

### IN-04: `CheckoutPaymentPage` comment says "stub here for Task 1; full implementation replaces in Task 2" — stale comment

**File:** `apps/web-storefront/src/pages/checkout/CheckoutPaymentPage.tsx:12-14`
**Issue:** The file header comment reads: "This file is created in Task 2 (05-12). The stub here satisfies the Task 1 router import; the full implementation replaces it in Task 2." The full implementation is present in the file, so the comment is stale and misleading.

**Fix:**
Remove the stub/task comment from the file header JSDoc.

---

_Reviewed: 2026-06-05T00:00:00Z_
_Reviewer: Claude (gsd-code-reviewer)_
_Depth: standard_
