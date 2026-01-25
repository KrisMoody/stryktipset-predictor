# Proposal: Add Market Odds Fetching from API-Football

## Summary
Fetch pre-match 1X2 odds from multiple bookmakers via API-Football to provide market consensus data that can improve prediction accuracy by leveraging aggregated market intelligence.

## Problem
Currently, the system only has odds from Svenska Spel. While these are the odds we bet against, they don't reflect the broader market view. Bookmaker odds represent crowdsourced probability estimates backed by significant money. Having multiple bookmaker odds can help:

1. **Market consensus** - Average odds across bookmakers give a "wisdom of the crowd" estimate
2. **Sharp vs soft bookmakers** - Some bookmakers (Pinnacle) are considered "sharp" and their lines often reflect true probabilities better
3. **Value detection** - Comparing Svenska Spel odds against market consensus highlights where they're offering better value
4. **Prediction validation** - If our model agrees with market consensus but differs from Svenska Spel, that's a strong value signal

## Solution
Add a new data type `market_odds` to the automatic fetching flow that:
1. Fetches pre-match odds from API-Football's `/odds` endpoint
2. Stores odds from multiple bookmakers in `match_odds` table with distinct `source` values
3. Calculates market consensus (average implied probabilities across bookmakers)
4. Includes market consensus in prediction context for Claude

## Scope
- **Affected specs**: `api-football-integration`
- **Affected code**:
  - `server/services/api-football/match-enrichment.ts` - Add `fetchAndStoreMarketOdds()` method
  - `server/services/prediction-service.ts` - Include market consensus in prediction context
- **Database**: Uses existing `match_odds` table (source field distinguishes bookmakers)
- **API quota**: +1 API call per match with fixture ID (~13 calls per draw)

## Trade-offs

| Option | Pros | Cons |
|--------|------|------|
| Fetch all bookmakers | Most complete market view | Larger data storage, more processing |
| Fetch top 5 bookmakers only | Focused on reliable sources | May miss some bookmakers |
| **Selected: Fetch 1X2 bet type only** | Low API overhead, most relevant | Misses over/under, BTTS odds |

## Dependencies
- Requires match to have `api_football_fixture_id` (from team mapping)
- Uses existing `match_odds` table schema

## Deliverables
1. `fetchAndStoreMarketOdds()` method in MatchEnrichmentService
2. Updated `fetchAllDataForMatch()` to include market odds
3. Market consensus calculation utility
4. Updated prediction context with "MARKET ODDS COMPARISON" section
5. Environment variable `API_FOOTBALL_ENABLE_MARKET_ODDS` (default: true)
