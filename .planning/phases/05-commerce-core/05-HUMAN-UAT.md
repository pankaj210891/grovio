---
status: partial
phase: 05-commerce-core
source: [05-VERIFICATION.md]
started: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Current Test

[awaiting human testing — approved for deferred verification once full app is ready]

## Tests

### 1. Complete the checkout + payment + order/wallet end-to-end flow
expected: 4-step guard prevents step skipping; Stripe/Razorpay payment options match configured keys; wallet hybrid charge shows correct card-charge remainder; successful payment lands on /order-confirmation with order ID; order appears in /account/orders with vendor grouping and return request action; /account/wallet shows balance and ledger with debit entry after wallet payment
result: [pending]

## Summary

total: 1
passed: 0
issues: 0
pending: 1
skipped: 0
blocked: 0

## Gaps
