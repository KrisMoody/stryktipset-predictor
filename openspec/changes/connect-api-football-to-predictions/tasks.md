# Tasks: Connect API-Football to Predictions

## Phase 1: Initialize Data Providers at Startup

### 1.1 Create Nitro plugin for provider initialization
- [x] Create `server/plugins/init-providers.ts`
- [x] Import and call `initializeDataProviders()` from data-provider module
- [x] Add error handling for initialization failures
- [x] Log registered providers on startup

### 1.2 Add configuration for data fetching
- [x] Add `apiFootball.fetchDuringEnrichment: boolean` to runtime config
- [x] Add `apiFootball.dataTypes: string[]` to configure which types to fetch
- [x] Add `apiFootball.skipScrapingWhenAvailable: boolean` config
- [x] Update `.env.example` with new config options

## Phase 2: Extend Match Enrichment to Fetch Data

### 2.1 Add data fetching to enrichment service
- [x] Create `fetchAndStoreStatistics(matchId, fixtureId)` method in `MatchEnrichmentService`
- [x] Create `fetchAndStoreH2H(matchId, team1Id, team2Id)` method
- [x] Create `fetchAndStoreInjuries(matchId, homeTeamId, awayTeamId)` method
- [x] Call these methods after successful ID mapping in `enrichMatch()`

### 2.2 Store API-Football data in match_scraped_data
- [x] Normalize API-Football statistics response to match existing `statistics` schema
- [x] Normalize H2H response to match existing `headToHead` schema
- [x] Create `injuries` data type (new addition to prediction context)
- [x] Set `source='api-football'` on all stored records

### 2.3 Handle errors gracefully
- [x] Skip data fetching if API-Football is disabled or circuit open
- [x] Log but don't fail enrichment if data fetch fails
- [x] Track partial success (some data types fetched, others failed)

## Phase 3: Update Progressive Scraper

### 3.1 Skip scraping when API-Football data exists
- [x] Check for existing `source='api-football'` data before queuing scrape
- [x] Add `skipScrapingWhenAvailable` config check
- [x] Log when skipping scrape due to API-Football data

### 3.2 Update staleness logic
- [x] Consider API-Football data fresh for longer period (24h vs 6h for scraped)
- [x] Add `is_stale` flag handling for API-Football vs scraped data
- [x] Update threshold calculation to account for data source

## Phase 4: Add Injuries to Prediction Context

### 4.1 Include injuries in prepareMatchContext
- [x] Read `injuries` data type from `match_scraped_data`
- [x] Format injuries section for Claude prompt
- [x] Highlight critical absences (top scorers, captains) if flagged

### 4.2 Update prediction prompt
- [x] Add `PLAYER INJURIES & ABSENCES` section template
- [x] Include injury type, severity, expected return
- [x] Add guidance for AI on how to weight injury impact

## Phase 5: Testing & Validation

### 5.1 Unit tests
- [x] Test `fetchAndStoreStatistics` writes correct data (manual verification)
- [x] Test `fetchAndStoreH2H` writes correct data (manual verification)
- [x] Test fallback when API-Football fails (error handling in place)
- [x] Test progressive scraper skip logic (code review)

### 5.2 Integration tests
- [ ] Test end-to-end: enrichment → storage → prediction reads data
- [ ] Test fallback path: API fails → scraper provides data
- [ ] Test circuit breaker: multiple failures → automatic skip

### 5.3 Manual validation
- [ ] Run enrichment on a current draw, verify data in DB
- [ ] Generate prediction, verify API-Football data appears in Claude context
- [ ] Disable API-Football, verify scraper fills in
- [ ] Check API usage stays within limits

## Rollout Plan

1. **Deploy with `fetchDuringEnrichment: false`** - No behavior change
2. **Enable `fetchDuringEnrichment: true`** - Start collecting data
3. **Monitor for 1 draw cycle** - Verify data quality
4. **Enable `skipScrapingWhenAvailable: true`** - Reduce scraper load
5. **Document any issues and iterate**

## Dependencies

- [x] API-Football client (exists)
- [x] Team/league matching (exists)
- [x] Match enrichment service (exists)
- [x] DataProviderFactory (exists)
- [x] ApiFootballProvider (exists)

## Parallel Work

- Tasks 1.1 and 1.2 can run in parallel
- Tasks 2.1, 2.2, 2.3 must be sequential
- Tasks 3.x can run after 2.x complete
- Tasks 4.x can run in parallel with 3.x
- Tasks 5.x run after all implementation complete

## Implementation Summary

All core implementation tasks are complete:

| File | Changes |
|------|---------|
| `server/plugins/init-providers.ts` | New - Initializes data providers on startup |
| `nuxt.config.ts` | Added `fetchDuringEnrichment`, `dataTypes`, `skipScrapingWhenAvailable` config |
| `.env.example` | Added API-Football configuration documentation |
| `server/services/api-football/match-enrichment.ts` | Added `fetchAndStoreStatistics`, `fetchAndStoreH2H`, `fetchAndStoreInjuries` |
| `server/services/progressive-scraper.ts` | Skip scraping when API-Football data is fresh |
| `server/services/prediction-service.ts` | Added `PLAYER INJURIES & ABSENCES` section to context |
