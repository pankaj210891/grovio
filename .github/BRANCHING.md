# Branching Policy — Grovio

Grovio uses a simplified GitFlow model suited to a monorepo starter kit with a
single active milestone at a time.

---

## Branch Structure

| Branch | Purpose | Created from | Merges into |
|--------|---------|--------------|-------------|
| `main` | Production-ready code. Tagged releases only. | — | — |
| `develop` | Active integration branch. All feature work lands here first. | `main` | `main` (release only) |
| `feat/*` | New feature or capability | `develop` | `develop` via PR |
| `fix/*` | Bug fix | `develop` | `develop` via PR |
| `refactor/*` | Internal restructuring with no behaviour change | `develop` | `develop` via PR |
| `chore/*` | Tooling, dependency updates, CI, config | `develop` | `develop` via PR |
| `docs/*` | Documentation-only changes | `develop` | `develop` via PR |

---

## Rules

### Working branches
- **Always branch from `develop`**, never from `main`.
- Use the prefix that best describes the change: `feat/`, `fix/`, `refactor/`, `chore/`, `docs/`.
- Name branches clearly: `feat/category-engine`, `fix/metro-resolution`, `chore/update-drizzle`.
- **Do not delete branches** after merging — keep the full history.

### Merging to `develop`
- Open a Pull Request from your working branch into `develop`.
- No direct pushes to `develop`.
- CI must pass (lint, typecheck, format, test, build) before merging.
- Squash or merge commit — team preference; be consistent per area.

### Merging to `main` (releases)
- **Never merge `develop` into `main` automatically.**
- Only merge `develop` → `main` when a release is explicitly requested.
- Create a PR from `develop` → `main`, tag the resulting commit with the version (`v1.0.0`).
- No direct pushes to `main`.

---

## GitHub Branch Protection Settings

Apply these in **Settings → Branches → Branch protection rules**.

### Rule for `main`

| Setting | Value |
|---------|-------|
| Branch name pattern | `main` |
| Require a pull request before merging | ✅ Enabled |
| Required approvals | 1 |
| Dismiss stale PR approvals when new commits are pushed | ✅ Enabled |
| Require status checks to pass | ✅ Enabled |
| Required checks | `ci` (lint, typecheck, format, test, build) |
| Require branches to be up to date before merging | ✅ Enabled |
| Do not allow bypassing the above settings | ✅ Enabled |
| Allow force pushes | ❌ Disabled |
| Allow deletions | ❌ Disabled |

### Rule for `develop`

| Setting | Value |
|---------|-------|
| Branch name pattern | `develop` |
| Require a pull request before merging | ✅ Enabled |
| Required approvals | 1 (set to 0 for solo development) |
| Require status checks to pass | ✅ Enabled |
| Required checks | `ci` (lint, typecheck, format, test, build) |
| Allow force pushes | ❌ Disabled |
| Allow deletions | ❌ Disabled |

---

## Branch Lifecycle Example

```
main ──────────────────────────────────────── v1.0 tag
        ↑                                       ↑
develop ────────────────────────────────────── release PR
          ↑           ↑           ↑
         feat/x      fix/y     chore/z
         (PR)        (PR)       (PR)
```

---

## Notes for Monorepo Starter Kit Buyers

Buyers who purchase Grovio may rebrand and extend it. When they do:

- Fork or clone the repo and keep this branching policy as-is.
- New vertical customisations go into `feat/` branches off `develop`.
- Upstream patches from Grovio can be cherry-picked onto their `develop`.
- Do not push directly to `main` — protect it from day one.
