## Context

The ST-Predictor system relies on match statistics and head-to-head data for accurate predictions. Currently, this data is only fetched when users manually trigger a scrape, leaving most matches with missing data. The system has API-Football integration with automatic team/league mapping, but doesn't automatically fetch the actual data after mapping succeeds.

**Current data flow:**
1. Draw syncs from Svenska Spel API → matches created
2. `enrichDrawMatches()` maps teams/leagues to API-Football IDs (async, non-blocking)
3. User clicks "Fetch Data" → `fetchAllDataForMatch()` retrieves statistics
4. User clicks "Predict" → `predictMatch()` reads existing `match_scraped_data` (may be empty)

**Problem:** Steps 3 and 4 are disconnected. Most users never click "Fetch Data", and predictions don't ensure data exists first.

## Goals / Non-Goals

**Goals:**
- Automatically fetch statistics and H2H data at two trigger points:
  1. After team mapping succeeds (draw sync)
  2. Before generating a prediction (ensure data is fresh)
- Respect API-Football rate limits (2 req/min sustained, 7,500/day)
- Always upsert data to keep database records fresh
- Show data source in UI for transparency

**Non-Goals:**
- Real-time match updates (not needed for pre-match predictions)
- Replacing web scraping entirely (xStats data not available in API-Football)
- Custom priority queuing beyond simple rate limiting

## Decisions

### Decision 1: Two trigger points for data fetching

**What:** Fetch data at two distinct moments:
1. **After enrichment** - When `enrichMatch()` successfully maps teams/leagues, fetch data in background (non-blocking)
2. **Before prediction** - When `predictMatch()` is called, check if data exists/is fresh, fetch if needed (blocking)

**Why:**
- Enrichment trigger ensures data is ready before users even look at matches
- Prediction trigger is a safety net that guarantees data for AI context
- Both use the same `fetchAllDataForMatch()` function

**Alternatives considered:**
- Only on enrichment: Wouldn't catch cases where enrichment succeeds but fetch fails
- Only on prediction: Too late, adds latency to prediction request
- Scheduled job: More complex, harder to ensure data freshness

### Decision 2: Prioritized data types

**What:** Fetch data types in priority order:
1. Head-to-Head (high value, rarely changes) - cache 30 days
2. Team season stats + standings (high value) - cache 24 hours
3. Fixture statistics (recent match stats) - cache 24 hours
4. Injuries (medium value, changes often) - cache 1 hour
5. Predictions (API-Football predictions) - cache 2 hours
6. Lineups (only available close to match) - cache 30 minutes, fetch separately

**Why:** If we hit rate limits, the most valuable data is fetched first.

### Decision 3: Rate-limited queue with delays

**What:** Use a simple async queue with:
- 500ms delay between requests
- Max 2 requests per second
- Circuit breaker if API returns 429

**Why:** Simpler than a full job queue system. Works within single Node.js process. Can be upgraded to proper queue (Bull/BullMQ) later if needed.

**Implementation:** Add sequential fetching with delays instead of Promise.all parallelization in `fetchAllDataForMatch()`.

### Decision 4: Always upsert data

**What:** Every fetch operation upserts to `match_scraped_data` using the unique constraint on `(match_id, data_type)`.

**Why:**
- Ensures data is always fresh
- No need to manually mark records as stale
- `scraped_at` timestamp always reflects latest fetch
- Simple logic: fetch → upsert → done

### Decision 5: Graceful degradation

**What:** If data fetch fails before prediction:
- Log warning with details
- Proceed with prediction using any available data
- Don't block user from getting prediction

**Why:** A prediction with partial data is better than no prediction. The AI can work with limited context.

### Decision 6: Web scraping as primary for xStats

**What:** Keep web scraping for xStats (expected goals) since API-Football doesn't provide xG data. Use API-Football as primary for:
- Head-to-Head
- Team statistics
- Standings
- Injuries
- Lineups

**Why:** xStats is critical for predictions but only available via scraping. Other data is more reliably available via API.

## Risks / Trade-offs

| Risk | Impact | Mitigation |
|------|--------|------------|
| API quota exhaustion | Can't fetch new data | Track daily usage, alert at 80%, pause auto-fetch at 95% |
| Rate limiting (429) | Temporary blocks | Circuit breaker, exponential backoff already implemented |
| Increased API costs | Higher tier needed | Pro tier (7,500/day) should be sufficient for ~5 draws/week |
| Failed mappings | No data fetched | Fall back to web scraping, flag for manual review |
| Prediction latency | Slower if fetch needed | Pre-fetch on enrichment minimizes this |

## Migration Plan

1. **Phase 1:** Add automatic fetch after enrichment (background, non-blocking)
2. **Phase 2:** Add data check before prediction (blocking fetch if needed)
3. **Phase 3:** Add data source indicators to UI
4. **Phase 4:** Monitor API usage for 1-2 weeks
5. **Rollback:** Disable automatic fetch via `ENABLE_AUTO_FETCH` flag

No database migrations required. Uses existing `match_scraped_data` table with:
- `source` field for tracking origin
- `scraped_at` for freshness
- Unique constraint on `(match_id, data_type)` for upsert

## Open Questions

1. ~~Should we retry failed fetches?~~ → Yes, prediction trigger acts as retry
2. Should we prioritize matches by kickoff time? (Closer matches first)
3. ~~Should we skip fetching for finished matches?~~ → Yes, status='FT' skips fetch
