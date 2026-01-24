## ADDED Requirements

### Requirement: Automatic Data Fetching After Mapping
The system SHALL automatically fetch match statistics and head-to-head data from API-Football immediately after a match is successfully mapped to API-Football IDs.

#### Scenario: Fetch data after successful enrichment
- **GIVEN** a match has been successfully mapped (home team, away team, and league have API-Football IDs)
- **WHEN** the `enrichMatch()` function completes successfully
- **THEN** the system SHALL queue a `fetchAllDataForMatch()` call with rate limiting (500ms delay)

#### Scenario: Skip fetch for already-enriched matches
- **GIVEN** a match already has statistics and H2H data in `match_scraped_data`
- **WHEN** the enrichment process runs
- **THEN** the system SHALL skip fetching data that is not stale (within cache TTL)

#### Scenario: Skip fetch for finished matches
- **GIVEN** a match has status 'FT' (Full Time)
- **WHEN** the enrichment process runs
- **THEN** the system SHALL skip automatic data fetching to preserve API quota

---

### Requirement: Ensure Data Before Prediction
The system SHALL ensure match statistics and head-to-head data is available before generating a prediction, fetching from API-Football if missing or stale.

#### Scenario: Fetch missing data before prediction
- **GIVEN** a prediction is requested for a match
- **WHEN** the match has no statistics or H2H data in `match_scraped_data`
- **THEN** the system SHALL fetch data from API-Football before generating the prediction

#### Scenario: Refresh stale data before prediction
- **GIVEN** a prediction is requested for a match
- **WHEN** the match has statistics data older than the cache TTL (24 hours for statistics)
- **THEN** the system SHALL refresh the data from API-Football before generating the prediction

#### Scenario: Proceed with available data if fetch fails
- **GIVEN** a prediction is requested and data fetch fails
- **WHEN** API-Football is unavailable or returns an error
- **THEN** the system SHALL proceed with prediction using any existing data and log a warning

---

### Requirement: Prioritized Data Type Fetching
The system SHALL fetch data types in priority order to ensure the most valuable data is retrieved first when rate limits are approached.

#### Scenario: Fetch high-priority data first
- **GIVEN** multiple data types need to be fetched for a match
- **WHEN** the system initiates data fetching
- **THEN** it SHALL fetch in this order: Head-to-Head, Team Stats, Standings, Statistics, Injuries, Predictions, Lineups

#### Scenario: Continue after partial failure
- **GIVEN** fetching one data type fails
- **WHEN** other data types are queued
- **THEN** the system SHALL continue fetching remaining data types and log the failure

---

### Requirement: Data Source Tracking
The system SHALL track and display the source of match data (API-Football or web scraping) for transparency and debugging.

#### Scenario: Store data source on fetch
- **GIVEN** data is fetched from API-Football
- **WHEN** storing in `match_scraped_data`
- **THEN** the `source` field SHALL be set to 'api-football'

#### Scenario: Display data source in UI
- **GIVEN** statistics or H2H data is displayed to a user
- **WHEN** the data has a `source` field
- **THEN** the UI SHALL show a small indicator (e.g., "via API-Football" or "via web scraping")

---

### Requirement: Quota-Aware Auto-Fetching
The system SHALL respect API-Football quota limits and pause automatic fetching when approaching the daily limit.

#### Scenario: Pause auto-fetch at high quota usage
- **GIVEN** daily API usage exceeds 95% of quota limit
- **WHEN** a new automatic fetch is triggered
- **THEN** the system SHALL skip the fetch and log a warning

#### Scenario: Resume auto-fetch on new day
- **GIVEN** auto-fetching was paused due to quota
- **WHEN** the daily quota resets (new UTC day)
- **THEN** the system SHALL resume automatic fetching

---

## MODIFIED Requirements

### Requirement: Pre-Match Data Enrichment
The system SHALL fetch and store pre-match data from API-Football including statistics, injuries, lineups, team stats, standings, head-to-head history, and external predictions.

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

#### Scenario: Automatic fetch triggered after mapping
- **GIVEN** a match has been successfully mapped to API-Football IDs
- **WHEN** `enrichMatch()` completes with success
- **THEN** the system SHALL automatically trigger `fetchAllDataForMatch()` with appropriate rate limiting

#### Scenario: Data upserted on each fetch
- **GIVEN** data is fetched from API-Football for a match
- **WHEN** storing in `match_scraped_data`
- **THEN** the system SHALL upsert the record (update if exists, insert if new) using the unique constraint on `(match_id, data_type)`
