# Change: Eliminate Unnecessary `any` Types

## Why

The codebase has 138 instances of `: any` across 36 files (excluding tests and node_modules). While some `any` usages are justified, many can be replaced with proper types. The API-Football responses are **fully documented** in [docs/API-FOOTBALL-Complete-Documentation.md](../../docs/API-FOOTBALL-Complete-Documentation.md), so there's no excuse for using `any` on those structures.

Proper typing will improve:

1. **Type safety** - Catch errors at compile time
2. **IDE experience** - Better autocomplete and refactoring
3. **Documentation** - Types serve as inline documentation
4. **Maintainability** - Easier to understand data shapes

## What Changes

### Category 1: Index Signatures in Type Definitions (30 instances - REVIEW)
**Files:** `types/index.ts` (lines 66, 91, 109, 126, etc.)

These are escape hatches for external API data:
```typescript
[key: string]: any  // Allow additional unknown API fields
```

**Decision:**
- **Svenska Spel API:** Keep index signatures - no documentation available
- **API-Football:** Consider removing index signatures and typing fully based on [docs/API-FOOTBALL-Complete-Documentation.md](../../docs/API-FOOTBALL-Complete-Documentation.md) - the API is well-documented with explicit response structures

### Category 2: Scraped Data Type Filtering (20+ instances - FIX WITH GENERICS)
**Files:** `prediction-service.ts`, `embeddings-service.ts`

Pattern: `match.match_scraped_data?.find((d: any) => d.data_type === 'xStats')`

**Problem:** After `.find()`, TypeScript doesn't know the data shape.
**Solution:** Create typed scraped data accessors or discriminated union types.

### Category 3: Playwright Page Objects (8 instances - USE `Page` TYPE)
**Files:** `scraper-service.ts`, `scraper-service-v2.ts`, `scraper-service-v3.ts`

Pattern: `page: any`

**Solution:** Import and use `Page` from Playwright.

### Category 4: Prisma Query Results (6 instances - USE PRISMA TYPES)
**Files:** `draw-sync.ts`, `ai-metrics-service.ts`, `failed-games-service.ts`

Pattern: `private mapToX(record: any): X`

**Solution:** Use Prisma-generated types or infer from query.

### Category 5: API Response Mapping (8 instances - CREATE INTERFACES)
**Files:** `svenska-spel-api.ts`, `svenska-spel-historic-api.ts`

Pattern: `result: any`, `draw?: any`, `jackpot?: any`

**Solution:** Extend existing `DrawData` and `JackpotData` types.

### Category 6: Accumulator Objects (6 instances - TYPE EXPLICITLY)
**Files:** `scraper-analytics.ts`, `performance-tracker.ts`

Pattern: `const rates: any = {}`

**Solution:** Define explicit record types.

### Category 7: Function Parameters (10 instances - MIXED)
**Files:** Various

Pattern: `private extractPrediction(item: any)`, `calculateExpectedValues(prediction: any, odds: any)`

**Solution:** Create proper interfaces for each parameter type.

### Category 8: Test Files (30+ instances - LOW PRIORITY)
**Files:** `tests/**/*.test.ts`

Test mocks and fixtures often use `any` for simplicity.

**Decision:** Keep for now; test type safety is lower priority.

## Summary Table

| Category | Count | Priority | Action |
|----------|-------|----------|--------|
| Index signatures (API extensibility) | 30 | N/A | Keep |
| Scraped data filtering | 20+ | High | Generic helper |
| Playwright Page | 8 | Medium | Use `Page` |
| Prisma results | 6 | Medium | Use Prisma types |
| API responses | 8 | Medium | Extend interfaces |
| Accumulator objects | 6 | Low | Type explicitly |
| Function parameters | 10 | High | Create interfaces |
| Test files | 30+ | Low | Keep (optional) |

## Impact

- Affected code: ~25 files in `/server/services/`, `types/index.ts`
- No runtime changes - purely compile-time improvements
- No breaking changes to APIs
- ESLint rule `@typescript-eslint/no-explicit-any` can be enabled after cleanup

## Out of Scope

- `node_modules/` - third-party code
- `.nuxt/` - auto-generated code
- Test files - lower priority, optional follow-up
