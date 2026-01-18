# API-Football Integration - Loose Coupling Architecture

**Purpose**: Ensure the application continues functioning if API-Football shuts down, has outages, or needs to be disabled.

**Design Philosophy**: The prediction service depends on abstractions, never concrete implementations. Multiple data providers implement the same interface, enabling automatic fallback and zero-downtime migration.

---

## Table of Contents

1. [Provider Abstraction Layer](#provider-abstraction-layer)
2. [Data Provider Factory](#data-provider-factory)
3. [Circuit Breaker Pattern](#circuit-breaker-pattern)
4. [Feature Flags](#feature-flags)
5. [Source-Agnostic Storage](#source-agnostic-storage)
6. [Migration Path](#migration-path)
7. [Emergency Procedures](#emergency-procedures)
8. [Health Monitoring](#health-monitoring)

---

## Provider Abstraction Layer

### Core Interface

All data providers implement the same interface. The prediction service only depends on this interface, never on specific implementations.

```typescript
// server/services/data-provider/types.ts

/**
 * Abstract interface for match data providers
 * Implementations: ApiFootballProvider, WebScraperProvider, CachedDataProvider
 */
export interface MatchDataProvider {
  /** Provider name for logging */
  readonly name: string

  /** Priority order (lower = tried first) */
  readonly priority: number

  /**
   * Fetch fixture statistics (shots, possession, passes, etc.)
   */
  getStatistics(matchId: number): Promise<MatchStatistics>

  /**
   * Fetch current injuries for a team
   */
  getInjuries(teamId: number): Promise<PlayerInjury[]>

  /**
   * Fetch team statistics for current season
   */
  getTeamStats(teamId: number, season: number): Promise<TeamStatistics>

  /**
   * Fetch head-to-head history between two teams
   */
  getHeadToHead(team1: number, team2: number): Promise<HeadToHeadData>

  /**
   * Check if provider is healthy and responsive
   */
  isHealthy(): Promise<boolean>

  /**
   * Optional: Get cached data if available
   */
  getCachedData?(key: string): Promise<any>
}

/**
 * Normalized data structures (all providers return this format)
 */
export interface MatchStatistics {
  matchId: number
  homeTeam: TeamMatchStats
  awayTeam: TeamMatchStats
  source: 'api-football' | 'web-scraping' | 'cache'
  fetchedAt: Date
}

export interface TeamMatchStats {
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

export interface PlayerInjury {
  playerId: number
  playerName: string
  reason: string
  expectedReturn?: Date
  severity: 'minor' | 'moderate' | 'severe'
}

export interface TeamStatistics {
  teamId: number
  season: number
  form: string // e.g., "WWDLL"
  wins: number
  draws: number
  losses: number
  goalsFor: number
  goalsAgainst: number
  homeRecord: { wins: number; draws: number; losses: number }
  awayRecord: { wins: number; draws: number; losses: number }
}

export interface HeadToHeadData {
  team1Id: number
  team2Id: number
  lastMatches: HistoricalMatch[]
  team1Wins: number
  draws: number
  team2Wins: number
}

export interface HistoricalMatch {
  date: Date
  homeTeam: number
  awayTeam: number
  scoreHome: number
  scoreAway: number
  venue: string
}
```

### Benefits of Abstraction

1. **Swappable Implementations** - Change data source without touching prediction logic
2. **Testability** - Mock providers for unit tests
3. **Parallel Development** - Teams can work on different providers independently
4. **Zero Coupling** - Prediction service never imports API-Football or scraping code directly

---

## Data Provider Factory

### Factory Pattern with Automatic Fallback

The factory tries providers in priority order until one succeeds.

```typescript
// server/services/data-provider/factory.ts

import { MatchDataProvider } from './types'
import { ApiFootballProvider } from './api-football-provider'
import { WebScraperProvider } from './web-scraper-provider'
import { CachedDataProvider } from './cached-data-provider'

export class DataProviderFactory {
  private providers: MatchDataProvider[] = []
  private circuitBreakers: Map<string, CircuitBreaker> = new Map()

  constructor() {
    // Feature flag to enable/disable API-Football
    const useApiFootball = process.env.ENABLE_API_FOOTBALL === 'true'

    // Register providers in priority order
    if (useApiFootball) {
      this.providers.push(new ApiFootballProvider())
    }
    this.providers.push(new WebScraperProvider())
    this.providers.push(new CachedDataProvider())

    // Sort by priority (lower = tried first)
    this.providers.sort((a, b) => a.priority - b.priority)

    // Initialize circuit breakers for each provider
    this.providers.forEach(provider => {
      this.circuitBreakers.set(provider.name, new CircuitBreaker(provider.name))
    })
  }

  /**
   * Fetch statistics with automatic fallback
   */
  async getStatistics(matchId: number): Promise<MatchStatistics> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      const breaker = this.circuitBreakers.get(provider.name)!

      // Skip if circuit breaker is open (provider recently failed)
      if (breaker.isOpen()) {
        console.warn(`[DataProvider] Circuit breaker OPEN for ${provider.name}, skipping...`)
        continue
      }

      try {
        console.log(`[DataProvider] Trying ${provider.name} for match ${matchId}...`)
        const result = await provider.getStatistics(matchId)

        // Success! Record success and return
        breaker.recordSuccess()
        console.log(`[DataProvider] ✅ ${provider.name} succeeded`)
        return result

      } catch (error) {
        // Record failure in circuit breaker
        breaker.recordFailure()
        errors.push(error as Error)
        console.warn(`[DataProvider] ❌ ${provider.name} failed: ${error.message}`)

        // Continue to next provider
        continue
      }
    }

    // All providers failed
    throw new Error(
      `All data providers failed for match ${matchId}. Errors: ${
        errors.map(e => e.message).join(', ')
      }`
    )
  }

  /**
   * Fetch injuries with automatic fallback
   */
  async getInjuries(teamId: number): Promise<PlayerInjury[]> {
    const errors: Error[] = []

    for (const provider of this.providers) {
      const breaker = this.circuitBreakers.get(provider.name)!

      if (breaker.isOpen()) continue

      try {
        const result = await provider.getInjuries(teamId)
        breaker.recordSuccess()
        return result
      } catch (error) {
        breaker.recordFailure()
        errors.push(error as Error)
        continue
      }
    }

    throw new Error(`All providers failed for injuries: ${errors.map(e => e.message).join(', ')}`)
  }

  /**
   * Similar implementations for getTeamStats() and getHeadToHead()
   */

  /**
   * Get health status of all providers
   */
  async getProviderHealth(): Promise<ProviderHealthReport[]> {
    const reports: ProviderHealthReport[] = []

    for (const provider of this.providers) {
      const breaker = this.circuitBreakers.get(provider.name)!
      const isHealthy = await provider.isHealthy()

      reports.push({
        name: provider.name,
        priority: provider.priority,
        healthy: isHealthy,
        circuitBreakerOpen: breaker.isOpen(),
        failureCount: breaker.getFailureCount(),
        lastChecked: new Date()
      })
    }

    return reports
  }
}

export interface ProviderHealthReport {
  name: string
  priority: number
  healthy: boolean
  circuitBreakerOpen: boolean
  failureCount: number
  lastChecked: Date
}
```

### Usage in Prediction Service

```typescript
// server/services/prediction-service.ts

import { DataProviderFactory } from './data-provider/factory'

export class PredictionService {
  private dataProvider: DataProviderFactory

  constructor() {
    this.dataProvider = new DataProviderFactory()
  }

  async prepareMatchContext(match: Match): Promise<string> {
    // Fetch statistics - automatically tries API-Football first, falls back to scraping
    const statistics = await this.dataProvider.getStatistics(match.id)

    // Fetch injuries - same automatic fallback
    const homeInjuries = await this.dataProvider.getInjuries(match.homeTeamId)
    const awayInjuries = await this.dataProvider.getInjuries(match.awayTeamId)

    // Prediction service never knows which provider was used!
    // It just gets normalized data structures

    return `
      Match: ${match.homeTeam} vs ${match.awayTeam}

      Statistics:
        Home Shots: ${statistics.homeTeam.shots.total}
        Away Shots: ${statistics.awayTeam.shots.total}
        Data Source: ${statistics.source}

      Injuries:
        Home: ${homeInjuries.map(i => i.playerName).join(', ')}
        Away: ${awayInjuries.map(i => i.playerName).join(', ')}
    `
  }
}
```

**Key Point**: The prediction service has ZERO knowledge of API-Football or web scraping. It only knows about the `DataProviderFactory` interface.

---

## Circuit Breaker Pattern

### Prevents Cascading Failures

If a provider fails 3 times consecutively, the circuit breaker "opens" and that provider is skipped for 5 minutes. This prevents slow/failing providers from blocking the entire request.

```typescript
// server/services/data-provider/circuit-breaker.ts

export class CircuitBreaker {
  private failureCount: number = 0
  private lastFailureTime: Date | null = null
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED'

  private readonly FAILURE_THRESHOLD = 3
  private readonly TIMEOUT_MS = 5 * 60 * 1000 // 5 minutes

  constructor(private providerName: string) {}

  /**
   * Check if circuit breaker is open (provider should be skipped)
   */
  isOpen(): boolean {
    if (this.state === 'CLOSED') {
      return false
    }

    // Check if timeout has passed
    if (this.lastFailureTime) {
      const elapsed = Date.now() - this.lastFailureTime.getTime()

      if (elapsed > this.TIMEOUT_MS) {
        // Try again (half-open state)
        console.log(`[CircuitBreaker] ${this.providerName}: Timeout elapsed, trying again...`)
        this.state = 'HALF_OPEN'
        return false
      }
    }

    return true
  }

  /**
   * Record successful request
   */
  recordSuccess(): void {
    if (this.state === 'HALF_OPEN') {
      console.log(`[CircuitBreaker] ${this.providerName}: Success after half-open, closing circuit`)
    }

    this.failureCount = 0
    this.lastFailureTime = null
    this.state = 'CLOSED'
  }

  /**
   * Record failed request
   */
  recordFailure(): void {
    this.failureCount++
    this.lastFailureTime = new Date()

    if (this.failureCount >= this.FAILURE_THRESHOLD) {
      console.error(
        `[CircuitBreaker] ${this.providerName}: Threshold reached (${this.failureCount} failures), OPENING circuit`
      )
      this.state = 'OPEN'

      // Alert via Bugsnag
      Bugsnag.notify(new Error(`Circuit breaker opened for ${this.providerName}`), event => {
        event.severity = 'warning'
        event.addMetadata('circuit_breaker', {
          provider: this.providerName,
          failureCount: this.failureCount,
          lastFailure: this.lastFailureTime
        })
      })
    }
  }

  getFailureCount(): number {
    return this.failureCount
  }

  getState(): string {
    return this.state
  }
}
```

### Circuit Breaker States

1. **CLOSED** (Normal) - Provider is healthy, requests pass through
2. **OPEN** (Failed) - Provider has failed 3+ times, requests are blocked for 5 minutes
3. **HALF_OPEN** (Testing) - After timeout, allow 1 request to test if provider recovered

**Example Flow:**
```
API-Football fails 3 times → Circuit OPENS → Skip API-Football for 5 minutes
  ↓
Use Web Scraper (automatic fallback)
  ↓
After 5 minutes → Circuit HALF_OPEN → Try API-Football once
  ↓
If success → Circuit CLOSED (back to normal)
If failure → Circuit OPEN again for another 5 minutes
```

---

## Feature Flags

### Instant Enable/Disable via Environment Variable

```bash
# .env

# Enable API-Football integration
ENABLE_API_FOOTBALL=true

# Disable API-Football (fallback to scraping only)
# ENABLE_API_FOOTBALL=false
```

### Emergency Rollback

If API-Football starts causing issues in production:

1. **Immediate fix**: Set `ENABLE_API_FOOTBALL=false` in .env
2. **Restart app**: API-Football provider won't be registered
3. **Automatic fallback**: Web scraper becomes primary data source
4. **No code changes needed**: Just flip the environment variable

### Feature Flag Implementation

```typescript
// server/services/data-provider/factory.ts

constructor() {
  // Check feature flag
  const useApiFootball = process.env.ENABLE_API_FOOTBALL === 'true'

  if (useApiFootball) {
    console.log('[DataProvider] API-Football ENABLED')
    this.providers.push(new ApiFootballProvider())
  } else {
    console.log('[DataProvider] API-Football DISABLED, using scraping only')
  }

  // Web scraper always registered as fallback
  this.providers.push(new WebScraperProvider())
}
```

---

## Source-Agnostic Storage

### Database Stores Data Without Caring About Origin

The application stores enriched match data in the database with a `source` field. The prediction service reads from the database without knowing where the data came from.

```sql
-- Add source tracking to existing table
ALTER TABLE match_scraped_data
  ADD COLUMN source VARCHAR(50) DEFAULT 'web-scraping',
  ADD COLUMN is_stale BOOLEAN DEFAULT false,
  ADD COLUMN fetched_at TIMESTAMP DEFAULT NOW();
```

### Storage Pattern

```typescript
// After fetching data from any provider
async function storeMatchStatistics(matchId: number, stats: MatchStatistics): Promise<void> {
  await prisma.matchScrapedData.create({
    data: {
      matchId: matchId,
      dataType: 'statistics',
      rawData: stats,
      source: stats.source, // 'api-football' or 'web-scraping'
      fetchedAt: new Date(),
      isStale: false
    }
  })
}

// Prediction service reads from database
async function getMatchStatistics(matchId: number): Promise<MatchStatistics | null> {
  const record = await prisma.matchScrapedData.findFirst({
    where: {
      matchId: matchId,
      dataType: 'statistics',
      isStale: false // Only get fresh data
    },
    orderBy: { fetchedAt: 'desc' }
  })

  // Don't care about source, just use the data
  return record?.rawData as MatchStatistics
}
```

### Benefits

1. **Provider agnostic** - App doesn't care if data came from API or scraping
2. **Seamless migration** - Can switch sources without changing prediction logic
3. **Audit trail** - Track which provider was used for debugging
4. **Fallback persistence** - If API fails, scraping data is stored the same way

---

## Migration Path

### Gradual Rollout Strategy

**Phase 1: Dual-Write (Week 1)**
```
Match Data Needed
  ↓
Fetch from API-Football → Store with source='api-football'
  AND
Fetch from Web Scraping → Store with source='web-scraping'
  ↓
Prediction uses Web Scraping (current behavior)
```
*Purpose*: Build confidence in API-Football data quality without affecting production predictions

**Phase 2: Primary with Fallback (Week 2)**
```
Match Data Needed
  ↓
Try API-Football first → If success, use it
  ↓
If API-Football fails → Fallback to Web Scraping
  ↓
Prediction uses whichever source succeeded
```
*Purpose*: API-Football becomes primary, scraping is safety net

**Phase 3: API Primary, Scraper on Standby (Week 3+)**
```
Match Data Needed
  ↓
API-Football (95%+ success rate)
  ↓
Circuit breaker opens only if 3+ consecutive failures
  ↓
Web Scraping dormant unless circuit breaker activates
```
*Purpose*: Normal production operation

**Phase 4: Emergency Rollback Capability (Always)**
```
If API-Football Issues Detected:
  1. Set ENABLE_API_FOOTBALL=false
  2. Restart application
  3. Web Scraping becomes primary again
  4. No data loss, no prediction failures
```
*Purpose*: Instant rollback if needed

### Migration Code Example

```typescript
// Phase 1: Dual-write for validation
async function phase1_dualWrite(matchId: number): Promise<void> {
  // Fetch from both sources
  const [apiStats, scrapedStats] = await Promise.allSettled([
    apiFootballProvider.getStatistics(matchId),
    webScraperProvider.getStatistics(matchId)
  ])

  // Store both for comparison
  if (apiStats.status === 'fulfilled') {
    await storeMatchStatistics(matchId, apiStats.value)
  }
  if (scrapedStats.status === 'fulfilled') {
    await storeMatchStatistics(matchId, scrapedStats.value)
  }

  // Compare data quality (log differences)
  if (apiStats.status === 'fulfilled' && scrapedStats.status === 'fulfilled') {
    compareDataQuality(apiStats.value, scrapedStats.value)
  }
}

// Phase 2: Primary with fallback (automatic via factory)
// No code changes needed - factory handles fallback automatically!
```

---

## Emergency Procedures

### Scenario 1: API-Football is Down

**Detection:**
- Circuit breaker opens after 3 consecutive failures
- Bugsnag alert: "Circuit breaker opened for ApiFootballProvider"
- Health check endpoint shows API-Football unhealthy

**Automatic Response:**
1. Circuit breaker blocks API-Football requests for 5 minutes
2. DataProviderFactory automatically uses WebScraperProvider
3. Predictions continue working (users see no disruption)
4. After 5 minutes, circuit tries API-Football again

**Manual Intervention (if needed):**
```bash
# If API-Football is down for >1 hour, disable it completely
export ENABLE_API_FOOTBALL=false
pm2 restart st-predictor
```

### Scenario 2: API-Football Quota Exceeded

**Detection:**
- API returns 429 (Too Many Requests)
- Quota tracking shows >95% of daily limit used

**Automatic Response:**
1. Rate limiter blocks new API-Football requests
2. Existing cached data used where possible
3. WebScraperProvider handles new requests

**Manual Intervention:**
```bash
# Temporarily disable API-Football to preserve quota
export ENABLE_API_FOOTBALL=false
pm2 restart st-predictor

# Or upgrade plan if needed
# Update .env with new API key
```

### Scenario 3: API-Football Data Quality Issues

**Detection:**
- Predictions quality drops unexpectedly
- Data validation checks fail
- Manual review identifies incorrect data

**Response:**
```bash
# Rollback to scraping immediately
export ENABLE_API_FOOTBALL=false
pm2 restart st-predictor

# Investigate API-Football data
# Fix team mappings if needed
# Re-enable after fix
```

### Scenario 4: API-Football Shuts Down Permanently

**Long-term Response:**
1. Set `ENABLE_API_FOOTBALL=false` permanently
2. Remove API-Football provider from codebase (optional)
3. Keep provider abstraction layer (future-proof for new APIs)
4. Continue with web scraping indefinitely

**No data loss**: Historical data from API-Football remains in database with `source='api-football'`

---

## Health Monitoring

### Provider Health Check Endpoint

```typescript
// server/api/admin/health/data-providers.get.ts

export default defineEventHandler(async (event) => {
  const factory = new DataProviderFactory()
  const healthReports = await factory.getProviderHealth()

  return {
    timestamp: new Date(),
    providers: healthReports,
    overallHealth: healthReports.every(p => p.healthy) ? 'HEALTHY' : 'DEGRADED'
  }
})
```

**Response Example:**
```json
{
  "timestamp": "2026-01-17T10:30:00Z",
  "providers": [
    {
      "name": "ApiFootballProvider",
      "priority": 1,
      "healthy": true,
      "circuitBreakerOpen": false,
      "failureCount": 0,
      "lastChecked": "2026-01-17T10:30:00Z"
    },
    {
      "name": "WebScraperProvider",
      "priority": 2,
      "healthy": true,
      "circuitBreakerOpen": false,
      "failureCount": 0,
      "lastChecked": "2026-01-17T10:30:00Z"
    }
  ],
  "overallHealth": "HEALTHY"
}
```

### Monitoring Dashboard (Optional)

Admin UI showing:
- ✅ API-Football: Healthy (Circuit: CLOSED)
- ✅ Web Scraping: Healthy (Circuit: CLOSED)
- 📊 Last 24h: 1,234 requests (95% API-Football, 5% fallback)
- 💰 API Usage: 1,850 / 3,000 daily quota (62%)

### Alerts Configuration

```typescript
// Monitor circuit breaker state
if (circuitBreaker.getState() === 'OPEN') {
  Bugsnag.notify(new Error(`Circuit breaker opened for ${provider.name}`), event => {
    event.severity = 'warning'
  })
}

// Monitor API quota
if (apiUsage > QUOTA_THRESHOLD * 0.95) {
  Bugsnag.notify(new Error('API-Football quota at 95%'), event => {
    event.severity = 'error'
  })
}

// Monitor data freshness
if (dataAge > 24 * 60 * 60 * 1000) {
  Bugsnag.notify(new Error('Match data is stale'), event => {
    event.severity = 'warning'
  })
}
```

---

## Summary

### Architecture Guarantees

✅ **App never stops working** - Automatic fallback to web scraping
✅ **Zero-downtime migration** - Gradual rollout with dual-write phase
✅ **Instant rollback** - One environment variable disables API-Football
✅ **No coupling** - Prediction service depends only on interface, not implementation
✅ **Future-proof** - Easy to add new providers (e.g., different API in future)

### Key Design Principles

1. **Depend on abstractions, not concretions** - Provider interface, never specific provider
2. **Fail gracefully** - Circuit breaker prevents cascading failures
3. **Monitor everything** - Health checks, alerts, quota tracking
4. **Make rollback easy** - Feature flags, emergency procedures documented
5. **Store agnostically** - Database doesn't care about data source

### What Happens if API-Football Shuts Down?

1. **Immediate (automatic)**: Circuit breaker opens → Web scraping takes over
2. **Short-term (manual)**: Disable feature flag → Permanent fallback to scraping
3. **Long-term (optional)**: Remove API-Football code → Keep abstraction layer for future

**Bottom line**: Your app is resilient and will continue making predictions regardless of API-Football's availability. The prediction service never knows the difference! 🚀
