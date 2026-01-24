# Tasks: Eliminate Unnecessary `any` Types

## Phase 1: High-Impact Infrastructure (Enables other fixes)

### 1.1 API-Football Types (Reference: docs/API-FOOTBALL-Complete-Documentation.md)
- [ ] 1.1.1 Create `types/api-football.ts` with response interfaces from documentation
- [ ] 1.1.2 Add types for: Fixtures, Predictions, Lineups, Injuries, Standings, Team Statistics
- [ ] 1.1.3 Type the `api_predictions` scraped data entries
- [ ] 1.1.4 Type the `api_lineups` scraped data entries
- [ ] 1.1.5 Type the `standings` scraped data entries
- [ ] 1.1.6 Type the `team_season_stats` scraped data entries

### 1.2 Scraped Data Type System
- [ ] 1.2.1 Create discriminated union type for `match_scraped_data` entries
- [ ] 1.2.2 Create typed accessor functions (e.g., `getScrapedData(match, 'xStats')`)
- [ ] 1.2.3 Update `prediction-service.ts` to use typed accessors (~15 instances)
- [ ] 1.2.4 Update `embeddings-service.ts` to use typed accessors (~8 instances)

### 1.3 Match Context Types
- [ ] 1.3.1 Create `MatchWithRelations` interface for match + scraped data
- [ ] 1.3.2 Update `prepareMatchContext` parameter type
- [ ] 1.3.3 Update `createMatchText` parameter type

## Phase 2: Service Layer Types

### 2.1 Playwright Types
- [ ] 2.1.1 Add `Page` import from `playwright` to scraper files
- [ ] 2.1.2 Replace `page: any` with `page: Page` in `scraper-service.ts`
- [ ] 2.1.3 Replace `page: any` with `page: Page` in `scraper-service-v2.ts`
- [ ] 2.1.4 Replace `page: any` with `page: Page` in `scraper-service-v3.ts`

### 2.2 Prisma Result Types
- [ ] 2.2.1 Update `mapToFailedGame` in `failed-games-service.ts`
- [ ] 2.2.2 Update `mapToPersistedCoupon` in `coupon-persistence.ts`
- [ ] 2.2.3 Update `buildDateWhereClause` return type in `ai-metrics-service.ts`

### 2.3 Draw Sync Types
- [ ] 2.3.1 Type `upsertTeam(participant)` with `ParticipantData`
- [ ] 2.3.2 Type `ensureCountry(countryData)` with `CountryData`
- [ ] 2.3.3 Type `ensureLeague(leagueData)` with `LeagueData`
- [ ] 2.3.4 Type `storeExpertTips(matchId, tips)` with `ExpertTipsData`
- [ ] 2.3.5 Type `storeBetMetrics(matchId, metrics)` with `BetMetricsData`
- [ ] 2.3.6 Type `storeSvenskaFolketData(matchId, data)` with `SvenskaFolketData`

## Phase 3: API and Accumulator Types

### 3.1 Svenska Spel API Types
- [ ] 3.1.1 Type `jackpot` return value with `JackpotData`
- [ ] 3.1.2 Type historic API `draw` return value
- [ ] 3.1.3 Replace `error: any` with proper error type or `unknown`

### 3.2 Accumulator Objects
- [ ] 3.2.1 Type `rates` object in `scraper-analytics.ts` (3 instances)
- [ ] 3.2.2 Type `results` object in `performance-tracker.ts` (2 instances)
- [ ] 3.2.3 Type `data` local variable in scraper tabs

## Phase 4: Function Parameter Types

### 4.1 Scraper Tab Types
- [ ] 4.1.1 Type `extractPrediction(item)` in `analysis-scraper.ts`
- [ ] 4.1.2 Type `extractRecommendation(element)` in `news-scraper.ts`
- [ ] 4.1.3 Type `extractOutcomes(section)` in `oddset-scraper.ts`
- [ ] 4.1.4 Type `calculateSummary(matches)` in `head-to-head-scraper.ts`

### 4.2 Optimizer Types
- [ ] 4.2.1 Type `calculateExpectedValues(prediction, odds)` in `coupon-optimizer.ts`
- [ ] 4.2.2 Type `createPerformanceRecord(prediction)` in `performance-tracker.ts`

## Phase 5: Validation and Cleanup

### 5.1 Verification
- [ ] 5.1.1 Run `npx tsc --noEmit` to verify no type errors
- [ ] 5.1.2 Run `grep -rn ": any" --include="*.ts" --exclude-dir=node_modules --exclude-dir=tests | wc -l` to count remaining
- [ ] 5.1.3 Document any remaining `any` usages with justification

### 5.2 Optional: Enable Stricter Rules
- [ ] 5.2.1 Add `@typescript-eslint/no-explicit-any: warn` to ESLint config
- [ ] 5.2.2 Address any new warnings surfaced
- [ ] 5.2.3 Upgrade to `error` after stabilization

## Dependencies

```
Phase 1 (Foundation) → Phase 2, 3, 4 (can run in parallel) → Phase 5 (Verification)
```

## Notes

- Phase 1 is critical as it enables many downstream fixes
- **Reference docs/API-FOOTBALL-Complete-Documentation.md for all API-Football types**
- Test files are excluded from scope
- Svenska Spel index signatures (`[key: string]: any`) are kept (undocumented API)
- API-Football index signatures should be removed (fully documented API)
- Each task should be a separate small commit for easy review/revert
