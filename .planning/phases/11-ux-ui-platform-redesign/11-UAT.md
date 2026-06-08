---
status: testing
phase: 11-ux-ui-platform-redesign
source:
  - 11-01-SUMMARY.md
  - 11-02-SUMMARY.md
  - 11-03-SUMMARY.md
  - 11-04-SUMMARY.md
  - 11-05-SUMMARY.md
started: "2026-06-08T00:00:00.000Z"
updated: "2026-06-08T00:00:00.000Z"
---

## Current Test

number: 2
name: Admin Portal — Login + Dashboard
expected: |
  Navigating to the admin panel URL shows a login page with email + password fields.
  After logging in, the dashboard shows 6 KPI tiles, CommandBar, and Sidebar.
awaiting: user response

## Tests

### 1. Shared UI Library Build + Storybook
expected: Running `pnpm --filter @grovio/ui build` exits 0 and produces dist/index.js. Running `pnpm --filter @grovio/ui build-storybook` exits 0. All 9 story files are present in packages/ui/src/stories/.
result: issue
reported: "pnpm --filter @grovio/ui build failed — motion/react could not be resolved (framer-motion not in deps, not marked external in tsup)"
severity: major
fix_applied: "Added motion + framer-motion as peerDeps and devDeps; added --external framer-motion --external motion to tsup build command. Build now exits 0. (commit fced500)"

### 2. Admin Portal — Login + Dashboard
expected: Navigating to the admin panel URL shows a login page with email + password fields. After logging in, the dashboard shows 6 KPI tiles (Total GMV, Active Vendors, Pending Approvals, Pending Products, Open Returns, Platform Revenue), a platform health widget, and a Needs Attention queue. The CommandBar (56px top bar with search, notification bell, admin dropdown) and Sidebar are visible.
result: [pending]

### 3. Admin Portal — RBAC + Vendor KYC
expected: The sidebar nav items filter by role — a moderator account should not see the Finance tab. On the Vendors page, each vendor card shows a health score badge. Clicking a vendor opens VendorProfilePage with 3 tabs: Overview, KYC, Payouts. The KYC tab shows a document upload section.
result: [pending]

### 4. Vendor Portal — Morning-Glance Dashboard
expected: The vendor dashboard shows 6 metric tiles (Today's Orders, Revenue MTD, Pending Orders, Products, Rating, Returns). A financial position card shows last settlement amount and next estimated payout. Alert banners appear for actionable items (e.g. low stock). An onboarding checklist widget appears in the sidebar footer for new vendors.
result: [pending]

### 5. Vendor Portal — Product Creation Wizard
expected: Clicking "New Product" opens a multi-step wizard with step indicators at the top (Basic Info → Media → Variants → Pricing → Review). Each step shows relevant fields. The wizard saves draft state so navigating between steps doesn't lose data. Cancel exits without saving.
result: [pending]

### 6. Vendor Portal — Order Kanban
expected: The Orders page shows a kanban board with columns: Pending → Confirmed → Shipped → Delivered. Order cards are in the correct column. A "Bulk Ship" button on the Confirmed column opens a modal to enter tracking numbers. Clicking a card opens order detail.
result: [pending]

### 7. Storefront — Mobile Bottom Navigation
expected: When the browser window is narrowed below 768px (or on a real mobile device), the top Header disappears and a 5-tab fixed bottom navigation bar appears (Home, Categories, Search, Cart, Account). The Cart tab shows a badge with item count. Tapping each tab navigates correctly.
result: [pending]

### 8. Storefront — PLP Filter + Comparison Tray
expected: On a category/search results page, the filter sidebar is sticky on scroll and can be collapsed with a toggle button. When collapsed, active filters appear as chips in a horizontal strip above the product grid. A grid/list view toggle is present and the preference persists on page refresh. Each ProductCard has a "Compare" checkbox; selecting 3 shows a floating comparison tray at the bottom with a "Compare" button that opens a side-by-side dialog.
result: [pending]

### 9. Storefront — PDP Gallery + Delivery Check
expected: The product detail page shows a main image with thumbnail strip. Clicking a thumbnail switches the main image. Clicking the main image opens a lightbox with keyboard navigation (left/right arrows, Escape to close). On mobile, the gallery is a swipeable horizontal carousel with dot indicators. Variant swatches show color circles for color attributes and size chips for sizes. A pincode input field is present; entering a 6-digit pincode shows "Delivery available" or "Not serviceable" feedback.
result: [pending]

### 10. Storefront — Dark Mode Toggle
expected: The storefront Header has a sun/moon toggle button next to the cart icon. Clicking it switches the entire page to dark mode (background becomes dark, text becomes light — all design tokens apply). Clicking again returns to light mode. Refreshing the page maintains the selected mode (preference stored in localStorage).
result: [pending]

### 11. Storefront — Wishlist + Price Drop Badge
expected: Each ProductCard has a heart icon in the top-right corner. Clicking it for a guest user shows a sign-in prompt. For a logged-in customer, clicking toggles the wishlist (heart fills/unfills with optimistic update). The /account/wishlist page shows a grid of saved products. Products with a price reduction show a "Price Dropped!" badge on the card.
result: [pending]

### 12. Storefront — Notifications Center
expected: The storefront header has a notification bell icon. If the customer has unread notifications, a badge count appears on the bell. Clicking the bell shows a dropdown of the last 5 notifications with a "View All" link. The /account/notifications page shows a full paginated list with dismiss buttons. "Mark all as dismissed" clears the unread state. In the Profile/Account page, there's a Notifications section with toggles for price_drops and promotions (order_updates shows as always-on).
result: [pending]

### 13. i18n Foundation
expected: The storefront Header, CartPage, and CheckoutPage use `t()` calls for user-facing strings (no hardcoded English strings directly in JSX). Running the app with a different locale key should translate those strings. The packages/locales/ directory exists with en/common.json containing common button labels (Add to Cart, Save, Cancel).
result: [pending]

### 14. Accessibility — Skip-to-Content
expected: On all three portals (storefront, admin, vendor), pressing Tab on page load focuses a "Skip to main content" link that is normally visually hidden (sr-only) but becomes visible on focus. Activating it jumps the focus to the main content area. No critical axe-core violations appear in the browser console in dev mode.
result: [pending]

### 15. Performance — Code Splitting
expected: All page-level components in the storefront App.tsx are wrapped in React.lazy() with Suspense. Opening the browser's Network tab and navigating to different routes shows separate JavaScript chunks being loaded (not one giant bundle). The first page load loads only the current route's chunk.
result: [pending]

## Summary

total: 15
passed: 0
issues: 1
pending: 14
skipped: 0

## Gaps

[none yet]
