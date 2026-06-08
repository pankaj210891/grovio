---
phase: 11
plan: "05"
subsystem: api
tags: [wishlist, reviews, notifications, personalization, support, invoice, analytics, bullmq]
dependency_graph:
  requires:
    - "11-02"  # announcements table (admin portal)
    - "05-10"  # orders, order_items, basket_items, products tables
    - "04-05"  # customers, customer-addresses
    - "06-08"  # admin auth, vendor auth patterns
    - "03-07"  # SearchService, BullMQ job infrastructure
  provides:
    - wishlist API (add/remove/list/status) with price drop detection
    - product reviews API (CRUD, vendor reply, admin moderation, avg_rating cache)
    - customer notifications API + PriceDropCheckJob
    - personalization endpoints (trending, FBT, related, homepage, search boost)
    - support tickets API (customer submission + replies)
    - PDF invoice download (customer + admin)
    - popular searches BullMQ job + sold_count updates
    - admin product view analytics (most viewed, conversion gap)
  affects:
    - apps/api/src/app.ts (new route registrations)
    - apps/api/src/container.ts (6 new services + 2 queues)
    - apps/api/src/modules/orders/OrderService.ts (sold_count updates)
    - apps/api/src/modules/inventory/InventoryService.ts (PriceDropCheckJob enqueueing)
    - apps/api/src/modules/search/SearchService.ts (personalized function_score)
    - apps/api/src/routes/admin/analytics.ts (2 new insights endpoints)
    - apps/api/src/routes/search.ts (query logging, popular search key update)
tech_stack:
  added:
    - pdfmake 0.3.9 (zero native binary PDF generation)
    - PriceDropCheckJob (BullMQ job — price drop notifications)
    - PopularSearchesJob (BullMQ job — daily popular search aggregation)
  patterns:
    - Awilix PROXY DI for all new services
    - Redis TTL caching for personalization (15min–2h per endpoint)
    - Append-only customer_notifications table (dismissed_at soft-hide)
    - price_at_wishlist_minor snapshot for efficient price drop detection
    - function_score OpenSearch wrapper for personalized search boost
    - Synchronous sold_count update in order creation transaction
key_files:
  created:
    - apps/api/src/modules/wishlist/WishlistService.ts
    - apps/api/src/modules/wishlist/index.ts
    - apps/api/src/routes/wishlist.ts
    - apps/api/src/modules/reviews/ReviewService.ts
    - apps/api/src/modules/reviews/index.ts
    - apps/api/src/routes/reviews.ts
    - apps/api/src/modules/notifications/customer/NotificationService.ts
    - apps/api/src/modules/notifications/customer/index.ts
    - apps/api/src/routes/account/notifications.ts
    - apps/api/src/modules/jobs/PriceDropCheckJob.ts
    - apps/api/src/modules/personalization/PersonalizationService.ts
    - apps/api/src/modules/personalization/index.ts
    - apps/api/src/routes/personalization.ts
    - apps/api/src/modules/support/SupportService.ts
    - apps/api/src/modules/support/index.ts
    - apps/api/src/routes/support.ts
    - apps/api/src/modules/orders/InvoiceService.ts
    - apps/api/src/routes/account/invoice.ts
    - apps/api/src/modules/jobs/PopularSearchesJob.ts
  modified:
    - apps/api/src/app.ts
    - apps/api/src/container.ts
    - apps/api/src/modules/analytics/AnalyticsService.ts
    - apps/api/src/modules/inventory/InventoryService.ts
    - apps/api/src/modules/jobs/queues.ts
    - apps/api/src/modules/jobs/index.ts
    - apps/api/src/modules/orders/OrderService.ts
    - apps/api/src/modules/orders/index.ts
    - apps/api/src/modules/search/SearchService.ts
    - apps/api/src/routes/admin/analytics.ts
    - apps/api/src/routes/search.ts
decisions:
  - "WishlistService uses ON CONFLICT DO NOTHING for upsert — no client-visible duplicate error"
  - "price_at_wishlist_minor snapshot approach avoids storing historical price tables"
  - "PriceDropCheckJob updates ALL wishlist prices after notification to prevent re-notification drift"
  - "NotificationService respects customer preferences before inserting — opt-out is enforced at write time"
  - "PersonalizationService uses raw SQL for DISTINCT ON (recently-viewed) and CTE-based trending"
  - "SearchService function_score wraps existing query with 1.5x boost per purchased category (graceful no-op)"
  - "sold_count incremented synchronously in createPendingOrder transaction (no BullMQ needed per plan)"
  - "pdfmake v0.3.x uses singleton createPdf() API, not the PdfPrinter class from v0.1.x"
  - "InvoiceService uses require() for pdfmake + vfs_fonts (CommonJS module, not ESM-compatible)"
  - "SupportService uses polymorphic (submittedByType, submittedById) pattern — no FK constraint for flexibility"
metrics:
  duration: "~90 minutes (T2–T9, T1 was pre-completed)"
  completed: "2026-06-08"
  tasks_completed: 8
  files_changed: 30
---

# Phase 11 Plan 05: New Feature Backends Summary

**One-liner:** Eight backend modules — wishlist, reviews, notifications, personalization, support tickets, PDF invoice, popular searches, and admin analytics — wired via Awilix DI with Redis caching and BullMQ price drop jobs.

## Tasks Completed

### T1 — DB Migrations (pre-completed in prior session)
Skipped per safe_resume_context. Commits already on branch:
- `0b61efa` feat(11-05): T1 DB migrations — wishlists, reviews, notifications, views
- `bb1589f` chore(11-05): commit pending T1 artifacts and pdfmake pre-install

### T2 — Wishlist API
**Commit:** `0c29104`

`WishlistService` with 5 methods: `addToWishlist` (upsert via ON CONFLICT DO NOTHING, reads `products.basePriceMinor` to populate `price_at_wishlist_minor`), `removeFromWishlist` (hard delete), `listWishlist` (paginated join to products, computes `isPriceDropped = basePriceMinor < priceAtWishlistMinor`), `getWishlistStatus` (batch status map), plus `getWishlistersEligibleForDrop` and `updateWishlistPrices` used by PriceDropCheckJob.

Routes: `POST /wishlist/:productId`, `DELETE /wishlist/:productId`, `GET /account/wishlist`, `GET /wishlist/status?productIds=...` — all guarded by `requireCustomerAuth`.

### T3 — Product Reviews API
**Commit:** `e4b6fee`

`ReviewService` with `createReview` (checks `order_items` for `verified_purchase`, refreshes `products.avg_rating` + `review_count` via aggregate query), `listReviews` (public, `moderated=false` filter, paginated), `addVendorReply` (validates product vendor ownership), `moderateReview` (soft-hide, refreshes aggregates).

Routes: `POST /products/:id/reviews` (customer auth), `GET /products/:id/reviews` (public), `PATCH /vendor/reviews/:id/reply` (vendor auth), `DELETE /admin/reviews/:id` (admin auth, soft-delete only).

### T4 — Customer Notifications API + PriceDropCheckJob
**Commit:** `37e3117`

`NotificationService` with notification listing (undismissed first via `ORDER BY dismissedAt ASC NULLS FIRST`), dismiss (ownership check), preferences get/upsert (order_updates immutable), bulk price drop insert (filters opted-out customers), order update insert.

`PriceDropCheckJob`: queries `getWishlistersEligibleForDrop`, inserts bulk price_drop notifications, updates `wishlists.price_at_wishlist_minor = newPriceMinor` for all rows to prevent re-notification.

Routes: `GET /account/notifications`, `PATCH /notifications/:id/dismiss`, `GET /account/notifications/preferences`, `PATCH /account/notifications/preferences`.

New BullMQ queues: `price-drop-queue` and `popular-searches-queue`.

### T5 — Personalization Backend
**Commit:** `0d7718c`

`PersonalizationService` with 7 capabilities:
1. `recordView` — inserts `customer_product_views`, Redis dedup `view:dedup:{cid}:{pid}` with 5min TTL
2. `getRecentlyViewed` — DISTINCT ON raw SQL, top 10 by `viewed_at DESC`
3. `getTrending` — CTE with weighted score `(order_count_7d × 3) + (view_count_7d × 1)`, Redis-cached 1h
4. `getFrequentlyBoughtTogether` — co-purchase grouping within same `vendor_order_id`, Redis-cached 2h
5. `getRelatedProducts` — same category ±30% price, sorted by `avg_rating DESC`, Redis-cached 1h
6. `getPersonalizedHomepage` — recentlyViewed + continueShoppingCategory + recommendations (order-history based, fallback trending), Redis-cached 15min per customer
7. `getCustomerCategoryAffinity` — returns purchased category IDs for search boost

`SearchService.search()` updated: wraps query in `function_score` with 1.5× boost per purchased category when `customerCategoryIds` is non-empty. Graceful no-op for guests.

`InventoryService.updatePricing()`: enqueues `PriceDropCheckJob` when `newPriceMinor < oldPriceMinor` (non-variant updates only).

Routes: `POST /products/:id/view`, `GET /products/recently-viewed`, `GET /products/trending`, `GET /products/:id/frequently-bought-together`, `GET /products/related/:id`, `GET /homepage/personalized`.

### T6 — Support Tickets API
**Commit:** `1b7c871`

`SupportService` with `createTicket`, `listTicketsBySubmitter`, `getTicketWithReplies` (ownership check, includes replies), `addReply` (optional ownership check for non-admin callers).

Routes: `POST /support/tickets`, `GET /account/support-tickets`, `POST /account/support-tickets/:id/replies` — all customer-auth guarded. Complements admin Wave 2 endpoints.

### T7 — PDF Invoice Endpoint
**Commit:** `30f6057`

`InvoiceService.generateInvoicePdf(orderId, customerId|null)`: fetches order, customer, vendor orders, and line items. Builds pdfmake v0.3 document with: Grovio header, order ID + date, billing info, items table (name/qty/unit price/total), totals section (subtotal, shipping, discount, wallet credit, grand total), footer.

Minor unit display: `(minor / 100).toFixed(2)` — never `parseFloat` on BIGINT (per plan note).

Routes: `GET /orders/:id/invoice` (customer, ownership check), `GET /admin/orders/:id/invoice` (admin, no ownership check). Both return `Content-Type: application/pdf`, `Content-Disposition: attachment; filename="invoice-{orderId}.pdf"`.

### T8 — Popular Searches + sold_count Updates
**Commit:** `0f35a79`

`PopularSearchesJob`: aggregates top 10 queries from `search_query_log` over last N days, stores JSON array in Redis key `search:popular` with 24h TTL. `logSearchQuery()` helper inserts to `search_query_log` asynchronously from the `GET /search` handler (non-blocking).

`GET /search/popular` updated to check `search:popular` key first (new), then fall back to legacy `popular_searches` key.

`OrderService.createPendingOrder()`: added `UPDATE products SET sold_count = sold_count + qty` per line item within the order creation transaction — synchronous, no BullMQ needed.

### T9 — Admin Product View Analytics + DI Wiring
**Commit:** `206f32c`

`AnalyticsService` extended with `getMostViewedProducts` (top 20 by view_count last 7d, includes category name) and `getViewConversionGap` (view_count > 50 AND order_count/view_count < 0.02, last 7d, up to 20).

Admin routes: `GET /admin/insights/product-views`, `GET /admin/insights/view-conversion-gap` (both requireAdminAuth).

`container.ts`: registered `wishlistService`, `reviewService`, `notificationService`, `personalizationService`, `supportService`, `invoiceService`, `priceDropQueue`, `popularSearchesQueue`.

`app.ts`: registered all 6 new route plugins.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Worktree behind develop — merged develop to get T1 schema files**
- **Found during:** Task setup (pre-T2)
- **Issue:** Worktree branch `worktree-agent-af9016ba8729a2540` was at `ef2b59f` (Phase 10), missing T1 schema files that were committed to `develop`
- **Fix:** `git merge develop --no-edit` (fast-forward) in the worktree to bring in all 11-01 through 11-04 work and T1 schemas
- **Impact:** None — fast-forward merge, no conflicts

**2. [Rule 1 - Bug] pdfmake v0.3.x API mismatch — singleton createPdf(), not PdfPrinter class**
- **Found during:** Task 7 TypeScript compilation
- **Issue:** Initial InvoiceService used `PdfPrinter` class (pdfmake v0.1.x API), but installed version is 0.3.9 which exports a singleton
- **Fix:** Rewrote InvoiceService to use `require('pdfmake').createPdf(docDef).getBuffer(callback)` pattern; added `require` for CJS compatibility

**3. [Rule 1 - Bug] PersonalizationService used `products.archived_at` column name instead of `products.archivedAt` camelCase Drizzle accessor**
- **Found during:** Task 5 TypeScript compilation
- **Fix:** Changed to `products.archivedAt` (Drizzle ORM camelCase property name)

**4. [Rule 1 - Bug] `exactOptionalPropertyTypes: true` violations in notifications route and reviews route**
- **Found during:** TypeScript compilation
- **Fix:** Changed to conditionally-built objects (`const input = {}; if (x !== undefined) input.x = x`) rather than spreading possibly-undefined values

**5. [Rule 3 - Blocking] Files written to main repo checkout instead of worktree**
- **Found during:** Pre-commit verification
- **Issue:** All new files were written to `D:/My Projects/grovio/` (main repo on `develop`) instead of the worktree path
- **Fix:** Copied all 30 files from main repo to worktree via Bash cp commands

## Known Stubs

None. All endpoints are fully wired to database queries and return real data.

## Threat Flags

| Flag | File | Description |
|------|------|-------------|
| threat_flag: idor_risk | apps/api/src/routes/account/invoice.ts | Invoice endpoint validates customer ownership via `order.customerId !== customerId`; admin bypass uses `null` customerId — correct pattern, documented for review |
| threat_flag: bulk_write | apps/api/src/modules/notifications/customer/NotificationService.ts | `insertBulkPriceDropNotifications` can insert O(n) rows where n = wishlisters; no rate limit on job trigger. Acceptable at v1 catalog scale. |

## Self-Check

### Commits exist:
- T2: `0c29104` feat(11-05): T2 Wishlist API
- T3: `e4b6fee` feat(11-05): T3 Product reviews API
- T4: `37e3117` feat(11-05): T4 Customer notifications API + PriceDropCheckJob
- T5: `0d7718c` feat(11-05): T5 Personalization
- T6: `1b7c871` feat(11-05): T6 Support tickets API
- T7: `30f6057` feat(11-05): T7 PDF invoice endpoint
- T8: `0f35a79` feat(11-05): T8 Popular searches job + sold_count updates
- T9: `206f32c` feat(11-05): T9 Admin analytics + DI wiring

### Key files exist in worktree:
- apps/api/src/modules/wishlist/WishlistService.ts ✓
- apps/api/src/modules/reviews/ReviewService.ts ✓
- apps/api/src/modules/notifications/customer/NotificationService.ts ✓
- apps/api/src/modules/jobs/PriceDropCheckJob.ts ✓
- apps/api/src/modules/personalization/PersonalizationService.ts ✓
- apps/api/src/modules/support/SupportService.ts ✓
- apps/api/src/modules/orders/InvoiceService.ts ✓
- apps/api/src/modules/jobs/PopularSearchesJob.ts ✓

## Self-Check: PASSED
