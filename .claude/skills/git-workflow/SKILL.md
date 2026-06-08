---
name: git-workflow
description: Mandatory Git branching, commit, and workflow rules for all future development tasks in this project.
---

# Git Strategy & Workflow Rules (Mandatory)

## Instructions

You must strictly follow the Git workflow and branching strategy below for all future development tasks in this project.

## Branching Strategy

### Main Branches

#### 1. master (or main)

- Production-ready branch.
- Stores official release history.
- Must always remain stable and deployable.
- Direct commits are not allowed unless explicitly instructed.

#### 2. develop

- Main integration branch.
- All ongoing development merges here first.
- Base branch for all feature and bugfix work.

## Supporting Branches

### 1. feature/\*

**Purpose**

- New feature development.

**Rules**

- Must be created from develop.
- Must merge back into develop.

**Naming convention**

- `feature/<feature-name>`

**Examples**

- `feature/store-locator`
- `feature/dark-mode`
- `feature/product-reviews`
- `feature/admin-dashboard`

### 2. bugfix/\*

**Purpose**

- Non-production bug fixes.
- Fixes targeting develop branch.

**Rules**

- Must be created from develop.
- Must merge back into develop.

**Naming convention**

- `bugfix/<issue-name>`

**Examples**

- `bugfix/navbar-alignment`
- `bugfix/mobile-layout`
- `bugfix/filter-state`

### 3. release/\*

**Purpose**

- Release preparation.
- Stabilization and testing before production release.

**Used for**

- Final bug fixes.
- Testing.
- Version updates.
- Performance polishing.
- Deployment preparation.

**Rules**

- Must be created from develop.
- Must merge into both:
  - master
  - develop

**Naming convention**

- `release/v<version>`

**Examples**

- `release/v1.0.0`
- `release/v1.1.0`

### 4. hotfix/\*

**Purpose**

- Urgent production fixes.

**Rules**

- Must be created from master.
- Must merge into both:
  - master
  - develop

**Naming convention**

- `hotfix/<issue-name>`

**Examples**

- `hotfix/login-crash`
- `hotfix/payment-failure`

## Development Workflow

- All development happens through branches.
- Never work directly on master.
- Prefer pull-request-style workflow even in solo development.
- Keep commit history clean and readable.
- Use small, logical commits.
- Recommend Git commands before major branch operations.
- Recommend a commit message after every implemented feature.

## Feature Development Flow

1. Switch to develop:
   `git checkout develop`
2. Pull latest changes:
   `git pull origin develop`
3. Create feature branch:
   `git checkout -b feature/<feature-name>`
4. Work and commit changes.
5. Push feature branch:
   `git push origin feature/<feature-name>`
6. Merge back into develop after completion.

## Release Flow

1. Create release branch from develop:
   `git checkout -b release/v<version>`
2. Perform testing, polishing, and final fixes.
3. Merge release branch into master and develop.
4. Tag release version.

## Hotfix Flow

1. Create hotfix branch from master:
   `git checkout -b hotfix/<issue-name>`
2. Apply urgent fix.
3. Merge into master and develop.

## Commit Message Convention

Use Conventional Commits format:

- `feat:` new feature
- `fix:` bug fix
- `refactor:` code improvement
- `style:` UI/styling updates
- `docs:` documentation changes
- `test:` testing updates
- `chore:` tooling/config/setup updates

## Commit Message Examples

- `feat: implement store locator page`
- `feat: add dark mode support`
- `feat: create vendor product CRUD APIs`
- `fix: resolve cart hydration mismatch`
- `fix: correct mobile navbar alignment`
- `refactor: optimize category filtering logic`
- `style: improve homepage responsiveness`
- `docs: update project setup instructions`
- `chore: configure mongodb environment variables`

## AI Development Rules

- Always recommend an appropriate branch name before starting feature work.
- Always suggest a commit message after implementation.
- Never suggest direct development on master.
- Maintain clean Git workflow discipline.
- Keep commits feature-focused.
- Avoid giant commits containing unrelated changes.
- Suggest release branch creation when multiple features are completed.
- Suggest hotfix workflow only for production-critical issues.
- Maintain enterprise-level Git standards throughout the project.

## Pre-Task Commit Requirement

Before moving to any new requirement or feature, commit and push the current working code to the repository.

**Requirements**

- Ensure the current implementation is fully tested and stable before committing.
- Use meaningful commit messages describing the completed work.
- Push all latest changes to the appropriate branch before starting the next task.
- Avoid keeping uncommitted or local-only changes while switching requirements.
- Confirm there are no build errors, lint issues, or broken functionality before push.
- Keep the repository updated incrementally for easier tracking and rollback if needed.

## Status

These Git rules are mandatory defaults for all future tasks in this project.
