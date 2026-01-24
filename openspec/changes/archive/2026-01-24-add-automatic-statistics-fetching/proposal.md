# Change: Add Automatic Statistics and Head-to-Head Data Fetching

## Why

Currently, statistics and head-to-head data are only available when a user manually clicks "Fetch Data" for each match. This creates a poor user experience where many matches show "No statistics data available" or "No head-to-head data available" even though API-Football has this data.

**Root cause analysis:**

1. **Enrichment only maps IDs** - When draws sync (`draw-sync.ts:546`), `enrichDrawMatches()` is called, but this only maps Svenska Spel teams/leagues to API-Football IDs. It does NOT fetch actual statistics data.

2. **Data fetch is manual-only** - The `fetchAllDataForMatch()` function that retrieves statistics, H2H, injuries, predictions, etc. is only called when a user clicks "Fetch Data" (`scrape.post.ts:81-88`).

3. **Prediction service doesn't ensure data** - `predictMatch()` reads `match_scraped_data` (`prediction-service.ts:93`) but doesn't trigger fetching if data is missing or stale.

4. **No automatic data population** - After team/league mapping succeeds, no follow-up fetch happens to populate `match_scraped_data` with actual statistics.

## What Changes

### Two automatic trigger points for data fetching:

1. **On draw sync** - After `enrichMatch()` successfully maps teams/leagues, automatically fetch statistics and H2H data
2. **Before prediction** - Before generating a prediction, ensure match has fresh statistics data (fetch if missing or stale)

### Additional improvements:

3. **Prioritized data fetching** - Fetch statistics and H2H first (most valuable for predictions), then injuries/lineups closer to match time
4. **Smarter caching with upsert** - Use longer cache TTLs for stable data (H2H: 30 days, standings: 24h) and shorter for dynamic data (lineups: 30min). Always upsert to keep data fresh.
5. **Data source indicator** - UI shows where data came from (API-Football vs web scraping)

## Impact

- **Affected specs**: `api-football-integration`
- **Affected code**:
  - `server/services/api-football/match-enrichment.ts` - Add automatic fetch after mapping
  - `server/services/draw-sync.ts` - Trigger data fetch after enrichment
  - `server/services/prediction-service.ts` - Ensure data before prediction
  - `components/match/Statistics.vue` - Add data source indicator
  - `components/match/HeadToHead.vue` - Add data source indicator
- **Database**: No schema changes required (uses existing `match_scraped_data` table with upsert on `match_id + data_type`)
- **API quota**: ~50-100 additional requests per draw (13 matches × 5-7 data types), within 7,500/day limit
