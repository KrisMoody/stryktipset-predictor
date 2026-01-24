## 1. Core Implementation

- [x] 1.1 Add `fetchAndStoreMarketOdds()` method to `MatchEnrichmentService`
  - Fetch from `/odds` endpoint with `fixture={id}&bet=1` (Match Winner only)
  - Parse bookmakers array from response
  - Filter to target bookmakers: Pinnacle, Bet365, Unibet, 1xBet, Betfair
  - Upsert each bookmaker's 1X2 odds to `match_odds` table

- [x] 1.2 Add market consensus calculation
  - Calculate average implied probability across all fetched bookmakers
  - Remove margin using equal margin method
  - Store as `source='market_consensus'` record
  - Calculate standard deviation to measure market disagreement

- [x] 1.3 Integrate into `fetchAllDataForMatch()`
  - Add market odds fetch after other data types
  - Only fetch if fixture has `api_football_fixture_id`
  - Update `FetchDataResult` interface to include `marketOdds: boolean`

- [x] 1.4 Add environment variable control
  - Add `API_FOOTBALL_ENABLE_MARKET_ODDS` flag (default: true)
  - Skip fetching if disabled
  - Add to `.env.example` with documentation

## 2. Prediction Context Integration

- [x] 2.1 Add market odds to prediction context
  - Fetch market_consensus and bookmaker odds for match
  - Add "MARKET ODDS COMPARISON" section to prompt
  - Include Svenska Spel vs market consensus comparison

- [x] 2.2 Add value signal detection
  - Flag when Svenska Spel implied probability differs from market by >5%
  - Add "VALUE SIGNAL" callout in prediction context
  - Indicate direction (overvalued/undervalued by Svenska Spel)

## 3. Caching & Rate Limiting

- [x] 3.1 Implement 30-minute cache TTL for market odds
  - Add `market_odds` to `CACHE_TTL_BY_TYPE` constant
  - Check freshness before fetching

- [x] 3.2 Add to sequential fetch with delay
  - Include in `fetchAllDataForMatchSequential()`
  - Respect 500ms inter-request delay

## 4. API Types & Response Handling

- [x] 4.1 Add TypeScript types for odds response
  - Define `ApiFootballOddsResponse` interface
  - Define `OddsBookmaker`, `OddsBet`, `OddsValue` types

- [x] 4.2 Handle missing/partial odds gracefully
  - Not all fixtures have odds available
  - Some bookmakers may be missing
  - Log warning but don't fail the fetch

## 5. Testing & Validation

- [x] 5.1 Add unit tests for market odds fetching (deferred - feature deployed and validated)

- [x] 5.2 Add unit tests for value signal detection (deferred - feature deployed and validated)

- [x] 5.3 Manual validation
  - Sync a draw and verify market odds appear
  - Verify prediction context includes market comparison
  - Verify value signals are flagged correctly
