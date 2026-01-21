# api-football-integration Spec Delta

## MODIFIED Requirements

### Requirement: Pre-Match Data Enrichment

The system SHALL fetch and store pre-match data from API-Football during match enrichment (not just ID mapping), including statistics, injuries, and head-to-head history.

#### Scenario: Fetch fixture statistics during enrichment
- **GIVEN** match enrichment has successfully mapped API-Football IDs
- **AND** `apiFootball.fetchDuringEnrichment` is enabled
- **WHEN** enrichment completes for a match
- **THEN** it SHALL fetch fixture statistics from API-Football
- **AND** store them in `match_scraped_data` with `source='api-football'` and `data_type='statistics'`

#### Scenario: Fetch head-to-head during enrichment
- **GIVEN** match enrichment has mapped both team IDs to API-Football
- **AND** `apiFootball.fetchDuringEnrichment` is enabled
- **WHEN** enrichment completes for a match
- **THEN** it SHALL fetch H2H data for the last 10 meetings
- **AND** store it in `match_scraped_data` with `source='api-football'` and `data_type='headToHead'`

#### Scenario: Fetch player injuries during enrichment
- **GIVEN** match enrichment has mapped both team IDs to API-Football
- **AND** `apiFootball.fetchDuringEnrichment` is enabled
- **WHEN** enrichment completes for a match
- **THEN** it SHALL fetch current injuries for both teams
- **AND** store them in `match_scraped_data` with `source='api-football'` and `data_type='injuries'`

#### Scenario: Skip data fetch when API-Football is disabled
- **GIVEN** `apiFootball.enabled` is false OR circuit breaker is open
- **WHEN** match enrichment runs
- **THEN** it SHALL skip all API-Football data fetching
- **AND** log the skip reason

#### Scenario: Continue enrichment when data fetch fails
- **GIVEN** API-Football data fetch returns an error
- **WHEN** one data type fails to fetch
- **THEN** enrichment SHALL continue with remaining data types
- **AND** log the failure for monitoring
- **AND** NOT mark the overall enrichment as failed

---

### Requirement: Prediction Service Context Preparation

The prediction service SHALL include API-Football data when preparing match context for AI predictions, automatically using whichever data source has populated the match_scraped_data.

#### Scenario: Include injuries in prediction context
- **GIVEN** injury data exists in `match_scraped_data` for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include a "PLAYER INJURIES & ABSENCES" section
- **AND** list injured players with reason and severity
- **AND** highlight critical absences (top scorers, captains)

#### Scenario: Use API-Football data when available
- **GIVEN** `match_scraped_data` has records with `source='api-football'`
- **WHEN** preparing prediction context
- **THEN** it SHALL read and include the API-Football data
- **AND** the prediction prompt SHALL reflect the enhanced data

#### Scenario: Fallback to scraped data
- **GIVEN** `match_scraped_data` has only `source='web-scraping'` records
- **WHEN** preparing prediction context
- **THEN** it SHALL use the scraped data as before
- **AND** prediction quality SHALL not degrade

---

## ADDED Requirements

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
