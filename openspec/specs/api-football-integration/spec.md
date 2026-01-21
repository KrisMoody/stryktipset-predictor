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
The system SHALL fetch and store pre-match data from API-Football including statistics, injuries, lineups, team stats, standings, head-to-head history, **and external predictions**.

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
- **THEN** it SHALL fetch and store confirmed lineups with `data_type='lineups'`

#### Scenario: Fetch head-to-head history
- **GIVEN** two teams are matched for an upcoming fixture
- **WHEN** H2H data is requested
- **THEN** it SHALL fetch the last 10 meetings and cache forever (historical data is immutable)

#### Scenario: Fetch API-Football predictions
- **GIVEN** a fixture has a valid API-Football fixture ID
- **WHEN** predictions are available (2+ hours before kickoff)
- **THEN** it SHALL fetch predictions and store with `data_type='api_predictions'`

#### Scenario: Fetch team season statistics
- **GIVEN** teams are mapped to API-Football IDs
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch season statistics for both teams and store with `data_type='team_season_stats'`

#### Scenario: Fetch league standings
- **GIVEN** a match league is mapped to API-Football
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch current standings and store with `data_type='standings'`

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
The prediction service SHALL include API-Football data when preparing match context for AI predictions, with automatic fallback to scraped data **and external model comparison when available**.

#### Scenario: Use API-Football data when available
- **GIVEN** API-Football data exists for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include API-Football statistics, injuries, H2H data, **season statistics, standings, and external predictions** in the AI prompt

#### Scenario: Fallback to scraped data
- **GIVEN** API-Football data is not available for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL use existing scraped xStats and team data as fallback

#### Scenario: Include critical player absences
- **GIVEN** injury data indicates missing key players
- **WHEN** preparing prediction context
- **THEN** it SHALL include a "CRITICAL PLAYER ABSENCES" section highlighting injured top scorers and captains

#### Scenario: Include external model comparison
- **GIVEN** API-Football predictions exist for the match
- **WHEN** preparing prediction context
- **THEN** it SHALL include an "EXTERNAL MODEL COMPARISON" section with API-Football's predicted winner, win percentages, and betting advice

### Requirement: Data Provider Initialization

The system SHALL initialize the data provider factory at application startup to enable API-Football integration.

#### Scenario: Providers registered on startup
- **GIVEN** the application starts
- **WHEN** Nitro plugins execute
- **THEN** `initializeDataProviders()` SHALL be called
- **AND** providers SHALL be registered based on configuration
- **AND** successful initialization SHALL be logged

#### Scenario: ApiFootballProvider registered when enabled
- **GIVEN** `apiFootball.enabled` is true
- **WHEN** data providers initialize
- **THEN** `ApiFootballProvider` SHALL be registered with priority 1
- **AND** `CachedDataProvider` SHALL be registered with priority 2

#### Scenario: Only cached provider when API-Football disabled
- **GIVEN** `apiFootball.enabled` is false
- **WHEN** data providers initialize
- **THEN** only `CachedDataProvider` SHALL be registered
- **AND** no API-Football API calls SHALL be made

---

### Requirement: Progressive Scraper API-Football Awareness

The progressive scraper SHALL skip scraping data types that are already populated by API-Football.

#### Scenario: Skip scraping when API-Football data is fresh
- **GIVEN** `match_scraped_data` has a record with `source='api-football'`
- **AND** the record is less than 24 hours old
- **AND** `apiFootball.skipScrapingWhenAvailable` is true
- **WHEN** progressive scraper checks for stale data
- **THEN** it SHALL NOT queue that data type for scraping
- **AND** log that scraping was skipped due to API-Football data

#### Scenario: Scrape when API-Football data is missing
- **GIVEN** no `match_scraped_data` exists for a data type
- **OR** only `source='web-scraping'` data exists and is stale
- **WHEN** progressive scraper checks for stale data
- **THEN** it SHALL queue the data type for scraping as normal

#### Scenario: Respect longer freshness for API-Football data
- **GIVEN** `match_scraped_data` has `source='api-football'`
- **WHEN** calculating staleness threshold
- **THEN** it SHALL use 24-hour threshold for API-Football data
- **AND** use the normal threshold for scraped data

### Requirement: API-Football Predictions Integration
The system SHALL fetch and integrate API-Football's AI-powered predictions for fixtures to provide external model comparison and baseline validation.

#### Scenario: Fetch predictions for upcoming fixture
- **GIVEN** a fixture has a valid API-Football fixture ID
- **WHEN** data enrichment runs for the match
- **THEN** it SHALL fetch predictions from `/predictions` endpoint and store with `data_type='api_predictions'`

#### Scenario: Include predictions in prediction context
- **GIVEN** API-Football predictions exist for a match
- **WHEN** preparing prediction context for Claude
- **THEN** it SHALL include an `EXTERNAL MODEL COMPARISON` section with win percentages, advice, and team comparison metrics

#### Scenario: Flag prediction discrepancies
- **GIVEN** both API-Football and internal model predictions exist
- **WHEN** the predictions differ by more than 15% on any outcome
- **THEN** it SHALL flag the discrepancy for Claude to consider in analysis

---

### Requirement: Team Season Statistics Integration
The system SHALL fetch comprehensive season statistics for both teams from API-Football to provide richer context for predictions.

#### Scenario: Fetch season stats during enrichment
- **GIVEN** teams are mapped to API-Football IDs
- **WHEN** data enrichment runs for a match
- **THEN** it SHALL fetch season statistics from `/teams/statistics` for both home and away teams

#### Scenario: Store season statistics
- **GIVEN** season statistics are fetched successfully
- **WHEN** storing the data
- **THEN** it SHALL store with `data_type='team_season_stats'` and include form, fixtures, goals, clean sheets, biggest results, and penalty statistics

#### Scenario: Include season context in predictions
- **GIVEN** team season statistics exist for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include a `TEAM SEASON STATISTICS` section with form strings, home/away splits, and notable patterns (e.g., "5-match winning streak", "failed to score in last 3 away")

---

### Requirement: League Standings Integration
The system SHALL fetch current league standings to provide position context for match predictions.

#### Scenario: Fetch standings for match league
- **GIVEN** a match has a mapped API-Football league ID
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch standings from `/standings` endpoint for the current season

#### Scenario: Include position context in predictions
- **GIVEN** standings data exists for the match league
- **WHEN** preparing prediction context
- **THEN** it SHALL include league position for both teams (e.g., "Home: 3rd place, 45 pts | Away: 15th place, 22 pts")

#### Scenario: Flag relegation and promotion battles
- **GIVEN** a team is in promotion or relegation zone
- **WHEN** preparing prediction context
- **THEN** it SHALL flag the situation as it may affect motivation and playing style

---

### Requirement: Confirmed Lineups Integration
The system SHALL fetch confirmed lineups when available close to match kickoff to capture late-breaking squad information.

#### Scenario: Fetch lineups before deadline
- **GIVEN** a fixture is 1-2 hours before betting deadline
- **WHEN** lineup data becomes available
- **THEN** it SHALL fetch from `/fixtures/lineups` endpoint and store with `data_type='lineups'`

#### Scenario: Include lineups in predictions
- **GIVEN** confirmed lineups exist for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include a `CONFIRMED LINEUPS` section with formation, starting XI by position, and notable absences

#### Scenario: Cross-reference lineups with injuries
- **GIVEN** both lineup and injury data exist
- **WHEN** preparing prediction context
- **THEN** it SHALL cross-reference to confirm which injured players are actually missing

---

