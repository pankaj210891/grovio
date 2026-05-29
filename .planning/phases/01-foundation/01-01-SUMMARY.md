---
phase: 01-foundation
plan: "01"
subsystem: infra
tags: [pnpm, turborepo, typescript, eslint, prettier, docker, monorepo]

# Dependency graph
requires: []
provides:
  - pnpm 9 + Turborepo 2.9 workspace scaffold with apps/* and packages/* globs
  - Root TypeScript strict-mode base config (tsconfig.base.json) for entire monorepo
  - Shared config package (@grovio/config) with tsconfig presets for React/Node targets
  - ESLint 9 flat-config factory (createEslintConfig) consumable by all workspace apps
  - docker-compose.yml with postgres:16, redis:7, opensearch:2.18 for local dev
  - .nvmrc, .prettierrc, .prettierignore, .gitignore establishing dev tooling hygiene
affects:
  - 01-02 (API skeleton — inherits workspace, tsconfig.node.json, docker-compose infra)
  - 01-03 (web storefront — inherits tsconfig.react.json, eslint-preset)
  - 01-04 (web admin — inherits tsconfig.react.json, eslint-preset)
  - 01-05 (web vendor — inherits tsconfig.react.json, eslint-preset)
  - 01-06 (React Native — inherits pnpm workspace protocol)
  - All subsequent plans that consume @grovio/config or turbo pipeline tasks

# Tech tracking
tech-stack:
  added:
    - turbo@2.9.x (build orchestration, task graph)
    - typescript@5.8.x (strict mode, project references ready)
    - eslint@9.x (flat-config format)
    - prettier@3.x (formatting)
    - "@typescript-eslint/eslint-plugin@8.x"
    - "@typescript-eslint/parser@8.x"
    - eslint-config-prettier@9.x
    - eslint-plugin-react-hooks@5.x
    - eslint-plugin-react-refresh@0.4.x
    - postgres:16-alpine (docker)
    - redis:7-alpine (docker)
    - opensearchproject/opensearch:2.18.0 (docker)
  patterns:
    - Turborepo pipeline with dependsOn ^build/^typecheck for correct build ordering
    - packages/config as shared config source — tsconfig presets + ESLint factory
    - ESLint 9 flat-config factory pattern (createEslintConfig with options + overrides)
    - workspace:* protocol for all inter-package references
    - BIGINT/integer-minor-unit convention established in project decisions

key-files:
  created:
    - package.json (root monorepo manifest)
    - pnpm-workspace.yaml (apps/* packages/* workspace globs)
    - turbo.json (build/typecheck/lint/format/test/dev/clean pipeline)
    - tsconfig.base.json (strict, noUncheckedIndexedAccess, NodeNext, ES2022)
    - .nvmrc (Node 22 LTS pin)
    - .prettierrc (singleQuote, trailingComma all, printWidth 100)
    - .prettierignore (node_modules, dist, build, .turbo, coverage, lock files)
    - .gitignore (deps, build, env, OS, RN/Expo dirs)
    - packages/config/package.json (@grovio/config with exports map)
    - packages/config/tsconfig.base.json (re-exports root base)
    - packages/config/tsconfig.react.json (react-jsx, DOM, vite/client)
    - packages/config/tsconfig.node.json (NodeNext module resolution)
    - packages/config/eslint-preset.js (ESLint 9 flat-config factory)
    - docker-compose.yml (postgres, redis, opensearch with healthchecks)
  modified: []

key-decisions:
  - "Turborepo pipeline uses 'pipeline' key (not 'tasks') for Turborepo 2.9 compatibility"
  - "packages/config re-exports root tsconfig.base.json rather than duplicating options — single source of truth"
  - "ESLint preset uses createEslintConfig() factory pattern with optional react/viteRefresh flags so web apps and backend share one preset with different feature sets"
  - "docker-compose disables OpenSearch security plugin for local dev only — comment documents production requirement to enable TLS and auth"
  - "OpenSearch 2.18.0 pinned (not 2.x latest) for reproducible local dev across team"

patterns-established:
  - "Shared config via @grovio/config: all apps extend tsconfig presets and import eslint factory"
  - "Turborepo dependsOn ^build/^typecheck: ensures build ordering across workspace packages"
  - "ESLint 9 flat-config factory: export createEslintConfig({react, viteRefresh}, overrides)"

requirements-completed:
  - FND-01
  - FND-05

# Metrics
duration: 4min
completed: "2026-05-29"
---

# Phase 01 Plan 01: Monorepo Scaffold Summary

**pnpm + Turborepo workspace scaffold with shared TypeScript/ESLint configs in @grovio/config and docker-compose for local Postgres 16, Redis 7, and OpenSearch 2.18 services.**

## Performance

- **Duration:** 4 minutes
- **Started:** 2026-05-29T12:15:31Z
- **Completed:** 2026-05-29T12:19:27Z
- **Tasks:** 3 completed
- **Files modified:** 14 created

## Accomplishments

- Established the pnpm 9 + Turborepo 2.9 workspace with `apps/*` and `packages/*` globs; all future workspace members resolve via `workspace:*` protocol
- Created strict-mode root `tsconfig.base.json` (strict, noUncheckedIndexedAccess, exactOptionalPropertyTypes) as the inheritance anchor for all packages
- Delivered `@grovio/config` package with three tsconfig presets (base, react, node) and an ESLint 9 flat-config factory that web apps and backend can customize with options/overrides
- Provided `docker-compose.yml` with postgres:16, redis:7, opensearch:2.18.0 each with healthchecks and named volumes — minimum dev services available with `docker-compose up -d postgres redis`

## Task Commits

Each task was committed atomically:

1. **Task 1: Root monorepo scaffold** - `435c75a` (chore)
2. **Task 2: packages/config shared configs** - `db292dc` (feat)
3. **Task 3: docker-compose.yml local infra** - `e81b1b2` (chore)

## Files Created/Modified

- `package.json` - Root monorepo manifest: grovio-monorepo, private, engines node>=22.2.0/pnpm>=9, turbo scripts
- `pnpm-workspace.yaml` - Workspace member globs: apps/* and packages/*
- `turbo.json` - Pipeline: build/typecheck/lint/format:check/format:write/test/dev/clean
- `tsconfig.base.json` - Strict-mode TypeScript base: ES2022 target, NodeNext, strictNullChecks, noUncheckedIndexedAccess, exactOptionalPropertyTypes
- `.nvmrc` - Node 22 LTS pin
- `.prettierrc` - singleQuote, trailingComma all, printWidth 100, semi true
- `.prettierignore` - node_modules, dist, build, .turbo, coverage, lock files
- `.gitignore` - Dependencies, build outputs, env files, OS artifacts, React Native/Expo dirs
- `packages/config/package.json` - @grovio/config with exports map for tsconfig presets and eslint-preset
- `packages/config/tsconfig.base.json` - Extends ../../tsconfig.base.json (chain anchor)
- `packages/config/tsconfig.react.json` - jsx:react-jsx, DOM + DOM.Iterable libs, vite/client types
- `packages/config/tsconfig.node.json` - NodeNext module + moduleResolution for backend
- `packages/config/eslint-preset.js` - ESLint 9 flat-config createEslintConfig() factory
- `docker-compose.yml` - postgres:16-alpine, redis:7-alpine, opensearch:2.18.0 with healthchecks

## Decisions Made

- Turborepo pipeline uses `pipeline` key (Turborepo 2.9.x format, not `tasks`)
- `packages/config/tsconfig.base.json` extends the root `tsconfig.base.json` rather than duplicating options — maintains single source of truth for compiler strictness
- ESLint factory uses try/catch for optional plugin loading so the preset degrades gracefully if `react-hooks` / `react-refresh` are not installed in a given package
- docker-compose pins OpenSearch to `2.18.0` for reproducibility; security plugin disabled only for local dev with comment requiring production TLS/auth configuration

## Deviations from Plan

None — plan executed exactly as written.

## Known Stubs

None — this plan creates tooling configuration only; no application code or UI.

## Threat Flags

No new threat surface introduced beyond what is documented in the plan's threat model (local-dev-only docker credentials and disabled OpenSearch security plugin — both accepted per T-01-01 and T-01-02).

## Self-Check: PASSED

- [x] `package.json` exists at worktree root
- [x] `pnpm-workspace.yaml` exists with apps/* and packages/* globs
- [x] `turbo.json` pipeline has 8 entries: build, typecheck, lint, format:check, format:write, test, dev, clean
- [x] `tsconfig.base.json` has strict:true and noUncheckedIndexedAccess:true
- [x] `packages/config/package.json` name is @grovio/config with exports map
- [x] `packages/config/tsconfig.react.json` has jsx:react-jsx and types:vite/client
- [x] `packages/config/tsconfig.node.json` has module:NodeNext
- [x] `packages/config/eslint-preset.js` contains typescript-eslint reference
- [x] `docker-compose.yml` has postgres:16-alpine, redis:7-alpine, opensearch:2.18.0 with healthchecks
- [x] Commits 435c75a, db292dc, e81b1b2 exist in git log
