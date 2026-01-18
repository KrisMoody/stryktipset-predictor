# Tasks: Integrate API-Football Data Sources

> **OpenSpec Note:** This document describes **HOW** to implement this change. For **WHY** (business case), see [proposal.md](proposal.md). For **WHAT** (interface specs), see [spec.md](spec.md).

**Change ID**: `integrate-api-football-data`
**Status**: Proposed
**Date**: 2026-01-17

---

## Revision History

**Revised Based on User Feedback:**
- ❌ Removed live match tracking (not needed - betting stops before games)
- ✅ Added automatic team/league identification as Phase 1 (critical for European coverage)
- ✅ Prioritized historical data enrichment (Phase 3)
- ✅ Simplified to pre-match data only (lower API usage, lower cost)
- ✅ Added loose coupling architecture (provider abstraction pattern)

---

## Phase 1: Automatic Team/League Identification (Weeks 1-2)

### 1.1 Project Setup & Configuration
- [ ] Sign up for API-Football Basic Plan ($10/month initially)
- [ ] Add `API_FOOTBALL_API_KEY` to environment variables
- [ ] Add `API_FOOTBALL_BASE_URL=https://v3.football.api-sports.io/` to config
- [ ] Document API credentials in [docs/ENV_SETUP.md](docs/ENV_SETUP.md)
- [ ] Create rate limiting configuration (3,000 req/day Basic = ~2 req/min sustained)

**Validation**: API key works with `/status` endpoint, rate limits configured

### 1.2 API-Football Client Service
- [ ] Create [server/services/api-football-client.ts](server/services/api-football-client.ts)
- [ ] Implement axios-based HTTP client with headers (`x-apisports-key`)
- [ ] Add request/response logging with Bugsnag context
- [ ] Implement rate limiting (2 requests/minute for Basic plan safety margin)
  - **Important**: Add delays between requests to avoid 429 errors
  - Reference: API-Football recommends delays on odd-numbered pages for pagination
  - Our case: Add 500ms-1s delay between sequential non-cached calls
- [ ] Add retry logic with exponential backoff (max 3 retries, 1s/2s/4s delays)
  - Handle 429 (Too Many Requests) with longer backoff (30s/60s/120s)
- [ ] Create in-memory response cache with TTL support
- [ ] Implement circuit breaker for API failures (fallback after 3 consecutive errors)
- [ ] Add fallback flag: when circuit opens, use web scraping instead

**Validation**: Successfully fetch from `/status`, `/countries`, `/leagues` endpoints

### 1.3 Database Schema for Team/League Mapping
- [ ] Create `team_mappings` table:
  ```sql
  CREATE TABLE team_mappings (
    id SERIAL PRIMARY KEY,
    svenska_spel_team_id INT NOT NULL REFERENCES teams(id),
    api_football_team_id INT NOT NULL,
    confidence VARCHAR(10) NOT NULL, -- 'high', 'medium', 'low'
    match_method VARCHAR(50), -- 'betradar_id', 'kambi_id', 'fuzzy_match', 'manual'
    betradar_id VARCHAR(100),
    kambi_id VARCHAR(100),
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(svenska_spel_team_id)
  );
  ```

- [ ] Create `league_mappings` table:
  ```sql
  CREATE TABLE league_mappings (
    id SERIAL PRIMARY KEY,
    svenska_spel_league_id INT NOT NULL REFERENCES leagues(id),
    api_football_league_id INT NOT NULL,
    confidence VARCHAR(10) NOT NULL,
    match_method VARCHAR(50),
    verified BOOLEAN DEFAULT false,
    verified_by VARCHAR(255),
    verified_at TIMESTAMP,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    UNIQUE(svenska_spel_league_id)
  );
  ```

- [ ] Create `unmapped_teams` table for review:
  ```sql
  CREATE TABLE unmapped_teams (
    id SERIAL PRIMARY KEY,
    svenska_spel_team_id INT NOT NULL REFERENCES teams(id),
    team_name VARCHAR(255) NOT NULL,
    league_name VARCHAR(255),
    country_name VARCHAR(255),
    betradar_id VARCHAR(100),
    kambi_id VARCHAR(100),
    attempted_at TIMESTAMP DEFAULT NOW(),
    retry_count INT DEFAULT 0,
    notes TEXT,
    resolved BOOLEAN DEFAULT false
  );
  ```

**Validation**: Database migrations run successfully, tables exist

### 1.4 League Matching Service
- [ ] Create [server/services/api-football/league-matcher.ts](server/services/api-football/league-matcher.ts)
- [ ] Implement `/leagues?country=X` integration
- [ ] Cache all leagues from API-Football (one-time fetch, 30-day TTL)
- [ ] Create league matching algorithm:
  1. Exact name match (case-insensitive)
  2. Fuzzy match on name + country (Levenshtein distance)
  3. Manual override lookup in `league_mappings`
- [ ] Calculate confidence score:
  - High (95%+): Exact match or verified manual mapping
  - Medium (80-95%): Fuzzy match with similarity >80%
  - Low (<80%): Best guess, needs review
- [ ] Store all matches in `league_mappings` with confidence + method

**Validation**: Match 10 common leagues (Premier League, La Liga, Bundesliga, etc.) with high confidence

### 1.5 Team Matching Service
- [ ] Create [server/services/api-football/team-matcher.ts](server/services/api-football/team-matcher.ts)
- [ ] Implement multi-strategy matching:

**Strategy 1: Direct ID Lookup**
- [ ] Check if Svenska Spel match has `betRadar_id` or `kambi_id`
- [ ] Use `/teams?search={id}` to find team by external ID
- [ ] Mark as high confidence if found

**Strategy 2: Fuzzy Text Matching (Optimized)**
- [ ] **Key Optimization**: `/teams?league={id}&season={year}` returns ALL teams in ONE call!
  - No pagination needed for teams endpoint
  - Reference: https://www.api-football.com/news/post/how-to-get-all-teams-and-players-from-a-league-id
- [ ] Implement league roster cache:
  ```typescript
  // One-time fetch per league
  const teams = await apiFootballClient.get('/teams', {
    params: { league: leagueId, season: currentSeason }
  })
  // Cache for 24 hours (teams don't change often mid-season)
  await cache.set(`league_roster:${leagueId}:${currentSeason}`, teams, { ttl: 86400 })
  ```
- [ ] Fetch all teams for matched league: `/teams?league={api_football_league_id}&season={current_season}`
- [ ] Cache league rosters (24-hour TTL)
- [ ] **Benefit**: After initial cache, all team matching is local (zero API calls!)
- [ ] Fuzzy match on team name within league context:
  - Normalize names: lowercase, remove accents, trim whitespace
  - Handle common variations: "Man Utd" → "Manchester United"
  - Calculate Levenshtein distance
  - Score match: similarity = 1 - (distance / max_length)
- [ ] Accept match if similarity >80%

**Strategy 3: Manual Override**
- [ ] Check `team_mappings` table for manual overrides
- [ ] If override exists and verified, use it (high confidence)

**Confidence Calculation:**
- [ ] High (95%+): Direct ID match or verified manual override
- [ ] Medium (80-95%): Fuzzy match similarity 80-95%
- [ ] Low (<80%): Best fuzzy match <80%, needs review

- [ ] Store all matches in `team_mappings` table
- [ ] Store failed matches in `unmapped_teams` for review

**Validation**: Test with 3 recent draws (Stryktipset + Europatipset), achieve 95%+ high-confidence matches

### 1.6 Admin Review UI for Low-Confidence Matches
- [ ] Create admin page: [pages/admin/team-mappings.vue](pages/admin/team-mappings.vue)
- [ ] Display `unmapped_teams` table with:
  - Svenska Spel team name
  - League/country context
  - Best API-Football match candidates (top 3 by similarity)
  - Action buttons: Confirm, Override, Mark as Unmappable
- [ ] Implement manual override workflow:
  - Admin selects correct API-Football team
  - System stores in `team_mappings` as verified
  - Mark `unmapped_teams` entry as resolved
- [ ] Add search/filter by game type, league, confidence

**Validation**: Admin can review and correct low-confidence matches in <2 minutes per team

### 1.7 Matching Integration with Draw Sync
- [ ] Update [server/services/draw-sync.ts](server/services/draw-sync.ts)
- [ ] After Svenska Spel sync completes, trigger team/league matching:
  ```typescript
  for (const match of newMatches) {
    // Match league
    const leagueMapping = await leagueMatcher.match(match.league_id)

    // Match teams
    const homeMapping = await teamMatcher.match(match.home_team_id, leagueMapping.api_football_league_id)
    const awayMapping = await teamMatcher.match(match.away_team_id, leagueMapping.api_football_league_id)

    // Store mappings
    await prisma.matches.update({
      where: { id: match.id },
      data: {
        api_football_league_id: leagueMapping.api_football_league_id,
        api_football_home_team_id: homeMapping.api_football_team_id,
        api_football_away_team_id: awayMapping.api_football_team_id,
        mapping_confidence: calculateOverallConfidence([leagueMapping, homeMapping, awayMapping])
      }
    })
  }
  ```
- [ ] Add `api_football_league_id`, `api_football_home_team_id`, `api_football_away_team_id`, `mapping_confidence` columns to `matches` table
- [ ] Log low-confidence matches for admin review

**Validation**: Draw sync automatically matches all teams/leagues, flags <5% for review

### 1.8 Caching Infrastructure
- [ ] Create [server/services/api-football/cache-service.ts](server/services/api-football/cache-service.ts)
- [ ] Implement in-memory cache with TTL:
  - Leagues: 30-day TTL (static data)
  - League rosters (team lists): 24-hour TTL (changes with transfers, but rare)
  - Fixture statistics: Cache forever after match completion
  - Injuries: 1-hour TTL before matches, 24-hour after
  - Team statistics: 24-hour TTL
  - Standings: 24-hour TTL
  - H2H matchups: Cache forever (historical data)
- [ ] Add cache warming: Pre-fetch common leagues on app startup
- [ ] Implement cache invalidation for time-based expiry

**Validation**: Cache hit rate >70% after 1 week of operation

### 1.9 API Usage Tracking
- [ ] Create `api_football_usage` table:
  ```sql
  CREATE TABLE api_football_usage (
    id SERIAL PRIMARY KEY,
    endpoint VARCHAR(255) NOT NULL,
    params JSONB,
    status_code INT,
    response_time_ms INT,
    cached BOOLEAN DEFAULT false,
    cost_estimate DECIMAL(10, 6),
    created_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Implement usage tracking middleware in API client
- [ ] Track all requests (including cache hits/misses)
- [ ] Create daily usage summary view (dashboard or admin endpoint)
- [ ] Implement quota alerting at 80%, 90%, 95% of daily limit (2,400/2,700/2,850 for Basic)
- [ ] Send Bugsnag alerts when quota warnings triggered

**Validation**: Track 100% of API requests, receive alerts at thresholds

### 1.10 Phase 1 Testing & Validation
- [ ] Test with 3 recent draws from each game type:
  - Stryktipset (13 matches, typically 10-12 European leagues)
  - Europatipset (13 matches, primarily top European leagues)
  - Topptipset (8 matches, mixed leagues)
- [ ] Measure matching success rate:
  - Target: 95%+ teams matched with high confidence
  - Target: 90%+ teams matched with medium+ confidence
  - Target: <5% unmapped teams requiring review
- [ ] Validate mapping quality:
  - Manual spot-check 20 random matches
  - Verify team names match expected
  - Check league context is correct
- [ ] Monitor API usage:
  - Confirm <100 API calls per draw (well under daily quota)
  - Verify cache hit rate >50% for repeat teams/leagues

**Validation**: 95%+ matching success, <100 API calls per draw, admin reviews <5% of teams

## Phase 2: Pre-Match Data Enrichment (Weeks 3-4)

### 2.1 Fixture Statistics Service
- [ ] Create [server/services/api-football/fixture-statistics.ts](server/services/api-football/fixture-statistics.ts)
- [ ] Implement `/fixtures/statistics` integration
- [ ] Fetch statistics for recent matches (last 5 per team) to show form
- [ ] Normalize API response to match `match_scraped_data` schema:
  ```typescript
  {
    data_type: 'statistics',
    data: {
      homeTeam: {
        shots: { total, on_target },
        possession: '58%',
        passes: { total, accurate, accuracy: '88%' },
        fouls: 12,
        corners: 7,
        // ... other stats
      },
      awayTeam: { /* same structure */ }
    },
    source: 'api-football',
    scraped_at: new Date()
  }
  ```
- [ ] Store in `match_scraped_data` table with `data_type='statistics'`
- [ ] Cache completed match statistics forever (immutable)

**Validation**: Fetch statistics for completed match, verify data structure matches expected format

### 2.2 Match Events Service
- [ ] Implement `/fixtures/events` integration
- [ ] Fetch goals, cards, substitutions for completed matches
- [ ] Store in structured format:
  ```typescript
  {
    data_type: 'events',
    data: {
      goals: [{ minute, team, player, type: 'Normal Goal' }],
      cards: [{ minute, team, player, type: 'Yellow Card' }],
      substitutions: [{ minute, team, playerOut, playerIn }]
    },
    source: 'api-football'
  }
  ```
- [ ] Cache events forever after match completion

**Validation**: Fetch events for recent match, display goals and cards correctly

### 2.3 Player Match Statistics (Optional - for richer context)
- [ ] Implement `/fixtures/players` integration
- [ ] Fetch player-level statistics for completed matches
- [ ] Identify top performers (highest ratings, goal scorers)
- [ ] Store player stats summary:
  ```typescript
  {
    data_type: 'player_stats',
    data: {
      homeTeam: {
        topPerformers: [{ name, rating, goals, assists }],
        // aggregate team stats
      },
      awayTeam: { /* same */ }
    }
  }
  ```
- [ ] Cache forever after match completion

**Validation**: Fetch player stats for match, identify top-rated players

### 2.4 Injury & Availability Service
- [ ] Create [server/services/api-football/injury-service.ts](server/services/api-football/injury-service.ts)
- [ ] Implement `/injuries?league={id}&season={year}` integration
- [ ] Fetch all current injuries for leagues in upcoming draws
- [ ] Store in `match_scraped_data` with `data_type='injuries'`:
  ```typescript
  {
    data_type: 'injuries',
    data: {
      homeTeam: {
        injuries: [
          { player: 'Name', type: 'Ankle Injury', reason: 'Detailed reason', severity: 'medium' }
        ]
      },
      awayTeam: { /* same */ }
    }
  }
  ```
- [ ] Refresh daily for upcoming matches
- [ ] Flag critical injuries (top scorers, captains) in AI context

**Validation**: Fetch injuries for league, identify injured players for upcoming matches

### 2.5 Lineup Service (Pre-Match)
- [ ] Implement `/fixtures/lineups?fixture={id}` integration
- [ ] Check for confirmed lineups 1-2 hours before betting deadline
- [ ] If available, store lineup data:
  ```typescript
  {
    data_type: 'lineup',
    data: {
      homeTeam: {
        formation: '4-3-3',
        startXI: [{ name, number, position, grid }],
        substitutes: [{ name, number, position }],
        isConfirmed: true
      },
      awayTeam: { /* same */ }
    }
  }
  ```
- [ ] Cache with 1-hour TTL before matches (lineups may update)
- [ ] After betting closes, cache forever

**Validation**: Fetch lineup for upcoming match 1 hour before, detect formation changes

### 2.6 Team Statistics Service
- [ ] Create [server/services/api-football/team-statistics.ts](server/services/api-football/team-statistics.ts)
- [ ] Implement `/teams/statistics?league={id}&season={year}&team={id}` integration
- [ ] Fetch season statistics for teams in upcoming matches
- [ ] Store comprehensive stats:
  ```typescript
  {
    data_type: 'team_statistics',
    data: {
      form: 'WWDLW',
      fixtures: { played, wins, draws, loses, home, away },
      goals: { for: { total, average }, against: { total, average }, byPeriod },
      biggest: { wins, loses, streak },
      cleanSheets: { total, home, away },
      failedToScore: { total, home, away },
      // ... full team stats
    }
  }
  ```
- [ ] Cache with 24-hour TTL (refreshes daily)
- [ ] Replace scraped team statistics in prediction context

**Validation**: Fetch team statistics for team, verify richness of data (form, splits, trends)

### 2.7 Standings Service
- [ ] Implement `/standings?league={id}&season={year}` integration
- [ ] Fetch current league standings daily
- [ ] Store in `match_scraped_data` with `data_type='standings'`:
  ```typescript
  {
    data_type: 'standings',
    data: {
      league: { id, name, country },
      standings: [
        { rank, team: { id, name }, points, goalsDiff, form, all: { played, win, draw, lose } }
      ]
    }
  }
  ```
- [ ] Cache with 24-hour TTL
- [ ] Add league position context to AI predictions

**Validation**: Fetch standings for league, display top 5 teams with correct positions

### 2.8 Head-to-Head Service
- [ ] Create [server/services/api-football/headtohead-service.ts](server/services/api-football/headtohead-service.ts)
- [ ] Implement `/fixtures/headtohead?h2h={team1_id}-{team2_id}` integration
- [ ] Fetch last 10 meetings between two teams
- [ ] Store in `match_scraped_data` with `data_type='headToHead'`:
  ```typescript
  {
    data_type: 'headToHead',
    data: {
      matches: [
        { date, homeTeam, awayTeam, score: { home, away }, winner, venue }
      ],
      summary: {
        homeWins, draws, awayWins,
        homeGoals, awayGoals,
        lastMeeting: { date, result }
      }
    }
  }
  ```
- [ ] Cache forever (H2H history doesn't change, only grows)
- [ ] Replace current similarity-based H2H in predictions

**Validation**: Fetch H2H for team matchup, see last 5-10 results

### 2.9 Prediction Service Integration
- [ ] Update [server/services/prediction-service.ts](server/services/prediction-service.ts)
- [ ] Modify `prepareMatchContext()` at line ~128 to include API-Football data
- [ ] Add conditional logic: use API-Football if available, fallback to scraping
  ```typescript
  // Check if API-Football data exists
  const apiFootballStats = match.match_scraped_data?.find(
    d => d.data_type === 'statistics' && d.source === 'api-football'
  )

  if (apiFootballStats) {
    // Use API-Football statistics
    parts.push('TEAM STATISTICS (API-Football)')
    parts.push(formatApiFootballStats(apiFootballStats.data))
  } else {
    // Fallback to scraped xStats
    const xStatsData = match.match_scraped_data?.find(d => d.data_type === 'xStats')
    if (xStatsData) {
      parts.push('EXPECTED STATISTICS (xStats - Scraped)')
      parts.push(formatXStats(xStatsData.data))
    }
  }
  ```
- [ ] Add "CRITICAL PLAYER ABSENCES" section for injuries
- [ ] Include H2H data if available from API-Football
- [ ] Update data interpretation guide in system prompt for API data

**Validation**: Generate prediction with API-Football data, verify context includes new sections

### 2.10 Data Fetching Orchestration
- [ ] Create [server/services/api-football/data-orchestrator.ts](server/services/api-football/data-orchestrator.ts)
- [ ] Implement orchestration service to fetch all pre-match data:
  ```typescript
  async enrichMatchData(matchId: number) {
    const match = await prisma.matches.findUnique({ where: { id: matchId } })

    // Fetch all data in parallel (where possible)
    await Promise.allSettled([
      this.fetchRecentFormStatistics(match),
      this.fetchInjuries(match),
      this.fetchLineups(match),
      this.fetchTeamStatistics(match),
      this.fetchStandings(match),
      this.fetchHeadToHead(match)
    ])
  }
  ```
- [ ] Trigger orchestrator after draw sync completes
- [ ] Add background job: refresh data 6 hours before betting deadline
- [ ] Handle failures gracefully: log errors, use fallback scraped data

**Validation**: Enrich all matches in a draw, verify data completeness >90%

### 2.11 Parallel Run & Validation
- [ ] Enable feature flag: `ENABLE_API_FOOTBALL_ENRICHMENT=true`
- [ ] Run API-Football + web scraping in parallel for 1 week
- [ ] Compare data completeness:
  - % matches with fixture statistics (API vs scraped)
  - % matches with injury data
  - % matches with H2H data
- [ ] Compare prediction quality:
  - Baseline: Predictions using only scraped data
  - Test: Predictions using API-Football data
  - Measure accuracy difference over 10+ draws
- [ ] Monitor API usage and costs
- [ ] Document discrepancies and edge cases

**Validation**:
- API data completeness ≥90% (vs scraped ≥70%)
- Prediction accuracy maintained or improved
- API usage <100 calls per draw (well under daily quota)

### 2.12 Scraper Deprecation (Gradual Cutover)
- [ ] Disable web scraping for fixture statistics (use API-Football primary)
- [ ] Keep scraping for Svenska Spel-specific data:
  - Current odds (1/X/2)
  - Svenska Folket public betting percentages
  - Tio Tidningars Tips expert consensus
  - **Rationale**: Svenska Spel has unique betting market data not in API-Football
- [ ] Set API-Football as primary for:
  - Fixture statistics (shots, possession, etc.)
  - Injuries and lineups
  - Team statistics and form
  - League standings
  - Head-to-head history
- [ ] Implement fallback: If API-Football fails 3× consecutively, activate circuit breaker and use scraping
- [ ] Monitor for 1 week in production

**Validation**:
- 0 scraping calls for statistics (except Svenska Spel-specific data)
- 100% API-Football usage for enrichment data
- Fallback triggers correctly on API failures

## Phase 3: Historical Data Enrichment (Weeks 5-7, Background Job)

### 3.1 Historical Match Backfill Strategy
- [ ] Create [server/jobs/historical-backfill.ts](server/jobs/historical-backfill.ts)
- [ ] Define backfill scope:
  - **Leagues**: Top 15 European leagues (Premier League, La Liga, Serie A, Bundesliga, Ligue 1, Eredivisie, etc.)
  - **Time Range**: 3-5 years back (2019-2024)
  - **Estimated Volume**: ~100,000 matches total
- [ ] Implement rate-limited backfill:
  - Fetch 500 matches per day (stay under Basic plan quota)
  - Spread over 200 days (~6-7 months continuous)
  - **Strategy**: Backfill runs as low-priority background job
- [ ] Create `historical_matches` table:
  ```sql
  CREATE TABLE historical_matches (
    id SERIAL PRIMARY KEY,
    api_football_fixture_id INT UNIQUE NOT NULL,
    league_id INT NOT NULL,
    season INT NOT NULL,
    home_team_id INT NOT NULL,
    away_team_id INT NOT NULL,
    match_date DATE NOT NULL,
    status VARCHAR(50),
    score_home INT,
    score_away INT,
    outcome VARCHAR(5), -- '1', 'X', '2'
    venue_id INT,
    has_statistics BOOLEAN DEFAULT false,
    has_lineups BOOLEAN DEFAULT false,
    has_events BOOLEAN DEFAULT false,
    raw_data JSONB,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
  );
  ```
- [ ] Prioritize leagues by frequency in Svenska Spel draws:
  1. Premier League, La Liga, Bundesliga, Serie A (highest priority)
  2. Ligue 1, Eredivisie, Scottish Premiership
  3. Other European leagues as they appear in draws

**Validation**: Backfill job starts successfully, processes 500 matches/day

### 3.2 Historical Statistics Backfill
- [ ] Extend backfill job to fetch fixture statistics for historical matches
- [ ] Use `/fixtures/statistics?fixture={id}` for each historical match
- [ ] Store statistics in separate `historical_match_statistics` table or JSONB column
- [ ] Include: shots, possession, passes, fouls, corners, cards
- [ ] Mark `has_statistics=true` when complete

**Validation**: Historical matches have statistics, not just scores

### 3.3 Historical Lineup Backfill (Optional)
- [ ] Fetch lineups for historical matches: `/fixtures/lineups?fixture={id}`
- [ ] Store in JSONB column: `lineups_data`
- [ ] Purpose: Understand player availability patterns over time
- [ ] Mark `has_lineups=true` when complete

**Validation**: Historical matches have lineup data where available

### 3.4 Historical Events Backfill (Optional)
- [ ] Fetch match events: `/fixtures/events?fixture={id}`
- [ ] Store goals, cards, substitutions in JSONB
- [ ] Purpose: Rich match narrative for embeddings
- [ ] Mark `has_events=true` when complete

**Validation**: Historical matches have event timelines

### 3.5 Backfill Monitoring & Progress Tracking
- [ ] Create admin dashboard for backfill progress:
  - Total matches to backfill
  - Matches backfilled (overall and by league)
  - Current backfill rate (matches/day)
  - Estimated completion date
  - API usage (calls/day, quota remaining)
- [ ] Add backfill status to `api_football_usage` or separate `backfill_status` table
- [ ] Implement pause/resume functionality for backfill job
- [ ] Alert if backfill stalls (no progress for 48 hours)

**Validation**: Admin can see backfill progress, estimated completion in ~6 months

### 3.6 Enhanced Embeddings with Historical Context
- [ ] Update [server/services/embeddings-service.ts](server/services/embeddings-service.ts)
- [ ] Modify `generateMatchEmbedding()` to include richer context:
  - Team form (last 5 matches with results and statistics)
  - Key player availability (injuries, suspensions)
  - League position and context
  - Venue (home/away advantage)
  - Historical matchup patterns
- [ ] Re-generate embeddings for all matches (current + historical)
- [ ] Use larger embedding context for better similarity matching

**Validation**: Similarity search returns more relevant historical matches

### 3.7 Enhanced Similarity Search
- [ ] Update similarity search to leverage historical data
- [ ] Include historical matches in similarity pool (not just current season)
- [ ] Weight similarity factors:
  - Team strength (league position, form)
  - Matchup history (H2H patterns)
  - Player context (similar absences)
  - Tactical factors (formation, style)
- [ ] Test similarity search with historical data
- [ ] Compare old vs new similarity recommendations

**Validation**: Similarity search finds relevant matches from 3+ years of history

### 3.8 Historical Trends Analysis (Optional)
- [ ] Create analytics service to identify long-term trends:
  - Teams improving/declining over multiple seasons
  - Home advantage patterns by team/venue
  - League competitiveness trends (more/less predictable)
  - Player impact (team performance with/without key player)
- [ ] Add trend indicators to team statistics
- [ ] Include trends in AI prediction context

**Validation**: Identify team that significantly improved this season vs last season

## Phase 4: Post-Match Result Sync & Learning (Week 8+)

### 4.1 Daily Result Sync Service
- [ ] Create [server/jobs/daily-result-sync.ts](server/jobs/daily-result-sync.ts)
- [ ] Implement background job that runs daily at 6 AM (after all matches finished)
- [ ] Fetch completed fixtures: `/fixtures?date={yesterday}&status=FT`
- [ ] Match API-Football fixtures to Svenska Spel matches by:
  - API-Football fixture ID (if stored during enrichment)
  - Team IDs + match date (fallback matching)
- [ ] Update match results in database:
  ```typescript
  await prisma.matches.update({
    where: { id: matchId },
    data: {
      status: 'Completed',
      result_home: fixture.goals.home,
      result_away: fixture.goals.away,
      outcome: determineOutcome(fixture.goals),
      status_time: new Date()
    }
  })
  ```
- [ ] Handle edge cases: postponed matches, abandoned matches, missing data

**Validation**: All match results updated within 24 hours of completion

### 4.2 Prediction Performance Calculation
- [ ] Trigger performance calculation automatically after result sync
- [ ] Update `prediction_performance` table:
  - Was prediction correct? (predicted_outcome === actual_outcome)
  - Probability accuracy (Brier score)
  - Confidence calibration (high-confidence predictions more accurate?)
- [ ] Aggregate statistics:
  - Overall accuracy by game type (Stryktipset, Europatipset, Topptipset)
  - Accuracy by league
  - Accuracy by confidence level
  - Accuracy by home/draw/away prediction
- [ ] Store weekly performance snapshots

**Validation**: Prediction performance auto-calculated, visible in analytics dashboard

### 4.3 Coupon Performance Tracking
- [ ] Update coupon win/loss status after all matches in draw complete
- [ ] Calculate returns:
  - How many rows in coupon won?
  - What was the payout?
  - ROI: (payout - cost) / cost
- [ ] Track coupon performance over time:
  - Average accuracy per draw
  - Best/worst performing draws
  - Spik success rate
  - Gardering (multiple outcomes) effectiveness

**Validation**: Coupon results auto-calculated, displayed on draw detail page

### 4.4 Post-Match Statistical Enrichment
- [ ] Fetch final match statistics after completion: `/fixtures/statistics?fixture={id}`
- [ ] Store final statistics for learning:
  - Shots, possession, expected goals (xG if available)
  - Cards, fouls, corners
  - Player ratings
- [ ] Use post-match stats to improve future embeddings
- [ ] Compare pre-match predictions vs actual performance patterns

**Validation**: Post-match statistics stored for all completed matches

### 4.5 Automated Performance Reporting
- [ ] Create weekly performance report:
  - Overall prediction accuracy
  - Improvement/decline vs previous week
  - Best/worst predicted matches
  - Leagues with highest/lowest accuracy
  - Recommended adjustments (e.g., "Consider weighting injuries more heavily")
- [ ] Send report to admin email or dashboard
- [ ] Generate insights using Claude AI analysis of performance data (optional)

**Validation**: Weekly report generated automatically, contains actionable insights

### 4.6 Learning Loop Integration
- [ ] Use performance data to inform future predictions:
  - If AI consistently misses specific league, flag for review
  - If injury data correlates with prediction errors, weight it higher
  - If home advantage is underestimated in certain leagues, adjust
- [ ] A/B test prediction variations:
  - Baseline: Current prediction logic
  - Test: Adjusted logic based on learning
  - Measure accuracy improvement over 10 draws
- [ ] Implement feedback loop: performance → adjustments → new predictions → performance

**Validation**: System learns from mistakes, accuracy improves over time

## Cross-Cutting Tasks

### Testing
- [ ] Unit tests for API client (mocked responses)
- [ ] Unit tests for team/league matching algorithms
- [ ] Integration tests for each data service (sandbox API if available)
- [ ] E2E test: Sync draw → match teams → fetch API data → generate prediction
- [ ] Load test: Simulate 50 matches with API calls, verify rate limiting works
- [ ] Error handling tests: API down, invalid data, quota exceeded, network timeout

**Validation**: 80%+ code coverage, all critical paths tested

### Documentation
- [ ] Update [README.md](README.md) with API-Football integration overview
- [ ] Create [docs/API_FOOTBALL.md](docs/API_FOOTBALL.md) comprehensive guide:
  - Overview and benefits
  - Authentication and setup
  - Team/league matching system
  - Data enrichment process
  - Caching strategy
  - Fallback behavior
  - Historical backfill
  - Troubleshooting
- [ ] Document team matching algorithm in detail
- [ ] Update architecture diagram with new services
- [ ] Document fallback strategy and circuit breaker behavior

**Validation**: Documentation complete, external developer can understand integration

### Monitoring & Alerting
- [ ] Add API-Football metrics to analytics dashboard:
  - Daily API usage (calls/day, % of quota)
  - Cache hit rate
  - Matching success rate (teams/leagues)
  - Data completeness (% matches with full data)
  - API response times
- [ ] Create Bugsnag alerts:
  - API errors (circuit breaker opened)
  - Quota warnings (80%, 90%, 95%)
  - Low matching confidence (>10% unmapped teams)
  - Backfill stalls (no progress for 48 hours)
- [ ] Add health check endpoint: `/api/health/api-football`

**Validation**: Monitoring dashboard live, alerts trigger correctly

### Migration & Rollback
- [ ] Create feature flag: `ENABLE_API_FOOTBALL=true` (environment variable)
- [ ] Implement gradual rollout:
  - Week 1: Test with Topptipset only (8 matches)
  - Week 2: Add Europatipset (13 matches)
  - Week 3: Add Stryktipset (13 matches)
  - Week 4: Full rollout all game types
- [ ] Create rollback plan:
  - Set `ENABLE_API_FOOTBALL=false`
  - System falls back to web scraping automatically
  - No data loss, seamless transition
- [ ] Document emergency procedures:
  - API-Football down: Circuit breaker activates, scraping takes over
  - Quota exceeded: Alert admin, pause non-critical calls (e.g., backfill), use scraping
  - Incorrect data: Manual override in admin UI, flag API issue

**Validation**: Rollback tested in staging, emergency procedures documented

## Success Criteria

### Phase 1 Success (Team/League Matching)
- ✅ 95%+ teams matched with high confidence (>95% similarity)
- ✅ 90%+ teams matched with medium+ confidence (>80% similarity)
- ✅ <5% unmapped teams requiring manual review
- ✅ Admin can review and resolve low-confidence matches in <2 min each
- ✅ Matching completes in <60 seconds per draw
- ✅ <100 API calls per draw for matching (well under quota)

### Phase 2 Success (Pre-Match Enrichment)
- ✅ 90%+ fixture statistics available via API-Football
- ✅ 80%+ matches have injury data
- ✅ 95%+ matches have team statistics
- ✅ Prediction quality maintained or improved vs scraping baseline
- ✅ 0 scraper failures for API-covered data types
- ✅ API costs <$30/month (Basic plan sufficient)
- ✅ Data freshness: All data fetched >1 hour before betting deadline

### Phase 3 Success (Historical Enrichment)
- ✅ 100K+ historical matches backfilled across 15 leagues
- ✅ 3-5 years of data per major league (Premier League, La Liga, etc.)
- ✅ Backfill runs reliably at 500 matches/day
- ✅ Historical similarity search returns relevant matches from past seasons
- ✅ Enhanced embeddings include player/form/venue context
- ✅ Backfill completes within 6-7 months (acceptable for background process)

### Phase 4 Success (Post-Match Learning)
- ✅ 100% match results captured automatically within 24 hours
- ✅ Prediction performance auto-calculated daily
- ✅ Weekly performance reports generated
- ✅ Learning loop identifies areas for improvement
- ✅ Accuracy improves by 2-5% over 3 months (measured vs baseline)

## Risk Mitigation Checklist

### API Reliability
- [x] Circuit breaker implemented (fallback to scraping after 3 failures)
- [x] Fallback to web scraping documented and tested
- [x] Cache prevents repeated failures from cascading
- [x] Health check endpoint monitors API status

### Cost Management
- [x] Quota tracking at 80%, 90%, 95% thresholds
- [x] Rate limiting prevents quota exhaustion
- [x] Aggressive caching reduces API calls
- [x] Backfill rate limited to 500 matches/day (stays under quota)
- [x] Emergency pause functionality for backfill if needed

### Data Quality
- [x] Confidence scoring for all team/league matches
- [x] Admin review workflow for low-confidence matches
- [x] Parallel run validates data equivalence before cutover
- [x] Manual override capability for incorrect mappings

### Operational
- [x] Feature flags enable/disable API-Football without code changes
- [x] Rollback plan tested and documented
- [x] Emergency procedures for API outages
- [x] Monitoring alerts for all failure modes

## Timeline Summary

- **Week 1**: API setup, client service, database schema (Tasks 1.1-1.3)
- **Week 2**: Team/league matching, admin UI, testing (Tasks 1.4-1.10)
- **Week 3**: Pre-match data services (statistics, injuries, lineups) (Tasks 2.1-2.5)
- **Week 4**: Team stats, standings, H2H, prediction integration (Tasks 2.6-2.12)
- **Weeks 5-7**: Historical backfill setup and monitoring (Tasks 3.1-3.8, runs continuously)
- **Week 8**: Post-match sync and learning (Tasks 4.1-4.6)

**Parallel Work:**
- Historical backfill runs continuously in background starting Week 5 (~6 months total)
- Testing, documentation, monitoring throughout all phases

**Total Estimated Duration**: 8 weeks to full integration, 6+ months for complete historical backfill
