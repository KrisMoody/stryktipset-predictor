## 1. Core Implementation - Draw Sync Trigger

- [x] 1.1 Add `fetchDataAfterEnrichment()` method to `MatchEnrichmentService`
  - Checks if match already has fresh data (within cache TTL)
  - Checks if match is not finished (status !== 'FT')
  - Checks daily quota usage (skip if > 95%)
  - Calls `fetchAllDataForMatch()` with rate limiting

- [x] 1.2 Modify `enrichMatch()` to trigger data fetch on success
  - After successful mapping, call `fetchDataAfterEnrichment(matchId)`
  - Run asynchronously (non-blocking) like current enrichment

- [x] 1.3 Add staggered request delays in `fetchAllDataForMatch()`
  - Add 500ms delay between each data type fetch
  - Reorder fetches by priority: H2H → Team Stats → Standings → Statistics → Injuries → Predictions → Lineups
  - Added `fetchAllDataForMatchSequential()` method for rate-limited fetching

- [x] 1.4 Add quota check before auto-fetch
  - Query `api_football_usage` for current day's usage via `getDailyQuotaStatus()`
  - Skip fetch and log warning if usage > 95% of limit
  - Add `ENABLE_AUTO_FETCH` environment variable flag

## 2. Core Implementation - Prediction Trigger

- [x] 2.1 Add `ensureMatchData()` method to `MatchEnrichmentService`
  - Checks if match has required data types (statistics, headToHead)
  - Returns list of missing or stale data types
  - Does NOT fetch - just checks what's needed

- [x] 2.2 Modify `predictMatch()` in `PredictionService` to ensure data
  - Before generating prediction, call `fetchMatchDataIfNeeded(matchId)`
  - If data is missing/stale, call `fetchAllDataForMatch(matchId)` and await result
  - Proceed with prediction even if fetch fails (graceful degradation)
  - Log warning if proceeding without complete data

- [x] 2.3 Add `fetchMatchDataIfNeeded()` helper
  - Combines check + fetch into single callable function
  - Returns object indicating if data was needed, fetched, and success status
  - Used by both draw sync and prediction flows

## 3. Caching Improvements

- [x] 3.1 Add `hasFreshData()` helper method
  - Checks `match_scraped_data` for each data type
  - Returns true if data exists and is within cache TTL
  - Cache TTLs: H2H=30d, Stats=24h, Standings=24h, Injuries=1h, Lineups=30m
  - Added `CACHE_TTL_BY_TYPE` constant for cache TTL lookup

- [x] 3.2 Ensure all fetches use upsert pattern
  - Already using Prisma's upsert with unique constraint `(match_id, data_type)`
  - Update `scraped_at` timestamp on each fetch
  - Set `is_stale=false` on successful fetch

## 4. UI Enhancements

- [x] 4.1 Add data source indicator to Statistics component
  - Show "via API-Football" or "via web scraping" badge with icon
  - Use subtle styling (small text, muted gray color)

- [x] 4.2 Add data source indicator to HeadToHead component
  - Same styling as Statistics component

- [x] 4.3 Add "last updated" timestamp to data displays
  - Show relative time (e.g., "2h ago", "1d ago")
  - Help users understand data freshness

## 5. Testing & Validation

- [x] 5.1 Add unit tests for `fetchDataAfterEnrichment()`
  - Test quota check logic
  - Test skip for finished matches
  - Test skip for fresh data
  - Added tests in `tests/unit/services/match-enrichment.test.ts`

- [x] 5.2 Add unit tests for `ensureMatchData()` in prediction flow
  - Test missing data triggers fetch
  - Test stale data triggers refresh
  - Test graceful degradation when fetch fails
  - Added tests in `tests/unit/services/match-enrichment.test.ts`

- [x] 5.3 Add integration test for automatic fetch flow
  - Sync a draw → verify enrichment → verify data fetch triggered
  - Verify data stored in `match_scraped_data`
  - Added integration tests in `tests/unit/services/match-enrichment.test.ts`

- [x] 5.4 Monitor API usage for 1 week after deployment
  - Track daily request counts
  - Verify quota is not exceeded
  - Adjust rate limiting if needed

## 6. Documentation

- [x] 6.1 Update API-Football integration docs
  - Document automatic fetch behavior (both triggers)
  - Document cache TTLs
  - Document quota management
  - Created `docs/AUTOMATIC-STATISTICS-FETCHING.md`

- [x] 6.2 Add troubleshooting section
  - "Why doesn't my match have statistics?"
  - "How to manually refresh data"
  - "API quota exceeded" guidance
  - Added troubleshooting section in `docs/AUTOMATIC-STATISTICS-FETCHING.md`
