# api-football-integration Specification

## Purpose
TBD - created by archiving change integrate-api-football-data. Update Purpose after archive.
## Requirements
### Requirement: Data Provider Abstraction
The system SHALL implement a provider abstraction layer that allows multiple data sources (API-Football, web scraping, cache) to be used interchangeably without coupling the prediction service to any specific implementation.

#### Scenario: Provider factory returns data from primary provider
- **GIVEN** API-Football is enabled and healthy
- **WHEN** the prediction service requests match statistics
- **THEN** the factory SHALL try API-Football first and return normalized data with `source='api-football'`

#### Scenario: Automatic fallback when primary provider fails
- **GIVEN** API-Football returns an error
- **WHEN** the prediction service requests match statistics
- **THEN** the factory SHALL automatically try the web scraper provider and return data with `source='web-scraping'`

#### Scenario: Feature flag disables API-Football
- **GIVEN** `ENABLE_API_FOOTBALL=false` in environment
- **WHEN** the application starts
- **THEN** only WebScraperProvider and CachedDataProvider SHALL be registered

---

### Requirement: Circuit Breaker Protection
The system SHALL implement a circuit breaker pattern that prevents cascading failures when API-Football is experiencing issues.

#### Scenario: Circuit breaker opens after consecutive failures
- **GIVEN** API-Football has failed 3 times consecutively
- **WHEN** the next request is made
- **THEN** the circuit breaker SHALL open and skip API-Football for 5 minutes

#### Scenario: Circuit breaker allows retry after timeout
- **GIVEN** the circuit breaker has been open for 5 minutes
- **WHEN** the next request is made
- **THEN** the circuit breaker SHALL enter half-open state and allow one test request

#### Scenario: Circuit breaker closes on success
- **GIVEN** the circuit breaker is in half-open state
- **WHEN** API-Football request succeeds
- **THEN** the circuit breaker SHALL close and resume normal operation

---

### Requirement: API-Football Client
The system SHALL provide an HTTP client for API-Football with rate limiting, caching, and retry logic.

#### Scenario: Rate limiting prevents quota exhaustion
- **GIVEN** multiple requests are queued
- **WHEN** requests are sent to API-Football
- **THEN** the client SHALL enforce a maximum of 2 requests per minute with 500ms delays

#### Scenario: Retry with exponential backoff on transient errors
- **GIVEN** API-Football returns a 5xx error
- **WHEN** the request fails
- **THEN** the client SHALL retry up to 3 times with exponential backoff (1s, 2s, 4s)

#### Scenario: Handle rate limit responses
- **GIVEN** API-Football returns 429 Too Many Requests
- **WHEN** the response is received
- **THEN** the client SHALL wait with longer backoff (30s, 60s, 120s) before retrying

---

### Requirement: Automatic Team Matching
The system SHALL automatically match Svenska Spel teams to API-Football teams using multiple strategies without requiring manual mapping for most teams.

#### Scenario: Match team by external ID (high confidence)
- **GIVEN** a Svenska Spel team has a `betRadar_id` or `kambi_id`
- **WHEN** the team matcher runs
- **THEN** it SHALL find the API-Football team by external ID and return confidence='high'

#### Scenario: Match team by fuzzy name matching (variable confidence)
- **GIVEN** a Svenska Spel team has no external IDs
- **WHEN** the team matcher runs
- **THEN** it SHALL fuzzy match against the cached league roster and return confidence based on similarity (high >95%, medium 80-95%, low <80%)

#### Scenario: Cache league rosters for efficient matching
- **GIVEN** a league needs team matching
- **WHEN** the team roster is fetched
- **THEN** it SHALL be cached for 24 hours to enable local matching without additional API calls

#### Scenario: Flag low-confidence matches for review
- **GIVEN** a team match has confidence='low' or similarity <80%
- **WHEN** the mapping is stored
- **THEN** it SHALL be flagged with `verified=false` for admin review

---

### Requirement: Automatic League Matching
The system SHALL automatically match Svenska Spel leagues to API-Football leagues by name and country.

#### Scenario: Match league by exact name
- **GIVEN** a Svenska Spel league name matches an API-Football league exactly
- **WHEN** the league matcher runs
- **THEN** it SHALL return confidence='high' with the matched league ID

#### Scenario: Match league by fuzzy name with country context
- **GIVEN** a Svenska Spel league name partially matches an API-Football league
- **WHEN** the league matcher uses country context to disambiguate
- **THEN** it SHALL return the best match with appropriate confidence level

---

### Requirement: Pre-Match Data Enrichment
The system SHALL fetch and store pre-match data from API-Football including statistics, injuries, lineups, team stats, standings, and head-to-head history.

#### Scenario: Fetch fixture statistics for recent matches
- **GIVEN** a match is scheduled in an upcoming draw
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch statistics for each team's last 5 matches and store with `data_type='statistics'`

#### Scenario: Fetch player injuries
- **GIVEN** teams are identified for an upcoming match
- **WHEN** injury data is fetched
- **THEN** it SHALL store injuries with `data_type='injuries'` and flag critical absences (top scorers, captains)

#### Scenario: Fetch confirmed lineups before deadline
- **GIVEN** a match is 1-2 hours before betting deadline
- **WHEN** lineup data is available
- **THEN** it SHALL fetch and store confirmed lineups with `data_type='lineup'`

#### Scenario: Fetch head-to-head history
- **GIVEN** two teams are matched for an upcoming fixture
- **WHEN** H2H data is requested
- **THEN** it SHALL fetch the last 10 meetings and cache forever (historical data is immutable)

---

### Requirement: Historical Data Backfill
The system SHALL backfill 3-5 years of historical match data from API-Football to improve similarity search and prediction context.

#### Scenario: Rate-limited background backfill
- **GIVEN** historical backfill is enabled
- **WHEN** the backfill job runs
- **THEN** it SHALL process max 500 matches per day to stay within API quota

#### Scenario: Prioritize common leagues
- **GIVEN** multiple leagues need backfilling
- **WHEN** the backfill job selects matches
- **THEN** it SHALL prioritize leagues most common in Svenska Spel draws (Premier League, La Liga, Bundesliga, Serie A first)

#### Scenario: Store historical matches separately
- **GIVEN** historical match data is fetched
- **WHEN** it is stored
- **THEN** it SHALL be stored in the `historical_matches` table with statistics, events, and lineups

---

### Requirement: Post-Match Result Sync
The system SHALL automatically capture match results from API-Football daily to update predictions and track performance.

#### Scenario: Daily result sync
- **GIVEN** matches from yesterday have completed
- **WHEN** the daily sync job runs at 6 AM
- **THEN** it SHALL fetch completed fixtures and update match results in the database

#### Scenario: Trigger performance calculation
- **GIVEN** match results are updated
- **WHEN** the result sync completes
- **THEN** it SHALL trigger automatic prediction performance calculation

---

### Requirement: API Usage Tracking
The system SHALL track all API-Football requests and alert when approaching quota limits.

#### Scenario: Log all API requests
- **GIVEN** an API request is made
- **WHEN** the response is received
- **THEN** it SHALL log endpoint, status, response time, and cache status to `api_football_usage` table

#### Scenario: Alert at quota thresholds
- **GIVEN** daily API usage exceeds 80%, 90%, or 95% of quota
- **WHEN** the threshold is crossed
- **THEN** it SHALL send a Bugsnag alert to notify admins

---

### Requirement: Admin Team Mapping Review
The system SHALL provide an admin interface to review and correct low-confidence team mappings.

#### Scenario: Display unmapped teams for review
- **GIVEN** teams exist with confidence='low' or `verified=false`
- **WHEN** admin views the team mappings page
- **THEN** it SHALL display team name, league context, top 3 candidate matches, and action buttons

#### Scenario: Manual override team mapping
- **GIVEN** admin identifies the correct API-Football team
- **WHEN** admin selects and confirms the mapping
- **THEN** it SHALL update `team_mappings` with `verified=true` and `match_method='manual'`

---

### Requirement: Prediction Service Context Preparation
The prediction service SHALL include API-Football data when preparing match context for AI predictions, with automatic fallback to scraped data.

#### Scenario: Use API-Football data when available
- **GIVEN** API-Football data exists for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include API-Football statistics, injuries, and H2H data in the AI prompt

#### Scenario: Fallback to scraped data
- **GIVEN** API-Football data is not available for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL use existing scraped xStats and team data as fallback

#### Scenario: Include critical player absences
- **GIVEN** injury data indicates missing key players
- **WHEN** preparing prediction context
- **THEN** it SHALL include a "CRITICAL PLAYER ABSENCES" section highlighting injured top scorers and captains

