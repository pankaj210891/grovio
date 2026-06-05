---
status: partial
phase: 06-vendor-admin-tools
source: [06-VERIFICATION.md]
started: 2026-06-05T00:00:00Z
updated: 2026-06-05T00:00:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Vendor role restriction — live sessions at all 3 role levels
expected: owner sees Team + Store Profile + Settings; manager/staff do not; staff cannot access owner-only pages
result: [pending]

### 2. Inventory edit persistence after page refresh
expected: editing qty or price via inline form PATCHes the DB; values survive refresh
result: [pending]

### 3. Returns approve triggers actual refund
expected: approving a return calls the refund pathway (wallet credit or payment reversal)
result: [pending]

### 4. Team invite accept flow with second-browser staff session
expected: invite email link works; staff sets password; logs in with correct role; owner-only nav hidden
result: [pending]

### 5. Admin dashboard charts with seeded data
expected: recharts line (orders-by-day) + bar (GMV-by-category) render with real data for 7d/30d/90d toggle
result: [pending]

### 6. Vendor suspension enforcement blocking login
expected: suspending a vendor in admin panel causes that vendor's login to return 403/401
result: [pending]

### 7. Global commission rule 403 via actual API request
expected: DELETE /admin/commission-rules/{global-id} returns 403; UI shows no delete button
result: [pending]

### 8. CMS reorder → storefront Redis cache invalidation
expected: reordering homepage blocks in admin causes storefront to reflect the new order within one cache TTL
result: [pending]

### 9. Feature flag COUPONS_ENABLED propagating to vendor sidebar
expected: toggling COUPONS_ENABLED in admin FeatureFlags page causes Coupons nav item to appear/disappear in vendor panel
result: [pending]

### 10. Settlement audit trail DB inspection
expected: recording a settlement in PayoutManagement creates an append-only entry in vendor_payouts + audit_log row with action 'payout.settled'
result: [pending]

## Summary

total: 10
passed: 0
issues: 0
pending: 10
skipped: 0
blocked: 0

## Gaps
