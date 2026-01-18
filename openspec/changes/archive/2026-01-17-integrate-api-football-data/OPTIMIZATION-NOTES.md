# API-Football Optimization Notes

## Key Finding: Efficient Team Roster Retrieval

**Source**: [How to Get All Teams and Players from a League ID](https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id)

### Critical Insight

The `/teams?league={id}&season={year}` endpoint returns **ALL teams in a league in a single API call** with no pagination required!

### Impact on Our Implementation

#### Before (Initial Assumption)
```typescript
// Thought we needed to search for each team individually
for (const match of matches) {
  const homeTeam = await api.get('/teams', { params: { search: match.homeTeam } })  // 1 call
  const awayTeam = await api.get('/teams', { params: { search: match.awayTeam } })  // 1 call
}
// Cost: 2 API calls per match × 13 matches = 26 calls per draw
```

#### After (Optimized)
```typescript
// Fetch entire league roster once and cache
const leagueTeams = await api.get('/teams', {
  params: { league: premierLeagueId, season: 2024 }
})  // 1 call for ~20 teams
await cache.set(`league:${premierLeagueId}:2024`, leagueTeams, { ttl: 86400 }) // 24h cache

// Then match locally (zero API calls!)
for (const match of matches) {
  const homeTeam = findTeamInCache(match.homeTeam, leagueTeams)  // Local search
  const awayTeam = findTeamInCache(match.awayTeam, leagueTeams)  // Local search
}
// Cost: 1 API call per league (15-20 leagues total) = 15-20 calls ONCE, then all local!
```

### Revised API Usage Calculation

#### Initial League Roster Caching
| Activity | Calls | Frequency | Monthly |
|----------|-------|-----------|---------|
| Cache Premier League roster | 1 | Once per day | 30 |
| Cache La Liga roster | 1 | Once per day | 30 |
| Cache Bundesliga roster | 1 | Once per day | 30 |
| ... 12 more leagues | 12 | Once per day | 360 |
| **Total for roster caching** | **15** | **Daily** | **~450** |

#### Team Matching After Cache
| Activity | Calls | Frequency | Monthly |
|----------|-------|-----------|---------|
| Match teams for each draw | **0** | N/A | **0** |
| All matching is local! | - | - | - |

**Savings**: ~800 API calls/month vs original estimate!

### Updated Monthly Usage Estimate

| Activity | Original Estimate | Optimized Estimate | Savings |
|----------|-------------------|-------------------|---------|
| Team/league matching | 400 | 450 (roster cache only) | N/A |
| Team name matching | 400 | 0 (cached, local) | -400 |
| Fixture statistics | 500 | 500 | 0 |
| Injuries & lineups | 400 | 400 | 0 |
| Team stats | 40 | 40 | 0 |
| Standings | 15 | 15 | 0 |
| H2H | 50 | 50 | 0 |
| Result sync | 200 | 200 | 0 |
| Buffer (20%) | 320 | 260 | -60 |
| **Total** | **~2,000** | **~1,900** | **-100** |

**Result**: Even more headroom under Basic Plan quota (3,000/day), even lower cost!

## Implementation Best Practices from Article

### 1. Rate Limiting Strategy

**From API-Football Docs**:
> "Delay certain calls to the API in order not to have errors **429 - Too Many Requests**"

**Our Implementation**:
```typescript
// Add delay between sequential non-cached calls
async function fetchWithDelay(url: string, params: any, delayMs = 500) {
  const result = await apiClient.get(url, { params })
  await sleep(delayMs) // Prevent rate limit errors
  return result
}

// For 429 errors, use exponential backoff
async function retryWith429Handling(fn: Function) {
  const backoffs = [30000, 60000, 120000] // 30s, 60s, 120s
  for (const backoff of backoffs) {
    try {
      return await fn()
    } catch (err) {
      if (err.response?.status === 429) {
        console.warn(`Rate limited, waiting ${backoff}ms...`)
        await sleep(backoff)
      } else {
        throw err
      }
    }
  }
}
```

### 2. Recursive Pagination for Players (Future Enhancement)

While `/teams` doesn't need pagination, `/players` endpoint does (20 per page).

**From API-Football Docs**:
> "Implement a recursive function that automatically detects pagination status and continues fetching until reaching the last page."

**Our Implementation** (if we add player data later):
```typescript
async function fetchAllPlayers(leagueId: number, season: number, page = 1): Promise<Player[]> {
  const response = await apiClient.get('/players', {
    params: { league: leagueId, season, page }
  })

  const players = response.data.response

  // Check if more pages exist
  if (response.data.paging.current < response.data.paging.total) {
    // Recursive call with delay to avoid rate limits
    await sleep(500)
    const nextPlayers = await fetchAllPlayers(leagueId, season, page + 1)
    return [...players, ...nextPlayers]
  }

  return players
}
```

### 3. Modular API Client

**From API-Football Docs**:
> "Create a reusable API call function separate from business logic for better maintainability."

**Our Implementation**:
```typescript
// server/services/api-football-client.ts
export class ApiFootballClient {
  async get(endpoint: string, params: any) {
    // Rate limiting, caching, error handling
  }
}

// server/services/api-football/team-matcher.ts
export class TeamMatcher {
  constructor(private client: ApiFootballClient) {}

  async matchTeam(teamName: string, leagueId: number) {
    // Business logic for matching
    const teams = await this.client.get('/teams', { league: leagueId })
    return this.fuzzyMatch(teamName, teams)
  }
}
```

### 4. Coverage Verification

**From API-Football Docs**:
> "Check the leagues endpoint documentation to confirm data availability for your target competition before making requests."

**Our Implementation**:
```typescript
// Before processing a draw, verify league coverage
async function verifyLeagueCoverage(leagueId: number) {
  const league = await apiClient.get('/leagues', { id: leagueId })

  // Check coverage flags
  const coverage = league.seasons[0].coverage
  if (!coverage.fixtures.statistics_fixtures) {
    console.warn(`League ${leagueId} does not have fixture statistics coverage`)
    return false // Fall back to scraping
  }

  return true
}
```

## Key Takeaways

1. **Teams endpoint is highly optimized** - One call gets all teams in a league
2. **Cache aggressively** - League rosters don't change often (24-hour TTL is safe)
3. **Rate limiting is critical** - Add delays between calls, handle 429 errors gracefully
4. **Verify coverage** - Not all leagues have all data types, check before fetching
5. **Modular design** - Separate API client from business logic for testability

## Impact on Proposal

✅ **Lower API usage** - ~1,900 calls/month vs 2,000 estimate
✅ **Faster matching** - After initial cache, all matching is instant (local search)
✅ **More reliable** - Fewer API calls = lower chance of rate limits
✅ **Better UX** - Near-instant team matching after initial warm-up

**No changes needed to overall strategy**, just implementation optimizations that make it even better! 🎉

---

**References**:
- [API-Football: How to Get All Teams and Players from a League ID](https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id)
- [API-Football Documentation](https://www.api-football.com/documentation-v3)
