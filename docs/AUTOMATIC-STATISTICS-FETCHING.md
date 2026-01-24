# Automatic Statistics and Head-to-Head Data Fetching

## Overview

The system automatically fetches statistics and head-to-head data from API-Football at two key trigger points:

1. **After draw sync** - When teams and leagues are successfully mapped to API-Football IDs
2. **Before prediction** - As a safety net to ensure data is available for AI context

This eliminates the need for users to manually click "Fetch Data" for each match.

## Architecture

```
┌─────────────────┐     ┌──────────────────────┐     ┌─────────────────────┐
│  Svenska Spel   │────>│     Draw Sync        │────>│  Match Enrichment   │
│      API        │     │   (draw-sync.ts)     │     │ (match-enrichment)  │
└─────────────────┘     └──────────────────────┘     └─────────┬───────────┘
                                                               │
                                                               ▼
                                                     ┌─────────────────────┐
                                                     │  Auto-fetch Data    │
                                                     │ (fetchDataAfter     │
                                                     │   Enrichment)       │
                                                     └─────────┬───────────┘
                                                               │
                                    ┌──────────────────────────┼──────────────────────────┐
                                    ▼                          ▼                          ▼
                          ┌─────────────────┐      ┌─────────────────┐      ┌─────────────────┐
                          │   Head-to-Head  │      │  Team Season    │      │   Standings     │
                          │     30d TTL     │      │  Stats (24h)    │      │    24h TTL      │
                          └─────────────────┘      └─────────────────┘      └─────────────────┘
```

## Trigger Points

### 1. After Enrichment (Background, Non-blocking)

When `enrichMatch()` successfully maps teams and leagues to API-Football IDs, it triggers `fetchDataAfterEnrichment()` in the background:

```typescript
// In match-enrichment.ts
const enableAutoFetch = process.env.ENABLE_AUTO_FETCH !== 'false'
if (enableAutoFetch && apiHomeTeamId && apiAwayTeamId) {
  // Run in background (non-blocking) - don't await
  this.fetchDataAfterEnrichment(matchId).catch(err => {
    console.warn(`Background auto-fetch failed for match ${matchId}:`, err)
  })
}
```

**Checks before fetching:**
- Match has fresh data (within cache TTL)
- Match is not finished (status !== 'FT')
- Daily quota usage is below 95%

### 2. Before Prediction (Blocking)

When `predictMatch()` is called, it ensures data exists before generating the prediction:

```typescript
// In prediction-service.ts
const enrichmentService = getMatchEnrichmentService()
const fetchResult = await enrichmentService.fetchMatchDataIfNeeded(matchId, {
  skipQuotaCheck: true,     // Always try for predictions
  skipFinishedMatches: false,
  dataTypes: ['headToHead', 'statistics', 'team_season_stats'],
})
```

This provides graceful degradation - predictions proceed even if fetch fails.

## Cache TTLs

Different data types have different cache durations based on how often they change:

| Data Type | Cache TTL | Rationale |
|-----------|-----------|-----------|
| Head-to-Head | 30 days | Historical data rarely changes |
| Team Season Stats | 24 hours | Updates after matches |
| Standings | 24 hours | Updates after matches |
| Statistics | 24 hours | Match-specific stats |
| Injuries | 1 hour | Changes frequently |
| Predictions | 2 hours | Updates close to kickoff |
| Lineups | 30 minutes | Available ~1h before match |
| Market Odds | 30 minutes | Odds move frequently |

## Quota Management

The system respects API-Football's daily quota (7,500 requests/day for Pro tier):

1. **Auto-fetch pauses at 95% quota** - Automatic fetching skips when quota is nearly exhausted
2. **Manual fetch always works** - User-triggered fetches bypass quota checks
3. **Prediction fetch bypasses quota** - Ensuring predictions have data is prioritized

```typescript
// Quota threshold constant
const QUOTA_THRESHOLD_PERCENT = 95

// Check quota before auto-fetch
private isQuotaExhausted(): boolean {
  const status = this.client.getDailyQuotaStatus()
  const usagePercent = (status.used / status.limit) * 100
  return usagePercent >= QUOTA_THRESHOLD_PERCENT
}
```

## Configuration

### Environment Variables

```env
# Enable/disable automatic fetching (default: enabled)
ENABLE_AUTO_FETCH=true

# Enable/disable market odds fetching (requires additional API calls)
API_FOOTBALL_ENABLE_MARKET_ODDS=false
```

### Runtime Config

In `nuxt.config.ts`:

```typescript
runtimeConfig: {
  apiFootball: {
    enabled: true,
    fetchDuringEnrichment: true,
    dataTypes: ['statistics', 'headToHead', 'injuries'],
    enablePredictions: true,
    enableTeamStats: true,
    enableStandings: true,
    enableLineups: false,  // Usually fetched closer to match time
  }
}
```

## Data Flow

### Priority Order

Data types are fetched in priority order to ensure most valuable data is captured first:

1. **Head-to-Head** (highest value, rarely changes)
2. **Team Season Stats** (high value for predictions)
3. **Standings** (league context)
4. **Fixture Statistics** (if available)
5. **Injuries** (player availability)
6. **Predictions** (API-Football's predictions)
7. **Lineups** (usually available 1h before kickoff)
8. **Market Odds** (optional, requires explicit enable)

### Rate Limiting

Sequential fetching with delays prevents rate limit issues:

```typescript
const REQUEST_DELAY_MS = 500  // 500ms between requests

// Fetches happen sequentially with delays
await fetchH2H()
await delay(REQUEST_DELAY_MS)
await fetchTeamStats()
await delay(REQUEST_DELAY_MS)
// ... etc
```

## Database Storage

All fetched data is stored in `match_scraped_data` using upsert:

```typescript
await prisma.match_scraped_data.upsert({
  where: {
    match_id_data_type: {
      match_id: matchId,
      data_type: dataType,
    },
  },
  create: {
    match_id: matchId,
    data_type: dataType,
    data: jsonData,
    source: 'api-football',
    is_stale: false,
  },
  update: {
    data: jsonData,
    source: 'api-football',
    is_stale: false,
    scraped_at: new Date(),
  },
})
```

## Checking Data Freshness

Use `ensureMatchData()` to check if a match has fresh data:

```typescript
const result = await enrichmentService.ensureMatchData(matchId, [
  'headToHead',
  'statistics',
  'team_season_stats',
])

console.log(result)
// {
//   matchId: 1,
//   hasFreshData: false,
//   missing: ['statistics'],
//   stale: ['team_season_stats'],
//   details: [...]
// }
```

## Troubleshooting

### "Why doesn't my match have statistics?"

1. **Team mapping failed** - Check if `api_football_home_team_id` and `api_football_away_team_id` are set on the match
2. **Quota exhausted** - Check daily quota in API-Football dashboard
3. **API circuit open** - Check logs for circuit breaker messages
4. **Data not available** - Some fixtures don't have statistics in API-Football

### "How to manually refresh data"

Click the "Fetch Data" button on the match page, or call the API endpoint:

```bash
curl -X POST /api/matches/{matchId}/scrape
```

### "API quota exceeded" guidance

1. Wait for quota reset (daily at midnight UTC)
2. Reduce `ENABLE_AUTO_FETCH` to `false` temporarily
3. Consider upgrading API-Football plan
4. Review and reduce unnecessary data types being fetched

### Checking Quota Status

```typescript
const client = getApiFootballClient()
const status = client.getDailyQuotaStatus()
console.log(`Used: ${status.used}/${status.limit} (${(status.used/status.limit*100).toFixed(1)}%)`)
```

## Monitoring

### Key Metrics to Watch

1. **Daily API usage** - Should stay below quota
2. **Auto-fetch skip rate** - High rate may indicate quota issues
3. **Data freshness** - Most matches should have fresh data before kickoff
4. **Enrichment success rate** - Team/league mapping failures

### Log Messages

- `[MatchEnrichment] Auto-fetch completed for match X` - Success
- `[MatchEnrichment] Auto-fetch skipped: quota threshold exceeded` - Quota limit
- `[MatchEnrichment] Auto-fetch skipped: Match is finished` - Expected skip
- `[MatchEnrichment] Background auto-fetch failed` - Error during fetch

## API Quota Estimates

Typical usage per draw (13 matches):

| Data Type | Requests per Match | Total |
|-----------|-------------------|-------|
| H2H | 1 | 13 |
| Team Stats | 2 (home + away) | 26 |
| Standings | 1 | 13 |
| Injuries | 1-2 | ~20 |
| Predictions | 1 | 13 |
| **Total** | | ~85 |

With 5 draws per week: ~425 requests/week, well within 7,500/day limit.

## Related Documentation

- [API-FOOTBALL-Complete-Documentation.md](./API-FOOTBALL-Complete-Documentation.md) - Full API reference
- [SCRAPER_GUIDE.md](./SCRAPER_GUIDE.md) - Web scraping for xStats data
- [API_INTEGRATION.md](./API_INTEGRATION.md) - Svenska Spel API integration
