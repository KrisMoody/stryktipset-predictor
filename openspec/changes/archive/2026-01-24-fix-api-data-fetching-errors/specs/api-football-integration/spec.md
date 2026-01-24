## MODIFIED Requirements

### Requirement: Pre-Match Data Enrichment
The system SHALL fetch and store pre-match data from API-Football including statistics, injuries, lineups, team stats, standings, head-to-head history, and external predictions. **When fetching injuries by team ID (without fixture ID), the season parameter SHALL be included.**

#### Scenario: Fetch fixture statistics for recent matches
- **GIVEN** a match is scheduled in an upcoming draw
- **WHEN** data enrichment runs
- **THEN** it SHALL fetch statistics for each team's last 5 matches and store with `data_type='statistics'`

#### Scenario: Fetch player injuries
- **GIVEN** teams are identified for an upcoming match
- **WHEN** injury data is fetched
- **THEN** it SHALL store injuries with `data_type='injuries'` and flag critical absences (top scorers, captains)

#### Scenario: Fetch injuries by team with season parameter
- **GIVEN** teams are identified for an upcoming match
- **AND** no fixture ID is available (upcoming/unscheduled match)
- **WHEN** injury data is fetched using team ID parameter
- **THEN** it SHALL include the season parameter derived from match start_time year
- **AND** it SHALL fetch injuries for both home and away teams

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

## ADDED Requirements

### Requirement: Rate Limiter Quota Visibility
The system SHALL log quota state when enforcing long rate limit waits to aid debugging of API usage issues.

#### Scenario: Log quota state on long waits
- **GIVEN** the rate limiter enforces a wait longer than 10 seconds
- **WHEN** the wait begins
- **THEN** it SHALL log the current daily quota usage (calls made / daily limit)
- **AND** it SHALL log the reason for the long wait (quota exhaustion vs rate limiting)

#### Scenario: Log warning approaching daily limit
- **GIVEN** the daily quota usage exceeds 90%
- **WHEN** a new API request is made
- **THEN** it SHALL log a warning with remaining quota count
