---
status: partial
phase: 03-catalog-search
source: [03-VERIFICATION.md]
started: 2026-06-01T09:10:00Z
updated: 2026-06-01T09:10:00Z
---

## Current Test

[awaiting human testing]

## Tests

### 1. Full test suite
expected: `pnpm --filter @grovio/api test` exits 0 with 272 passing tests
result: [pending]

### 2. Vendor register/login JWT flow
expected: POST /vendor/auth/register → 201 with vendor record; POST /vendor/auth/login → 200 with JWT; JWT accepted on /vendor/products
result: [pending]

### 3. Product state machine end-to-end
expected: draft → PUT /submit → pending_review; POST /admin/products/:id/approve → approved; POST /admin/products/:id/reject with rejectionReason → rejected
result: [pending]

### 4. Edit pending product resets to draft
expected: PATCH /vendor/products/:id while status=pending_review → product status reverts to draft
result: [pending]

### 5. Search graceful 503 degradation
expected: Without OPENSEARCH_URL set, GET /search returns 503 { code: "SEARCH_UNAVAILABLE" } instead of 500
result: [pending]

### 6. Suggest 2-char minimum returns 400
expected: GET /search/suggest?q=a (1 char) → 400; GET /search/suggest?q=ab (2 chars) → 200
result: [pending]

### 7. Image presign + count guard
expected: POST /vendor/products/:id/images/presign on a product already at MAX_IMAGES_PER_PRODUCT → 422 with ImageLimitError
result: [pending]

### 8. GET /categories/:id/filters with Redis caching
expected: First call computes filter schema and caches under category_filter_schema:{id}; second call is served from Redis cache
result: [pending]

## Summary

total: 8
passed: 0
issues: 0
pending: 8
skipped: 0
blocked: 0

## Gaps
