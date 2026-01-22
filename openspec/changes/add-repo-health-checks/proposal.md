# Change: Add Comprehensive Repo Health Checks

## Why
Document all available repository quality checks, categorize them, and establish a unified way to run all checks for CI/CD and local development. Currently checks exist but are spread across different scripts without a single entry point.

## What Changes
- Document all existing checks and their current status
- Add a unified `check:all` script for running all validations
- Ensure all checks run on pre-commit via lint-staged
- Establish baseline for code quality metrics

## Current Check Status (All Passing)

### Category 1: Linting & Formatting
| Check | Command | Status | Tool |
|-------|---------|--------|------|
| ESLint | `yarn lint` | **PASS** | eslint@9.39.2 |
| ESLint (auto-fix) | `yarn lint:fix` | Available | eslint |
| Prettier (check) | `yarn format:check` | **PASS** | prettier@3.8.0 |
| Prettier (write) | `yarn format` | Available | prettier |

### Category 2: Type Checking
| Check | Command | Status | Tool |
|-------|---------|--------|------|
| TypeScript | `yarn typecheck` | **PASS** | typescript@5.8.2 via nuxt |

### Category 3: Database
| Check | Command | Status | Tool |
|-------|---------|--------|------|
| Prisma Schema | `npx prisma validate` | **PASS** | prisma@7.3.0 |
| Prisma Generate | `yarn db:generate` | Available | prisma |

### Category 4: Build
| Check | Command | Status | Tool |
|-------|---------|--------|------|
| Nuxt Build | `yarn build` | **PASS** | nuxt@4.2.2 |

### Category 5: Testing
| Check | Command | Status | Tests |
|-------|---------|--------|-------|
| Unit Tests | `yarn test:unit --run` | **PASS** | 532 tests |
| Component Tests | `yarn test:components --run` | **PASS** | 297 tests |
| API Tests | `yarn test:api --run` | **PASS** | 57 tests |
| All Tests | `yarn test:all` | Available | 886+ tests |
| E2E Tests | `yarn test:e2e` | Available | Playwright |
| Accessibility | `yarn test:a11y` | Available | axe-core |

### Category 6: Git Hooks (Pre-commit)
| Check | Trigger | Status | Tool |
|-------|---------|--------|------|
| Lint-staged | On commit | **ACTIVE** | husky@9.1.7 |
| ESLint on staged `.ts,.vue,.js,.mjs` | On commit | **ACTIVE** | lint-staged |
| Prettier on staged `.ts,.vue,.js,.mjs,.json,.yml,.yaml` | On commit | **ACTIVE** | lint-staged |
| TypeCheck on staged `.ts,.vue` | On commit | **ACTIVE** | lint-staged |
| Prisma validate on `schema.prisma` | On commit | **ACTIVE** | lint-staged |

## Summary
- **Total Checks Available**: 15+
- **Currently Passing**: All core checks (lint, types, format, build, tests)
- **Tests**: 886+ tests across unit, component, and API
- **Pre-commit Hooks**: Active and protecting main branch

## Impact
- Affected specs: None (documentation/tooling only)
- Affected code: `package.json` (new scripts), `.lintstagedrc.cjs` (prisma validation)
