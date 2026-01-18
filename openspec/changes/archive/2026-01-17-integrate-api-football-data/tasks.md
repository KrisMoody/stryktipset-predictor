# Tasks: Integrate API-Football Data Sources

## Phase 1: Foundation & Core API Integration (Weeks 1-3)

### 1.1 Project Setup & Configuration
- [ ] Sign up for API-Football Pro account ($30/month tier)
- [ ] Add API_FOOTBALL_API_KEY to environment variables
- [ ] Add API_FOOTBALL_BASE_URL to config (https://v3.football.api-sports.io/)
- [ ] Document API credentials in ENV_SETUP.md
- [ ] Create rate limiting configuration (15,000 req/day = ~10 req/min sustained)

**Validation**: API key works with /status endpoint

### 1.2 API-Football Client Service
- [ ] Create `server/services/api-football-client.ts`
- [ ] Implement axios-based HTTP client with headers (x-apisports-key)
- [ ] Add request/response logging with Bugsnag context
- [ ] Implement rate limiting (10 requests/minute to stay under daily quota)
- [ ] Add retry logic with exponential backoff (max 3 retries)
- [ ] Create response caching layer with Redis or in-memory cache
- [ ] Add request queue for batching non-urgent calls
- [ ] Implement circuit breaker for API failures (fallback after 3 consecutive errors)

**Validation**: Successfully fetch from /status, /timezone, /countries endpoints

### 1.3 Team Mapping System
- [ ] Create database table: `team_mappings` (svenska_spel_id, api_football_id, confidence)
- [ ] Create database migration for team_mappings
- [ ] Implement manual mapping service for Allsvenskan teams
- [ ] Research and map top 20 Allsvenskan teams to API-Football IDs
- [ ] Create fuzzy matching algorithm for international teams (Levenshtein distance)
- [ ] Add mapping admin UI or script for manual overrides
- [ ] Store unsuccessful mappings for review (`unmapped_teams` table)

**Validation**: Map all Allsvenskan teams with 100% confidence, 80%+ for international teams

### 1.4 Caching & Storage Infrastructure
- [ ] Create `api_football_cache` table (endpoint, params, response, expires_at)
- [ ] Create database migration for caching table
- [ ] Implement cache service with TTL strategies:
  - Fixture statistics: cache forever after match completion
  - Injuries: 1-hour TTL before matches, 24-hour after
  - Team statistics: 24-hour TTL
  - Standings: 24-hour TTL
  - Venues: 30-day TTL
- [ ] Add cache invalidation logic for live match updates
- [ ] Create cache warming script for upcoming matches

**Validation**: Cache hit rate >70% after 1 week of operation

### 1.5 API Usage Tracking
- [ ] Create `api_football_usage` table (endpoint, status, cost, timestamp)
- [ ] Create database migration for usage tracking
- [ ] Implement usage tracking middleware in API client
- [ ] Add cost estimation per request (based on API tier)
- [ ] Create usage dashboard page or admin endpoint
- [ ] Implement quota alerting at 80%, 90%, 95% of daily limit
- [ ] Add Bugsnag alerts for quota warnings

**Validation**: Track 100% of API requests, receive alerts at thresholds

## Phase 1B: Fixture Statistics Service (Week 2)

### 1.6 Fixture Statistics Integration
- [ ] Create `server/services/api-football/fixture-statistics.ts`
- [ ] Implement `/fixtures/statistics` endpoint integration
- [ ] Normalize API response to match current `match_scraped_data` schema
- [ ] Map statistics types: shots, possession, passes, fouls, corners, offsides
- [ ] Add goalkeeper saves, blocks, interceptions, duels
- [ ] Create data transformation service (API format → database format)
- [ ] Update `match_scraped_data` table to store API source metadata

**Validation**: Fetch statistics for completed match, verify data structure matches scraped format

### 1.7 Match Events Integration
- [ ] Implement `/fixtures/events` endpoint integration
- [ ] Store goals, cards, substitutions in structured format
- [ ] Add event timeline for match narrative
- [ ] Link events to player data if available
- [ ] Create events display component for UI (optional)

**Validation**: Fetch events for recent match, display goals and cards correctly

### 1.8 Player Match Statistics
- [ ] Implement `/fixtures/players` endpoint integration
- [ ] Store player-level statistics (rating, minutes, goals, assists)
- [ ] Aggregate player stats for team context
- [ ] Identify top performers in each match
- [ ] Create player statistics summary for AI context

**Validation**: Fetch player stats for match, identify top-rated players

### 1.9 Prediction Service Integration
- [ ] Update `prepareMatchContext()` in prediction-service.ts
- [ ] Add API-Football statistics section to AI prompt
- [ ] Replace scraped xStats with API fixture statistics
- [ ] Add conditional logic: use API if available, fallback to scraping
- [ ] Update data interpretation guide in system prompt
- [ ] Test prediction generation with API data

**Validation**: Generate prediction with API data, compare quality to scraped data baseline

### 1.10 Parallel Run & Validation
- [ ] Run API + scraping in parallel for 2 weeks
- [ ] Compare data completeness (% matches with data)
- [ ] Compare data accuracy (spot-check 20 matches manually)
- [ ] Compare prediction accuracy (track before/after metrics)
- [ ] Monitor API costs and quota usage
- [ ] Document discrepancies and edge cases

**Validation**: API data completeness ≥95%, accuracy matches scraping, prediction quality maintained

## Phase 1C: Injury & Lineup Service (Week 3)

### 1.11 Injury Service
- [ ] Create `server/services/api-football/injury-service.ts`
- [ ] Implement `/injuries` endpoint integration
- [ ] Fetch injuries by league, team, and fixture
- [ ] Store injury data in `match_scraped_data` with type="injuries"
- [ ] Add injury severity and expected return date
- [ ] Create injury alert system for key players

**Validation**: Fetch current injuries for Allsvenskan teams

### 1.12 Lineup Service
- [ ] Implement `/fixtures/lineups` endpoint integration
- [ ] Fetch confirmed/probable lineups 1 hour before matches
- [ ] Store lineup data with formation and player positions
- [ ] Identify missing regular starters (compare to squad data)
- [ ] Flag tactical changes (formation differences)

**Validation**: Fetch lineup for upcoming match, detect formation

### 1.13 Sidelined Players Service
- [ ] Implement `/sidelined` endpoint integration
- [ ] Track suspensions, medical issues, personal reasons
- [ ] Combine with /injuries data for complete availability picture
- [ ] Add to AI prompt as "CRITICAL ABSENCES" section

**Validation**: Identify sidelined players for upcoming match week

### 1.14 Player-Aware Prediction Context
- [ ] Update AI system prompt with player absence guidelines
- [ ] Add "Key Player Absences" section to match context
- [ ] Weight absences by player importance (goals/assists/ratings)
- [ ] Test prediction with and without injury context

**Validation**: Prediction changes significantly when key player is injured

### 1.15 Team Statistics Service
- [ ] Create `server/services/api-football/team-statistics.ts`
- [ ] Implement `/teams/statistics` endpoint integration
- [ ] Fetch season statistics for teams in upcoming matches
- [ ] Replace scraped team stats in prediction context
- [ ] Add detailed breakdowns: home/away splits, goals by period
- [ ] Cache team stats with 24-hour TTL

**Validation**: Fetch team statistics for Allsvenskan team, verify data richness

### 1.16 Standings Service
- [ ] Implement `/standings` endpoint integration
- [ ] Fetch current league standings daily
- [ ] Update team positions automatically
- [ ] Add to AI context for league situation analysis
- [ ] Cache standings with 24-hour TTL

**Validation**: Fetch standings for league, display top 5 teams

### 1.17 Phase 1 Cutover
- [ ] Disable web scraping for fixture statistics
- [ ] Set API-Football as primary data source
- [ ] Keep scraping as emergency fallback (circuit breaker activation)
- [ ] Monitor for 1 week in production
- [ ] Document migration in CHANGELOG.md

**Validation**: 0 scraping calls for statistics, 100% API usage

## Phase 2: Live Match Tracking (Week 4)

### 2.1 Live Match Service
- [ ] Create `server/services/api-football/live-matches.ts`
- [ ] Implement `/fixtures?live=all` polling
- [ ] Filter live fixtures to only Stryktipset/Europatipset/Topptipset draws
- [ ] Poll every 60 seconds during active draws
- [ ] Update match scores, status, elapsed time in real-time

**Validation**: Track live match, update score within 90 seconds of API data

### 2.2 Live Match Background Job
- [ ] Create server plugin for live match polling
- [ ] Implement smart scheduling: only poll when draws are active
- [ ] Add job status monitoring (running, idle, error)
- [ ] Store live match state in Redis for fast access
- [ ] Create live match event stream for frontend (optional WebSocket)

**Validation**: Background job starts automatically when draw opens, stops when draw closes

### 2.3 Live Match UI
- [ ] Add live match indicator to dashboard (🔴 LIVE badge)
- [ ] Display current score and elapsed time
- [ ] Add auto-refresh for live scores (polling or SSE)
- [ ] Show recent events (goals, cards) in real-time
- [ ] Add "Follow Live" toggle for users to enable/disable live updates

**Validation**: See live score update in UI within 90 seconds of goal

### 2.4 Result Auto-Validation
- [ ] Detect match status="FT" (Full Time) in live feed
- [ ] Automatically update match result in database
- [ ] Trigger prediction performance calculation
- [ ] Update coupon win/loss status
- [ ] Send notification to user if their coupon won (optional)

**Validation**: Match result updates within 5 minutes of final whistle

### 2.5 Live Events Stream
- [ ] Implement `/fixtures/events` polling during live matches
- [ ] Store goals, cards, substitutions in real-time
- [ ] Display event timeline on match detail page
- [ ] Add event notifications (optional push alerts)

**Validation**: Goal event appears in UI within 90 seconds of occurrence

## Phase 3: Enhanced Predictions (Weeks 5-6)

### 3.1 Player Form Service
- [ ] Create `server/services/api-football/player-form.ts`
- [ ] Implement `/players` endpoint integration
- [ ] Fetch player statistics for season
- [ ] Identify top scorers, assist leaders, in-form players
- [ ] Store player data in new `players` table
- [ ] Create player form cache (7-day TTL)

**Validation**: Fetch top scorers for league

### 3.2 Player-Aware Context Enhancement
- [ ] Add "Key Players" section to AI prompt
- [ ] Highlight top 3 scorers for each team
- [ ] Flag if any top scorer is injured/absent
- [ ] Include recent player form (goals in last 5 games)
- [ ] Test prediction with player context

**Validation**: AI mentions key players in reasoning

### 3.3 Bookmaker Predictions Service
- [ ] Create `server/services/api-football/predictions-service.ts`
- [ ] Implement `/predictions` endpoint integration
- [ ] Fetch AI predictions from API-Football
- [ ] Store in `match_scraped_data` with type="external_predictions"
- [ ] Compare API predictions vs our AI predictions

**Validation**: Fetch prediction for upcoming match, see comparison

### 3.4 Odds Service
- [ ] Implement `/odds` endpoint integration
- [ ] Fetch pre-match odds from multiple bookmakers
- [ ] Store odds history for value bet identification
- [ ] Calculate implied probabilities from odds
- [ ] Compare AI predictions vs market odds

**Validation**: Fetch odds for match, identify value bet (AI probability > implied probability)

### 3.5 Value Bet Identification
- [ ] Create algorithm: value = (AI probability × odds) - 1
- [ ] Flag matches where value > 0.1 (10% edge)
- [ ] Add "Value Bet" indicator to UI
- [ ] Add value bet section to coupon optimizer
- [ ] Track value bet performance over time

**Validation**: Identify 2-3 value bets per draw, track ROI

### 3.6 Ensemble Prediction (Optional)
- [ ] Combine AI prediction + API-Football prediction + bookmaker consensus
- [ ] Weight each source (e.g., 50% AI, 30% API, 20% bookmakers)
- [ ] Create ensemble model selector in UI
- [ ] A/B test ensemble vs AI-only predictions

**Validation**: Compare ensemble accuracy vs AI-only over 10 draws

## Phase 4: Historical Data Enrichment (Week 7+)

### 4.1 Historical Match Backfill
- [ ] Create backfill script for past seasons
- [ ] Implement `/fixtures` with date range queries
- [ ] Fetch historical matches for supported leagues (3 years back)
- [ ] Store in `historical_matches` table
- [ ] Rate limit backfill to avoid quota exhaustion (100 matches/day)
- [ ] Run backfill as background job over 2-3 weeks

**Validation**: 1,000+ historical matches stored per league

### 4.2 Historical Statistics Enrichment
- [ ] Backfill fixture statistics for historical matches
- [ ] Store historical player statistics
- [ ] Backfill injury and lineup data (if available)
- [ ] Link historical matches to current teams

**Validation**: Historical match has full statistics, not just score

### 4.3 Enhanced Similarity Search
- [ ] Update embedding generation to include player context
- [ ] Add injury/lineup factors to embeddings
- [ ] Re-generate embeddings for historical matches
- [ ] Test similarity search with enriched context

**Validation**: Similar matches include consideration of player absences

### 4.4 Head-to-Head Service
- [ ] Implement `/fixtures/headtohead` endpoint integration
- [ ] Fetch official H2H data instead of similarity search
- [ ] Store H2H results in cache (long TTL)
- [ ] Add H2H summary to AI context

**Validation**: Fetch H2H for team matchup, see past results

### 4.5 Long-Term Trend Analysis (Optional)
- [ ] Analyze team performance over multiple seasons
- [ ] Identify trending teams (improving/declining)
- [ ] Add trend indicators to team statistics
- [ ] Factor trends into AI predictions

**Validation**: Identify team that improved significantly this season

## Cross-Cutting Tasks

### Testing
- [ ] Unit tests for API client (mocked responses)
- [ ] Integration tests for each service (sandbox API)
- [ ] E2E test: sync draw → fetch API data → generate prediction
- [ ] Load test: simulate 50 matches with API calls
- [ ] Error handling tests (API down, invalid data, quota exceeded)

### Documentation
- [ ] Update README.md with API-Football integration
- [ ] Create API_FOOTBALL.md guide in docs/
- [ ] Document team mapping process
- [ ] Update architecture diagram with new services
- [ ] Document fallback strategy and circuit breaker

### Monitoring & Alerting
- [ ] Add API-Football metrics to analytics dashboard
- [ ] Create Bugsnag alerts for API errors
- [ ] Monitor API quota usage daily
- [ ] Track API response times and latency
- [ ] Alert on data freshness issues (stale cache)

### Migration & Rollback
- [ ] Create feature flag: `ENABLE_API_FOOTBALL=true`
- [ ] Implement gradual rollout by league (test with one league first)
- [ ] Create rollback plan if API integration fails
- [ ] Document emergency procedures (API down, quota exceeded)

## Success Criteria

### Phase 1 Success
- ✅ 95%+ fixture statistics available via API
- ✅ 90%+ team mappings successful
- ✅ Prediction quality maintained or improved
- ✅ 0 scraper failures for API-covered data
- ✅ API costs <$50/month

### Phase 2 Success
- ✅ Live scores update within 90 seconds
- ✅ 100% match results captured automatically
- ✅ Background job runs reliably during draws

### Phase 3 Success
- ✅ Player context improves prediction accuracy by 3-5%
- ✅ Identify 2-3 value bets per draw
- ✅ Value bet ROI >0% after 20 draws

### Phase 4 Success
- ✅ 3+ years historical data per league
- ✅ Enhanced similarity search shows relevant matches
- ✅ H2H data available for all matchups

## Risk Mitigation Tasks

- [ ] Implement fallback to scraping if API fails
- [ ] Create data validation layer (schema checks)
- [ ] Add circuit breaker for API client
- [ ] Implement quota warning system
- [ ] Create API health monitoring dashboard
- [ ] Document emergency contact for API support

## Dependencies

### External
- API-Football Pro subscription
- Team mapping data quality
- API stability and uptime

### Internal
- Database migration approval
- Prediction service refactoring
- Cache infrastructure (Redis or in-memory)

### Blockers
- None identified - all tasks can proceed in parallel after initial setup

## Timeline Summary

- **Week 1**: Setup, API client, team mapping, caching (Tasks 1.1-1.5)
- **Week 2**: Fixture statistics integration (Tasks 1.6-1.10)
- **Week 3**: Injuries, lineups, team stats (Tasks 1.11-1.17)
- **Week 4**: Live match tracking (Tasks 2.1-2.5)
- **Week 5**: Player form, predictions API (Tasks 3.1-3.3)
- **Week 6**: Odds, value bets, ensemble (Tasks 3.4-3.6)
- **Week 7+**: Historical backfill (Tasks 4.1-4.5)

**Total Estimated Duration**: 6-8 weeks for Phases 1-3, ongoing for Phase 4
