# Complete Data Capture - Implementation Summary

## Overview

The system now captures **ALL available data** from the Svenska Spel API and stores it in a structured format for AI predictions.

## Database Schema Updates

### Matches Table - New Fields

```sql
home_team_short       VARCHAR(50)   -- Short team name (e.g., "LIV" for Liverpool)
away_team_short       VARCHAR(50)   -- Short team name
status_time           TIMESTAMP(6)  -- When status was last updated
coverage              VARCHAR(100)  -- Coverage level from data provider
betRadar_id           INTEGER       -- BetRadar match ID for cross-referencing
kambi_id              INTEGER       -- Kambi match ID for cross-referencing
```

**Indexes:**
- `matches_betRadar_id_idx`
- `matches_kambi_id_idx`

### Match Odds Table - Enhanced Structure

```sql
type                        VARCHAR(20)   -- 'current', 'start', 'favourite'
tio_tidningars_tips_home    VARCHAR(10)   -- Expert tips percentage (1)
tio_tidningars_tips_draw    VARCHAR(10)   -- Expert tips percentage (X)
tio_tidningars_tips_away    VARCHAR(10)   -- Expert tips percentage (2)
```

**Updated Unique Constraint:**
```sql
UNIQUE(match_id, source, type, collected_at)
```

This allows storing multiple odds types for the same match:
- Opening odds (`type='start'`)
- Current/closing odds (`type='current'`)
- Favourite odds (`type='favourite'`)

## Data Sources Captured

### 1. Odds Data (Multiple Types)

**Current Odds** - `event.odds`
- The latest odds from Svenska Spel
- Updates in real-time as bets come in
- Stored with `type='current'`

**Start Odds** - `event.startOdds`
- Opening odds when betting opened
- Critical for detecting market movement
- Stored with `type='start'`

**Favourite Odds** - `event.favouriteOdds`
- Odds for the most popular outcome
- Stored with `type='favourite'`

**Bet Metrics Odds** - `event.betMetrics.values`
- Most comprehensive odds data
- Includes distribution percentages
- Stored in `match_scraped_data` as `betMetrics`

### 2. Crowd Wisdom - Svenska Folket

**Basic Distribution** - `event.svenskaFolket`
```typescript
{
  one: "45.2",    // % betting on home win
  x: "27.8",      // % betting on draw
  two: "27.0"     // % betting on away win
}
```

**Complete Data** - Stored in `match_scraped_data` as `svenskaFolket`
```typescript
{
  one: "45.2",
  x: "27.8",
  two: "27.0",
  date: "2024-11-29T10:00:00Z",
  refOne: "42.1",   // Reference distribution (historical)
  refX: "28.5",
  refTwo: "29.4"
}
```

### 3. Expert Opinion - Tio Tidningars Tips

**Stored in multiple places:**
1. `match_odds.tio_tidningars_tips_*` - Quick access
2. `match_scraped_data` as `expertTips` - Complete data

```typescript
{
  one: "6",     // 6 out of 10 experts pick home win
  x: "2",       // 2 experts pick draw
  two: "2"      // 2 experts pick away win
}
```

### 4. Bet Metrics - Complete Distribution Data

**Stored in:** `match_scraped_data` as `betMetrics`

```typescript
{
  date: "2024-11-29T15:30:00Z",
  values: [
    {
      outcome: "1",
      odds: "2.15",
      distribution: "48.2"
    },
    {
      outcome: "X",
      odds: "3.50",
      distribution: "26.1"
    },
    {
      outcome: "2",
      odds: "3.80",
      distribution: "25.7"
    }
  ]
}
```

### 5. Match Metadata

**Team Information:**
- `name` - Full name (e.g., "Liverpool FC")
- `shortName` - Abbreviated (e.g., "LIV")
- `mediumName` - Medium length (e.g., "Liverpool")
- `countryName` - Team's country
- `isoCode` - Country ISO code

**Match Status:**
- `status` - Current status string
- `statusTime` - Timestamp of status update
- `sportEventStatus` - Detailed status object
- `coverage` - Data coverage level

**External IDs:**
- `betRadar_id` - BetRadar match ID
- `kambi_id` - Kambi match ID
- Used for cross-referencing with other data sources

## TypeScript Interfaces

### Core Data Types

```typescript
interface ExpertTipsData {
  one?: string    // Number of experts picking home win
  x?: string      // Number of experts picking draw
  two?: string    // Number of experts picking away win
}

interface BetMetricsValue {
  outcome: string           // "1", "X", "2"
  odds: string             // Current odds for this outcome
  distribution: string     // % of bets on this outcome
}

interface BetMetricsData {
  date?: string                  // Timestamp of metrics
  values?: BetMetricsValue[]    // Per-outcome data
}

interface SvenskaFolketData {
  one?: string      // % betting on home
  x?: string        // % betting on draw
  two?: string      // % betting on away
  date?: string     // Timestamp
  refOne?: string   // Reference distribution
  refX?: string
  refTwo?: string
}

interface ProviderIdData {
  provider: string  // "BetRadar", "Kambi"
  id: number       // Provider's match ID
}
```

## Data Flow

### 1. API Fetch
```typescript
svenskaSpelApi.fetchDrawWithMultifetch(drawNumber)
```

### 2. Sync Service Processing
```typescript
drawSyncService.syncCurrentDraws()
  ├─ processDraw()
  ├─ processMatch()          // Extract all match metadata
  ├─ processMatchOdds()      // Store odds (current, start, favourite)
  ├─ storeExpertTips()       // Store Tio Tidningars Tips
  ├─ storeBetMetrics()       // Store complete bet distribution
  └─ storeSvenskaFolketData() // Store crowd wisdom
```

### 3. Database Storage

**Structured Data:**
- `matches` - Core match info + metadata
- `match_odds` - Multiple odds types with timestamps

**JSON Storage:**
- `match_scraped_data.data_type='expertTips'`
- `match_scraped_data.data_type='betMetrics'`
- `match_scraped_data.data_type='svenskaFolket'`

**Raw Backup:**
- `matches.raw_data` - Complete API response

## Benefits for AI Predictions

### 1. Market Movement Analysis
Compare opening odds vs closing odds:
```typescript
const startOdds = await getOdds(matchId, 'start')
const currentOdds = await getOdds(matchId, 'current')
const movement = calculateMovement(startOdds, currentOdds)
// If odds moved significantly, sharp money might be on one side
```

### 2. Crowd vs Expert vs AI
```typescript
const crowd = svenskaFolket        // What public thinks (often wrong)
const experts = tioTidningarsTips  // What professionals think
const ai = aiPrediction            // What AI predicts
// When all align = high confidence
// When AI differs = potential value bet
```

### 3. Value Detection
```typescript
const impliedProb = 1 / currentOdds.home
const aiProb = prediction.probability_home
if (aiProb > impliedProb + 0.05) {
  // Value bet! AI sees 5%+ edge over market
}
```

### 4. Confidence Building
```typescript
if (
  ai.pick === experts.majority &&
  ai.pick === crowd.majority &&
  movement.towards === ai.pick
) {
  confidence = 'HIGH'
  spikSuitable = true
}
```

### 5. Historical Pattern Recognition
```typescript
// Track how distributions evolved
const earlyDistribution = betMetrics[0]
const closeDistribution = betMetrics[-1]
const smartMoney = detectLateMovement(early, close)
```

## Migration

### Migration File
```sql
prisma/migrations/20251130_add_complete_match_metadata_and_odds_types/migration.sql
```

### Apply Migration
```bash
# When database is accessible
npx prisma db execute --file prisma/migrations/20251130_add_complete_match_metadata_and_odds_types/migration.sql

# Or use migrate
npx prisma migrate deploy
```

### Generate Client
```bash
npx prisma generate
```

## Testing Data Capture

### 1. Trigger Sync
```bash
curl http://localhost:3000/api/admin/sync
```

### 2. Check Matches Table
```sql
SELECT 
  id,
  home_team,
  home_team_short,
  away_team,
  away_team_short,
  coverage,
  betRadar_id,
  kambi_id
FROM matches
WHERE draw_id = (SELECT id FROM draws ORDER BY id DESC LIMIT 1);
```

### 3. Check Odds Types
```sql
SELECT 
  m.home_team,
  m.away_team,
  mo.type,
  mo.home_odds,
  mo.draw_odds,
  mo.away_odds,
  mo.tio_tidningars_tips_home,
  mo.collected_at
FROM match_odds mo
JOIN matches m ON m.id = mo.match_id
WHERE m.draw_id = (SELECT id FROM draws ORDER BY id DESC LIMIT 1)
ORDER BY m.match_number, mo.type;
```

### 4. Check Scraped Data
```sql
SELECT 
  m.home_team,
  m.away_team,
  msd.data_type,
  msd.data
FROM match_scraped_data msd
JOIN matches m ON m.id = msd.match_id
WHERE m.draw_id = (SELECT id FROM draws ORDER BY id DESC LIMIT 1);
```

## Next Steps

### 1. Update Prediction Context ✅ (Next)
Enhance AI prediction prompts to include:
- Market movement (start vs current odds)
- Crowd distribution
- Expert consensus
- Value opportunities

### 2. Update Frontend Display
Show in match cards:
- Opening vs current odds
- Market movement indicators
- Svenska Folket distribution chart
- Expert tips consensus
- Value bet indicators

### 3. Performance Tracking
Track prediction accuracy across:
- High-confidence predictions
- Value bets
- Against-crowd predictions
- With-expert predictions

## Summary

✅ **Database Schema** - Updated with all new fields
✅ **Data Extraction** - Capturing all available data sources
✅ **Storage Strategy** - Optimized for both querying and completeness
✅ **Type Safety** - Full TypeScript interfaces
✅ **Documentation** - Complete implementation guide

The system is now ready to leverage the full richness of Svenska Spel's data for superior predictions! 🎉

