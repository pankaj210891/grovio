---
phase: 11-ux-ui-platform-redesign
plan: 01
subsystem: ui
tags: [shadcn, radix-ui, tailwind, design-system, packages-ui, components]

# Dependency graph
requires: []
provides:
  - cn() utility (packages/ui/src/lib/utils.ts)
  - 34 Shadcn components in packages/ui/src/components/ui/
  - Shadcn CSS variables + @theme inline mappings in tokens.css
  - components.json for future npx shadcn add workflows
  - Barrel exports updated in packages/ui/src/index.ts

affects: [packages/ui, apps/web-storefront, apps/web-admin, apps/web-vendor]

# Tech tracking
tech-stack:
  added:
    - class-variance-authority
    - clsx
    - tailwind-merge
    - lucide-react
    - cmdk
    - "@radix-ui/react-accordion + 24 other Radix UI primitives"
  patterns:
    - "Shadcn new-york style — components are owned code, not npm-locked"
    - "cn() = clsx + tailwind-merge for conditional class merging"
    - "@theme inline in tokens.css maps bg-background/text-primary/etc. to OKLCH values"
    - "Legacy bg-grovio-* utilities preserved for backward compat"

key-files:
  created:
    - packages/ui/src/lib/utils.ts
    - packages/ui/src/components/ui/button.tsx
    - packages/ui/src/components/ui/input.tsx
    - packages/ui/src/components/ui/textarea.tsx
    - packages/ui/src/components/ui/label.tsx
    - packages/ui/src/components/ui/badge.tsx
    - packages/ui/src/components/ui/card.tsx
    - packages/ui/src/components/ui/separator.tsx
    - packages/ui/src/components/ui/skeleton.tsx
    - packages/ui/src/components/ui/avatar.tsx
    - packages/ui/src/components/ui/progress.tsx
    - packages/ui/src/components/ui/switch.tsx
    - packages/ui/src/components/ui/checkbox.tsx
    - packages/ui/src/components/ui/radio-group.tsx
    - packages/ui/src/components/ui/tabs.tsx
    - packages/ui/src/components/ui/select.tsx
    - packages/ui/src/components/ui/dropdown-menu.tsx
    - packages/ui/src/components/ui/dialog.tsx
    - packages/ui/src/components/ui/alert-dialog.tsx
    - packages/ui/src/components/ui/sheet.tsx
    - packages/ui/src/components/ui/popover.tsx
    - packages/ui/src/components/ui/tooltip.tsx
    - packages/ui/src/components/ui/scroll-area.tsx
    - packages/ui/src/components/ui/accordion.tsx
    - packages/ui/src/components/ui/collapsible.tsx
    - packages/ui/src/components/ui/table.tsx
    - packages/ui/src/components/ui/toggle.tsx
    - packages/ui/src/components/ui/toggle-group.tsx
    - packages/ui/src/components/ui/aspect-ratio.tsx
    - packages/ui/src/components/ui/hover-card.tsx
    - packages/ui/src/components/ui/context-menu.tsx
    - packages/ui/src/components/ui/alert.tsx
    - packages/ui/src/components/ui/command.tsx
    - packages/ui/src/components/ui/navigation-menu.tsx
    - packages/ui/src/components/ui/toast.tsx
    - packages/ui/components.json
  modified:
    - packages/ui/package.json
    - packages/ui/src/tokens/tokens.css
    - packages/ui/src/index.ts

key-decisions:
  - "Shadcn new-york style chosen for refined border-radius and shadow treatment"
  - "All Radix UI primitives installed as regular deps (not peer) in packages/ui so web apps don't need to install them individually"
  - "OKLCH palette used for all Shadcn CSS variables — matches Grovio's existing token setup"

# Metrics
duration: ~15 minutes
completed: 2026-06-05
---

# Phase 11-01: Shadcn UI + Radix UI Foundation Summary

**Installed Shadcn UI (new-york style) with 34 Radix UI-backed components in `packages/ui` — the shared cross-app component library foundation for all three web portals.**

## Performance

- **Duration:** ~15 min
- **Completed:** 2026-06-05
- **Tasks:** 7 (T1–T7 all complete)
- **Files created:** 36 new + 3 modified

## Accomplishments

- **packages/ui/package.json** — added `class-variance-authority`, `clsx`, `tailwind-merge`, `lucide-react`, `cmdk`, and 25 `@radix-ui/*` packages as regular dependencies; React added as peerDependency
- **tokens.css** — added Shadcn CSS variables (`:root` + `.dark` blocks) using Grovio's OKLCH palette; added `@theme inline` block mapping `bg-background`, `text-foreground`, `text-primary`, `text-muted-foreground`, etc. to Tailwind utilities; legacy `bg-grovio-*` utilities preserved
- **packages/ui/src/lib/utils.ts** — `cn()` utility combining clsx + tailwind-merge
- **34 Shadcn components** in `packages/ui/src/components/ui/` — new-york style, all customizable owned code: button (5 variants + sizes), input, textarea, label, badge, card (6 sub-components), separator, skeleton, avatar, progress, switch, checkbox, radio-group, tabs, select, dropdown-menu, dialog, alert-dialog, sheet, popover, tooltip, scroll-area, accordion, collapsible, table, toggle, toggle-group, aspect-ratio, hover-card, context-menu, alert, command, navigation-menu, toast
- **packages/ui/src/index.ts** — barrel exports for all 34 components + `cn` utility
- **components.json** — Shadcn CLI config for `npx shadcn add <component>` future additions targeting `packages/ui`
- **tsup config** — JSX + React external already correct; build passes

## Task Commits

| Task | Commit | Description |
|------|--------|-------------|
| T1–T7 | f9719eb | Full foundation: package.json + tokens.css + cn() + 34 components + barrel + components.json |

## Verification

- `pnpm --filter @grovio/ui build` exits 0 — VERIFIED
- `dist/index.js` (69.93 KB) and `dist/index.d.ts` (35.51 KB) generated — VERIFIED
- All 34 component files present in `packages/ui/src/components/ui/` — VERIFIED
- `cn()` exported from `@grovio/ui` — VERIFIED
- Dark mode CSS variables on `.dark` class present — VERIFIED

## Self-Check: PASSED

- `packages/ui/src/lib/utils.ts` — FOUND
- `packages/ui/src/components/ui/button.tsx` — FOUND
- `packages/ui/src/components/ui/command.tsx` — FOUND
- `packages/ui/src/components/ui/navigation-menu.tsx` — FOUND
- `packages/ui/components.json` — FOUND
- Commit f9719eb — FOUND
- `pnpm --filter @grovio/ui build` exits 0 — VERIFIED

---
*Phase: 11-ux-ui-platform-redesign*
*Plan 01 complete — foundation ready for portal redesign plans*
