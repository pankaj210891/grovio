# Phase 4: Customer Storefront (Web) - Discussion Log

> **Audit trail only.** Do not use as input to planning, research, or execution agents.
> Decisions are captured in CONTEXT.md — this log preserves the alternatives considered.

**Date:** 2026-06-01
**Phase:** 4-Customer Storefront (Web)
**Areas discussed:** Homepage layout strategy, PLP pagination style, Auth token storage & session, PDP add-to-cart placeholder

---

## Homepage Layout Strategy

### Q1: How should the homepage render block types?

| Option | Description | Selected |
|--------|-------------|----------|
| Pure CMS stack | Admin arranges blocks in any order; homepage renders whatever block sequence is configured. Maximum flexibility. | ✓ |
| Fixed-position layout | Hero always at top, featured categories row 2, product grid row 3 — each slot editable but positions hardcoded. | |

**User's choice:** Pure CMS stack (recommended)
**Notes:** Aligns with configuration-first core value.

---

### Q2: Are the 3 Phase 2 block types enough, or should Phase 4 add new types?

| Option | Description | Selected |
|--------|-------------|----------|
| Keep 3 only | banner, product_grid, text_block — no additions | |
| Add featured_categories | Adds category showcase block | |
| Add featured_categories + hero_banner | Two new block types | |

**User's choice:** Deferred to Claude's recommendation — "smallest extension for a practical commerce homepage"
**Claude's decision:** Add `featured_categories` only. The existing `banner` type already covers hero use cases; a category showcase row is the only genuinely missing type.

---

### Q3: How should empty state (no blocks configured) be handled?

| Option | Description | Selected |
|--------|-------------|----------|
| Show default seed layout | Renders pre-seeded blocks when no blocks configured | ✓ |
| Show empty state message | Shows "No content configured" placeholder | |

**User's choice:** Show default seed layout (recommended)

---

### Q4: Where does homepage block data come from?

| Option | Description | Selected |
|--------|-------------|----------|
| New GET /homepage endpoint | New public read endpoint; admin write-side is Phase 6 | ✓ |
| Extend GET /categories | Bundle homepage blocks into categories response | |

**User's choice:** New GET /homepage endpoint (recommended)

---

## PLP Pagination Style

### Q1: How should the PLP load more products?

| Option | Description | Selected |
|--------|-------------|----------|
| Infinite scroll | Auto-load on scroll via useInfiniteQuery | ✓ |
| Load More button | Explicit button; useInfiniteQuery triggered by click | |
| Numbered pagination | Classic pages; regular React Query | |

**User's choice:** Infinite scroll (recommended)

---

### Q2: Should filter state be URL-serialized?

| Option | Description | Selected |
|--------|-------------|----------|
| URL-serialized filter state | Filters sync to URL params; bookmarkable, back-button friendly | ✓ |
| In-memory state only | Filters in Zustand only | |

**User's choice:** Yes — URL-serialized filter state (recommended)
**Notes:** FEATURES.md specifically calls this out as a differentiator.

---

### Q3: Filter panel placement on desktop?

| Option | Description | Selected |
|--------|-------------|----------|
| Left sidebar | Fixed column; mobile collapses to slide-in drawer | ✓ |
| Horizontal filter bar | Dropdowns above grid; crowds with many attributes | |

**User's choice:** Left sidebar (recommended)

---

### Q4: Products per batch?

| Option | Description | Selected |
|--------|-------------|----------|
| 24 per batch | Divisible by 2, 3, 4 — works for all grid column counts | ✓ |
| 20 per batch | Round number; doesn't divide evenly by 3 | |
| You decide | Claude's discretion | |

**User's choice:** 24 per batch (recommended)

---

## Auth Token Storage & Session

### Q1: How should customer tokens be stored?

| Option | Description | Selected |
|--------|-------------|----------|
| httpOnly cookie | Server sets; XSS-safe; works across tabs; needs CORS credentials config | ✓ |
| In-memory + localStorage | Client stores; simpler CORS; access token lost on reload | |

**User's choice:** httpOnly cookie (recommended)

---

### Q2: Password reset flow?

| Option | Description | Selected |
|--------|-------------|----------|
| Email link with time-limited token | Single-use UUID, hashed in DB, 1-hour expiry; /forgot-password → email → /reset-password?token=xxx | ✓ |
| Email OTP (6-digit code) | Code emailed; extra input step | |

**User's choice:** Email link with time-limited token (recommended)

---

### Q3: Does storefront host vendor/admin login?

| Option | Description | Selected |
|--------|-------------|----------|
| Separate login per app | Storefront /login = customers only; vendors/admins log in at their panel URLs | ✓ |
| Single login with role-based redirect | One /login page detects role and redirects across apps | |

**User's choice:** Separate login per app (recommended)

---

### Q4: Where does address management live?

| Option | Description | Selected |
|--------|-------------|----------|
| Dedicated /account/addresses page | Separate from profile; address list + Google Places form | ✓ |
| Inline in profile page | Single /account page with profile + address section | |

**User's choice:** Dedicated /account/addresses page (recommended)

---

## PDP Add-to-Cart Placeholder

### Q1: What does PDP show where Add to Cart will go?

| Option | Description | Selected |
|--------|-------------|----------|
| Disabled Add to Cart button | Visually complete button in disabled state; Phase 5 activates | ✓ |
| No button — pure display | No cart CTA; Phase 5 inserts the button | |
| Functional add-to-cart stub | Working button with Zustand cart slice; no backend call | |

**User's choice:** Disabled Add to Cart button (recommended)

---

### Q2: How should dynamic category-specific attributes render?

| Option | Description | Selected |
|--------|-------------|----------|
| Key-value spec table | "Specifications" table below description; works for all attribute types | ✓ |
| Inline attribute badges/chips | Chips in description area; crowds with many attributes | |
| Grouped attribute sections | Schema-driven groups; falls back to flat table | |

**User's choice:** Key-value spec table (recommended)

---

### Q3: How do variant selectors appear in Phase 4?

| Option | Description | Selected |
|--------|-------------|----------|
| Show variant selectors, disabled | Visual option pickers in disabled/read-only state; Phase 5 activates | ✓ |
| Variants as informational text | "Available in: S, M, L, XL" plain text | |
| Hide variants entirely in Phase 4 | No variant UI until Phase 5 | |

**User's choice:** Show variant selectors, disabled (recommended)

---

## Claude's Discretion

- Framer Motion animation scope (page transitions, card hovers, filter drawer, skeleton-to-content)
- React Router v6 route structure within `apps/web-storefront`
- API client implementation details (React Query fetch wrapper with cookie credentials)
- Skeleton loading state component design
- Google Places autocomplete component choice (`@vis.gl/react-google-maps` vs raw API)
- Customer auth service JWT access token TTL
- Product/category URL slug strategy

## Deferred Ideas

- Admin homepage block management UI → Phase 6
- Shopping basket / cart → Phase 5
- Checkout, payments, order placement → Phase 5
- Order history and detail pages → Phase 5
- Order tracking page → Phase 8
- Product reviews display → Phase 9 seed data (customer submission deferred to v1.x)
- Wishlist / save for later → v1.x
- Social login → v2
- Vendor mini-profile section on PDP (full profile) → Phase 6 (basic vendor name can show from Phase 3 product data)
