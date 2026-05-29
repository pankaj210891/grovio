---
phase: "01"
plan: "05"
subsystem: mobile
tags: [react-native, expo, metro, react-navigation, typescript, monorepo]

# Dependency graph
requires:
  - "01-01 (pnpm + Turborepo monorepo scaffold, @grovio/config package)"
  - "01-02 (@grovio/contracts with HealthCheckResponse type)"
provides:
  - "apps/mobile Expo SDK 53 bare workflow shell"
  - "Metro config with monorepo watchFolders and @grovio/contracts extraNodeModules resolution"
  - "React Navigation v7 stack navigator with HealthScreen route"
  - "HealthScreen that imports and uses HealthCheckResponse from @grovio/contracts"
  - "apps/mobile/.env.example documenting EXPO_PUBLIC_API_URL and EXPO_PUBLIC_GOOGLE_MAPS_KEY"
affects:
  - "01-10 (Wave 4 release build verification — Metro resolution proven here in dev; 01-10 verifies release build path)"
  - "Phase 8 React Native customer app (inherits Metro config, navigation scaffold, @grovio/contracts resolution pattern)"

# Tech tracking
tech-stack:
  added:
    - "expo@~53.0.0 (Expo SDK 53 bare workflow)"
    - "react-native@0.83.0"
    - "react@19.2.0 (React 19.2 shipped with RN 0.83)"
    - "@react-navigation/native@^7.2.0 (v7 stable — NOT v8 alpha)"
    - "@react-navigation/native-stack@^7.0.0"
    - "react-native-screens@^4.0.0"
    - "react-native-safe-area-context@^4.0.0"
    - "@tanstack/react-query@^5.100.0"
    - "zustand@^5.0.0"
    - "react-native-reanimated@~3.0.0"
    - "babel-preset-expo@~13.0.0"
  patterns:
    - "Metro monorepo resolution via watchFolders + extraNodeModules — maps @grovio/contracts directly to packages/contracts/src for dev-time TypeScript resolution without a build step"
    - "tsconfig.json uses moduleResolution: bundler (React Native Metro) overriding NodeNext from @grovio/config/tsconfig/node.json"
    - "babel.config.js: babel-preset-expo with react-native-reanimated/plugin last (required by Reanimated)"
    - "EXPO_PUBLIC_* vars pattern for React Native public env vars — documented with D-08 comments"

key-files:
  created:
    - apps/mobile/package.json
    - apps/mobile/app.json
    - apps/mobile/tsconfig.json
    - apps/mobile/babel.config.js
    - apps/mobile/.env.example
    - apps/mobile/metro.config.js
    - apps/mobile/App.tsx
    - apps/mobile/src/navigation/RootNavigator.tsx
    - apps/mobile/src/screens/HealthScreen.tsx
  modified: []

decisions:
  - "Metro extraNodeModules maps @grovio/contracts to packages/contracts/src directly — avoids build step during development; plan 01-10 will verify the release build uses compiled dist/ output"
  - "React Navigation v7 (^7.2.0) used — CLAUDE.md explicitly requires v7 stable, not v8 alpha"
  - "tsconfig.json extends @grovio/config/tsconfig/node.json and overrides with jsx:react-native and moduleResolution:bundler — React Native Metro requires bundler resolution, not NodeNext"
  - "babel.config.js uses CJS format (module.exports) — React Native uses CommonJS Metro bundler; NO type:module in package.json"
  - "babel-preset-expo used as the Expo-recommended preset; react-native-reanimated/plugin placed last per Reanimated requirements"

# Metrics
duration: "3 minutes"
completed: "2026-05-29"
tasks_completed: 2
files_created: 9
files_modified: 0
---

# Phase 01 Plan 05: React Native Mobile Shell Summary

Expo SDK 53 bare workflow React Native app scaffold with Metro monorepo workspace resolution for `@grovio/contracts`, React Navigation v7 stack navigator, and a HealthScreen that imports `HealthCheckResponse` — proving the Metro-to-workspace package resolution path needed for FND-03.

## Performance

- **Duration:** 3 minutes
- **Started:** 2026-05-29T12:26:16Z
- **Completed:** 2026-05-29T12:29:25Z
- **Tasks:** 2 completed
- **Files created:** 9

## Accomplishments

- Created the complete `apps/mobile` Expo bare workflow scaffold: `package.json` (no `type: "module"` — Metro is CommonJS), `app.json` (Expo SDK 53, Hermes engine), `tsconfig.json` (jsx: react-native, moduleResolution: bundler), `babel.config.js` (babel-preset-expo + reanimated plugin last), `.env.example` (EXPO_PUBLIC_API_URL, EXPO_PUBLIC_GOOGLE_MAPS_KEY with D-08 comments)
- Established Metro workspace resolution via `watchFolders` (monorepo root) + `extraNodeModules` (`@grovio/contracts` → `packages/contracts/src`) — the direct source-level resolution proven in dev; plan 01-10 will verify release build output
- Wired React Navigation v7 (stable — not v8 alpha per CLAUDE.md) with a typed `RootStackParamList`, a `RootNavigator` using `createNativeStackNavigator`, and a `HealthScreen` route with the "Grovio" title
- Implemented `HealthScreen` that imports `HealthCheckResponse` as a TypeScript type from `@grovio/contracts` and declares a typed variable — structurally proves the workspace resolution path

## Task Commits

Each task was committed atomically:

1. **Task 1: apps/mobile package scaffold** - `415ba05` (chore)
2. **Task 2: Metro workspace config and app entry points** - `60f3276` (feat)

## Files Created

- `apps/mobile/package.json` — @grovio/mobile private package, no type:module, React Navigation v7, @grovio/contracts workspace:*, Expo ~53.0.0
- `apps/mobile/app.json` — Expo config: name grovio, slug grovio, sdkVersion 53.0.0, jsEngine hermes, scheme grovio, platforms ios+android
- `apps/mobile/tsconfig.json` — extends @grovio/config/tsconfig/node.json, overrides: jsx react-native, lib ES2022, moduleResolution bundler, module ESNext
- `apps/mobile/babel.config.js` — babel-preset-expo + react-native-reanimated/plugin (last, as required)
- `apps/mobile/.env.example` — EXPO_PUBLIC_API_URL (with comment), EXPO_PUBLIC_GOOGLE_MAPS_KEY (with comment, Phase 7 note)
- `apps/mobile/metro.config.js` — getDefaultConfig from expo/metro-config, watchFolders: [monorepoRoot], nodeModulesPaths: [app + root], extraNodeModules: @grovio/contracts → packages/contracts/src
- `apps/mobile/App.tsx` — NavigationContainer wrapping RootNavigator
- `apps/mobile/src/navigation/RootNavigator.tsx` — createNativeStackNavigator, RootStackParamList, Health screen with "Grovio" title
- `apps/mobile/src/screens/HealthScreen.tsx` — imports HealthCheckResponse type from @grovio/contracts, typed healthData variable, View/Text/StyleSheet render

## Decisions Made

1. **Metro extraNodeModules maps to packages/contracts/src** — avoids requiring a build step during development. The `@grovio/contracts` package exports point to `dist/` (for post-build consumption), but Metro in development resolves TypeScript source directly via `extraNodeModules`. Plan 01-10 (Wave 4) will run a release build to verify the built `dist/` path works for production bundles.

2. **React Navigation v7 chosen over v8** — CLAUDE.md §"What NOT to Use" explicitly states "React Navigation v8 (alpha) — use stable v7". Package `@react-navigation/native@^7.2.0` and `@react-navigation/native-stack@^7.0.0` used.

3. **tsconfig.json overrides NodeNext with bundler** — `@grovio/config/tsconfig/node.json` inherits `NodeNext` from root `tsconfig.base.json`. React Native's Metro bundler uses its own resolution; `moduleResolution: "bundler"` is the correct TypeScript setting. The child tsconfig overrides both `module` and `moduleResolution`.

4. **No `type: "module"` in package.json** — React Native's Metro bundler uses CommonJS. Setting `type: "module"` would break Metro's `require()` calls. babel.config.js also uses `module.exports` for this reason.

5. **react-native-reanimated/plugin placed last in babel plugins** — This is a hard requirement from Reanimated's documentation; other transforms must run before the Reanimated plugin for worklet detection to work correctly.

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

- `HealthScreen` uses a hardcoded `healthData` object typed as `HealthCheckResponse` with `status: 'ok'` — this is intentional. The screen's purpose is to prove type resolution, not to fetch real API data. Phase 8 will replace this with actual API calls.
- No `QueryClient` wired in `App.tsx` — per plan instructions, React Query setup is deferred to Phase 7/8 when data fetching is needed.

## Threat Mitigations Applied

| Threat | Status |
|--------|--------|
| T-05-01: EXPO_PUBLIC_* vars in bundle | Accepted — .env.example comments warn against placing secrets here; EXPO_PUBLIC_* are intentionally public |
| T-05-02: Metro resolves packages/contracts/src in dev | Accepted — documented as dev-only; plan 01-10 verifies release build uses dist/ output |
| T-05-SC: npm package legitimacy for expo, react-navigation, reanimated | All packages are in CLAUDE.md recommended stack with confirmed versions |

## Threat Flags

None — this plan creates a React Native app scaffold with no network endpoints, no auth paths, no file system access, and no schema changes at trust boundaries.

## Self-Check: PASSED

- [x] `apps/mobile/package.json` — FOUND: name @grovio/mobile, no type:module, @react-navigation/native ^7.2.0, @grovio/contracts workspace:*
- [x] `apps/mobile/app.json` — FOUND: sdkVersion 53.0.0, jsEngine hermes
- [x] `apps/mobile/tsconfig.json` — FOUND: jsx react-native, moduleResolution bundler
- [x] `apps/mobile/babel.config.js` — FOUND: react-native-reanimated/plugin present
- [x] `apps/mobile/.env.example` — FOUND: EXPO_PUBLIC_API_URL with comment
- [x] `apps/mobile/metro.config.js` — FOUND: watchFolders, extraNodeModules @grovio/contracts
- [x] `apps/mobile/App.tsx` — FOUND: NavigationContainer import
- [x] `apps/mobile/src/navigation/RootNavigator.tsx` — FOUND: createNativeStackNavigator import
- [x] `apps/mobile/src/screens/HealthScreen.tsx` — FOUND: HealthCheckResponse import, typed variable
- [x] Commit 415ba05 exists in git log
- [x] Commit 60f3276 exists in git log
