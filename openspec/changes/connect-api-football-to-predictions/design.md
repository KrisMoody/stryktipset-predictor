# Design: Connect API-Football to Predictions

## Current State

```
Svenska Spel API → Draw Sync → Matches in DB
                        ↓
                 Match Enrichment (async)
                        ↓
                 API-Football IDs stored on matches
                        ↓
                 [UNUSED] DataProviderFactory
                        ↓
                 [UNUSED] ApiFootballProvider


Prediction Flow (current):
                        ↓
     match_scraped_data (xStats, statistics, H2H from web scraping)
                        ↓
     Statistical Calculations (Dixon-Coles, Elo)
                        ↓
     prepareMatchContext() → Claude AI
```

## Proposed Architecture

```
Draw Sync → Matches in DB
     ↓
Match Enrichment (async) → API-Football IDs
     ↓
Data Enrichment (NEW) → Fetch & store API-Football data
     ↓
match_scraped_data (API-Football OR scraped data)


Prediction Flow (updated):
     ↓
prepareMatchContext() reads from match_scraped_data
     ↓
[Already has API-Football data if available]
     ↓
Claude AI
```

## Design Decisions

### 1. When to Fetch API-Football Data

**Option A**: Fetch at prediction time (rejected)
- Adds latency to prediction generation
- May fail if API is slow/down
- Wastes API calls if same match predicted multiple times

**Option B**: Fetch during enrichment (selected) ✅
- Data already available when prediction runs
- Stored in `match_scraped_data` with `source='api-football'`
- Automatic fallback - scraper fills gaps if API-Football fails
- Zero added latency at prediction time

### 2. How to Store API-Football Data

Store in existing `match_scraped_data` table with:
- `data_type`: 'statistics', 'headToHead', 'injuries', 'lineup'
- `source`: 'api-football' (vs 'web-scraping')
- `data`: JSON blob with normalized structure

Benefits:
- No schema changes required
- Prediction service already reads from this table
- Clear source tracking for debugging
- Graceful fallback (use whichever source has data)

### 3. Data Type Priority

For each data type, prefer API-Football when available:

| Data Type | Primary Source | Fallback |
|-----------|---------------|----------|
| statistics | API-Football | Web scraping |
| headToHead | API-Football | Web scraping |
| injuries | API-Football | None (new data) |
| lineup | API-Football (close to deadline) | Web scraping |
| xStats | Web scraping (Svenska Spel specific) | None |
| odds | Svenska Spel API | None |

### 4. Integration Points

#### A. Application Startup
```typescript
// server/plugins/init-providers.ts
export default defineNitroPlugin(async () => {
  await initializeDataProviders()
})
```

#### B. Match Enrichment (Extended)
```typescript
// server/services/api-football/match-enrichment.ts
// After mapping IDs, also fetch and store data:
async enrichMatch(matchId: number) {
  // ... existing mapping logic ...

  // NEW: Fetch and store API-Football data
  if (apiFixtureId && config.apiFootball.enabled) {
    await this.fetchAndStoreStatistics(matchId, apiFixtureId)
    await this.fetchAndStoreH2H(matchId, homeTeamId, awayTeamId)
    await this.fetchAndStoreInjuries(matchId, homeTeamId, awayTeamId)
  }
}
```

#### C. Progressive Scraper (Updated)
```typescript
// Skip scraping data types that API-Football already provides
const staleDataTypes = dataTypes.filter(type => {
  const existing = match.match_scraped_data.find(d => d.data_type === type)
  // Skip if API-Football data is fresh
  if (existing?.source === 'api-football' && !isStale(existing)) {
    return false
  }
  return !existing || isStale(existing)
})
```

#### D. Prediction Context (Enhanced)
```typescript
// server/services/prediction-service.ts
// Already reads from match_scraped_data - no changes needed!
// API-Football data flows through automatically once stored
```

## Data Flow Diagram

```
┌─────────────────┐
│   Draw Sync     │
└────────┬────────┘
         ↓
┌─────────────────┐      ┌──────────────────┐
│ Match Enrichment│──────│ API-Football API │
│  (async)        │      │ - /teams         │
│                 │      │ - /fixtures      │
└────────┬────────┘      └──────────────────┘
         ↓
┌─────────────────┐      ┌──────────────────┐
│ Data Enrichment │──────│ API-Football API │
│  (NEW - async)  │      │ - /statistics    │
│                 │      │ - /headtohead    │
└────────┬────────┘      │ - /injuries      │
         ↓               └──────────────────┘
┌─────────────────┐
│match_scraped_   │
│data             │
│(source:         │
│ 'api-football') │
└────────┬────────┘
         ↓
┌─────────────────┐
│ Prediction      │ ← Reads from match_scraped_data
│ Service         │   (API-Football data automatically included)
└─────────────────┘
```

## Error Handling

1. **API-Football Down**: Circuit breaker opens, enrichment skips API calls
2. **Team Not Mapped**: Skip API-Football for that match, use scraping
3. **Data Not Available**: Null stored, scraper fills in later
4. **Rate Limited**: Exponential backoff, cache aggressively

## Configuration

```typescript
// nuxt.config.ts
runtimeConfig: {
  apiFootball: {
    enabled: true,  // Master switch
    fetchDuringEnrichment: true,  // Fetch data, not just IDs
    dataTypes: ['statistics', 'headToHead', 'injuries'],
    skipScrapingWhenAvailable: true,  // Reduce scraper load
  }
}
```

## Migration Strategy

1. **Phase 1**: Enable data fetching during enrichment (writes to DB)
2. **Phase 2**: Prediction service automatically uses new data (no code changes)
3. **Phase 3**: Update progressive scraper to skip redundant scraping
4. **Rollback**: Set `apiFootball.enabled = false` to revert to scraping-only
