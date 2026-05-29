---
phase: "01"
plan: "04"
subsystem: web-apps
tags: [react, vite, tailwindcss, framer-motion, typescript, react-query, zustand]

dependency_graph:
  requires:
    - "01-01 (monorepo scaffold, @grovio/config tsconfig presets)"
    - "01-02 (@grovio/contracts HealthCheckResponse type)"
  provides:
    - "apps/web-storefront — Vite 8 + React 19 + Tailwind CSS v4 app shell on port 5173"
    - "apps/web-admin — Vite 8 + React 19 + Tailwind CSS v4 app shell on port 5174"
    - "apps/web-vendor — Vite 8 + React 19 + Tailwind CSS v4 app shell on port 5175"
  affects:
    - "01-07 (packages/ui tokens — app.css already @imports @grovio/ui/tokens placeholder)"
    - "Phase 4 (storefront features — shell scaffold ready)"
    - "Phase 6 (admin/vendor features — shells scaffold ready)"

tech_stack:
  added:
    - "react@^19.2.3 + react-dom@^19.2.3 (CVE-2025-55182 patched)"
    - "framer-motion@^12.0.0 (import from motion/react)"
    - "@tanstack/react-query@^5.100.0"
    - "zustand@^5.0.0"
    - "vite@^8.0.0 + @vitejs/plugin-react@^4.0.0"
    - "tailwindcss@^4.3.0 + @tailwindcss/vite@^4.3.0 (NO PostCSS)"
    - "typescript@^5.8.0 + @types/react@^19 + @types/react-dom@^19"
  patterns:
    - "Tailwind CSS v4 via @tailwindcss/vite plugin — no postcss.config.* files anywhere"
    - "app.css: @import tailwindcss + @import @grovio/ui/tokens (placeholder until plan 01-07)"
    - "App.tsx HealthCheckResponse type assertion proves @grovio/contracts import chain"
    - "motion.div from motion/react for 0.5s fade-in — proves framer-motion 12.x wiring"
    - "VITE_* env vars are public; .env.example comments explicitly note no-secrets rule"

key_files:
  created:
    - apps/web-storefront/package.json
    - apps/web-storefront/tsconfig.json
    - apps/web-storefront/vite.config.ts
    - apps/web-storefront/index.html
    - apps/web-storefront/src/main.tsx
    - apps/web-storefront/src/App.tsx
    - apps/web-storefront/src/app.css
    - apps/web-storefront/.env.example
    - apps/web-admin/package.json
    - apps/web-admin/tsconfig.json
    - apps/web-admin/vite.config.ts
    - apps/web-admin/index.html
    - apps/web-admin/src/main.tsx
    - apps/web-admin/src/App.tsx
    - apps/web-admin/src/app.css
    - apps/web-admin/.env.example
    - apps/web-vendor/package.json
    - apps/web-vendor/tsconfig.json
    - apps/web-vendor/vite.config.ts
    - apps/web-vendor/index.html
    - apps/web-vendor/src/main.tsx
    - apps/web-vendor/src/App.tsx
    - apps/web-vendor/src/app.css
    - apps/web-vendor/.env.example
  modified: []

decisions:
  - "All three apps use identical dependency set (react, framer-motion, react-query, zustand, @grovio/contracts, @grovio/ui) — consistent base for Phase 4 and 6 divergence"
  - "app.css @imports @grovio/ui/tokens now (before plan 01-07 creates it) to prove import chain design; Vite dev server will warn until 01-07 ships"
  - "VITE_* vars use bracket notation (import.meta.env['VITE_API_URL']) for exactOptionalPropertyTypes compatibility with tsconfig strict mode"

metrics:
  duration: "~10 minutes"
  completed_date: "2026-05-29"
  tasks_completed: 2
  files_created: 24
  files_modified: 0
---

# Phase 01 Plan 04: Web App Shells (Storefront, Admin, Vendor) Summary

**Three Vite 8 + React 19.2 + TypeScript + Tailwind CSS v4 app shells with @tailwindcss/vite plugin (no PostCSS), health screen components with Framer Motion fade-in, and @grovio/contracts type imports — ready for Phase 4 and 6 feature work.**

## Performance

- **Duration:** ~10 minutes
- **Started:** 2026-05-29T12:19:00Z
- **Completed:** 2026-05-29T12:29:50Z
- **Tasks:** 2 completed
- **Files created:** 24

## Accomplishments

- Created three workspace app packages (`@grovio/web-storefront`, `@grovio/web-admin`, `@grovio/web-vendor`) with correct dependency sets pinned to CVE-safe versions (react>=19.2.3)
- Wired Tailwind CSS v4 exclusively via `@tailwindcss/vite` plugin in every `vite.config.ts` — zero `postcss.config.*` files anywhere in the workspace
- Each app shell renders a branded health screen with app-specific title, `motion.div` fade-in from `motion/react` (framer-motion 12.x), and a status badge
- Each `App.tsx` imports `HealthCheckResponse` from `@grovio/contracts` as a type assertion — proves the contracts import chain resolves correctly
- Each `tsconfig.json` extends `@grovio/config/tsconfig/react.json` — inherits strict mode + vite/client types from plan 01-01
- Each `app.css` uses `@import "tailwindcss"` (v4 syntax) and pre-wires `@import "@grovio/ui/tokens"` placeholder for plan 01-07
- `.env.example` files document all VITE_* vars with comment lines explaining purpose and noting that VITE_* vars are public/not for secrets

## Task Commits

Each task was committed atomically:

1. **Task 1: Package scaffolds** — `809dfee` (feat)
2. **Task 2: Entry points and health screens** — `d125ccd` (feat)

## Files Created

### apps/web-storefront
- `package.json` — @grovio/web-storefront, react@^19.2.3, framer-motion@^12, react-query 5.100.x, zustand 5.x
- `tsconfig.json` — extends @grovio/config/tsconfig/react.json, composite false
- `vite.config.ts` — @tailwindcss/vite + @vitejs/plugin-react, port 5173, @ alias
- `index.html` — Grovio Storefront title, div#root, module script
- `src/main.tsx` — React.StrictMode + ReactDOM.createRoot
- `src/App.tsx` — health screen with VITE_API_URL display, motion.div fade-in, HealthCheckResponse assertion
- `src/app.css` — @import tailwindcss; @import @grovio/ui/tokens (placeholder)
- `.env.example` — VITE_API_URL, VITE_PUBLIC_URL, VITE_GOOGLE_MAPS_API_KEY with comments

### apps/web-admin
- `package.json` — @grovio/web-admin, same dependency set
- `tsconfig.json` — extends @grovio/config/tsconfig/react.json
- `vite.config.ts` — @tailwindcss/vite, port 5174
- `index.html` — Grovio Admin title
- `src/main.tsx` — React.StrictMode + ReactDOM.createRoot
- `src/App.tsx` — health screen "Grovio Admin Panel", motion.div fade-in, HealthCheckResponse assertion
- `src/app.css` — @import tailwindcss; @import @grovio/ui/tokens
- `.env.example` — VITE_API_URL, VITE_PUBLIC_URL with comments

### apps/web-vendor
- `package.json` — @grovio/web-vendor, same dependency set
- `tsconfig.json` — extends @grovio/config/tsconfig/react.json
- `vite.config.ts` — @tailwindcss/vite, port 5175
- `index.html` — Grovio Vendor title
- `src/main.tsx` — React.StrictMode + ReactDOM.createRoot
- `src/App.tsx` — health screen "Grovio Vendor Panel", motion.div fade-in, HealthCheckResponse assertion
- `src/app.css` — @import tailwindcss; @import @grovio/ui/tokens
- `.env.example` — VITE_API_URL, VITE_PUBLIC_URL with comments

## Decisions Made

1. **Identical dependency sets across all three apps** — React, framer-motion, react-query, zustand, @grovio/contracts, @grovio/ui are identical in all three. Phase 4 and 6 will add app-specific packages; starting identical avoids premature divergence.

2. **app.css pre-wires @grovio/ui/tokens placeholder** — The import is in place now so plan 01-07 only needs to create the tokens file and the import chain becomes live without modifying app.css.

3. **VITE_* bracket notation for strict mode** — `import.meta.env['VITE_API_URL']` satisfies `exactOptionalPropertyTypes` from the root tsconfig strict config established in plan 01-01.

4. **CVE-2025-55182 mitigation** — All three apps pin `react@^19.2.3` (not `^19.0.0`) per T-04-02 threat model.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `apps/*/src/app.css`: `@import "@grovio/ui/tokens"` — resolves to nothing until plan 01-07 creates `packages/ui`. Vite dev server will warn on startup until then. This is intentional per plan design; the import is a placeholder that proves the chain once 01-07 ships.

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-04-01: VITE_* vars in bundle | Accepted — .env.example comments explicitly state "Do NOT put secrets in VITE_* variables" |
| T-04-02: React 19.2.x CVE-2025-55182 | Mitigated — all three apps pin react@^19.2.3 in package.json |
| T-04-SC: npm package legitimacy | All packages (react, vite, tailwindcss, framer-motion, react-query, zustand) are in CLAUDE.md recommended stack |

## Threat Flags

None — no new network endpoints, auth paths, file access patterns, or schema changes introduced. These are static frontend shells.

## Self-Check: PASSED

Files verified present:
- apps/web-storefront/package.json — FOUND
- apps/web-storefront/tsconfig.json — FOUND
- apps/web-storefront/vite.config.ts — FOUND
- apps/web-storefront/index.html — FOUND
- apps/web-storefront/src/main.tsx — FOUND
- apps/web-storefront/src/App.tsx — FOUND
- apps/web-storefront/src/app.css — FOUND
- apps/web-storefront/.env.example — FOUND
- apps/web-admin/package.json — FOUND
- apps/web-admin/tsconfig.json — FOUND
- apps/web-admin/vite.config.ts — FOUND
- apps/web-admin/index.html — FOUND
- apps/web-admin/src/main.tsx — FOUND
- apps/web-admin/src/App.tsx — FOUND
- apps/web-admin/src/app.css — FOUND
- apps/web-admin/.env.example — FOUND
- apps/web-vendor/package.json — FOUND
- apps/web-vendor/tsconfig.json — FOUND
- apps/web-vendor/vite.config.ts — FOUND
- apps/web-vendor/index.html — FOUND
- apps/web-vendor/src/main.tsx — FOUND
- apps/web-vendor/src/App.tsx — FOUND
- apps/web-vendor/src/app.css — FOUND
- apps/web-vendor/.env.example — FOUND

Commits verified: 809dfee and d125ccd present in git log.
