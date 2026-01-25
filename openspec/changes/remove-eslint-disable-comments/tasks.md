# Tasks: Remove eslint-disable comments

## 1. Admin API Response Types
- [x] 1.1 Create `types/admin-api.ts` with interfaces for admin API responses
  - `ScraperHealthResponse`
  - `SvenskaSpelHealthResponse`
  - `FailedWritesResponse`
  - `SyncResponse`
  - `BackfillResponse`
  - `CacheStatsResponse`
  - `CurrentDrawsResponse`
  - `PendingFinalizationResponse`
  - `FailedGamesResponse`
  - `DrawLookupResponse`
  - `FetchResultsResponse`
- [x] 1.2 Update `pages/admin.vue` to use typed refs instead of `any`
- [x] 1.3 Add parameter types for admin modal functions (`openArchiveModal`, `openFetchResultsModal`)
- [~] 1.4 Remove eslint-disable comments from `pages/admin.vue`
  - Note: Converted from 4 file-level to 9 targeted inline disables with justification
  - Admin API responses have varying shapes depending on success/error states
- [x] 1.5 Verify `npm run typecheck` passes for admin page

## 2. HeadToHead Component Type Narrowing
- [x] 2.1 Create type guard function for API-Football vs web-scraped H2H data
- [x] 2.2 Replace `as any` cast with proper type narrowing using discriminated union
- [x] 2.3 Remove eslint-disable comment from `components/match/HeadToHead.vue`
- [x] 2.4 Verify component renders correctly with both data formats

## 3. Vitest Config Fix
- [x] 3.1 Fix plugin type in `vitest.config.ts` using proper type assertion
- [x] 3.2 Remove eslint-disable comment
- [x] 3.3 Verify `npm run test` still works

## 4. Types Index Cleanup
- [x] 4.1 Audit each `[key: string]: any` in `types/index.ts`
- [x] 4.2 For interfaces with known fields only, remove index signature
- [x] 4.3 For interfaces needing extensibility, change to `[key: string]: unknown` where safe
- [x] 4.4 Add targeted section-level disables with justification for remaining cases
- [x] 4.5 Remove file-level eslint-disable, replace with scoped disables
  - Section 1: Svenska Spel API responses (undocumented fields)
  - Section 2: Web-scraped data (variable structure)
  - Section 3: Multifetch API (undocumented session/client fields)

## 5. Test File Improvements
- [x] 5.1 Create shared test type utilities in `tests/utils/test-types.ts`
  - Mock Prisma client types (`MockPrismaClient`)
  - Mock API response factory types (`MockDrawData`, `MockMatchRecord`)
  - Common test data interfaces
  - Factory functions (`createMockDraw`, `createMockMatchEvent`, `createMockMatchRecord`)
- [x] 5.2 Update `tests/unit/services/statistical-calculations.test.ts` with proper mock types
  - Removed file-level eslint-disable
  - Added proper `ModelConfig` type import
- [ ] 5.3 Update `tests/unit/services/prediction-service.test.ts` with proper mock types
- [ ] 5.4 Update `tests/unit/services/draw-lifecycle.test.ts` with proper mock types
- [ ] 5.5 Update `tests/unit/services/match-enrichment.test.ts` with proper mock types
- [ ] 5.6 Update `tests/unit/services/cost-cap-service.test.ts` with proper mock types
- [ ] 5.7 Update `tests/unit/services/draw-sync.test.ts` with proper mock types
- [ ] 5.8 Update `tests/unit/services/coupon-optimizer.test.ts` with proper mock types
- [ ] 5.9 Update `tests/unit/services/market-odds.test.ts` with proper mock types
- [ ] 5.10 Update `tests/unit/services/ai-metrics-service.test.ts` with proper mock types
- [ ] 5.11 Update `tests/components/optimize/CouponDisplay.test.ts` with proper mock types
- [ ] 5.12 Remove file-level eslint-disable comments from all updated test files

## 6. Validation
- [x] 6.1 Run `npm run lint` - must pass
- [x] 6.2 Run `npm run typecheck` - must pass
- [x] 6.3 Run `npm run test` - all tests must pass (981 tests)
- [x] 6.4 Verify remaining eslint-disable comments have documented justification
- [x] 6.5 Document remaining disables in code comments explaining why they're necessary

## Summary of Changes

### Files Modified
- `types/admin-api.ts` - Created with comprehensive admin API types
- `pages/admin.vue` - Updated refs to use typed interfaces
- `components/match/HeadToHead.vue` - Added type guards, removed eslint-disable
- `vitest.config.ts` - Fixed plugin type, removed eslint-disable
- `types/index.ts` - Restructured with section-level disables with justification
- `tests/utils/test-types.ts` - Created with shared test utilities
- `tests/unit/services/statistical-calculations.test.ts` - Removed eslint-disable, added proper types

### Remaining eslint-disable Comments (With Justification)
1. **Server services** (kept - external API/DOM interaction):
   - `server/services/svenska-spel-api.ts` - Complex undocumented API responses
   - `server/services/svenska-spel-historic-api.ts` - Complex undocumented API responses
   - `server/services/prediction-service.ts` - Complex Prisma and AI API data
   - `server/services/scraper/tabs/base-scraper.ts` - Playwright page types and dynamic DOM
   - `server/services/scraper/utils/fingerprint.ts` - Browser fingerprint injection
   - `server/services/scraper/utils/accessibility-helper.ts` - Playwright accessibility tree

2. **Types** (kept with section-level comments):
   - `types/index.ts` - 3 section-level disables for external API data

3. **Admin page** (kept with inline comments):
   - `pages/admin.vue` - 9 targeted inline disables for varying API response shapes

4. **Test files** (future work):
   - 9 test files still have file-level eslint-disable
