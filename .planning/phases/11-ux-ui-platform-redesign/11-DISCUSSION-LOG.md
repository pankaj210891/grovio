# Phase 11: UX/UI Platform Redesign - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-04
**Phase:** 11-ux-ui-platform-redesign
**Areas discussed:** Storefront rebuild depth, Admin layout paradigm, Personalization data strategy, Phase 11 execution order, Vendor finance center design, Vendor analytics depth, Design system strategy, Accessibility implementation strategy, Additional topics (SEO, error states, animations, invoices, i18n, social sharing, admin broadcasts)

---

## Storefront Rebuild Depth

| Option | Description | Selected |
|--------|-------------|----------|
| Targeted redesign | Keep infrastructure, redesign layouts and interactions | ✓ |
| Full tear-down + rebuild | Discard Phase 4 pages, rebuild from scratch | |
| Selective rebuild by section | Keep auth/forms, rebuild high-impact screens | |

**User's choice:** Targeted redesign
**Notes:** Phase 4 is production code with working infrastructure. Preserve routing, auth, React Query, API client. Redesign page layouts and interaction patterns.

---

## Mobile Navigation

| Option | Description | Selected |
|--------|-------------|----------|
| Responsive: top nav desktop, bottom nav mobile | Header on desktop ≥768px, fixed bottom nav 5 tabs on mobile | ✓ |
| Bottom nav replaces header entirely on mobile | Aggressive — header gone on mobile | |
| Floating pill with collapse on scroll | No bottom nav, premium scroll interaction | |

**User's choice:** Responsive split
**Notes:** 5 bottom nav tabs: Home, Categories, Search, Cart, Account.

---

## Homepage Personalization

| Option | Description | Selected |
|--------|-------------|----------|
| Personalization sections below CMS blocks | localStorage recently viewed, no backend changes | |
| Backend-personalized with customer JWT | New server endpoint, customer-specific block injection | ✓ |
| You decide | Claude picks practical approach | |

**User's choice:** Backend-personalized homepage

---

## PDP Redesign Scope

| Option | Description | Selected |
|--------|-------------|----------|
| Gallery + variants + delivery + trust badges | No reviews system | |
| All including reviews/ratings | New product_reviews schema + endpoints + moderation | ✓ |
| Gallery + variants only | Defer rest | |

**User's choice:** Full scope including reviews and ratings

---

## Checkout Design

| Option | Description | Selected |
|--------|-------------|----------|
| Single URL accordion sections | One route, sections expand in sequence | ✓ |
| Keep 4 URL steps, animate transitions | URL-addressable steps in shared container | |
| Stepper tabs, all visible | Lowest effort | |

**User's choice:** Single URL /checkout with accordion sections

---

## Order Tracking

| Option | Description | Selected |
|--------|-------------|----------|
| Visual timeline UI only, no map | OrderDetailPage timeline + reorder + invoice | ✓ |
| Full tracking including map placeholder | Map shell now, Phase 8 wires it | |
| Leave OrderDetailPage for Phase 8 | Phase 8 owns order tracking UX | |

**User's choice:** Visual status timeline UI only; map stays in Phase 8

---

## Search UX

| Option | Description | Selected |
|--------|-------------|----------|
| Enhanced suggestions + visual search placeholder | Search history, popular searches, camera icon placeholder | ✓ |
| Real voice search (Web Speech API) | Functional voice input | |
| You decide | Claude picks improvements | |

**User's choice:** Enhanced suggestions UI + visual search placeholder

---

## Product Comparison

| Option | Description | Selected |
|--------|-------------|----------|
| Comparison tray up to 3 products | Floating tray, side-by-side attributes, Zustand store | ✓ |
| Defer comparison | Focus on other PLP improvements | |
| Wishlist only, no comparison | Wishlist instead | |

**User's choice:** Floating comparison tray with up to 3 products

---

## Guest Checkout

| Option | Description | Selected |
|--------|-------------|----------|
| Guest checkout UX improvements only | Clear guest path, email capture, post-purchase prompt | ✓ |
| Nothing additional | Backend already works | |
| Redesign checkout entry screen entirely | New checkout entry | |

**User's choice:** UX improvements only (backend Phase 5 already handles it)

---

## PLP View Modes

| Option | Description | Selected |
|--------|-------------|----------|
| Grid + List toggle | 2 modes, localStorage preference | ✓ |
| Grid + List + Compact grid | 3 modes | |
| You decide | Claude picks | |

**User's choice:** Grid + List toggle

---

## Coupon Discovery

| Option | Description | Selected |
|--------|-------------|----------|
| Inline coupon suggestions on cart | GET /coupons/available endpoint, tap to apply | ✓ |
| Dedicated offers page | New /offers route | |
| Nothing additional | Keep existing input | |

**User's choice:** Inline coupon suggestions with new endpoint

---

## Additional Storefront Items (all selected)

- Wishlist: heart icon on ProductCard, account-persisted, /account/wishlist page
- Frequently bought together: PDP section from co-purchase query
- Sticky filter bar redesign: sticky on scroll, collapsible, active chip strip

---

## Admin Layout Paradigm

| Option | Description | Selected |
|--------|-------------|----------|
| Keep sidebar, redesign content density | Sidebar stays, command center via content | ✓ |
| Override D-20 — new layout for admin only | Fundamentally different admin layout | |
| Command bar + sidebar hybrid | Add top command bar above existing layout | ✓ |

**User's choice:** Options 1 and 3 combined — sidebar stays + top command bar added + high-density content redesign inside sections

---

## Admin Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Actionable KPI tiles + pending-action queue | Clickable tiles, Needs Attention queue | ✓ |
| Full widget-based drag-and-drop | Admin customizes dashboard | |
| Exactly Phase 6 D-10 + command bar alerts | Keep metrics page, alerts in command bar | |

**User's choice:** Actionable KPI tiles + Needs Attention queue

---

## Admin AI Insights

| Option | Description | Selected |
|--------|-------------|----------|
| Analytics insights panel, no actual AI | DB/OpenSearch computed, no LLM | ✓ |
| Real AI — LLM-generated narratives | Claude API integration | |
| Deferred — Phase 12 | Skip for Phase 11 | |

**User's choice:** Analytics insights panel without LLM

---

## Admin Support Center

| Option | Description | Selected |
|--------|-------------|----------|
| Build minimal support ticket system | New tables, list/detail/reply/escalate | ✓ |
| Defer support center | Out of scope for Phase 11 | |
| Link to external helpdesk only | No custom system | |

**User's choice:** Minimal support ticket system in Phase 11

---

## Vendor Management (Admin)

| Option | Description | Selected |
|--------|-------------|----------|
| Vendor health score card + inline actions | Expandable health card, inline approve/suspend | ✓ |
| Dedicated vendor profile page with KYC workflow | Full page with KYC, onboarding checklist | ✓ |
| Phase 6 D-17 as planned, better UI only | Data model unchanged | |

**User's choice:** Both options 1 and 2 — health cards AND full vendor profile with KYC

---

## KYC File Upload

| Option | Description | Selected |
|--------|-------------|----------|
| File upload for KYC only, free tier | S3-compatible free tier (R2/Supabase) for KYC only | ✓ |
| URL input only for KYC | Google Drive / Dropbox links | |
| Defer KYC document upload | Phase 12 | |

**User's choice:** Option 1 with free tier (Cloudflare R2 or Supabase Storage)

---

## Admin Financial Center

| Option | Description | Selected |
|--------|-------------|----------|
| Unified /admin/finance with 4 tabs | Overview, Payouts, Commissions, Refunds | ✓ |
| Keep separate sidebar sections (Phase 6 D-20) | Commission Rules + Payout Management separate | |

**User's choice:** Unified financial center

---

## Bulk Actions

| Option | Description | Selected |
|--------|-------------|----------|
| Checkbox multi-select + floating action bar | Row selection with contextual action bar | ✓ |
| Bulk CSV import/export only | No in-table selection | |
| You decide | Claude picks | |

**User's choice:** Option 1 with additional bulk product addition via CSV and XLSX

---

## Admin Order Management

**User's choice:** You decide — Claude picks order management UX for high-volume marketplace admin
**Claude's decision:** Advanced filter panel (date range, vendor multi-select, status, payment method, amount range) + saved filter presets stored in localStorage per admin session

---

## Admin Audit & Security

| Option | Description | Selected |
|--------|-------------|----------|
| Admin role management + security events | super_admin/moderator/finance_admin roles + security audit event types | ✓ |
| Audit log UI only | Better UI, no role system | |
| Full RBAC per sidebar section | Permissions table + middleware | ✓ |

**User's choice:** Options 1 and 3 — full admin RBAC + security event types

---

## Vendor Onboarding (Admin side)

| Option | Description | Selected |
|--------|-------------|----------|
| Checklist-driven verification pipeline | Admin checks off each step manually | ✓ |
| Simple approve/reject only | Phase 6 D-17 as planned | |
| You decide | Claude picks | |

**User's choice:** Checklist-driven verification pipeline

---

## Admin Additional Features (all selected)

- Admin notification alerts: badge counts on sidebar + notification bell in command bar
- Platform health widget on dashboard: queue depth, API response time, OpenSearch sync
- Export: CSV/Excel across orders, vendors, commissions, payouts, audit log

---

## Personalization Data Strategy

### View History Storage

| Option | Description | Selected |
|--------|-------------|----------|
| Server-persisted customer_product_views | New DB table, guest localStorage + sync on login | ✓ |
| localStorage only | No backend, no cross-device | |
| You decide | Claude picks consistent with backend-personalization decision | |

**User's choice:** Server-persisted view history

---

### Trending Computation

| Option | Description | Selected |
|--------|-------------|----------|
| Order frequency last 7 days | Simple order count query | |
| View count from product_views | Browsing intent signal | |
| Weighted: views + orders | (orders×3) + (views×1), Redis cached 1h | ✓ |

**User's choice:** Combination weighted score

---

### Recommendation Surfaces

| Option | Description | Selected |
|--------|-------------|----------|
| PDP only (FBT + Related) | 2 surfaces | |
| PDP + cart recommendations | 3 surfaces | |
| PDP + cart + search no-results fallback | 3 surfaces | ✓ |

**User's choice:** All 3 — PDP, cart, search no-results

---

### Additional Personalization Items (all selected)

- Guest vs authenticated experience difference (guest: trending+shortcuts; auth: + recently viewed + recommendations)
- Vendor analytics: per-product view/cart/conversion/wishlist metrics
- Price drop alerts on wishlist page
- Customer notification center (in-app, no push)
- Customer notification preferences (DB-persisted per customer)
- Personalized search ranking via OpenSearch function_score
- Admin product view analytics (most viewed, view-to-purchase gap)

---

## Phase 11 Execution Order

| Option | Description | Selected |
|--------|-------------|----------|
| Admin + Vendor portals first | Admin/vendor panels are Phase 6's direct output | ✓ |
| Design system first | Shared components before any portal | |
| Customer storefront first | Phase 4 foundation already exists | |

**User's choice:** Admin + Vendor first (but design system is Wave 1 as agreed)

---

### Phase Structure

| Option | Description | Selected |
|--------|-------------|----------|
| One phase with internal waves | 5 waves: design system → admin → vendor → storefront → features | ✓ |
| Split into 11a and 11b | Separate roadmap phases | |
| One phase, some features to Phase 12 | Defer RBAC, support, notifications | |

**User's choice:** One phase with waves

---

### Phase 6 vs Phase 11 Relationship

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 6 backend + basic UI, Phase 11 redesigns | Cleanest separation | ✓ |
| Phase 11 replaces Phase 6 UI work | Phase 6 backend only | |
| Merge both UI works | Simultaneous execution | |

**User's choice:** Phase 6 builds backend + basic functional UI; Phase 11 redesigns all portals

---

## Vendor Portal Details

### Vendor Dashboard

| Option | Description | Selected |
|--------|-------------|----------|
| Stat tiles row + mini charts + alert feed | 6 tiles + sparkline + inventory alerts, no scroll | ✓ |
| Tabbed by time period | Today/Week/Month tabs | |
| You decide | Claude picks morning-glance layout | |

**User's choice:** Stat tiles + mini charts + alert feed

---

### Vendor Product Creation

| Option | Description | Selected |
|--------|-------------|----------|
| Multi-step wizard + smart defaults | 3-step wizard, auto-SKU, draft saving, bulk CSV/XLSX | ✓ |
| Single page progressive disclosure | All fields, collapsible sections | |
| Keep Phase 3 CRUD, add bulk upload only | Minimal redesign | |

**User's choice:** Multi-step wizard

---

### Vendor Onboarding (vendor side)

| Option | Description | Selected |
|--------|-------------|----------|
| Persistent sidebar checklist | Progress bar + linked steps, visible until 100% | ✓ |
| Full-screen wizard on first login | Forced first-login flow | |
| You decide | Claude picks | |

**User's choice:** Persistent sidebar checklist

---

### Vendor Finance Center

| Option | Description | Selected |
|--------|-------------|----------|
| Finance strip + drill-down tabs | 6 metric tiles + 3 tabs with formulas | ✓ |
| Single scrollable bank statement | Chronological entries, running balance | |
| You decide | Claude picks transparent design | |

**User's choice:** Finance overview strip + drill-down tabs

---

### Vendor Analytics

All 4 items selected:
- Product performance table (views, add-to-cart, orders, revenue, return rate, wishlist)
- Inventory forecasting (days of stock remaining, <7 day alerts)
- Conversion funnel (impressions → views → cart → orders)
- Customer behavior insights (new/returning split, avg order value, peak purchase times)

---

### Vendor Order Management

| Option | Description | Selected |
|--------|-------------|----------|
| Order kanban + bulk ship actions | List + Kanban views, bulk shipping, 30s polling | ✓ |
| List only with inline status updates | No kanban | |
| You decide | Claude picks | |

**User's choice:** Kanban + bulk ship actions

---

### Phase 7 Alignment

| Option | Description | Selected |
|--------|-------------|----------|
| Phase 11 produces mobile design guidelines | Navigation, gestures, screen hierarchy documented | ✓ |
| Phase 7 fully independent | Different constraints, design from scratch | |
| Shared design system tokens | packages/ui tokens shared, no component sharing | |

**User's choice:** Phase 11 documents mobile design principles for Phase 7

---

## Design System

| Option | Description | Selected |
|--------|-------------|----------|
| Shared primitives + tokens only | No component library | |
| Shared components for admin + vendor only | Panel-specific shared components | |
| Full cross-app component library | All apps share Button, Input, Card, etc. | ✓ |

**User's choice:** Full cross-app component library in packages/ui

### Storybook

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — Storybook for all shared components | Storybook 8.x + @storybook/react-vite | ✓ |
| No — README documentation only | No additional build dependency | |

**User's choice:** Storybook catalog

### Dark Mode

| Option | Description | Selected |
|--------|-------------|----------|
| Yes — dark mode all three portals | tokens.css overrides, localStorage preference, UI toggle | ✓ |
| No dark mode | Defer to buyers | |
| Tokens only, no UI toggle | System preference only | |

**User's choice:** Full dark mode for all three portals

---

## Accessibility Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| axe-core automated + manual keyboard audit | @axe-core/react dev + keyboard audit, focus management | ✓ |
| WCAG checklist only | No automated tooling | |
| Full accessibility test suite in Vitest | axe test per component | |

**User's choice:** axe-core automated checks + manual keyboard audit

---

## Performance Targets

| Option | Description | Selected |
|--------|-------------|----------|
| Core Web Vitals 'Good' + WCAG 2.1 AA | LCP<2.5s, INP<200ms, CLS<0.1 | ✓ |
| You decide | Claude picks sensible defaults | |
| Basic responsiveness only | No strict targets | |

**User's choice:** Core Web Vitals 'Good' range + WCAG 2.1 AA

---

## SEO Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| react-helmet-async + meta tags + JSON-LD | SPA with per-page meta + structured data + sitemap | ✓ |
| Switch to SSR/SSG | Major architectural change | |
| You decide | Claude picks | |

**User's choice:** react-helmet-async + JSON-LD, stays SPA

---

## Error/Empty States

| Option | Description | Selected |
|--------|-------------|----------|
| Shared packages/ui components, Claude's discretion per screen | ErrorState, EmptyState, NetworkError, NotFound404 | ✓ |
| Fully specified per screen | Every message specified in CONTEXT.md | |
| You decide | Consistent patterns across screens | |

**User's choice:** Shared components, per-screen copy is Claude's discretion

---

## Animation Strategy

| Option | Description | Selected |
|--------|-------------|----------|
| Purposeful micro-interactions, prefers-reduced-motion respected | Selective animation with useReducedMotion() | ✓ |
| Rich animations everywhere | Maximum motion, premium feel | |
| Minimal — page transitions only | CSS for everything else | |

**User's choice:** Purposeful micro-interactions only

---

## Invoice Generation

| Option | Description | Selected |
|--------|-------------|----------|
| PDF invoice via backend (PDFKit/pdfmake) | GET /orders/:id/invoice endpoint | ✓ |
| Print-optimized HTML | Browser print to PDF | |
| You decide | Claude picks | |

**User's choice:** PDF invoice via backend

---

## Store Profile

**User's choice:** Phase 6 D-01 fields + social links (Instagram, Facebook, website) + return policy config (vendor_return_policies editor) + store hours + logo/banner upload via free-tier S3

---

## Team Management

**User's choice:** Member table + invite modal + role change + pending invites with resend/cancel (implementing Phase 6 D-04 backend flow in UI)

---

## i18n

| Option | Description | Selected |
|--------|-------------|----------|
| react-i18next with JSON locale files | No hardcoded strings, packages/locales/en/ | ✓ |
| String constants in TypeScript | strings.ts per app | |
| You decide | Claude picks | |

**User's choice:** react-i18next with JSON locale files, no hardcoded strings

---

## Social Sharing

**User's choice:** Web Share API + copy-to-clipboard fallback on PDP and order confirmation page

---

## Admin Broadcast Announcements

**User's choice:** Admin can send announcements (title, body, target: customers/vendors/all, expiry). Displayed as dismissible banner in storefront and vendor portal. New `announcements` table.

---

## Claude's Discretion

- Admin order filter panel vs presets specific layout
- Per-screen error/empty state copy (exact messages)
- Platform health widget polling interval and metric selection
- Exact animation spring configs and durations
- KPI tile hover/click interaction details
- React Query staleTime and gcTime values
- Bull Board API integration for queue metrics
- PDF invoice template visual design
- Admin notification dropdown design
- DataTable column set and sort behavior

## Deferred Ideas

- PWA / service worker
- SSR/SSG for storefront
- Real LLM AI insights (Claude API)
- Automated vendor payouts (Stripe Connect / Razorpay Route)
- Live push notifications
- Social login (Google, Apple)
- Functional image search
- Functional voice search
- Admin customizable dashboard widgets (drag-and-drop)
- Per-customer coupon use limit
- BNPL / EMI payments
- Vendor public storefront page
- Multi-language translations (infrastructure in Phase 11, translations buyer responsibility)
