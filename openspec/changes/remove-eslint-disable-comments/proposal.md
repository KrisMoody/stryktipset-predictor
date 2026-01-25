# Change: Remove eslint-disable comments by adding proper types

## Why
The codebase contains 22 `eslint-disable` comments that suppress TypeScript's `no-explicit-any` rule. While some are legitimate (browser API manipulation, external API responses), many can be eliminated by adding proper type definitions. This improves type safety, IDE autocompletion, and catches bugs at compile time.

## What Changes
- Add typed interfaces for admin API responses in `pages/admin.vue`
- Add typed interfaces for test mock data structures
- Fix type narrowing in `components/match/HeadToHead.vue`
- Fix vitest.config.ts plugin type assertion
- Remove `[key: string]: any` index signatures where possible in `types/index.ts`

## Scope Exclusions (Comments That Should Stay)
- **Scraper utils** (`fingerprint.ts`, `accessibility-helper.ts`, `base-scraper.ts`): Browser API manipulation legitimately requires dynamic types
- **Svenska Spel APIs** (`svenska-spel-api.ts`, `svenska-spel-historic-api.ts`): External API with undocumented response structures
- **Prediction service**: Complex Prisma includes - consider in future iteration with Prisma utility types

## Impact
- Affected code:
  - `pages/admin.vue` (4 disables → 0)
  - `components/match/HeadToHead.vue` (1 disable → 0)
  - `vitest.config.ts` (1 disable → 0)
  - `types/index.ts` (1 file-level disable → targeted disables or removal)
  - `tests/**/*.test.ts` (10 files with mock typing improvements)
- No behavioral changes - purely type safety improvements
- No new dependencies

## Success Criteria
- Reduce eslint-disable comments from 22 to ≤10
- All remaining disables have documented justification
- `npm run lint` passes
- `npm run typecheck` passes
