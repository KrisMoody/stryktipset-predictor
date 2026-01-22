# market-odds-integration Specification Delta

## ADDED Requirements

### Requirement: Market Odds Fetching
The system SHALL fetch pre-match 1X2 odds from multiple bookmakers via API-Football to provide market consensus data for predictions.

#### Scenario: Fetch market odds for fixture with valid ID
- **GIVEN** a match has a valid `api_football_fixture_id`
- **WHEN** data enrichment runs for the match
- **THEN** it SHALL fetch odds from `/odds?fixture={id}&bet=1` endpoint
- **AND** it SHALL store odds from target bookmakers (Pinnacle, Bet365, Unibet, 1xBet, Betfair)
- **AND** each bookmaker's odds SHALL be stored in `match_odds` with `source={bookmaker_name}`

#### Scenario: Calculate market consensus
- **GIVEN** market odds have been fetched from multiple bookmakers
- **WHEN** storing the odds data
- **THEN** it SHALL calculate average implied probability for each outcome (1/X/2)
- **AND** it SHALL store a `source='market_consensus'` record with these probabilities
- **AND** it SHALL include market margin and disagreement metrics

#### Scenario: Skip fetch when fixture ID is missing
- **GIVEN** a match does not have an `api_football_fixture_id`
- **WHEN** market odds fetch is attempted
- **THEN** it SHALL skip the fetch
- **AND** it SHALL log a debug message indicating why

#### Scenario: Handle missing odds gracefully
- **GIVEN** the `/odds` endpoint returns no bookmakers for a fixture
- **WHEN** the response is processed
- **THEN** it SHALL log a warning
- **AND** it SHALL continue without storing any market odds
- **AND** the overall data fetch SHALL NOT fail

#### Scenario: Respect feature flag
- **GIVEN** `API_FOOTBALL_ENABLE_MARKET_ODDS=false` in environment
- **WHEN** data enrichment runs
- **THEN** it SHALL skip market odds fetching entirely
- **AND** no `/odds` API calls SHALL be made

---

### Requirement: Market Odds Caching
The system SHALL cache market odds with appropriate TTL to balance freshness with API quota usage.

#### Scenario: Fresh market odds skip refetch
- **GIVEN** market odds exist in `match_odds` with `source='market_consensus'`
- **AND** the odds are less than 30 minutes old
- **WHEN** market odds fetch is requested
- **THEN** it SHALL skip the API call
- **AND** return the cached odds

#### Scenario: Stale market odds trigger refetch
- **GIVEN** market odds exist but are older than 30 minutes
- **WHEN** market odds fetch is requested
- **THEN** it SHALL fetch fresh odds from API-Football
- **AND** upsert the new odds into `match_odds`

---

### Requirement: Market Odds in Prediction Context
The prediction service SHALL include market odds comparison when preparing match context for AI predictions.

#### Scenario: Include market consensus comparison
- **GIVEN** market consensus odds exist for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include a "MARKET ODDS COMPARISON" section
- **AND** it SHALL show market consensus probabilities alongside Svenska Spel probabilities

#### Scenario: Flag value signals
- **GIVEN** Svenska Spel implied probability differs from market consensus by more than 5%
- **WHEN** preparing prediction context
- **THEN** it SHALL flag a "VALUE SIGNAL" in the comparison section
- **AND** indicate which outcome Svenska Spel overvalues or undervalues

#### Scenario: Include bookmaker breakdown
- **GIVEN** individual bookmaker odds exist for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL include a breakdown showing odds from each bookmaker
- **AND** it SHALL mark sharp bookmakers (Pinnacle) for context

#### Scenario: Graceful degradation without market odds
- **GIVEN** no market odds exist for a match
- **WHEN** preparing prediction context
- **THEN** it SHALL omit the "MARKET ODDS COMPARISON" section
- **AND** the prediction SHALL proceed with available data

---

## MODIFIED Requirements

### Requirement: Pre-Match Data Enrichment
The system SHALL fetch and store pre-match data from API-Football including statistics, injuries, lineups, team stats, standings, head-to-head history, external predictions, **and market odds from multiple bookmakers**.

#### Scenario: Fetch market odds during enrichment
- **GIVEN** a match is scheduled in an upcoming draw
- **AND** the match has a valid `api_football_fixture_id`
- **AND** `API_FOOTBALL_ENABLE_MARKET_ODDS` is not false
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch market odds from `/odds` endpoint
- **AND** it SHALL store odds in `match_odds` table with bookmaker-specific `source` values
