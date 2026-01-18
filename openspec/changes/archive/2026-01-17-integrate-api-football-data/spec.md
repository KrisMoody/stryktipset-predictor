# Spec: API-Football Data Integration

**Change ID**: `integrate-api-football-data`
**Status**: Proposed
**Target Version**: 2.0.0
**Dependencies**: None

---

## Overview

This specification defines the integration of API-Football as a data provider for match statistics, team information, injuries, and historical data. The integration uses a provider abstraction pattern to ensure loose coupling and automatic fallback to existing web scraping when API-Football is unavailable.

---

## Interfaces

### 1. Data Provider Interface

All data providers (API-Football, Web Scraper, Cache) implement this interface:

```typescript
// server/services/data-provider/types.ts

interface MatchDataProvider {
  readonly name: string
  readonly priority: number

  getStatistics(matchId: number): Promise<MatchStatistics>
  getInjuries(teamId: number): Promise<PlayerInjury[]>
  getTeamStats(teamId: number, season: number): Promise<TeamStatistics>
  getHeadToHead(team1: number, team2: number): Promise<HeadToHeadData>
  isHealthy(): Promise<boolean>
  getCachedData?(key: string): Promise<any>
}
```

**Parameters:**
- `matchId` (number): Internal match ID from `matches` table
- `teamId` (number): Internal team ID from `teams` table (NOT API-Football ID)
- `season` (number): Season year (e.g., 2024)
- `team1`, `team2` (number): Team IDs for head-to-head lookup

**Return Types:**
- All methods return normalized data structures (see Data Structures section)
- All methods throw errors on failure (caught by factory fallback logic)

**Validation:**
- `name` must be unique across providers
- `priority` determines fallback order (lower = higher priority)
- All async methods must resolve or reject within 30 seconds

### 2. Data Provider Factory

```typescript
// server/services/data-provider/factory.ts

class DataProviderFactory {
  constructor()

  getStatistics(matchId: number): Promise<MatchStatistics>
  getInjuries(teamId: number): Promise<PlayerInjury[]>
  getTeamStats(teamId: number, season: number): Promise<TeamStatistics>
  getHeadToHead(team1: number, team2: number): Promise<HeadToHeadData>
  getProviderHealth(): Promise<ProviderHealthReport[]>
}
```

**Behavior:**
- Constructor reads `ENABLE_API_FOOTBALL` environment variable
- If enabled, registers: ApiFootballProvider → WebScraperProvider → CachedDataProvider
- If disabled, registers: WebScraperProvider → CachedDataProvider only
- Each method tries providers in priority order until one succeeds
- Circuit breaker opens after 3 consecutive failures per provider
- When circuit is open, provider is skipped for 5 minutes

**Validation:**
- At least one provider must be registered
- All methods must eventually return or throw (no infinite loops)
- Circuit breaker state must persist across requests (in-memory store)

### 3. API-Football Client

```typescript
// server/services/api-football-client.ts

class ApiFootballClient {
  constructor(apiKey: string, baseUrl: string)

  get<T>(endpoint: string, params?: Record<string, any>): Promise<T>
  isHealthy(): Promise<boolean>
  getQuotaUsage(): Promise<{ used: number; limit: number }>
}
```

**Parameters:**
- `endpoint` (string): API endpoint path (e.g., `/fixtures`, `/teams`)
- `params` (object): Query parameters

**Behavior:**
- Add `x-apisports-key` header to all requests
- Rate limit: 2 requests/minute (500ms delay between calls)
- Retry on failure: 3 attempts with exponential backoff (1s, 2s, 4s)
- Handle 429 errors: exponential backoff (30s, 60s, 120s)
- Cache responses in-memory with TTL
- Track quota usage in `api_football_usage` table

**Validation:**
- `apiKey` must be non-empty string
- `baseUrl` must be valid HTTPS URL
- All requests must timeout after 30 seconds

### 4. Team Matching Service

```typescript
// server/services/api-football/team-matcher.ts

class TeamMatcher {
  constructor(client: ApiFootballClient)

  matchTeam(
    teamName: string,
    leagueId: number,
    options?: MatchOptions
  ): Promise<TeamMapping>

  matchLeague(
    leagueName: string,
    country: string
  ): Promise<LeagueMapping>
}

interface MatchOptions {
  betRadarId?: string
  kambiId?: string
  forceFuzzyMatch?: boolean
}

interface TeamMapping {
  svenskaSpeTeamId: number
  apiFootballTeamId: number
  confidence: 'high' | 'medium' | 'low'
  matchMethod: 'betradar_id' | 'kambi_id' | 'fuzzy_match' | 'manual'
  similarity?: number
}
```

**Matching Strategies (in order):**

1. **Direct ID Lookup** (confidence: `high`)
   - If `betRadarId` provided: search API-Football teams by ID
   - If `kambiId` provided: search API-Football teams by ID
   - Success → return match with `matchMethod: 'betradar_id'` or `'kambi_id'`

2. **Fuzzy Text Matching** (confidence: `high` if >95%, `medium` if 80-95%, `low` if <80%)
   - Fetch all teams for league: `GET /teams?league={leagueId}&season={year}`
   - Cache league roster for 24 hours
   - Normalize team names (lowercase, remove accents, trim)
   - Calculate Levenshtein distance: `similarity = 1 - (distance / maxLength)`
   - Accept match if similarity >= 80%
   - Success → return match with `matchMethod: 'fuzzy_match'`

3. **Manual Override** (confidence: `high`)
   - Check `team_mappings` table for manual entry
   - Success → return match with `matchMethod: 'manual'`

**Validation:**
- Team name must be non-empty string
- League ID must be valid API-Football league ID
- Confidence thresholds: high (95%+), medium (80-94%), low (<80%)
- Store all matches in `team_mappings` table for audit

---

## Data Structures

### MatchStatistics

```typescript
interface MatchStatistics {
  matchId: number
  homeTeam: TeamMatchStats
  awayTeam: TeamMatchStats
  source: 'api-football' | 'web-scraping' | 'cache'
  fetchedAt: Date
}

interface TeamMatchStats {
  teamId: number
  shots: { total: number; onTarget: number }
  possession: number
  passes: { total: number; accurate: number; percentage: number }
  fouls: number
  corners: number
  offsides: number
  yellowCards: number
  redCards: number
}
```

### PlayerInjury

```typescript
interface PlayerInjury {
  playerId: number
  playerName: string
  reason: string
  expectedReturn?: Date
  severity: 'minor' | 'moderate' | 'severe'
}
```

### TeamStatistics

```typescript
interface TeamStatistics {
  teamId: number
  season: number
  form: string // "WWDLL" format
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  homeRecord: { wins: number; draws: number; losses: number }
  awayRecord: { wins: number; draws: number; losses: number }
}
```

### HeadToHeadData

```typescript
interface HeadToHeadData {
  team1Id: number
  team2Id: number
  lastMatches: HistoricalMatch[]
  team1Wins: number
  draws: number
  team2Wins: number
}

interface HistoricalMatch {
  date: Date
  homeTeam: number
  awayTeam: number
  scoreHome: number
  scoreAway: number
  venue: string
}
```

---

## Database Schema

### ADDED: `team_mappings` table

```sql
CREATE TABLE team_mappings (
  id SERIAL PRIMARY KEY,
  svenska_spel_team_id INT NOT NULL REFERENCES teams(id),
  api_football_team_id INT NOT NULL,
  confidence VARCHAR(10) NOT NULL CHECK (confidence IN ('high', 'medium', 'low')),
  match_method VARCHAR(50) NOT NULL CHECK (match_method IN ('betradar_id', 'kambi_id', 'fuzzy_match', 'manual')),
  similarity DECIMAL(5, 2),
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(svenska_spel_team_id, api_football_team_id)
);

CREATE INDEX idx_team_mappings_ss_team ON team_mappings(svenska_spel_team_id);
CREATE INDEX idx_team_mappings_confidence ON team_mappings(confidence);
```

### ADDED: `league_mappings` table

```sql
CREATE TABLE league_mappings (
  id SERIAL PRIMARY KEY,
  svenska_spel_league_name VARCHAR(255) NOT NULL,
  api_football_league_id INT NOT NULL,
  country VARCHAR(100),
  confidence VARCHAR(10) NOT NULL,
  verified BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(svenska_spel_league_name, api_football_league_id)
);
```

### ADDED: `api_football_cache` table

```sql
CREATE TABLE api_football_cache (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  params JSONB NOT NULL,
  response JSONB NOT NULL,
  expires_at TIMESTAMP NOT NULL,
  created_at TIMESTAMP DEFAULT NOW(),
  UNIQUE(endpoint, params)
);

CREATE INDEX idx_api_cache_expires ON api_football_cache(expires_at);
```

### ADDED: `api_football_usage` table

```sql
CREATE TABLE api_football_usage (
  id SERIAL PRIMARY KEY,
  endpoint VARCHAR(255) NOT NULL,
  status INT NOT NULL,
  response_time_ms INT,
  cached BOOLEAN DEFAULT false,
  timestamp TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_api_usage_timestamp ON api_football_usage(timestamp);
CREATE INDEX idx_api_usage_endpoint ON api_football_usage(endpoint);
```

### ADDED: `historical_matches` table

```sql
CREATE TABLE historical_matches (
  id SERIAL PRIMARY KEY,
  api_football_fixture_id INT UNIQUE NOT NULL,
  league_id INT,
  season INT NOT NULL,
  home_team_id INT,
  away_team_id INT,
  score_home INT,
  score_away INT,
  match_date TIMESTAMP NOT NULL,
  statistics JSONB,
  events JSONB,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_historical_league_season ON historical_matches(league_id, season);
CREATE INDEX idx_historical_teams ON historical_matches(home_team_id, away_team_id);
CREATE INDEX idx_historical_date ON historical_matches(match_date);
```

### MODIFIED: `match_scraped_data` table

```sql
-- Add source tracking
ALTER TABLE match_scraped_data
  ADD COLUMN source VARCHAR(50) DEFAULT 'web-scraping',
  ADD COLUMN is_stale BOOLEAN DEFAULT false,
  ADD COLUMN fetched_at TIMESTAMP DEFAULT NOW();

CREATE INDEX idx_scraped_data_source ON match_scraped_data(source);
```

### MODIFIED: `matches` table

```sql
-- Add API-Football foreign keys
ALTER TABLE matches
  ADD COLUMN api_football_fixture_id INT,
  ADD COLUMN api_football_league_id INT,
  ADD COLUMN api_football_home_team_id INT,
  ADD COLUMN api_football_away_team_id INT,
  ADD COLUMN mapping_confidence VARCHAR(10);

CREATE INDEX idx_matches_api_fixture ON matches(api_football_fixture_id);
```

---

## Configuration

### Environment Variables

```bash
# Required for API-Football integration
API_FOOTBALL_API_KEY=your-api-key-here
API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io

# Feature flag
ENABLE_API_FOOTBALL=true  # Set to 'false' to disable API-Football

# Rate limiting
API_FOOTBALL_MAX_REQUESTS_PER_MINUTE=2
API_FOOTBALL_CIRCUIT_BREAKER_THRESHOLD=3
API_FOOTBALL_CIRCUIT_BREAKER_TIMEOUT_MS=300000  # 5 minutes
```

### Runtime Config (nuxt.config.ts)

```typescript
export default defineNuxtConfig({
  runtimeConfig: {
    apiFootball: {
      apiKey: process.env.API_FOOTBALL_API_KEY,
      baseUrl: process.env.API_FOOTBALL_BASE_URL || 'https://v3.football.api-sports.io',
      enabled: process.env.ENABLE_API_FOOTBALL === 'true',
      maxRequestsPerMinute: parseInt(process.env.API_FOOTBALL_MAX_REQUESTS_PER_MINUTE || '2'),
      circuitBreaker: {
        threshold: parseInt(process.env.API_FOOTBALL_CIRCUIT_BREAKER_THRESHOLD || '3'),
        timeoutMs: parseInt(process.env.API_FOOTBALL_CIRCUIT_BREAKER_TIMEOUT_MS || '300000')
      }
    }
  }
})
```

---

## API Endpoints

### API-Football Endpoints Used

| Endpoint | Purpose | Cache TTL | Calls/Month |
|----------|---------|-----------|-------------|
| `GET /teams?league={id}&season={year}` | Team roster for league | 24 hours | ~400 |
| `GET /fixtures/statistics?fixture={id}` | Match statistics | Forever (completed matches) | ~500 |
| `GET /injuries?team={id}` | Team injuries | 1 hour | ~400 |
| `GET /fixtures/lineups?fixture={id}` | Starting lineups | 1 hour | ~200 |
| `GET /teams/statistics?team={id}&season={year}` | Team season stats | 24 hours | ~40 |
| `GET /standings?league={id}&season={year}` | League standings | 24 hours | ~15 |
| `GET /fixtures/headtohead?h2h={team1}-{team2}` | Head-to-head history | Forever | ~50 |
| `GET /fixtures?date={date}&status=FT` | Completed fixtures | Forever | ~200 |

**Total estimated usage**: ~2,000 requests/month

---

## Scenarios

### Scenario 1: Successful API-Football Data Fetch

**Given:**
- API-Football is enabled (`ENABLE_API_FOOTBALL=true`)
- API-Football service is healthy
- Match exists in database with `id=123`

**When:**
```typescript
const factory = new DataProviderFactory()
const stats = await factory.getStatistics(123)
```

**Then:**
- ApiFootballProvider is tried first
- API request succeeds
- Statistics stored in database with `source='api-football'`
- Circuit breaker records success
- Returns normalized `MatchStatistics` object

**Validation:**
- `stats.source === 'api-football'`
- `stats.homeTeam.shots.total` is a number
- Database contains new `match_scraped_data` record with correct source

### Scenario 2: API-Football Fails, Fallback to Scraping

**Given:**
- API-Football is enabled
- API-Football service returns 500 error
- Match exists in database

**When:**
```typescript
const factory = new DataProviderFactory()
const stats = await factory.getStatistics(123)
```

**Then:**
- ApiFootballProvider fails
- Circuit breaker records failure
- WebScraperProvider is tried next
- Web scraper succeeds
- Statistics stored with `source='web-scraping'`
- Returns normalized `MatchStatistics` object

**Validation:**
- `stats.source === 'web-scraping'`
- Circuit breaker failure count increments
- User sees no error (transparent fallback)

### Scenario 3: Circuit Breaker Opens

**Given:**
- API-Football has failed 3 times consecutively
- Circuit breaker is now OPEN

**When:**
```typescript
const factory = new DataProviderFactory()
const stats = await factory.getStatistics(123)
```

**Then:**
- ApiFootballProvider is skipped (circuit OPEN)
- WebScraperProvider is tried first
- No API call to API-Football
- Circuit remains open for 5 minutes

**Validation:**
- No API-Football request logged
- Web scraping succeeds immediately
- Bugsnag alert sent: "Circuit breaker opened for ApiFootballProvider"

### Scenario 4: Feature Flag Disabled

**Given:**
- `ENABLE_API_FOOTBALL=false`

**When:**
```typescript
const factory = new DataProviderFactory()
const stats = await factory.getStatistics(123)
```

**Then:**
- ApiFootballProvider not registered
- Only WebScraperProvider and CachedDataProvider available
- Web scraper used immediately
- No API-Football calls made

**Validation:**
- Factory providers list excludes ApiFootballProvider
- Application works exactly as before integration

### Scenario 5: Team Matching with High Confidence

**Given:**
- Svenska Spel match has team "Manchester United" with `betRadar_id=123456`
- League is Premier League (`api_football_league_id=39`)

**When:**
```typescript
const matcher = new TeamMatcher(client)
const mapping = await matcher.matchTeam('Manchester United', 39, {
  betRadarId: '123456'
})
```

**Then:**
- Direct ID lookup finds team in API-Football
- Returns mapping with `confidence='high'`, `matchMethod='betradar_id'`
- Stores mapping in `team_mappings` table

**Validation:**
- `mapping.confidence === 'high'`
- `mapping.apiFootballTeamId` is valid
- Database contains new `team_mappings` record

### Scenario 6: Team Matching with Low Confidence

**Given:**
- Svenska Spel team "Östersund" (no external IDs)
- API-Football has "Östersunds FK" (similarity: 85%)

**When:**
```typescript
const matcher = new TeamMatcher(client)
const mapping = await matcher.matchTeam('Östersund', 113) // Allsvenskan
```

**Then:**
- Direct ID lookup fails (no betRadar/kambi ID)
- Fuzzy matching calculates 85% similarity
- Returns mapping with `confidence='medium'`
- Stores mapping with `verified=false` for admin review

**Validation:**
- `mapping.confidence === 'medium'`
- `mapping.similarity >= 0.80`
- Admin UI shows flagged match for review

---

## Boundaries

### What This Integration DOES

✅ Replace web scraping for fixture statistics, injuries, team stats
✅ Provide automatic team/league matching for all European leagues
✅ Add 3-5 years of historical data for similarity search
✅ Enable automatic result capture (daily sync)
✅ Provide circuit breaker fallback to web scraping
✅ Support feature flag for instant disable

### What This Integration DOES NOT

❌ Replace Svenska Spel API (still primary source for match list, odds)
❌ Replace Svenska Spel scraping for betting tips (Tio Tidningars Tips, Svenska Folket)
❌ Provide live match tracking (betting closes before matches start)
❌ Store API-Football data in separate tables (reuses `match_scraped_data`)
❌ Require manual team mapping for >95% of teams
❌ Break application if API-Football is unavailable (automatic fallback)

### Rate Limits & Quotas

- **Basic Plan**: 3,000 requests/day (~100/hour)
- **Implementation limit**: 2 requests/minute with 500ms delay
- **Circuit breaker**: Opens after 3 consecutive failures
- **Expected usage**: ~2,000 requests/month (well under quota)
- **Historical backfill**: Upgrade to Pro Plan ($30/month) during 6-month backfill

### Cache Strategy

| Data Type | TTL | Storage |
|-----------|-----|---------|
| League rosters | 24 hours | In-memory + database cache |
| Completed match statistics | Forever | Database only |
| Injuries | 1 hour (pre-match), 24 hours (post-match) | Database |
| Team statistics | 24 hours | Database |
| Standings | 24 hours | Database |
| Head-to-head | Forever | Database |

---

## Success Criteria

### Phase 1: Team/League Matching (Weeks 1-2)

✅ 95%+ teams matched with high confidence
✅ <5% teams flagged for manual review
✅ <100 API calls per draw
✅ Admin review takes <2 minutes per low-confidence team

### Phase 2: Pre-Match Enrichment (Weeks 3-4)

✅ 90%+ fixture statistics from API-Football
✅ 80%+ matches have injury data
✅ Prediction quality maintained or improved
✅ 0 scraper failures for API-covered data
✅ All data fetched >1 hour before betting deadline

### Phase 3: Historical Enrichment (Weeks 5-7+)

✅ 100K+ historical matches backfilled
✅ 3-5 years data per major league
✅ Similarity search includes historical patterns

### Phase 4: Post-Match Learning (Week 8+)

✅ 100% results captured within 24 hours
✅ Weekly performance reports generated
✅ Accuracy improves by 2-5% over 3 months

---

## References

- API-Football Documentation: https://www.api-football.com/documentation-v3
- Team Roster Optimization: https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id
- OpenSpec Framework: https://github.com/Fission-AI/OpenSpec
