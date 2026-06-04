# Phase 11: UX/UI Platform Redesign - Context

**Gathered:** 2026-06-04
**Status:** Ready for planning

<domain>
## Phase Boundary

Deliver a complete UX/UI redesign of all three web portals — Customer Storefront (`apps/web-storefront`), Admin Panel (`apps/web-admin`), and Vendor Panel (`apps/web-vendor`) — replacing generic template-driven screens with workflow-first, 2026-product-mindset experiences. Phase 11 also ships a shared cross-app component library (`packages/ui`), personalization backend infrastructure, a reviews/ratings system, wishlist, notification center, support ticket system, admin RBAC, KYC file upload, i18n foundation, and PDF invoice generation.

**Phase 6 relationship:** Phase 6 builds backend services + basic functional UI for admin and vendor panels. Phase 11 subsequently redesigns all three web portals to the full UX spec defined in this context. Phase 6 decisions (D-20 sidebar layout, nav structure, etc.) are the starting point — Phase 11 extends and enhances them.

**Execution order (internal waves):**
1. Wave 1 — Shared component library (`packages/ui` full cross-app components + design tokens + Storybook)
2. Wave 2 — Admin portal full redesign (command bar + sidebar, all sections)
3. Wave 3 — Vendor portal full redesign (all sections)
4. Wave 4 — Customer storefront redesign (targeted iteration on Phase 4 foundation)
5. Wave 5 — New feature backend + frontend (reviews, wishlist, personalization, notifications, support, PDF invoices, i18n, RBAC, KYC upload, analytics, social sharing, broadcast)

**Specifically NOT in scope:**
- Phase 8 delivery map shell (order tracking map stays in Phase 8)
- Automated vendor payouts via Stripe Connect / Razorpay Route (PAY2-01, v2)
- Push notification delivery (Phase 8 — only in-app notifications in Phase 11)
- PWA / service worker (deferred)
- SSR/SSG for storefront (stays as SPA with react-helmet-async for SEO)
- Real AI / LLM integration for insights (analytics panel, not LLM-generated)

</domain>

<decisions>
## Implementation Decisions

### Customer Storefront — Overall Approach

- **D-01:** **Targeted redesign** — keep Phase 4's working infrastructure: routing structure, auth hooks, React Query data fetching, API client, Zustand stores, and all working page routes. Redesign page layouts, interaction patterns, and add missing features. Phase 4 is not a prototype; it's a proven foundation being upgraded.

- **D-02:** **Mobile navigation** — Responsive split: top `Header.tsx` stays for desktop (≥768px). A fixed bottom navigation bar appears on mobile with 5 thumb-friendly tabs: Home, Categories, Search, Cart, Account. The bottom nav is a new component; `Header.tsx` is hidden on mobile via Tailwind responsive utilities.

### Customer Storefront — Homepage

- **D-03:** **Backend-personalized homepage** — Customer JWT triggers a personalized block variant from the server. New `GET /homepage/personalized` endpoint reads customer's view history, wishlist, and purchase history to inject personalization sections alongside the admin-managed CMS blocks. Guest fallback: trending + popular categories only (no personalized sections). Guest view history tracked in localStorage and synced to server on login.

- **D-04:** **Guest vs. authenticated personalization split:**
  - **Guest**: trending products (weighted score), category shortcuts, popular searches
  - **Authenticated**: all guest content + Recently Viewed (last 10), Continue Shopping (last browsed category), Personalized Recommendations (based on purchase/view history)

### Customer Storefront — Product Listing Page (PLP)

- **D-05:** **View modes**: Grid + List toggle. Grid = 2-3 columns with image-dominant ProductCard. List = single column with image + full details side by side. Preference persisted in localStorage.

- **D-06:** **Sticky filter bar redesign**: `FilterSidebar` redesigned to be sticky on scroll, collapsible via a toggle button, and active filter chips displayed in a horizontal strip above the product grid. This replaces the current non-sticky sidebar behavior.

- **D-07:** **Product comparison tray**: Floating comparison tray at bottom of screen when products are selected for comparison (up to 3). Side-by-side attribute table. New Zustand comparison store (`useComparisonStore`) — no backend changes needed.

### Customer Storefront — Product Detail Page (PDP)

- **D-08:** **PDP full redesign scope**:
  - Rich image gallery with swipe gestures and zoom (mobile), keyboard navigation (desktop)
  - Video support (product video URL field on product schema; embedded player if URL present)
  - Variant selection redesign: visual swatches for color attributes, size chips for size attributes (replacing dropdowns)
  - Delivery estimation: pincode input field → `GET /serviceability?pincode=XXX` endpoint
  - Trust badges: Secure Checkout badge, return policy summary (from `vendor_return_policies`), sold count
  - **Full reviews & ratings system** — new scope: `product_reviews` table (customer_id, product_id, rating 1-5, title, body, verified_purchase bool, created_at), average rating computed and stored/cached per product, vendor can respond to reviews, admin can moderate/remove reviews

- **D-09:** **PDP recommendation sections**:
  - Frequently Bought Together: co-purchase query from `order_items` — products frequently ordered with this product
  - Related Products: same category, similar price range
  - Both sourced from new backend endpoints, cached in Redis

- **D-10:** **Social sharing on PDP**: Web Share API with copy-to-clipboard fallback. Share button shows: WhatsApp, copy link options. Also available on order confirmation page.

### Customer Storefront — Search

- **D-11:** **Enhanced search UX**: search history (localStorage, last 5 queries shown on focus), popular searches (new `GET /search/popular` endpoint, cached), improved type-ahead UI with category grouping (e.g., "laptops" shows results under Electronics, Accessories). Camera icon present for image search (routes to coming-soon placeholder). Voice icon present but non-functional in v1. OpenSearch powers all backend — no new AI infrastructure.

### Customer Storefront — Cart

- **D-12:** **Inline coupon suggestions**: When customer opens the coupon input field, a dropdown shows applicable coupons from new `GET /coupons/available` endpoint (filters by: not expired, usage limit not reached, minimum order amount met, scope matches cart contents). Tap to apply. Existing coupon code input field retained for manual entry.

- **D-13:** **Cart recommendations**: 'You might also like' section at bottom of CartPage — products from categories of items in cart. New backend endpoint.

### Customer Storefront — Wishlist

- **D-14:** **Wishlist system** (new scope): Heart icon on `ProductCard` component. Wishlist persisted to account via new `wishlists` table (`customer_id`, `product_id`, `created_at`). New endpoints: `POST/DELETE /wishlist/:productId`, `GET /account/wishlist`. New `/account/wishlist` page. Guest wishlist tracked in localStorage, synced on login.

- **D-15:** **Price drop alerts**: When a wishlisted product's price drops, show a "Price Dropped!" badge on the `/account/wishlist` page. Checked on wishlist page load — no real-time push in v1.

### Customer Storefront — Checkout

- **D-16:** **One-page checkout**: Single `/checkout` route with accordion sections. Address, delivery, payment, and review sections expand in sequence as each prior section is completed. No full-page navigations. The Phase 5 multi-step URL structure (`/checkout/address`, etc.) is replaced by a single route with accordion state management. Back navigation within checkout collapses sections.

- **D-17:** **Guest checkout UX improvements**: Clear 'Continue as Guest' path on checkout entry (alongside sign-in). Email capture field at review step for guests. Post-purchase 'Create Account' prompt on order confirmation page. Backend guest basket/checkout from Phase 5 is unchanged.

### Customer Storefront — Orders

- **D-18:** **Visual order timeline**: `OrderDetailPage` redesigned with a vertical status timeline component showing transitions (Placed → Processing → Shipped → Delivered) with timestamps and icons per step. No map shell (Phase 8). Plus: Reorder button (re-adds all items to basket), Invoice Download button (calls `GET /orders/:id/invoice` PDF endpoint).

### Customer Storefront — Notifications

- **D-19:** **Customer notification center**: Notification bell icon in the storefront header (and in mobile bottom nav Account tab). In-app notifications: order status updates (always on), price drop on wishlisted items (opt-in), return status updates (always on). New `customer_notifications` table. Customer can manage notification preferences in account settings (order updates: always on; price drops: opt-in; promotions: opt-in). No push delivery in v1.

### Admin Portal — Layout

- **D-20:** **Admin layout: sidebar + command bar hybrid**: Phase 6 D-20 sidebar is kept (persistent left sidebar, collapses to icon bar on tablet, hamburger on mobile). Phase 11 adds a **top command bar** above the sidebar+content layout: global search (searches across vendors, products, orders), quick action shortcuts (+ New Admin User, Quick Approve Vendor), notification bell with badge count, and a pending action count badge.

- **D-21:** **Admin sidebar nav update** (supersedes Phase 6 D-20 for admin): Dashboard, Vendors, Catalog Moderation, **Finance** (replaces separate Commission Rules + Payout Management), Orders, CMS / Homepage, Feature Flags, **Insights** (new), **Support** (new), Settings & Branding, Audit & Security (replaces just Audit Log). Categories section retained from Phase 2.

### Admin Portal — Dashboard

- **D-22:** **Actionable KPI tiles + Needs Attention queue**: KPI tiles are clickable — clicking "Pending Approvals: 7" navigates to the filtered vendor list. A "Needs Attention" action queue shows: pending vendor approvals, flagged/pending products, open return requests, failed payment events (payment_events with error status). Admin can act from the dashboard (approve vendor inline, view flagged product) without navigating away. Revenue charts, top vendors table, and GMV by category chart from Phase 6 D-10 are retained.

- **D-23:** **Platform Health widget** on dashboard: API response time (health check latency), BullMQ queue depth and failed job count (from Bull Board API), OpenSearch last sync timestamp. Refreshed every 60 seconds.

- **D-24:** **Admin broadcast announcements**: Admin can create announcements (title, body, target: all customers / all vendors / both, expiry date). New `announcements` table. Customer storefront shows a dismissible banner for active announcements. Vendor portal shows same. Announcement creation/management in admin Dashboard or CMS section.

### Admin Portal — Insights

- **D-25:** **Analytics Insights panel** (no LLM): Dedicated `/admin/insights` section. Content: revenue trend sparklines (7/30/90d), top 10 / bottom 10 vendor performance by GMV, product velocity table (rising/falling sales in last 7 days), customer retention rate (repeat purchaser %), anomaly flags (vendors with >30% GMV drop in 7 days, products with zero sales in 30 days, high return rate alerts). All computed from PostgreSQL + OpenSearch data, cached in Redis with 1-hour TTL.

### Admin Portal — Vendor Management

- **D-26:** **Vendor list: health score cards + inline actions**: Each vendor row expandable to a compact health card showing: KYC status badge, 30-day GMV sparkline, open return rate, inventory health (% products in-stock), outstanding payout balance. Inline actions: Approve, Suspend, Reinstate, Configure (opens detail panel). Phase 6 D-17 data model (onboarding_status, approve/suspend/reinstate, soft-delete) is preserved.

- **D-27:** **Full vendor profile page with KYC workflow**: Each vendor has a full `/admin/vendors/:id` profile page with: KYC document upload/review section (ID proof, GST certificate, bank verification), onboarding checklist (Profile complete, KYC submitted, KYC verified, Bank details added, First product approved), performance history (GMV trend, order count, return rate over time), all payout history. Admin checks off each onboarding step manually.

- **D-28:** **KYC file upload** (new infrastructure): File upload for KYC documents only — free-tier S3-compatible storage (Cloudflare R2 free tier or Supabase Storage). Vendor uploads documents; admin downloads for review. Product images remain URL-input only. New `vendor_kyc_documents` table (`vendor_id`, `document_type`, `file_url`, `uploaded_at`, `verified_at`, `verified_by_admin_email`).

### Admin Portal — Financial Center

- **D-29:** **Unified `/admin/finance`** (supersedes separate Commission Rules + Payout Management sidebar items): 4 tabs:
  1. **Overview** — platform-level P&L strip: Total GMV, Commission Earned, Total Settled, Pending Payouts (sum outstanding), Total Refunds. Period selector 7d/30d/90d.
  2. **Payouts** — per-vendor payout management from Phase 6 D-08 (vendor list, outstanding balance, settle button, settlement history)
  3. **Commissions** — commission ledger across all vendors (Phase 6 D-08 commission entries table)
  4. **Refunds** — all return_requests with refund amounts and status
  Commission Rules management moves to Settings & Branding section (it's configuration, not financial operations).

### Admin Portal — Orders

- **D-30:** **Smart order filters** — advanced filter panel (collapsible): date range picker, vendor multi-select, order status multi-select (pending_payment, processing, shipped, delivered, cancelled), payment method filter, order amount range. Plus saved filter presets (admin can name and save filter combinations, stored in localStorage per admin session). Claude's discretion: exact combination and layout of filter panel vs presets UI.

### Admin Portal — Bulk Actions

- **D-31:** **Checkbox multi-select + floating action bar** on all admin list views (products, vendors, orders). Selecting rows shows a floating action bar at bottom of screen: contextual actions per entity type (products: Approve Selected, Reject Selected, Archive Selected; vendors: Approve Selected, Suspend Selected; orders: Mark Processing, Mark Shipped).

- **D-32:** **Bulk product import via CSV/XLSX**: Admin can upload a CSV or XLSX file to batch-create products. File parsing endpoint (`POST /admin/products/import`) validates schema, maps category attributes, and batch-inserts products in `pending` status. Validation errors returned per row. Same S3-compatible storage for file upload. Column mapping guided by downloadable template CSV.

### Admin Portal — Support Center

- **D-33:** **Minimal support ticket system**: New `support_tickets` table: `id UUID`, `subject TEXT`, `body TEXT`, `submitted_by_type TEXT` (customer/vendor), `submitted_by_id TEXT`, `status TEXT` pgEnum (open/in_progress/resolved), `assigned_to_admin_email TEXT nullable`, `created_at`, `updated_at`. New `support_ticket_replies` table for threaded replies. Admin support section: ticket list (filterable by status, type, date), ticket detail with reply thread, escalation (reassign to different admin). Status transitions logged to `audit_log`.

### Admin Portal — Audit & Security

- **D-34:** **Admin RBAC** (new scope): Admin users have roles: `super_admin` (full access), `moderator` (catalog, vendor approval, support — no finance or settings), `finance_admin` (finance center only — no vendor management or settings). New `admin_roles` and `admin_permissions` tables or a simplified role-to-section permissions map. Sidebar sections check `request.admin.role` in middleware. `admin_users` table from Phase 6 D-21 gains a `role` column.

- **D-35:** **Security event types added to audit_log**: New action types: `auth.failed_login` (with IP), `auth.password_changed`, `auth.admin_token_issued`, `admin_user.created`, `admin_user.role_changed`. Audit log UI gains a "Security Events" filter category.

### Admin Portal — Notifications & Exports

- **D-36:** **Admin notification alerts**: Badge counts on sidebar items (pending vendor approvals count badge on Vendors nav item, pending support tickets count on Support nav item, flagged products count on Catalog nav item). Notification bell in command bar shows a dropdown of recent high-priority events (new vendor application, new flagged product, failed payment webhook). Counts fetched on dashboard load and cached briefly.

- **D-37:** **Export capabilities**: CSV/Excel export buttons on: Orders list, Vendor list, Commission ledger (Finance tab), Payout records (Finance tab), Audit log. Backend: `GET /admin/*/export?format=csv` endpoints, streamed response. Frontend: download trigger on button click.

### Vendor Portal — Dashboard

- **D-38:** **Morning-glance dashboard layout**: Top row: 6 stat tiles (Today's Sales, This Week, This Month, Total Revenue, Total Orders, Total Returns). Below: two-column layout — left column: Released Amount + Pending Amount with sparkline chart (last 14 days), right column: Inventory Alert Feed (products where `quantity_available ≤ low_stock_threshold` with link to Inventory & Pricing page). Everything visible on desktop without scrolling. React Query polling every 60s for freshness.

### Vendor Portal — Products

- **D-39:** **Multi-step product creation wizard**:
  - Step 1: Category select → template auto-fills attribute fields from category template
  - Step 2: Images (drag-drop reorder, upload via free-tier S3) + variants (visual variant builder)
  - Step 3: Pricing, inventory levels, publish/save-as-draft toggle
  - Auto-generate SKU from product name + variant combination (e.g., `TSHIRT-BLK-L`)
  - Draft saving at each step (products can be saved as `draft` status and resumed)
  - Bulk upload: CSV/XLSX upload (same infrastructure as admin bulk import, but scoped to vendor's products/category)

### Vendor Portal — Orders

- **D-40:** **Order kanban + bulk ship**: Two view modes: List (filterable table) and Kanban (columns: New, Processing, Shipped, Delivered, Return Requested). Bulk action: select multiple orders → Mark as Shipped (opens tracking number bulk entry modal). Shipping: tracking number entry per order. Return approvals inline from kanban card. React Query polling every 30 seconds (no websocket in v1).

### Vendor Portal — Finance Center

- **D-41:** **Finance overview strip + drill-down tabs**:
  - Overview strip: 6 tiles (Gross Sales, Platform Fees, Net Revenue, Total Settled, Pending Payout, Tax Withheld)
  - Tab 1 — Transactions: order-level revenue breakdown (per order: gross → fee → net)
  - Tab 2 — Settlements: admin payout records received
  - Tab 3 — Tax Summary: monthly tax breakdown (for GST/VAT compliance record-keeping)
  - All formulas shown explicitly: "Net Revenue = Gross Sales − Platform Fees − Reversed Commissions"
  - Period selector 7d/30d/90d/custom date range
  - Export to CSV on each tab

### Vendor Portal — Analytics

- **D-42:** **Vendor analytics section** (4 components):
  1. Product performance table: per-product views, add-to-cart, orders, revenue, return rate, wishlist count — sortable, highlights top/bottom performers
  2. Inventory forecasting: current stock, avg daily sales (last 30d), estimated days of stock remaining, alert indicator when <7 days
  3. Conversion funnel: category-level impressions → product views → add-to-cart → orders with drop-off percentages
  4. Customer behavior insights: new vs returning customer split, avg order value trend, peak purchase hours/days chart

### Vendor Portal — Store Profile & Team

- **D-43:** **Store profile page**: Phase 6 D-01 fields (store_name, description, logo_url, banner_url, contact_email, contact_phone, address) plus:
  - Social links (Instagram URL, Facebook URL, website URL — new columns on vendors table)
  - Return policy editor (configures `vendor_return_policies` table from Phase 5 D-22 — completing the Phase 5/6 deferred item)
  - Store hours (display-only text field)
  - Logo and banner image upload via free-tier S3 (same infrastructure as KYC upload — D-28)

- **D-44:** **Team management page**: Member table (name, email, role badge, last active, status). Owner actions: Invite (modal: email + role select), Change Role (dropdown on existing member row), Deactivate (sets archived_at). Pending invites shown with expiry time + Resend/Cancel actions. Implements Phase 6 D-04 backend flow in UI.

### Vendor Portal — Onboarding

- **D-45:** **Persistent onboarding checklist in vendor sidebar**: New vendors see a 'Complete Setup' progress bar in the sidebar footer (e.g., 60% complete). Clicking expands a checklist with linked steps:
  1. Complete Store Profile (→ Store Profile page)
  2. Add Bank Details (→ Settings → Payout Info)
  3. Upload KYC Documents (→ Settings → KYC)
  4. Add First Product (→ Products → Create)
  5. Request Approval (→ button that sets `onboarding_status = 'pending'`)
  Checklist visible until 100% complete or explicitly hidden. Mirrors admin's checklist-driven verification pipeline (D-27).

### Personalization Backend

- **D-46:** **View history table**: New `customer_product_views` table (`id`, `customer_id FK`, `product_id FK`, `viewed_at TIMESTAMP`). Updated via `POST /products/:id/view` called on PDP page load for authenticated customers. Guest views tracked in localStorage (`recentlyViewed: [productId, ...]`), synced to server on login. Drives: Recently Viewed section (last 10 products), Continue Shopping (last browsed category), personalized recommendations.

- **D-47:** **Trending computation**: Weighted score = `(order_count_7d × 3) + (view_count_7d × 1)` per product. New `GET /products/trending` endpoint queries `order_items` + `customer_product_views` for last 7 days, orders by score DESC, LIMIT 20. Redis-cached with 1-hour TTL.

- **D-48:** **Recommendation surfaces**:
  - PDP: Frequently Bought Together (co-purchase from order_items) + Related Products (same category, similar price range)
  - CartPage: 'You might also like' (categories of items in cart)
  - Search no-results: trending products in the searched category as fallback
  All sourced from backend endpoints, Redis-cached.

- **D-49:** **Personalized search ranking**: Customer purchase/view history injected as a boosting signal into OpenSearch queries. Categories the customer frequently buys from get a score boost. Implemented as a `function_score` query wrapping the existing search logic.

- **D-50:** **Admin product view analytics**: New analytics widget in Insights section — most viewed products platform-wide (last 7d), products with high view-to-purchase gap (high views, low conversion — potential pricing or UX issues).

### Design System

- **D-51:** **Full cross-app component library in packages/ui**: All three web apps import shared base components: `Button`, `Input`, `Textarea`, `Select`, `Checkbox`, `Modal`, `Drawer`, `Card`, `Badge`/`StatusBadge`, `Toast`, `Skeleton`, `Spinner`, `DataTable`, `KPICard`, `ActionBar`, `SidebarLayout`, `CommandBar`, `NotificationBell`, `ErrorState`, `EmptyState`, `NetworkError`, `NotFound404`. Each app overrides styles via CSS custom properties. Panel-specific components (admin/vendor) live in packages/ui under `panel/` subfolder.

- **D-52:** **Storybook 8.x catalog**: Install `@storybook/react-vite` in packages/ui. Each shared component gets a story with variant states. Storybook `dev` script added to packages/ui. Serves as buyer documentation for the component library.

- **D-53:** **Dark mode**: All three portals support dark mode. `packages/ui/src/tokens/tokens.css` gains dark-mode CSS variable overrides (`.dark` class or `@media (prefers-color-scheme: dark)`). User preference stored in localStorage. Tailwind CSS 4.x `dark:` variant wired to the CSS class. Toggle available in: storefront header, admin command bar, vendor sidebar header. System preference respected on first load (no preference → use system).

### Accessibility

- **D-54:** **WCAG 2.1 AA** targets across all three portals:
  - Contrast ratio: 4.5:1 minimum for normal text, 3:1 for large text
  - Keyboard navigation: all interactive elements reachable via Tab; logical focus order; Enter/Space activate buttons
  - Focus management: modals and drawers trap focus; focus restored to trigger element on close
  - Semantic HTML: `<nav>`, `<main>`, `<article>`, `<button>`, `<header>`, `<footer>` — no `<div>` for interactive elements
  - ARIA: ARIA roles and labels on custom components (data tables, modals, drawer, notification bell)
  - Skip-to-content link on all three web apps (visually hidden, visible on focus)
  - `@axe-core/react` installed as dev dependency — logs violations to console during development

### Performance

- **D-55:** **Core Web Vitals targets ('Good' range)**:
  - LCP < 2.5s, INP < 200ms, CLS < 0.1
  - Route-based code splitting (React.lazy + Suspense on all page routes)
  - Image lazy loading (`loading="lazy"` attribute) and explicit `width`/`height` on all `<img>` to prevent CLS
  - React Query caching with appropriate `staleTime` per endpoint type
  - `packages/ui` components tree-shaken via ESM exports

### Animation

- **D-56:** **Purposeful micro-interactions only**:
  - **Animate**: page transitions (fade+slide, 200-300ms), modal/drawer enter/exit (slide up + fade), skeleton-to-content reveal (fade), cart item add/remove (scale+fade), status badge state changes (cross-fade), comparison tray slide-in
  - **Do NOT animate**: data table row renders, form field focus (CSS outline only), standard hover states (CSS only), list data that changes frequently
  - `useReducedMotion()` hook from Motion 12.x wraps all animations — zero motion when `prefers-reduced-motion: reduce` is set
  - Easing conventions: `spring` for drag/pan, `easeOut` for reveals/entries, `easeIn` for exits

### Phase 7 Alignment

- **D-57:** **Mobile design guidelines for Phase 7** (React Native): Phase 11 documents in CONTEXT.md a mobile design principles section that Phase 7 follows: bottom tab navigation (same 5 tabs: Home, Categories, Search, Cart, Account), gesture conventions (swipe-to-go-back via React Navigation, pull-to-refresh, swipe image gallery), screen hierarchy (same pages as web storefront), interaction model (React Native Reanimated for gesture-driven animations). Not a Figma spec — principled guidelines for consistency between web and mobile.

### SEO

- **D-58:** **React SPA SEO strategy**:
  - `react-helmet-async` installed in `apps/web-storefront` for dynamic per-page meta tags (title, description, OG tags, canonical URL)
  - PDP pages include JSON-LD Product schema (name, price, availability, average rating, review count)
  - Category pages include BreadcrumbList JSON-LD
  - Sitemap generated as a static XML via a build-time script (reads category + product routes from API)
  - No SSR/SSG — stays SPA

### Additional Features

- **D-59:** **PDF invoice generation**: New `GET /orders/:id/invoice` backend endpoint. Generates PDF using PDFKit or pdfmake (lightweight, zero-native-dependency). Invoice includes: Grovio branding, order ID + date, items with prices + quantities, taxes, order total, vendor details, customer billing address. Download triggered from OrderDetailPage invoice button.

- **D-60:** **i18n foundation**: `react-i18next` + `i18next` installed in all three web apps. All user-facing strings extracted to `packages/locales/en/` (shared common strings) + per-app locale JSON files. No hardcoded user-facing strings in component code. Language detection from browser — English only in v1, but buyers add locale files to support other languages. No language switcher UI in v1.

- **D-61:** **Social sharing**: Web Share API on PDP (`Share` button) and order confirmation page (`Share Order` / `Tell a friend`). Fallback: copy-to-clipboard. WhatsApp deep link included in share sheet. No third-party social SDK.

- **D-62:** **Vendor analytics customer behavior**: Per-product in vendor analytics: view count (from `customer_product_views`), add-to-cart count (from basket_items events), conversion rate (orders/views), wishlist count (from `wishlists` table). New vs returning customer split for vendor's orders. Peak purchase hours/days chart.

### Claude's Discretion

- Admin order management: specific layout combining saved filter presets and advanced filter panel — Claude picks the UX that best serves high-volume marketplace admin workflow
- Exact KPI tile hover/click interaction details (tooltip vs navigate vs modal)
- Platform health widget implementation details (polling interval, which metrics to surface)
- Per-screen error state copy (exact messages for each page's empty/error state)
- Exact animation spring configurations and durations (within the D-56 easing conventions)
- Exact column set and sort behavior for DataTable component in packages/ui
- React Query `staleTime` and `gcTime` values per endpoint type
- Bull Board API integration approach for BullMQ queue depth metrics
- PDF invoice template visual design (within Grovio branding system)
- Admin notification dropdown design (beyond the badge count specification)

</decisions>

<canonical_refs>
## Canonical References

**Downstream agents MUST read these before planning or implementing.**

### Phase 11 Requirements
- `.planning/ROADMAP.md` §"Phase 11: UX/UI Platform Redesign" — goal, 10 success criteria, scope breakdown by portal, inspiration references
- `.planning/REQUIREMENTS.md` — all UX requirements (UX-01 through UX-10, to be defined in REQUIREMENTS.md update)

### Prior Phase Contracts (Phase 11 builds directly on these)
- `.planning/phases/06-vendor-admin-tools/06-CONTEXT.md` — D-01 (vendors table extensions), D-03/D-04 (vendor_users + staff invite), D-05 (role scopes), D-07/D-08/D-09 (vendor payouts), D-10 (admin dashboard baseline), D-11 (CMS blocks), D-12 (feature flags), D-13 (audit_log schema), D-14 (vendor coupon scoping), D-15 (inventory+pricing), D-16 (return approval flow), D-17 (admin vendor management), D-18 (commission config), D-19 (marketplace_settings), D-20 (panel navigation — Phase 11 extends this), D-21 (admin auth + admin_users table)
- `.planning/phases/05-commerce-core/05-CONTEXT.md` — D-01 (basket persistence), D-05 (checkout URL structure — Phase 11 replaces with single-URL accordion), D-08 (order display structure), D-12 (commission entries, no automated payouts), D-16 (refund destination customer choice), D-22 (vendor_return_policies — Phase 11 adds vendor UI), D-23 (return request flow)
- `.planning/phases/04-customer-storefront-web/04-CONTEXT.md` — D-06 (URL-serialized state pattern), D-09 (httpOnly cookie auth), D-13 (Add to Cart data-phase marker), D-15 (variant selectors)

### Existing Codebase (Phase 11 modifies / extends these directly)
- `apps/web-storefront/src/App.tsx` — current routing; Phase 11 adds wishlist, notifications, comparison routes
- `apps/web-storefront/src/components/layout/Header.tsx` — Phase 11 adds notification bell, dark mode toggle; hides on mobile where bottom nav appears
- `apps/web-storefront/src/components/ui/ProductCard.tsx` — Phase 11 adds wishlist heart icon, comparison checkbox
- `apps/web-storefront/src/components/search/FilterSidebar.tsx` — Phase 11 redesigns as sticky collapsible with active chip strip
- `apps/web-storefront/src/pages/HomePage.tsx` — Phase 11 adds personalization sections (recently viewed, continue shopping, trending)
- `apps/web-storefront/src/pages/ProductDetailPage.tsx` — Phase 11 full redesign (gallery, swatches, reviews, FBT, related, social share)
- `apps/web-storefront/src/pages/CartPage.tsx` — Phase 11 adds comparison tray, cart recommendations, coupon suggestions
- `apps/web-admin/src/App.tsx` — Phase 11 adds all new admin routes (keeping Phase 2 category routes)
- `apps/web-vendor/src/App.tsx` — Phase 11 builds the complete vendor panel (currently shell only)
- `packages/ui/src/tokens/tokens.css` — Phase 11 adds dark mode token overrides

### Architecture & Constraints (CRITICAL)
- `.planning/research/ARCHITECTURE.md` — backend-authoritative money, append-only ledger pattern
- `.planning/research/PITFALLS.md` §"Pitfall 1" — BIGINT minor units (new tables: wishlists, product_reviews, customer_notifications, support_tickets, announcements must not use FLOAT/DECIMAL)
- `CLAUDE.md` §"Recommended Stack" — Motion 12.x (`motion/react` import not `framer-motion`), Tailwind CSS 4.x (CSS-native config, no tailwind.config.js), React 19.2.x, Vite 8, React Query 5.x, Zustand 5.x, Fastify 5.x, Drizzle ORM 0.45.x, jose 6.x
- `CLAUDE.md` §"What NOT to Use" — no Webpack, no Tailwind v3, no jsonwebtoken

### Technology Choices for Phase 11 New Additions
- `react-helmet-async` — per-page meta tags + JSON-LD for SEO (D-58)
- `react-i18next` + `i18next` — i18n foundation, no hardcoded strings (D-60)
- `PDFKit` or `pdfmake` — PDF invoice generation (D-59); prefer zero-native-binary option
- `@storybook/react-vite` + `storybook@8.x` — component library documentation (D-52)
- `@axe-core/react` (dev only) — accessibility violation detection (D-54)
- Free-tier S3-compatible storage SDK — Cloudflare R2 (via `@aws-sdk/client-s3` with custom endpoint) or `@supabase/storage-js` — for KYC + product image upload (D-28)

</canonical_refs>

<code_context>
## Existing Code Insights

### Reusable Assets
- `apps/web-storefront/src/components/ui/Skeleton.tsx` — existing skeleton component; Phase 11 extends to create shimmer animation variant for mobile
- `apps/web-storefront/src/components/ui/Button.tsx`, `Input.tsx`, `Toast.tsx`, `FilterChip.tsx` — existing UI components; Phase 11 migrates these into `packages/ui` as part of the component library (D-51)
- `apps/web-storefront/src/components/layout/PageTransition.tsx` — existing page transition wrapper; Phase 11 standardizes animation conventions (D-56) across all portals using this pattern
- `apps/web-storefront/src/components/PlacesAutocompleteInput.tsx` — Google Places autocomplete; reused in checkout address section
- `apps/web-admin/src/App.tsx` — existing React Router v6 routing with framer-motion import (note: Phase 11 migrates to `motion/react` import for consistency with CLAUDE.md)
- `apps/api/src/modules/feature-flags/FeatureFlagService.ts` — Redis-cache + DB-fallback pattern; all new cached analytics endpoints follow this pattern
- `apps/api/src/modules/jobs/` — BullMQ job pattern; new `PriceDropCheckJob` and notification dispatch jobs follow this

### Established Patterns
- **httpOnly cookie auth**: `credentials: 'include'` on all API fetch calls — all new Phase 11 endpoints follow Phase 4 D-09 pattern
- **BIGINT minor units**: All new money columns (`revenue_minor`, etc.) must use `_minor BIGINT` naming
- **pgEnum for status types**: `support_ticket_status`, `admin_role`, `notification_type` follow pgEnum pattern
- **Append-only ledgers**: `customer_notifications` is append-only (no UPDATE); notifications are dismissed client-side or via a `dismissed_at` column
- **Soft-delete via `archived_at`**: `wishlists` does not soft-delete (hard delete is fine — no audit trail needed for wishlist removes)
- **React Router v6**: all new routes use `createBrowserRouter` + `Route` — no class-based router
- **Awilix DI**: all new services register in `apps/api/src/container.ts`
- **Route plugins**: new API endpoints mount as Fastify plugins

### Integration Points
- Phase 5 `order_items` table is the co-purchase data source for FBT recommendations (D-09)
- Phase 5 `coupons` table drives `GET /coupons/available` for inline coupon suggestions (D-12)
- Phase 5 `basket_items` events inform vendor add-to-cart analytics (D-62)
- Phase 6 `vendor_commission_entries` drives the Vendor Finance Center Transactions tab (D-41)
- Phase 6 `vendor_payouts` drives the Vendor Finance Center Settlements tab (D-41)
- Phase 5 D-22 `vendor_return_policies` table — Phase 11 adds the vendor UI to configure it (D-43 store profile)
- Phase 4 `homepage_blocks` HomepageService Redis cache — Phase 11's personalized homepage endpoint adds a parallel personalized layer but does not modify the existing CMS block pipeline
- Phase 6 `audit_log` — Phase 11 adds new action types for security events (D-35) and support ticket transitions (D-33)

</code_context>

<specifics>
## Specific Ideas

- **Bottom nav z-index**: Bottom nav must sit above content but below modals/drawers. Use `z-40` for bottom nav, `z-50` for modals/drawers in Tailwind.
- **Comparison tray persistence**: Comparison selections persist in Zustand `useComparisonStore` (not React Query — this is pure client state). Tray auto-dismisses when navigating away from PLP.
- **Vendor SKU auto-generation**: Format `{CATEGORY_PREFIX}-{COLOR}-{SIZE}` or `{PRODUCT_SLUG}-{VARIANT_COMBO}`. SKU field is editable — auto-fill is just a suggestion.
- **Onboarding checklist dismissal**: Only `super_admin` or vendor owner can dismiss the checklist. Staff cannot dismiss it.
- **Price drop detection**: Triggered on product price update via `PATCH /vendor/products/:id/pricing`. Check if price dropped below current wishlist holders' saved-at price. Insert `customer_notifications` rows for all customers who have this product wishlisted.
- **Admin RBAC sidebar enforcement**: Each sidebar section checks role in `ProtectedAdminRoute` wrapper. `finance_admin` attempting to access Vendors gets redirected to Finance. `moderator` attempting Finance gets redirected to Dashboard.
- **Command bar search scope**: Global admin search queries across vendors (name/email), products (title/SKU), orders (order ID/customer email). Results shown in a categorized dropdown. Click navigates to the entity detail page.
- **Announcement banner**: Storefront banner shown only to target audience (customers see customer announcements, vendors see vendor announcements). Dismissal stored in localStorage per announcement ID. `announcements` table includes `target_type TEXT` (customers/vendors/all) + `active BOOLEAN` + `expires_at TIMESTAMP`.
- **i18n namespace structure**: `packages/locales/en/common.json` (shared: buttons, labels, errors), `packages/locales/en/storefront.json`, `packages/locales/en/admin.json`, `packages/locales/en/vendor.json`. Per-app i18next config loads common + app-specific namespace.
- **Inspiration references for implementation**: Amazon checkout accordion (single-page, sections), Flipkart product listing (filter chip strip, view toggle), Myntra product card (wishlist heart), Meesho (mobile bottom nav), Shopify admin (command bar search), Blinkit/Zepto vendor (morning-glance dashboard), Amazon Seller Central (analytics depth).

</specifics>

<deferred>
## Deferred Ideas

- **PWA / service worker** — installable storefront. Phase 12 or buyer self-service.
- **SSR/SSG for storefront** — React SPA with react-helmet-async is sufficient for v1. SSR is a major architectural change.
- **Real LLM AI insights** (Claude API narrative summaries) — Phase 12 or v2. Phase 11 delivers analytics panel.
- **Automated vendor payouts** (Stripe Connect / Razorpay Route) — v2 (PAY2-01). Phase 6 manual settlement remains.
- **Live push notifications** (FCM/APNs) — Phase 8 scope. Phase 11 delivers in-app notification center only.
- **Social login** (Google, Apple Sign-In) — v2. Phase 11 keeps email/password auth.
- **Image search (functional)** — camera icon is a placeholder. Actual image search requires a vision API integration. v2.
- **Voice search (functional)** — icon present, non-functional. Web Speech API wiring is a fast follow.
- **Full admin customizable dashboard widgets** (drag-and-drop) — v2.
- **Per-customer coupon use limit** — v1.x extension on Phase 5 coupon engine.
- **BNPL / EMI payment options** — out of scope for v1.
- **Vendor store public page** (customer-facing vendor profile page on storefront) — natural v1.x addition.
- **Multi-language UI** (non-English) — i18n infrastructure is in Phase 11 (D-60); translations themselves are buyer responsibility.

</deferred>

---

*Phase: 11-UX/UI Platform Redesign*
*Context gathered: 2026-06-04*
