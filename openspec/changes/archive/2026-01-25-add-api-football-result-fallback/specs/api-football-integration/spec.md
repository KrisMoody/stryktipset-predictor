## ADDED Requirements

### Requirement: Automatic Result Fallback Sync
The system SHALL automatically fetch missing match results from API-Football for draws where 48 hours have passed since the last match started.

#### Scenario: Eligible draw detected
- **GIVEN** a draw has `is_current = true`
- **AND** the latest `start_time` among its matches is more than 48 hours ago
- **AND** at least one match has `outcome IS NULL`
- **WHEN** the scheduled result sync job runs
- **THEN** it SHALL attempt to fetch results from API-Football for matches missing results

#### Scenario: Fetch result using existing fixture ID
- **GIVEN** a match has `api_football_fixture_id` set
- **AND** the match has no result (`outcome IS NULL`)
- **WHEN** result sync processes the match
- **THEN** it SHALL fetch the fixture from API-Football by ID
- **AND** if status is FT, AET, or PEN, update the match result
- **AND** set `result_source = 'api-football'`

#### Scenario: Enrich match before fetching result
- **GIVEN** a match has no `api_football_fixture_id`
- **AND** the match has no result
- **WHEN** result sync processes the match
- **THEN** it SHALL run match enrichment first to find the fixture ID
- **AND** then attempt to fetch the result if enrichment succeeds

#### Scenario: Archive draw after successful sync
- **GIVEN** all matches in a draw now have results or terminal status
- **WHEN** result sync completes for that draw
- **THEN** it SHALL archive the draw (set `is_current = false`, `status = 'Completed'`)

---

### Requirement: Handle Non-Standard Match States
The system SHALL appropriately handle matches that are postponed, cancelled, or abandoned.

#### Scenario: Postponed match
- **GIVEN** API-Football returns status PST for a fixture
- **WHEN** result sync processes this match
- **THEN** it SHALL update the match status to 'Postponed'
- **AND** NOT set a result (leave as null)
- **AND** NOT block draw finalization due to missing result

#### Scenario: Cancelled match
- **GIVEN** API-Football returns status CANC for a fixture
- **WHEN** result sync processes this match
- **THEN** it SHALL update the match status to 'Cancelled'
- **AND** NOT set a result
- **AND** NOT block draw finalization

#### Scenario: Match still in progress
- **GIVEN** API-Football returns status 1H, HT, 2H, ET, or LIVE
- **WHEN** result sync processes this match
- **THEN** it SHALL skip the match
- **AND** log that the match is still in progress
- **AND** retry on the next sync cycle

---

### Requirement: Manual Result Lookup
The system SHALL allow administrators to manually trigger result lookup from API-Football for any draw.

#### Scenario: Preview missing results
- **GIVEN** an admin views a draw with missing results
- **WHEN** admin requests result status
- **THEN** the system SHALL show which matches are missing results
- **AND** indicate which matches have API-Football fixture IDs available
- **AND** indicate which matches would need enrichment first

#### Scenario: Fetch results on demand
- **GIVEN** an admin triggers "Fetch Results" for a draw
- **WHEN** the fetch completes
- **THEN** the system SHALL show fetched results for review
- **AND** highlight any discrepancies with existing Svenska Spel results
- **AND** allow admin to confirm or cancel the update

#### Scenario: Commit results after review
- **GIVEN** an admin has reviewed fetched results
- **WHEN** admin confirms the update
- **THEN** the system SHALL update matches with the fetched results
- **AND** record `result_source = 'api-football'`
- **AND** allow admin to proceed with draw finalization

---

### Requirement: Result Validation
The system SHALL validate results between Svenska Spel and API-Football when both sources provide data.

#### Scenario: Results match
- **GIVEN** Svenska Spel and API-Football both have results for a match
- **AND** the results are identical
- **WHEN** result sync processes this match
- **THEN** it SHALL log success and keep the existing result

#### Scenario: Results differ
- **GIVEN** Svenska Spel and API-Football have different results for a match
- **WHEN** result sync processes this match
- **THEN** it SHALL log a warning with both results
- **AND** keep the Svenska Spel result (authoritative for betting)
- **AND** surface the discrepancy in admin UI

---

### Requirement: Result Sync Scheduling
The system SHALL run a scheduled job to perform automatic result sync.

#### Scenario: Scheduled execution
- **GIVEN** the scheduler is running
- **WHEN** the configured interval (6 hours) elapses
- **THEN** it SHALL execute the result sync job
- **AND** process only current draws past the 48h threshold

#### Scenario: Respect API quota
- **GIVEN** result sync is running
- **WHEN** daily API quota is exhausted
- **THEN** it SHALL skip fetching and log a warning
- **AND** retry on the next scheduled cycle

---

## MODIFIED Requirements

### Requirement: Post-Match Result Sync
The system SHALL automatically capture match results from API-Football daily to update predictions and track performance.

#### Scenario: Daily result sync
- **GIVEN** matches from yesterday have completed
- **WHEN** the daily sync job runs at 6 AM
- **THEN** it SHALL fetch completed fixtures and update match results in the database

#### Scenario: Fallback result sync for overdue draws
- **GIVEN** a draw is 48+ hours past its last match start time
- **AND** has matches without results
- **WHEN** the result fallback sync runs (every 6 hours)
- **THEN** it SHALL fetch missing results from API-Football
- **AND** archive the draw if all matches become complete

#### Scenario: Trigger performance calculation
- **GIVEN** match results are updated (from any source)
- **WHEN** the result sync completes
- **THEN** it SHALL trigger automatic prediction performance calculation
