## ADDED Requirements

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

## MODIFIED Requirements

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
