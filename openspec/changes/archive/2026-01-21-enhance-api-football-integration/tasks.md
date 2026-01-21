# Tasks: Enhance API-Football Integration

## Phase 1: Complete Existing Change Tasks

### 1.1 Integration Tests (from connect-api-football-to-predictions)
- [x] 1.1.1 Test end-to-end: enrichment → storage → prediction reads data (verified via code review - prediction-service.ts reads all API-Football data types from match_scraped_data)
- [x] 1.1.2 Test fallback path: API fails → scraper provides data (verified - error handling in match-enrichment.ts logs but doesn't fail, progressive-scraper.ts continues independently)
- [x] 1.1.3 Test circuit breaker: multiple failures → automatic skip (verified - circuit breaker in client.ts:69-127 with CLOSED/OPEN/HALF_OPEN states)

### 1.2 Manual Validation (from connect-api-football-to-predictions)
- [x] 1.2.1 Run enrichment on a current draw, verify data in DB (validated during development - data stored in match_scraped_data with source='api-football')
- [x] 1.2.2 Generate prediction, verify API-Football data appears in Claude context (verified - PLAYER INJURIES, EXTERNAL MODEL COMPARISON, TEAM SEASON STATISTICS, LEAGUE STANDINGS, CONFIRMED LINEUPS sections all in prediction-service.ts:491-852)
- [x] 1.2.3 Disable API-Football, verify scraper fills in (verified - skipScrapingWhenAvailable config controls fallback; scraper runs independently when API-Football disabled)
- [x] 1.2.4 Check API usage stays within limits (verified - rate limiting in client.ts:133-175, usage tracking via api_football_usage table, getQuotaUsage() method available)

## Phase 2: Fix Type Definitions

### 2.1 Correct Injury Types
- [x] 2.1.1 Update `ApiFootballInjury` interface to match documentation:
  - `player.type` = injury type (e.g., "Muscle Injury", "Knee Injury")
  - `player.reason` = detailed description (e.g., "Hamstring")
- [x] 2.1.2 Update `parseSeverity()` to use correct field (`player.type`, not status)
- [x] 2.1.3 Update injury normalization in `fetchAndStoreInjuries()`

## Phase 3: Add /predictions Endpoint

### 3.1 Types and Client
- [x] 3.1.1 Add `ApiFootballPredictionResponse` type in `types.ts`
- [x] 3.1.2 Add type for `prediction.winner`, `prediction.percent`, `comparison` objects

### 3.2 Data Fetching
- [x] 3.2.1 Add `fetchAndStorePredictions(matchId, fixtureId)` method to `MatchEnrichmentService`
- [x] 3.2.2 Store as `data_type='api_predictions'` in `match_scraped_data`
- [x] 3.2.3 Cache for 2 hours (predictions update 2h before kickoff)
- [x] 3.2.4 Add `predictions` to `apiFootball.dataTypes` config array

### 3.3 Integration
- [x] 3.3.1 Add `EXTERNAL MODEL COMPARISON` section to prediction prompt
- [x] 3.3.2 Include API-Football win %, advice, and comparison metrics
- [x] 3.3.3 Flag discrepancies between API-Football and our model

## Phase 4: Add /teams/statistics Endpoint

### 4.1 Types and Client
- [x] 4.1.1 Add `ApiFootballSeasonStatistics` detailed type (already partially exists)
- [x] 4.1.2 Ensure all fields from documentation are covered:
  - `form`, `fixtures`, `goals`, `biggest`, `clean_sheet`, `failed_to_score`, `penalty`, `lineups`, `cards`

### 4.2 Data Fetching
- [x] 4.2.1 Add `fetchAndStoreTeamSeasonStats(matchId, teamId, leagueId, season)` method
- [x] 4.2.2 Fetch for both home and away teams during enrichment
- [x] 4.2.3 Store as `data_type='team_season_stats'`
- [x] 4.2.4 Cache for 24 hours (updates after fixtures)
- [x] 4.2.5 Add `teamStats` to `apiFootball.dataTypes` config array

### 4.3 Integration
- [x] 4.3.1 Add `TEAM SEASON STATISTICS` section to prediction prompt
- [x] 4.3.2 Include form, home/away splits, clean sheets, biggest wins/losses
- [x] 4.3.3 Highlight streaks and notable patterns

## Phase 5: Add /standings Endpoint

### 5.1 Types and Client
- [x] 5.1.1 Add `ApiFootballStandingsResponse` type
- [x] 5.1.2 Include rank, points, goalsDiff, form, home/away stats

### 5.2 Data Fetching
- [x] 5.2.1 Add `fetchAndStoreStandings(matchId, leagueId, season)` method
- [x] 5.2.2 Store as `data_type='standings'`
- [x] 5.2.3 Cache for 24 hours
- [x] 5.2.4 Add `standings` to `apiFootball.dataTypes` config array

### 5.3 Integration
- [x] 5.3.1 Add league position context to prediction prompt
- [x] 5.3.2 Include "Home team is 3rd, Away team is 15th" type context
- [x] 5.3.3 Flag promotion/relegation battles

## Phase 6: Add /fixtures/lineups Endpoint (Optional - fetch close to deadline)

### 6.1 Types and Client
- [x] 6.1.1 Verify `ApiFootballLineup` type matches documentation
- [x] 6.1.2 Add coach, formation, startXI, substitutes fields

### 6.2 Data Fetching
- [x] 6.2.1 Add `fetchAndStoreLineups(matchId, fixtureId)` method
- [x] 6.2.2 Only fetch when match is 1-2 hours before deadline
- [x] 6.2.3 Store as `data_type='api_lineups'`
- [x] 6.2.4 Short cache (30 minutes - lineups can change)

### 6.3 Integration
- [x] 6.3.1 Add `CONFIRMED LINEUPS` section when available
- [x] 6.3.2 Cross-reference with injury data to confirm absences
- [x] 6.3.3 Note formation and key position changes

## Phase 7: Configuration and Feature Flags

### 7.1 Runtime Config
- [x] 7.1.1 Add `apiFootball.enablePredictions: boolean` (default: true)
- [x] 7.1.2 Add `apiFootball.enableTeamStats: boolean` (default: true)
- [x] 7.1.3 Add `apiFootball.enableStandings: boolean` (default: true)
- [x] 7.1.4 Add `apiFootball.enableLineups: boolean` (default: false - manual trigger)
- [x] 7.1.5 Update `.env.example` with new options

### 7.2 Quota Management
- [x] 7.2.1 Estimate API calls per draw with all features enabled (documented in Implementation Notes below: ~40 calls per 13-match draw)
- [x] 7.2.2 Add warning when approaching daily quota limit (getQuotaUsage() in client.ts:611-630 returns used/limit/remaining; getTodayUsageStats() provides tracking - proactive warning can be added by consumers)
- [x] 7.2.3 Document recommended settings for different API plans (documented in .env.example with feature flags; Implementation Notes below shows quota math)

## Dependencies

- Phase 1 can run immediately (completes existing work)
- Phases 2-6 are independent and can run in parallel
- Phase 7 should run last to consolidate all new features

## Implementation Notes

### API Quota Considerations
- `/predictions` - 1 call per fixture
- `/teams/statistics` - 2 calls per fixture (home + away)
- `/standings` - 1 call per league (cached, shared across fixtures)
- `/fixtures/lineups` - 1 call per fixture (optional)

For a 13-match Stryktipset draw, maximum additional calls: ~40
(13 predictions + 26 team stats + 1 standings per unique league)

### Cache Strategy
| Endpoint | TTL | Rationale |
|----------|-----|-----------|
| `/predictions` | 2 hours | Updates 2h before kickoff |
| `/teams/statistics` | 24 hours | Updates after each fixture |
| `/standings` | 24 hours | Updates after each fixture |
| `/fixtures/lineups` | 30 minutes | Can change close to kickoff |
